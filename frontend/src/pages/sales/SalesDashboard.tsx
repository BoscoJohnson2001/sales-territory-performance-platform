import { useEffect, useRef, useState, FormEvent, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import Layout from '../../components/Layout';
import client from '../../api/client';
import {
  HiCurrencyRupee, HiShoppingBag, HiTrendingUp,
  HiPlus, HiSave, HiX, HiCheckCircle, HiExclamationCircle,
  HiChevronLeft, HiChevronRight, HiFlag,
} from 'react-icons/hi';

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
interface Sale {
  id: string; saleDate: string; revenue: string; deals: number;
  Territory?: { name: string };
  Product?: { name: string };
  Customer?: { name: string };
}

// ─── Sale Modal ─────────────────────────────────────────────────────────────
interface SaleModalProps {
  products: Product[];
  territories: Territory[];
  onClose: () => void;
  onSuccess: () => void;
}

const emptyForm = {
  productId: '', territoryId: '', revenue: '', deals: '',
  quantity: '', saleDate: '', month: '', year: '',
  customerName: '', customerIndustry: '', customerContact: '',
};

function SaleRecordModal({ products, territories, onClose, onSuccess }: SaleModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on overlay click
  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const f = (key: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      await client.post('/api/sales', {
        ...form,
        month: parseInt(form.month),
        year: parseInt(form.year),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create sale. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlay}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-white/10 shadow-2xl"
        style={{ background: 'rgba(15,23,42,0.97)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-text-primary font-bold text-base">New Sale Record</h2>
            <p className="text-text-subtle text-xs mt-0.5">Fill in the details to log a new sale</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors">
            <HiX className="text-xl" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="px-6 py-5">
          {error && (
            <div className="mb-4 px-4 py-2.5 rounded-lg text-sm text-red-400 border border-red-500/30 flex items-center gap-2"
              style={{ background: 'rgba(239,68,68,0.08)' }}>
              <HiExclamationCircle className="text-lg flex-shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Product */}
            <div className="flex flex-col gap-1">
              <label className="text-text-muted text-xs font-medium uppercase tracking-wider">Product</label>
              <select id="modal-product" className="input" value={form.productId} onChange={f('productId')} required>
                <option value="">Select Product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Territory */}
            <div className="flex flex-col gap-1">
              <label className="text-text-muted text-xs font-medium uppercase tracking-wider">Territory</label>
              <select id="modal-territory" className="input" value={form.territoryId} onChange={f('territoryId')} required>
                <option value="">Select Territory</option>
                {territories.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* Revenue */}
            <div className="flex flex-col gap-1">
              <label className="text-text-muted text-xs font-medium uppercase tracking-wider">Revenue (₹)</label>
              <input id="modal-revenue" className="input" placeholder="0.00" type="number" step="0.01" min="0"
                value={form.revenue} onChange={f('revenue')} required />
            </div>

            {/* Deals */}
            <div className="flex flex-col gap-1">
              <label className="text-text-muted text-xs font-medium uppercase tracking-wider">Deals</label>
              <input id="modal-deals" className="input" placeholder="0" type="number" min="0"
                value={form.deals} onChange={f('deals')} required />
            </div>

            {/* Quantity */}
            <div className="flex flex-col gap-1">
              <label className="text-text-muted text-xs font-medium uppercase tracking-wider">Quantity</label>
              <input id="modal-quantity" className="input" placeholder="0" type="number" min="0"
                value={form.quantity} onChange={f('quantity')} required />
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-text-muted text-xs font-medium uppercase tracking-wider">Sale Date</label>
              <input id="modal-date" className="input" type="date"
                value={form.saleDate}
                onChange={e => {
                  const d = new Date(e.target.value);
                  setForm(prev => ({
                    ...prev, saleDate: e.target.value,
                    month: String(d.getMonth() + 1),
                    year: String(d.getFullYear()),
                  }));
                }}
                required />
            </div>

            {/* Customer Name */}
            <div className="flex flex-col gap-1">
              <label className="text-text-muted text-xs font-medium uppercase tracking-wider">Customer Name</label>
              <input id="modal-customer" className="input" placeholder="e.g. Apollo Hospitals"
                value={form.customerName} onChange={f('customerName')} required />
            </div>

            {/* Industry */}
            <div className="flex flex-col gap-1">
              <label className="text-text-muted text-xs font-medium uppercase tracking-wider">Industry</label>
              <input id="modal-industry" className="input" placeholder="e.g. Healthcare"
                value={form.customerIndustry} onChange={f('customerIndustry')} />
            </div>

            {/* Contact */}
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-text-muted text-xs font-medium uppercase tracking-wider">Contact</label>
              <input id="modal-contact" className="input" placeholder="Phone or email"
                value={form.customerContact} onChange={f('customerContact')} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-white/10">
            <button type="button" onClick={onClose} className="btn-secondary py-2 text-sm">
              Cancel
            </button>
            <button id="modal-submit" type="submit" disabled={submitting} className="btn-primary py-2 text-sm flex items-center gap-2">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                <>
                  <HiSave className="text-base" />
                  Save Sale
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── My Monthly Target Widget ────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS_LIST = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i);

interface PerfData {
  targetAmount: number | null;
  achievedRevenue: number;
  performancePercentage: number | null;
  status: 'EXCEEDED' | 'ACHIEVED' | 'BELOW' | 'NO_TARGET';
}

function MyMonthlyTarget() {
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [perf, setPerf] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    client
      .get(`/api/sales/my-performance?month=${selMonth}&year=${selYear}`)
      .then(r => setPerf(r.data))
      .catch(() => setPerf(null))
      .finally(() => setLoading(false));
  }, [selMonth, selYear]);

  const pct = perf?.performancePercentage ?? 0;
  const capped = Math.min(pct, 100);
  const status = perf?.status ?? 'NO_TARGET';

  const barColor =
    status === 'EXCEEDED' ? '#60a5fa'
      : status === 'ACHIEVED' ? '#4ade80'
        : status === 'BELOW' ? '#f87171'
          : '#4b5563';

  const statusBadge = {
    EXCEEDED: { text: '▲ Exceeded', bg: 'bg-blue-500/15', border: 'border-blue-500/30', color: 'text-blue-400' },
    ACHIEVED: { text: '✓ Achieved', bg: 'bg-green-500/15', border: 'border-green-500/30', color: 'text-green-400' },
    BELOW: { text: '✗ Below', bg: 'bg-red-500/15', border: 'border-red-500/30', color: 'text-red-400' },
    NO_TARGET: { text: '— No Target', bg: 'bg-white/5', border: 'border-white/10', color: 'text-text-muted' },
  }[status];

  const achieved = perf?.achievedRevenue ?? 0;
  const target = perf?.targetAmount;
  const remaining = target !== null && target !== undefined ? Math.max(0, target - achieved) : null;

  return (
    <div className="card card-hover flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-primary font-semibold flex items-center gap-2">
          <HiFlag className="text-amber-400" /> My Monthly Target
        </h3>
        <div className="flex items-center gap-2">
          <select
            className="input py-1 text-xs"
            value={selMonth}
            onChange={e => setSelMonth(parseInt(e.target.value))}
          >
            {MONTHS_SHORT.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            className="input py-1 text-xs"
            value={selYear}
            onChange={e => setSelYear(parseInt(e.target.value))}
          >
            {YEARS_LIST.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-text-muted text-sm gap-2">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          {/* KPI mini-cards */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { label: 'Target', value: target !== null && target !== undefined ? `₹${Number(target).toLocaleString()}` : '—', color: 'text-text-primary' },
              { label: 'Achieved', value: `₹${Number(achieved).toLocaleString()}`, color: barColor },
              { label: 'Remaining', value: remaining !== null ? `₹${Number(remaining).toLocaleString()}` : '—', color: 'text-text-muted' },
            ].map(c => (
              <div key={c.label} className="rounded-lg p-3 border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="text-text-subtle text-xs mb-1">{c.label}</div>
                <div
                  className="font-bold text-sm"
                  style={{ color: c.color.startsWith('#') ? c.color : undefined }}
                >
                  <span className={c.color.startsWith('#') ? undefined : c.color}>
                    {c.value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>Progress</span>
              <span>{pct > 0 ? `${pct.toFixed(1)}%` : '0%'}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${capped}%`, background: barColor }}
              />
            </div>
          </div>

          {/* Status badge */}
          <div className="flex justify-end">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge.bg} ${statusBadge.border} ${statusBadge.color}`}>
              {statusBadge.text}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Pagination Controls ─────────────────────────────────────────────────────
interface PaginationProps {
  page: number; totalPages: number; total: number;
  onPage: (p: number) => void;
}
function Pagination({ page, totalPages, total, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (page <= 4) return i + 1;
    if (page >= totalPages - 3) return totalPages - 6 + i;
    return page - 3 + i;
  });
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-bg-border">
      <span className="text-text-subtle text-xs">{total} record{total !== 1 ? 's' : ''}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="px-2.5 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1">
          <HiChevronLeft /> Prev
        </button>
        {pages.map(p => (
          <button key={p} onClick={() => onPage(p)}
            className={`w-7 h-7 rounded text-xs font-medium transition-colors ${p === page
              ? 'bg-accent text-black'
              : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}>
            {p}
          </button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
          className="px-2.5 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1">
          Next <HiChevronRight />
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function SalesDashboard() {
  const [dash, setDash] = useState<DashData | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const fetchSales = useCallback(async (p = page) => {
    const sr = await client.get(`/api/sales?page=${p}&limit=5`);
    setSales(sr.data.sales || []);
    setTotal(sr.data.total || 0);
    setTotalPages(sr.data.pages || 1);
  }, [page]);

  const fetchAll = async () => {
    setLoading(true);
    const [dr, sr, pr, tr] = await Promise.all([
      client.get('/api/dashboard/sales'),
      client.get('/api/sales?page=1&limit=5'),
      client.get('/api/sales/products').catch(() => ({ data: [] })),
      client.get('/api/sales/territories').catch(() => ({ data: [] })),
    ]);
    setDash(dr.data);
    setSales(sr.data.sales || []);
    setTotal(sr.data.total || 0);
    setTotalPages(sr.data.pages || 1);
    setPage(1);
    setProducts(pr.data);
    setTerritories(tr.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchSales(p);
  };

  const handleSaleSuccess = () => {
    setShowModal(false);
    setPage(1);
    fetchAll();
    showToast('✅ Sale recorded successfully!');
  };

  return (
    <Layout title="My Dashboard" subtitle="Personal Sales Performance & Records">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] max-w-xs px-4 py-3 rounded-xl text-sm text-white shadow-2xl border border-white/10 flex items-center gap-3"
          style={{ background: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(8px)' }}>
          {toast.startsWith('✅') ? <HiCheckCircle className="text-green-400 text-lg flex-shrink-0" /> : <HiExclamationCircle className="text-red-400 text-lg flex-shrink-0" />}
          <span>{toast.replace(/^[✅❌]/, '').trim()}</span>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <SaleRecordModal
          products={products}
          territories={territories}
          onClose={() => setShowModal(false)}
          onSuccess={handleSaleSuccess}
        />
      )}

      {/* ── Viewport-locked layout ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 140px)' }}>

        {/* KPI Cards — fixed height */}
        <div className="grid grid-cols-3 gap-4 flex-shrink-0 p-1 -m-1">
          {[
            { label: 'My Revenue', value: loading ? '—' : `₹${Number(dash?.totalRevenue || 0).toLocaleString()}`, icon: HiCurrencyRupee, color: 'text-amber-400' },
            { label: 'Total Deals', value: loading ? '—' : dash?.totalDeals ?? 0, icon: HiShoppingBag, color: 'text-blue-400' },
            { label: 'Avg Deal Size', value: loading ? '—' : `₹${Number(dash?.averageDealSize || 0).toFixed(0)}`, icon: HiTrendingUp, color: 'text-green-400' },
          ].map(c => (
            <div key={c.label} className="stat-card card-hover">
              <div className="flex justify-between items-start mb-1">
                <span className="stat-card-label">{c.label}</span>
                <c.icon className={`text-lg ${c.color}`} />
              </div>
              <span className="stat-card-value">{c.value}</span>
            </div>
          ))}
        </div>

        {/* Monthly Trend Chart — fixed height */}
        <div className="card card-hover flex-shrink-0">
          <h3 className="text-text-primary font-semibold mb-3">Monthly Revenue Trend</h3>
          <div className="h-36">
            {!loading && (
              <Line data={{
                labels: dash?.monthlyTrend.map(m => `${MONTHS[m.month - 1]} ${m.year}`) || [],
                datasets: [{
                  label: 'Revenue',
                  data: dash?.monthlyTrend.map(m => m.revenue) || [],
                  borderColor: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)',
                  tension: 0.4, fill: true, pointBackgroundColor: '#eab308',
                }],
              }} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
                  y: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
                },
              }} />
            )}
          </div>
        </div>

        {/* My Monthly Target */}
        <MyMonthlyTarget />

        {/* Sales Records — flex-1, no external scroll */}
        <div className="card card-hover flex flex-col min-h-0 flex-1 overflow-hidden p-0">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-bg-border flex-shrink-0">
            <div>
              <h3 className="text-text-primary font-semibold">My Sales Records</h3>
              {!loading && <p className="text-text-subtle text-xs mt-0.5">{total} total records</p>}
            </div>
            <button id="open-sale-modal" onClick={() => setShowModal(true)}
              className="btn-primary py-1.5 text-xs flex items-center gap-2">
              <HiPlus /> Add Sale
            </button>
          </div>

          {/* Table — fixed height, NO internal scroll, exactly 5 rows */}
          <div className="overflow-hidden">
            <table className="table">
              <thead className="sticky top-0 z-10" style={{ background: '#0d1117' }}>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Product</th>
                  <th className="th">Territory</th>
                  <th className="th">Revenue</th>
                  <th className="th">Deals</th>
                  <th className="th">Customer</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="td text-center text-text-muted py-10">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      Loading…
                    </div>
                  </td></tr>
                ) : sales.length === 0 ? (
                  <tr><td colSpan={6} className="td text-center text-text-muted py-10">
                    No sales records yet.{' '}
                    <button onClick={() => setShowModal(true)} className="text-accent hover:underline">
                      Add your first sale
                    </button>
                  </td></tr>
                ) : (
                  sales.map(s => (
                    <tr key={s.id} className="tr-hover">
                      <td className="td text-text-muted text-xs">{new Date(s.saleDate).toLocaleDateString()}</td>
                      <td className="td">{s.Product?.name ?? '—'}</td>
                      <td className="td">{s.Territory?.name ?? '—'}</td>
                      <td className="td text-accent font-semibold">₹{parseFloat(s.revenue).toLocaleString()}</td>
                      <td className="td">{s.deals}</td>
                      <td className="td text-text-muted">{s.Customer?.name ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Spacer — pushes pagination to the very bottom of the card */}
          <div className="flex-1" />

          {/* Pagination — always pinned to bottom of card */}
          <div className="flex-shrink-0 border-t border-bg-border">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              onPage={handlePageChange}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
