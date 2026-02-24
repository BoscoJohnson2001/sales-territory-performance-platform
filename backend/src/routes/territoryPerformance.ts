import { Router, Request, Response } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import { supabase } from '../config/supabase';

const router = Router();
router.use(verifyToken);

// ─── Helper ───────────────────────────────────────────────────────────────────
async function getAssignedTerritoryIds(salesRepId: string): Promise<string[]> {
    const { data } = await supabase
        .from('SalesRepTerritory')
        .select('territoryId')
        .eq('salesRepId', salesRepId);
    return (data || []).map((r: any) => r.territoryId as string);
}

// ─── GET /api/territory-performance/sales-reps ───────────────────────────────
// MANAGEMENT only — active SALES users for rep filter dropdown
router.get('/sales-reps', requireRole('MANAGEMENT'), async (_req: Request, res: Response): Promise<void> => {
    try {
        const { data: roleRow } = await supabase
            .from('Role').select('id').eq('name', 'SALES').single();
        if (!roleRow) { res.json([]); return; }

        const { data: users } = await supabase
            .from('User')
            .select('id, firstName, lastName, userCode')
            .eq('roleId', roleRow.id)
            .eq('isActive', true)
            .order('firstName');

        res.json((users || []).map((u: any) => ({
            id: u.id,
            displayName: `${u.firstName} ${u.lastName}`,
            userCode: u.userCode,
        })));
    } catch (err) {
        console.error('[TERRITORY-PERF] sales-reps error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// ─── GET /api/territory-performance ──────────────────────────────────────────
// MANAGEMENT → all territories, optional salesRepId filter
// SALES      → only assigned territories, salesRepId always forced to own id
// ADMIN      → 403
router.get('/', requireRole('MANAGEMENT', 'SALES'), async (req: Request, res: Response): Promise<void> => {
    try {
        const role = req.user!.role;
        const { fromDate, toDate } = req.query;

        // Sales rep filter: SALES always forced to own ID; MANAGEMENT may pass any
        const filterRepId =
            role === 'SALES'
                ? req.user!.userId
                : (req.query.salesRepId as string | undefined);

        // Scope territories
        let allowedIds: string[] | null = null;
        if (role === 'SALES') {
            allowedIds = await getAssignedTerritoryIds(req.user!.userId);
            if (allowedIds.length === 0) { res.json([]); return; }
        }

        // Fetch sales with date + rep filters applied at DB level
        let sq: any = supabase.from('Sale').select('territoryId, revenue, deals, salesRepId');
        if (allowedIds) sq = sq.in('territoryId', allowedIds);
        if (fromDate) sq = sq.gte('saleDate', fromDate as string);
        if (toDate) sq = sq.lte('saleDate', toDate as string);
        if (filterRepId) sq = sq.eq('salesRepId', filterRepId);
        const { data: sales } = await sq;

        // When a specific rep is selected (MANAGEMENT filter), derive the territory
        // scope from that rep's sales + assignments so that unrelated territories
        // are excluded from the response entirely.
        if (filterRepId && role === 'MANAGEMENT') {
            // territories where the rep has sales records (within date range)
            const fromSales = new Set<string>(((sales || []) as any[]).map((s: any) => s.territoryId));

            // territories where the rep is formally assigned
            const { data: repAssignments } = await supabase
                .from('SalesRepTerritory')
                .select('territoryId')
                .eq('salesRepId', filterRepId);
            const fromAssignments = new Set<string>(((repAssignments || []) as any[]).map((a: any) => a.territoryId));

            // union of both sets
            const repTerritoryIds = [...new Set([...fromSales, ...fromAssignments])];

            if (repTerritoryIds.length === 0) { res.json([]); return; }
            allowedIds = repTerritoryIds;
        }

        // Aggregate per territory
        const agg: Record<string, { revenue: number; deals: number }> = {};
        for (const s of (sales || []) as any[]) {
            if (!agg[s.territoryId]) agg[s.territoryId] = { revenue: 0, deals: 0 };
            agg[s.territoryId].revenue += Number(s.revenue || 0);
            agg[s.territoryId].deals += Number(s.deals || 1);
        }

        // Fetch territories in scope (now correctly scoped after rep filter derivation)
        let tq: any = supabase.from('Territory').select('id, name, state, region');
        if (allowedIds) tq = tq.in('id', allowedIds);
        const { data: territories } = await tq;

        // Fetch all assigned reps for scoped territories (not filtered by date/rep)
        let repQ: any = supabase
            .from('SalesRepTerritory')
            .select('territoryId, salesRepId, User(id, firstName, lastName, userCode)');
        if (allowedIds) repQ = repQ.in('territoryId', allowedIds);
        const { data: assignments } = await repQ;

        const repsByTerritory: Record<string, { id: string; displayName: string; userCode: string }[]> = {};
        for (const a of (assignments || []) as any[]) {
            if (!repsByTerritory[a.territoryId]) repsByTerritory[a.territoryId] = [];
            if (a.User) {
                repsByTerritory[a.territoryId].push({
                    id: a.salesRepId,
                    displayName: `${a.User.firstName} ${a.User.lastName}`,
                    userCode: a.User.userCode,
                });
            }
        }

        const result = ((territories || []) as any[]).map(t => {
            const a = agg[t.id];
            const revenue = a?.revenue || 0;
            const deals = a?.deals || 0;
            const avgDeal = deals > 0 ? Math.round(revenue / deals) : 0;
            return {
                territoryId: t.id,
                territoryName: t.name,
                state: t.state,
                region: t.region,
                totalRevenue: revenue,
                totalDeals: deals,
                avgDealSize: avgDeal,
                assignedSalesReps: repsByTerritory[t.id] || [],
            };
        });

        result.sort((a, b) => b.totalRevenue - a.totalRevenue);
        res.json(result);
    } catch (err) {
        console.error('[TERRITORY-PERF] List error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// ─── GET /api/territory-performance/:id ──────────────────────────────────────
// ADMIN → 403; SALES → must be assigned; MANAGEMENT → open
router.get('/:id', requireRole('MANAGEMENT', 'SALES'), async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const role = req.user!.role;

        if (role === 'SALES') {
            const allowed = await getAssignedTerritoryIds(req.user!.userId);
            if (!allowed.includes(id)) {
                res.status(403).json({ message: 'You are not assigned to this territory.' });
                return;
            }
        }

        const { data: territory } = await supabase.from('Territory').select('*').eq('id', id).single();
        if (!territory) { res.status(404).json({ message: 'Territory not found' }); return; }

        const { data: sales } = await supabase
            .from('Sale')
            .select('revenue, deals, month, year, productId, customerId, salesRepId')
            .eq('territoryId', id);
        const allSales = (sales || []) as any[];

        const totalRevenue = allSales.reduce((s, r) => s + Number(r.revenue || 0), 0);
        const totalDeals = allSales.reduce((s, r) => s + Number(r.deals || 1), 0);
        const avgDealSize = totalDeals > 0 ? Math.round(totalRevenue / totalDeals) : 0;

        const monthlyMap: Record<string, { year: number; month: number; revenue: number; deals: number }> = {};
        for (const s of allSales) {
            const key = `${s.year}-${String(s.month).padStart(2, '0')}`;
            if (!monthlyMap[key]) monthlyMap[key] = { year: s.year, month: s.month, revenue: 0, deals: 0 };
            monthlyMap[key].revenue += Number(s.revenue || 0);
            monthlyMap[key].deals += Number(s.deals || 1);
        }
        const monthlyTrend = Object.values(monthlyMap).sort((a, b) => a.year - b.year || a.month - b.month);

        const productRev: Record<string, number> = {};
        for (const s of allSales) if (s.productId) productRev[s.productId] = (productRev[s.productId] || 0) + Number(s.revenue || 0);
        const topProductIds = Object.entries(productRev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
        const { data: products } = topProductIds.length
            ? await supabase.from('Product').select('id, name, category').in('id', topProductIds)
            : { data: [] };
        const topProducts = (products || []).map((p: any) => ({ ...p, revenue: productRev[p.id] || 0 }))
            .sort((a, b) => b.revenue - a.revenue);

        const custRev: Record<string, number> = {};
        for (const s of allSales) if (s.customerId) custRev[s.customerId] = (custRev[s.customerId] || 0) + Number(s.revenue || 0);
        const topCustIds = Object.entries(custRev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
        const { data: customers } = topCustIds.length
            ? await supabase.from('Customer').select('id, name, industry, location').in('id', topCustIds)
            : { data: [] };
        const topCustomers = (customers || []).map((c: any) => ({ ...c, revenue: custRev[c.id] || 0 }))
            .sort((a, b) => b.revenue - a.revenue);

        const { data: assignments } = await supabase
            .from('SalesRepTerritory')
            .select('salesRepId, User(id, firstName, lastName, userCode)')
            .eq('territoryId', id);
        const assignedReps = (assignments || []).map((a: any) => ({
            id: a.salesRepId,
            displayName: a.User ? `${a.User.firstName} ${a.User.lastName}` : 'Unknown',
            userCode: a.User?.userCode || '',
        }));

        res.json({ territory, totalRevenue, totalDeals, avgDealSize, monthlyTrend, topProducts, topCustomers, assignedReps });
    } catch (err) {
        console.error('[TERRITORY-PERF] Detail error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
