import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { verifyToken, requireRole } from '../middleware/auth';
import { generateUserCode } from '../utils/userCode';
import { sendOnboardingEmail } from '../services/email';

const router = Router();
const prisma = new PrismaClient();

// All admin routes require ADMIN role
router.use(verifyToken, requireRole('ADMIN'));

// GET /api/admin/users
router.get('/users', async (_req: Request, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    include: { role: true, territories: { include: { territory: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    users.map((u) => ({
      id: u.id,
      userCode: u.userCode,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role.name,
      isActive: u.isActive,
      isFirstLogin: u.isFirstLogin,
      territories: u.territories.map((t) => t.territory),
      createdAt: u.createdAt,
    }))
  );
});

// POST /api/admin/users — create a new Sales Rep
router.post('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email } = req.body;
    if (!firstName || !email) {
      res.status(400).json({ message: 'firstName and email are required' });
      return;
    }

    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) {
      res.status(409).json({ message: 'Email already registered' });
      return;
    }

    const salesRole = await prisma.role.findUnique({ where: { name: 'SALES' } });
    if (!salesRole) {
      res.status(500).json({ message: 'SALES role not found — run seed first' });
      return;
    }

    const userCode = await generateUserCode('SALES');
    const onboardingToken = crypto.randomBytes(32).toString('hex');
    const onboardingTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName: lastName || null,
        email: email.toLowerCase(),
        userCode,
        roleId: salesRole.id,
        onboardingToken,
        onboardingTokenExpiry,
        isFirstLogin: true,
        isActive: true,
      },
    });

    await sendOnboardingEmail(email, firstName, onboardingToken);

    res.status(201).json({
      id: user.id,
      userCode: user.userCode,
      email: user.email,
      message: 'Sales rep created. Onboarding email sent.',
    });
  } catch (err) {
    console.error('[ADMIN] Create user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/admin/users/:id/activate
router.put('/users/:id/activate', async (req: Request, res: Response): Promise<void> => {
  await prisma.user.update({ where: { id: req.params.id }, data: { isActive: true } });
  res.json({ message: 'User activated' });
});

// PUT /api/admin/users/:id/deactivate
router.put('/users/:id/deactivate', async (req: Request, res: Response): Promise<void> => {
  await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ message: 'User deactivated' });
});

// GET /api/admin/products
router.get('/products', async (_req: Request, res: Response): Promise<void> => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(products);
});

// POST /api/admin/products
router.post('/products', async (req: Request, res: Response): Promise<void> => {
  const { name, category, price } = req.body;
  const product = await prisma.product.create({ data: { name, category, price } });
  res.status(201).json(product);
});

// GET /api/admin/territories
router.get('/territories', async (_req: Request, res: Response): Promise<void> => {
  const territories = await prisma.territory.findMany({ orderBy: { name: 'asc' } });
  res.json(territories);
});

// POST /api/admin/territories — create territory
router.post('/territories', async (req: Request, res: Response): Promise<void> => {
  const { name, state, region, latitude, longitude } = req.body;
  const territory = await prisma.territory.create({
    data: { name, state, region, latitude, longitude },
  });
  res.status(201).json(territory);
});

// POST /api/admin/territories/assign — assign territory to sales rep
router.post('/territories/assign', async (req: Request, res: Response): Promise<void> => {
  const { salesRepId, territoryId } = req.body;
  try {
    const assignment = await prisma.salesRepTerritory.create({
      data: { salesRepId, territoryId },
    });
    res.status(201).json(assignment);
  } catch {
    res.status(409).json({ message: 'This assignment already exists' });
  }
});

// DELETE /api/admin/territories/assign — unassign territory from sales rep
router.delete('/territories/assign', async (req: Request, res: Response): Promise<void> => {
  const { salesRepId, territoryId } = req.body;
  await prisma.salesRepTerritory.deleteMany({ where: { salesRepId, territoryId } });
  res.json({ message: 'Territory unassigned' });
});

// GET /api/admin/sales — all sales (paginated)
router.get('/sales', async (req: Request, res: Response): Promise<void> => {
  const page = parseInt((req.query.page as string) || '1');
  const limit = parseInt((req.query.limit as string) || '20');
  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      skip: (page - 1) * limit,
      take: limit,
      include: { territory: true, salesRep: true, product: true, customer: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sale.count(),
  ]);
  res.json({ sales, total, page, pages: Math.ceil(total / limit) });
});

export default router;
