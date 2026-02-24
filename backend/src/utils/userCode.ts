import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLE_PREFIX: Record<string, string> = {
  ADMIN: 'AD',
  SALES: 'SL',
  MANAGEMENT: 'MP',
};

/**
 * Auto-generates the next userCode for a given role.
 * Pattern: SL_001, SL_002, AD_001, MP_001 etc.
 * Safe to call concurrently — uses latest createdAt ordering.
 */
export async function generateUserCode(roleName: string): Promise<string> {
  const prefix = ROLE_PREFIX[roleName.toUpperCase()] || 'US';

  const latestUser = await prisma.user.findFirst({
    where: {
      userCode: { startsWith: `${prefix}_` },
    },
    orderBy: { createdAt: 'desc' },
  });

  let nextNumber = 1;
  if (latestUser?.userCode) {
    const parts = latestUser.userCode.split('_');
    nextNumber = parseInt(parts[1] || '0', 10) + 1;
  }

  return `${prefix}_${String(nextNumber).padStart(3, '0')}`;
}
