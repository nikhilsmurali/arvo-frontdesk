from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.database import Base

class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    role = Column(String(50), default="Support Agent") # Support Lead, Support Agent
    is_active = Column(Boolean, default=True)

    tickets = relationship("Ticket", back_populates="assigned_agent")

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(20), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    
    # Customer Details
    customer_name = Column(String(100), nullable=False)
    customer_email = Column(String(100), nullable=False)

    # Priority: URGENT, MEDIUM, LOW
    priority = Column(String(20), default="MEDIUM", nullable=False, index=True)

    # Status: NEW, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED
    status = Column(String(30), default="NEW", nullable=False, index=True)

    # Concurrency control: Optimistic locking version
    # Incremented on every claim and critical state transition
    version = Column(Integer, default=1, nullable=False)

    # Assignment
    assigned_agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True, index=True)
    assigned_agent = relationship("Agent", back_populates="tickets")

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # SLA Tracking
    first_response_due_at = Column(DateTime, nullable=False, index=True)
    first_response_at = Column(DateTime, nullable=True)
    first_response_breached = Column(Boolean, default=False, nullable=False, index=True)

    resolution_due_at = Column(DateTime, nullable=False, index=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_breached = Column(Boolean, default=False, nullable=False, index=True)

    # Pausing SLA when waiting on customer
    sla_paused_at = Column(DateTime, nullable=True)
    total_paused_minutes = Column(Integer, default=0, nullable=False)

    # Auto-close and Reopen
    closed_at = Column(DateTime, nullable=True)
    auto_closed = Column(Boolean, default=False, nullable=False)
    reopened_count = Column(Integer, default=0, nullable=False)

    # Relationships
    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketMessage.created_at.asc()")
    audit_events = relationship("TicketEvent", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketEvent.created_at.asc()")

    __table_args__ = (
        Index("idx_tickets_status_priority", "status", "priority"),
    )

class TicketMessage(Base):
    """
    Messages for a ticket.
    INC-0304 Solution: is_internal strictly marks private team notes.
    Private team notes are NEVER returned to customer endpoints or serializers.
    """
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    
    sender_type = Column(String(20), nullable=False) # AGENT, CUSTOMER, SYSTEM
    sender_id = Column(Integer, nullable=True) # Agent ID if AGENT
    sender_name = Column(String(100), nullable=False)

    # True = Internal Team Note (INC-0304: PRIVATE, NEVER visible to customer)
    # False = Public Reply (Sent to customer)
    is_internal = Column(Boolean, default=False, nullable=False, index=True)

    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    ticket = relationship("Ticket", back_populates="messages")

class TicketEvent(Base):
    """
    Immutable Audit Trail (INC-0318 Solution).
    Append-only: records who did what, when it happened, and before/after details.
    No UPDATE or DELETE operations permitted on this table.
    """
    __tablename__ = "ticket_events"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)

    actor_type = Column(String(20), nullable=False) # AGENT, CUSTOMER, SYSTEM
    actor_id = Column(Integer, nullable=True)
    actor_name = Column(String(100), nullable=False)

    action = Column(String(50), nullable=False) 
    # Actions: CREATED, CLAIMED, REASSIGNED, STATUS_CHANGED, PRIORITY_CHANGED, 
    # PUBLIC_REPLY_SENT, INTERNAL_NOTE_ADDED, SLA_PAUSED, SLA_RESUMED, 
    # FIRST_RESPONSE_RECORDED, RESOLVED, REOPENED, AUTO_CLOSED

    details = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=True) # JSON details (e.g. old_val -> new_val)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    ticket = relationship("Ticket", back_populates="audit_events")

