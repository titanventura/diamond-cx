"""Multimodal Vector Search and Knowledge Retrieval Engine.

Integrates with Google Vertex AI Vector Search 2.0 (Agent Retrieval) and
Gemini Multimodal Embedding (gemini-embedding-2-preview) for live multimodal vector
storage, indexing, and hybrid text/image similarity search.
"""

from __future__ import annotations

import json
import logging
import math
import os
import time
from pathlib import Path
from typing import Any

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from google.protobuf import struct_pb2


def _cosine_similarity(v1: list[float] | None, v2: list[float] | None) -> float:
    """Compute cosine similarity between two float vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1)) or 1.0
    norm2 = math.sqrt(sum(b * b for b in v2)) or 1.0
    return max(-1.0, min(1.0, dot / (norm1 * norm2)))

try:
    from google.cloud import vectorsearch_v1
    VECTOR_SEARCH_LIB_AVAILABLE = True
except ImportError:
    try:
        from google.cloud import vectorsearch_v1beta as vectorsearch_v1
        VECTOR_SEARCH_LIB_AVAILABLE = True
    except ImportError:
        vectorsearch_v1 = None
        VECTOR_SEARCH_LIB_AVAILABLE = False

from app.config import get_settings
from app.models import KnowledgeChunk, VectorSearchResult

logger = logging.getLogger("diamond_cx.vector_search")

DEFAULT_IMAGE_MIME_TYPE = "image/jpeg"
EMBEDDING_MAX_RETRIES = 3
EMBEDDING_RETRY_BASE_DELAY = 0.5


def _deterministic_mock_embedding(text: str, dim: int = 768) -> list[float]:
    """Generate a deterministic pseudo-vector for offline local dev/testing."""
    import hashlib
    seed_hash = hashlib.sha256(text.encode("utf-8")).digest()
    vec: list[float] = []
    for i in range(dim):
        byte_val = seed_hash[i % len(seed_hash)]
        # Map to range [-1.0, 1.0]
        val = (byte_val / 127.5) - 1.0
        # Add harmonic variation
        val += math.sin(i * 0.1) * 0.2
        vec.append(val)
    # Normalize vector to unit length
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


class EmbeddingClient:
    """Client for generating multimodal embeddings using Gemini / Vertex AI."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._client: genai.Client | None = None

    def _get_genai_client(self) -> genai.Client | None:
        if self._client is not None:
            return self._client

        settings = self.settings
        try:
            if settings.GOOGLE_GENAI_USE_VERTEXAI and settings.GOOGLE_CLOUD_PROJECT:
                logger.info(
                    "Initializing GenAI Client with Vertex AI: project=%s, location=%s",
                    settings.GOOGLE_CLOUD_PROJECT,
                    settings.GOOGLE_CLOUD_LOCATION,
                )
                self._client = genai.Client(
                    vertexai=True,
                    project=settings.GOOGLE_CLOUD_PROJECT,
                    location=settings.GOOGLE_CLOUD_LOCATION,
                )
            elif settings.GEMINI_API_KEY and "your-gemini-api-key" not in settings.GEMINI_API_KEY.lower():
                self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
            elif os.environ.get("GEMINI_API_KEY"):
                self._client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        except Exception as exc:
            logger.warning("Could not initialize GenAI Client for embeddings: %s", exc)

        return self._client

    def embed_text(self, text: str) -> list[float]:
        """Generate a dense embedding vector from text."""
        return self.embed(text=text)

    def embed_image(self, image_bytes: bytes, mime_type: str = DEFAULT_IMAGE_MIME_TYPE) -> list[float]:
        """Generate a dense embedding vector from raw image bytes."""
        return self.embed(image_bytes=image_bytes, mime_type=mime_type)

    def embed(
        self,
        text: str | None = None,
        image_bytes: bytes | None = None,
        mime_type: str = DEFAULT_IMAGE_MIME_TYPE,
    ) -> list[float]:
        """Generate a multimodal vector embedding using gemini-embedding-2-preview."""
        settings = self.settings
        client = self._get_genai_client()

        # Offline / Mock Fallback if no valid client is configured
        if client is None:
            payload = text or f"image_{len(image_bytes or b'')}"
            return _deterministic_mock_embedding(payload, dim=settings.EMBEDDING_DIMENSION)

        contents: str | types.Part
        if text is not None:
            contents = text
        elif image_bytes is not None:
            contents = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        else:
            raise ValueError("Either text or image_bytes must be provided for embedding.")

        config = types.EmbedContentConfig(
            output_dimensionality=settings.EMBEDDING_DIMENSION
        )

        for attempt in range(EMBEDDING_MAX_RETRIES + 1):
            try:
                response = client.models.embed_content(
                    model=settings.EMBEDDING_MODEL,
                    contents=contents,
                    config=config,
                )
                if response.embeddings and len(response.embeddings) > 0:
                    return list(response.embeddings[0].values)
                raise RuntimeError("Gemini embedding returned empty embedding values")
            except genai_errors.APIError as exc:
                if exc.code == 429 or "RESOURCE_EXHAUSTED" in str(exc):
                    if attempt < EMBEDDING_MAX_RETRIES:
                        delay = EMBEDDING_RETRY_BASE_DELAY * (2**attempt)
                        logger.warning("Embedding rate limit hit; retrying in %.1fs (attempt %d/%d)", delay, attempt + 1, EMBEDDING_MAX_RETRIES)
                        time.sleep(delay)
                        continue
                logger.warning("Vertex/Gemini API error during embedding generation: %s", exc)
                payload = text or f"image_{len(image_bytes or b'')}"
                return _deterministic_mock_embedding(payload, dim=settings.EMBEDDING_DIMENSION)
            except Exception as exc:
                logger.warning("Unexpected error during embedding generation: %s", exc)
                payload = text or f"image_{len(image_bytes or b'')}"
                return _deterministic_mock_embedding(payload, dim=settings.EMBEDDING_DIMENSION)

        payload = text or f"image_{len(image_bytes or b'')}"
        return _deterministic_mock_embedding(payload, dim=settings.EMBEDDING_DIMENSION)


def _chunk_to_data_object(
    chunk: KnowledgeChunk,
    text_emb: list[float] | None = None,
    image_emb: list[float] | None = None,
) -> vectorsearch_v1.DataObject:
    """Convert a domain KnowledgeChunk into a Google Cloud Vector Search DataObject."""
    data_struct = struct_pb2.Struct()
    chunk_dict = {
        "id": chunk.id,
        "product_id": chunk.product_id,
        "product_name": chunk.product_name,
        "category": chunk.category,
        "component_name": chunk.component_name or "",
        "content_type": chunk.content_type,
        "title": chunk.title,
        "text_content": chunk.text_content,
        "image_path": chunk.image_path or "",
        "step_number": chunk.step_number if chunk.step_number is not None else 0,
        "options": ", ".join(chunk.possible_states_or_options),
        "instructions": " | ".join(chunk.instructions),
    }
    data_struct.update(chunk_dict)

    vectors_map: dict[str, vectorsearch_v1.Vector] = {}
    if text_emb:
        vectors_map["text_emb"] = vectorsearch_v1.Vector(
            dense=vectorsearch_v1.DenseVector(values=text_emb)
        )
    if image_emb:
        vectors_map["image_emb"] = vectorsearch_v1.Vector(
            dense=vectorsearch_v1.DenseVector(values=image_emb)
        )

    return vectorsearch_v1.DataObject(
        data_object_id=chunk.id,
        data=data_struct,
        vectors=vectors_map,
    )


def _data_object_to_chunk(data_obj: vectorsearch_v1.DataObject) -> KnowledgeChunk:
    """Reconstruct a domain KnowledgeChunk from a Google Cloud Vector Search DataObject."""
    data = dict(data_obj.data) if getattr(data_obj, "data", None) else {}

    options_raw = data.get("options", "")
    possible_states = [o.strip() for o in options_raw.split(",") if o.strip()] if isinstance(options_raw, str) else list(data.get("possible_states_or_options", []))

    instr_raw = data.get("instructions", "")
    instructions = [i.strip() for i in instr_raw.split("|") if i.strip()] if isinstance(instr_raw, str) else list(data.get("instructions", []))

    step_num = data.get("step_number")
    step_val = int(step_num) if step_num is not None and int(step_num) > 0 else None

    return KnowledgeChunk(
        id=data_obj.data_object_id or data.get("id", ""),
        product_id=data.get("product_id", ""),
        product_name=data.get("product_name", ""),
        category=data.get("category", "General"),
        component_name=data.get("component_name") or None,
        content_type=data.get("content_type", "procedure"),
        title=data.get("title", ""),
        text_content=data.get("text_content", ""),
        image_path=data.get("image_path") or None,
        step_number=step_val,
        possible_states_or_options=possible_states,
        instructions=instructions,
        metadata={"data_object_id": data_obj.data_object_id},
    )


class VectorStoreManager:
    """Direct Google Cloud Vertex AI Vector Search 2.0 (Agent Retrieval) manager."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.embedding_client = EmbeddingClient()
        self._search_client = None
        self._data_client = None
        self.collection_name = ""
        self._init_gcp_clients()

    def _init_gcp_clients(self) -> None:
        """Initialize Google Cloud Vector Search 2.0 clients and collection path."""
        if not VECTOR_SEARCH_LIB_AVAILABLE or not self.settings.GOOGLE_CLOUD_PROJECT:
            logger.warning("Google Cloud Vector Search library or GCP project is not configured.")
            return

        try:
            self._search_client = vectorsearch_v1.DataObjectSearchServiceClient()
            self._data_client = vectorsearch_v1.DataObjectServiceClient()
            self.collection_name = (
                f"projects/{self.settings.GOOGLE_CLOUD_PROJECT}/locations/"
                f"{self.settings.GOOGLE_CLOUD_LOCATION}/collections/{self.settings.VECTOR_SEARCH_COLLECTION_ID}"
            )
            logger.info("Initialized Google Cloud Vector Search 2.0 client for collection: %s", self.collection_name)
        except Exception as exc:
            logger.error("Failed to initialize Google Cloud Vector Search 2.0 clients: %s", exc)

    def _get_local_store_path(self) -> Path:
        p = Path(self.settings.KNOWLEDGE_STORE_PATH)
        if not p.is_absolute():
            backend_dir = Path(__file__).resolve().parent.parent
            return backend_dir / p
        return p

    def _read_local_store(self) -> dict[str, dict[str, Any]]:
        path = self._get_local_store_path()
        if not path.exists() or path.stat().st_size == 0:
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def _write_local_store(self, data: dict[str, dict[str, Any]]) -> None:
        path = self._get_local_store_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
        tmp.replace(path)

    def ingest_chunk(self, chunk: KnowledgeChunk) -> KnowledgeChunk:
        """Embed and persist a KnowledgeChunk locally and to Google Cloud Vector Search (if active)."""
        # 1. Generate text embedding
        embed_text = (
            f"Product: {chunk.product_name}\n"
            f"Category: {chunk.category}\n"
            f"Component: {chunk.component_name or 'General'}\n"
            f"Title: {chunk.title}\n"
            f"Content: {chunk.text_content}\n"
            f"Controls/Options: {', '.join(chunk.possible_states_or_options)}\n"
            f"Instructions: {' '.join(chunk.instructions)}"
        )
        text_emb = self.embedding_client.embed_text(embed_text)
        chunk.embedding = text_emb

        # 2. If chunk references an image file, generate image vector as well
        image_emb = None
        if chunk.image_path and Path(chunk.image_path).exists():
            try:
                img_bytes = Path(chunk.image_path).read_bytes()
                image_emb = self.embedding_client.embed_image(img_bytes)
            except Exception as exc:
                logger.warning("Could not embed image file %s: %s", chunk.image_path, exc)

        if not image_emb and chunk.content_type == "image":
            image_emb = text_emb

        # 3. Always save to local persistent JSON vector store
        local_data = self._read_local_store()
        local_data[chunk.id] = {
            "chunk": chunk.model_dump(exclude_none=True),
            "text_emb": text_emb,
            "image_emb": image_emb,
        }
        self._write_local_store(local_data)
        logger.info("Persisted chunk %s in local knowledge store", chunk.id)

        # 4. If Cloud Vector Search is enabled, attempt cloud upload
        if self._data_client and self.collection_name and VECTOR_SEARCH_LIB_AVAILABLE:
            try:
                data_obj = _chunk_to_data_object(chunk, text_emb=text_emb, image_emb=image_emb)
                req = vectorsearch_v1.CreateDataObjectRequest(
                    parent=self.collection_name,
                    data_object=data_obj,
                    data_object_id=chunk.id,
                )
                self._data_client.create_data_object(request=req)
                logger.info("Created DataObject %s in Cloud Vector DB", chunk.id)
            except Exception as create_exc:
                try:
                    data_obj.name = f"{self.collection_name}/dataObjects/{chunk.id}"
                    req = vectorsearch_v1.UpdateDataObjectRequest(
                        data_object=data_obj,
                    )
                    self._data_client.update_data_object(request=req)
                    logger.info("Updated DataObject %s in Cloud Vector DB", chunk.id)
                except Exception as update_exc:
                    logger.warning("Cloud Vector Search sync skipped: %s (local store saved)", update_exc)

        return chunk

    def _search_local(
        self,
        query_text: str | None = None,
        query_image_bytes: bytes | None = None,
        product_filter: str | None = None,
        component_filter: str | None = None,
        top_k: int = 4,
    ) -> list[VectorSearchResult]:
        """Perform cosine similarity search against local persistent knowledge store."""
        local_data = self._read_local_store()
        if not local_data:
            return []

        text_vec = self.embedding_client.embed_text(query_text) if query_text else None
        image_vec = self.embedding_client.embed_image(query_image_bytes) if query_image_bytes else None

        prod_norm = product_filter.strip().lower() if product_filter else None
        comp_norm = component_filter.strip().lower() if component_filter else None

        candidates: list[VectorSearchResult] = []
        for item_id, item in local_data.items():
            c_dict = item.get("chunk", {})
            chunk = KnowledgeChunk(**c_dict)

            # Apply filters
            if prod_norm:
                if prod_norm not in chunk.product_name.lower() and prod_norm not in chunk.product_id.lower():
                    continue
            if comp_norm and chunk.component_name:
                if comp_norm not in chunk.component_name.lower():
                    continue

            # Calculate similarity
            score = 0.0
            mod = "text"
            if text_vec and item.get("text_emb"):
                t_score = _cosine_similarity(text_vec, item["text_emb"])
                score = max(score, t_score)
            if image_vec and item.get("image_emb"):
                i_score = _cosine_similarity(image_vec, item["image_emb"])
                if text_vec:
                    score = (score * 0.6) + (i_score * 0.4)
                    mod = "hybrid"
                else:
                    score = i_score
                    mod = "image"

            # Keyword & state boost
            if query_text:
                q_lower = query_text.lower()
                if chunk.component_name and chunk.component_name.lower() in q_lower:
                    score += 0.15
                if any(opt.lower() in q_lower for opt in chunk.possible_states_or_options):
                    score += 0.10

            candidates.append(
                VectorSearchResult(
                    chunk=chunk,
                    similarity_score=round(score, 4),
                    matched_modality=mod,
                )
            )

        candidates.sort(key=lambda x: x.similarity_score, reverse=True)
        return candidates[:top_k]

    def ingest_batch(self, chunks: list[KnowledgeChunk]) -> int:
        """Batch ingest a list of KnowledgeChunks."""
        count = 0
        for chunk in chunks:
            self.ingest_chunk(chunk)
            count += 1
        logger.info("Ingested %d chunks into vector store", count)
        return count

    def search(
        self,
        query_text: str | None = None,
        query_image_bytes: bytes | None = None,
        product_filter: str | None = None,
        component_filter: str | None = None,
        top_k: int = 4,
        min_score: float = 0.25,
    ) -> list[VectorSearchResult]:
        """Perform multimodal vector search, with automatic local fallback."""
        if not query_text and not query_image_bytes:
            return []

        if not self._search_client or not self.collection_name:
            return self._search_local(
                query_text=query_text,
                query_image_bytes=query_image_bytes,
                product_filter=product_filter,
                component_filter=component_filter,
                top_k=top_k,
            )

        text_vec: list[float] | None = None
        image_vec: list[float] | None = None

        if query_text:
            text_vec = self.embedding_client.embed_text(query_text)
        if query_image_bytes:
            image_vec = self.embedding_client.embed_image(query_image_bytes)

        fetch_k = max(top_k * 4, 15)
        raw_results: list[tuple[Any, str]] = []

        # Vector search against text embedding field
        if text_vec:
            try:
                v_search = vectorsearch_v1.VectorSearch(
                    search_field="text_emb",
                    vector=vectorsearch_v1.DenseVector(values=text_vec),
                    top_k=fetch_k,
                    output_fields=vectorsearch_v1.OutputFields(data_fields=["*"]),
                )
                req = vectorsearch_v1.SearchDataObjectsRequest(
                    parent=self.collection_name,
                    vector_search=v_search,
                )
                resp = self._search_client.search_data_objects(request=req)
                raw_results.extend([(r, "text") for r in resp.results])
            except Exception as exc:
                logger.error("Text vector search error against Vertex DB: %s", exc)

        # Vector search against image embedding field
        if image_vec:
            try:
                v_search = vectorsearch_v1.VectorSearch(
                    search_field="image_emb",
                    vector=vectorsearch_v1.DenseVector(values=image_vec),
                    top_k=fetch_k,
                    output_fields=vectorsearch_v1.OutputFields(data_fields=["*"]),
                )
                req = vectorsearch_v1.SearchDataObjectsRequest(
                    parent=self.collection_name,
                    vector_search=v_search,
                )
                resp = self._search_client.search_data_objects(request=req)
                raw_results.extend([(r, "image") for r in resp.results])
            except Exception as exc:
                logger.error("Image vector search error against Vertex DB: %s", exc)

        # Process, filter, and score candidate chunks
        seen_ids: dict[str, VectorSearchResult] = {}
        prod_norm = product_filter.strip().lower() if product_filter else None
        comp_norm = component_filter.strip().lower() if component_filter else None

        for r, mod in raw_results:
            chunk = _data_object_to_chunk(r.data_object)

            # Apply metadata filters
            if prod_norm:
                if prod_norm not in chunk.product_name.lower() and prod_norm not in chunk.product_id.lower():
                    continue
            if comp_norm and chunk.component_name:
                if comp_norm not in chunk.component_name.lower():
                    continue

            # Vertex AI returns distance / similarity metric
            base_score = float(getattr(r, "distance", 0.0) or getattr(r, "score", 0.0) or 0.0)

            # Keyword and state exact match boost
            bonus = 0.0
            if query_text:
                q_lower = query_text.lower()
                if chunk.component_name and chunk.component_name.lower() in q_lower:
                    bonus += 0.15
                if any(opt.lower() in q_lower for opt in chunk.possible_states_or_options):
                    bonus += 0.10

            final_score = base_score + bonus

            if chunk.id in seen_ids:
                prev = seen_ids[chunk.id]
                prev.similarity_score = round((prev.similarity_score * 0.6) + (final_score * 0.4), 4)
                prev.matched_modality = "hybrid"
            else:
                seen_ids[chunk.id] = VectorSearchResult(
                    chunk=chunk,
                    similarity_score=round(final_score, 4),
                    matched_modality=mod,
                )

        results = list(seen_ids.values())
        results.sort(key=lambda x: x.similarity_score, reverse=True)
        return results[:top_k]

    def get_component_details(
        self, product_name: str, component_name: str
    ) -> list[KnowledgeChunk]:
        """Retrieve all instruction and state chunks for a specific component."""
        p_name = product_name.strip().lower()
        c_name = component_name.strip().lower()

        if not self._search_client or not self.collection_name:
            local_data = self._read_local_store()
            matched = []
            for item in local_data.values():
                chunk = KnowledgeChunk(**item.get("chunk", {}))
                if p_name in chunk.product_name.lower() or chunk.product_name.lower() in p_name:
                    if chunk.component_name and (c_name in chunk.component_name.lower() or chunk.component_name.lower() in c_name):
                        matched.append(chunk)
            matched.sort(key=lambda c: (c.step_number or 0))
            return matched

        matched: list[KnowledgeChunk] = []
        try:
            req = vectorsearch_v1.QueryDataObjectsRequest(
                parent=self.collection_name,
                page_size=100,
                output_fields=vectorsearch_v1.OutputFields(data_fields=["*"]),
            )
            resp = self._search_client.query_data_objects(request=req)
            for obj in resp.data_objects:
                chunk = _data_object_to_chunk(obj)
                if p_name in chunk.product_name.lower() or chunk.product_name.lower() in p_name:
                    if chunk.component_name and (c_name in chunk.component_name.lower() or chunk.component_name.lower() in c_name):
                        matched.append(chunk)
        except Exception as exc:
            logger.error("Failed to query component details from Vertex DB: %s", exc)

        matched.sort(key=lambda c: (c.step_number or 0))
        return matched

    def list_products(self) -> list[dict[str, Any]]:
        """List distinct products and registered components."""
        if not self._search_client or not self.collection_name:
            local_data = self._read_local_store()
            products: dict[str, dict[str, Any]] = {}
            for item in local_data.values():
                chunk = KnowledgeChunk(**item.get("chunk", {}))
                pid = chunk.product_id
                if not pid:
                    continue
                if pid not in products:
                    products[pid] = {
                        "product_id": pid,
                        "product_name": chunk.product_name,
                        "category": chunk.category,
                        "components": set(),
                        "total_chunks": 0,
                    }
                if chunk.component_name:
                    products[pid]["components"].add(chunk.component_name)
                products[pid]["total_chunks"] += 1

            return [
                {
                    "product_id": p["product_id"],
                    "product_name": p["product_name"],
                    "category": p["category"],
                    "components": sorted(list(p["components"])),
                    "total_chunks": p["total_chunks"],
                }
                for p in products.values()
            ]

        products: dict[str, dict[str, Any]] = {}
        try:
            req = vectorsearch_v1.QueryDataObjectsRequest(
                parent=self.collection_name,
                page_size=100,
                output_fields=vectorsearch_v1.OutputFields(data_fields=["*"]),
            )
            resp = self._search_client.query_data_objects(request=req)
            for obj in resp:
                chunk = _data_object_to_chunk(obj)
                pid = chunk.product_id
                if not pid:
                    continue
                if pid not in products:
                    products[pid] = {
                        "product_id": pid,
                        "product_name": chunk.product_name,
                        "category": chunk.category,
                        "components": set(),
                        "total_chunks": 0,
                    }
                if chunk.component_name:
                    products[pid]["components"].add(chunk.component_name)
                products[pid]["total_chunks"] += 1
        except Exception as exc:
            logger.error("Failed to query products from Vertex DB: %s", exc)

        return [
            {
                "product_id": p["product_id"],
                "product_name": p["product_name"],
                "category": p["category"],
                "components": sorted(list(p["components"])),
                "total_chunks": p["total_chunks"],
            }
            for p in products.values()
        ]

    def delete_chunk(self, chunk_id: str) -> bool:
        """Delete a specific chunk from vector store (local and cloud)."""
        local_data = self._read_local_store()
        deleted = False
        if chunk_id in local_data:
            del local_data[chunk_id]
            self._write_local_store(local_data)
            deleted = True

        if not self._data_client or not self.collection_name:
            return deleted

        try:
            name = f"{self.collection_name}/dataObjects/{chunk_id}"
            self._data_client.delete_data_object(name=name)
            logger.info("Deleted DataObject %s from Vector DB", chunk_id)
            return True
        except Exception as exc:
            logger.error("Failed to delete DataObject %s: %s", chunk_id, exc)
            return False

    def delete_product(self, product_identifier: str) -> int:
        """Delete all chunks associated with a specific product ID or product Name."""
        target = product_identifier.strip().lower()
        local_data = self._read_local_store()
        to_del = [
            k for k, item in local_data.items()
            if target in item.get("chunk", {}).get("product_id", "").lower()
            or target in item.get("chunk", {}).get("product_name", "").lower()
        ]
        for k in to_del:
            del local_data[k]
        if to_del:
            self._write_local_store(local_data)
        deleted_count = len(to_del)

        if not self._search_client or not self._data_client or not self.collection_name:
            return deleted_count

        try:
            req = vectorsearch_v1.QueryDataObjectsRequest(
                parent=self.collection_name,
                page_size=100,
                output_fields=vectorsearch_v1.OutputFields(data_fields=["*"]),
            )
            resp = self._search_client.query_data_objects(request=req)

            matching_objects = []
            for obj in resp:
                chunk = _data_object_to_chunk(obj)
                chunk_pid = chunk.product_id.strip().lower()
                chunk_pname = chunk.product_name.strip().lower()
                obj_id = (obj.data_object_id or "").lower()

                if (
                    chunk_pid == target
                    or chunk_pname == target
                    or target in chunk_pid
                    or target in chunk_pname
                    or obj_id.startswith(target)
                ):
                    matching_objects.append(obj)

            if not matching_objects:
                logger.info("No chunks found matching product '%s' in cloud.", product_identifier)
                return deleted_count

            delete_requests = [
                vectorsearch_v1.DeleteDataObjectRequest(name=obj.name)
                for obj in matching_objects
            ]

            for i in range(0, len(delete_requests), 1000):
                batch = delete_requests[i : i + 1000]
                batch_req = vectorsearch_v1.BatchDeleteDataObjectsRequest(
                    parent=self.collection_name,
                    requests=batch,
                )
                self._data_client.batch_delete_data_objects(request=batch_req)

            logger.info(
                "Deleted %d DataObjects for product '%s' from collection %s",
                len(matching_objects),
                product_identifier,
                self.collection_name,
            )
        except Exception as exc:
            logger.error("Failed to batch delete product '%s': %s", product_identifier, exc)

        return deleted_count

    def clear_collection(self) -> int:
        """Delete all DataObjects from the vector store."""
        local_data = self._read_local_store()
        deleted_count = len(local_data)
        self._write_local_store({})

        if not self._search_client or not self._data_client or not self.collection_name:
            return deleted_count

        deleted_count = 0
        try:
            req = vectorsearch_v1.QueryDataObjectsRequest(
                parent=self.collection_name,
                page_size=100,
                output_fields=vectorsearch_v1.OutputFields(data_fields=["id"]),
            )
            resp = self._search_client.query_data_objects(request=req)
            data_objects = list(resp)
            if not data_objects:
                logger.info("Collection %s is already empty.", self.collection_name)
                return 0

            delete_requests = [
                vectorsearch_v1.DeleteDataObjectRequest(name=obj.name)
                for obj in data_objects
            ]

            for i in range(0, len(delete_requests), 1000):
                batch = delete_requests[i : i + 1000]
                batch_req = vectorsearch_v1.BatchDeleteDataObjectsRequest(
                    parent=self.collection_name,
                    requests=batch,
                )
                self._data_client.batch_delete_data_objects(request=batch_req)
                deleted_count += len(batch)

            logger.info("Cleared %d DataObjects from collection %s", deleted_count, self.collection_name)
        except Exception as exc:
            logger.error("Failed to batch clear collection: %s. Attempting fallback individual delete.", exc)
            try:
                req = vectorsearch_v1.QueryDataObjectsRequest(
                    parent=self.collection_name,
                    page_size=100,
                    output_fields=vectorsearch_v1.OutputFields(data_fields=["id"]),
                )
                resp = self._search_client.query_data_objects(request=req)
                for obj in resp:
                    try:
                        self._data_client.delete_data_object(name=obj.name)
                        deleted_count += 1
                    except Exception as del_err:
                        logger.warning("Failed to delete obj %s: %s", obj.name, del_err)
            except Exception as query_err:
                logger.error("Fallback query failed: %s", query_err)

        return deleted_count


# Global singleton vector store manager
vector_store = VectorStoreManager()
