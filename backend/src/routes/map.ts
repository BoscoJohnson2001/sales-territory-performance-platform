import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(verifyToken);

// GET /api/map/territories — aggregated revenue per territory with color bucket
router.get('/territories', async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, productId, salesRepId: filterRepId } = req.query;

    // SALES role: restrict to assigned territories only
    let allowedTerritoryIds: string[] | undefined;
    if (req.user!.role === 'SALES') {
      const assignments = await prisma.salesRepTerritory.findMany({
        where: { salesRepId: req.user!.userId },
        select: { territoryId: true },
      });
      allowedTerritoryIds = assignments.map((a) => a.territoryId);
    }

    // Build dynamic where clause
    const saleWhere: Record<string, unknown> = {};
    if (allowedTerritoryIds) saleWhere.territoryId = { in: allowedTerritoryIds };
    if (startDate || endDate) {
      saleWhere.saleDate = {
        ...(startDate ? { gte: new Date(startDate as string) } : {}),
        ...(endDate ? { lte: new Date(endDate as string) } : {}),
      };
    }
    if (productId) saleWhere.productId = productId;
    if (filterRepId && req.user!.role !== 'SALES') saleWhere.salesRepId = filterRepId;

    const aggregated = await prisma.sale.groupBy({
      by: ['territoryId'],
      where: saleWhere,
      _sum: { revenue: true },
      _count: { id: true },
    });

    // Determine revenue buckets for color coding
    const revenues = aggregated.map((a) => Number(a._sum.revenue || 0));
    const max = Math.max(...revenues, 1);
    const highThreshold = max * 0.66;
    const midThreshold = max * 0.33;

    const territories = await prisma.territory.findMany({
      where: allowedTerritoryIds ? { id: { in: allowedTerritoryIds } } : undefined,
    });

    const result = territories.map((t) => {
      const agg = aggregated.find((a) => a.territoryId === t.id);
      const revenue = Number(agg?._sum?.revenue || 0);
      const deals = agg?._count?.id || 0;
      const colorBucket =
        revenue >= highThreshold ? 'HIGH' : revenue >= midThreshold ? 'MEDIUM' : 'LOW';

      return {
        id: t.id,
        name: t.name,
        state: t.state,
        region: t.region,
        latitude: t.latitude,
        longitude: t.longitude,
        revenue,
        deals,
        colorBucket, // 'HIGH' | 'MEDIUM' | 'LOW'
      };
    });

    res.json(result);
  } catch (err) {
    console.error('[MAP] Territories error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
