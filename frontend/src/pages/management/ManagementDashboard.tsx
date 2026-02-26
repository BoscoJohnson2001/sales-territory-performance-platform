import { useEffect, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import Layout from '../../components/Layout';
import client from '../../api/client';
import {
  HiCurrencyRupee, HiShoppingBag,
  HiLocationMarker, HiMap,
  HiTrendingUp, HiTrendingDown,
  HiLightningBolt, HiLightBulb, HiSun,
  HiPresentationChartLine, HiChartPie
} from 'react-icons/hi';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Territory { territoryId: string; name: string; revenue: number; deals: number; insight: string | null; }
interface DashData {
  totalRevenue: number; totalDeals: number;
  top5Territories: Territory[]; bottom5Territories: Territory[];
  revenueByRegion: Record<string, number>;
  monthlyTrend: { year: number; month: number; revenue: number }[];
}

const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#9ca3af', font: { size: 11 } } } },
  scales: { x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } }, y: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } } },
};

export default function ManagementDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/api/dashboard/management').then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const monthlyLabels = data?.monthlyTrend.map(m => `${MONTHS[m.month - 1]} ${m.year}`) || [];
  const monthlyRevs = data?.monthlyTrend.map(m => m.revenue) || [];

  return (
    <Layout title="Management Dashboard" subtitle="Revenue Intelligence — Indian District-Wise" fixedHeight={true}>
      <div className="flex-1 min-h-0 flex flex-col gap-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
          {[
            { label: 'Total Revenue', value: loading ? '—' : `₹${Number(data?.totalRevenue || 0).toLocaleString()}`, icon: HiCurrencyRupee, color: 'text-amber-400' },
            { label: 'Total Deals', value: loading ? '—' : data?.totalDeals ?? 0, icon: HiShoppingBag, color: 'text-blue-400' },
            { label: 'Top Region', value: loading ? '—' : Object.entries(data?.revenueByRegion || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || '—', icon: HiLocationMarker, color: 'text-green-400' },
            { label: 'Territories', value: loading ? '—' : (data?.top5Territories.length ?? 0) + (data?.bottom5Territories.length ?? 0), icon: HiMap, color: 'text-indigo-400' },
          ].map(c => (
            <div key={c.label} className="stat-card card-hover">
              <span className="stat-card-label">{c.label}</span>
              <div className="flex items-center gap-2">
                <span className="stat-card-value text-base">{c.value}</span>
                <c.icon className={`${c.color} text-base opacity-70`} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6 h-64 flex-shrink-0">
          {/* Monthly Revenue Trend */}
          <div className="card flex flex-col">
            <h3 className="text-text-primary text-sm font-semibold mb-3 flex items-center gap-2">
              <HiPresentationChartLine className="text-amber-400" /> Monthly Revenue Trend
            </h3>
            <div className="flex-1 min-h-0">
              {loading ? <div className="flex items-center justify-center h-full text-text-muted text-xs">Loading...</div> : (
                <Line data={{
                  labels: monthlyLabels,
                  datasets: [{ label: 'Revenue', data: monthlyRevs, borderColor: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)', tension: 0.4, fill: true, pointBackgroundColor: '#eab308' }]
                }} options={chartOpts as Parameters<typeof Line>[0]['options']} />
              )}
            </div>
          </div>

          {/* Revenue by Region */}
          <div className="card flex flex-col">
            <h3 className="text-text-primary text-sm font-semibold mb-3 flex items-center gap-2">
              <HiChartPie className="text-blue-400" /> Revenue by Region
            </h3>
            <div className="flex-1 min-h-0">
              {loading ? <div className="flex items-center justify-center h-full text-text-muted text-xs">Loading...</div> : (
                <Doughnut data={{
                  labels: Object.keys(data?.revenueByRegion || {}),
                  datasets: [{ data: Object.values(data?.revenueByRegion || {}), backgroundColor: ['#eab308', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#f59e0b'], borderWidth: 0 }]
                }} options={{ ...chartOpts, scales: undefined } as Parameters<typeof Doughnut>[0]['options']} />
              )}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 flex-1 min-h-0">
          {/* Top 5 Territories */}
          <div className="card flex flex-col min-h-0 p-0">
            <h3 className="text-text-primary text-sm font-semibold px-5 py-3 border-b border-bg-border flex-shrink-0 flex items-center gap-2">
              <HiTrendingUp className="text-green-400" /> Top 5 Territories
            </h3>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="table">
                <thead className="sticky top-0 z-10 bg-bg-card"><tr><th className="th">Territory</th><th className="th">Revenue</th><th className="th">Deals</th><th className="th">Signal</th></tr></thead>
                <tbody>
                  {(data?.top5Territories || []).map(t => (
                    <tr key={t.territoryId} className="tr-hover">
                      <td className="td text-xs">{t.name}</td>
                      <td className="td text-accent font-semibold text-xs">₹{t.revenue.toLocaleString()}</td>
                      <td className="td text-xs">{t.deals}</td>
                      <td className="td">
                        {t.insight === 'EXPANSION_CANDIDATE' ? <span className="badge-high text-[10px] flex items-center gap-1" title="Expansion Candidate"><HiLightningBolt className="text-[10px]" /> Expand</span>
                          : t.insight === 'PRICING_OPPORTUNITY' ? <span className="badge-medium text-[10px] flex items-center gap-1" title="Pricing Opportunity"><HiLightBulb className="text-[10px]" /> Pricing</span>
                            : t.insight === 'NO_ACTIVITY' ? <span className="badge-low text-[10px] flex items-center gap-1" title="Cold"><HiSun className="text-[10px]" /> Cold</span>
                              : <span className="text-text-subtle text-[10px]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom 5 Territories */}
          <div className="card flex flex-col min-h-0 p-0">
            <h3 className="text-text-primary text-sm font-semibold px-5 py-3 border-b border-bg-border flex-shrink-0 flex items-center gap-2">
              <HiTrendingDown className="text-red-400" /> Bottom 5 Territories
            </h3>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="table">
                <thead className="sticky top-0 z-10 bg-bg-card"><tr><th className="th">Territory</th><th className="th">Revenue</th><th className="th">Deals</th><th className="th">Signal</th></tr></thead>
                <tbody>
                  {(data?.bottom5Territories || []).map(t => (
                    <tr key={t.territoryId} className="tr-hover">
                      <td className="td text-xs">{t.name}</td>
                      <td className="td text-status-low font-semibold text-xs">₹{t.revenue.toLocaleString()}</td>
                      <td className="td text-xs">{t.deals}</td>
                      <td className="td">
                        {t.insight === 'EXPANSION_CANDIDATE' ? <span className="badge-high text-[10px] flex items-center gap-1" title="Expansion Candidate"><HiLightningBolt className="text-[10px]" /> Expand</span>
                          : t.insight === 'PRICING_OPPORTUNITY' ? <span className="badge-medium text-[10px] flex items-center gap-1" title="Pricing Opportunity"><HiLightBulb className="text-[10px]" /> Pricing</span>
                            : t.insight === 'NO_ACTIVITY' ? <span className="badge-low text-[10px] flex items-center gap-1" title="Cold"><HiSun className="text-[10px]" /> Cold</span>
                              : <span className="text-text-subtle text-[10px]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
