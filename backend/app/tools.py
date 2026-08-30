"""Throwaway mock tools for order lookup and product queries.

Can be deleted cleanly by removing this file and the tools list in app/agent.py.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

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
    """Find and spot order details, serial numbers, delivery status, payment info, and warranty.

    Args:
        search_query: An order ID (e.g. 'ORD-2026-1001'), a serial number
          (e.g. 'SN-SOL-8821-PT', 'SN-DESK-9842-ED3'), a customer name (e.g. 'Aswath'),
          a product name (e.g. 'height adjustable desk', 'standing desk'), or
          'all' to list recent orders.

    Returns:
        A dictionary containing matched order records or all recent orders.
    """
    from app.firestore_service import firestore_service

    query = search_query.strip().lower()

    # Load live Firestore orders combined with mock orders
    firestore_orders = firestore_service.list_orders()
    all_combined_orders = list(firestore_orders) + [
        o for o in MOCK_ORDERS if not any(fo.get("order_id") == o["order_id"] for fo in firestore_orders)
    ]

    if not query or query in ("all", "list", "recent"):
        return {
            "total_orders": len(all_combined_orders),
            "orders": all_combined_orders,
        }

    query_tokens = [w for w in query.replace("-", " ").replace(",", " ").split() if len(w) > 2]

    matched = []
    for order in all_combined_orders:
        order_str = (
            f"{order.get('order_id', '')} {order.get('serial_number', '')} "
            f"{order.get('customer_name', '')} {order.get('product_name', '')} "
            f"{order.get('payment_id', '')}"
        ).lower()
        # Direct substring match
        if query in order_str:
            matched.append(order)
            continue
        # Keyword token overlap match (e.g., 'standing desk' or 'adjustable desk')
        if any(token in order_str for token in query_tokens):
            matched.append(order)

    if not matched:
        return {
            "found": False,
            "message": f"No orders or serial numbers matching '{search_query}'.",
            "available_orders_summary": [
                f"{o.get('order_id')} - {o.get('product_name')} ({o.get('customer_name')})"
                for o in all_combined_orders[:6]
            ],
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


def search_product_knowledge_base(
    query: str,
    product_name: str = "",
    component_name: str = "",
) -> dict[str, Any]:
    """Search product technical manuals, user guides, component controls, and step-by-step troubleshooting instructions.

    Args:
        query: Problem description, question, or error symptom (e.g. 'how to pair bluetooth 2.4g', 'desk control panel shows RST', 'ring prong loose').
        product_name: Optional product name or SKU filter (e.g. 'keyboard', 'height adjustable desk', 'solitaire diamond ring').
        component_name: Optional specific component filter (e.g. 'bluetooth switcher', 'control panel', 'motor', 'prong').

    Returns:
        A dictionary containing matched knowledge chunks, component options, and step-by-step instructions.
    """
    from app.vector_search import vector_store

    results = vector_store.search(
        query_text=query,
        product_filter=product_name or None,
        component_filter=component_name or None,
        top_k=4,
    )

    if not results:
        return {
            "found": False,
            "message": f"No specific technical documentation or troubleshooting guide found for query: '{query}'.",
            "available_products": vector_store.list_products(),
        }

    formatted_matches = []
    for r in results:
        c = r.chunk
        formatted_matches.append(
            {
                "product_name": c.product_name,
                "category": c.category,
                "component": c.component_name or "General",
                "title": c.title,
                "content": c.text_content,
                "controls_or_options": c.possible_states_or_options,
                "actionable_steps": c.instructions,
                "similarity_score": r.similarity_score,
                "image_path": c.image_path,
            }
        )

    return {
        "found": True,
        "matched_count": len(formatted_matches),
        "results": formatted_matches,
    }


def lookup_component_instructions(
    product_name: str,
    component_name: str,
) -> dict[str, Any]:
    """Retrieve detailed state options, button controls, and sequential operation steps for a specific product component.

    Args:
        product_name: Name of the product (e.g. 'keyboard', 'height adjustable desk', 'solitaire diamond ring').
        component_name: Component name (e.g. 'bluetooth switcher', 'control panel', 'memory buttons', 'prongs').

    Returns:
        Component options, indicator behaviors, and sequential instructions.
    """
    from app.vector_search import vector_store

    chunks = vector_store.get_component_details(product_name=product_name, component_name=component_name)

    if not chunks:
        # Fallback to general search
        return search_product_knowledge_base(
            query=f"{product_name} {component_name}",
            product_name=product_name,
            component_name=component_name,
        )

    all_options: list[str] = []
    all_instructions: list[str] = []
    for chunk in chunks:
        all_options.extend(chunk.possible_states_or_options)
        all_instructions.extend(chunk.instructions)

    return {
        "found": True,
        "product_name": product_name,
        "component_name": component_name,
        "controls_and_options": list(dict.fromkeys(all_options)),
        "step_by_step_guide": list(dict.fromkeys(all_instructions)),
        "chunks": [c.model_dump(exclude={"embedding"}) for c in chunks],
    }


# Simulated Technician Dispatch Database
DISPATCH_TICKETS: list[dict[str, Any]] = []


def escalate_to_human_technician(
    product_name: str,
    issue_summary: str,
    attempted_steps: str = "",
) -> dict[str, Any]:
    """Create a priority technician escalation ticket when self-help troubleshooting cannot resolve the product issue.

    Args:
        product_name: The name or model of the affected product.
        issue_summary: Brief description of the unresolved problem or physical defect.
        attempted_steps: Summary of troubleshooting steps already tried by the customer.

    Returns:
        The generated ticket ID, dispatch details, and confirmation message.
    """
    import uuid
    ticket_id = f"TECH-DISPATCH-{uuid.uuid4().hex[:6].upper()}"
    ticket = {
        "ticket_id": ticket_id,
        "product_name": product_name,
        "issue_summary": issue_summary,
        "attempted_steps": attempted_steps,
        "status": "Dispatch Scheduled",
        "technician": "Certified Diamond CX Hardware Specialist",
        "estimated_contact_window": "Within 2 business hours",
    }
    DISPATCH_TICKETS.append(ticket)
    logger.info("Created technician escalation ticket: %s for %s", ticket_id, product_name)

    return {
        "success": True,
        "ticket_id": ticket_id,
        "status": "Escalated to Field Technician",
        "message": (
            f"Escalation ticket {ticket_id} has been registered. "
            "A certified hardware technician has been assigned and will contact you directly to schedule an inspection or replacement."
        ),
    }


def issue_order_refund_or_replacement(
    order_id: str,
    reason: str,
    action: str = "refund",
    notes: str = "",
) -> dict[str, Any]:
    """Spot a persistent hardware failure, defect, or customer request and process a refund or replacement for an order.

    Args:
        order_id: The customer's order ID (e.g. 'ORD-2026-DESK-01', 'ORD-2026-1001', or order identifier).
        reason: Justification for refund/replacement (e.g. 'Motor burned out and unrecoverable', 'E01 thermal shutdown permanent failure', 'Defective control panel', 'Customer requested warranty return').
        action: Either 'refund' (reverses payment to customer card) or 'replacement' (ships new unit).
        notes: Optional diagnostic details, attempted fixes, or customer remarks.

    Returns:
        Structured confirmation with refund reference ID, amount credited, payment ID, and pickup instructions.
    """
    from app.firestore_service import firestore_service

    logger.info("Executing issue_order_refund_or_replacement for %s: action=%s, reason=%s", order_id, action, reason)

    # 1. First check Firestore orders
    order = firestore_service.get_order(order_id)
    if order:
        return firestore_service.process_refund(
            order_id=order["order_id"],
            reason=reason,
            action=action,
            notes=notes,
        )

    # 2. Check mock orders fallback
    clean_id = order_id.strip().lower()
    matched_mock = None
    for mo in MOCK_ORDERS:
        if clean_id in mo["order_id"].lower() or mo["order_id"].lower() in clean_id:
            matched_mock = mo
            break

    import uuid
    ref_id = f"REF-2026-{uuid.uuid4().hex[:6].upper()}"
    amt_str = matched_mock.get("price", "$499.00") if matched_mock else "$499.00"
    p_name = matched_mock.get("product_name", "JIN OFFICE Electric Sit-Stand Desk") if matched_mock else "Product"

    status_str = "Refund Settled & Credited" if action == "refund" else "Replacement Dispatched"

    return {
        "success": True,
        "refund_id": ref_id,
        "order_id": order_id,
        "product_name": p_name,
        "refund_amount": amt_str,
        "original_payment_id": "PAY-TEST-MOCK-CARD",
        "status": status_str,
        "action": action,
        "message": (
            f"Full refund of {amt_str} has been authorized and credited to your original payment method. "
            f"Refund Reference ID: {ref_id}. A return shipping label has been dispatched to your email."
        ),
    }

