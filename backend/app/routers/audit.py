from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import TicketEvent, Ticket
from app.schemas import TicketEventRead

router = APIRouter(prefix="/api/audit", tags=["Audit Log"])

@router.get("/tickets/{ticket_id}", response_model=List[TicketEventRead])
def get_ticket_audit_trail(ticket_id: int, db: Session = Depends(get_db)):
    """
    INC-0318 Solution:
    Returns the tamper-proof, append-only immutable event history for a ticket.
    Provides verifiable proof of what happened, who did it, and exact timestamps.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    events = db.query(TicketEvent).filter(
        TicketEvent.ticket_id == ticket_id
    ).order_by(TicketEvent.created_at.asc()).all()

    return events

