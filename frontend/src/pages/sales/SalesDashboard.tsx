import { useEffect, useState, FormEvent } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import Layout from '../../components/Layout';
import client from '../../api/client';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DashData {
  totalRevenue: number; totalDeals: number; averageDealSize: number;
  monthlyTrend: { year: number; month: number; revenue: number }[];
  topCustomers: { id: string; name: string; industry: string }[];
  territories: { id: string; name: string }[];
}
interface Product { id: string; name: string; }
interface Territory { id: string; name: string; }
interface Sale { id: string; saleDate: string; revenue: string; deals: number; territory: { name: string }; product: { name: string }; customer: { name: string }; }

export default function SalesDashboard() {
  const [dash, setDash] = useState<DashData | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const emptyForm = { productId: '', revenue: '', territoryId: '', saleDate: '', month: '', year: '', deals: '', quantity: '', customerName: '', customerIndustry: '', customerLocation: '', customerContact: '' };
  const [form, setForm] = useState(emptyForm);

  const fetchAll = async () => {
    setLoading(true);
    const [dr, sr, pr, tr] = await Promise.all([
      client.get('/api/dashboard/sales'),
      client.get('/api/sales'),
      client.get('/api/sales/products').catch(() => ({ data: [] })),
      client.get('/api/sales/territories').catch(() => ({ data: [] })),
    ]);
    setDash(dr.data); setSales(sr.data.sales || []); setProducts(pr.data); setTerritories(tr.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setSubmitting(true); setMsg('');
    try {
      await client.post('/api/sales', { ...form, month: parseInt(form.month), year: parseInt(form.year) });
      setMsg('✅ Sale recorded successfully!'); setForm(emptyForm); setShowForm(false); fetchAll();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMsg(`❌ ${err.response?.data?.message || 'Failed to create sale'}`);
    } finally { setSubmitting(false); }
  };

  return (
    <Layout title="My Dashboard" subtitle="Personal Sales Performance &amp; Records">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'My Revenue', value: loading ? '—' : `$${Number(dash?.totalRevenue || 0).toLocaleString()}` },
          { label: 'Total Deals', value: loading ? '—' : dash?.totalDeals ?? 0 },
          { label: 'Avg Deal Size', value: loading ? '—' : `$${Number(dash?.averageDealSize || 0).toFixed(0)}` },
        ].map(c => (
          <div key={c.label} className="stat-card card-hover">
            <span className="stat-card-label">{c.label}</span>
            <span className="stat-card-value">{c.value}</span>
          </div>
        ))}
      </div>

      {/* Monthly Trend */}
      <div className="card mb-6">
        <h3 className="text-text-primary font-semibold mb-4">Monthly Revenue Trend</h3>
        <div className="h-40">
          {!loading && (
            <Line data={{
              labels: dash?.monthlyTrend.map(m => `${MONTHS[m.month - 1]} ${m.year}`) || [],
              datasets: [{ label: 'Revenue', data: dash?.monthlyTrend.map(m => m.revenue) || [], borderColor: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)', tension: 0.4, fill: true, pointBackgroundColor: '#eab308' }]
            }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } }, y: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } } } }} />
          )}
        </div>
      </div>

      {/* Add Sale */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-text-primary font-semibold">My Sales Records</h3>
        <button id="toggle-add-sale" onClick={() => setShowForm(s => !s)} className="btn-primary py-1.5 text-xs">
          {showForm ? 'Cancel' : '+ Add Sale'}
        </button>
      </div>

      {msg && <p className="mb-4 text-sm" style={{ color: msg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>{msg}</p>}

      {showForm && (
        <div className="card mb-6 animate-slide-in">
          <h4 className="text-text-primary font-semibold mb-4">New Sale Record</h4>
          <form id="add-sale-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
            <select id="sale-product" className="input" value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} required>
              <option value="">Select Product</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select id="sale-territory" className="input" value={form.territoryId} onChange={e => setForm(f => ({ ...f, territoryId: e.target.value }))} required>
              <option value="">Select Territory</option>
              {territories.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input className="input" placeholder="Revenue" type="number" step="0.01" value={form.revenue} onChange={e => setForm(f => ({ ...f, revenue: e.target.value }))} required />
            <input className="input" placeholder="Deals" type="number" value={form.deals} onChange={e => setForm(f => ({ ...f, deals: e.target.value }))} required />
            <input className="input" placeholder="Quantity" type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required />
            <input className="input" type="date" value={form.saleDate} onChange={e => { const d = new Date(e.target.value); setForm(f => ({ ...f, saleDate: e.target.value, month: String(d.getMonth() + 1), year: String(d.getFullYear()) })) }} required />
            <input className="input" placeholder="Customer Name" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} required />
            <input className="input" placeholder="Industry" value={form.customerIndustry} onChange={e => setForm(f => ({ ...f, customerIndustry: e.target.value }))} />
            <input className="input" placeholder="Location" value={form.customerLocation} onChange={e => setForm(f => ({ ...f, customerLocation: e.target.value }))} />
            <input className="input" placeholder="Contact" value={form.customerContact} onChange={e => setForm(f => ({ ...f, customerContact: e.target.value }))} />
            <button id="submit-sale" type="submit" disabled={submitting} className="btn-primary col-span-2 justify-center">
              {submitting ? 'Saving...' : 'Add Sale Record'}
            </button>
          </form>
        </div>
      )}

      {/* Sales Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th className="th">Date</th><th className="th">Product</th><th className="th">Territory</th><th className="th">Revenue</th><th className="th">Deals</th><th className="th">Customer</th></tr></thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id} className="tr-hover">
                  <td className="td text-text-muted text-xs">{new Date(s.saleDate).toLocaleDateString()}</td>
                  <td className="td">{s.product.name}</td>
                  <td className="td">{s.territory.name}</td>
                  <td className="td text-accent font-semibold">${parseFloat(s.revenue).toLocaleString()}</td>
                  <td className="td">{s.deals}</td>
                  <td className="td text-text-muted">{s.customer.name}</td>
                </tr>
              ))}
              {sales.length === 0 && !loading && (
                <tr><td colSpan={6} className="td text-center text-text-muted py-8">No sales records yet. Add your first sale!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
