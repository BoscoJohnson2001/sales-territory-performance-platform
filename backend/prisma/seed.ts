/**
 * ============================================================
 * PRISMA SEED FILE — Sales Territory Performance Platform
 * ============================================================
 * HOW TO ADD NEW SEEDED USERS:
 *   1. Add an entry to SEED_USERS array below.
 *   2. Run: npm run prisma:seed
 *   Seeding is UPSERT-based — safe to re-run anytime.
 *   When schema changes, run: npm run prisma:reset (migrate reset + re-seed)
 * ============================================================
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ============================================================
// ROLES — extend this array to add new roles
// ============================================================
const ROLES = [
  { id: 1, name: 'ADMIN' },
  { id: 2, name: 'SALES' },
  { id: 3, name: 'MANAGEMENT' },
];

// ============================================================
// SEED USERS — add new pre-created users here
// ============================================================
interface SeedUser {
  userCode: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleName: string;
  isFirstLogin: boolean;
}

const SEED_USERS: SeedUser[] = [
  {
    userCode: 'AD_001',
    firstName: 'System',
    lastName: 'Admin',
    email: 'admin@pfizer.com',
    password: 'Admin@1234',
    roleName: 'ADMIN',
    isFirstLogin: false,
  },
  {
    userCode: 'MP_001',
    firstName: 'Management',
    lastName: 'User',
    email: 'management@pfizer.com',
    password: 'Mgmt@1234',
    roleName: 'MANAGEMENT',
    isFirstLogin: false,
  },
  // ──────────────────────────────────────────────────────────
  // ADD NEW SEEDED USERS BELOW THIS LINE
  // Example:
  // {
  //   userCode: 'AD_002',
  //   firstName: 'Jane',
  //   lastName: 'Doe',
  //   email: 'jane.doe@pfizer.com',
  //   password: 'Temp@1234',
  //   roleName: 'ADMIN',
  //   isFirstLogin: false,
  // },
  // ──────────────────────────────────────────────────────────
];

async function main() {
  console.log('\n🌱 Starting seed...\n');

  // ── Step 1: Seed Roles ────────────────────────────────────
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name },
      create: role,
    });
    console.log(`  ✅ Role seeded: ${role.name}`);
  }

  console.log();

  // ── Step 2: Seed Users ────────────────────────────────────
  for (const user of SEED_USERS) {
    const role = await prisma.role.findUnique({ where: { name: user.roleName } });
    if (!role) {
      console.error(`  ❌ Role not found: ${user.roleName} — skipping ${user.userCode}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(user.password, 12);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {},  // Don't overwrite existing user data on re-seed
      create: {
        userCode: user.userCode,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        passwordHash,
        roleId: role.id,
        isFirstLogin: user.isFirstLogin,
        isActive: true,
      },
    });
    console.log(`  ✅ User seeded: ${user.userCode} (${user.email})`);
  }

  console.log('\n🎉 Seed complete!\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
