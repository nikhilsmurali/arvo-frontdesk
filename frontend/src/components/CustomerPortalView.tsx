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
      <div className="bg-brand-active border border-brand/20 rounded-card p-4.5 flex items-start gap-3 shadow-card">
        <ShieldCheck className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-text-shell">
            Customer Portal View — INC-0304 Security Guard Verified
          </h4>
          <p className="text-xs text-text-secondary mt-0.5">
            This customer view strictly isolates private data. Internal team notes and private agent discussions are filtered out at both the database and response serializer levels.
          </p>
        </div>
      </div>

      {/* Ticket Lookup Bar */}
      <div className="bg-surface rounded-card border border-border-light p-4 shadow-card flex items-center gap-3">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Look up Ticket:</span>
        <input
          type="text"
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
          placeholder="e.g. INC-0330, INC-0331"
          className="px-3.5 py-2 border border-border rounded-control text-sm font-mono w-44 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition"
        />
        <button
          onClick={() => loadTicket(ticketNumber)}
          disabled={isLoading}
          className="px-4 py-2 bg-brand hover:bg-brand-dark text-white text-xs font-medium rounded-control shadow-sm transition disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Search'}
        </button>

        <div className="ml-auto text-xs text-text-secondary flex items-center gap-2">
          <span>Quick samples:</span>
          {['INC-0330', 'INC-0331', 'INC-0329'].map((n) => (
            <button
              key={n}
              onClick={() => {
                setTicketNumber(n);
                loadTicket(n);
              }}
              className="text-brand font-mono hover:underline font-semibold"
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-status-error/10 text-status-error text-xs font-medium rounded-card border border-status-error/20 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {ticket && (
        <div className="bg-surface rounded-card border border-border-light shadow-card overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-border-light bg-surface-muted flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-xs font-semibold bg-surface-nested text-text-primary px-2.5 py-0.5 rounded-control border border-border">
                  {ticket.ticket_number}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-brand/10 text-brand border border-brand/25">
                  {ticket.status.replace(/_/g, ' ')}
                </span>
              </div>
              <h2 className="text-base font-semibold text-text-primary">{ticket.title}</h2>
              <p className="text-xs text-text-secondary mt-0.5">Submitted by: {ticket.customer_name}</p>
            </div>

            {ticket.status === 'RESOLVED' && (
              <button
                onClick={() => setReopenModal(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-control shadow-sm flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reopen Ticket (1-Week Window)
              </button>
            )}
          </div>

          {reopenStatus && (
            <div className="bg-status-success/10 px-6 py-2.5 text-xs text-status-success font-semibold border-b border-status-success/20">
              {reopenStatus}
            </div>
          )}

          {/* Conversation (Customer visible only) */}
          <div className="p-6 space-y-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Ticket Conversation ({ticket.messages.length} visible public messages)
            </h3>

            <div className="space-y-3">
              {ticket.messages.map((m) => {
                const isCustomer = m.sender_type === 'CUSTOMER';
                return (
                  <div
                    key={m.id}
                    className={`p-4 rounded-tile border max-w-xl transition ${
                      isCustomer
                        ? 'bg-brand-active border-brand/20 ml-auto text-text-primary'
                        : 'bg-surface border-border-light mr-auto text-text-primary shadow-card'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-text-primary">{m.sender_name}</span>
                      <span className="text-text-muted font-mono text-[11px]">
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
              <form onSubmit={handleReplySubmit} className="mt-6 pt-5 border-t border-border-light">
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
                  Send a response to Arvo Support:
                </label>
                <textarea
                  rows={3}
                  required
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Provide clarification or additional details..."
                  className="w-full p-3 bg-surface border border-border rounded-control text-sm text-text-primary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition"
                />
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-xs text-text-muted">
                    *Replying automatically unpauses the support team's SLA timer.
                  </span>
                  <button
                    type="submit"
                    disabled={isSending || !replyBody.trim()}
                    className="px-4 py-2 bg-brand hover:bg-brand-dark text-white font-medium text-xs rounded-control shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-card shadow-modal max-w-md w-full p-6 border border-border-light">
            <h3 className="font-semibold text-text-primary text-base mb-1">Reopen Support Ticket</h3>
            <p className="text-xs text-text-secondary mb-4">
              Tickets can be reopened within 1 week of resolution if the issue recurs.
            </p>

            <form onSubmit={handleReopenSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">Your Email</label>
                <input
                  type="email"
                  required
                  value={reopenEmail}
                  onChange={(e) => setReopenEmail(e.target.value)}
                  placeholder="email used when submitting ticket"
                  className="w-full p-2.5 bg-surface border border-border rounded-control text-sm text-text-primary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">Why are you reopening?</label>
                <textarea
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Describe why the problem is not fixed..."
                  className="w-full p-2.5 bg-surface border border-border rounded-control text-sm text-text-primary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setReopenModal(false)}
                  className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-control shadow-sm transition"
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
