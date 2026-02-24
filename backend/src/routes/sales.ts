import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { verifyToken, requireRole } from '../middleware/auth';
import { supabase } from '../config/supabase';

const router = Router();

router.use(verifyToken, requireRole('SALES', 'ADMIN'));

// POST /api/sales — create a sale record
// salesRepId is ALWAYS injected from JWT — never from request body
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      productId,
      revenue,
      territoryId,
      saleDate,
      month,
      year,
      deals,
      quantity,
      customerName,
      customerIndustry,
      customerContact,
    } = req.body;

    const salesRepId = req.user!.userId;

    // SALES role: verify territory is assigned to them
    if (req.user!.role === 'SALES') {
      const { data: assignments } = await supabase
        .from('SalesRepTerritory')
        .select('id')
        .eq('salesRepId', salesRepId)
        .eq('territoryId', territoryId);

      if (!assignments || assignments.length === 0) {
        res.status(403).json({ message: 'Territory not assigned to you' });
        return;
      }
    }

    const customerId = crypto.randomUUID();
    const { error: custError } = await supabase.from('Customer').insert({
      id: customerId,
      name: customerName,
      industry: customerIndustry || null,
      contact: customerContact || null,
    });

    if (custError) {
      console.error('[SALES] Customer create error:', custError);
      res.status(500).json({ message: 'Failed to create customer' });
      return;
    }

    const { data: sale, error: saleError } = await supabase
      .from('Sale')
      .insert({
        id: crypto.randomUUID(),
        revenue,
        deals: parseInt(deals),
        quantity: parseInt(quantity),
        saleDate: new Date(saleDate).toISOString(),
        month: parseInt(month),
        year: parseInt(year),
        territoryId,
        salesRepId,
        productId,
        customerId,
      })
      .select('*, Territory(*), Product(*), Customer(*)')
      .single();

    if (saleError || !sale) {
      console.error('[SALES] Create sale error:', saleError);
      res.status(500).json({ message: 'Internal server error' });
      return;
    }

    res.status(201).json(sale);
  } catch (err) {
    console.error('[SALES] Create sale error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/sales — get sales (SALES role: own only; ADMIN: all)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const page = parseInt((req.query.page as string) || '1');
  const limit = parseInt((req.query.limit as string) || '5');
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('Sale')
    .select('*, Territory(*), Product(*), Customer(*)', { count: 'exact' })
    .order('saleDate', { ascending: false })
    .range(from, to);

  if (req.user!.role === 'SALES') {
    query = query.eq('salesRepId', req.user!.userId);
  }

  const { data: sales, count, error } = await query;

  if (error) {
    res.status(500).json({ message: 'Failed to fetch sales' });
    return;
  }

  const total = count || 0;
  res.json({ sales: sales || [], total, page, pages: Math.ceil(total / limit) });
});

// GET /api/sales/products — product list for sale form dropdowns (SALES + ADMIN)
router.get('/products', async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabase
    .from('Product')
    .select('*')
    .order('name', { ascending: true });
  if (error) { res.status(500).json({ message: 'Failed to fetch products' }); return; }
  res.json(data || []);
});

// GET /api/sales/territories — territories for sale form dropdowns (SALES: own only, ADMIN: all)
router.get('/territories', async (req: Request, res: Response): Promise<void> => {
  if (req.user!.role === 'SALES') {
    const { data: assignments } = await supabase
      .from('SalesRepTerritory')
      .select('Territory(*)')
      .eq('salesRepId', req.user!.userId);
    const territories = (assignments || []).map((a: any) => a.Territory);
    res.json(territories);
    return;
  }
  const { data } = await supabase.from('Territory').select('*').order('name', { ascending: true });
  res.json(data || []);
});

export default router;
