from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Ticket, TicketMessage, TicketEvent
from app.schemas import (
    CustomerTicketRead, CustomerTicketMessageRead,
    CustomerCreateReply, TicketCustomerReopenRequest
)
from app.sla_engine import calculate_working_minutes, add_working_minutes
from app.config import settings

router = APIRouter(prefix="/api/customer", tags=["Customer Portal"])

@router.get("/tickets/{ticket_number}", response_model=CustomerTicketRead)
def get_customer_ticket(ticket_number: str, db: Session = Depends(get_db)):
    """
    INC-0304 Solution:
    Customer view strictly filters out all internal team notes.
    Private team notes are NEVER returned in this endpoint.
    """
    ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number.upper()).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Explicitly query ONLY public messages (is_internal == False)
    public_messages = db.query(TicketMessage).filter(
        TicketMessage.ticket_id == ticket.id,
        TicketMessage.is_internal == False
    ).order_by(TicketMessage.created_at.asc()).all()

    # Build customer schema (which contains no internal note fields)
    return CustomerTicketRead(
        ticket_number=ticket.ticket_number,
        title=ticket.title,
        description=ticket.description,
        customer_name=ticket.customer_name,
        status=ticket.status,
        priority=ticket.priority,
        created_at=ticket.created_at,
        resolved_at=ticket.resolved_at,
        messages=[
            CustomerTicketMessageRead(
                id=m.id,
                ticket_id=m.ticket_id,
                sender_type=m.sender_type,
                sender_name=m.sender_name,
                body=m.body,
                created_at=m.created_at
            ) for m in public_messages
        ]
    )

@router.post("/tickets/{ticket_number}/reply", response_model=CustomerTicketRead)
def customer_reply(ticket_number: str, payload: CustomerCreateReply, db: Session = Depends(get_db)):
    """
    Customer replies to a ticket.
    - Message is always public (is_internal=False).
    - If ticket was WAITING_ON_CUSTOMER, automatically transitions back to IN_PROGRESS.
    - SLA timer unpauses, extending target deadlines by exact paused business minutes.
    """
    ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number.upper()).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.status == "CLOSED":
        raise HTTPException(status_code=400, detail="Cannot reply to a closed ticket. Please submit a new ticket.")

    now = datetime.utcnow()

    # Add public message from customer
    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_type="CUSTOMER",
        sender_name=ticket.customer_name,
        is_internal=False, # Public
        body=payload.body,
        created_at=now
    )
    db.add(msg)

    # Resume SLA if was waiting on customer
    if ticket.status == "WAITING_ON_CUSTOMER":
        if ticket.sla_paused_at:
            paused_mins = calculate_working_minutes(ticket.sla_paused_at, now)
            ticket.total_paused_minutes += paused_mins
            ticket.sla_paused_at = None

            # Extend deadlines
            if not ticket.first_response_at:
                ticket.first_response_due_at = add_working_minutes(ticket.first_response_due_at, paused_mins)
            ticket.resolution_due_at = add_working_minutes(ticket.resolution_due_at, paused_mins)

            db.add(TicketEvent(
                ticket_id=ticket.id,
                actor_type="SYSTEM",
                actor_name="SLA Engine",
                action="SLA_RESUMED",
                details=f"Customer replied. Resumed SLA timer and added {paused_mins} paused working minutes to deadlines.",
                created_at=now
            ))

        ticket.status = "IN_PROGRESS"

    ticket.updated_at = now
    ticket.version += 1

    db.add(TicketEvent(
        ticket_id=ticket.id,
        actor_type="CUSTOMER",
        actor_name=ticket.customer_name,
        action="CUSTOMER_REPLY",
        details="Customer sent a public reply",
        created_at=now
    ))

    db.commit()
    db.refresh(ticket)
    return get_customer_ticket(ticket_number, db)

@router.post("/tickets/{ticket_number}/reopen", response_model=CustomerTicketRead)
def customer_reopen(ticket_number: str, payload: TicketCustomerReopenRequest, db: Session = Depends(get_db)):
    """
    Customer reopens a resolved ticket.
    Rule: Allowed ONLY within 1 week of resolution (settings.REOPEN_WINDOW_DAYS).
    After 1 week, rejected with instruction to create a new ticket.
    """
    ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number.upper()).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.status != "RESOLVED":
        raise HTTPException(status_code=400, detail=f"Cannot reopen a ticket with status '{ticket.status}'. Only resolved tickets can be reopened.")

    if not ticket.resolved_at:
        ticket.resolved_at = ticket.updated_at

    now = datetime.utcnow()
    # Check 1 week reopen window
    reopen_cutoff = ticket.resolved_at + timedelta(days=settings.REOPEN_WINDOW_DAYS)
    if now > reopen_cutoff:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 1-week reopen window for this ticket has expired. As per support policy, please submit a new ticket instead."
        )

    # Reopen ticket
    ticket.status = "IN_PROGRESS"
    ticket.reopened_count += 1
    ticket.updated_at = now
    ticket.version += 1

    # Record message explaining reopen
    db.add(TicketMessage(
        ticket_id=ticket.id,
        sender_type="CUSTOMER",
        sender_name=ticket.customer_name,
        is_internal=False,
        body=f"[Ticket Reopened by Customer]: {payload.reason}",
        created_at=now
    ))

    # Audit log
    db.add(TicketEvent(
        ticket_id=ticket.id,
        actor_type="CUSTOMER",
        actor_name=ticket.customer_name,
        action="REOPENED",
        details=f"Customer reopened ticket within 1-week window. Reason: {payload.reason}",
        created_at=now
    ))

    db.commit()
    db.refresh(ticket)
    return get_customer_ticket(ticket_number, db)
