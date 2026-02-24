import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import { supabase } from '../config/supabase';

const router = Router();

router.use(verifyToken);

// GET /api/map/territories — aggregated revenue per territory with color bucket
router.get('/territories', async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, productId, salesRepId: filterRepId } = req.query;

    // SALES role: restrict to assigned territories only
    let allowedTerritoryIds: string[] | undefined;
    if (req.user!.role === 'SALES') {
      const { data: assignments } = await supabase
        .from('SalesRepTerritory')
        .select('territoryId')
        .eq('salesRepId', req.user!.userId);
      allowedTerritoryIds = (assignments || []).map((a: any) => a.territoryId as string);
    }

    // Fetch all relevant sales using explicit any to avoid TS chain issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let salesQuery: any = supabase
      .from('Sale')
      .select('territoryId, revenue, deals');

    if (allowedTerritoryIds && allowedTerritoryIds.length > 0) {
      salesQuery = salesQuery.in('territoryId', allowedTerritoryIds);
    } else if (allowedTerritoryIds && allowedTerritoryIds.length === 0) {
      // No territories assigned — return empty
      res.json([]);
      return;
    }
    if (startDate) salesQuery = salesQuery.gte('saleDate', startDate as string);
    if (endDate) salesQuery = salesQuery.lte('saleDate', endDate as string);
    if (productId) salesQuery = salesQuery.eq('productId', productId as string);
    if (filterRepId && req.user!.role !== 'SALES') salesQuery = salesQuery.eq('salesRepId', filterRepId as string);

    const { data: salesData } = await salesQuery;

    // Aggregate revenue & deals per territory in JS
    const aggMap: Record<string, { revenue: number; deals: number }> = {};
    for (const s of (salesData || []) as any[]) {
      if (!aggMap[s.territoryId]) aggMap[s.territoryId] = { revenue: 0, deals: 0 };
      aggMap[s.territoryId].revenue += Number(s.revenue || 0);
      aggMap[s.territoryId].deals += 1;
    }

    // Determine revenue buckets for color coding
    const revenues = Object.values(aggMap).map((a) => a.revenue);
    const max = Math.max(...revenues, 1);
    const highThreshold = max * 0.66;
    const midThreshold = max * 0.33;

    // Fetch territories
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let terrQuery: any = supabase.from('Territory').select('*');
    if (allowedTerritoryIds) terrQuery = terrQuery.in('id', allowedTerritoryIds);
    const { data: territories } = await terrQuery;

    const result = ((territories || []) as any[]).map((t) => {
      const agg = aggMap[t.id];
      const revenue = agg?.revenue || 0;
      const deals = agg?.deals || 0;
      const colorBucket =
        revenue >= highThreshold ? 'HIGH' : revenue >= midThreshold ? 'MEDIUM' : 'LOW';

      return {
        id: t.id,
        name: t.name,
        state: t.state,
        region: t.region,
        latitude: t.latitude,
        longitude: t.longitude,
        radius: t.radius || 35000,
        revenue,
        deals,
        colorBucket,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('[MAP] Territories error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/map/districts — revenue data per territory for choropleth map
router.get('/districts', async (req: Request, res: Response): Promise<void> => {
  try {
    // SALES: restrict to assigned territories only
    let allowedIds: string[] | null = null;
    if (req.user!.role === 'SALES') {
      const { data: asgn } = await supabase
        .from('SalesRepTerritory')
        .select('territoryId')
        .eq('salesRepId', req.user!.userId);
      allowedIds = (asgn || []).map((a: any) => a.territoryId as string);
      if (allowedIds.length === 0) {
        res.json({ territories: [], allowedAll: false });
        return;
      }
    }

    // Fetch territories
    let tq: any = supabase.from('Territory').select('id, name, state, region, latitude, longitude');
    if (allowedIds) tq = tq.in('id', allowedIds);
    const { data: territories } = await tq;

    // Fetch all relevant sales
    let sq: any = supabase.from('Sale').select('territoryId, revenue, deals');
    if (allowedIds) sq = sq.in('territoryId', allowedIds);
    const { data: salesData } = await sq;

    // Aggregate per territory
    const agg: Record<string, { revenue: number; deals: number }> = {};
    for (const s of (salesData || []) as any[]) {
      if (!agg[s.territoryId]) agg[s.territoryId] = { revenue: 0, deals: 0 };
      agg[s.territoryId].revenue += Number(s.revenue || 0);
      agg[s.territoryId].deals += Number(s.deals || 1);
    }

    // Compute percentile thresholds (top 30% = HIGH, bottom 30% = LOW)
    const sorted = ((territories || []) as any[])
      .map(t => agg[t.id]?.revenue || 0)
      .sort((a, b) => a - b);
    const n = sorted.length || 1;
    const p70 = sorted[Math.floor(n * 0.70)] ?? 0;
    const p30 = sorted[Math.floor(n * 0.30)] ?? 0;

    const result = ((territories || []) as any[]).map(t => {
      const a = agg[t.id];
      const revenue = a?.revenue || 0;
      const deals = a?.deals || 0;
      const avgDeal = deals > 0 ? Math.round(revenue / deals) : 0;
      const revenueLevel = revenue >= p70 ? 'HIGH' : revenue >= p30 ? 'MEDIUM' : 'LOW';
      return {
        id: t.id, name: t.name, state: t.state, region: t.region,
        latitude: t.latitude, longitude: t.longitude,
        revenue, deals: Math.round(deals), avgDeal, revenueLevel
      };
    });

    res.json({ territories: result, allowedAll: allowedIds === null });
  } catch (err) {
    console.error('[MAP] Districts error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
