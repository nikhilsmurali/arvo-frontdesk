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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <AlertTriangle className="w-3.5 h-3.5" />
          Resolved (SLA Breached)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle className="w-3.5 h-3.5" />
        Resolved on time
      </span>
    );
  }

  if (isWaiting) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <PauseCircle className="w-3.5 h-3.5" />
        SLA Paused (Customer Waiting)
      </span>
    );
  }

  if (isBreached) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
        <ShieldAlert className="w-3.5 h-3.5" />
        SLA Breached (LATE)
      </span>
    );
  }

  // Active on track
  const dueDate = ticket.first_response_at ? new Date(ticket.resolution_due_at) : new Date(ticket.first_response_due_at);
  const label = ticket.first_response_at ? 'Fix Due' : 'Reply Due';

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
      <Clock className="w-3.5 h-3.5" />
      {label}: {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', weekday: 'short' })}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const p = priority.toUpperCase();
  if (p === 'URGENT') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white tracking-wide uppercase">
        Urgent
      </span>
    );
  }
  if (p === 'MEDIUM') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 uppercase">
        Medium
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 uppercase">
      Low
    </span>
  );
};
