"""Throwaway mock tools for order lookup and product queries.

Can be deleted cleanly by removing this file and the tools list in app/agent.py.
"""

from typing import Any

# Fake Orders Database across various dates
MOCK_ORDERS: list[dict[str, Any]] = [
    {
        "order_id": "ORD-2026-1002",
        "order_date": "2026-01-16",
        "customer_name": "Aswath S",
        "product_name": "A keyboard and mouse",
        "serial_number": "SN-KBM-8821-PT",
        "price": "$14,200",
        "status": "Delivered",
        "delivery_date": "2026-01-19",
        "warranty_status": "Active (Expires 2028-01-15)",
    },
    {
        "order_id": "ORD-2026-1001",
        "order_date": "2026-01-15",
        "customer_name": "Aswath S",
        "product_name": "Solitaire Diamond Ring 1.5ct Platinum",
        "serial_number": "SN-SOL-8821-PT",
        "price": "$4,200",
        "status": "Delivered",
        "delivery_date": "2026-01-19",
        "warranty_status": "Active (Expires 2028-01-15)",
    },
    {
        "order_id": "ORD-2026-1044",
        "order_date": "2026-02-02",
        "customer_name": "Sarah Connor",
        "product_name": "Emerald Cut Diamond Necklace 18k White Gold",
        "serial_number": "SN-NCK-4419-WG",
        "price": "$2,850",
        "status": "Delivered",
        "delivery_date": "2026-02-06",
        "warranty_status": "Active (Expires 2028-02-02)",
    },
    {
        "order_id": "ORD-2026-1108",
        "order_date": "2026-02-18",
        "customer_name": "Bruce Wayne",
        "product_name": "Infinity Diamond Pave Band 18k Yellow Gold",
        "serial_number": "SN-BND-9032-YG",
        "price": "$1,650",
        "status": "In Transit",
        "delivery_date": "Estimated 2026-02-25",
        "warranty_status": "Pending Delivery",
    },
    {
        "order_id": "ORD-2026-1192",
        "order_date": "2026-02-21",
        "customer_name": "Diana Prince",
        "product_name": "Classic Princess Cut Diamond Stud Earrings 2.0ct",
        "serial_number": "SN-EAR-5510-PT",
        "price": "$3,900",
        "status": "Processing",
        "delivery_date": "Estimated 2026-02-28",
        "warranty_status": "Pending Delivery",
    },
]

# Fake Product Knowledge Base
MOCK_PRODUCT_FAQ: dict[str, dict[str, str]] = {
    "solitaire diamond ring": {
        "care": "Clean with warm soapy water and a soft-bristle brush every 2 weeks. Avoid chlorine and harsh chemicals.",
        "certification": "Includes GIA Certificate verifying 1.5ct, VVS1 Clarity, Color D, Excellent Cut.",
        "resizing": "Free complimentary resizing available within 60 days of purchase (up to +/- 2 sizes).",
        "warranty": "2-year comprehensive warranty covering prong tightening, rhodium replating, and ultrasonic cleaning.",
    },
    "emerald cut diamond necklace": {
        "care": "Store flat in the provided velvet jewelry box to avoid chain tangling. Wipe with microfibre cloth after wear.",
        "certification": "Includes IGI Certificate with laser inscription on diamond girdle.",
        "warranty": "2-year clasp and chain warranty with annual check-up included.",
    },
    "infinity diamond pave band": {
        "care": "Avoid wearing during heavy workouts or lifting. Inspect micro-prongs annually.",
        "resizing": "Pave bands cannot be resized more than 0.5 size due to stone setting integrity.",
        "warranty": "2-year accent stone replacement guarantee if stone is lost under normal wear.",
    },
    "classic princess cut diamond stud earrings": {
        "care": "Check screw-backs monthly for tightness. Clean with specialized diamond dip solution.",
        "certification": "Double GIA Certificates for matched pair brilliance and symmetry.",
        "warranty": "Lifetime backing replacement and 2-year prong inspection warranty.",
    },
}


def lookup_order_or_serial(search_query: str) -> dict[str, Any]:
    """Find and spot order details, serial numbers, delivery status, and warranty.

    Args:
        search_query: An order ID (e.g. 'ORD-2026-1001'), a serial number
          (e.g. 'SN-SOL-8821-PT'), a customer name (e.g. 'Aswath'), or
          'all' to list recent orders.

    Returns:
        A dictionary containing matched order records or all recent orders.
    """
    query = search_query.strip().lower()

    if not query or query in ("all", "list", "recent"):
        return {
            "total_orders": len(MOCK_ORDERS),
            "orders": MOCK_ORDERS,
        }

    query_tokens = [w for w in query.replace("-", " ").replace(",", " ").split() if len(w) > 2]

    matched = []
    for order in MOCK_ORDERS:
        order_str = (
            f"{order['order_id']} {order['serial_number']} "
            f"{order['customer_name']} {order['product_name']}"
        ).lower()
        # Direct substring match
        if query in order_str:
            matched.append(order)
            continue
        # Keyword token overlap match (e.g., 'keyboard mouse combo' matching 'A keyboard and mouse')
        if any(token in order_str for token in query_tokens):
            matched.append(order)

    if not matched:
        return {
            "found": False,
            "message": f"No orders or serial numbers matching '{search_query}'.",
            "available_orders_summary": [f"{o['order_id']} - {o['product_name']}" for o in MOCK_ORDERS],
        }

    return {
        "found": True,
        "matched_count": len(matched),
        "results": matched,
    }


def query_product_knowledge(product_name: str, question_topic: str = "general") -> dict[str, Any]:
    """Retrieve product specifications, care instructions, diamond certifications (GIA/IGI), resizing policies, and warranty details.

    Args:
        product_name: Name or type of jewelry product (e.g., 'solitaire ring',
          'necklace', 'earrings', 'pave band').
        question_topic: Topic of inquiry such as 'care', 'certification',
          'resizing', 'warranty', or 'all'.

    Returns:
        A dictionary with product answers and guidelines.
    """
    prod_key = product_name.strip().lower()
    topic = question_topic.strip().lower()

    # Match product
    matched_entry = None
    for name, data in MOCK_PRODUCT_FAQ.items():
        if prod_key in name or name in prod_key:
            matched_entry = (name, data)
            break

    if not matched_entry:
        return {
            "found": False,
            "message": f"No specific information found for '{product_name}'.",
            "supported_products": list(MOCK_PRODUCT_FAQ.keys()),
            "general_care_advice": "For all diamond jewelry, use warm soapy water, avoid chlorine, and store pieces separately.",
        }

    matched_name, data = matched_entry
    if topic in data:
        return {
            "product": matched_name.title(),
            "topic": topic,
            "information": data[topic],
        }

    return {
        "product": matched_name.title(),
        "all_topics": data,
    }
