import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/dashboard/sales — personal KPIs for SALES role
router.get(
  '/sales',
  verifyToken,
  requireRole('SALES'),
  async (req: Request, res: Response): Promise<void> => {
    const salesRepId = req.user!.userId;

    const [agg, monthlyTrend, topCustomers, territories] = await Promise.all([
      prisma.sale.aggregate({
        where: { salesRepId },
        _sum: { revenue: true, deals: true },
        _avg: { revenue: true },
        _count: { id: true },
      }),
      prisma.sale.groupBy({
        by: ['year', 'month'],
        where: { salesRepId },
        _sum: { revenue: true },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
      prisma.customer.findMany({
        where: { sales: { some: { salesRepId } } },
        take: 5,
      }),
      prisma.salesRepTerritory.findMany({
        where: { salesRepId },
        include: { territory: true },
      }),
    ]);

    res.json({
      totalRevenue: Number(agg._sum.revenue || 0),
      totalDeals: agg._count.id,
      averageDealSize: Number(agg._avg.revenue || 0),
      monthlyTrend: monthlyTrend.map((m) => ({
        year: m.year,
        month: m.month,
        revenue: Number(m._sum.revenue || 0),
      })),
      topCustomers,
      territories: territories.map((t) => t.territory),
    });
  }
);

// GET /api/dashboard/management — regional KPIs for MANAGEMENT + ADMIN
router.get(
  '/management',
  verifyToken,
  requireRole('MANAGEMENT', 'ADMIN'),
  async (_req: Request, res: Response): Promise<void> => {
    const [byTerritory, monthlyTrend, totalAgg] = await Promise.all([
      prisma.sale.groupBy({
        by: ['territoryId'],
        _sum: { revenue: true },
        _count: { id: true },
        orderBy: { _sum: { revenue: 'desc' } },
      }),
      prisma.sale.groupBy({
        by: ['year', 'month'],
        _sum: { revenue: true },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
      prisma.sale.aggregate({
        _sum: { revenue: true },
        _count: { id: true },
      }),
    ]);

    const territoryNames = await prisma.territory.findMany({
      select: { id: true, name: true, state: true, region: true },
    });

    const enriched = byTerritory.map((t) => ({
      territoryId: t.territoryId,
      name: territoryNames.find((tn) => tn.id === t.territoryId)?.name || t.territoryId,
      state: territoryNames.find((tn) => tn.id === t.territoryId)?.state,
      region: territoryNames.find((tn) => tn.id === t.territoryId)?.region,
      revenue: Number(t._sum.revenue || 0),
      deals: t._count.id,
    }));

    // Expansion opportunity indicators
    const insights = enriched.map((t) => ({
      ...t,
      insight:
        t.deals > 10 && t.revenue < 50000
          ? 'PRICING_OPPORTUNITY'
          : t.revenue > 100000
          ? 'EXPANSION_CANDIDATE'
          : null,
    }));

    // Revenue by region
    const revenueByRegion = territoryNames.reduce<Record<string, number>>((acc, t) => {
      const entry = enriched.find((e) => e.territoryId === t.id);
      const region = t.region || 'Unknown';
      acc[region] = (acc[region] || 0) + (entry?.revenue || 0);
      return acc;
    }, {});

    res.json({
      totalRevenue: Number(totalAgg._sum.revenue || 0),
      totalDeals: totalAgg._count.id,
      top5Territories: insights.slice(0, 5),
      bottom5Territories: insights.slice(-5).reverse(),
      revenueByRegion,
      monthlyTrend: monthlyTrend.map((m) => ({
        year: m.year,
        month: m.month,
        revenue: Number(m._sum.revenue || 0),
      })),
    });
  }
);

export default router;
