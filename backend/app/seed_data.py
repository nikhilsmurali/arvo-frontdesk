from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Agent, Ticket, TicketMessage, TicketEvent
from app.sla_engine import calculate_initial_sla_targets, snap_to_next_working_time

ARVO_AGENTS = [
    {"name": "Meera", "email": "meera@arvo.com", "role": "Support Lead"},
    {"name": "Arjun", "email": "arjun@arvo.com", "role": "Senior Support Agent"},
    {"name": "Priya", "email": "priya@arvo.com", "role": "Support Agent"},
    {"name": "Rahul", "email": "rahul@arvo.com", "role": "Support Agent"},
    {"name": "Ananya", "email": "ananya@arvo.com", "role": "Support Agent"},
    {"name": "Vikram", "email": "vikram@arvo.com", "role": "Support Agent"},
    {"name": "Sneha", "email": "sneha@arvo.com", "role": "Support Agent"},
    {"name": "Rohan", "email": "rohan@arvo.com", "role": "Support Agent"},
    {"name": "Neha", "email": "neha@arvo.com", "role": "Support Agent"},
]

def seed_database(db: Session):
    # Check if already seeded
    if db.query(Agent).first():
        return

    # 1. Seed Agents
    created_agents = []
    for a in ARVO_AGENTS:
        agent = Agent(name=a["name"], email=a["email"], role=a["role"])
        db.add(agent)
        created_agents.append(agent)
    db.commit()

    # Re-query agents to get IDs
    agents = db.query(Agent).all()
    meera = agents[0]
    arjun = agents[1]
    priya = agents[2]

    now = datetime.utcnow()
    # Snap reference to working time
    ref_time = snap_to_next_working_time(now - timedelta(hours=4))

    # 2. Seed Sample Tickets
    sample_tickets = [
        {
            "ticket_number": "INC-0330",
            "title": "Payment gateway timeout on checkout",
            "description": "Customers are getting 504 Gateway Timeout during credit card verification on the checkout screen. Production is impacted.",
            "customer_name": "Acme Retail Co.",
            "customer_email": "tech@acmeretail.com",
            "priority": "URGENT",
            "status": "IN_PROGRESS",
            "assigned_agent_id": arjun.id,
            "created_offset_hours": 1,
            "first_response_done": True,
            "internal_notes": [
                "Checked Stripe logs: seeing rate limit responses from gateway endpoint. Escalated to DevOps."
            ],
            "public_replies": [
                "Hello Acme Retail, we have identified the gateway timeout and are investigating with our infrastructure team. Expected update in 30 minutes."
            ]
        },
        {
            "ticket_number": "INC-0331",
            "title": "Cannot export monthly payroll reports to CSV",
            "description": "Clicking Export CSV in the reports tab gives a blank page. Need this for monthly accounting closing.",
            "customer_name": "BioHealth Corp",
            "customer_email": "accounts@biohealth.org",
            "priority": "MEDIUM",
            "status": "WAITING_ON_CUSTOMER",
            "assigned_agent_id": priya.id,
            "created_offset_hours": 3,
            "first_response_done": True,
            "internal_notes": [
                "Reproduced on staging: fails when date range contains more than 10,000 rows. Awaiting customer confirmation on date filter."
            ],
            "public_replies": [
                "Hi BioHealth team, could you please confirm the exact date range and filter criteria selected when the blank page appeared? Thank you."
            ]
        },
        {
            "ticket_number": "INC-0332",
            "title": "Single Sign-On (SSO) login fails for new employees",
            "description": "Three newly hired employees cannot log in via Okta SAML. Existing employees can log in fine.",
            "customer_name": "FinEdge Capital",
            "customer_email": "admin@finedge.com",
            "priority": "MEDIUM",
            "status": "NEW",
            "assigned_agent_id": None,
            "created_offset_hours": 2,
            "first_response_done": False,
            "internal_notes": [],
            "public_replies": []
        },
        {
            "ticket_number": "INC-0333",
            "title": "How to configure custom webhook retry intervals?",
            "description": "We are looking at documentation for webhooks. Is there a way to set exponential backoff on failed webhook deliveries?",
            "customer_name": "Apex Logistics",
            "customer_email": "dev@apexlogistics.io",
            "priority": "LOW",
            "status": "NEW",
            "assigned_agent_id": None,
            "created_offset_hours": 5,
            "first_response_done": False,
            "internal_notes": [],
            "public_replies": []
        },
        {
            "ticket_number": "INC-0334",
            "title": "Production database connection pool exhausted",
            "description": "Severe degradation: all API requests return 500 error. The entire web application is down.",
            "customer_name": "OmniShop Global",
            "customer_email": "cto@omnishop.com",
            "priority": "URGENT",
            "status": "NEW",
            "assigned_agent_id": None,
            "created_offset_hours": 3, # Intentionally 3 hours ago to show SLA breach for Urgent!
            "first_response_done": False,
            "internal_notes": [],
            "public_replies": []
        },
        {
            "ticket_number": "INC-0329",
            "title": "Dark mode theme toggle resets after logout",
            "description": "When logging out and back in, the theme preference is forgotten and defaults to light mode.",
            "customer_name": "Zenith Media",
            "customer_email": "support@zenithmedia.com",
            "priority": "LOW",
            "status": "RESOLVED",
            "assigned_agent_id": meera.id,
            "created_offset_hours": 24,
            "first_response_done": True,
            "internal_notes": [
                "Fixed localStorage persistence key in patch v2.4.1."
            ],
            "public_replies": [
                "Hello Zenith team, this bug has been patched in release v2.4.1. Theme preferences now persist across login sessions."
            ]
        }
    ]

    for item in sample_tickets:
        created_at = ref_time - timedelta(hours=item["created_offset_hours"])
        sla_targets = calculate_initial_sla_targets(item["priority"], created_at)

        ticket = Ticket(
            ticket_number=item["ticket_number"],
            title=item["title"],
            description=item["description"],
            customer_name=item["customer_name"],
            customer_email=item["customer_email"],
            priority=item["priority"],
            status=item["status"],
            version=1,
            assigned_agent_id=item["assigned_agent_id"],
            created_at=created_at,
            updated_at=created_at,
            first_response_due_at=sla_targets["first_response_due_at"],
            resolution_due_at=sla_targets["resolution_due_at"],
            first_response_breached=False,
            resolution_breached=False
        )

        # Mark first response if done
        if item["first_response_done"]:
            ticket.first_response_at = created_at + timedelta(minutes=45)
            if ticket.first_response_at > ticket.first_response_due_at:
                ticket.first_response_breached = True

        # Check breach for unresponded tickets
        if not item["first_response_done"] and now > ticket.first_response_due_at:
            ticket.first_response_breached = True

        if item["status"] == "WAITING_ON_CUSTOMER":
            ticket.sla_paused_at = created_at + timedelta(minutes=50)

        if item["status"] == "RESOLVED":
            ticket.resolved_at = created_at + timedelta(hours=5)

        db.add(ticket)
        db.commit()
        db.refresh(ticket)

        # Audit creation event
        db.add(TicketEvent(
            ticket_id=ticket.id,
            actor_type="CUSTOMER",
            actor_name=ticket.customer_name,
            action="CREATED",
            details=f"Ticket {ticket.ticket_number} created with priority {ticket.priority}",
            created_at=created_at
        ))

        # Add initial customer message (the ticket problem)
        db.add(TicketMessage(
            ticket_id=ticket.id,
            sender_type="CUSTOMER",
            sender_name=ticket.customer_name,
            is_internal=False,
            body=ticket.description,
            created_at=created_at
        ))

        # Add public replies
        for reply in item["public_replies"]:
            reply_time = created_at + timedelta(minutes=45)
            assigned_agent = db.get(Agent, ticket.assigned_agent_id) if ticket.assigned_agent_id else meera
            db.add(TicketMessage(
                ticket_id=ticket.id,
                sender_type="AGENT",
                sender_id=assigned_agent.id,
                sender_name=assigned_agent.name,
                is_internal=False,
                body=reply,
                created_at=reply_time
            ))
            db.add(TicketEvent(
                ticket_id=ticket.id,
                actor_type="AGENT",
                actor_id=assigned_agent.id,
                actor_name=assigned_agent.name,
                action="PUBLIC_REPLY_SENT",
                details=f"Public reply sent to customer by {assigned_agent.name}",
                created_at=reply_time
            ))

        # Add internal notes
        for note in item["internal_notes"]:
            note_time = created_at + timedelta(minutes=40)
            assigned_agent = db.get(Agent, ticket.assigned_agent_id) if ticket.assigned_agent_id else meera
            db.add(TicketMessage(
                ticket_id=ticket.id,
                sender_type="AGENT",
                sender_id=assigned_agent.id,
                sender_name=assigned_agent.name,
                is_internal=True, # PRIVATE!
                body=note,
                created_at=note_time
            ))
            db.add(TicketEvent(
                ticket_id=ticket.id,
                actor_type="AGENT",
                actor_id=assigned_agent.id,
                actor_name=assigned_agent.name,
                action="INTERNAL_NOTE_ADDED",
                details=f"Private team note added by {assigned_agent.name}",
                created_at=note_time
            ))

        db.commit()
