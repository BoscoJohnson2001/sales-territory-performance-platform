import { useEffect, useState, useRef } from 'react';
import Layout from '../../components/Layout';
import client from '../../api/client';
import {
  HiUsers, HiCollection,
  HiPlus, HiX, HiCheck, HiMap, HiLocationMarker
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
  const [, setFormErrors] = useState<Record<string, string>>({});
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

  // ── Tab Renderers ───────────────────────────────────────────

  const renderUsers = () => (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      <div className="flex justify-between items-center p-6 pb-0 flex-shrink-0">
        <div>
          <h2 className="text-text-primary text-sm font-bold uppercase tracking-wider">User Management</h2>
          <p className="text-text-muted text-[10px]">Manage representatives and system access.</p>
        </div>
        <button id="open-create-user-modal" onClick={() => setIsModalOpen(true)} className="btn-primary py-1 px-3 text-xs flex items-center gap-2">
          <HiPlus /> New User
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <table className="table">
          <thead className="sticky top-0 z-10 bg-bg-card"><tr>
            <th className="th">Code</th><th className="th">Name</th><th className="th">Role</th><th className="th">Phone</th><th className="th">Status</th><th className="th">Action</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="tr-hover">
                <td className="td font-mono text-accent text-[10px]">{u.userCode}</td>
                <td className="td">
                  <p className="text-text-primary text-xs font-medium truncate max-w-[150px]">{u.displayName || `${u.firstName} ${u.lastName}`}</p>
                  <p className="text-text-subtle text-[10px] truncate max-w-[150px]">{u.email}</p>
                </td>
                <td className="td"><span className="badge-info text-[10px]">{u.role}</span></td>
                <td className="td text-[10px] text-text-muted">{u.phoneNumber || '—'}</td>
                <td className="td"><span className={u.isActive ? 'badge-high text-[10px]' : 'badge-low text-[10px]'}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="td">
                  <button onClick={() => toggleActive(u.id, u.isActive)} className={u.isActive ? 'btn-danger py-0.5 px-2 text-[10px]' : 'btn-secondary py-0.5 px-2 text-[10px]'}>
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      <div className="flex justify-between items-center p-6 pb-0 flex-shrink-0">
        <div>
          <h2 className="text-text-primary text-sm font-bold uppercase tracking-wider">Product Catalogue</h2>
          <p className="text-text-muted text-[10px]">Manage medical products and pricing.</p>
        </div>
        <button id="open-create-product-modal" onClick={() => setIsProductModalOpen(true)} className="btn-primary py-1 px-3 text-xs flex items-center gap-2">
          <HiPlus /> New Product
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <table className="table">
          <thead className="sticky top-0 z-10 bg-bg-card"><tr><th className="th">Name</th><th className="th">Category</th><th className="th">Price</th></tr></thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="tr-hover">
                <td className="td text-xs">{p.name}</td>
                <td className="td"><span className="badge-info text-[10px]">{p.category}</span></td>
                <td className="td text-accent font-semibold text-xs">₹{parseFloat(p.price).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTerritories = () => (
    <div className="flex-1 min-h-0 grid md:grid-cols-2 gap-0 overflow-hidden">
      {/* Assign Panel */}
      <div className="border-r border-bg-border flex flex-col min-h-0 p-6">
        <h3 className="text-text-primary font-semibold text-xs uppercase opacity-80 mb-1">Assign Territories</h3>
        <p className="text-text-muted text-[10px] mb-4">Select a Sales Rep and territories to assign.</p>

        <label className="text-[10px] text-text-muted mb-1 block uppercase tracking-wider">Sales Representative</label>
        <div className="relative mb-4" ref={salesRepDropRef}>
          <div className="input cursor-pointer flex items-center justify-between py-1.5 px-3 text-xs" onClick={() => setSalesRepDropOpen(!salesRepDropOpen)}>
            {selectedUserId ? (
              <span className="truncate">{salesUsers.find(u => u.id === selectedUserId)?.userCode} — {salesUsers.find(u => u.id === selectedUserId)?.firstName}</span>
            ) : (
              <span className="text-text-muted italic">Select Rep...</span>
            )}
            <HiX className={`text-xs ml-2 hover:text-red-400 ${selectedUserId ? 'visible' : 'invisible'}`} onClick={e => { e.stopPropagation(); setSelectedUserId(''); }} />
          </div>
          {salesRepDropOpen && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-bg-card border border-bg-border rounded-lg shadow-2xl overflow-hidden animate-zoom-in">
              <input autoFocus type="text" placeholder="Filter reps..." className="w-full bg-bg-base border-b border-bg-border px-3 py-2 text-xs focus:outline-none" value={salesRepSearch} onChange={e => setSalesRepSearch(e.target.value)} onClick={e => e.stopPropagation()} />
              <div className="max-h-48 overflow-y-auto">
                {salesUsers.filter(u => u.userCode.toLowerCase().includes(salesRepSearch.toLowerCase()) || u.firstName.toLowerCase().includes(salesRepSearch.toLowerCase())).map(u => (
                  <div key={u.id} className={`px-3 py-2 text-xs cursor-pointer hover:bg-bg-hover flex items-center justify-between ${selectedUserId === u.id ? 'bg-accent/10 text-accent' : 'text-text-primary'}`} onClick={() => { setSelectedUserId(u.id); setSalesRepDropOpen(false); }}>
                    <span>{u.userCode} — {u.firstName}</span>
                    {selectedUserId === u.id && <HiCheck className="text-accent" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedUserId && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <label className="text-[10px] text-text-muted mb-2 block uppercase tracking-wider">Available Territories</label>
            <div className="flex-1 min-h-0 overflow-y-auto border border-bg-border rounded-lg p-2 bg-bg-base/30 space-y-1 mb-4">
              {allTerritories.map(t => (
                <label key={t.id} className={`flex items-center gap-2 cursor-pointer hover:bg-bg-hover rounded px-2 py-1.5 transition-colors ${selectedTerritoryIds.has(t.id) ? 'bg-accent/5' : ''}`}>
                  <input type="checkbox" checked={selectedTerritoryIds.has(t.id)} onChange={() => toggleTerritorySelection(t.id)} className="accent-accent w-3.5 h-3.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-text-primary font-medium truncate">{t.name}</p>
                    <p className="text-[9px] text-text-subtle truncate">{t.state} · {t.region}</p>
                  </div>
                </label>
              ))}
            </div>
            <button onClick={assignTerritories} disabled={assigning || selectedTerritoryIds.size === 0} className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-2 flex-shrink-0">
              {assigning ? 'Assigning...' : `Assign Selected (${selectedTerritoryIds.size})`}
            </button>
            {assignMsg && <p className="text-[10px] mt-2 text-center" style={{ color: assignMsg.includes('✅') ? '#22c55e' : '#ef4444' }}>{assignMsg}</p>}
          </div>
        )}
      </div>

      {/* Currently Assigned Panel */}
      <div className="flex flex-col min-h-0 p-6 bg-bg-base/20">
        <h3 className="text-text-primary font-semibold text-xs uppercase opacity-80 mb-1">Current Assignments</h3>
        {selectedUserId ? (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
            {loadingAssigned ? <p className="text-center py-4 text-[10px] text-text-muted">Loading...</p> : assignedTerritories.length === 0 ? <p className="text-center py-8 text-[10px] text-text-muted italic">No territories assigned yet</p> : (
              assignedTerritories.map(t => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg border border-bg-border bg-bg-card group">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-text-primary truncate">{t.name}</p>
                    <p className="text-[9px] text-text-subtle">{t.state} · {t.region}</p>
                  </div>
                  <button onClick={() => removeAssignment(t.id)} className="text-red-400 hover:text-red-300 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"><HiX className="text-sm" /></button>
                </div>
              ))
            )}
          </div>
        ) : <p className="text-center py-20 text-[10px] text-text-muted italic">Select a rep to view assignments</p>}
      </div>
    </div>
  );

  return (
    <Layout title="Admin Central" subtitle="System Configuration & Management" fixedHeight={true}>
      <div className="flex-1 min-h-0 flex flex-col gap-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
          {[
            { label: 'Total Reps', value: salesUsers.length, icon: HiUsers, color: 'text-blue-400' },
            { label: 'Unassigned', value: allTerritories.filter(t => !assignedTerritories.find(a => a.id === t.id)).length, icon: HiMap, color: 'text-indigo-400' },
            { label: 'Districts', value: new Set(allTerritories.map(t => t.state)).size, icon: HiLocationMarker, color: 'text-green-400' },
            { label: 'Products', value: products.length, icon: HiCollection, color: 'text-amber-400' },
          ].map(c => (
            <div key={c.label} className="stat-card card-hover">
              <span className="stat-card-label">{c.label}</span>
              <div className="flex items-center gap-2">
                <span className="stat-card-value text-base">{loading ? '—' : c.value}</span>
                <c.icon className={`${c.color} text-base opacity-70`} />
              </div>
            </div>
          ))}
        </div>

        {/* content area */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-bg-card border border-bg-border rounded-xl shadow-lg">
          <div className="flex items-center gap-6 px-6 border-b border-bg-border flex-shrink-0 h-12">
            {[
              { id: 'users', label: 'Users' },
              { id: 'products', label: 'Products' },
              { id: 'territories', label: 'Territories' }
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)} className={`h-full text-[10px] font-bold uppercase tracking-widest relative transition-colors ${tab === t.id ? 'text-accent' : 'text-text-muted hover:text-text-primary'}`}>
                {t.label}
                {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {tab === 'users' && renderUsers()}
            {tab === 'products' && renderProducts()}
            {tab === 'territories' && renderTerritories()}
          </div>
        </div>
      </div>

      {/* Side Modal for Creating User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-sm bg-bg-surface border-l border-bg-border shadow-2xl flex flex-col h-full animate-slide-in">
            <div className="px-6 py-5 border-b border-bg-border bg-bg-base/30 flex items-center justify-between">
              <div><h3 className="text-text-primary font-bold">New Sales Rep</h3><p className="text-[10px] text-text-subtle">Onboarding registration</p></div>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted"><HiX className="text-lg" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-text-muted uppercase">First Name</label>
                  <input className="input text-xs py-1.5" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-text-muted uppercase">Last Name</label>
                  <input className="input text-xs py-1.5" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-text-muted uppercase">Email Address</label>
                <input className="input text-xs py-1.5" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-text-muted uppercase">Phone Number</label>
                <input className="input text-xs py-1.5" placeholder="+91..." value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} />
              </div>
            </div>
            <div className="p-6 border-t border-bg-border bg-bg-base/30">
              <button onClick={createUser} disabled={creating} className="btn-primary w-full py-2.5 text-xs flex justify-center">{creating ? 'Creating...' : 'Register Rep'}</button>
              {createMsg && <p className="text-[10px] mt-2 text-center" style={{ color: createMsg.includes('✅') ? '#22c55e' : '#ef4444' }}>{createMsg}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Side Modal for Creating Product */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsProductModalOpen(false)} />
          <div className="relative w-full max-sm bg-bg-surface border-l border-bg-border shadow-2xl flex flex-col h-full animate-slide-in">
            <div className="px-6 py-5 border-b border-bg-border bg-bg-base/30 flex items-center justify-between">
              <div><h3 className="text-text-primary font-bold">New Product</h3><p className="text-[10px] text-text-subtle">Inventory definition</p></div>
              <button onClick={() => setIsProductModalOpen(false)} className="text-text-muted"><HiX className="text-lg" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-text-muted uppercase">Product Name</label>
                <input className="input text-xs py-1.5" value={pForm.name} onChange={e => setPForm({ ...pForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-text-muted uppercase">Category</label>
                <input className="input text-xs py-1.5" value={pForm.category} onChange={e => setPForm({ ...pForm, category: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-text-muted uppercase">Price (₹)</label>
                <input className="input text-xs py-1.5" type="number" value={pForm.price} onChange={e => setPForm({ ...pForm, price: e.target.value })} />
              </div>
            </div>
            <div className="p-6 border-t border-bg-border bg-bg-base/30">
              <button onClick={createProduct} disabled={pCreating} className="btn-primary w-full py-2.5 text-xs flex justify-center">{pCreating ? 'Adding...' : 'Add to Catalogue'}</button>
              {pCreateMsg && <p className="text-[10px] mt-2 text-center" style={{ color: pCreateMsg.includes('✅') ? '#22c55e' : '#ef4444' }}>{pCreateMsg}</p>}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
