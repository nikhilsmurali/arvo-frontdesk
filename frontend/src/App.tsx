import React, { useState, useEffect } from 'react';
import { Agent, Ticket, TicketDetail as TicketDetailType, TicketStats } from './types';
import { fetchAgents, fetchStats, fetchTickets, fetchTicketDetail, sweepSLA, claimTicket } from './api';
import { TicketList } from './components/TicketList';
import { TicketDetail } from './components/TicketDetail';
import { CreateTicketModal } from './components/CreateTicketModal';
import { CustomerPortalView } from './components/CustomerPortalView';
import {
  Headphones, Users, PlusCircle, AlertTriangle, Clock, PauseCircle,
  ShieldCheck, RefreshCw, Layers, CheckCircle2, Search, SlidersHorizontal, Eye
} from 'lucide-react';

export function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [activeView, setActiveView] = useState<'workbench' | 'customer'>('workbench');

  // Stats & Tickets
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<TicketDetailType | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'late' | 'waiting' | 'my' | 'unassigned'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const loadedAgents = await fetchAgents();
        setAgents(loadedAgents);
        if (loadedAgents.length > 0) {
          setCurrentAgent(loadedAgents[0]); // Default to Meera (Support Lead)
        }
      } catch (err) {
        console.error('Failed to load agents', err);
      }
    }
    init();
  }, []);

  const loadData = async () => {
    if (!currentAgent) return;
    setIsLoading(true);
    try {
      const statsData = await fetchStats();
      setStats(statsData);

      const params: any = {
        priority: priorityFilter,
        search: searchQuery
      };

      if (activeTab === 'late') {
        params.isLateOnly = true;
      } else if (activeTab === 'waiting') {
        params.isWaitingOnly = true;
      } else if (activeTab === 'my') {
        params.agentId = currentAgent.id;
      } else if (activeTab === 'unassigned') {
        params.agentId = 0;
      }

      const ticketsData = await fetchTickets(params);
      setTickets(ticketsData);

      // Refresh currently selected ticket if open
      if (selectedTicketId) {
        const detail = await fetchTicketDetail(selectedTicketId);
        setSelectedTicketDetail(detail);
      }
    } catch (err) {
      console.error('Failed to fetch tickets or stats', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentAgent) {
      loadData();
    }
  }, [currentAgent, activeTab, priorityFilter, searchQuery]);

  const handleSelectTicket = async (id: number) => {
    setSelectedTicketId(id);
    try {
      const detail = await fetchTicketDetail(id);
      setSelectedTicketDetail(detail);
    } catch (err: any) {
      alert(err.message || 'Failed to load ticket details');
    }
  };

  const handleQuickClaim = async (ticket: Ticket) => {
    if (!currentAgent) return;
    try {
      const updated = await claimTicket(ticket.id, currentAgent.id, ticket.version);
      showNotice(`Successfully claimed ${ticket.ticket_number}!`);
      loadData();
      setSelectedTicketId(ticket.id);
      setSelectedTicketDetail(updated);
    } catch (err: any) {
      alert(err.message || 'Claim failed');
    }
  };

  const handleRunSweep = async () => {
    try {
      const result = await sweepSLA();
      showNotice(`SLA Sweep complete: Scanned ${result.scanned_tickets} tickets. Auto-closed: ${result.auto_closed_tickets}.`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to run sweep');
    }
  };

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-lg shadow-md">
                F
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white">Frontdesk</span>
                <span className="text-[10px] text-blue-400 font-semibold block uppercase tracking-wider">
                  Arvo Systems Support
                </span>
              </div>
            </div>

            {/* View Switcher Tabs */}
            <div className="hidden md:flex bg-slate-800 p-1 rounded-xl border border-slate-700/60 text-xs">
              <button
                onClick={() => setActiveView('workbench')}
                className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                  activeView === 'workbench'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Support Workbench
              </button>
              <button
                onClick={() => setActiveView('customer')}
                className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                  activeView === 'customer'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Customer Portal (INC-0304 Check)
              </button>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Agent Switcher */}
            {agents.length > 0 && currentAgent && (
              <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                  {currentAgent.name[0]}
                </div>
                <div className="text-left">
                  <select
                    value={currentAgent.id}
                    onChange={(e) => {
                      const found = agents.find((a) => a.id === Number(e.target.value));
                      if (found) setCurrentAgent(found);
                    }}
                    className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id} className="bg-slate-800 text-white">
                        {a.name} ({a.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* SLA Sweep Button */}
            <button
              onClick={handleRunSweep}
              title="Run background SLA engine sweep & auto-close inactive tickets"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              SLA Sweep
            </button>

            {/* Create Ticket */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition"
            >
              <PlusCircle className="w-4 h-4" />
              New Ticket
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {notification && (
        <div className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 text-center shadow-md animate-fade-in">
          {notification}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeView === 'customer' ? (
          <CustomerPortalView sampleTicketNumber={selectedTicketDetail?.ticket_number || 'INC-0331'} />
        ) : (
          <div className="space-y-6">
            {/* Metrics Ribbon */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total</span>
                  <div className="text-xl font-extrabold text-slate-900 mt-0.5">{stats.total_tickets}</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Open Tickets</span>
                  <div className="text-xl font-extrabold text-blue-600 mt-0.5">{stats.open_tickets}</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> SLA Breached
                  </span>
                  <div className="text-xl font-extrabold text-rose-700 mt-0.5">{stats.late_tickets}</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                    <PauseCircle className="w-3 h-3" /> Waiting Customer
                  </span>
                  <div className="text-xl font-extrabold text-amber-800 mt-0.5">
                    {stats.waiting_on_customer_tickets}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-red-200 bg-red-50/40 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">Urgent Problems</span>
                  <div className="text-xl font-extrabold text-red-700 mt-0.5">{stats.urgent_tickets}</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Resolved</span>
                  <div className="text-xl font-extrabold text-emerald-700 mt-0.5">{stats.resolved_tickets}</div>
                </div>
              </div>
            )}

            {/* Filters Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeTab === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Tickets
                </button>
                <button
                  onClick={() => setActiveTab('late')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'late'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Late / Breached ({stats?.late_tickets || 0})
                </button>
                <button
                  onClick={() => setActiveTab('waiting')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'waiting'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  Waiting on Customer ({stats?.waiting_on_customer_tickets || 0})
                </button>
                <button
                  onClick={() => setActiveTab('my')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeTab === 'my'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Assigned to Me
                </button>
                <button
                  onClick={() => setActiveTab('unassigned')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeTab === 'unassigned'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Unassigned
                </button>
              </div>

              {/* Priority & Search */}
              <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="URGENT">Urgent</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tickets..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
                  />
                </div>
              </div>
            </div>

            {/* Split Screen Master-Detail */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className={selectedTicketDetail ? 'lg:col-span-5' : 'lg:col-span-12'}>
                <TicketList
                  tickets={tickets}
                  currentAgent={currentAgent!}
                  selectedTicketId={selectedTicketId}
                  onSelectTicket={handleSelectTicket}
                  onQuickClaim={handleQuickClaim}
                />
              </div>

              {selectedTicketDetail && (
                <div className="lg:col-span-7 sticky top-20">
                  <TicketDetail
                    ticket={selectedTicketDetail}
                    currentAgent={currentAgent!}
                    onTicketUpdated={(updated) => {
                      setSelectedTicketDetail(updated);
                      loadData();
                    }}
                    onClose={() => {
                      setSelectedTicketId(null);
                      setSelectedTicketDetail(null);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Create Ticket Modal */}
      <CreateTicketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTicketCreated={(created) => {
          showNotice(`Ticket ${created.ticket_number} created successfully!`);
          loadData();
          handleSelectTicket(created.id);
        }}
      />
    </div>
  );
}
export default App;
