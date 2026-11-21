/**
 * Admin / Super Admin permission tests.
 */
import { describe, it, expect } from 'vitest';
import { api, API, registerUser, createUserWithRole, auth } from './helpers';

describe('Admin & Super Admin permissions', () => {
  it('lets an admin view market analytics', async () => {
    const admin = await createUserWithRole('ADMIN');
    const res = await api.get(`${API}/admin/analytics`).set(auth(admin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.shops).toBeDefined();
    expect(res.body.data.products).toBeDefined();
  });

  it('forbids a customer from viewing admin analytics', async () => {
    const customer = await registerUser('CUSTOMER');
    const res = await api.get(`${API}/admin/analytics`).set(auth(customer.accessToken));
    expect(res.status).toBe(403);
  });

  it('forbids an ADMIN from creating admin accounts (SUPER_ADMIN only)', async () => {
    const admin = await createUserWithRole('ADMIN');
    const res = await api
      .post(`${API}/admin/users`)
      .set(auth(admin.accessToken))
      .send({ name: 'New Admin', email: 'newadmin@test.local', password: 'Password123!' });
    expect(res.status).toBe(403);
  });

  it('lets a SUPER_ADMIN create an admin account', async () => {
    const superAdmin = await createUserWithRole('SUPER_ADMIN');
    const res = await api
      .post(`${API}/admin/users`)
      .set(auth(superAdmin.accessToken))
      .send({ name: 'New Admin', email: 'newadmin2@test.local', password: 'Password123!' });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('ADMIN');
  });

  it('forbids an ADMIN from changing a user role, allows SUPER_ADMIN', async () => {
    const admin = await createUserWithRole('ADMIN');
    const superAdmin = await createUserWithRole('SUPER_ADMIN');
    const target = await registerUser('CUSTOMER');

    const denied = await api.patch(`${API}/admin/users/${target.id}`).set(auth(admin.accessToken)).send({ role: 'SELLER' });
    expect(denied.status).toBe(403);

    const allowed = await api.patch(`${API}/admin/users/${target.id}`).set(auth(superAdmin.accessToken)).send({ role: 'SELLER' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.role).toBe('SELLER');
  });

  it('lets a SUPER_ADMIN read audit logs but forbids an ADMIN', async () => {
    const admin = await createUserWithRole('ADMIN');
    const superAdmin = await createUserWithRole('SUPER_ADMIN');

    expect((await api.get(`${API}/admin/audit-logs`).set(auth(admin.accessToken))).status).toBe(403);
    expect((await api.get(`${API}/admin/audit-logs`).set(auth(superAdmin.accessToken))).status).toBe(200);
  });
});
