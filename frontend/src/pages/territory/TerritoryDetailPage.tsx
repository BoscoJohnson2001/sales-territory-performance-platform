import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import client from '../../api/client';
import {
    HiArrowLeft, HiCurrencyRupee, HiShoppingBag, HiTrendingUp,
    HiUsers, HiCube, HiUserGroup, HiPresentationChartLine,
    HiChartBar, HiExclamationCircle, HiDownload
} from 'react-icons/hi';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

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
    const dealsData = monthlyTrend.map(p => p.deals);

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
            subtitle={`${territory.state}${territory.region ? ` · ${territory.region}` : ''} — Territory Performance`}
            actions={
                <button
                    onClick={handleExport}
                    className="btn-primary py-1.5 px-4 text-xs flex items-center gap-2"
                >
                    <HiDownload className="text-sm" /> EXPORT CSV
                </button>
            }
        >

            {/* Back button */}
            <button onClick={() => navigate('/territory-performance')}
                className="btn-secondary text-xs py-1.5 mb-5 inline-flex items-center gap-2">
                <HiArrowLeft /> Back to Territories
            </button>

            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="stat-card">
                    <div className="flex justify-between items-start mb-1">
                        <span className="stat-card-label">Total Revenue</span>
                        <HiCurrencyRupee className="text-lg text-amber-400" />
                    </div>
                    <span className="stat-card-value text-accent">{totalRevenue > 0 ? fmt(totalRevenue) : '—'}</span>
                    <span className="stat-card-sub">Across all periods</span>
                </div>
                <div className="stat-card">
                    <div className="flex justify-between items-start mb-1">
                        <span className="stat-card-label">Total Deals</span>
                        <HiShoppingBag className="text-lg text-blue-400" />
                    </div>
                    <span className="stat-card-value">{totalDeals || '—'}</span>
                    <span className="stat-card-sub">Closed deals</span>
                </div>
                <div className="stat-card">
                    <div className="flex justify-between items-start mb-1">
                        <span className="stat-card-label">Avg Deal Size</span>
                        <HiTrendingUp className="text-lg text-green-400" />
                    </div>
                    <span className="stat-card-value">{avgDealSize > 0 ? fmt(avgDealSize) : '—'}</span>
                    <span className="stat-card-sub">Revenue ÷ Deals</span>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">

                {/* Monthly Revenue Trend */}
                <div className="lg:col-span-2 card">
                    <h3 className="text-text-primary text-sm font-semibold mb-4 flex items-center gap-2">
                        <HiPresentationChartLine className="text-amber-400" /> Monthly Revenue Trend
                    </h3>
                    {monthlyTrend.length > 0 ? (
                        <div style={{ height: 220 }}>
                            <Line
                                data={{
                                    labels: chartLabels,
                                    datasets: [{
                                        data: revenueData,
                                        borderColor: '#eab308', backgroundColor: '#eab30820',
                                        fill: true, tension: 0.4, pointRadius: 4,
                                        pointBackgroundColor: '#eab308',
                                    }],
                                }}
                                options={chartOpts}
                            />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-[220px] text-text-subtle text-sm">No sales data yet</div>
                    )}
                </div>

                {/* Assigned Sales Reps */}
                <div className="card flex flex-col">
                    <h3 className="text-text-primary text-sm font-semibold mb-4 flex items-center gap-2">
                        <HiUsers className="text-blue-400" /> Assigned Sales Reps
                    </h3>
                    {assignedReps.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {assignedReps.map(rep => (
                                <div key={rep.id} className="flex items-center gap-3 p-2.5 bg-bg-hover rounded-lg border border-bg-border">
                                    <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-sm font-bold flex-shrink-0">
                                        {rep.displayName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-text-primary text-xs font-semibold">{rep.displayName}</p>
                                        <p className="text-text-subtle text-[10px]">{rep.userCode}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-text-subtle text-xs text-center">
                            No sales reps assigned to this territory
                        </div>
                    )}
                </div>

                {/* Deals Trend */}
                {monthlyTrend.length > 0 && (
                    <div className="card">
                        <h3 className="text-text-primary text-sm font-semibold mb-4 flex items-center gap-2">
                            <HiChartBar className="text-blue-400" /> Monthly Deals Volume
                        </h3>
                        <div style={{ height: 180 }}>
                            <Bar
                                data={{
                                    labels: chartLabels,
                                    datasets: [{
                                        data: dealsData,
                                        backgroundColor: '#3b82f640',
                                        borderColor: '#3b82f6',
                                        borderWidth: 1,
                                        borderRadius: 4,
                                    }],
                                }}
                                options={{
                                    ...chartOpts,
                                    scales: {
                                        ...chartOpts.scales,
                                        y: { ...chartOpts.scales.y, ticks: { ...chartOpts.scales.y.ticks, callback: (v: any) => v } },
                                    },
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Top Products */}
                <div className="card">
                    <h3 className="text-text-primary text-sm font-semibold mb-4 flex items-center gap-2">
                        <HiCube className="text-green-400" /> Top Products
                    </h3>
                    {topProducts.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {topProducts.map((p, i) => (
                                <div key={p.id} className="flex items-center gap-3">
                                    <span className="text-text-subtle text-xs w-4">{i + 1}.</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-text-primary text-xs font-medium truncate">{p.name}</p>
                                        <p className="text-text-subtle text-[10px]">{p.category}</p>
                                    </div>
                                    <span className="text-accent text-xs font-semibold">{fmt(p.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-text-subtle text-xs">No product data available</p>
                    )}
                </div>

                {/* Top Customers */}
                <div className="card">
                    <h3 className="text-text-primary text-sm font-semibold mb-4 flex items-center gap-2">
                        <HiUserGroup className="text-indigo-400" /> Top Customers
                    </h3>
                    {topCustomers.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {topCustomers.map((c, i) => (
                                <div key={c.id} className="flex items-center gap-3">
                                    <span className="text-text-subtle text-xs w-4">{i + 1}.</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-text-primary text-xs font-medium truncate">{c.name}</p>
                                        <p className="text-text-subtle text-[10px] truncate">{c.industry}{c.location ? ` · ${c.location}` : ''}</p>
                                    </div>
                                    <span className="text-accent text-xs font-semibold">{fmt(c.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-text-subtle text-xs">No customer data available</p>
                    )}
                </div>
            </div>
        </Layout>
    );
}
