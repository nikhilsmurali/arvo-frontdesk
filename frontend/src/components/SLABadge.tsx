import React from 'react';
import { Clock, AlertTriangle, CheckCircle, PauseCircle, ShieldAlert } from 'lucide-react';
import { Ticket } from '../types';

interface Props {
  ticket: Ticket;
}

export const SLABadge: React.FC<Props> = ({ ticket }) => {
  const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  const isWaiting = ticket.status === 'WAITING_ON_CUSTOMER';
  const isBreached = ticket.is_late || ticket.first_response_breached || ticket.resolution_breached;

  if (isResolved) {
    if (ticket.resolution_breached) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-status-error/10 text-status-error border border-status-error/25">
          <AlertTriangle className="w-3.5 h-3.5" />
          Resolved (Late)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-status-success/10 text-status-success border border-status-success/25">
        <CheckCircle className="w-3.5 h-3.5" />
        Resolved On Time
      </span>
    );
  }

  if (isWaiting) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-status-warning/10 text-amber-700 border border-status-warning/30">
        <PauseCircle className="w-3.5 h-3.5" />
        SLA Paused
      </span>
    );
  }

  if (isBreached) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-status-error/10 text-status-error border border-status-error/30 animate-pulse">
        <ShieldAlert className="w-3.5 h-3.5" />
        SLA Breached
      </span>
    );
  }

  // Active on track
  const dueDate = ticket.first_response_at ? new Date(ticket.resolution_due_at) : new Date(ticket.first_response_due_at);
  const label = ticket.first_response_at ? 'Fix Due' : 'Reply Due';

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-brand/10 text-brand border border-brand/25">
      <Clock className="w-3.5 h-3.5" />
      {label}: {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', weekday: 'short' })}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const p = priority.toUpperCase();
  if (p === 'URGENT') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-status-urgent/15 text-[#EA580C] border border-status-urgent/30">
        Urgent
      </span>
    );
  }
  if (p === 'MEDIUM') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-status-warning/15 text-amber-800 border border-status-warning/30">
        Medium
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wider uppercase bg-surface-nested text-text-secondary border border-border">
      Low
    </span>
  );
};
