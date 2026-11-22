import React, { useState, useEffect } from 'react';
import { CustomerTicket } from '../types';
import { fetchCustomerTicket, postCustomerReply, requestCustomerReopen } from '../api';
import { ShieldCheck, Send, RefreshCw, AlertCircle, CheckCircle, RotateCcw, Lock } from 'lucide-react';

interface Props {
  sampleTicketNumber?: string;
}

export const CustomerPortalView: React.FC<Props> = ({ sampleTicketNumber = 'INC-0331' }) => {
  const [ticketNumber, setTicketNumber] = useState(sampleTicketNumber);
  const [ticket, setTicket] = useState<CustomerTicket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [reopenModal, setReopenModal] = useState(false);
  const [reopenEmail, setReopenEmail] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [reopenStatus, setReopenStatus] = useState<string | null>(null);

  const loadTicket = async (numToLoad: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerTicket(numToLoad);
      setTicket(data);
    } catch (err: any) {
      setError(err.message || 'Ticket not found');
      setTicket(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (sampleTicketNumber) {
      loadTicket(sampleTicketNumber);
    }
  }, [sampleTicketNumber]);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() || !ticket) return;
    setIsSending(true);
    try {
      const updated = await postCustomerReply(ticket.ticket_number, replyBody.trim());
      setTicket(updated);
      setReplyBody('');
    } catch (err: any) {
      alert(err.message || 'Failed to submit reply');
    } finally {
      setIsSending(false);
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    try {
      const updated = await requestCustomerReopen(ticket.ticket_number, reopenEmail, reopenReason);
      setTicket(updated);
      setReopenModal(false);
      setReopenStatus('Ticket successfully reopened!');
    } catch (err: any) {
      alert(err.message || 'Failed to reopen ticket');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* INC-0304 Notice Card */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-emerald-950">
            Customer Portal View — INC-0304 Security Guard Verified
          </h4>
          <p className="text-xs text-emerald-800 mt-0.5">
            This customer view strictly isolates private data. Internal team notes and private agent discussions are filtered out at both the database and response serializer levels.
          </p>
        </div>
      </div>

      {/* Ticket Lookup Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase">Look up Ticket:</span>
        <input
          type="text"
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
          placeholder="e.g. INC-0330, INC-0331"
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono w-44 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          onClick={() => loadTicket(ticketNumber)}
          disabled={isLoading}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Search'}
        </button>

        <div className="ml-auto text-xs text-slate-500 flex items-center gap-2">
          <span>Quick samples:</span>
          {['INC-0330', 'INC-0331', 'INC-0329'].map((n) => (
            <button
              key={n}
              onClick={() => {
                setTicketNumber(n);
                loadTicket(n);
              }}
              className="text-blue-600 font-mono hover:underline"
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {ticket && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold bg-slate-200 px-2 py-0.5 rounded">
                  {ticket.ticket_number}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                  {ticket.status.replace(/_/g, ' ')}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">{ticket.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">Submitted by: {ticket.customer_name}</p>
            </div>

            {ticket.status === 'RESOLVED' && (
              <button
                onClick={() => setReopenModal(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-4 h-4" />
                Reopen Ticket (1-Week Window)
              </button>
            )}
          </div>

          {reopenStatus && (
            <div className="bg-emerald-50 px-6 py-2 text-xs text-emerald-800 font-semibold border-b border-emerald-200">
              {reopenStatus}
            </div>
          )}

          {/* Conversation (Customer visible only) */}
          <div className="p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Ticket Conversation ({ticket.messages.length} visible public messages)
            </h3>

            <div className="space-y-3">
              {ticket.messages.map((m) => {
                const isCustomer = m.sender_type === 'CUSTOMER';
                return (
                  <div
                    key={m.id}
                    className={`p-4 rounded-xl border max-w-xl ${
                      isCustomer
                        ? 'bg-blue-50/70 border-blue-200 ml-auto text-slate-900'
                        : 'bg-white border-slate-200 mr-auto text-slate-900 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-800">{m.sender_name}</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                  </div>
                );
              })}
            </div>

            {/* Reply Input for customer */}
            {ticket.status !== 'CLOSED' && (
              <form onSubmit={handleReplySubmit} className="mt-6 pt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Send a response to Arvo Support:
                </label>
                <textarea
                  rows={3}
                  required
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Provide clarification or additional details..."
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-500">
                    *Replying automatically unpauses the support team's SLA timer.
                  </span>
                  <button
                    type="submit"
                    disabled={isSending || !replyBody.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isSending ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Customer Reopen Modal */}
      {reopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-1">Reopen Support Ticket</h3>
            <p className="text-xs text-slate-500 mb-4">
              Tickets can be reopened within 1 week of resolution if the issue recurs.
            </p>

            <form onSubmit={handleReopenSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Your Email</label>
                <input
                  type="email"
                  required
                  value={reopenEmail}
                  onChange={(e) => setReopenEmail(e.target.value)}
                  placeholder="email used when submitting ticket"
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Why are you reopening?</label>
                <textarea
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Describe why the problem is not fixed..."
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReopenModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
                >
                  Confirm Reopen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
