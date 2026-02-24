import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { verifyToken, requireRole } from '../middleware/auth';
import { generateUserCode } from '../utils/userCode';
import { sendOnboardingEmail } from '../services/email';
import { supabase } from '../config/supabase';
import { fromZonedTime } from 'date-fns-tz';

const router = Router();

// All admin routes require ADMIN role
router.use(verifyToken, requireRole('ADMIN'));

// GET /api/admin/users
router.get('/users', async (_req: Request, res: Response): Promise<void> => {
  const { data: users, error } = await supabase
    .from('User')
    .select('*, Role(*), SalesRepTerritory(*, Territory(*))')
    .order('createdAt', { ascending: false });

  if (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
    return;
  }

  res.json(
    (users || []).map((u: any) => ({
      id: u.id,
      userCode: u.userCode,
      firstName: u.firstName,
      lastName: u.lastName,
      displayName: u.displayName || null,
      email: u.email,
      phoneNumber: u.phoneNumber || null,
      joiningDate: u.joiningDate || null,
      workStartTimeUtc: u.workStartTimeUtc || null,
      workEndTimeUtc: u.workEndTimeUtc || null,
      role: u.Role.name,
      isActive: u.isActive,
      isFirstLogin: u.isFirstLogin,
      territories: (u.SalesRepTerritory || []).map((t: any) => t.Territory),
      createdAt: u.createdAt,
    }))
  );
});

// ─── UTC conversion helper ────────────────────────────────────────────────────
// Converts a local "HH:MM" time + IANA timezone to a UTC ISO string.
// Uses date-fns-tz zonedTimeToUtc — single conversion, no manual offset math.
function localTimeToUtc(timeHHMM: string, timezone: string, anchorDate?: string): string {
  // Use provided anchor date (joiningDate if set) or today in UTC
  const now = new Date();
  const anchor = anchorDate || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  // Combine "YYYY-MM-DD HH:mm" and convert from given timezone to UTC
  const result = fromZonedTime(`${anchor} ${timeHHMM}`, timezone);
  return result.toISOString();
}

// POST /api/admin/users — create a new Sales Rep
router.post('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      firstName, lastName, displayName,
      email,
      phoneNumber,
      joiningDate,
      workStartTime, workEndTime, timezone,
    } = req.body;

    if (!firstName || !email) {
      res.status(400).json({ message: 'firstName and email are required' });
      return;
    }

    // Phone validation
    if (phoneNumber && !String(phoneNumber).startsWith('+')) {
      res.status(400).json({ message: 'phoneNumber must include country code (start with +)' });
      return;
    }

    // Joining date: cannot be in the future
    if (joiningDate) {
      const jd = new Date(joiningDate);
      if (jd > new Date()) {
        res.status(400).json({ message: 'joiningDate cannot be a future date' });
        return;
      }
    }

    // Work hours validation
    if ((workStartTime && !workEndTime) || (!workStartTime && workEndTime)) {
      res.status(400).json({ message: 'Provide both workStartTime and workEndTime' });
      return;
    }
    if (workStartTime && workEndTime) {
      const [sh, sm] = workStartTime.split(':').map(Number);
      const [eh, em] = workEndTime.split(':').map(Number);
      if (eh * 60 + em <= sh * 60 + sm) {
        res.status(400).json({ message: 'workEndTime must be after workStartTime' });
        return;
      }
    }

    const { data: existing } = await supabase
      .from('User')
      .select('id')
      .eq('email', email.toLowerCase());

    if (existing && existing.length > 0) {
      res.status(409).json({ message: 'Email already registered' });
      return;
    }

    const { data: salesRoles } = await supabase
      .from('Role')
      .select('*')
      .eq('name', 'SALES');

    if (!salesRoles || salesRoles.length === 0) {
      res.status(500).json({ message: 'SALES role not found — run seed first' });
      return;
    }

    const salesRole = salesRoles[0];
    const userCode = await generateUserCode('SALES');
    const onboardingToken = crypto.randomBytes(32).toString('hex');
    const onboardingTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Compute UTC times — uses joiningDate as anchor (or today if not set)
    const tz = timezone || 'UTC';
    const anchor = joiningDate
      ? new Date(joiningDate).toISOString().split('T')[0]   // "YYYY-MM-DD"
      : new Date().toISOString().split('T')[0];
    const startUtc = workStartTime ? localTimeToUtc(workStartTime, tz, anchor) : null;
    const endUtc = workEndTime ? localTimeToUtc(workEndTime, tz, anchor) : null;


    // Auto-compute displayName if not provided
    const resolvedDisplayName = (displayName || '').trim() || `${firstName} ${lastName || ''}`.trim();

    const { data: created, error } = await supabase
      .from('User')
      .insert({
        id: crypto.randomUUID(),
        firstName,
        lastName: lastName || null,
        displayName: resolvedDisplayName,
        email: email.toLowerCase(),
        phoneNumber: phoneNumber || null,
        joiningDate: joiningDate ? new Date(joiningDate).toISOString() : null,
        workStartTimeUtc: startUtc,
        workEndTimeUtc: endUtc,
        userCode,
        roleId: salesRole.id,
        onboardingToken,
        onboardingTokenExpiry,
        isFirstLogin: true,
        isActive: true,
      })
      .select()
      .single();

    if (error || !created) {
      console.error('[ADMIN] Create user error:', error);
      res.status(500).json({ message: 'Failed to create user' });
      return;
    }

    await sendOnboardingEmail(email, firstName, onboardingToken);

    res.status(201).json({
      id: created.id,
      userCode: created.userCode,
      email: created.email,
      message: 'Sales rep created. Onboarding email sent.',
    });
  } catch (err) {
    console.error('[ADMIN] Create user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/admin/users/:id/activate
router.put('/users/:id/activate', async (req: Request, res: Response): Promise<void> => {
  await supabase.from('User').update({ isActive: true }).eq('id', req.params.id);
  res.json({ message: 'User activated' });
});

// PUT /api/admin/users/:id/deactivate
router.put('/users/:id/deactivate', async (req: Request, res: Response): Promise<void> => {
  await supabase.from('User').update({ isActive: false }).eq('id', req.params.id);
  res.json({ message: 'User deactivated' });
});

// GET /api/admin/products
router.get('/products', async (_req: Request, res: Response): Promise<void> => {
  const { data } = await supabase.from('Product').select('*').order('createdAt', { ascending: false });
  res.json(data || []);
});

// POST /api/admin/products
router.post('/products', async (req: Request, res: Response): Promise<void> => {
  const { name, category, price } = req.body;
  const { data, error } = await supabase
    .from('Product')
    .insert({ id: crypto.randomUUID(), name, category, price })
    .select()
    .single();
  if (error) { res.status(500).json({ message: 'Failed to create product' }); return; }
  res.status(201).json(data);
});

// GET /api/admin/territories
router.get('/territories', async (_req: Request, res: Response): Promise<void> => {
  const { data } = await supabase.from('Territory').select('*').order('name', { ascending: true });
  res.json(data || []);
});

// POST /api/admin/territories — create territory
router.post('/territories', async (req: Request, res: Response): Promise<void> => {
  const { name, state, region, latitude, longitude } = req.body;
  const { data, error } = await supabase
    .from('Territory')
    .insert({ id: crypto.randomUUID(), name, state, region, latitude, longitude })
    .select()
    .single();
  if (error) { res.status(500).json({ message: 'Failed to create territory' }); return; }
  res.status(201).json(data);
});

// POST /api/admin/territories/assign — assign territory to sales rep
router.post('/territories/assign', async (req: Request, res: Response): Promise<void> => {
  const { salesRepId, territoryId } = req.body;
  const { data, error } = await supabase
    .from('SalesRepTerritory')
    .insert({ id: crypto.randomUUID(), salesRepId, territoryId })
    .select()
    .single();
  if (error) {
    res.status(409).json({ message: 'This assignment already exists' });
    return;
  }
  res.status(201).json(data);
});

// DELETE /api/admin/territories/assign — unassign territory from sales rep
router.delete('/territories/assign', async (req: Request, res: Response): Promise<void> => {
  const { salesRepId, territoryId } = req.body;
  await supabase.from('SalesRepTerritory').delete().eq('salesRepId', salesRepId).eq('territoryId', territoryId);
  res.json({ message: 'Territory unassigned' });
});

// GET /api/admin/sales — all sales (paginated)
router.get('/sales', async (req: Request, res: Response): Promise<void> => {
  const page = parseInt((req.query.page as string) || '1');
  const limit = parseInt((req.query.limit as string) || '20');
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data: sales, count, error } = await supabase
    .from('Sale')
    .select('*, Territory(*), User(*), Product(*), Customer(*)', { count: 'exact' })
    .order('createdAt', { ascending: false })
    .range(from, to);

  if (error) { res.status(500).json({ message: 'Failed to fetch sales' }); return; }
  const total = count || 0;
  res.json({ sales: sales || [], total, page, pages: Math.ceil(total / limit) });
});

// GET /api/admin/sales-users/:id/territories — get all territories assigned to a sales user
router.get('/sales-users/:id/territories', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const { data: user } = await supabase.from('User').select('id, role:Role(name)').eq('id', id).single();
  if (!user) { res.status(404).json({ message: 'User not found' }); return; }

  const { data: assignments } = await supabase
    .from('SalesRepTerritory')
    .select('id, assignedAt, Territory(*)')
    .eq('salesRepId', id);

  res.json((assignments || []).map((a: any) => ({
    assignmentId: a.id,
    assignedAt: a.assignedAt,
    ...a.Territory,
  })));
});

// POST /api/admin/sales-users/:id/territories — bulk assign territories to a sales user
router.post('/sales-users/:id/territories', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { territoryIds } = req.body as { territoryIds: string[] };

  if (!territoryIds || !Array.isArray(territoryIds) || territoryIds.length === 0) {
    res.status(400).json({ message: 'territoryIds must be a non-empty array' });
    return;
  }

  // Validate user exists and is SALES role
  const { data: users } = await supabase.from('User').select('id, Role(name)').eq('id', id);
  if (!users || users.length === 0) { res.status(404).json({ message: 'User not found' }); return; }
  const user = users[0] as any;
  if (user.Role?.name !== 'SALES') {
    res.status(400).json({ message: 'Territory assignment is only allowed for SALES role users' });
    return;
  }

  // Validate all territories exist
  const { data: foundTerritories } = await supabase
    .from('Territory')
    .select('id')
    .in('id', territoryIds);
  const foundIds = (foundTerritories || []).map((t: any) => t.id);
  const missing = territoryIds.filter(tid => !foundIds.includes(tid));
  if (missing.length > 0) {
    res.status(400).json({ message: `Territories not found: ${missing.join(', ')}` });
    return;
  }

  // Fetch existing assignments to skip duplicates
  const { data: existing } = await supabase
    .from('SalesRepTerritory')
    .select('territoryId')
    .eq('salesRepId', id);
  const existingIds = new Set((existing || []).map((e: any) => e.territoryId));

  const newAssignments = territoryIds
    .filter(tid => !existingIds.has(tid))
    .map(tid => ({ id: crypto.randomUUID(), salesRepId: id, territoryId: tid }));

  if (newAssignments.length === 0) {
    res.json({ message: 'All territories already assigned', assigned: 0 });
    return;
  }

  const { error } = await supabase.from('SalesRepTerritory').insert(newAssignments);
  if (error) { res.status(500).json({ message: 'Failed to assign territories' }); return; }

  res.status(201).json({ message: `${newAssignments.length} territory/territories assigned`, assigned: newAssignments.length });
});

// DELETE /api/admin/sales-users/:id/territories/:territoryId — remove a single territory mapping
router.delete('/sales-users/:id/territories/:territoryId', async (req: Request, res: Response): Promise<void> => {
  const { id, territoryId } = req.params;
  const { error } = await supabase
    .from('SalesRepTerritory')
    .delete()
    .eq('salesRepId', id)
    .eq('territoryId', territoryId);
  if (error) { res.status(500).json({ message: 'Failed to remove territory assignment' }); return; }
  res.json({ message: 'Territory assignment removed' });
});

export default router;
