import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import client from '../../api/client';
import {
    HiArrowLeft, HiCurrencyRupee, HiShoppingBag, HiTrendingUp,
    HiUsers, HiCube, HiUserGroup, HiPresentationChartLine,
    HiExclamationCircle, HiDownload
} from 'react-icons/hi';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (n: number) => `₹${n.toLocaleString()}`;

interface MonthlyPoint { year: number; month: number; revenue: number; deals: number; }
interface Product { id: string; name: string; category: string; revenue: number; }
interface Customer { id: string; name: string; industry: string; location: string; revenue: number; }
interface Rep { id: string; displayName: string; userCode: string; }
interface TerritoryDetail {
    territory: { id: string; name: string; state: string; region: string; };
    totalRevenue: number; totalDeals: number; avgDealSize: number;
    monthlyTrend: MonthlyPoint[];
    topProducts: Product[];
    topCustomers: Customer[];
    assignedReps: Rep[];
}

const chartOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { bodyFont: { family: 'Inter' } } },
    scales: {
        x: { grid: { color: '#1e293b' }, ticks: { color: '#64748b', font: { size: 11 } } },
        y: { grid: { color: '#1e293b' }, ticks: { color: '#64748b', font: { size: 11 }, callback: (v: any) => `₹${Number(v).toLocaleString()}` } },
    },
};

export default function TerritoryDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<TerritoryDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        client.get<TerritoryDetail>(`/api/territory-performance/${id}`)
            .then(r => { setData(r.data); setLoading(false); })
            .catch(err => {
                setError(err.response?.data?.message || 'Failed to load territory details.');
                setLoading(false);
            });
    }, [id]);

    if (loading) return (
        <Layout title="Territory Details" subtitle="Loading…">
            <div className="flex items-center justify-center h-64 gap-3">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-text-muted text-sm">Fetching territory data…</span>
            </div>
        </Layout>
    );

    if (error || !data) return (
        <Layout title="Territory Details" subtitle="Error">
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                <HiExclamationCircle className="text-5xl text-red-500/50" />
                <p className="text-text-primary font-semibold">{error || 'Territory not found'}</p>
                <button onClick={() => navigate('/territory-performance')} className="btn-secondary text-xs py-1.5 flex items-center gap-2">
                    <HiArrowLeft /> Back to Territories
                </button>
            </div>
        </Layout>
    );

    const { territory, totalRevenue, totalDeals, avgDealSize, monthlyTrend, topProducts, topCustomers, assignedReps } = data;

    // Chart data
    const chartLabels = monthlyTrend.map(p => `${MONTHS[p.month - 1]} ${p.year}`);
    const revenueData = monthlyTrend.map(p => p.revenue);

    const handleExport = () => {
        if (!data) return;

        let csv = 'TERRITORY PERFORMANCE REPORT\n';
        csv += `Territory,${territory.name}\n`;
        csv += `State,${territory.state}\n`;
        csv += `Region,${territory.region || '—'}\n`;
        csv += `Total Revenue,${totalRevenue}\n`;
        csv += `Total Deals,${totalDeals}\n`;
        csv += `Avg Deal Size,${avgDealSize}\n\n`;

        csv += 'MONTHLY TREND\nYear,Month,Revenue,Deals\n';
        monthlyTrend.forEach(p => {
            csv += `${p.year},${MONTHS[p.month - 1]},${p.revenue},${p.deals}\n`;
        });

        csv += '\nTOP PRODUCTS\nProduct,Category,Revenue\n';
        topProducts.forEach(p => {
            csv += `"${p.name}","${p.category}",${p.revenue}\n`;
        });

        csv += '\nTOP CUSTOMERS\nCustomer,Industry,Location,Revenue\n';
        topCustomers.forEach(c => {
            csv += `"${c.name}","${c.industry}","${c.location}",${c.revenue}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Performance_${territory.name.replace(/\s+/g, '_')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Layout
            title={territory.name}
            subtitle={`${territory.state}${territory.region ? ` · ${territory.region}` : ''} — Performance Detail`}
            actions={
                <button onClick={handleExport} className="btn-primary py-1 px-4 text-xs flex items-center gap-2">
                    <HiDownload /> EXPORT CSV
                </button>
            }
            fixedHeight={true}
        >
            <div className="flex-1 min-h-0 flex flex-col gap-6">
                {/* KPI Row */}
                <div className="grid grid-cols-3 gap-4 flex-shrink-0">
                    <div className="stat-card card-hover">
                        <span className="stat-card-label">Revenue</span>
                        <div className="flex items-center gap-2">
                            <span className="stat-card-value text-base">{fmt(totalRevenue)}</span>
                            <HiCurrencyRupee className="text-amber-400 opacity-70" />
                        </div>
                    </div>
                    <div className="stat-card card-hover">
                        <span className="stat-card-label">Deals</span>
                        <div className="flex items-center gap-2">
                            <span className="stat-card-value text-base">{totalDeals}</span>
                            <HiShoppingBag className="text-blue-400 opacity-70" />
                        </div>
                    </div>
                    <div className="stat-card card-hover">
                        <span className="stat-card-label">Avg Size</span>
                        <div className="flex items-center gap-2">
                            <span className="stat-card-value text-base">{fmt(avgDealSize)}</span>
                            <HiTrendingUp className="text-green-400 opacity-70" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
                    {/* Monthly Trend Chart */}
                    <div className="card flex flex-col min-h-0 h-64">
                        <h3 className="text-text-primary text-[11px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                            <HiPresentationChartLine className="text-amber-400" /> Revenue Trend
                        </h3>
                        <div className="flex-1 min-h-0">
                            {monthlyTrend.length > 0 ? (
                                <Line
                                    data={{
                                        labels: chartLabels,
                                        datasets: [{
                                            data: revenueData,
                                            borderColor: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)',
                                            fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#eab308',
                                        }],
                                    }}
                                    options={{ ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, ticks: { ...chartOpts.scales.y.ticks, font: { size: 9 } } } } }}
                                />
                            ) : <div className="flex items-center justify-center h-full text-text-subtle text-[10px] italic">No trend data available</div>}
                        </div>
                    </div>

                    {/* Assigned Sales Reps */}
                    <div className="card flex flex-col min-h-0 h-64">
                        <h3 className="text-text-primary text-[11px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                            <HiUsers className="text-blue-400" /> Assigned Representatives
                        </h3>
                        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                            {assignedReps.length > 0 ? assignedReps.map(rep => (
                                <div key={rep.id} className="flex items-center gap-3 p-2 bg-bg-base/30 rounded-lg border border-bg-border">
                                    <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-xs font-bold">
                                        {rep.displayName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-text-primary text-[11px] font-bold">{rep.displayName}</p>
                                        <p className="text-text-subtle text-[9px]">{rep.userCode}</p>
                                    </div>
                                </div>
                            )) : <div className="flex items-center justify-center h-full text-text-subtle text-[10px] italic">No reps assigned</div>}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                    {/* Top Products */}
                    <div className="card flex flex-col min-h-0">
                        <h3 className="text-text-primary text-[11px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                            <HiCube className="text-green-400" /> Top Performing Products
                        </h3>
                        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                            {topProducts.length > 0 ? topProducts.map((p) => (
                                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-bg-base/20 border border-bg-border/50">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-text-primary truncate">{p.name}</p>
                                        <p className="text-[9px] text-text-subtle">{p.category}</p>
                                    </div>
                                    <span className="text-accent text-[11px] font-bold">{fmt(p.revenue)}</span>
                                </div>
                            )) : <p className="text-text-subtle text-[10px] italic">No product data</p>}
                        </div>
                    </div>

                    {/* Top Customers */}
                    <div className="card flex flex-col min-h-0">
                        <h3 className="text-text-primary text-[11px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                            <HiUserGroup className="text-indigo-400" /> Strategic Customers
                        </h3>
                        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                            {topCustomers.length > 0 ? topCustomers.map((c) => (
                                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-bg-base/20 border border-bg-border/50">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-text-primary truncate">{c.name}</p>
                                        <p className="text-[9px] text-text-subtle truncate">{c.industry} · {c.location}</p>
                                    </div>
                                    <span className="text-accent text-[11px] font-bold">{fmt(c.revenue)}</span>
                                </div>
                            )) : <p className="text-text-subtle text-[10px] italic">No customer data</p>}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
