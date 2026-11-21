/**
 * Global test setup.
 *
 * Before EACH test we wipe all data so tests are independent and repeatable.
 * We TRUNCATE every table with CASCADE and RESTART IDENTITY — fast and leaves
 * the schema intact (unlike dropping/recreating).
 *
 * After ALL tests we disconnect Prisma so the process can exit cleanly.
 */
import { beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/config/database';

// All table names (as mapped in schema.prisma via @@map).
const TABLES = [
  'audit_logs',
  'subscription_invoices',
  'subscriptions',
  'advertisements',
  'product_images',
  'product_translations',
  'products',
  'category_translations',
  'categories',
  'shop_members',
  'shop_translations',
  'shops',
  'section_translations',
  'sections',
  'gate_translations',
  'gates',
  'password_reset_tokens',
  'refresh_tokens',
  'users',
  'system_settings',
];

beforeEach(async () => {
  // One statement truncates everything; CASCADE handles foreign keys.
  const list = TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
