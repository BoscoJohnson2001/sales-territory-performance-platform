import { Router, Request, Response } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import { supabase } from '../config/supabase';

const router = Router();

// GET /api/dashboard/sales — personal KPIs for SALES role
router.get(
  '/sales',
  verifyToken,
  requireRole('SALES'),
  async (req: Request, res: Response): Promise<void> => {
    const salesRepId = req.user!.userId;

    // Fetch all sales for this rep
    const { data: sales } = await supabase
      .from('Sale')
      .select('revenue, deals, month, year, customerId, territoryId')
      .eq('salesRepId', salesRepId)
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    const allSales = sales || [];

    const totalRevenue = allSales.reduce((s, r) => s + Number(r.revenue || 0), 0);
    const totalDeals = allSales.length;
    const averageDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;

    // Monthly trend
    const monthlyMap: Record<string, { year: number; month: number; revenue: number }> = {};
    for (const s of allSales) {
      const key = `${s.year}-${s.month}`;
      if (!monthlyMap[key]) monthlyMap[key] = { year: s.year, month: s.month, revenue: 0 };
      monthlyMap[key].revenue += Number(s.revenue || 0);
    }
    const monthlyTrend = Object.values(monthlyMap).sort(
      (a, b) => a.year - b.year || a.month - b.month
    );

    // Top customers (unique customerIds, up to 5)
    const uniqueCustomerIds = [...new Set(allSales.map((s) => s.customerId))].slice(0, 5);
    const { data: topCustomers } = await supabase
      .from('Customer')
      .select('*')
      .in('id', uniqueCustomerIds);

    // Territories assigned to this rep
    const { data: assignments } = await supabase
      .from('SalesRepTerritory')
      .select('*, Territory(*)')
      .eq('salesRepId', salesRepId);

    res.json({
      totalRevenue,
      totalDeals,
      averageDealSize,
      monthlyTrend,
      topCustomers: topCustomers || [],
      territories: (assignments || []).map((a: any) => a.Territory),
    });
  }
);

// GET /api/dashboard/management — regional KPIs for MANAGEMENT + ADMIN
router.get(
  '/management',
  verifyToken,
  requireRole('MANAGEMENT', 'ADMIN'),
  async (_req: Request, res: Response): Promise<void> => {
    const [salesRes, territoriesRes] = await Promise.all([
      supabase.from('Sale').select('revenue, deals, territoryId, month, year'),
      supabase.from('Territory').select('id, name, state, region'),
    ]);

    const allSales = salesRes.data || [];
    const territories = territoriesRes.data || [];

    // Aggregate per territory
    const terrMap: Record<string, { revenue: number; deals: number }> = {};
    for (const s of allSales) {
      if (!terrMap[s.territoryId]) terrMap[s.territoryId] = { revenue: 0, deals: 0 };
      terrMap[s.territoryId].revenue += Number(s.revenue || 0);
      terrMap[s.territoryId].deals += 1;
    }

    const enriched = territories.map((t: any) => ({
      territoryId: t.id,
      name: t.name,
      state: t.state,
      region: t.region,
      revenue: terrMap[t.id]?.revenue || 0,
      deals: terrMap[t.id]?.deals || 0,
    }));

    const insights = enriched.map((t) => ({
      ...t,
      insight:
        t.deals > 10 && t.revenue < 50000
          ? 'PRICING_OPPORTUNITY'
          : t.revenue > 100000
            ? 'EXPANSION_CANDIDATE'
            : null,
    }));

    const sortedByRevenue = [...insights].sort((a, b) => b.revenue - a.revenue);

    // Revenue by region
    const revenueByRegion: Record<string, number> = {};
    for (const t of enriched) {
      const region = t.region || 'Unknown';
      revenueByRegion[region] = (revenueByRegion[region] || 0) + t.revenue;
    }

    // Monthly trend
    const monthlyMap: Record<string, { year: number; month: number; revenue: number }> = {};
    for (const s of allSales) {
      const key = `${s.year}-${s.month}`;
      if (!monthlyMap[key]) monthlyMap[key] = { year: s.year, month: s.month, revenue: 0 };
      monthlyMap[key].revenue += Number(s.revenue || 0);
    }
    const monthlyTrend = Object.values(monthlyMap).sort(
      (a, b) => a.year - b.year || a.month - b.month
    );

    const totalRevenue = allSales.reduce((s, r) => s + Number(r.revenue || 0), 0);
    const totalDeals = allSales.length;

    res.json({
      totalRevenue,
      totalDeals,
      top5Territories: sortedByRevenue.slice(0, 5),
      bottom5Territories: sortedByRevenue.slice(-5).reverse(),
      revenueByRegion,
      monthlyTrend,
    });
  }
);

export default router;
