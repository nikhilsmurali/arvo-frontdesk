import React, { useState } from 'react';
import {
  TicketDetail as TicketDetailType, Agent, TicketMessage, TicketEvent
} from '../types';
import {
  claimTicket, postMessage, updateTicketStatus, updateTicketPriority
} from '../api';
import { SLABadge, PriorityBadge } from './SLABadge';
import {
  User, Clock, Lock, Send, AlertTriangle, ShieldCheck, CheckCircle2,
  Calendar, Info, RefreshCw, ChevronDown, MessageSquare, History, Activity
} from 'lucide-react';

interface Props {
  ticket: TicketDetailType;
  currentAgent: Agent;
  onTicketUpdated: (updated: TicketDetailType) => void;
  onClose: () => void;
}

export const TicketDetail: React.FC<Props> = ({
  ticket,
  currentAgent,
  onTicketUpdated,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'conversation' | 'audit' | 'sla'>('conversation');
  const [messageBody, setMessageBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<string>(ticket.priority);
  const [priorityReason, setPriorityReason] = useState('');

  const isAssignedToMe = ticket.assigned_agent_id === currentAgent.id;

  const handleClaim = async () => {
    setClaimError(null);
    try {
      const updated = await claimTicket(ticket.id, currentAgent.id, ticket.version);
      onTicketUpdated(updated);
    } catch (err: any) {
      setClaimError(err.message || 'Failed to claim ticket');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim()) return;
    setIsSending(true);
    try {
      const updated = await postMessage(ticket.id, currentAgent.id, messageBody.trim(), isInternal);
      setMessageBody('');
      onTicketUpdated(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to post message');
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const updated = await updateTicketStatus(ticket.id, currentAgent.id, newStatus);
      onTicketUpdated(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handlePrioritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await updateTicketPriority(
        ticket.id,
        currentAgent.id,
        selectedPriority,
        priorityReason || 'Agent manual priority adjustment'
      );
      setPriorityModalOpen(false);
      onTicketUpdated(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to change priority');
    }
  };

  return (
    <div className="bg-surface rounded-card border border-border-light shadow-card overflow-hidden flex flex-col h-full max-h-[calc(100vh-140px)]">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-border-light bg-surface-muted flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-semibold bg-surface-nested text-text-primary px-2 py-0.5 rounded-control border border-border">
              {ticket.ticket_number}
            </span>
            <PriorityBadge priority={ticket.priority} />
            <SLABadge ticket={ticket} />
            <span className="text-xs text-text-muted font-mono">v{ticket.version}</span>
          </div>
          <h2 className="text-base font-semibold text-text-primary">{ticket.title}</h2>
          <div className="text-xs text-text-secondary flex items-center gap-2 mt-0.5">
            <span>Customer: <strong>{ticket.customer_name}</strong> ({ticket.customer_email})</span>
            <span>•</span>
            <span>Created: {new Date(ticket.created_at).toLocaleString()}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Claim Button */}
          {!ticket.assigned_agent_id ? (
            <button
              onClick={handleClaim}
              className="px-4 py-2 bg-brand hover:bg-brand-dark text-white font-medium text-xs rounded-control shadow-sm transition flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              Take This Ticket
            </button>
          ) : isAssignedToMe ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-status-success/10 text-status-success border border-status-success/25 rounded-control text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Assigned to You
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-nested text-text-secondary border border-border rounded-control text-xs font-medium">
              <Lock className="w-3.5 h-3.5 text-text-muted" />
              Claimed by {ticket.assigned_agent?.name || 'Another Agent'}
            </span>
          )}

          {/* Change Status */}
          <select
            value={ticket.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-1.5 bg-surface border border-border rounded-control text-xs font-medium text-text-primary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition shadow-sm"
          >
            <option value="NEW">Status: New</option>
            <option value="IN_PROGRESS">Status: In Progress</option>
            <option value="WAITING_ON_CUSTOMER">Status: Waiting on Customer (Pauses SLA)</option>
            <option value="RESOLVED">Status: Resolved</option>
            <option value="CLOSED">Status: Closed</option>
          </select>

          {/* Change Priority */}
          <button
            onClick={() => {
              setSelectedPriority(ticket.priority);
              setPriorityModalOpen(true);
            }}
            className="px-3 py-1.5 bg-surface border border-border hover:bg-surface-muted text-text-primary text-xs font-medium rounded-control shadow-sm transition"
          >
            Change Priority
          </button>
        </div>
      </div>

      {/* Concurrency Error Banner (INC-0291) */}
      {claimError && (
        <div className="bg-status-error/10 border-b border-status-error/20 px-6 py-2.5 flex items-center gap-2.5 text-status-error text-xs font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{claimError}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-border-light bg-surface px-6">
        <button
          onClick={() => setActiveTab('conversation')}
          className={`py-3 px-4 font-semibold text-xs flex items-center gap-2 border-b-2 transition ${
            activeTab === 'conversation'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Messages & Notes ({ticket.messages.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 px-4 font-semibold text-xs flex items-center gap-2 border-b-2 transition ${
            activeTab === 'audit'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <History className="w-4 h-4" />
          Audit Timeline ({ticket.audit_events.length})
        </button>
        <button
          onClick={() => setActiveTab('sla')}
          className={`py-3 px-4 font-semibold text-xs flex items-center gap-2 border-b-2 transition ${
            activeTab === 'sla'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Activity className="w-4 h-4" />
          SLA Diagnostics
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-surface-page">
        {/* Tab 1: Conversation & Notes */}
        {activeTab === 'conversation' && (
          <div className="space-y-4">
            {ticket.messages.map((m) => {
              const isAgent = m.sender_type === 'AGENT';
              const isNote = m.is_internal;

              return (
                <div
                  key={m.id}
                  className={`rounded-tile p-4 border transition ${
                    isNote
                      ? 'bg-status-warning/10 border-status-warning/30 text-text-primary shadow-sm'
                      : isAgent
                      ? 'bg-brand-active border-brand/20 text-text-primary ml-6 md:ml-12 shadow-sm'
                      : 'bg-surface border-border-light text-text-primary mr-6 md:mr-12 shadow-card'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary">{m.sender_name}</span>
                      <span className="text-text-muted">({m.sender_type})</span>
                      {isNote && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-warning/20 text-amber-900 uppercase tracking-wide">
                          <Lock className="w-3 h-3" /> Internal Team Note (Hidden from Customer)
                        </span>
                      )}
                      {!isNote && isAgent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand/10 text-brand">
                          Public Reply Sent to Customer
                        </span>
                      )}
                    </div>
                    <span className="text-text-muted font-mono text-[11px]">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              );
            })}

            {/* Composer Box */}
            <form onSubmit={handleSendMessage} className="mt-6 bg-surface border border-border-light rounded-card p-5 shadow-card">
              <div className="flex items-center justify-between mb-3 border-b border-border-subtle pb-2.5">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="msg_type"
                      checked={!isInternal}
                      onChange={() => setIsInternal(false)}
                      className="text-brand focus:ring-brand accent-[#148F86]"
                    />
                    <span className={!isInternal ? 'text-brand font-bold' : 'text-text-secondary'}>
                      Public Reply (Customer will see this)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="msg_type"
                      checked={isInternal}
                      onChange={() => setIsInternal(true)}
                      className="text-amber-600 focus:ring-amber-500 accent-[#F7B11B]"
                    />
                    <span className={isInternal ? 'text-amber-800 font-bold flex items-center gap-1' : 'text-text-secondary flex items-center gap-1'}>
                      <Lock className="w-3.5 h-3.5" />
                      Internal Team Note (Private - Arvo only)
                    </span>
                  </label>
                </div>
              </div>

              {isInternal && (
                <div className="mb-2.5 p-2.5 bg-status-warning/10 border border-status-warning/25 rounded-control text-xs text-amber-900 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                  <span>INC-0304 Guard: This note is strictly confidential and will NEVER be shown in customer portal, customer APIs, or exports.</span>
                </div>
              )}

              <textarea
                rows={3}
                required
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={
                  isInternal
                    ? 'Write a private note for the team (investigation notes, escalation status)...'
                    : 'Write a response to the customer...'
                }
                className={`w-full p-3 border rounded-control text-sm focus:outline-none transition ${
                  isInternal
                    ? 'border-status-warning/30 bg-status-warning/5 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                    : 'border-border bg-surface focus:border-brand focus:ring-1 focus:ring-brand'
                }`}
              />

              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-text-muted">
                  Sending as: <strong>{currentAgent.name}</strong> ({currentAgent.role})
                </span>
                <button
                  type="submit"
                  disabled={isSending || !messageBody.trim()}
                  className={`px-5 py-2 text-xs font-medium rounded-control text-white shadow-sm flex items-center gap-1.5 transition disabled:opacity-50 ${
                    isInternal
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-brand hover:bg-brand-dark'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSending
                    ? 'Submitting...'
                    : isInternal
                    ? 'Add Internal Team Note'
                    : 'Send Public Reply to Customer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Audit Timeline (INC-0318) */}
        {activeTab === 'audit' && (
          <div className="space-y-3">
            <div className="p-3 bg-brand-active border border-brand/20 rounded-control text-xs text-text-shell flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand flex-shrink-0" />
              <span>
                <strong>INC-0318 Proof:</strong> Immutable, append-only audit trail. Every event records who did what, when it happened, and cannot be altered or deleted.
              </span>
            </div>

            <div className="relative pl-6 border-l-2 border-border-light space-y-4">
              {ticket.audit_events.map((ev) => (
                <div key={ev.id} className="relative">
                  {/* Dot */}
                  <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-brand border-2 border-white shadow-sm" />
                  <div className="bg-surface p-3.5 rounded-tile border border-border-light shadow-card">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary">{ev.action}</span>
                        <span className="text-text-muted">•</span>
                        <span className="text-text-secondary">Actor: <strong>{ev.actor_name}</strong> ({ev.actor_type})</span>
                      </div>
                      <span className="text-text-muted font-mono text-[11px]">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-text-primary">{ev.details}</div>
                    {ev.metadata_json && (
                      <div className="mt-1 text-[11px] font-mono bg-surface-muted text-text-secondary p-1.5 rounded-control border border-border-subtle">
                        {ev.metadata_json}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: SLA Diagnostics */}
        {activeTab === 'sla' && (
          <div className="bg-surface rounded-card border border-border-light p-6 space-y-4 shadow-card">
            <h4 className="font-semibold text-text-primary text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand" />
              Arvo Business Hours SLA Engine Rules
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-surface-muted p-3.5 rounded-tile border border-border-light space-y-1">
                <span className="font-semibold text-text-primary block">Working Schedule:</span>
                <p className="text-text-secondary">9:30 AM to 6:30 PM (9.0 working hours / day)</p>
                <p className="text-text-secondary">Monday to Friday only (Weekends & Festival Holidays excluded)</p>
              </div>

              <div className="bg-surface-muted p-3.5 rounded-tile border border-border-light space-y-1">
                <span className="font-semibold text-text-primary block">Customer Waiting Clock Pause:</span>
                <p className="text-text-secondary">When status is WAITING_ON_CUSTOMER, the clock pauses.</p>
                <p className="text-text-secondary">Total Paused Business Minutes: <strong>{ticket.total_paused_minutes} mins</strong></p>
              </div>

              <div className="bg-surface-muted p-3.5 rounded-tile border border-border-light space-y-1">
                <span className="font-semibold text-text-primary block">First Response SLA:</span>
                <p className="text-text-secondary">Target: {new Date(ticket.first_response_due_at).toLocaleString()}</p>
                <p className="text-text-secondary">
                  Status:{' '}
                  {ticket.first_response_at ? (
                    <span className="text-status-success font-semibold">
                      Responded at {new Date(ticket.first_response_at).toLocaleString()}
                    </span>
                  ) : ticket.first_response_breached ? (
                    <span className="text-status-error font-semibold">Breached / Late</span>
                  ) : (
                    <span className="text-brand font-semibold">Pending response</span>
                  )}
                </p>
              </div>

              <div className="bg-surface-muted p-3.5 rounded-tile border border-border-light space-y-1">
                <span className="font-semibold text-text-primary block">Resolution SLA:</span>
                <p className="text-text-secondary">Target: {new Date(ticket.resolution_due_at).toLocaleString()}</p>
                <p className="text-text-secondary">
                  Status:{' '}
                  {ticket.resolved_at ? (
                    <span className="text-status-success font-semibold">
                      Resolved at {new Date(ticket.resolved_at).toLocaleString()}
                    </span>
                  ) : ticket.resolution_breached ? (
                    <span className="text-status-error font-semibold">Resolution Breached</span>
                  ) : (
                    <span className="text-brand font-semibold">On track</span>
                  )}
                </p>
              </div>
            </div>

            <div className="p-3 bg-brand-active border border-brand/20 rounded-control text-xs text-text-shell">
              <strong>Section 3 Question Solved:</strong> When priority changes to Urgent mid-flight, remaining allowance is calculated against elapsed business hours. If elapsed time exceeds 2 hours, it triggers immediate first-response breach alert.
            </div>
          </div>
        )}
      </div>

      {/* Priority Change Modal */}
      {priorityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-card shadow-modal max-w-md w-full p-6 border border-border-light">
            <h3 className="font-semibold text-text-primary text-base mb-1.5">Update Ticket Priority</h3>
            <p className="text-xs text-text-secondary mb-4">
              Answers Meeting Question: Updating priority recalculates First Response & Resolution SLA targets against elapsed active business hours.
            </p>

            <form onSubmit={handlePrioritySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Select Priority</label>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full p-2.5 bg-surface border border-border rounded-control text-sm text-text-primary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition"
                >
                  <option value="URGENT">🔴 Urgent (2 working hrs reply | Same day fix)</option>
                  <option value="MEDIUM">🟡 Medium (4.5 working hrs reply | 3 working days fix)</option>
                  <option value="LOW">⚪ Low (1 working day reply | 1 working week fix)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Reason for Adjustment</label>
                <input
                  type="text"
                  required
                  value={priorityReason}
                  onChange={(e) => setPriorityReason(e.target.value)}
                  placeholder="e.g. Production outage reported by client"
                  className="w-full p-2.5 bg-surface border border-border rounded-control text-sm text-text-primary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPriorityModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-dark rounded-control shadow-sm transition"
                >
                  Update & Recalculate SLA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
