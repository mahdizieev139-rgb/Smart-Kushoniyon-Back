/**
 * Creates (or updates) the bootstrap SUPER_ADMIN account.
 *
 * Run with:  npm run create:superadmin
 *
 * Credentials come from environment variables so we never hardcode secrets:
 *   SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME
 *
 * The function is idempotent: running it twice will not create duplicates — it
 * updates the existing account instead. seed.ts reuses `ensureSuperAdmin`.
 */
import { prisma } from '../src/config/database';
import { logger } from '../src/config/logger';
import { hashPassword } from '../src/utils/password';

export async function ensureSuperAdmin() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? 'superadmin@kushoniyon.local').toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe_Str0ng!';
  const name = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';

  const passwordHash = await hashPassword(password);

  // upsert = update if the email exists, otherwise create.
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'SUPER_ADMIN', status: 'ACTIVE', name },
    create: { email, name, passwordHash, role: 'SUPER_ADMIN', status: 'ACTIVE' },
  });

  logger.info({ email: user.email }, '✅ SUPER_ADMIN is ready');
  return user;
}

// Allow running this file directly (node/tsx scripts/create-super-admin.ts).
if (require.main === module) {
  ensureSuperAdmin()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      logger.error({ error }, 'Failed to create SUPER_ADMIN');
      await prisma.$disconnect();
      process.exit(1);
    });
}
