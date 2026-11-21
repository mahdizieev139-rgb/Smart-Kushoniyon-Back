/**
 * Database seed — inserts a small, SAFE demo dataset for development & demos.
 *
 * Run with:  npm run db:seed
 *
 * Everything created here is clearly marked as DEMO (names prefixed with
 * "DEMO" and slugs/codes starting with "demo-"). We do NOT invent real market
 * coordinates — map positions are left null until verified data is collected.
 *
 * The seed is idempotent: it uses upserts keyed on unique fields, so running it
 * multiple times will not create duplicates.
 */
import type { Locale } from '@prisma/client';
import { prisma } from '../src/config/database';
import { logger } from '../src/config/logger';
import { hashPassword } from '../src/utils/password';
import { ensureSuperAdmin } from '../scripts/create-super-admin';

// Small helper to build the 3 translations (tj/ru/en) for a record.
function t(tj: string, ru: string, en: string): Array<{ locale: Locale; name: string }> {
  return [
    { locale: 'tj', name: tj },
    { locale: 'ru', name: ru },
    { locale: 'en', name: en },
  ];
}

async function main() {
  logger.info('🌱 Seeding database with DEMO data...');

  // 1. Super admin (bootstrap account from environment variables).
  await ensureSuperAdmin();

  // 2. A demo ADMIN, SELLER and CUSTOMER so every role can be tested.
  const demoPassword = await hashPassword('Demo1234!');

  await prisma.user.upsert({
    where: { email: 'admin@kushoniyon.local' },
    update: {},
    create: { email: 'admin@kushoniyon.local', name: 'DEMO Admin', passwordHash: demoPassword, role: 'ADMIN' },
  });

  const seller = await prisma.user.upsert({
    where: { email: 'seller@kushoniyon.local' },
    update: {},
    create: { email: 'seller@kushoniyon.local', name: 'DEMO Seller', passwordHash: demoPassword, role: 'SELLER' },
  });

  await prisma.user.upsert({
    where: { email: 'customer@kushoniyon.local' },
    update: {},
    create: { email: 'customer@kushoniyon.local', name: 'DEMO Customer', passwordHash: demoPassword, role: 'CUSTOMER' },
  });

  // 3. Categories (with translations). Construction-materials themed.
  const categories: Array<{ slug: string; tj: string; ru: string; en: string }> = [
    { slug: 'demo-tiles', tj: 'Кошинҳо', ru: 'Плитка', en: 'Tiles' },
    { slug: 'demo-paint', tj: 'Рангҳо', ru: 'Краски', en: 'Paint' },
    { slug: 'demo-plumbing', tj: 'Сантехника', ru: 'Сантехника', en: 'Plumbing' },
    { slug: 'demo-tools', tj: 'Асбобҳо', ru: 'Инструменты', en: 'Tools' },
  ];

  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        slug: c.slug,
        translations: { create: t(`DEMO ${c.tj}`, `DEMO ${c.ru}`, `DEMO ${c.en}`) },
      },
    });
  }
  const tilesCategory = await prisma.category.findUnique({ where: { slug: 'demo-tiles' } });

  // 4. One gate + one section (coordinates left NULL — not invented).
  const gate = await prisma.gate.upsert({
    where: { code: 'demo-gate-1' },
    update: {},
    create: {
      code: 'demo-gate-1',
      translations: { create: t('DEMO Дарвозаи 1', 'DEMO Ворота 1', 'DEMO Gate 1') },
    },
  });

  const section = await prisma.section.upsert({
    where: { code: 'demo-section-a' },
    update: {},
    create: {
      code: 'demo-section-a',
      gateId: gate.id,
      translations: {
        create: [
          { locale: 'tj', name: 'DEMO Қатори А', description: null },
          { locale: 'ru', name: 'DEMO Ряд А', description: null },
          { locale: 'en', name: 'DEMO Row A', description: null },
        ],
      },
    },
  });

  // 5. A demo shop, approved and owned by the demo seller.
  const shop = await prisma.shop.upsert({
    where: { slug: 'demo-shop-sohibkor' },
    update: {},
    create: {
      slug: 'demo-shop-sohibkor',
      phone: '+992900000000',
      status: 'APPROVED',
      sectionId: section.id,
      translations: {
        create: [
          { locale: 'tj', name: 'DEMO Мағозаи Соҳибкор', description: 'Намунаи мағоза' },
          { locale: 'ru', name: 'DEMO Магазин Сохибкор', description: 'Демо-магазин' },
          { locale: 'en', name: 'DEMO Sohibkor Shop', description: 'Demo shop' },
        ],
      },
      members: { create: { userId: seller.id, role: 'OWNER' } },
    },
  });

  // 6. Two demo products in that shop.
  const existingProducts = await prisma.product.count({ where: { shopId: shop.id } });
  if (existingProducts === 0) {
    await prisma.product.create({
      data: {
        shopId: shop.id,
        categoryId: tilesCategory?.id ?? null,
        price: '45.50',
        currency: 'TJS',
        status: 'APPROVED',
        availability: 'IN_STOCK',
        translations: {
          create: [
            { locale: 'tj', name: 'DEMO Кошини сафед', description: 'Кошини девор' },
            { locale: 'ru', name: 'DEMO Белая плитка', description: 'Настенная плитка' },
            { locale: 'en', name: 'DEMO White tile', description: 'Wall tile' },
          ],
        },
      },
    });

    await prisma.product.create({
      data: {
        shopId: shop.id,
        categoryId: tilesCategory?.id ?? null,
        price: '62.00',
        currency: 'TJS',
        status: 'PENDING',
        availability: 'IN_STOCK',
        translations: {
          create: [
            { locale: 'tj', name: 'DEMO Кошини хокистарӣ', description: null },
            { locale: 'ru', name: 'DEMO Серая плитка', description: null },
            { locale: 'en', name: 'DEMO Grey tile', description: null },
          ],
        },
      },
    });
  }

  logger.info('✅ Seed complete.');
  logger.info('   Demo logins (password: Demo1234!):');
  logger.info(`   - admin@kushoniyon.local    (ADMIN)`);
  logger.info(`   - seller@kushoniyon.local   (SELLER)`);
  logger.info(`   - customer@kushoniyon.local (CUSTOMER)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    logger.error({ error }, 'Seed failed');
    await prisma.$disconnect();
    process.exit(1);
  });
