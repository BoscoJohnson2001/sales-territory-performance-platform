import { useEffect, useState, FormEvent } from 'react';
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

export default function SalesTargetSection() {
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
    const LIMIT = 8;

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
        <div className="mt-6 flex flex-col gap-6">

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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        {/* Sales User */}
                        <div className="flex flex-col gap-1">
                            <label className="text-text-muted text-xs font-medium uppercase tracking-wider">Sales Rep</label>
                            <select
                                id="target-sales-user"
                                className="input"
                                value={form.salesUserId}
                                onChange={e => setForm(f => ({ ...f, salesUserId: e.target.value }))}
                                required
                            >
                                <option value="">Select Rep</option>
                                {salesUsers.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.firstName}{u.lastName ? ' ' + u.lastName : ''} ({u.userCode})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Month */}
                        <div className="flex flex-col gap-1">
                            <label className="text-text-muted text-xs font-medium uppercase tracking-wider">Month</label>
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
                        <div className="flex flex-col gap-1">
                            <label className="text-text-muted text-xs font-medium uppercase tracking-wider">Year</label>
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
                        <div className="flex flex-col gap-1">
                            <label className="text-text-muted text-xs font-medium uppercase tracking-wider">Target (₹)</label>
                            <input
                                id="target-amount"
                                className="input"
                                type="number"
                                min="1"
                                step="1000"
                                placeholder="e.g. 500000"
                                value={form.targetAmount}
                                onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            id="target-save"
                            type="submit"
                            disabled={saving}
                            className="btn-primary py-2 text-sm flex items-center gap-2"
                        >
                            {saving ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                                    Saving…
                                </span>
                            ) : (
                                <><HiSave className="text-base" /> Save Target</>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* ── Performance Table ───────────────────────────────────────────────── */}
            <div className="card p-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-bg-border flex-shrink-0">
                    <div>
                        <h3 className="text-text-primary font-semibold flex items-center gap-2">
                            <HiTrendingUp className="text-amber-400" /> Sales Performance
                        </h3>
                        {!perfLoading && (
                            <p className="text-text-subtle text-xs mt-0.5">{perfTotal} rep{perfTotal !== 1 ? 's' : ''} with targets</p>
                        )}
                    </div>

                    {/* Month / Year filter */}
                    <div className="flex items-center gap-2">
                        <select
                            className="input py-1 text-xs"
                            value={perfMonth}
                            onChange={e => setPerfMonth(parseInt(e.target.value))}
                        >
                            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </select>
                        <select
                            className="input py-1 text-xs"
                            value={perfYear}
                            onChange={e => setPerfYear(parseInt(e.target.value))}
                        >
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                <div className="overflow-hidden">
                    <table className="table">
                        <thead className="sticky top-0 z-10" style={{ background: '#0d1117' }}>
                            <tr>
                                <th className="th">Sales Rep</th>
                                <th className="th">Target (₹)</th>
                                <th className="th">Achieved (₹)</th>
                                <th className="th">Progress</th>
                                <th className="th">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {perfLoading ? (
                                <tr><td colSpan={5} className="td text-center text-text-muted py-10">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                                        Loading…
                                    </div>
                                </td></tr>
                            ) : perfData.length === 0 ? (
                                <tr><td colSpan={5} className="td text-center text-text-muted py-10">
                                    No targets set for {MONTHS[perfMonth - 1]} {perfYear}. Use the form above to set targets.
                                </td></tr>
                            ) : (
                                perfData.map(row => (
                                    <tr key={row.salesUserId} className="tr-hover">
                                        <td className="td">
                                            <div className="text-text-primary text-sm font-medium">{row.name}</div>
                                            <div className="text-text-subtle text-xs">{row.userCode}</div>
                                        </td>
                                        <td className="td font-semibold text-text-primary">
                                            ₹{row.targetAmount.toLocaleString()}
                                        </td>
                                        <td className="td font-semibold" style={{
                                            color: row.status === 'EXCEEDED' ? '#60a5fa'
                                                : row.status === 'ACHIEVED' ? '#4ade80'
                                                    : '#f87171'
                                        }}>
                                            ₹{row.achievedRevenue.toLocaleString()}
                                        </td>
                                        <td className="td">
                                            <ProgressBar pct={row.performancePercentage} status={row.status} />
                                        </td>
                                        <td className="td">
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
                    <div className="flex items-center justify-between px-5 py-2.5 border-t border-bg-border">
                        <span className="text-text-subtle text-xs">{perfTotal} total</span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => fetchPerformance(perfMonth, perfYear, perfPage - 1)}
                                disabled={perfPage === 1}
                                className="px-2.5 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                            >
                                <HiChevronLeft /> Prev
                            </button>
                            {Array.from({ length: Math.min(perfPages, 7) }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    onClick={() => fetchPerformance(perfMonth, perfYear, p)}
                                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${p === perfPage ? 'bg-accent text-black' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
                                >
                                    {p}
                                </button>
                            ))}
                            <button
                                onClick={() => fetchPerformance(perfMonth, perfYear, perfPage + 1)}
                                disabled={perfPage === perfPages}
                                className="px-2.5 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                            >
                                Next <HiChevronRight />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
