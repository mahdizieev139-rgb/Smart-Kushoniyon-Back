/**
 * Shared test helpers.
 *
 * `agent()` returns a supertest instance bound to our Express app (no real port
 * is opened). The register/login helpers return the access token so tests can
 * call protected endpoints with `Authorization: Bearer <token>`.
 */
import supertest from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { hashPassword } from '../src/utils/password';
import type { UserRole } from '@prisma/client';

export const app = createApp();
export const api = supertest(app);

export const API = '/api/v1';

interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
}

let counter = 0;

// Register a new user through the real endpoint and return its access token.
export async function registerUser(role: 'CUSTOMER' | 'SELLER' = 'CUSTOMER'): Promise<TestUser> {
  counter += 1;
  const email = `user${counter}_${Date.now()}@test.local`;
  const password = 'Password123!';

  const res = await api.post(`${API}/auth/register`).send({ name: `User ${counter}`, email, password, role });
  return { id: res.body.data.user.id, email, password, accessToken: res.body.data.accessToken };
}

// Create a user with an arbitrary role directly in the DB (for admins), then
// log in to obtain an access token.
export async function createUserWithRole(role: UserRole): Promise<TestUser> {
  counter += 1;
  const email = `role${counter}_${Date.now()}@test.local`;
  const password = 'Password123!';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { name: `Role ${role}`, email, passwordHash, role } });

  const res = await api.post(`${API}/auth/login`).send({ email, password });
  return { id: user.id, email, password, accessToken: res.body.data.accessToken };
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// Create a seller, an approved shop, and (optionally) an approved product.
// Returns the ids + tokens used across the v2 feature tests.
export async function sellerWithApprovedShop(name = 'Shop') {
  const seller = await registerUser('SELLER');
  const admin = await createUserWithRole('ADMIN');
  const shopRes = await api
    .post(`${API}/shops`)
    .set(auth(seller.accessToken))
    .send({ translations: [{ locale: 'tj', name }] });
  const shopId = shopRes.body.data.id;
  await api.patch(`${API}/admin/shops/${shopId}/approve`).set(auth(admin.accessToken));
  return { seller, admin, shopId };
}

export async function createApprovedProduct(
  token: string,
  adminToken: string,
  shopId: string,
  body: Record<string, unknown> = {},
) {
  const res = await api
    .post(`${API}/products`)
    .set(auth(token))
    .send({ shopId, price: 50, translations: [{ locale: 'tj', name: 'Item' }], ...body });
  const productId = res.body.data.id;
  await api.patch(`${API}/admin/products/${productId}/approve`).set(auth(adminToken));
  return productId;
}
