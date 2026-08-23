import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.agent import agent_runner, is_api_key_configured
from app.config import get_settings
from app.live_routes import router as live_router
from app.models import (
    AgentInfoResponse,
    AgentMessageRequest,
    AgentMessageResponse,
    HealthResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()
router.include_router(live_router)


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="System Health & Readiness Probe",
    tags=["System"],
)
async def health_check() -> HealthResponse:
    """Return health status and system metadata."""
    settings = get_settings()
    return HealthResponse(
        status="ok",
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )


@router.get(
    "/agent/info",
    response_model=AgentInfoResponse,
    summary="Get Active Agent Information",
    tags=["Agent"],
)
async def get_agent_info() -> AgentInfoResponse:
    """Retrieve metadata about the currently configured Google ADK agent."""
    settings = get_settings()
    return AgentInfoResponse(
        name=agent_runner.agent.name,
        description=agent_runner.agent.description or "",
        model=settings.GEMINI_MODEL,
        api_key_configured=is_api_key_configured(settings.GEMINI_API_KEY),
    )


@router.post(
    "/agent/chat",
    response_model=AgentMessageResponse,
    summary="Send Message to Google ADK Agent",
    tags=["Agent"],
)
async def chat_with_agent(payload: AgentMessageRequest) -> AgentMessageResponse:
    """Send a message/task to the Google ADK agent and receive the response."""
    try:
        result = await agent_runner.run(
            message=payload.message,
            session_id=payload.session_id,
            context=payload.context,
        )
        return AgentMessageResponse(**result)
    except Exception as exc:
        logger.error("Failed processing agent request: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent workflow error: {exc!s}",
        ) from exc


@router.get(
    "/knowledge/products",
    summary="List Ingested Products in Knowledge Base",
    tags=["Knowledge Base"],
)
async def list_knowledge_products() -> dict[str, Any]:
    """Retrieve list of products, SKUs, and registered components currently available in vector store."""
    from app.vector_search import vector_store

    products = vector_store.list_products()
    return {
        "total_products": len(products),
        "products": products,
    }


@router.get(
    "/knowledge/search",
    summary="Vector Search Knowledge Base",
    tags=["Knowledge Base"],
)
async def search_knowledge(
    query: str,
    product: str | None = None,
    component: str | None = None,
    top_k: int = 4,
) -> dict[str, Any]:
    """Execute vector similarity search across product manuals and troubleshooting guides."""
    from app.vector_search import vector_store

    results = vector_store.search(
        query_text=query,
        product_filter=product,
        component_filter=component,
        top_k=top_k,
    )
    return {
        "query": query,
        "matched_count": len(results),
        "results": [
            {
                "chunk_id": r.chunk.id,
                "product_name": r.chunk.product_name,
                "category": r.chunk.category,
                "component": r.chunk.component_name,
                "title": r.chunk.title,
                "content": r.chunk.text_content,
                "controls_or_options": r.chunk.possible_states_or_options,
                "instructions": r.chunk.instructions,
                "similarity_score": r.similarity_score,
                "modality": r.matched_modality,
            }
            for r in results
        ],
    }


@router.delete(
    "/knowledge/clear",
    summary="Clear Knowledge Base Vector Collection",
    tags=["Knowledge Base"],
)
async def clear_knowledge_base() -> dict[str, Any]:
    """Delete all indexed knowledge chunks and embeddings from the Vertex AI Vector Search collection."""
    from app.vector_search import vector_store

    deleted_count = vector_store.clear_collection()
    return {
        "status": "success",
        "deleted_count": deleted_count,
        "message": f"Successfully cleared {deleted_count} data objects from collection.",
    }


@router.delete(
    "/knowledge/products/{product_id:path}",
    summary="Delete Specific Product from Knowledge Base",
    tags=["Knowledge Base"],
)
async def delete_knowledge_product(product_id: str) -> dict[str, Any]:
    """Delete all chunks and embeddings for a specific Product ID or Product Name."""
    from app.vector_search import vector_store

    deleted_count = vector_store.delete_product(product_id)
    return {
        "status": "success",
        "product": product_id,
        "deleted_count": deleted_count,
        "message": f"Successfully deleted {deleted_count} chunks for product '{product_id}'.",
    }

