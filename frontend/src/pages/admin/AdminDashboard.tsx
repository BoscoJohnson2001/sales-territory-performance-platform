import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import client from '../../api/client';

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

  // Create user form state
  const [form, setForm] = useState({
    firstName: '', lastName: '', displayName: '',
    email: '', phoneNumber: '',
    joiningDate: '', workStartTime: '', workEndTime: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

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
    setPCreating(true);
    try { await client.post('/api/admin/products', { ...pForm, price: parseFloat(pForm.price) }); setPForm({ name: '', category: '', price: '' }); fetchData(); }
    finally { setPCreating(false); }
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
          { label: 'Total Users', value: users.length, sub: 'All roles' },
          { label: 'Active Users', value: totalActive, sub: 'Currently active' },
          { label: 'Sales Reps', value: salesUsers.length, sub: 'SL_ accounts' },
          { label: 'Products', value: products.length, sub: 'In catalogue' },
        ].map(c => (
          <div key={c.label} className="stat-card card-hover">
            <span className="stat-card-label">{c.label}</span>
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
        <div className="grid md:grid-cols-3 gap-6">
          {/* Create User */}
          <div className="card">
            <h3 className="text-text-primary font-semibold mb-4">Create Sales Rep</h3>
            <div className="flex flex-col gap-3">

              {/* Row 1: Names */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input id="new-user-first" className={`input text-sm ${formErrors.firstName ? 'border-red-500' : ''}`}
                    placeholder="First Name *" value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                  {formErrors.firstName && <p className="text-red-400 text-xs mt-0.5">{formErrors.firstName}</p>}
                </div>
                <input id="new-user-last" className="input text-sm" placeholder="Last Name"
                  value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>

              {/* Display Name */}
              <input id="new-user-display" className="input text-sm" placeholder="Display Name (auto if blank)"
                value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />

              {/* Email */}
              <div>
                <input id="new-user-email" className={`input text-sm ${formErrors.email ? 'border-red-500' : ''}`}
                  placeholder="Email *" type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                {formErrors.email && <p className="text-red-400 text-xs mt-0.5">{formErrors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <input id="new-user-phone" className={`input text-sm ${formErrors.phoneNumber ? 'border-red-500' : ''}`}
                  placeholder="Phone with country code (e.g. +919876543210)"
                  value={form.phoneNumber}
                  onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} />
                {formErrors.phoneNumber
                  ? <p className="text-red-400 text-xs mt-0.5">{formErrors.phoneNumber}</p>
                  : <p className="text-text-subtle text-xs mt-0.5">Include country code e.g. +91…</p>}
              </div>

              {/* Joining Date */}
              <div>
                <label className="text-text-muted text-xs font-medium uppercase tracking-widest block mb-1">Joining Date</label>
                <input id="new-user-joining" type="date" className={`input text-sm ${formErrors.joiningDate ? 'border-red-500' : ''}`}
                  max={new Date().toISOString().split('T')[0]}
                  value={form.joiningDate}
                  onChange={e => setForm(f => ({ ...f, joiningDate: e.target.value }))} />
                {formErrors.joiningDate && <p className="text-red-400 text-xs mt-0.5">{formErrors.joiningDate}</p>}
              </div>

              {/* Working Hours */}
              <div>
                <label className="text-text-muted text-xs font-medium uppercase tracking-widest block mb-1">
                  Working Hours <span className="text-text-subtle normal-case">({tz})</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input id="new-user-start" type="time" className="input text-sm"
                    value={form.workStartTime}
                    onChange={e => setForm(f => ({ ...f, workStartTime: e.target.value }))} />
                  <input id="new-user-end" type="time" className="input text-sm"
                    value={form.workEndTime}
                    onChange={e => setForm(f => ({ ...f, workEndTime: e.target.value }))} />
                </div>
                {formErrors.workTime && <p className="text-red-400 text-xs mt-0.5">{formErrors.workTime}</p>}
              </div>

              <button id="create-user-btn" onClick={createUser} disabled={creating} className="btn-primary justify-center">
                {creating ? 'Creating...' : 'Create & Send Email'}
              </button>
              {createMsg && <p className="text-xs mt-1" style={{ color: createMsg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>{createMsg}</p>}
            </div>
          </div>

          {/* Users Table */}
          <div className="md:col-span-2 card">
            <h3 className="text-text-primary font-semibold mb-4">All Users</h3>
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
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card">
            <h3 className="text-text-primary font-semibold mb-4">Add Product</h3>
            <div className="flex flex-col gap-3">
              <input id="prod-name" className="input" placeholder="Product Name" value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} />
              <input id="prod-category" className="input" placeholder="Category" value={pForm.category} onChange={e => setPForm(f => ({ ...f, category: e.target.value }))} />
              <input id="prod-price" className="input" placeholder="Price" type="number" value={pForm.price} onChange={e => setPForm(f => ({ ...f, price: e.target.value }))} />
              <button id="create-product-btn" onClick={createProduct} disabled={pCreating} className="btn-primary justify-center">
                {pCreating ? 'Adding...' : 'Add Product'}
              </button>
            </div>
          </div>
          <div className="md:col-span-2 card">
            <h3 className="text-text-primary font-semibold mb-4">Product Catalogue</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th className="th">Name</th><th className="th">Category</th><th className="th">Price</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className="tr-hover">
                      <td className="td">{p.name}</td>
                      <td className="td"><span className="badge-info">{p.category}</span></td>
                      <td className="td text-accent font-semibold">${parseFloat(p.price).toLocaleString()}</td>
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

            {/* Sales User Dropdown */}
            <label className="text-xs text-text-muted mb-1 block">Sales Representative</label>
            <select
              id="territory-assign-user"
              className="input mb-4"
              value={selectedUserId}
              onChange={e => { setSelectedUserId(e.target.value); setAssignMsg(''); }}
            >
              <option value="">— Select Sales Rep —</option>
              {salesUsers.map(u => (
                <option key={u.id} value={u.id}>{u.userCode} — {u.firstName} {u.lastName}</option>
              ))}
            </select>

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
    </Layout>
  );
}
