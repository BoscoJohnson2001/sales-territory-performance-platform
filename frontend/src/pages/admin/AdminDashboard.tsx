import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import client from '../../api/client';

interface User { id: string; userCode: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean; isFirstLogin: boolean; createdAt: string; territories: { name: string }[]; }
interface Product { id: string; name: string; category: string; price: string; }

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'users' | 'products'>('users');

  // Create user form state
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  // Create product form state
  const [pForm, setPForm] = useState({ name: '', category: '', price: '' });
  const [pCreating, setPCreating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [ur, pr] = await Promise.all([client.get('/api/admin/users'), client.get('/api/admin/products')]);
    setUsers(ur.data); setProducts(pr.data); setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const createUser = async () => {
    setCreating(true); setCreateMsg('');
    try {
      const res = await client.post('/api/admin/users', form);
      setCreateMsg(`✅ Created: ${res.data.userCode} — Onboarding email sent.`);
      setForm({ firstName: '', lastName: '', email: '' }); fetchData();
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

  const totalActive = users.filter(u => u.isActive).length;
  const salesReps = users.filter(u => u.role === 'SALES').length;

  return (
    <Layout title="Admin Dashboard" subtitle="Pfizer Medical Industries — System Administration">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Users', value: users.length, sub: 'All roles' },
          { label: 'Active Users', value: totalActive, sub: 'Currently active' },
          { label: 'Sales Reps', value: salesReps, sub: 'SL_ accounts' },
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
        {(['users', 'products'] as const).map(t => (
          <button key={t} id={`tab-${t}`}
            onClick={() => setTab(t)}
            className={tab === t ? 'btn-primary py-1.5 text-xs' : 'btn-secondary py-1.5 text-xs'}>
            {t === 'users' ? 'Users' : 'Products'}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Create User */}
          <div className="card">
            <h3 className="text-text-primary font-semibold mb-4">Create Sales Rep</h3>
            <div className="flex flex-col gap-3">
              <input id="new-user-first" className="input" placeholder="First Name" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              <input id="new-user-last" className="input" placeholder="Last Name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              <input id="new-user-email" className="input" placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
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
                <thead><tr><th className="th">Code</th><th className="th">Name</th><th className="th">Role</th><th className="th">Status</th><th className="th">Action</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="tr-hover">
                      <td className="td font-mono text-accent text-xs">{u.userCode}</td>
                      <td className="td">{u.firstName} {u.lastName}</td>
                      <td className="td"><span className="badge-info">{u.role}</span></td>
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
    </Layout>
  );
}
