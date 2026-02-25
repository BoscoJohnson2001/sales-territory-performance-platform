import { useEffect, useState, useRef } from 'react';
import Layout from '../../components/Layout';
import client from '../../api/client';
import {
  HiUsers, HiCheckCircle, HiUserGroup, HiCollection,
  HiPlus, HiX, HiExclamationCircle, HiCheck
} from 'react-icons/hi';

interface User {
  id: string; userCode: string; firstName: string; lastName: string;
  displayName: string | null; email: string; role: string;
  isActive: boolean; isFirstLogin: boolean; createdAt: string;
  phoneNumber: string | null; joiningDate: string | null;
  workStartTimeUtc: string | null; workEndTimeUtc: string | null;
  territories: { name: string }[];
}
interface Product { id: string; name: string; category: string; price: string; }
interface Territory { id: string; name: string; state: string; region: string; }
interface AssignedTerritory extends Territory { assignmentId: string; assignedAt: string; }

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'users' | 'products' | 'territories'>('users');
  const [success, setSuccess] = useState(false);

  // Searchable Dropdown state for assignment
  const [salesRepSearch, setSalesRepSearch] = useState('');
  const [salesRepDropOpen, setSalesRepDropOpen] = useState(false);
  const salesRepDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (salesRepDropRef.current && !salesRepDropRef.current.contains(e.target as Node))
        setSalesRepDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  // Create user form state
  const [form, setForm] = useState({
    firstName: '', lastName: '', displayName: '',
    email: '', phoneNumber: '',
    joiningDate: '', workStartTime: '', workEndTime: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Product modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [pCreateMsg, setPCreateMsg] = useState('');

  // Auto-detect browser timezone
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Create product form state
  const [pForm, setPForm] = useState({ name: '', category: '', price: '' });
  const [pCreating, setPCreating] = useState(false);

  // Territory assignment state
  const [allTerritories, setAllTerritories] = useState<Territory[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assignedTerritories, setAssignedTerritories] = useState<AssignedTerritory[]>([]);
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState('');
  const [loadingAssigned, setLoadingAssigned] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [ur, pr, tr] = await Promise.all([
      client.get('/api/admin/users'),
      client.get('/api/admin/products'),
      client.get('/api/admin/territories'),
    ]);
    setUsers(ur.data);
    setProducts(pr.data);
    setAllTerritories(tr.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // When selected user changes, fetch their assigned territories
  useEffect(() => {
    if (!selectedUserId) { setAssignedTerritories([]); setSelectedTerritoryIds(new Set()); return; }
    setLoadingAssigned(true);
    client.get(`/api/admin/sales-users/${selectedUserId}/territories`)
      .then(r => {
        const assigned: AssignedTerritory[] = r.data;
        setAssignedTerritories(assigned);
        setSelectedTerritoryIds(new Set(assigned.map(t => t.id)));
      })
      .finally(() => setLoadingAssigned(false));
  }, [selectedUserId]);

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    if (form.phoneNumber && !form.phoneNumber.startsWith('+'))
      errs.phoneNumber = 'Must include country code (e.g. +91…)';
    if (form.joiningDate && new Date(form.joiningDate) > new Date())
      errs.joiningDate = 'Joining date cannot be in the future';
    if ((form.workStartTime && !form.workEndTime) || (!form.workStartTime && form.workEndTime))
      errs.workTime = 'Provide both start and end time';
    if (form.workStartTime && form.workEndTime) {
      const [sh, sm] = form.workStartTime.split(':').map(Number);
      const [eh, em] = form.workEndTime.split(':').map(Number);
      if (eh * 60 + em <= sh * 60 + sm) errs.workTime = 'End time must be after start time';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const createUser = async () => {
    if (!validateForm()) return;
    setCreating(true); setCreateMsg('');
    try {
      const payload = { ...form, timezone: tz };
      const res = await client.post('/api/admin/users', payload);
      setCreateMsg(`✅ Created: ${res.data.userCode} — Onboarding email sent.`);
      setForm({ firstName: '', lastName: '', displayName: '', email: '', phoneNumber: '', joiningDate: '', workStartTime: '', workEndTime: '' });
      setFormErrors({});
      fetchData();
      // Auto-close modal after 1.5s success
      setTimeout(() => { setIsModalOpen(false); setCreateMsg(''); }, 1500);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setCreateMsg(`❌ ${msg || 'Failed to create user'}`);
    } finally { setCreating(false); }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await client.put(`/api/admin/users/${id}/${active ? 'deactivate' : 'activate'}`);
    fetchData();
  };

  const createProduct = async () => {
    setPCreating(true); setPCreateMsg('');
    try {
      await client.post('/api/admin/products', { ...pForm, price: parseFloat(pForm.price) });
      setPCreateMsg('✅ Product added successfully.');
      setPForm({ name: '', category: '', price: '' });
      fetchData();
      // Auto-close modal after 1.5s success
      setTimeout(() => { setIsProductModalOpen(false); setPCreateMsg(''); }, 1500);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setPCreateMsg(`❌ ${msg || 'Failed to add product'}`);
    } finally { setPCreating(false); }
  };

  const toggleTerritorySelection = (id: string) => {
    setSelectedTerritoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const assignTerritories = async () => {
    if (!selectedUserId || selectedTerritoryIds.size === 0) return;
    setAssigning(true); setAssignMsg('');
    try {
      const idsToAssign = [...selectedTerritoryIds].filter(
        id => !assignedTerritories.find(a => a.id === id)
      );
      if (idsToAssign.length === 0) { setAssignMsg('ℹ️ No new territories to assign'); setAssigning(false); return; }
      const res = await client.post(`/api/admin/sales-users/${selectedUserId}/territories`, { territoryIds: idsToAssign });
      setAssignMsg(`✅ ${res.data.message}`);
      // Refresh assigned list
      const r = await client.get(`/api/admin/sales-users/${selectedUserId}/territories`);
      setAssignedTerritories(r.data);
      setSelectedTerritoryIds(new Set(r.data.map((t: AssignedTerritory) => t.id)));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setAssignMsg(`❌ ${msg || 'Failed to assign'}`);
    } finally { setAssigning(false); }
  };

  const removeAssignment = async (territoryId: string) => {
    if (!selectedUserId) return;
    await client.delete(`/api/admin/sales-users/${selectedUserId}/territories/${territoryId}`);
    const r = await client.get(`/api/admin/sales-users/${selectedUserId}/territories`);
    setAssignedTerritories(r.data);
    setSelectedTerritoryIds(new Set(r.data.map((t: AssignedTerritory) => t.id)));
    setAssignMsg('✅ Territory removed');
  };

  const salesUsers = users.filter(u => u.role === 'SALES');
  const totalActive = users.filter(u => u.isActive).length;

  return (
    <Layout title="Admin Dashboard" subtitle="Pfizer Medical Industries — System Administration">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Users', value: users.length, sub: 'All roles', icon: HiUsers, color: 'text-blue-400' },
          { label: 'Active Users', value: totalActive, sub: 'Currently active', icon: HiCheckCircle, color: 'text-green-400' },
          { label: 'Sales Reps', value: salesUsers.length, sub: 'SL_ accounts', icon: HiUserGroup, color: 'text-purple-400' },
          { label: 'Products', value: products.length, sub: 'In catalogue', icon: HiCollection, color: 'text-amber-400' },
        ].map(c => (
          <div key={c.label} className="stat-card card-hover">
            <div className="flex justify-between items-start mb-1">
              <span className="stat-card-label">{c.label}</span>
              <c.icon className={`text-lg ${c.color}`} />
            </div>
            <span className="stat-card-value">{loading ? '—' : c.value}</span>
            <span className="stat-card-sub">{c.sub}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['users', 'products', 'territories'] as const).map(t => (
          <button key={t} id={`tab-${t}`}
            onClick={() => setTab(t)}
            className={tab === t ? 'btn-primary py-1.5 text-xs' : 'btn-secondary py-1.5 text-xs'}>
            {t === 'users' ? 'Users' : t === 'products' ? 'Products' : 'Territories'}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-text-primary text-lg font-bold">User Management</h2>
              <p className="text-text-muted text-xs">Manage sales representatives and system access.</p>
            </div>
            <button
              id="open-create-user-modal"
              onClick={() => setIsModalOpen(true)}
              className="btn-primary flex items-center gap-2"
            >
              <HiPlus /> New User
            </button>
          </div>

          {/* Users Table */}
          <div className="card w-full animate-fade-in">
            <h3 className="text-text-primary font-semibold mb-4 text-sm uppercase tracking-wider opacity-80">All Registered Users</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr>
                  <th className="th">Code</th>
                  <th className="th">Name</th>
                  <th className="th">Role</th>
                  <th className="th">Phone</th>
                  <th className="th">Joining</th>
                  <th className="th">Working Hours (Local)</th>
                  <th className="th">Status</th>
                  <th className="th">Action</th>
                </tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="tr-hover">
                      <td className="td font-mono text-accent text-xs">{u.userCode}</td>
                      <td className="td">
                        <p className="text-text-primary text-xs font-medium">{u.displayName || `${u.firstName} ${u.lastName || ''}`}</p>
                        <p className="text-text-subtle text-[10px]">{u.email}</p>
                      </td>
                      <td className="td"><span className="badge-info">{u.role}</span></td>
                      <td className="td text-xs text-text-muted">{u.phoneNumber || '—'}</td>
                      <td className="td text-xs text-text-muted">
                        {u.joiningDate ? new Date(u.joiningDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="td text-xs text-text-muted">
                        {u.workStartTimeUtc && u.workEndTimeUtc
                          ? `${new Date(u.workStartTimeUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(u.workEndTimeUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : '—'}
                      </td>
                      <td className="td"><span className={u.isActive ? 'badge-high' : 'badge-low'}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td className="td">
                        <button onClick={() => toggleActive(u.id, u.isActive)}
                          className={u.isActive ? 'btn-danger py-1 text-xs' : 'btn-secondary py-1 text-xs'}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Products Tab */}
      {tab === 'products' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-text-primary text-lg font-bold">Product Catalogue</h2>
              <p className="text-text-muted text-xs">Manage medical products and pricing.</p>
            </div>
            <button
              id="open-create-product-modal"
              onClick={() => setIsProductModalOpen(true)}
              className="btn-primary flex items-center gap-2"
            >
              <HiPlus /> New Product
            </button>
          </div>

          {/* Product Catalogue Table */}
          <div className="card w-full animate-fade-in">
            <h3 className="text-text-primary font-semibold mb-4 text-sm uppercase tracking-wider opacity-80">All Products</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th className="th">Name</th><th className="th">Category</th><th className="th">Price</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className="tr-hover">
                      <td className="td">{p.name}</td>
                      <td className="td"><span className="badge-info">{p.category}</span></td>
                      <td className="td text-accent font-semibold">₹{parseFloat(p.price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Territories Tab */}
      {tab === 'territories' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Assign Panel */}
          <div className="card">
            <h3 className="text-text-primary font-semibold mb-1">Assign Territories to Sales Rep</h3>
            <p className="text-text-muted text-xs mb-4">Select a Sales Rep, check the territories to grant, then click Assign.</p>

            {/* Sales User Searchable Dropdown */}
            <label className="text-xs text-text-muted mb-1 block">Sales Representative</label>
            <div className="relative mb-4" ref={salesRepDropRef}>
              <div
                className="input cursor-pointer flex items-center justify-between"
                onClick={() => setSalesRepDropOpen(!salesRepDropOpen)}
              >
                {selectedUserId ? (
                  <span className="truncate">
                    {salesUsers.find(u => u.id === selectedUserId)?.userCode} — {salesUsers.find(u => u.id === selectedUserId)?.firstName} {salesUsers.find(u => u.id === selectedUserId)?.lastName}
                  </span>
                ) : (
                  <span className="text-text-muted">— Select Sales Rep —</span>
                )}
                <HiX
                  className={`text-xs ml-2 hover:text-red-400 transition-colors ${selectedUserId ? 'visible' : 'invisible'}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedUserId(''); setSalesRepSearch(''); setAssignMsg(''); }}
                />
              </div>

              {salesRepDropOpen && (
                <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-bg-card border border-bg-border rounded-lg shadow-2xl overflow-hidden animate-zoom-in">
                  <div className="p-2 border-b border-bg-border bg-bg-hover/30">
                    <div className="relative">
                      <HiPlus className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs rotate-45" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Filter by name or code..."
                        className="w-full bg-bg-card border border-bg-border rounded-md pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-accent transition-colors"
                        value={salesRepSearch}
                        onChange={e => setSalesRepSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {salesUsers
                      .filter(u =>
                        !salesRepSearch ||
                        u.userCode.toLowerCase().includes(salesRepSearch.toLowerCase()) ||
                        `${u.firstName} ${u.lastName}`.toLowerCase().includes(salesRepSearch.toLowerCase())
                      )
                      .map(u => (
                        <div
                          key={u.id}
                          className={`px-3 py-2 text-xs cursor-pointer transition-colors flex items-center justify-between group ${selectedUserId === u.id ? 'bg-accent/10 text-accent font-semibold' : 'hover:bg-bg-hover text-text-primary'}`}
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setSalesRepDropOpen(false);
                            setSalesRepSearch('');
                            setAssignMsg('');
                          }}
                        >
                          <span>{u.userCode} — {u.firstName} {u.lastName}</span>
                          {selectedUserId === u.id && <HiCheck className="text-accent" />}
                        </div>
                      ))}
                    {salesUsers.filter(u =>
                      !salesRepSearch ||
                      u.userCode.toLowerCase().includes(salesRepSearch.toLowerCase()) ||
                      `${u.firstName} ${u.lastName}`.toLowerCase().includes(salesRepSearch.toLowerCase())
                    ).length === 0 && (
                        <div className="px-3 py-4 text-center text-text-muted text-xs italic">
                          No matches found
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>

            {/* Territory Multi-select (checkboxes) */}
            {selectedUserId && (
              <>
                <label className="text-xs text-text-muted mb-2 block">All Territories</label>
                <div className="border border-border rounded-lg p-3 max-h-52 overflow-y-auto mb-4 flex flex-col gap-2">
                  {allTerritories.length === 0 && (
                    <p className="text-text-muted text-xs">No territories in the database. Create territories first.</p>
                  )}
                  {allTerritories.map(t => (
                    <label key={t.id} className="flex items-center gap-3 cursor-pointer hover:bg-surface-hover rounded px-2 py-1.5 transition-colors">
                      <input
                        type="checkbox"
                        id={`terr-check-${t.id}`}
                        checked={selectedTerritoryIds.has(t.id)}
                        onChange={() => toggleTerritorySelection(t.id)}
                        className="accent-accent w-4 h-4"
                      />
                      <span className="text-sm text-text-primary">{t.name}</span>
                      <span className="text-xs text-text-muted ml-auto">{t.state} · {t.region}</span>
                    </label>
                  ))}
                </div>

                <button
                  id="assign-territories-btn"
                  onClick={assignTerritories}
                  disabled={assigning || selectedTerritoryIds.size === 0}
                  className="btn-primary w-full justify-center mb-2"
                >
                  {assigning ? 'Assigning...' : `Assign Selected (${selectedTerritoryIds.size})`}
                </button>
                {assignMsg && (
                  <p className="text-xs" style={{ color: assignMsg.startsWith('✅') ? '#22c55e' : assignMsg.startsWith('ℹ️') ? '#6b7280' : '#ef4444' }}>
                    {assignMsg}
                  </p>
                )}
              </>
            )}

            {!selectedUserId && (
              <p className="text-text-muted text-sm text-center py-8">Select a Sales Rep to manage territory assignments.</p>
            )}
          </div>

          {/* Currently Assigned Panel */}
          <div className="card">
            <h3 className="text-text-primary font-semibold mb-1">Currently Assigned Territories</h3>
            {!selectedUserId && (
              <p className="text-text-muted text-sm text-center py-8">Select a Sales Rep to view assignments.</p>
            )}
            {selectedUserId && loadingAssigned && (
              <p className="text-text-muted text-sm text-center py-8">Loading...</p>
            )}
            {selectedUserId && !loadingAssigned && assignedTerritories.length === 0 && (
              <p className="text-text-muted text-sm text-center py-8">No territories assigned yet.</p>
            )}
            {selectedUserId && !loadingAssigned && assignedTerritories.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                {assignedTerritories.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-surface-hover">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{t.name}</p>
                      <p className="text-xs text-text-muted">{t.state} · {t.region}</p>
                    </div>
                    <button
                      id={`remove-terr-${t.id}`}
                      onClick={() => removeAssignment(t.id)}
                      className="btn-danger py-1 text-xs ml-3"
                      title="Remove assignment"
                    >
                      ✕ Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Side Modal for Creating User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-bg-surface border-l border-bg-border shadow-2xl flex flex-col h-full animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-bg-border bg-bg-base/30">
              <div>
                <h3 className="text-text-primary font-bold text-lg">Create Sales Rep</h3>
                <p className="text-text-subtle text-xs">Register a new representative in the system.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-2 rounded-lg hover:bg-bg-hover transition-colors"
                aria-label="Close"
              >
                <HiX className="text-xl" />
              </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-4">
                {/* Row 1: Names */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="stat-card-label" htmlFor="new-user-first">First Name *</label>
                    <input id="new-user-first" className={`input ${formErrors.firstName ? 'border-red-500' : ''}`}
                      placeholder="Jane" value={form.firstName}
                      onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                    {formErrors.firstName && <p className="text-red-400 text-[10px] mt-0.5">{formErrors.firstName}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="stat-card-label" htmlFor="new-user-last">Last Name</label>
                    <input id="new-user-last" className="input" placeholder="Doe"
                      value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                  </div>
                </div>

                {/* Display Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="stat-card-label" htmlFor="new-user-display">Display Name</label>
                  <input id="new-user-display" className="input" placeholder="e.g. Jane D."
                    value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
                  <p className="text-text-subtle text-[10px]">Leave blank to auto-generate from names.</p>
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="stat-card-label" htmlFor="new-user-email">Email Address *</label>
                  <input id="new-user-email" className={`input ${formErrors.email ? 'border-red-500' : ''}`}
                    placeholder="jane.doe@pfizer.com" type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  {formErrors.email && <p className="text-red-400 text-[10px] mt-0.5">{formErrors.email}</p>}
                </div>

                {/* Phone */}
                <div className="flex flex-col gap-1.5">
                  <label className="stat-card-label" htmlFor="new-user-phone">Phone Number</label>
                  <input id="new-user-phone" className={`input ${formErrors.phoneNumber ? 'border-red-500' : ''}`}
                    placeholder="+919876543210"
                    value={form.phoneNumber}
                    onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} />
                  {formErrors.phoneNumber
                    ? <p className="text-red-400 text-[10px] mt-0.5">{formErrors.phoneNumber}</p>
                    : <p className="text-text-subtle text-[10px]">Include country code e.g. +91…</p>}
                </div>

                {/* Joining Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="stat-card-label" htmlFor="new-user-joining"> joining date</label>
                  <input id="new-user-joining" type="date" className={`input ${formErrors.joiningDate ? 'border-red-500' : ''}`}
                    max={new Date().toISOString().split('T')[0]}
                    value={form.joiningDate}
                    onChange={e => setForm(f => ({ ...f, joiningDate: e.target.value }))} />
                  {formErrors.joiningDate && <p className="text-red-400 text-[10px] mt-0.5">{formErrors.joiningDate}</p>}
                </div>

                {/* Working Hours */}
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-bg-base/50 border border-bg-border/50">
                  <label className="stat-card-label flex items-center justify-between">
                    Working Hours <span className="normal-case opacity-60">({tz})</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-text-subtle uppercase">Start</span>
                      <input id="new-user-start" type="time" className="input text-xs h-9 px-3"
                        value={form.workStartTime}
                        onChange={e => setForm(f => ({ ...f, workStartTime: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-text-subtle uppercase">End</span>
                      <input id="new-user-end" type="time" className="input text-xs h-9 px-3"
                        value={form.workEndTime}
                        onChange={e => setForm(f => ({ ...f, workEndTime: e.target.value }))} />
                    </div>
                  </div>
                  {formErrors.workTime && <p className="text-red-400 text-[10px] mt-1">{formErrors.workTime}</p>}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-bg-border bg-bg-base/30 flex flex-col gap-3">
              <button
                id="create-user-btn"
                onClick={createUser}
                disabled={creating}
                className="btn-primary w-full justify-center py-3 text-base shadow-lg shadow-accent/10"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : 'Create & Send Onboarding Email'}
              </button>
              {createMsg && (
                <div className={`p-3 rounded-lg text-xs font-medium animate-fade-in flex items-center gap-2 ${createMsg.startsWith('✅') ? 'bg-status-high/10 text-status-high border border-status-high/20' : 'bg-status-low/10 text-status-low border border-status-low/20'}`}>
                  {createMsg.startsWith('✅') ? <HiCheckCircle className="text-base flex-shrink-0" /> : <HiExclamationCircle className="text-base flex-shrink-0" />}
                  {createMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Side Modal for Creating Product */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsProductModalOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-bg-surface border-l border-bg-border shadow-2xl flex flex-col h-full animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-bg-border bg-bg-base/30">
              <div>
                <h3 className="text-text-primary font-bold text-lg">Add New Product</h3>
                <p className="text-text-subtle text-xs">Define a new medical product in the catalogue.</p>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-2 rounded-lg hover:bg-bg-hover transition-colors"
                aria-label="Close"
              >
                <HiX className="text-xl" />
              </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-4">
                {/* Product Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="stat-card-label" htmlFor="prod-name">Product Name *</label>
                  <input id="prod-name" className="input" placeholder="e.g. Lipitor 20mg"
                    value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1.5">
                  <label className="stat-card-label" htmlFor="prod-category">Category *</label>
                  <input id="prod-category" className="input" placeholder="e.g. Cardiovascular"
                    value={pForm.category} onChange={e => setPForm(f => ({ ...f, category: e.target.value }))} />
                </div>

                {/* Price */}
                <div className="flex flex-col gap-1.5">
                  <label className="stat-card-label" htmlFor="prod-price">Unit Price (₹) *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-subtle">₹</span>
                    <input id="prod-price" className="input pl-8" placeholder="0.00" type="number"
                      value={pForm.price} onChange={e => setPForm(f => ({ ...f, price: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-bg-border bg-bg-base/30 flex flex-col gap-3">
              <button
                id="create-product-btn"
                onClick={createProduct}
                disabled={pCreating}
                className="btn-primary w-full justify-center py-3 text-base shadow-lg shadow-accent/10"
              >
                {pCreating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </span>
                ) : 'Add Product to Catalogue'}
              </button>
              {pCreateMsg && (
                <div className={`p-3 rounded-lg text-xs font-medium animate-fade-in flex items-center gap-2 ${pCreateMsg.startsWith('✅') ? 'bg-status-high/10 text-status-high border border-status-high/20' : 'bg-status-low/10 text-status-low border border-status-low/20'}`}>
                  {pCreateMsg.startsWith('✅') ? <HiCheckCircle className="text-base flex-shrink-0" /> : <HiExclamationCircle className="text-base flex-shrink-0" />}
                  {pCreateMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
