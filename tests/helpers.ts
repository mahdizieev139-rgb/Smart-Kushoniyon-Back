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
