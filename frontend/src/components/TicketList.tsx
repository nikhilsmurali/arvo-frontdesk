import React from 'react';
import { Ticket, Agent } from '../types';
import { SLABadge, PriorityBadge } from './SLABadge';
import { User, Clock, Check, AlertCircle, ChevronRight, Inbox } from 'lucide-react';

interface Props {
  tickets: Ticket[];
  currentAgent: Agent;
  selectedTicketId: number | null;
  onSelectTicket: (ticketId: number) => void;
  onQuickClaim: (ticket: Ticket) => void;
}

export const TicketList: React.FC<Props> = ({
  tickets,
  currentAgent,
  selectedTicketId,
  onSelectTicket,
  onQuickClaim
}) => {
  if (tickets.length === 0) {
    return (
      <div className="bg-surface rounded-card border border-border-light p-12 text-center shadow-card">
        <Inbox className="w-12 h-12 text-text-muted mx-auto mb-3" />
        <h4 className="font-semibold text-text-primary text-sm">No tickets found</h4>
        <p className="text-xs text-text-secondary mt-1">
          No tickets match the currently active filters.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-card border border-border-light overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-surface-muted border-b border-border-light text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              <th className="py-3 px-4">Ticket</th>
              <th className="py-3 px-4">Subject & Customer</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">SLA Clock</th>
              <th className="py-3 px-4">Assigned Agent</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {tickets.map((t) => {
              const isSelected = selectedTicketId === t.id;
              const isAssignedToMe = t.assigned_agent_id === currentAgent.id;

              return (
                <tr
                  key={t.id}
                  onClick={() => onSelectTicket(t.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-brand-active'
                      : t.is_late
                      ? 'bg-status-error/5 hover:bg-status-error/10'
                      : 'hover:bg-surface-muted'
                  }`}
                >
                  <td className="py-3.5 px-4 font-mono font-semibold text-xs text-text-primary whitespace-nowrap">
                    {t.ticket_number}
                  </td>
                  <td className="py-3.5 px-4 max-w-xs md:max-w-md">
                    <div className="font-semibold text-text-primary truncate">{t.title}</div>
                    <div className="text-xs text-text-secondary flex items-center gap-1.5 mt-0.5">
                      <span>{t.customer_name}</span>
                      <span>•</span>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        t.status === 'NEW'
                          ? 'bg-brand/10 text-brand border border-brand/25'
                          : t.status === 'IN_PROGRESS'
                          ? 'bg-status-info/10 text-status-info border border-status-info/25'
                          : t.status === 'WAITING_ON_CUSTOMER'
                          ? 'bg-status-warning/10 text-amber-700 border border-status-warning/30'
                          : t.status === 'RESOLVED'
                          ? 'bg-status-success/10 text-status-success border border-status-success/25'
                          : 'bg-surface-nested text-text-secondary border border-border'
                      }`}
                    >
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <SLABadge ticket={t} />
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {t.assigned_agent ? (
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-tile flex items-center justify-center text-xs font-semibold ${
                            isAssignedToMe ? 'bg-brand text-white' : 'bg-surface-nested text-text-primary border border-border'
                          }`}
                        >
                          {t.assigned_agent.name[0]}
                        </div>
                        <span className="text-xs text-text-primary font-medium">
                          {t.assigned_agent.name} {isAssignedToMe && '(You)'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted italic">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {!t.assigned_agent_id ? (
                      <button
                        onClick={() => onQuickClaim(t)}
                        className="px-3 py-1 text-xs font-medium rounded-control bg-brand-active text-brand border border-brand/20 hover:bg-brand hover:text-white transition"
                      >
                        Take Ticket
                      </button>
                    ) : isAssignedToMe ? (
                      <span className="inline-flex items-center gap-1 text-xs text-status-success font-semibold">
                        <Check className="w-3.5 h-3.5" /> Yours
                      </span>
                    ) : (
                      <button
                        onClick={() => onSelectTicket(t.id)}
                        className="text-text-muted hover:text-text-primary p-1 rounded-control"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
