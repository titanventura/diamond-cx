"""Firestore Data Access Layer for Diamond CX Storefront and Orders Hub.

Provides document and collection operations for products, orders, users, and support tickets.
Operates with local persistent JSON storage for complete isolation from work accounts,
with Firestore-compatible data structures.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.models import OrderRecord, StoreProduct

logger = logging.getLogger("diamond_cx.firestore")

# Default Flagship Product Seed: Height Adjustable Desk
DEFAULT_DESK_PRODUCT = {
    "id": "PROD-DESK-JHT8",
    "name": "JIN OFFICE Electric Sit-Stand Desk (Model JHT8-ED3)",
    "tagline": "Dual-Motor Ergonomic Workstation with Intelligent Memory & Anti-Collision Gyros",
    "category": "Ergonomic Furniture",
    "price": 499.00,
    "currency": "USD",
    "rating": 4.9,
    "review_count": 128,
    "in_stock": True,
    "warranty_years": 2,
    "description": (
        "Engineered for luxury executive ergonomics, the JIN OFFICE JHT8-ED3 features an ultra-quiet dual-motor "
        "lifting system, 3-stage telescoping steel columns, an intuitive 7-button digital LED memory touch panel, "
        "and intelligent multi-axis anti-collision safety sensors. Supports seamless transitions between seated and "
        "standing postures with 0.5-hour interval reminders."
    ),
    "features": [
        "Dual Synchronized High-Torque Motors (<45dB Whisper-Quiet)",
        "7-Button LED Memory Panel (Up, Down, 1, 2, 3, M [Memory], T [Timer])",
        "Multi-Axis Anti-Collision Sensitivity Control (S-1 to S-5 settings)",
        "System Diagnostic Reset Mode ('rST' auto-calibration)",
        "Heavy-Duty 3-Stage Telescopic Legs (120kg / 265lbs capacity)",
        "Integrated High-Speed USB Charging Port",
        "Elevation Range: 600mm to 1250mm (23.6\" to 49.2\")",
        "2-Year Comprehensive Manufacturer Hardware Warranty",
    ],
    "specs": {
        "Model Number": "JHT8-ED3",
        "Lifting Speed": "25 mm/s",
        "Load Capacity": "120 kg (265 lbs)",
        "Height Range": "60 cm - 125 cm",
        "Input Voltage": "100V - 240V AC 50/60Hz",
        "Display Format": "7-Segment LED (CM / Inch selectable)",
        "Error Codes": "rST (Reset), E01/HOT (18min thermal rest), E02 (Reset needed), E04 (Re-plug cable)",
        "Certifications": "BIFMA, CE, UL Listed, FCC",
    },
    "images": [
        "/static/sample_products/height_adjustable_desk/WhatsApp Image 2026-08-23 at 11.01.34.jpeg",
        "/static/sample_products/height_adjustable_desk/WhatsApp Image 2026-08-23 at 11.01.34 (1).jpeg",
        "/static/sample_products/height_adjustable_desk/WhatsApp Image 2026-08-23 at 11.01.34 (2).jpeg",
        "/static/sample_products/height_adjustable_desk/WhatsApp Image 2026-08-23 at 11.01.35.jpeg",
        "/static/sample_products/height_adjustable_desk/WhatsApp Image 2026-08-23 at 11.01.35 (1).jpeg",
    ],
}


class FirestoreService:
    """Thread-safe Firestore engine with persistent local storage."""

    def __init__(self, db_path: str | None = None) -> None:
        settings = get_settings()
        target_path = db_path or settings.FIRESTORE_STORE_PATH
        
        # Resolve relative to backend directory if not absolute
        if not Path(target_path).is_absolute():
            backend_dir = Path(__file__).resolve().parent.parent
            self.file_path = backend_dir / target_path
        else:
            self.file_path = Path(target_path)

        self._lock = threading.Lock()
        self._ensure_db()

    def _ensure_db(self) -> None:
        """Create storage file and collections if not existing, seeding default data."""
        with self._lock:
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            if not self.file_path.exists() or self.file_path.stat().st_size == 0:
                initial_data = {
                    "products": {
                        DEFAULT_DESK_PRODUCT["id"]: DEFAULT_DESK_PRODUCT
                    },
                    "orders": {},
                    "users": {
                        "user-demo-01": {
                            "user_id": "user-demo-01",
                            "name": "Aswath S",
                            "email": "aswath@diamondcx.com",
                            "created_at": datetime.now(UTC).isoformat(),
                        }
                    },
                    "tickets": {},
                }
                self.file_path.write_text(json.dumps(initial_data, indent=2), encoding="utf-8")
                logger.info("Initialized local Firestore store with default collections at %s", self.file_path)
            else:
                # Validate seeded desk product exists
                try:
                    data = json.loads(self.file_path.read_text(encoding="utf-8"))
                    if "products" not in data or DEFAULT_DESK_PRODUCT["id"] not in data["products"]:
                        data.setdefault("products", {})[DEFAULT_DESK_PRODUCT["id"]] = DEFAULT_DESK_PRODUCT
                        self.file_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
                except Exception as exc:
                    logger.warning("Error reading Firestore file, resetting: %s", exc)

    def _read_data(self) -> dict[str, Any]:
        """Read all collections from storage."""
        try:
            return json.loads(self.file_path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.error("Failed reading Firestore storage: %s", exc)
            return {"products": {}, "orders": {}, "users": {}, "tickets": {}}

    def _write_data(self, data: dict[str, Any]) -> None:
        """Write all collections atomically to storage."""
        tmp_path = self.file_path.with_suffix(".tmp")
        tmp_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        tmp_path.replace(self.file_path)

    # -------------------------------------------------------------
    # Products Collection
    # -------------------------------------------------------------
    def list_products(self) -> list[dict[str, Any]]:
        """Retrieve all active storefront products."""
        with self._lock:
            data = self._read_data()
            return list(data.get("products", {}).values())

    def get_product(self, product_id: str) -> dict[str, Any] | None:
        """Retrieve a specific product by its ID."""
        with self._lock:
            data = self._read_data()
            return data.get("products", {}).get(product_id)

    def set_product(self, product: dict[str, Any]) -> dict[str, Any]:
        """Upsert a product in the catalog."""
        with self._lock:
            data = self._read_data()
            data.setdefault("products", {})[product["id"]] = product
            self._write_data(data)
            return product

    # -------------------------------------------------------------
    # Orders Collection
    # -------------------------------------------------------------
    def create_order(
        self,
        user_id: str,
        customer_name: str,
        customer_email: str,
        product_id: str,
        amount_paid: float,
        shipping_address: str,
        payment_method: str = "card_test_sandbox",
        test_card_number: str = "•••• 4242",
    ) -> dict[str, Any]:
        """Process test payment and persist a new customer order."""
        with self._lock:
            data = self._read_data()
            product = data.get("products", {}).get(product_id)
            product_name = product["name"] if product else "JIN OFFICE Electric Sit-Stand Desk"

            order_uid = uuid.uuid4().hex[:6].upper()
            order_id = f"ORD-2026-{order_uid}"
            serial_number = f"SN-DESK-{order_uid[:4]}-ED3"
            payment_id = f"PAY-TEST-{uuid.uuid4().hex[:8].upper()}"

            now = datetime.now(UTC)
            order_date_str = now.strftime("%Y-%m-%d")
            warranty_expires_str = f"{now.year + 2}-{now.strftime('%m-%d')}"

            # Primary image
            image_url = None
            if product and product.get("images"):
                image_url = product["images"][0]

            order_record = {
                "order_id": order_id,
                "user_id": user_id,
                "customer_name": customer_name,
                "customer_email": customer_email,
                "product_id": product_id,
                "product_name": product_name,
                "serial_number": serial_number,
                "price": f"${amount_paid:,.2f}",
                "amount_paid": amount_paid,
                "currency": "USD",
                "status": "Delivered",
                "order_date": order_date_str,
                "delivery_date": order_date_str,
                "warranty_status": f"Active (Expires {warranty_expires_str})",
                "payment_id": payment_id,
                "payment_method": f"Credit Card ({test_card_number})",
                "payment_status": "captured",
                "shipping_address": shipping_address,
                "refund_status": None,
                "refund_id": None,
                "refund_amount": None,
                "refund_date": None,
                "refund_reason": None,
                "image_url": image_url,
                "created_at": now.isoformat(),
            }

            data.setdefault("orders", {})[order_id] = order_record

            # Ensure user exists
            data.setdefault("users", {}).setdefault(
                user_id,
                {
                    "user_id": user_id,
                    "name": customer_name,
                    "email": customer_email,
                    "created_at": now.isoformat(),
                },
            )

            self._write_data(data)
            logger.info("Created new order in Firestore: %s for %s ($%.2f)", order_id, customer_name, amount_paid)
            return order_record

    def get_order(self, order_id: str) -> dict[str, Any] | None:
        """Find order by ID (case-insensitive)."""
        with self._lock:
            data = self._read_data()
            orders = data.get("orders", {})
            if order_id in orders:
                return orders[order_id]
            for oid, o in orders.items():
                if oid.lower() == order_id.lower():
                    return o
            return None

    def list_orders(self, user_id: str | None = None) -> list[dict[str, Any]]:
        """List orders, optionally filtered by user ID."""
        with self._lock:
            data = self._read_data()
            orders = list(data.get("orders", {}).values())
            if user_id:
                orders = [o for o in orders if o.get("user_id") == user_id]
            # Sort newest first
            orders.sort(key=lambda o: o.get("created_at", ""), reverse=True)
            return orders

    def update_order(self, order_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        """Update fields on an existing order."""
        with self._lock:
            data = self._read_data()
            matched_id = None
            orders = data.get("orders", {})
            for oid in orders:
                if oid.lower() == order_id.lower():
                    matched_id = oid
                    break

            if not matched_id:
                return None

            orders[matched_id].update(updates)
            self._write_data(data)
            return orders[matched_id]

    def process_refund(
        self,
        order_id: str,
        reason: str,
        action: str = "refund",
        notes: str = "",
    ) -> dict[str, Any]:
        """Execute a refund or replacement action on a paid order."""
        order = self.get_order(order_id)
        if not order:
            return {
                "success": False,
                "message": f"Order '{order_id}' was not found in Firestore.",
            }

        now_str = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
        refund_id = f"REF-2026-{uuid.uuid4().hex[:6].upper()}"
        refund_amt_str = order.get("price", f"${order.get('amount_paid', 499.0):,.2f}")

        status_text = "Refund Settled & Credited" if action == "refund" else "Replacement Dispatched"

        updates = {
            "refund_status": status_text,
            "refund_id": refund_id,
            "refund_amount": refund_amt_str,
            "refund_date": now_str,
            "refund_reason": reason,
            "refund_notes": notes,
        }

        updated = self.update_order(order["order_id"], updates)

        logger.info("Processed %s for %s: %s (%s)", action, order_id, refund_id, refund_amt_str)

        return {
            "success": True,
            "refund_id": refund_id,
            "order_id": order["order_id"],
            "product_name": order["product_name"],
            "refund_amount": refund_amt_str,
            "original_payment_id": order.get("payment_id", "N/A"),
            "status": status_text,
            "action": action,
            "message": (
                f"Full refund of {refund_amt_str} has been successfully credited to original payment "
                f"({order.get('payment_method', 'Card')}). Reference ID: {refund_id}. "
                "A prepaid return shipping box has been scheduled for pickup."
            ),
        }

    # -------------------------------------------------------------
    # Support Tickets Collection
    # -------------------------------------------------------------
    def create_ticket(
        self,
        order_id: str,
        user_id: str,
        subject: str,
        description: str,
        priority: str = "high",
    ) -> dict[str, Any]:
        """Create a support ticket linked to an order."""
        with self._lock:
            data = self._read_data()
            ticket_id = f"TCK-2026-{uuid.uuid4().hex[:6].upper()}"
            now_str = datetime.now(UTC).isoformat()
            ticket = {
                "ticket_id": ticket_id,
                "order_id": order_id,
                "user_id": user_id,
                "subject": subject,
                "description": description,
                "priority": priority,
                "status": "Open - Assigned to Specialist",
                "created_at": now_str,
            }
            data.setdefault("tickets", {})[ticket_id] = ticket
            self._write_data(data)
            return ticket

    def list_tickets(self, user_id: str | None = None) -> list[dict[str, Any]]:
        """List tickets, optionally filtered by user ID."""
        with self._lock:
            data = self._read_data()
            tickets = list(data.get("tickets", {}).values())
            if user_id:
                tickets = [t for t in tickets if t.get("user_id") == user_id]
            return tickets


# Global singleton instance
firestore_service = FirestoreService()
