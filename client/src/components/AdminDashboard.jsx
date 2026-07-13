import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL as API_URL } from '../config/api';

const ADMIN_EMAIL = 'forgeindiaconnect0007@gmail.com';

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, prefix = '', suffix = '' }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = typeof value === 'number' ? value : 0;
    if (end === 0) {
      setDisplayed(0);
      return;
    }
    const duration = 1200;
    const step = Math.ceil(end / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setDisplayed(end); clearInterval(timer); }
      else setDisplayed(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3 ${color}`}>
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/[0.03] blur-xl" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-black text-white tracking-tight">
        {prefix}{displayed.toLocaleString('en-IN')}{suffix}
      </div>
    </div>
  );
}

// ─── Badges ──────────────────────────────────────────────────────────────────
function PlanBadge({ plan }) {
  const colors = {
    Pro: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    Business: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    Free: 'bg-slate-700/40 text-slate-400 border-white/5',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${colors[plan] || colors.Free}`}>
      {plan}
    </span>
  );
}

function StatusBadge({ status }) {
  const colors = {
    Active: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    Inactive: 'bg-slate-700/40 text-slate-500 border-white/5',
    Expired: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${colors[status] || ''}`}>
      {status}
    </span>
  );
}

// ─── Main Admin Component ────────────────────────────────────────────────────
export default function AdminDashboard({ userEmail }) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [searchUsers, setSearchUsers] = useState('');
  const [searchSubs, setSearchSubs] = useState('');

  // ─── Real-time statistics, users, and subscriptions states from MongoDB ───
  const [stats, setStats] = useState({
    totalUsers: 0,
    proUsers: 0,
    businessUsers: 0,
    totalRevenue: 0,
    todayRevenue: 0
  });
  const [users, setUsers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (userEmail !== ADMIN_EMAIL) return;

    const fetchData = async () => {
      setLoadingData(true);
      try {
        const headers = { 'x-admin-email': userEmail };
        
        // 1. Fetch Stats
        const statsRes = await axios.get(`${API_URL}/api/admin/stats`, { headers });
        if (statsRes.data?.success) {
          setStats(statsRes.data.stats);
        }

        // 2. Fetch Users
        const usersRes = await axios.get(`${API_URL}/api/admin/users`, { headers });
        if (usersRes.data?.success) {
          setUsers(usersRes.data.users);
        }

        // 3. Fetch Subscriptions
        const subsRes = await axios.get(`${API_URL}/api/admin/subscriptions`, { headers });
        if (subsRes.data?.success) {
          setSubscriptions(subsRes.data.subscriptions);
        }
      } catch (err) {
        console.error('[Admin Dashboard] Failed to load statistics from DB:', err.message);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [userEmail]);

  // ─── Subscription Plan Form State ───
  const [plans, setPlans] = useState([
    { id: 1, name: 'Pro', monthlyPrice: '₹499', yearlyPrice: '₹4,999', badge: 'Most Popular', color: 'Purple', description: 'Best for Professionals' },
    { id: 2, name: 'Business', monthlyPrice: '₹999', yearlyPrice: '₹9,999', badge: 'Best Value', color: 'Amber', description: 'Best for teams & companies' }
  ]);

  const [showForm, setShowForm] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [planName, setPlanName] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [yearlyPrice, setYearlyPrice] = useState('');
  const [planBadge, setPlanBadge] = useState('');
  const [planColor, setPlanColor] = useState('Purple');
  const [description, setDescription] = useState('');
  const [previewPlan, setPreviewPlan] = useState(null); // Holds plan data if preview modal open

  // ── Access Control ──
  if (userEmail !== ADMIN_EMAIL) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#060814] text-center p-8 gap-6">
        <div className="w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-4xl shadow-xl">
          🚫
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Access Denied</h2>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            This area is restricted to administrators only. Your account does not have permission to access the Admin Dashboard.
          </p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u =>
    (u.name || '').toLowerCase().includes(searchUsers.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchUsers.toLowerCase())
  );

  const filteredSubs = subscriptions.filter(s =>
    (s.user || '').toLowerCase().includes(searchSubs.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(searchSubs.toLowerCase()) ||
    (s.id || '').toLowerCase().includes(searchSubs.toLowerCase())
  );

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'users', label: 'Users' },
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'plans', label: 'Plans' },
  ];

  // ── Plan Action Handlers ──
  const handleOpenAddForm = () => {
    setEditingPlanId(null);
    setPlanName('');
    setMonthlyPrice('');
    setYearlyPrice('');
    setPlanBadge('');
    setPlanColor('Purple');
    setDescription('');
    setShowForm(true);
  };

  const handleOpenEditForm = (p) => {
    setEditingPlanId(p.id);
    setPlanName(p.name);
    setMonthlyPrice(p.monthlyPrice);
    setYearlyPrice(p.yearlyPrice);
    setPlanBadge(p.badge);
    setPlanColor(p.color);
    setDescription(p.description);
    setShowForm(true);
  };

  const handleSavePlan = () => {
    if (!planName || !monthlyPrice || !yearlyPrice) {
      alert('Plan Name, Monthly Price, and Yearly Price are required.');
      return;
    }

    if (editingPlanId !== null) {
      // Edit existing plan
      setPlans(prev => prev.map(p => p.id === editingPlanId ? {
        id: p.id,
        name: planName,
        monthlyPrice,
        yearlyPrice,
        badge: planBadge,
        color: planColor,
        description
      } : p));
    } else {
      // Add new plan
      const newId = plans.length > 0 ? Math.max(...plans.map(p => p.id)) + 1 : 1;
      setPlans(prev => [...prev, {
        id: newId,
        name: planName,
        monthlyPrice,
        yearlyPrice,
        badge: planBadge,
        color: planColor,
        description
      }]);
    }
    setShowForm(false);
  };

  const handleCancelForm = () => {
    setShowForm(false);
  };

  const handlePreview = () => {
    setPreviewPlan({
      name: planName || 'Plan Name Preview',
      monthlyPrice: monthlyPrice || '₹0',
      yearlyPrice: yearlyPrice || '₹0',
      badge: planBadge || 'Preview Badge',
      color: planColor,
      description: description || 'Plan description preview text will go here.'
    });
  };

  const getColorClasses = (colorName) => {
    const map = {
      Purple: { border: 'border-[#7C3AED]', text: 'text-[#A78BFA]', bg: 'bg-[#7C3AED]/20', glow: 'shadow-[0_0_20px_rgba(124,58,237,0.15)]', button: 'from-[#7C3AED] to-[#5B21B6]' },
      Amber: { border: 'border-[#F59E0B]', text: 'text-[#FBBF24]', bg: 'bg-[#F59E0B]/20', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]', button: 'from-[#F59E0B] to-[#B45309]' },
      Cyan: { border: 'border-[#0EA5E9]', text: 'text-[#38BDF8]', bg: 'bg-[#0EA5E9]/20', glow: 'shadow-[0_0_20px_rgba(14,165,233,0.15)]', button: 'from-[#0EA5E9] to-[#0369A1]' },
      Emerald: { border: 'border-[#10B981]', text: 'text-[#34D399]', bg: 'bg-[#10B981]/20', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]', button: 'from-[#10B981] to-[#047857]' },
      Rose: { border: 'border-[#F43F5E]', text: 'text-[#FB7185]', bg: 'bg-[#F43F5E]/20', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]', button: 'from-[#F43F5E] to-[#BE123C]' }
    };
    return map[colorName] || map.Purple;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#060814] admin-dashboard-container" style={{ color: 'var(--text-color)' }}>
      <style>{`
        /* High-specificity dark theme overrides for Admin Dashboard */
        .admin-dashboard-container,
        html:not(.dark) .admin-dashboard-container {
          background-color: #060814 !important;
          color: #E2E8F0 !important;
        }
        
        .admin-dashboard-container .admin-header,
        html:not(.dark) .admin-dashboard-container .admin-header {
          background-color: #0B1020 !important;
          border-color: rgba(255, 255, 255, 0.05) !important;
        }
        
        .admin-dashboard-container aside,
        html:not(.dark) .admin-dashboard-container aside {
          background-color: #0B1020 !important;
          border-color: rgba(255, 255, 255, 0.05) !important;
        }

        .admin-dashboard-container .text-white,
        html:not(.dark) .admin-dashboard-container .text-white {
          color: #ffffff !important;
        }
        
        .admin-dashboard-container .text-slate-400,
        html:not(.dark) .admin-dashboard-container .text-slate-400 {
          color: #94A3B8 !important;
        }

        .admin-dashboard-container .text-violet-300,
        html:not(.dark) .admin-dashboard-container .text-violet-300 {
          color: #C4B5FD !important;
        }

        .admin-dashboard-container .text-emerald-300,
        html:not(.dark) .admin-dashboard-container .text-emerald-300 {
          color: #6EE7B7 !important;
        }

        .admin-dashboard-container .text-amber-300,
        html:not(.dark) .admin-dashboard-container .text-amber-300 {
          color: #FCD34D !important;
        }

        .admin-dashboard-container .text-cyan-300,
        html:not(.dark) .admin-dashboard-container .text-cyan-300 {
          color: #67E8F9 !important;
        }

        .admin-dashboard-container .text-rose-400,
        html:not(.dark) .admin-dashboard-container .text-rose-400 {
          color: #FB7185 !important;
        }
        
        .admin-dashboard-container .text-slate-500,
        html:not(.dark) .admin-dashboard-container .text-slate-500 {
          color: #64748B !important;
        }
        
        .admin-dashboard-container .text-slate-600,
        html:not(.dark) .admin-dashboard-container .text-slate-600 {
          color: #475569 !important;
        }

        .admin-dashboard-container .bg-white\\/\\[0\\.02\\],
        html:not(.dark) .admin-dashboard-container .bg-white\\/\\[0\\.02\\] {
          background-color: rgba(255, 255, 255, 0.02) !important;
        }
        
        .admin-dashboard-container .bg-white\\/\\[0\\.03\\],
        html:not(.dark) .admin-dashboard-container .bg-white\\/\\[0\\.03\\] {
          background-color: rgba(255, 255, 255, 0.03) !important;
        }
        
        .admin-dashboard-container .bg-\\[\\#0B0F1D\\]\\/60,
        html:not(.dark) .admin-dashboard-container .bg-\\[\\#0B0F1D\\]\\/60 {
          background-color: rgba(11, 15, 29, 0.8) !important;
        }
        
        .admin-dashboard-container .bg-\\[\\#0B0F1D\\]\\/30,
        html:not(.dark) .admin-dashboard-container .bg-\\[\\#0B0F1D\\]\\/30 {
          background-color: rgba(11, 15, 29, 0.4) !important;
        }
        
        .admin-dashboard-container .bg-\\[\\#0E1325\\]\\/50,
        html:not(.dark) .admin-dashboard-container .bg-\\[\\#0E1325\\]\\/50 {
          background-color: rgba(14, 19, 37, 0.6) !important;
        }

        .admin-dashboard-container .border-white\\/5,
        html:not(.dark) .admin-dashboard-container .border-white\\/5 {
          border-color: rgba(255, 255, 255, 0.05) !important;
        }
        
        .admin-dashboard-container .border-white\\/10,
        html:not(.dark) .admin-dashboard-container .border-white\\/10 {
          border-color: rgba(255, 255, 255, 0.1) !important;
        }

        .admin-dashboard-container aside button,
        html:not(.dark) .admin-dashboard-container aside button {
          color: #94A3B8 !important;
          background-color: transparent !important;
          border-color: transparent !important;
        }
        
        .admin-dashboard-container aside button:hover,
        html:not(.dark) .admin-dashboard-container aside button:hover {
          color: #ffffff !important;
          background-color: rgba(255, 255, 255, 0.04) !important;
        }
        
        .admin-dashboard-container aside button.bg-gradient-to-r,
        html:not(.dark) .admin-dashboard-container aside button.bg-gradient-to-r {
          color: #ffffff !important;
          background-image: linear-gradient(to right, rgba(124, 58, 237, 0.2), rgba(14, 165, 233, 0.1)) !important;
          border-color: rgba(124, 58, 237, 0.2) !important;
        }

        .admin-dashboard-container input,
        .admin-dashboard-container select,
        .admin-dashboard-container textarea,
        html:not(.dark) .admin-dashboard-container input,
        html:not(.dark) .admin-dashboard-container select,
        html:not(.dark) .admin-dashboard-container textarea {
          background-color: rgba(255, 255, 255, 0.03) !important;
          color: #ffffff !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
        
        .admin-dashboard-container input::placeholder,
        html:not(.dark) .admin-dashboard-container input::placeholder {
          color: #475569 !important;
        }
      `}</style>

      {/* Top Header */}
      <div className="h-16 px-6 pr-28 border-b border-white/5 bg-[#0B1020]/60 backdrop-blur-md flex items-center justify-between shrink-0 admin-header">
        <div className="flex flex-col">
          <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
            Admin Dashboard
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">Welcome, Admin · {userEmail}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Mobile Exit Button */}
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('fic_navigate_tab', { detail: 'chat' }));
            }}
            className="md:hidden py-1.5 px-3 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/25 text-rose-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
          >
            Exit
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-[9px] text-[#10b981] font-black uppercase tracking-wider">Live</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar / Top navigation scroll bar on mobile */}
        <aside className="w-full md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-white/5 bg-[#0B1020]/30 flex flex-row md:flex-col items-center md:items-stretch overflow-x-auto md:overflow-x-visible p-2 md:p-0 md:py-4 gap-1 scrollbar-none">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`text-center md:text-left whitespace-nowrap mx-1 md:mx-3 px-3.5 md:px-4 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all cursor-pointer border ${
                activeSection === item.id
                  ? 'bg-gradient-to-r from-[#7C3AED]/20 to-[#0EA5E9]/10 text-white border-[#7C3AED]/20'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] border-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}

          {/* Desktop Only Divider & Exit Admin Button */}
          <div className="hidden md:block border-t border-white/5 my-2 mx-3" />
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('fic_navigate_tab', { detail: 'chat' }));
            }}
            className="hidden md:block text-left mx-3 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20 cursor-pointer"
          >
            🚪 Exit Admin
          </button>

          {/* Quick Stats in Sidebar (Desktop Only) */}
          <div className="mt-auto mx-3 space-y-2 border-t border-white/5 pt-4 hidden md:block">
            <div className="text-[8px] font-black uppercase tracking-widest text-slate-600 px-1 mb-2">Quick Stats</div>
            <div className="px-3 py-2.5 bg-white/[0.02] rounded-xl border border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">Total Users</span>
                <span className="text-[9px] font-black text-white">{stats.totalUsers.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">Pro Users</span>
                <span className="text-[9px] font-black text-violet-300">{stats.proUsers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">Total Revenue</span>
                <span className="text-[9px] font-black text-emerald-300">₹{stats.totalRevenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">Today's Revenue</span>
                <span className="text-[9px] font-black text-amber-300">₹{stats.todayRevenue.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin">

          {/* ── Dashboard Overview ── */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Overview</h3>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                  Updated: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  label="Total Users"
                  value={stats.totalUsers}
                  icon="👥"
                  color="bg-[#0B0F1D]/60 border-white/5 hover:border-white/10 transition-all"
                />
                <StatCard
                  label="Pro Users"
                  value={stats.proUsers}
                  icon="⭐"
                  color="bg-[#0B0F1D]/60 border-violet-500/10 hover:border-violet-500/20 transition-all"
                />
                <StatCard
                  label="Business Users"
                  value={stats.businessUsers}
                  icon="👑"
                  color="bg-[#0B0F1D]/60 border-amber-500/10 hover:border-amber-500/20 transition-all"
                />
                <StatCard
                  label="Total Revenue"
                  value={stats.totalRevenue}
                  icon="💰"
                  prefix="₹"
                  color="bg-[#0B0F1D]/60 border-emerald-500/10 hover:border-emerald-500/20 transition-all"
                />
                <StatCard
                  label="Today's Revenue"
                  value={stats.todayRevenue}
                  icon="📅"
                  prefix="₹"
                  color="bg-[#0B0F1D]/60 border-cyan-500/10 hover:border-cyan-500/20 transition-all"
                />
              </div>

              {/* Recent Active Subscriptions Summary */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Active Subscriptions</h4>
                <div className="rounded-2xl border border-white/5 bg-[#0B0F1D]/30 overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-[#0E1325]/50">
                        <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Sub ID</th>
                        <th className="p-3 font-black uppercase text-slate-500 tracking-wider">User</th>
                        <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Plan</th>
                        <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Expiry / Renewal</th>
                        <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {subscriptions.slice(0, 4).map(s => (
                        <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 text-slate-400 font-mono text-[9px]">{s.id}</td>
                          <td className="p-3 text-white font-semibold">{s.user}</td>
                          <td className="p-3"><PlanBadge plan={s.plan} /></td>
                          <td className="p-3 text-slate-400 text-[10px]">{s.expiryDate || s.date || 'N/A'}</td>
                          <td className="p-3"><StatusBadge status={s.status} /></td>
                        </tr>
                      ))}
                      {subscriptions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500 text-[10px] uppercase tracking-widest">
                            No active subscriptions
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Users Tab ── */}
          {activeSection === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">All Users</h3>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchUsers}
                  onChange={e => setSearchUsers(e.target.value)}
                  className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-[#7C3AED]/40 transition-colors w-full sm:w-64"
                />
              </div>

              <div className="rounded-2xl border border-white/5 bg-[#0B0F1D]/30 overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/5 bg-[#0E1325]/50">
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">#</th>
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Name</th>
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Email</th>
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Plan</th>
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Joined</th>
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3 text-slate-600 text-[9px] font-mono">{String(u.id).padStart(3, '0')}</td>
                        <td className="p-3 text-white font-semibold">{u.name}</td>
                        <td className="p-3 text-slate-400 text-[9px] font-mono">{u.email}</td>
                        <td className="p-3"><PlanBadge plan={u.plan} /></td>
                        <td className="p-3 text-slate-500 text-[9px]">{u.joined}</td>
                        <td className="p-3"><StatusBadge status={u.status} /></td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 text-[10px] uppercase tracking-widest">
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-[9px] text-slate-600 text-right">
                Showing {filteredUsers.length} of {users.length} users
              </p>
            </div>
          )}

          {/* ── Subscriptions Tab ── */}
          {activeSection === 'subscriptions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Subscriptions Database</h3>
                <input
                  type="text"
                  placeholder="Search subscription ID, name, email..."
                  value={searchSubs}
                  onChange={e => setSearchSubs(e.target.value)}
                  className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-[#7C3AED]/40 transition-colors w-full sm:w-64"
                />
              </div>

              <div className="rounded-2xl border border-white/5 bg-[#0B0F1D]/30 overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 bg-[#0E1325]/50">
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Sub ID</th>
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Subscriber</th>
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Plan</th>
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Period</th>
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Amount</th>
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Renewal Date</th>
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Gateway Pay ID</th>
                      <th className="p-3 font-black uppercase text-slate-500 tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {filteredSubs.map(s => (
                      <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3 text-slate-400 font-mono text-[9px]">{s.id}</td>
                        <td className="p-3">
                          <div className="font-semibold text-white">{s.user}</div>
                          <div className="text-[9px] text-slate-500 font-mono">{s.email}</div>
                        </td>
                        <td className="p-3"><PlanBadge plan={s.plan} /></td>
                        <td className="p-3 text-slate-400">{s.billing}</td>
                        <td className="p-3 text-emerald-300 font-black">{s.amount}</td>
                        <td className="p-3 text-slate-400 text-[10px]">{s.expiryDate}</td>
                        <td className="p-3 text-slate-500 font-mono text-[9px]">{s.gatewayId}</td>
                        <td className="p-3"><StatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                    {filteredSubs.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500 text-[10px] uppercase tracking-widest">
                          No subscriptions found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Subscription Plans Management ── */}
          {activeSection === 'plans' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Manage Plans</h3>
                {!showForm && (
                  <button
                    onClick={handleOpenAddForm}
                    className="py-1.5 px-4 bg-gradient-to-r from-[#7C3AED] to-[#0EA5E9] text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg"
                  >
                    + Add New Plan
                  </button>
                )}
              </div>

              {/* Form to Edit/Add subscription plan */}
              {showForm ? (
                <div className="p-6 rounded-2xl border border-white/10 bg-[#0B0F1D]/80 space-y-4 max-w-2xl">
                  <h4 className="text-xs font-black text-[#A78BFA] uppercase tracking-widest">
                    {editingPlanId ? '✏️ Edit Subscription Plan' : '✨ Create Subscription Plan'}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Plan Name */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Plan Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Pro"
                        value={planName}
                        onChange={e => setPlanName(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-[#7C3AED]/40 transition-colors"
                      />
                    </div>

                    {/* Plan Badge */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Plan Badge</label>
                      <input
                        type="text"
                        placeholder="e.g. Most Popular"
                        value={planBadge}
                        onChange={e => setPlanBadge(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-[#7C3AED]/40 transition-colors"
                      />
                    </div>

                    {/* Monthly Price */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Monthly Price</label>
                      <input
                        type="text"
                        placeholder="e.g. ₹499"
                        value={monthlyPrice}
                        onChange={e => setMonthlyPrice(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-[#7C3AED]/40 transition-colors"
                      />
                    </div>

                    {/* Yearly Price */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Yearly Price</label>
                      <input
                        type="text"
                        placeholder="e.g. ₹4,999"
                        value={yearlyPrice}
                        onChange={e => setYearlyPrice(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-[#7C3AED]/40 transition-colors"
                      />
                    </div>

                    {/* Plan Color theme select */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Plan Color</label>
                      <select
                        value={planColor}
                        onChange={e => setPlanColor(e.target.value)}
                        className="w-full bg-[#0B0F1D] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-[#7C3AED]/40 transition-colors cursor-pointer"
                      >
                        <option value="Purple">Purple</option>
                        <option value="Amber">Amber</option>
                        <option value="Cyan">Cyan</option>
                        <option value="Emerald">Emerald</option>
                        <option value="Rose">Rose</option>
                      </select>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Description</label>
                      <textarea
                        rows={3}
                        placeholder="e.g. Best for Professionals"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-[#7C3AED]/40 transition-colors resize-none"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={handleSavePlan}
                      className="py-2.5 px-6 bg-[#7C3AED] hover:opacity-90 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                    >
                      Save Plan
                    </button>
                    <button
                      onClick={handlePreview}
                      className="py-2.5 px-6 bg-[#0EA5E9] hover:opacity-90 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                    >
                      Preview
                    </button>
                    <button
                      onClick={handleCancelForm}
                      className="py-2.5 px-6 bg-white/[0.02] border border-white/10 hover:bg-white/[0.05] text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Plan Listing Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {plans.map(p => {
                    const c = getColorClasses(p.color);
                    return (
                      <div
                        key={p.id}
                        className={`bg-[#0B0F1D]/60 border p-5 rounded-2xl flex flex-col justify-between transition-all duration-300 relative ${c.border} ${c.glow}`}
                      >
                        {p.badge && (
                          <span className={`absolute -top-2.5 left-5 text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full text-white bg-gradient-to-r ${c.button}`}>
                            {p.badge}
                          </span>
                        )}
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-base font-black text-white uppercase tracking-wider">{p.name} Plan</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">{p.description}</p>
                            </div>
                            <span className={`text-[10px] font-bold uppercase ${c.text}`}>{p.color}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 bg-white/[0.01] border border-white/5 rounded-xl p-3">
                            <div>
                              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block">Monthly Price</span>
                              <span className="text-base font-black text-white">{p.monthlyPrice}</span>
                            </div>
                            <div>
                              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block">Yearly Price</span>
                              <span className="text-base font-black text-white">{p.yearlyPrice}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                          <button
                            onClick={() => handleOpenEditForm(p)}
                            className="flex-1 py-1.5 bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer text-center"
                          >
                            Edit Plan
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* Real-time Dynamic Subscription Card Preview Overlay */}
      {previewPlan && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setPreviewPlan(null)}>
          <div 
            className="w-full max-w-sm bg-[#060814] border border-white/10 rounded-3xl p-6 shadow-2xl relative space-y-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setPreviewPlan(null)} 
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white flex items-center justify-center text-xs cursor-pointer transition-colors"
            >
              ✕
            </button>

            <div className="text-center space-y-1">
              <span className="px-3 py-1 rounded-full bg-white/[0.02] border border-white/5 text-slate-400 text-[8px] font-black uppercase tracking-widest">
                👁️ Live Client Preview
              </span>
              <h3 className="text-base font-black text-white uppercase tracking-wider pt-2">How it renders in App</h3>
            </div>

            {/* Simulated Subscription Pricing Card */}
            {(() => {
              const c = getColorClasses(previewPlan.color);
              return (
                <div className={`bg-[#0B0F1D]/80 border-2 p-6 rounded-3xl flex flex-col justify-between relative transition-all duration-300 ${c.border} ${c.glow}`}>
                  {previewPlan.badge && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black tracking-widest uppercase px-3 py-1 rounded-full shadow-md text-white bg-gradient-to-r ${c.button}`}>
                      {previewPlan.badge}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>{previewPlan.description}</span>
                      <h4 className="text-lg font-black text-white uppercase tracking-wider mt-1 flex items-center gap-1.5">
                        <span>⭐</span> {previewPlan.name} Plan
                      </h4>
                    </div>

                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white">{previewPlan.monthlyPrice}</span>
                        <span className="text-xs text-slate-400">/month</span>
                      </div>
                      <span className={`text-[9px] font-bold block mt-0.5 ${c.text}`}>{previewPlan.yearlyPrice} billed yearly (Save 20%)</span>
                    </div>

                    <button
                      disabled
                      className={`w-full py-3 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all text-center block bg-gradient-to-r ${c.button} opacity-90 cursor-not-allowed`}
                    >
                      Subscribe Now
                    </button>
                    
                    <hr className="border-white/10 my-2" />
                    
                    <ul className="space-y-2.5 text-xs text-slate-200">
                      <li className="flex items-start gap-2.5">
                        <span className="text-cyan-400 shrink-0">✓</span>
                        <span><strong>Unlimited</strong> AI Actions</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="text-cyan-400 shrink-0">✓</span>
                        <span>Premium Templates unlocked</span>
                      </li>
                    </ul>
                  </div>
                </div>
              );
            })()}

            <button
              onClick={() => setPreviewPlan(null)}
              className="w-full py-2.5 bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
