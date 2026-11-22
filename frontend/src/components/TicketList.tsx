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
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h4 className="font-semibold text-slate-700">No tickets found</h4>
        <p className="text-sm text-slate-500 mt-1">
          No tickets match the currently active filters.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4">Ticket</th>
              <th className="py-3 px-4">Subject & Customer</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">SLA Clock</th>
              <th className="py-3 px-4">Assigned Agent</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((t) => {
              const isSelected = selectedTicketId === t.id;
              const isAssignedToMe = t.assigned_agent_id === currentAgent.id;
              const isClaimedByOther = t.assigned_agent_id !== null && !isAssignedToMe;

              return (
                <tr
                  key={t.id}
                  onClick={() => onSelectTicket(t.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50/70'
                      : t.is_late
                      ? 'bg-rose-50/30 hover:bg-rose-50/60'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-700 whitespace-nowrap">
                    {t.ticket_number}
                  </td>
                  <td className="py-3.5 px-4 max-w-xs md:max-w-md">
                    <div className="font-semibold text-slate-900 truncate">{t.title}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
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
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        t.status === 'NEW'
                          ? 'bg-purple-100 text-purple-700'
                          : t.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-700'
                          : t.status === 'WAITING_ON_CUSTOMER'
                          ? 'bg-amber-100 text-amber-800'
                          : t.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
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
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isAssignedToMe ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {t.assigned_agent.name[0]}
                        </div>
                        <span className="text-xs text-slate-700 font-medium">
                          {t.assigned_agent.name} {isAssignedToMe && '(You)'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {!t.assigned_agent_id ? (
                      <button
                        onClick={() => onQuickClaim(t)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition shadow-sm"
                      >
                        Take Ticket
                      </button>
                    ) : isAssignedToMe ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                        <Check className="w-3.5 h-3.5" /> Yours
                      </span>
                    ) : (
                      <button
                        onClick={() => onSelectTicket(t.id)}
                        className="text-slate-400 hover:text-slate-600 p-1"
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

