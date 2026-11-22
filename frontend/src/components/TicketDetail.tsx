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
  const isClaimedByOther = ticket.assigned_agent_id !== null && !isAssignedToMe;

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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full max-h-[calc(100vh-140px)]">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
              {ticket.ticket_number}
            </span>
            <PriorityBadge priority={ticket.priority} />
            <SLABadge ticket={ticket} />
            <span className="text-xs text-slate-400 font-mono">v{ticket.version}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">{ticket.title}</h2>
          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              <User className="w-4 h-4" />
              Take This Ticket
            </button>
          ) : isAssignedToMe ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Assigned to You
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Claimed by {ticket.assigned_agent?.name || 'Another Agent'}
            </span>
          )}

          {/* Change Status */}
          <select
            value={ticket.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
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
            className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition"
          >
            Change Priority
          </button>
        </div>
      </div>

      {/* Concurrency Error Banner (INC-0291) */}
      {claimError && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex items-center gap-3 text-rose-800 text-xs font-medium">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{claimError}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-6">
        <button
          onClick={() => setActiveTab('conversation')}
          className={`py-3 px-4 font-semibold text-xs flex items-center gap-2 border-b-2 transition ${
            activeTab === 'conversation'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Messages & Notes ({ticket.messages.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 px-4 font-semibold text-xs flex items-center gap-2 border-b-2 transition ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          Audit Timeline ({ticket.audit_events.length})
        </button>
        <button
          onClick={() => setActiveTab('sla')}
          className={`py-3 px-4 font-semibold text-xs flex items-center gap-2 border-b-2 transition ${
            activeTab === 'sla'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          SLA Diagnostics
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
        {/* Tab 1: Conversation & Notes */}
        {activeTab === 'conversation' && (
          <div className="space-y-4">
            {ticket.messages.map((m) => {
              const isAgent = m.sender_type === 'AGENT';
              const isNote = m.is_internal;

              return (
                <div
                  key={m.id}
                  className={`rounded-xl p-4 border transition ${
                    isNote
                      ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-sm'
                      : isAgent
                      ? 'bg-blue-50/60 border-blue-200 text-slate-900 ml-6 md:ml-12'
                      : 'bg-white border-slate-200 text-slate-900 mr-6 md:mr-12 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{m.sender_name}</span>
                      <span className="text-slate-400">({m.sender_type})</span>
                      {isNote && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 uppercase tracking-wide">
                          <Lock className="w-3 h-3" /> Internal Team Note (Hidden from Customer)
                        </span>
                      )}
                      {!isNote && isAgent && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                          Public Reply Sent to Customer
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              );
            })}

            {/* Composer Box */}
            <form onSubmit={handleSendMessage} className="mt-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="msg_type"
                      checked={!isInternal}
                      onChange={() => setIsInternal(false)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className={!isInternal ? 'text-blue-700 font-bold' : 'text-slate-600'}>
                      Public Reply (Customer will see this)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="msg_type"
                      checked={isInternal}
                      onChange={() => setIsInternal(true)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className={isInternal ? 'text-amber-800 font-bold flex items-center gap-1' : 'text-slate-600 flex items-center gap-1'}>
                      <Lock className="w-3.5 h-3.5" />
                      Internal Team Note (Private - Arvo only)
                    </span>
                  </label>
                </div>
              </div>

              {isInternal && (
                <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
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
                className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                  isInternal
                    ? 'border-amber-200 bg-amber-50/30 focus:ring-amber-500'
                    : 'border-slate-200 focus:ring-blue-500'
                }`}
              />

              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-slate-400">
                  Sending as: <strong>{currentAgent.name}</strong> ({currentAgent.role})
                </span>
                <button
                  type="submit"
                  disabled={isSending || !messageBody.trim()}
                  className={`px-5 py-2 text-xs font-bold rounded-lg text-white shadow-sm flex items-center gap-1.5 transition disabled:opacity-50 ${
                    isInternal
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-blue-600 hover:bg-blue-700'
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
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>
                <strong>INC-0318 Proof:</strong> Immutable, append-only audit trail. Every event records who did what, when it happened, and cannot be altered or deleted.
              </span>
            </div>

            <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
              {ticket.audit_events.map((ev) => (
                <div key={ev.id} className="relative">
                  {/* Dot */}
                  <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-sm" />
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{ev.action}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600">Actor: <strong>{ev.actor_name}</strong> ({ev.actor_type})</span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-slate-700">{ev.details}</div>
                    {ev.metadata_json && (
                      <div className="mt-1 text-[11px] font-mono bg-slate-50 text-slate-600 p-1.5 rounded border border-slate-100">
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
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Arvo Business Hours SLA Engine Rules
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                <span className="font-semibold text-slate-700 block">Working Schedule:</span>
                <p className="text-slate-600">9:30 AM to 6:30 PM (9.0 working hours / day)</p>
                <p className="text-slate-600">Monday to Friday only (Weekends & Festival Holidays excluded)</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                <span className="font-semibold text-slate-700 block">Customer Waiting Clock Pause:</span>
                <p className="text-slate-600">When status is WAITING_ON_CUSTOMER, the clock pauses.</p>
                <p className="text-slate-600">Total Paused Business Minutes: <strong>{ticket.total_paused_minutes} mins</strong></p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                <span className="font-semibold text-slate-700 block">First Response SLA:</span>
                <p className="text-slate-600">Target: {new Date(ticket.first_response_due_at).toLocaleString()}</p>
                <p className="text-slate-600">
                  Status:{' '}
                  {ticket.first_response_at ? (
                    <span className="text-emerald-700 font-bold">
                      Responded at {new Date(ticket.first_response_at).toLocaleString()}
                    </span>
                  ) : ticket.first_response_breached ? (
                    <span className="text-rose-700 font-bold">Breached / Late</span>
                  ) : (
                    <span className="text-blue-700 font-bold">Pending response</span>
                  )}
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                <span className="font-semibold text-slate-700 block">Resolution SLA:</span>
                <p className="text-slate-600">Target: {new Date(ticket.resolution_due_at).toLocaleString()}</p>
                <p className="text-slate-600">
                  Status:{' '}
                  {ticket.resolved_at ? (
                    <span className="text-emerald-700 font-bold">
                      Resolved at {new Date(ticket.resolved_at).toLocaleString()}
                    </span>
                  ) : ticket.resolution_breached ? (
                    <span className="text-rose-700 font-bold">Resolution Breached</span>
                  ) : (
                    <span className="text-blue-700 font-bold">On track</span>
                  )}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <strong>Section 3 Question Solved:</strong> When priority changes to Urgent mid-flight, remaining allowance is calculated against elapsed business hours. If elapsed time exceeds 2 hours, it triggers immediate first-response breach alert.
            </div>
          </div>
        )}
      </div>

      {/* Priority Change Modal */}
      {priorityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-2">Update Ticket Priority</h3>
            <p className="text-xs text-slate-600 mb-4">
              Answers Meeting Question: Updating priority recalculates First Response & Resolution SLA targets against elapsed active business hours.
            </p>

            <form onSubmit={handlePrioritySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Priority</label>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="URGENT">🔴 Urgent (2 working hrs reply | Same day fix)</option>
                  <option value="MEDIUM">🟡 Medium (4.5 working hrs reply | 3 working days fix)</option>
                  <option value="LOW">⚪ Low (1 working day reply | 1 working week fix)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for Adjustment</label>
                <input
                  type="text"
                  required
                  value={priorityReason}
                  onChange={(e) => setPriorityReason(e.target.value)}
                  placeholder="e.g. Production outage reported by client"
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPriorityModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
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

