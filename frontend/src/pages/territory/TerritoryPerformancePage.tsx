import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
    HiSearch, HiFilter, HiCalendar, HiX,
    HiChevronDown, HiChevronUp, HiArrowRight,
    HiSelector, HiSortAscending, HiSortDescending,
    HiChartBar
} from 'react-icons/hi';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SalesRep { id: string; displayName: string; userCode: string; }
interface TerritoryRow {
    territoryId: string; territoryName: string; state: string; region: string;
    totalRevenue: number; totalDeals: number; avgDealSize: number;
    assignedSalesReps: SalesRep[];
}
interface RepOption { id: string; displayName: string; userCode: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => `₹${n.toLocaleString()}`;

const RevBadge = ({ revenue, max }: { revenue: number; max: number }) => {
    const pct = max > 0 ? (revenue / max) * 100 : 0;
    const color = pct >= 66 ? '#22c55e' : pct >= 33 ? '#f59e0b' : '#ef4444';
    const label = pct >= 66 ? 'HIGH' : pct >= 33 ? 'MEDIUM' : 'LOW';
    return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: color + '22', color, border: `1px solid ${color}` }}>
            {label}
        </span>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
export default function TerritoryPerformancePage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isMgmt = user?.role === 'MANAGEMENT';

    // Filters
    const [search, setSearch] = useState('');
    const [regionFilter, setRegionFilter] = useState('');
    const [repFilter, setRepFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [dateError, setDateError] = useState('');

    // Data
    const [rows, setRows] = useState<TerritoryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [repOptions, setRepOptions] = useState<RepOption[]>([]);

    // Sort
    const [sortCol, setSortCol] = useState<'totalRevenue' | 'totalDeals' | 'avgDealSize'>('totalRevenue');
    const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

    // Searchable rep dropdown state
    const [repSearch, setRepSearch] = useState('');
    const [repDropOpen, setRepDropOpen] = useState(false);
    const repDropRef = useRef<HTMLDivElement>(null);

    // ── Fetch sales-rep options for MANAGEMENT filter ──────────────────────────
    useEffect(() => {
        if (!isMgmt) return;
        client.get('/api/territory-performance/sales-reps').then(r => {
            setRepOptions((r.data || []).map((u: any) => ({
                id: u.id,
                displayName: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.displayName || '',
                userCode: u.userCode,
            })));
        }).catch(() => { });
    }, [isMgmt]);

    // Close rep dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (repDropRef.current && !repDropRef.current.contains(e.target as Node))
                setRepDropOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Fetch territory data ───────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        // Guard: if both dates given they must be valid range
        if (fromDate && toDate && fromDate > toDate) {
            setDateError('From Date cannot be after To Date.');
            return;
        }
        // Guard: require both dates or neither
        if ((fromDate && !toDate) || (!fromDate && toDate)) return;

        setDateError('');
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (fromDate) params.set('fromDate', fromDate);
            if (toDate) params.set('toDate', toDate);
            if (repFilter) params.set('salesRepId', repFilter);
            const { data } = await client.get<TerritoryRow[]>(`/api/territory-performance?${params}`);
            setRows(data || []);
        } catch (err: any) {
            console.error('[TerritoryPerformance]', err);
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate, repFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Derived ────────────────────────────────────────────────────────────────
    const regions = [...new Set(rows.map(r => r.region).filter(Boolean))].sort();
    const maxRev = Math.max(...rows.map(r => r.totalRevenue), 1);

    const filtered = rows
        .filter(r =>
            (!search || r.territoryName.toLowerCase().includes(search.toLowerCase())
                || r.state?.toLowerCase().includes(search.toLowerCase()))
            && (!regionFilter || r.region === regionFilter)
        )
        .sort((a, b) => sortDir === 'asc' ? a[sortCol] - b[sortCol] : b[sortCol] - a[sortCol]);

    const handleSort = (col: typeof sortCol) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('desc'); }
    };

    const SortIcon = ({ col }: { col: string }) =>
        sortCol === col
            ? <span className="ml-1">{sortDir === 'asc' ? <HiSortAscending className="inline" /> : <HiSortDescending className="inline" />}</span>
            : <HiSelector className="ml-1 opacity-20 inline" />;

    const clearDates = () => { setFromDate(''); setToDate(''); setDateError(''); };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <Layout
            title="Territory Performance"
            subtitle={isMgmt ? 'All India districts — aggregated revenue intelligence' : 'Your assigned territories'}>

            {/* ── Filter bar ─────────────────────────────────────────────────────── */}
            <div className="card mb-5">
                <div className="flex flex-wrap gap-3 items-end">

                    {/* Search */}
                    <div className="flex flex-col gap-1 min-w-[200px]">
                        <label className="text-text-muted text-xs font-medium uppercase tracking-widest flex items-center gap-1.5">
                            <HiSearch className="text-[10px]" /> Search
                        </label>
                        <input id="tp-search" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Territory or state…" className="input text-xs py-1.5" />
                    </div>

                    {/* Region */}
                    <div className="flex flex-col gap-1">
                        <label className="text-text-muted text-xs font-medium uppercase tracking-widest flex items-center gap-1.5">
                            <HiFilter className="text-[10px]" /> Region
                        </label>
                        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
                            className="input text-xs py-1.5 min-w-[140px]">
                            <option value="">All Regions</option>
                            {regions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    {/* Sales Rep — searchable dropdown, Management only */}
                    {isMgmt && (
                        <div className="flex flex-col gap-1" ref={repDropRef}>
                            <label className="text-text-muted text-xs font-medium uppercase tracking-widest">Sales Rep</label>
                            <div className="relative min-w-[210px]">
                                {/* Input shows selected name or search text */}
                                <div className="input text-xs py-1.5 flex items-center gap-1 cursor-pointer"
                                    onClick={() => setRepDropOpen(o => !o)}>
                                    {repFilter ? (
                                        <>
                                            <span className="flex-1 text-text-primary truncate">
                                                {repOptions.find(r => r.id === repFilter)?.displayName}
                                                <span className="ml-1 text-text-subtle text-[10px]">
                                                    ({repOptions.find(r => r.id === repFilter)?.userCode})
                                                </span>
                                            </span>
                                            <button className="text-text-subtle hover:text-text-primary ml-1 flex-shrink-0"
                                                onClick={e => { e.stopPropagation(); setRepFilter(''); setRepSearch(''); setRepDropOpen(false); }}><HiX /></button>
                                        </>
                                    ) : (
                                        <span className="text-text-subtle flex-1">All Reps</span>
                                    )}
                                    <span className="text-text-subtle ml-1 flex-shrink-0">{repDropOpen ? <HiChevronUp /> : <HiChevronDown />}</span>
                                </div>

                                {repDropOpen && (
                                    <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-lg border border-bg-border shadow-2xl overflow-hidden"
                                        style={{ background: '#0d1117', minWidth: 220 }}>
                                        {/* Search input */}
                                        <div className="p-2 border-b border-bg-border">
                                            <input
                                                autoFocus
                                                value={repSearch}
                                                onChange={e => setRepSearch(e.target.value)}
                                                placeholder="Search rep…"
                                                className="w-full bg-bg-hover border border-bg-border rounded-md px-2 py-1 text-xs text-text-primary placeholder-text-subtle focus:outline-none focus:border-accent"
                                                onClick={e => e.stopPropagation()}
                                            />
                                        </div>
                                        {/* Options */}
                                        <div className="max-h-48 overflow-y-auto">
                                            <div
                                                className={`px-3 py-2 text-xs cursor-pointer hover:bg-bg-hover ${!repFilter ? 'text-accent font-semibold' : 'text-text-muted'
                                                    }`}
                                                onClick={() => { setRepFilter(''); setRepSearch(''); setRepDropOpen(false); }}>
                                                All Reps
                                            </div>
                                            {repOptions
                                                .filter(r =>
                                                    !repSearch ||
                                                    r.displayName.toLowerCase().includes(repSearch.toLowerCase()) ||
                                                    r.userCode.toLowerCase().includes(repSearch.toLowerCase())
                                                )
                                                .map(r => (
                                                    <div key={r.id}
                                                        className={`px-3 py-2 text-xs cursor-pointer hover:bg-bg-hover flex items-center justify-between ${repFilter === r.id ? 'bg-accent/10 text-accent' : 'text-text-primary'
                                                            }`}
                                                        onClick={() => { setRepFilter(r.id); setRepSearch(''); setRepDropOpen(false); }}>
                                                        <span>{r.displayName}</span>
                                                        <span className="text-text-subtle text-[10px] ml-2">{r.userCode}</span>
                                                    </div>
                                                ))
                                            }
                                            {repOptions.filter(r =>
                                                !repSearch ||
                                                r.displayName.toLowerCase().includes(repSearch.toLowerCase()) ||
                                                r.userCode.toLowerCase().includes(repSearch.toLowerCase())
                                            ).length === 0 && (
                                                    <div className="px-3 py-3 text-xs text-text-subtle text-center">No reps found</div>
                                                )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* From Date */}
                    <div className="flex flex-col gap-1">
                        <label className="text-text-muted text-xs font-medium uppercase tracking-widest flex items-center gap-1.5">
                            <HiCalendar className="text-[10px]" /> From Date
                        </label>
                        <input type="date" value={fromDate} max={toDate || undefined}
                            onChange={e => { setFromDate(e.target.value); setDateError(''); }}
                            className="input text-xs py-1.5 min-w-[140px]" />
                    </div>

                    {/* To Date */}
                    <div className="flex flex-col gap-1">
                        <label className="text-text-muted text-xs font-medium uppercase tracking-widest flex items-center gap-1.5">
                            <HiCalendar className="text-[10px]" /> To Date
                        </label>
                        <input type="date" value={toDate} min={fromDate || undefined}
                            onChange={e => { setToDate(e.target.value); setDateError(''); }}
                            className="input text-xs py-1.5 min-w-[140px]" />
                    </div>

                    {/* Clear dates */}
                    {(fromDate || toDate) && (
                        <button onClick={clearDates} className="btn-secondary text-xs py-1.5 self-end flex items-center gap-1.5">
                            <HiX /> Clear dates
                        </button>
                    )}

                    {/* Count */}
                    <span className="text-text-muted text-xs ml-auto self-end pb-1.5">
                        {loading ? 'Loading…' : `${filtered.length} territories`}
                    </span>
                </div>

                {/* Date validation error */}
                {dateError && (
                    <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
                        <span>⚠️</span> {dateError}
                    </p>
                )}

                {/* Incomplete date hint */}
                {((fromDate && !toDate) || (!fromDate && toDate)) && !dateError && (
                    <p className="mt-2 text-xs text-amber-400 flex items-center gap-1.5">
                        <span>ℹ️</span> Please select both From and To dates to apply the date filter.
                    </p>
                )}

                {/* Active filter pills */}
                {(fromDate && toDate) && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-text-subtle text-xs">Active filters:</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                            📅 {fromDate} → {toDate}
                        </span>
                        {repFilter && repOptions.find(r => r.id === repFilter) && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                👤 {repOptions.find(r => r.id === repFilter)?.displayName}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* ── Table ──────────────────────────────────────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center h-48 gap-3">
                    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-text-muted text-sm">Loading territory data…</span>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
                    <HiChartBar className="text-5xl text-text-muted opacity-20" />
                    <p className="text-text-muted text-sm">No territories found</p>
                    {!isMgmt && <p className="text-text-subtle text-xs">Ask your admin to assign territories to you.</p>}
                </div>
            ) : (
                <div className="table-wrapper rounded-card border border-bg-border overflow-hidden">
                    <table className="table">
                        <thead>
                            <tr className="bg-bg-surface">
                                <th className="th w-72">Territory</th>
                                <th className="th cursor-pointer select-none whitespace-nowrap"
                                    onClick={() => handleSort('totalRevenue')}>
                                    Total Revenue <SortIcon col="totalRevenue" />
                                </th>
                                <th className="th cursor-pointer select-none whitespace-nowrap"
                                    onClick={() => handleSort('totalDeals')}>
                                    Total Deals <SortIcon col="totalDeals" />
                                </th>
                                <th className="th cursor-pointer select-none whitespace-nowrap"
                                    onClick={() => handleSort('avgDealSize')}>
                                    Avg Deal <SortIcon col="avgDealSize" />
                                </th>
                                <th className="th whitespace-nowrap">Status</th>
                                <th className="th whitespace-nowrap">Assigned Reps</th>
                                <th className="th" />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(row => (
                                <tr key={row.territoryId} className="tr-hover">
                                    <td className="td">
                                        <p className="text-text-primary font-medium text-sm">{row.territoryName}</p>
                                        <p className="text-text-subtle text-xs">
                                            {row.state}{row.region ? ` · ${row.region}` : ''}
                                        </p>
                                    </td>
                                    <td className="td font-semibold text-accent">
                                        {row.totalRevenue > 0 ? fmt(row.totalRevenue) : <span className="text-text-subtle">—</span>}
                                    </td>
                                    <td className="td">
                                        {row.totalDeals > 0 ? row.totalDeals : <span className="text-text-subtle">—</span>}
                                    </td>
                                    <td className="td">
                                        {row.avgDealSize > 0 ? fmt(row.avgDealSize) : <span className="text-text-subtle">—</span>}
                                    </td>
                                    <td className="td">
                                        <RevBadge revenue={row.totalRevenue} max={maxRev} />
                                    </td>
                                    <td className="td">
                                        {row.assignedSalesReps.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {row.assignedSalesReps.slice(0, 3).map(r => (
                                                    <span key={r.id}
                                                        className="text-xs px-1.5 py-0.5 rounded bg-bg-hover text-text-muted border border-bg-border"
                                                        title={r.displayName}>
                                                        {r.userCode}
                                                    </span>
                                                ))}
                                                {row.assignedSalesReps.length > 3 && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-bg-hover text-text-subtle">
                                                        +{row.assignedSalesReps.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-text-subtle text-xs">Unassigned</span>
                                        )}
                                    </td>
                                    <td className="td">
                                        <button
                                            id={`view-${row.territoryId}`}
                                            onClick={() => navigate(`/territory-performance/${row.territoryId}`)}
                                            className="btn-secondary py-1 px-3 text-xs whitespace-nowrap flex items-center gap-1 group">
                                            View Details <HiArrowRight className="group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Layout>
    );
}
