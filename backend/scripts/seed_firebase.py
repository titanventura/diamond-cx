"""Seed script for Diamond CX Firestore & Knowledge Store.

Seeds the Height Adjustable Desk use case into:
1. Firestore Database (products & initial demo user)
2. Multimodal Knowledge Base (manuals & images)
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from rich import print as rprint
from rich.panel import Panel

from app.firestore_service import firestore_service
from scripts.ingest_knowledge import run_ingestion_pipeline


def main() -> None:
    rprint(
        Panel.fit(
            "[bold white]💎 Diamond CX: Firebase & Firestore Seeding[/bold white]\n"
            "[dim]Flagship Product: JIN OFFICE Electric Sit-Stand Desk (Model JHT8-ED3)[/dim]",
            border_style="cyan",
        )
    )

    # 1. Verify Firestore Seed
    products = firestore_service.list_products()
    rprint(f"[bold green]✓[/bold green] Firestore seeded with [bold]{len(products)}[/bold] product(s):")
    for p in products:
        rprint(f"   • [cyan]{p['id']}[/cyan] - {p['name']} ([green]${p['price']:,.2f}[/green])")

    # 2. Ingest Desk Manual and Visual Assets into Knowledge Base
    desk_dir = backend_dir / "data" / "sample_products" / "height_adjustable_desk"
    if desk_dir.exists():
        rprint(f"\n[cyan]Ingesting knowledge documentation from:[/cyan] {desk_dir}")
        run_ingestion_pipeline(
            dir_str=str(desk_dir),
            product_name="JIN OFFICE Electric Sit-Stand Desk (Model JHT8-ED3)",
            product_id="PROD-DESK-JHT8",
            category="Ergonomic Furniture",
        )
    else:
        rprint(f"[bold red]Error:[/bold red] Desk data directory '{desk_dir}' not found.")

    rprint("\n[bold green]✓ Seeding Complete![/bold green] Ready for end-to-end storefront & live support testing.\n")


if __name__ == "__main__":
    main()
