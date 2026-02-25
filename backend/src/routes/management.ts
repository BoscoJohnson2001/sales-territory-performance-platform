import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { verifyToken, requireRole } from '../middleware/auth';
import { supabase } from '../config/supabase';

const router = Router();

// All management routes require MANAGEMENT role
router.use(verifyToken, requireRole('MANAGEMENT'));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/management/sales-users
// Return all active SALES-role users (for target form dropdown)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sales-users', async (_req: Request, res: Response): Promise<void> => {
    const { data, error } = await supabase
        .from('User')
        .select('id, firstName, lastName, userCode, email')
        .eq('isActive', true)
        .order('firstName', { ascending: true });

    if (error) {
        res.status(500).json({ message: 'Failed to fetch sales users' });
        return;
    }

    // Filter to only SALES-role users by joining with Role table
    const { data: salesRole } = await supabase
        .from('Role')
        .select('id')
        .eq('name', 'SALES')
        .single();

    if (!salesRole) {
        res.json([]);
        return;
    }

    const { data: salesUsers, error: suError } = await supabase
        .from('User')
        .select('id, firstName, lastName, userCode, email')
        .eq('roleId', salesRole.id)
        .eq('isActive', true)
        .order('firstName', { ascending: true });

    if (suError) {
        res.status(500).json({ message: 'Failed to fetch sales users' });
        return;
    }

    res.json(salesUsers || []);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/management/sales-target
// Upsert a monthly revenue target for a sales user
// Body: { salesUserId, month, year, targetAmount }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sales-target', async (req: Request, res: Response): Promise<void> => {
    const { salesUserId, month, year, targetAmount } = req.body;

    if (!salesUserId || !month || !year || targetAmount === undefined) {
        res.status(400).json({ message: 'salesUserId, month, year, and targetAmount are required' });
        return;
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const amount = parseFloat(targetAmount);

    if (monthNum < 1 || monthNum > 12 || yearNum < 2000 || yearNum > 2100) {
        res.status(400).json({ message: 'Invalid month or year' });
        return;
    }

    if (amount <= 0) {
        res.status(400).json({ message: 'Target amount must be greater than 0' });
        return;
    }

    // Check if target already exists for this salesUserId + month + year
    const { data: existing } = await supabase
        .from('SalesTarget')
        .select('id')
        .eq('salesUserId', salesUserId)
        .eq('month', monthNum)
        .eq('year', yearNum)
        .maybeSingle();

    if (existing) {
        // UPDATE
        const { data: updated, error } = await supabase
            .from('SalesTarget')
            .update({ targetAmount: amount })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) {
            console.error('[MGMT] Update target error:', error);
            res.status(500).json({ message: 'Failed to update target' });
            return;
        }
        res.json({ ...updated, action: 'updated' });
        return;
    }

    // INSERT
    const { data: created, error } = await supabase
        .from('SalesTarget')
        .insert({
            id: crypto.randomUUID(),
            salesUserId,
            month: monthNum,
            year: yearNum,
            targetAmount: amount,
        })
        .select()
        .single();

    if (error) {
        console.error('[MGMT] Create target error:', error);
        res.status(500).json({ message: 'Failed to create target' });
        return;
    }

    res.status(201).json({ ...created, action: 'created' });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/management/sales-performance?month=&year=
// Returns target vs achieved for all SALES users in a given month/year
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sales-performance', async (req: Request, res: Response): Promise<void> => {
    const month = parseInt((req.query.month as string) || String(new Date().getMonth() + 1));
    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '10');

    // 1. Get all SALES-role users
    const { data: salesRole } = await supabase
        .from('Role')
        .select('id')
        .eq('name', 'SALES')
        .single();

    if (!salesRole) {
        res.json({ data: [], total: 0, page, pages: 1 });
        return;
    }

    const { data: salesUsers, error: usersError } = await supabase
        .from('User')
        .select('id, firstName, lastName, userCode')
        .eq('roleId', salesRole.id)
        .eq('isActive', true)
        .order('firstName', { ascending: true });

    if (usersError || !salesUsers) {
        res.status(500).json({ message: 'Failed to fetch sales users' });
        return;
    }

    // 2. Get all targets for these users for this month/year
    const userIds = salesUsers.map((u: { id: string }) => u.id);

    const { data: targets } = await supabase
        .from('SalesTarget')
        .select('salesUserId, targetAmount')
        .in('salesUserId', userIds)
        .eq('month', month)
        .eq('year', year);

    // 3. Get achieved revenue (SUM of sales) for this month/year for each user
    const { data: salesAgg } = await supabase
        .from('Sale')
        .select('salesRepId, revenue')
        .in('salesRepId', userIds)
        .eq('month', month)
        .eq('year', year);

    // Group sales revenue by salesRepId
    const achievedMap: Record<string, number> = {};
    for (const sale of (salesAgg || [])) {
        achievedMap[sale.salesRepId] = (achievedMap[sale.salesRepId] || 0) + parseFloat(sale.revenue);
    }

    // Group targets by userId
    const targetMap: Record<string, number> = {};
    for (const t of (targets || [])) {
        targetMap[t.salesUserId] = parseFloat(t.targetAmount);
    }

    // 4. Assemble result — only include users who have a target set
    const allResults = salesUsers
        .filter((u: { id: string }) => targetMap[u.id] !== undefined)
        .map((u: { id: string; firstName: string; lastName: string; userCode: string }) => {
            const targetAmount = targetMap[u.id];
            const achievedRevenue = achievedMap[u.id] || 0;
            const performancePercentage =
                targetAmount > 0 ? Math.round((achievedRevenue / targetAmount) * 100 * 10) / 10 : 0;

            let status: 'EXCEEDED' | 'ACHIEVED' | 'BELOW';
            if (achievedRevenue > targetAmount) status = 'EXCEEDED';
            else if (achievedRevenue >= targetAmount) status = 'ACHIEVED';
            else status = 'BELOW';

            return {
                salesUserId: u.id,
                name: `${u.firstName}${u.lastName ? ' ' + u.lastName : ''}`,
                userCode: u.userCode,
                targetAmount,
                achievedRevenue,
                performancePercentage,
                status,
            };
        });

    const total = allResults.length;
    const from = (page - 1) * limit;
    const paged = allResults.slice(from, from + limit);

    res.json({ data: paged, total, page, pages: Math.ceil(total / limit) || 1 });
});

export default router;
