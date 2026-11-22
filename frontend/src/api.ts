import { Ticket, TicketDetail, TicketStats, Agent, CustomerTicket } from './types';

const API_BASE = '/api';

export async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/agents`);
  if (!res.ok) throw new Error('Failed to load agents');
  return res.json();
}

export async function fetchStats(): Promise<TicketStats> {
  const res = await fetch(`${API_BASE}/tickets/stats`);
  if (!res.ok) throw new Error('Failed to fetch statistics');
  return res.json();
}

export async function fetchTickets(params: {
  status?: string;
  priority?: string;
  agentId?: number | null;
  isLateOnly?: boolean;
  isWaitingOnly?: boolean;
  search?: string;
}): Promise<Ticket[]> {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'ALL') query.append('status', params.status);
  if (params.priority && params.priority !== 'ALL') query.append('priority', params.priority);
  if (params.agentId !== undefined && params.agentId !== null) query.append('agent_id', params.agentId.toString());
  if (params.isLateOnly) query.append('is_late_only', 'true');
  if (params.isWaitingOnly) query.append('is_waiting_only', 'true');
  if (params.search) query.append('search', params.search);

  const res = await fetch(`${API_BASE}/tickets?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch tickets');
  return res.json();
}

export async function fetchTicketDetail(id: number): Promise<TicketDetail> {
  const res = await fetch(`${API_BASE}/tickets/${id}`);
  if (!res.ok) throw new Error('Failed to fetch ticket detail');
  return res.json();
}

export async function createTicket(payload: {
  title: string;
  description: string;
  customer_name: string;
  customer_email: string;
  priority: string;
}): Promise<Ticket> {
  const res = await fetch(`${API_BASE}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create ticket');
  }
  return res.json();
}

export async function claimTicket(ticketId: number, agentId: number, expectedVersion: number): Promise<TicketDetail> {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId, expected_version: expectedVersion })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to claim ticket');
  }
  return res.json();
}

export async function postMessage(
  ticketId: number,
  agentId: number,
  body: string,
  isInternal: boolean
): Promise<TicketDetail> {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/messages?agent_id=${agentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, is_internal: isInternal })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to post message');
  }
  return res.json();
}

export async function updateTicketStatus(
  ticketId: number,
  agentId: number,
  newStatus: string,
  comment?: string
): Promise<TicketDetail> {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId, new_status: newStatus, comment })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update ticket status');
  }
  return res.json();
}

export async function updateTicketPriority(
  ticketId: number,
  agentId: number,
  newPriority: string,
  reason: string
): Promise<TicketDetail> {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/priority`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId, new_priority: newPriority, reason })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update priority');
  }
  return res.json();
}

export async function sweepSLA(): Promise<{
  status: string;
  scanned_tickets: number;
  auto_closed_tickets: number;
  newly_flagged_breaches: number;
}> {
  const res = await fetch(`${API_BASE}/tickets/sweep-sla`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to run SLA sweep');
  return res.json();
}

// ----------------- Customer Portal APIs -----------------
export async function fetchCustomerTicket(ticketNumber: string): Promise<CustomerTicket> {
  const res = await fetch(`${API_BASE}/customer/tickets/${ticketNumber.trim().toUpperCase()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Ticket not found');
  }
  return res.json();
}

export async function postCustomerReply(ticketNumber: string, body: string): Promise<CustomerTicket> {
  const res = await fetch(`${API_BASE}/customer/tickets/${ticketNumber.trim().toUpperCase()}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to send reply');
  }
  return res.json();
}

export async function requestCustomerReopen(
  ticketNumber: string,
  customerEmail: string,
  reason: string
): Promise<CustomerTicket> {
  const res = await fetch(`${API_BASE}/customer/tickets/${ticketNumber.trim().toUpperCase()}/reopen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_email: customerEmail, reason })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to reopen ticket');
  }
  return res.json();
}

