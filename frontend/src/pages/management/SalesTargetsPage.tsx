import { useEffect, useState, FormEvent } from 'react';
import Layout from '../../components/Layout';
import client from '../../api/client';
import {
    HiFlag,
    HiSave,
    HiCheckCircle,
    HiExclamationCircle,
    HiChevronLeft,
    HiChevronRight,
    HiTrendingUp,
} from 'react-icons/hi';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

interface SalesUser { id: string; firstName: string; lastName: string; userCode: string; }
interface PerfRow {
    salesUserId: string; name: string; userCode: string;
    targetAmount: number; achievedRevenue: number;
    performancePercentage: number; status: 'ACHIEVED' | 'EXCEEDED' | 'BELOW';
}

const now = new Date();

function StatusBadge({ status }: { status: PerfRow['status'] }) {
    if (status === 'EXCEEDED') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            ▲ Exceeded
        </span>
    );
    if (status === 'ACHIEVED') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/30">
            ✓ Achieved
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
            ✗ Below
        </span>
    );
}

function ProgressBar({ pct, status }: { pct: number; status: PerfRow['status'] }) {
    const capped = Math.min(pct, 100);
    const color = status === 'EXCEEDED' ? 'bg-blue-400' : status === 'ACHIEVED' ? 'bg-green-400' : 'bg-red-400';
    return (
        <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${color}`}
                    style={{ width: `${capped}%` }}
                />
            </div>
            <span className="text-xs text-text-muted w-11 text-right">{pct.toFixed(1)}%</span>
        </div>
    );
}

export default function SalesTargetsPage() {
    // ── Form state ──────────────────────────────────────────────────────────────
    const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
    const [form, setForm] = useState({
        salesUserId: '',
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
        targetAmount: '',
    });
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const showToast = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
        client.get('/api/management/sales-users')
            .then(r => setSalesUsers(r.data))
            .catch(() => setSalesUsers([]));
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await client.post('/api/management/sales-target', {
                salesUserId: form.salesUserId,
                month: parseInt(form.month),
                year: parseInt(form.year),
                targetAmount: parseFloat(form.targetAmount),
            });
            const action = res.data.action === 'updated' ? 'updated' : 'saved';
            showToast(`✅ Target ${action} successfully`, true);
            setForm(f => ({ ...f, targetAmount: '', salesUserId: '' }));
            fetchPerformance(perfMonth, perfYear, 1);
        } catch (err: any) {
            showToast(err?.response?.data?.message || 'Failed to save target', false);
        } finally {
            setSaving(false);
        }
    };

    // ── Performance table state ─────────────────────────────────────────────────
    const [perfMonth, setPerfMonth] = useState(now.getMonth() + 1);
    const [perfYear, setPerfYear] = useState(now.getFullYear());
    const [perfData, setPerfData] = useState<PerfRow[]>([]);
    const [perfLoading, setPerfLoading] = useState(false);
    const [perfPage, setPerfPage] = useState(1);
    const [perfTotal, setPerfTotal] = useState(0);
    const [perfPages, setPerfPages] = useState(1);
    const LIMIT = 10;

    const fetchPerformance = async (month: number, year: number, page: number) => {
        setPerfLoading(true);
        try {
            const r = await client.get(`/api/management/sales-performance?month=${month}&year=${year}&page=${page}&limit=${LIMIT}`);
            setPerfData(r.data.data || []);
            setPerfTotal(r.data.total || 0);
            setPerfPages(r.data.pages || 1);
            setPerfPage(page);
        } catch {
            setPerfData([]);
        } finally {
            setPerfLoading(false);
        }
    };

    useEffect(() => {
        fetchPerformance(perfMonth, perfYear, 1);
    }, [perfMonth, perfYear]);

    return (
        <Layout title="Sales Targets" subtitle="Assign and Monitor Monthly Revenue Goals">
            <div className="flex flex-col gap-6">

                {/* Toast */}
                {toast && (
                    <div
                        className="fixed top-4 right-4 z-[9999] max-w-xs px-4 py-3 rounded-xl text-sm text-white shadow-2xl border border-white/10 flex items-center gap-3"
                        style={{ background: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(8px)' }}
                    >
                        {toast.ok
                            ? <HiCheckCircle className="text-green-400 text-lg flex-shrink-0" />
                            : <HiExclamationCircle className="text-red-400 text-lg flex-shrink-0" />}
                        <span>{toast.msg.replace(/^[✅❌]/, '').trim()}</span>
                    </div>
                )}

                {/* ── Target Assignment Form ──────────────────────────────────────────── */}
                <div className="card">
                    <h3 className="text-text-primary font-semibold mb-4 flex items-center gap-2">
                        <HiFlag className="text-amber-400" /> Set Monthly Sales Target
                    </h3>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
                            {/* Sales User */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-text-muted text-xs font-semibold uppercase tracking-wider">Sales Representative</label>
                                <select
                                    id="target-sales-user"
                                    className="input"
                                    value={form.salesUserId}
                                    onChange={e => setForm(f => ({ ...f, salesUserId: e.target.value }))}
                                    required
                                >
                                    <option value="">Select Representative</option>
                                    {salesUsers.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.firstName}{u.lastName ? ' ' + u.lastName : ''} ({u.userCode})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Month */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-text-muted text-xs font-semibold uppercase tracking-wider">Target Month</label>
                                <select
                                    id="target-month"
                                    className="input"
                                    value={form.month}
                                    onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                                    required
                                >
                                    {MONTHS.map((m, i) => (
                                        <option key={m} value={i + 1}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Year */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-text-muted text-xs font-semibold uppercase tracking-wider">Target Year</label>
                                <select
                                    id="target-year"
                                    className="input"
                                    value={form.year}
                                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                                    required
                                >
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>

                            {/* Target Amount */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-text-muted text-xs font-semibold uppercase tracking-wider">Revenue Target (₹)</label>
                                <input
                                    id="target-amount"
                                    className="input"
                                    type="number"
                                    min="0"
                                    step="100"
                                    placeholder="e.g. 500000"
                                    value={form.targetAmount}
                                    onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))}
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                id="target-save"
                                type="submit"
                                disabled={saving}
                                className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2"
                            >
                                {saving ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                                        Saving…
                                    </span>
                                ) : (
                                    <><HiSave className="text-base" /> Set Monthly Target</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* ── Performance Table ───────────────────────────────────────────────── */}
                <div className="card p-0 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border flex-shrink-0 bg-white/5">
                        <div>
                            <h3 className="text-text-primary font-semibold flex items-center gap-2">
                                <HiTrendingUp className="text-amber-400" /> Sales Performance Overview
                            </h3>
                            {!perfLoading && (
                                <p className="text-text-subtle text-xs mt-0.5">{perfTotal} representative{perfTotal !== 1 ? 's' : ''} assigned for this period</p>
                            )}
                        </div>

                        {/* Month / Year filter */}
                        <div className="flex items-center gap-3">
                            <select
                                className="input py-1.5 text-xs bg-bg-surface"
                                value={perfMonth}
                                onChange={e => setPerfMonth(parseInt(e.target.value))}
                            >
                                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                            </select>
                            <select
                                className="input py-1.5 text-xs bg-bg-surface"
                                value={perfYear}
                                onChange={e => setPerfYear(parseInt(e.target.value))}
                            >
                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead className="bg-[#0d1117]">
                                <tr>
                                    <th className="th py-4">Sales Representative</th>
                                    <th className="th py-4">Monthly Target (₹)</th>
                                    <th className="th py-4">Current Revenue (₹)</th>
                                    <th className="th py-4 w-1/4">Progress</th>
                                    <th className="th py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bg-border">
                                {perfLoading ? (
                                    <tr><td colSpan={5} className="td text-center text-text-muted py-16">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                                            <span className="text-sm font-medium">Fetching performance data...</span>
                                        </div>
                                    </td></tr>
                                ) : perfData.length === 0 ? (
                                    <tr><td colSpan={5} className="td text-center text-text-muted py-16">
                                        <div className="flex flex-col items-center gap-2 opacity-60">
                                            <HiFlag className="text-3xl" />
                                            <p className="text-sm">No targets set for {MONTHS[perfMonth - 1]} {perfYear}.</p>
                                            <p className="text-xs">Use the assignment form above to get started.</p>
                                        </div>
                                    </td></tr>
                                ) : (
                                    perfData.map(row => (
                                        <tr key={row.salesUserId} className="tr-hover group">
                                            <td className="td py-4">
                                                <div className="text-text-primary text-sm font-semibold group-hover:text-accent transition-colors">{row.name}</div>
                                                <div className="text-text-subtle text-[11px] font-mono mt-0.5">{row.userCode}</div>
                                            </td>
                                            <td className="td py-4 font-bold text-text-primary">
                                                ₹{row.targetAmount.toLocaleString()}
                                            </td>
                                            <td className="td py-4 font-bold" style={{
                                                color: row.status === 'EXCEEDED' ? '#60a5fa'
                                                    : row.status === 'ACHIEVED' ? '#4ade80'
                                                        : '#f87171'
                                            }}>
                                                ₹{row.achievedRevenue.toLocaleString()}
                                            </td>
                                            <td className="td py-4">
                                                <ProgressBar pct={row.performancePercentage} status={row.status} />
                                            </td>
                                            <td className="td py-4">
                                                <StatusBadge status={row.status} />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {perfPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 bg-white/[0.02]">
                            <span className="text-text-subtle text-xs font-medium">{perfTotal} Total Records</span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => fetchPerformance(perfMonth, perfYear, perfPage - 1)}
                                    disabled={perfPage === 1}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-bg-hover disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center gap-1 border border-transparent hover:border-white/10"
                                >
                                    <HiChevronLeft /> Prev
                                </button>
                                {Array.from({ length: Math.min(perfPages, 7) }, (_, i) => i + 1).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => fetchPerformance(perfMonth, perfYear, p)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${p === perfPage ? 'bg-accent text-black shadow-lg shadow-accent/20' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover border border-transparent hover:border-white/5'}`}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button
                                    onClick={() => fetchPerformance(perfMonth, perfYear, perfPage + 1)}
                                    disabled={perfPage === perfPages}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-bg-hover disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center gap-1 border border-transparent hover:border-white/10"
                                >
                                    Next <HiChevronRight />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
