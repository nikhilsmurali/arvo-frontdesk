import React, { useState } from 'react';
import { X, PlusCircle, AlertCircle } from 'lucide-react';
import { createTicket } from '../api';
import { Ticket } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onTicketCreated: (ticket: Ticket) => void;
}

export const CreateTicketModal: React.FC<Props> = ({ isOpen, onClose, onTicketCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const created = await createTicket({
        title,
        description,
        customer_name: customerName,
        customer_email: customerEmail,
        priority
      });
      onTicketCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 backdrop-blur-xs p-4">
      <div className="bg-surface rounded-card shadow-modal max-w-lg w-full overflow-hidden border border-border-light">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light bg-surface-muted">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-tile bg-brand-tile flex items-center justify-center text-brand">
              <PlusCircle className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-text-primary text-base">New Support Ticket</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1.5 rounded-control transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-status-error/10 text-status-error text-xs font-medium rounded-control border border-status-error/20">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
              Customer Name
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Acme Corporation"
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-control text-sm text-text-primary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
              Customer Email
            </label>
            <input
              type="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="e.g. admin@acme.com"
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-control text-sm text-text-primary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
              Ticket Subject / Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the issue"
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-control text-sm text-text-primary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
              Priority & SLA Tier
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-control text-sm font-medium text-text-primary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition"
            >
              <option value="URGENT">🔴 Urgent (Reply: 2 hrs | Fix: Same working day)</option>
              <option value="MEDIUM">🟡 Medium (Reply: 4.5 hrs | Fix: 3 working days)</option>
              <option value="LOW">⚪ Low (Reply: 1 working day | Fix: 1 working week)</option>
            </select>
            <p className="text-[11px] text-text-muted mt-1.5">
              *Business hours only (9:30 AM - 6:30 PM, Mon-Fri). Weekends & Holidays excluded.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
              Detailed Description
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the problem, error messages, and steps to reproduce..."
              className="w-full p-3 bg-surface border border-border rounded-control text-sm text-text-primary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-light">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-dark rounded-control shadow-sm disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Creating...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
