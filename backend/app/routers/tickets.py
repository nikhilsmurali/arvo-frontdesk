from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import Ticket, TicketMessage, TicketEvent, Agent
from app.schemas import (
    AgentTicketRead, AgentTicketDetailRead, TicketCreate,
    TicketClaimRequest, TicketPriorityChangeRequest,
    TicketStatusChangeRequest, AgentCreateMessage, TicketStats
)
from app.sla_engine import (
    calculate_initial_sla_targets, calculate_working_minutes,
    add_working_minutes, recalculate_sla_on_priority_change
)
from app.config import settings

router = APIRouter(prefix="/api/tickets", tags=["Agent Tickets"])

def check_and_update_sla_breaches(ticket: Ticket, now: datetime) -> bool:
    """Check and flag if first response or resolution SLAs are breached."""
    changed = False
    
    # Check First Response SLA
    if not ticket.first_response_at:
        if now > ticket.first_response_due_at and not ticket.first_response_breached:
            ticket.first_response_breached = True
            changed = True
    else:
        if ticket.first_response_at > ticket.first_response_due_at and not ticket.first_response_breached:
            ticket.first_response_breached = True
            changed = True

    # Check Resolution SLA
    if ticket.status in ["RESOLVED", "CLOSED"]:
        if ticket.resolved_at and ticket.resolved_at > ticket.resolution_due_at and not ticket.resolution_breached:
            ticket.resolution_breached = True
            changed = True
    else:
        if now > ticket.resolution_due_at and not ticket.resolution_breached:
            ticket.resolution_breached = True
            changed = True

    return changed

@router.get("/stats", response_model=TicketStats)
def get_ticket_stats(db: Session = Depends(get_db)):
    """Summary metrics for the Agent dashboard."""
    now = datetime.utcnow()
    tickets = db.query(Ticket).all()
    
    open_statuses = ["NEW", "IN_PROGRESS", "WAITING_ON_CUSTOMER"]
    
    total = len(tickets)
    open_count = sum(1 for t in tickets if t.status in open_statuses)
    waiting_count = sum(1 for t in tickets if t.status == "WAITING_ON_CUSTOMER")
    urgent_count = sum(1 for t in tickets if t.priority == "URGENT" and t.status in open_statuses)
    resolved_count = sum(1 for t in tickets if t.status in ["RESOLVED", "CLOSED"])

    late_count = 0
    for t in tickets:
        if t.status in open_statuses:
            if (not t.first_response_at and now > t.first_response_due_at) or (now > t.resolution_due_at) or t.first_response_breached or t.resolution_breached:
                late_count += 1

    return TicketStats(
        total_tickets=total,
        open_tickets=open_count,
        late_tickets=late_count,
        waiting_on_customer_tickets=waiting_count,
        urgent_tickets=urgent_count,
        resolved_tickets=resolved_count
    )

@router.get("", response_model=List[AgentTicketRead])
def list_tickets(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    agent_id: Optional[int] = Query(None),
    is_late_only: bool = Query(False),
    is_waiting_only: bool = Query(False),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    List all tickets for agents with rich filtering options.
    Specifically supports:
    - Late tickets (SLA breached)
    - Waiting on customer tickets
    - Assigned agent filter
    - Priority / Status filter
    """
    now = datetime.utcnow()
    query = db.query(Ticket)

    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(Ticket.status == status_filter.upper())
    
    if priority_filter and priority_filter.upper() != "ALL":
        query = query.filter(Ticket.priority == priority_filter.upper())

    if agent_id is not None:
        if agent_id == 0: # Unassigned
            query = query.filter(Ticket.assigned_agent_id.is_(None))
        else:
            query = query.filter(Ticket.assigned_agent_id == agent_id)

    if is_waiting_only:
        query = query.filter(Ticket.status == "WAITING_ON_CUSTOMER")

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Ticket.ticket_number.ilike(search_pattern),
                Ticket.title.ilike(search_pattern),
                Ticket.customer_name.ilike(search_pattern),
                Ticket.customer_email.ilike(search_pattern)
            )
        )

    tickets = query.order_by(
        # Prioritize Urgent and late tickets first
        Ticket.created_at.desc()
    ).all()

    # Dynamic SLA calculation and enrichment
    results = []
    for t in tickets:
        if check_and_update_sla_breaches(t, now):
            db.commit()

        is_late = (
            (not t.first_response_at and now > t.first_response_due_at) or
            (t.status not in ["RESOLVED", "CLOSED"] and now > t.resolution_due_at) or
            t.first_response_breached or
            t.resolution_breached
        )
        is_waiting = (t.status == "WAITING_ON_CUSTOMER")

        if is_late_only and not is_late:
            continue

        read_model = AgentTicketRead.model_validate(t)
        read_model.is_late = is_late
        read_model.is_waiting_on_customer = is_waiting
        results.append(read_model)

    return results

@router.post("", response_model=AgentTicketRead)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    """Create a new customer ticket."""
    now = datetime.utcnow()
    
    # Generate sequential ticket number
    count = db.query(Ticket).count() + 335
    ticket_num = f"INC-{count:04d}"

    sla_targets = calculate_initial_sla_targets(payload.priority, now)

    ticket = Ticket(
        ticket_number=ticket_num,
        title=payload.title,
        description=payload.description,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        priority=payload.priority.upper(),
        status="NEW",
        version=1,
        created_at=now,
        updated_at=now,
        first_response_due_at=sla_targets["first_response_due_at"],
        resolution_due_at=sla_targets["resolution_due_at"],
        first_response_breached=False,
        resolution_breached=False
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Initial message
    db.add(TicketMessage(
        ticket_id=ticket.id,
        sender_type="CUSTOMER",
        sender_name=ticket.customer_name,
        is_internal=False,
        body=ticket.description,
        created_at=now
    ))

    # Audit log
    db.add(TicketEvent(
        ticket_id=ticket.id,
        actor_type="CUSTOMER",
        actor_name=ticket.customer_name,
        action="CREATED",
        details=f"Ticket {ticket.ticket_number} created with priority {ticket.priority}",
        created_at=now
    ))
    db.commit()
    db.refresh(ticket)

    read_model = AgentTicketRead.model_validate(ticket)
    read_model.is_late = False
    read_model.is_waiting_on_customer = False
    return read_model

@router.get("/{ticket_id}", response_model=AgentTicketDetailRead)
def get_ticket_detail(ticket_id: int, db: Session = Depends(get_db)):
    """Retrieve full ticket detail for agents including private notes and immutable audit events."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    now = datetime.utcnow()
    if check_and_update_sla_breaches(ticket, now):
        db.commit()
        db.refresh(ticket)

    is_late = (
        (not ticket.first_response_at and now > ticket.first_response_due_at) or
        (ticket.status not in ["RESOLVED", "CLOSED"] and now > ticket.resolution_due_at) or
        ticket.first_response_breached or
        ticket.resolution_breached
    )
    
    read_model = AgentTicketDetailRead.model_validate(ticket)
    read_model.is_late = is_late
    read_model.is_waiting_on_customer = (ticket.status == "WAITING_ON_CUSTOMER")
    return read_model

@router.post("/{ticket_id}/claim", response_model=AgentTicketDetailRead)
def claim_ticket(ticket_id: int, payload: TicketClaimRequest, db: Session = Depends(get_db)):
    """
    INC-0291 Solution:
    Atomic claim with concurrency check (optimistic locking).
    Prevents race conditions where two agents claim the same ticket concurrently.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    agent = db.query(Agent).filter(Agent.id == payload.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Check if already assigned to someone else
    if ticket.assigned_agent_id is not None and ticket.assigned_agent_id != agent.id:
        assigned_name = ticket.assigned_agent.name if ticket.assigned_agent else f"Agent #{ticket.assigned_agent_id}"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflict: Ticket {ticket.ticket_number} has already been claimed by {assigned_name}. Refresh your screen to see latest status."
        )

    # Check version for optimistic concurrency control
    if ticket.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflict: Ticket {ticket.ticket_number} was modified by another agent (version mismatch). Please refresh."
        )

    now = datetime.utcnow()
    ticket.assigned_agent_id = agent.id
    if ticket.status == "NEW":
        ticket.status = "IN_PROGRESS"
    ticket.version += 1
    ticket.updated_at = now

    # Log immutable audit event
    db.add(TicketEvent(
        ticket_id=ticket.id,
        actor_type="AGENT",
        actor_id=agent.id,
        actor_name=agent.name,
        action="CLAIMED",
        details=f"Ticket claimed by {agent.name}",
        metadata_json=f'{{"assigned_agent_id": {agent.id}, "version": {ticket.version}}}',
        created_at=now
    ))

    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id, db)

@router.post("/{ticket_id}/messages", response_model=AgentTicketDetailRead)
def post_ticket_message(ticket_id: int, payload: AgentCreateMessage, agent_id: int = Query(...), db: Session = Depends(get_db)):
    """
    Send a message on a ticket:
    - is_internal = False: Public reply sent to customer.
    - is_internal = True: Internal team note (INC-0304: strictly hidden from customer).
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    now = datetime.utcnow()

    # Create message
    message = TicketMessage(
        ticket_id=ticket.id,
        sender_type="AGENT",
        sender_id=agent.id,
        sender_name=agent.name,
        is_internal=payload.is_internal,
        body=payload.body,
        created_at=now
    )
    db.add(message)

    # If public reply and first response has not yet occurred
    if not payload.is_internal and not ticket.first_response_at:
        ticket.first_response_at = now
        if now > ticket.first_response_due_at:
            ticket.first_response_breached = True
            db.add(TicketEvent(
                ticket_id=ticket.id,
                actor_type="SYSTEM",
                actor_name="SLA Engine",
                action="FIRST_RESPONSE_BREACHED",
                details=f"First response sent at {now.isoformat()}, after deadline {ticket.first_response_due_at.isoformat()}",
                created_at=now
            ))
        else:
            db.add(TicketEvent(
                ticket_id=ticket.id,
                actor_type="SYSTEM",
                actor_name="SLA Engine",
                action="FIRST_RESPONSE_MET",
                details=f"First response SLA met successfully at {now.isoformat()}",
                created_at=now
            ))

    # Audit log
    action_type = "INTERNAL_NOTE_ADDED" if payload.is_internal else "PUBLIC_REPLY_SENT"
    details_str = f"Private team note added by {agent.name}" if payload.is_internal else f"Public reply sent to customer by {agent.name}"
    
    db.add(TicketEvent(
        ticket_id=ticket.id,
        actor_type="AGENT",
        actor_id=agent.id,
        actor_name=agent.name,
        action=action_type,
        details=details_str,
        created_at=now
    ))

    ticket.updated_at = now
    ticket.version += 1
    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id, db)

@router.post("/{ticket_id}/status", response_model=AgentTicketDetailRead)
def change_ticket_status(ticket_id: int, payload: TicketStatusChangeRequest, db: Session = Depends(get_db)):
    """
    Update ticket status.
    Handles SLA Pause when transitioning to WAITING_ON_CUSTOMER,
    and SLA Resume when moving back to IN_PROGRESS.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    agent = db.query(Agent).filter(Agent.id == payload.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    old_status = ticket.status
    new_status = payload.new_status
    now = datetime.utcnow()

    if old_status == new_status:
        return get_ticket_detail(ticket_id, db)

    # Handle transitions
    if new_status == "WAITING_ON_CUSTOMER":
        # Pause SLA timer
        ticket.sla_paused_at = now
        db.add(TicketEvent(
            ticket_id=ticket.id,
            actor_type="AGENT",
            actor_id=agent.id,
            actor_name=agent.name,
            action="SLA_PAUSED",
            details=f"Status changed to Waiting on Customer. SLA timer paused at {now.isoformat()}",
            created_at=now
        ))

    elif old_status == "WAITING_ON_CUSTOMER" and new_status in ["IN_PROGRESS", "RESOLVED"]:
        # Resume SLA timer and extend deadlines by paused working minutes
        if ticket.sla_paused_at:
            paused_working_mins = calculate_working_minutes(ticket.sla_paused_at, now)
            ticket.total_paused_minutes += paused_working_mins
            ticket.sla_paused_at = None

            # Shift targets forward
            if not ticket.first_response_at:
                ticket.first_response_due_at = add_working_minutes(ticket.first_response_due_at, paused_working_mins)
            ticket.resolution_due_at = add_working_minutes(ticket.resolution_due_at, paused_working_mins)

            db.add(TicketEvent(
                ticket_id=ticket.id,
                actor_type="AGENT",
                actor_id=agent.id,
                actor_name=agent.name,
                action="SLA_RESUMED",
                details=f"SLA timer resumed. Extended deadlines by {paused_working_mins} working minutes.",
                created_at=now
            ))

    if new_status == "RESOLVED":
        ticket.resolved_at = now
        if now > ticket.resolution_due_at:
            ticket.resolution_breached = True
        db.add(TicketEvent(
            ticket_id=ticket.id,
            actor_type="AGENT",
            actor_id=agent.id,
            actor_name=agent.name,
            action="RESOLVED",
            details=f"Ticket marked as resolved by {agent.name}. 1-week customer reopen window started.",
            created_at=now
        ))

    elif new_status == "CLOSED":
        ticket.closed_at = now
        db.add(TicketEvent(
            ticket_id=ticket.id,
            actor_type="AGENT",
            actor_id=agent.id,
            actor_name=agent.name,
            action="CLOSED",
            details=f"Ticket closed by {agent.name}",
            created_at=now
        ))

    ticket.status = new_status
    ticket.updated_at = now
    ticket.version += 1

    db.add(TicketEvent(
        ticket_id=ticket.id,
        actor_type="AGENT",
        actor_id=agent.id,
        actor_name=agent.name,
        action="STATUS_CHANGED",
        details=f"Status changed from {old_status} to {new_status} by {agent.name}. {payload.comment or ''}".strip(),
        created_at=now
    ))

    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id, db)

@router.post("/{ticket_id}/priority", response_model=AgentTicketDetailRead)
def change_ticket_priority(ticket_id: int, payload: TicketPriorityChangeRequest, db: Session = Depends(get_db)):
    """
    Answers Section 3:
    'What happens to the timer if we change a ticket to urgent in the middle?'
    Recalculates SLA targets based on elapsed working minutes vs new priority allowance.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    agent = db.query(Agent).filter(Agent.id == payload.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    old_priority = ticket.priority
    new_priority = payload.new_priority.upper()

    if old_priority == new_priority:
        return get_ticket_detail(ticket_id, db)

    now = datetime.utcnow()
    recalc = recalculate_sla_on_priority_change(
        ticket_created_at=ticket.created_at,
        old_priority=old_priority,
        new_priority=new_priority,
        first_response_done=(ticket.first_response_at is not None),
        total_paused_minutes=ticket.total_paused_minutes,
        now=now
    )

    if recalc["first_response_due_at"]:
        ticket.first_response_due_at = recalc["first_response_due_at"]
        if not ticket.first_response_at and now >= ticket.first_response_due_at:
            ticket.first_response_breached = True

    if recalc["resolution_due_at"]:
        ticket.resolution_due_at = recalc["resolution_due_at"]
        if now >= ticket.resolution_due_at:
            ticket.resolution_breached = True

    ticket.priority = new_priority
    ticket.updated_at = now
    ticket.version += 1

    db.add(TicketEvent(
        ticket_id=ticket.id,
        actor_type="AGENT",
        actor_id=agent.id,
        actor_name=agent.name,
        action="PRIORITY_CHANGED",
        details=f"Priority updated from {old_priority} to {new_priority} by {agent.name}. Reason: {payload.reason}. SLA targets recalculated.",
        metadata_json=f'{{"old_priority": "{old_priority}", "new_priority": "{new_priority}", "elapsed_active_minutes": {recalc["elapsed_active_minutes"]}}}',
        created_at=now
    ))

    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id, db)

@router.post("/sweep-sla")
def sweep_sla_and_autoclose(db: Session = Depends(get_db)):
    """
    Background maintenance sweep:
    1. Recalculates breaches on active tickets.
    2. Auto-closes tickets waiting on customer for > 1 working week (45 working hours).
    """
    now = datetime.utcnow()
    tickets = db.query(Ticket).filter(Ticket.status.in_(["NEW", "IN_PROGRESS", "WAITING_ON_CUSTOMER"])).all()
    auto_closed_count = 0
    breached_count = 0

    for t in tickets:
        # Check auto-closure: waiting on customer > 45 working hours (settings.AUTO_CLOSE_WAITING_MINUTES)
        if t.status == "WAITING_ON_CUSTOMER" and t.sla_paused_at:
            waiting_working_mins = calculate_working_minutes(t.sla_paused_at, now)
            if waiting_working_mins >= settings.AUTO_CLOSE_WAITING_MINUTES:
                t.status = "CLOSED"
                t.closed_at = now
                t.auto_closed = True
                t.updated_at = now
                t.version += 1
                auto_closed_count += 1

                db.add(TicketEvent(
                    ticket_id=t.id,
                    actor_type="SYSTEM",
                    actor_name="Frontdesk Autoclosing Engine",
                    action="AUTO_CLOSED",
                    details=f"Ticket automatically closed: no customer reply for {waiting_working_mins} working minutes (1 working week).",
                    created_at=now
                ))
                continue

        if check_and_update_sla_breaches(t, now):
            breached_count += 1

    db.commit()
    return {
        "status": "success",
        "scanned_tickets": len(tickets),
        "auto_closed_tickets": auto_closed_count,
        "newly_flagged_breaches": breached_count
    }
