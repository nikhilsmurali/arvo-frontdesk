export interface Agent {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface TicketEvent {
  id: number;
  ticket_id: number;
  actor_type: 'AGENT' | 'CUSTOMER' | 'SYSTEM';
  actor_id?: number | null;
  actor_name: string;
  action: string;
  details: string;
  metadata_json?: string | null;
  created_at: string;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  sender_type: 'AGENT' | 'CUSTOMER' | 'SYSTEM';
  sender_id?: number | null;
  sender_name: string;
  is_internal?: boolean;
  body: string;
  created_at: string;
}

export interface Ticket {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  customer_name: string;
  customer_email: string;
  priority: 'URGENT' | 'MEDIUM' | 'LOW';
  status: 'NEW' | 'IN_PROGRESS' | 'WAITING_ON_CUSTOMER' | 'RESOLVED' | 'CLOSED';
  version: number;
  assigned_agent_id?: number | null;
  assigned_agent?: Agent | null;
  created_at: string;
  updated_at: string;
  first_response_due_at: string;
  first_response_at?: string | null;
  first_response_breached: boolean;
  resolution_due_at: string;
  resolved_at?: string | null;
  resolution_breached: boolean;
  sla_paused_at?: string | null;
  total_paused_minutes: number;
  closed_at?: string | null;
  auto_closed: boolean;
  reopened_count: number;
  is_late: boolean;
  is_waiting_on_customer: boolean;
}

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
  audit_events: TicketEvent[];
}

export interface CustomerTicket {
  ticket_number: string;
  title: string;
  description: string;
  customer_name: string;
  status: string;
  priority: string;
  created_at: string;
  resolved_at?: string | null;
  messages: TicketMessage[];
}

export interface TicketStats {
  total_tickets: number;
  open_tickets: number;
  late_tickets: number;
  waiting_on_customer_tickets: number;
  urgent_tickets: number;
  resolved_tickets: number;
}

