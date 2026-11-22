from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ----------------- Agent Schemas -----------------
class AgentBase(BaseModel):
    name: str
    email: EmailStr
    role: str = "Support Agent"

class AgentRead(AgentBase):
    id: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

# ----------------- Audit Event Schemas -----------------
class TicketEventRead(BaseModel):
    id: int
    ticket_id: int
    actor_type: str
    actor_id: Optional[int] = None
    actor_name: str
    action: str
    details: str
    metadata_json: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Message Schemas -----------------
class TicketMessageBase(BaseModel):
    body: str

class AgentCreateMessage(TicketMessageBase):
    # Agent can choose to send public reply or internal note
    is_internal: bool = False

class CustomerCreateReply(TicketMessageBase):
    # Customer replies are ALWAYS public (is_internal=False)
    pass

# Agent Message Read (Can see both public and internal notes)
class AgentTicketMessageRead(BaseModel):
    id: int
    ticket_id: int
    sender_type: str
    sender_id: Optional[int] = None
    sender_name: str
    is_internal: bool
    body: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Customer Message Read (INC-0304: Internal notes strictly excluded from model!)
class CustomerTicketMessageRead(BaseModel):
    id: int
    ticket_id: int
    sender_type: str
    sender_name: str
    body: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Ticket Schemas -----------------
class TicketCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=5)
    customer_name: str = Field(..., min_length=2, max_length=100)
    customer_email: EmailStr
    priority: str = Field(default="MEDIUM", pattern="^(URGENT|MEDIUM|LOW)$")

class TicketClaimRequest(BaseModel):
    agent_id: int
    expected_version: int

class TicketPriorityChangeRequest(BaseModel):
    agent_id: int
    new_priority: str = Field(..., pattern="^(URGENT|MEDIUM|LOW)$")
    reason: Optional[str] = "Priority updated by agent"

class TicketStatusChangeRequest(BaseModel):
    agent_id: int
    new_status: str = Field(..., pattern="^(NEW|IN_PROGRESS|WAITING_ON_CUSTOMER|RESOLVED|CLOSED)$")
    comment: Optional[str] = None

class TicketCustomerReopenRequest(BaseModel):
    customer_email: EmailStr
    reason: str = Field(..., min_length=3)

# Agent Ticket Read (Comprehensive view for support agents)
class AgentTicketRead(BaseModel):
    id: int
    ticket_number: str
    title: str
    description: str
    customer_name: str
    customer_email: str
    priority: str
    status: str
    version: int
    assigned_agent_id: Optional[int] = None
    assigned_agent: Optional[AgentRead] = None
    created_at: datetime
    updated_at: datetime
    first_response_due_at: datetime
    first_response_at: Optional[datetime] = None
    first_response_breached: bool
    resolution_due_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_breached: bool
    sla_paused_at: Optional[datetime] = None
    total_paused_minutes: int
    closed_at: Optional[datetime] = None
    auto_closed: bool
    reopened_count: int
    is_late: bool = False
    is_waiting_on_customer: bool = False

    model_config = ConfigDict(from_attributes=True)

class AgentTicketDetailRead(AgentTicketRead):
    messages: List[AgentTicketMessageRead] = []
    audit_events: List[TicketEventRead] = []

# Customer Ticket Read (INC-0304: ZERO internal notes, no agent private metadata)
class CustomerTicketRead(BaseModel):
    ticket_number: str
    title: str
    description: str
    customer_name: str
    status: str
    priority: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    messages: List[CustomerTicketMessageRead] = []

    model_config = ConfigDict(from_attributes=True)

# Ticket statistics summary for Agent Dashboard
class TicketStats(BaseModel):
    total_tickets: int
    open_tickets: int
    late_tickets: int
    waiting_on_customer_tickets: int
    urgent_tickets: int
    resolved_tickets: int
