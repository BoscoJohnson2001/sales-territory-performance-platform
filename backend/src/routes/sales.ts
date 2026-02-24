import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

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
      customerLocation,
      customerContact,
    } = req.body;

    const salesRepId = req.user!.userId;

    // SALES role: verify territory is assigned to them
    if (req.user!.role === 'SALES') {
      const assignment = await prisma.salesRepTerritory.findFirst({
        where: { salesRepId, territoryId },
      });
      if (!assignment) {
        res.status(403).json({ message: 'Territory not assigned to you' });
        return;
      }
    }

    const customer = await prisma.customer.create({
      data: {
        name: customerName,
        industry: customerIndustry || null,
        location: customerLocation || null,
        contact: customerContact || null,
      },
    });

    const sale = await prisma.sale.create({
      data: {
        revenue,
        deals: parseInt(deals),
        quantity: parseInt(quantity),
        saleDate: new Date(saleDate),
        month: parseInt(month),
        year: parseInt(year),
        territoryId,
        salesRepId,
        productId,
        customerId: customer.id,
      },
      include: { territory: true, product: true, customer: true },
    });

    res.status(201).json(sale);
  } catch (err) {
    console.error('[SALES] Create sale error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/sales — get sales (SALES role: own only; ADMIN: all)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const salesRepId = req.user!.role === 'SALES' ? req.user!.userId : undefined;
  const page = parseInt((req.query.page as string) || '1');
  const limit = parseInt((req.query.limit as string) || '20');
  const where = salesRepId ? { salesRepId } : {};

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { territory: true, product: true, customer: true },
      orderBy: { saleDate: 'desc' },
    }),
    prisma.sale.count({ where }),
  ]);

  res.json({ sales, total, page, pages: Math.ceil(total / limit) });
});

export default router;
