"""Interactive CLI & Autopilot Ingestion Tool for Diamond CX Multimodal Knowledge Base.

Scans directories for product manuals (Markdown/Text) and component images,
chunks instructions, generates Gemini/Vertex AI embeddings, and populates the vector store.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import uuid
from pathlib import Path
from typing import Any

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rich import print as rprint
from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.prompt import Prompt
from rich.table import Table

from app.models import KnowledgeChunk
from app.vector_search import vector_store

console = Console()

SUPPORTED_TEXT_EXTS = {".md", ".txt", ".json"}
SUPPORTED_IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def parse_markdown_chunks(
    file_path: Path, product_id: str, product_name: str, category: str
) -> list[KnowledgeChunk]:
    """Parse a markdown manual into structured semantic KnowledgeChunks."""
    content = file_path.read_text(encoding="utf-8")
    chunks: list[KnowledgeChunk] = []

    # Split by markdown headers (#, ##, ###)
    sections = re.split(r"\n(?=#{1,3}\s+)", content)

    for idx, section in enumerate(sections):
        lines = section.strip().splitlines()
        if not lines:
            continue

        # Extract title from header line
        header_line = lines[0].strip()
        title = re.sub(r"^#{1,3}\s+", "", header_line).strip()
        body = "\n".join(lines[1:]).strip() if len(lines) > 1 else header_line

        # Infer component if mentioned in title or section
        component_name = None
        comp_match = re.search(
            r"(?:component|part|panel|switch|switcher|button|key|sensor|motor|prong|clasp|chain|dial|setting):\s*([^\n,]+)",
            section,
            re.IGNORECASE,
        )
        if comp_match:
            component_name = comp_match.group(1).strip()
        elif any(term in title.lower() for term in ["switcher", "control panel", "button", "prong", "slider", "dongle", "led", "display"]):
            component_name = title

        # Extract options or button states (e.g. 'Options: Up, Down, 1, 2, 3, M, T' or 'BT1, BT2, 2.4G')
        possible_states: list[str] = []
        states_match = re.search(
            r"(?:options|states|modes|controls|buttons|channels|inputs):\s*([^\n]+)",
            section,
            re.IGNORECASE,
        )
        if states_match:
            possible_states = [s.strip() for s in re.split(r"[,;|]", states_match.group(1)) if s.strip()]

        # Extract numbered instructions / steps
        instruction_steps: list[str] = []
        for line in lines:
            step_match = re.match(r"^(?:\d+\.|\-|\*|Step\s+\d+:?)\s+(.+)$", line.strip(), re.IGNORECASE)
            if step_match:
                instruction_steps.append(step_match.group(1).strip())

        # Determine step number
        step_num = None
        num_match = re.search(r"Step\s+(\d+)", title, re.IGNORECASE)
        if num_match:
            step_num = int(num_match.group(1))

        chunk_id = f"{product_id}_{file_path.stem}_{idx}_{uuid.uuid4().hex[:4]}"
        chunks.append(
            KnowledgeChunk(
                id=chunk_id,
                product_id=product_id,
                product_name=product_name,
                category=category,
                component_name=component_name,
                content_type="procedure" if instruction_steps else "spec",
                title=title,
                text_content=body,
                step_number=step_num,
                possible_states_or_options=possible_states,
                instructions=instruction_steps,
                metadata={"source_file": str(file_path.name)},
            )
        )

    return chunks


def process_image_file(
    file_path: Path, product_id: str, product_name: str, category: str
) -> KnowledgeChunk:
    """Create a multimodal image KnowledgeChunk from an image file."""
    stem = file_path.stem.replace("_", " ").replace("-", " ").title()
    chunk_id = f"{product_id}_img_{file_path.stem}_{uuid.uuid4().hex[:4]}"

    return KnowledgeChunk(
        id=chunk_id,
        product_id=product_id,
        product_name=product_name,
        category=category,
        component_name=stem,
        content_type="image",
        title=f"{product_name} - {stem} (Visual Reference)",
        text_content=f"Visual reference image for {product_name} showing component {stem}.",
        image_path=str(file_path.resolve()),
        possible_states_or_options=[],
        instructions=[],
        metadata={"source_file": file_path.name, "is_image": True},
    )


def ingest_directory(
    dir_path: Path,
    product_id: str,
    product_name: str,
    category: str,
) -> list[KnowledgeChunk]:
    """Scan directory recursively and extract text & image chunks."""
    all_chunks: list[KnowledgeChunk] = []

    text_files = [p for p in dir_path.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED_TEXT_EXTS]
    image_files = [p for p in dir_path.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED_IMG_EXTS]

    # Process text files
    for tf in text_files:
        chunks = parse_markdown_chunks(tf, product_id, product_name, category)
        all_chunks.extend(chunks)

    # Process image files
    for imf in image_files:
        img_chunk = process_image_file(imf, product_id, product_name, category)
        all_chunks.append(img_chunk)

    return all_chunks


def run_ingestion_pipeline(
    dir_str: str,
    product_name: str,
    product_id: str,
    category: str,
) -> None:
    """Execute the end-to-end chunking and embedding ingestion pipeline."""
    target_dir = Path(dir_str).resolve()
    if not target_dir.exists() or not target_dir.is_dir():
        console.print(f"[bold red]Error:[/bold red] Target directory '{target_dir}' does not exist.")
        return

    console.print(
        Panel.fit(
            f"[bold cyan]Scanning Directory:[/bold cyan] {target_dir}\n"
            f"[bold green]Product:[/bold green] {product_name} ([yellow]{product_id}[/yellow])\n"
            f"[bold magenta]Category:[/bold magenta] {category}",
            title="Ingestion Job Started",
            border_style="cyan",
        )
    )

    chunks = ingest_directory(target_dir, product_id, product_name, category)
    if not chunks:
        console.print("[yellow]No supported text (.md, .txt) or image files found in directory.[/yellow]")
        return

    console.print(f"[bold green]✓[/bold green] Extracted [bold]{len(chunks)}[/bold] knowledge chunks and components.")

    # Embed and save with progress bar
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("[cyan]Generating multimodal embeddings & storing...", total=len(chunks))

        for chunk in chunks:
            vector_store.ingest_chunk(chunk)
            progress.advance(task)

    console.print("\n[bold green]✓ Ingestion Completed Successfully![/bold green]\n")

    # Display summary table
    table = Table(title=f"Ingested Knowledge Chunks ({product_name})", border_style="dim")
    table.add_column("ID", style="cyan", no_wrap=True)
    table.add_column("Type", style="magenta")
    table.add_column("Component", style="yellow")
    table.add_column("Title / Step", style="bold white")
    table.add_column("Controls / Options", style="green")
    table.add_column("Instructions", justify="right")

    for c in chunks[:12]:
        table.add_row(
            c.id,
            c.content_type,
            c.component_name or "General",
            c.title[:35],
            ", ".join(c.possible_states_or_options[:3]) or "None",
            str(len(c.instructions)),
        )

    if len(chunks) > 12:
        table.add_row("...", "...", "...", f"+ {len(chunks) - 12} more chunks", "...", "...")

    console.print(table)


def main() -> None:
    """CLI Entrypoint with interactive prompt and argument parser support."""
    parser = argparse.ArgumentParser(
        description="Diamond CX Multimodal Knowledge Base Ingestion CLI"
    )
    parser.add_argument("--dir", "-d", type=str, help="Path to directory containing manuals and images")
    parser.add_argument("--name", "-n", type=str, help="Product Name")
    parser.add_argument("--id", "-i", type=str, help="Product SKU / ID")
    parser.add_argument("--category", "-c", type=str, help="Product Category")
    parser.add_argument("--all-samples", action="store_true", help="Ingest all built-in sample products")
    parser.add_argument("--clear", action="store_true", help="Clear all existing chunks in the collection before ingestion")
    parser.add_argument("--clear-only", action="store_true", help="Clear all existing chunks in the collection and exit")
    parser.add_argument("--clear-product", type=str, help="Clear all chunks for a specific Product ID or Product Name and exit")

    args = parser.parse_args()

    console.print(
        Panel(
            "[bold white]💎 Diamond CX Multimodal Knowledge Base Ingestion CLI[/bold white]\n"
            "[dim]Chunking, Gemini Embedding 2 Multimodal Vectors & Vertex AI Search Setup[/dim]",
            border_style="bright_blue",
        )
    )

    if args.clear_product:
        console.print(f"[yellow]Clearing product '[bold]{args.clear_product}[/bold]' from Vertex AI Vector Search collection...[/yellow]")
        deleted = vector_store.delete_product(args.clear_product)
        console.print(f"[bold green]✓[/bold green] Deleted [bold]{deleted}[/bold] chunks for product '[bold]{args.clear_product}[/bold]'.\n")
        return

    if args.clear or args.clear_only:
        console.print("[yellow]Clearing existing data from Vertex AI Vector Search collection...[/yellow]")
        deleted = vector_store.clear_collection()
        console.print(f"[bold green]✓[/bold green] Cleared [bold]{deleted}[/bold] data objects from collection.\n")
        if args.clear_only:
            return

    if args.all_samples:
        samples_dir = Path(__file__).resolve().parent.parent / "data" / "sample_products"
        if not samples_dir.exists():
            console.print(f"[red]Sample directory {samples_dir} not found.[/red]")
            return

        for p_dir in samples_dir.iterdir():
            if p_dir.is_dir():
                p_name = p_dir.name.replace("_", " ").title()
                p_id = f"PROD-{p_dir.name[:3].upper()}-001"
                run_ingestion_pipeline(str(p_dir), p_name, p_id, "Demonstration Hardware")
        return

    # Check for CLI flags or prompt interactively
    p_name = args.name or Prompt.ask("[bold cyan]Enter Product Name[/bold cyan]", default="Tri-Mode Wireless Bluetooth Keyboard")
    p_id = args.id or Prompt.ask("[bold cyan]Enter Product ID / SKU[/bold cyan]", default="PROD-KB-8821")
    p_cat = args.category or Prompt.ask("[bold cyan]Enter Category[/bold cyan]", default="Electronics & Hardware")
    dir_path = args.dir or Prompt.ask("[bold cyan]Enter Path to Manuals/Images Directory[/bold cyan]", default="data/sample_products/bluetooth_keyboard")

    run_ingestion_pipeline(dir_path, p_name, p_id, p_cat)


if __name__ == "__main__":
    main()
