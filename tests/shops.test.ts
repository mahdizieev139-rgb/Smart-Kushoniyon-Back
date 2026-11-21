/**
 * Shop tests: create (pending), ownership enforcement, admin approval,
 * public visibility.
 */
import { describe, it, expect } from 'vitest';
import { api, API, registerUser, createUserWithRole, auth } from './helpers';

async function createShop(token: string, name = 'My Shop') {
  return api
    .post(`${API}/shops`)
    .set(auth(token))
    .send({ translations: [{ locale: 'tj', name }], phone: '+992900000001' });
}

describe('Shops', () => {
  it('creates a shop in PENDING status for a seller', async () => {
    const seller = await registerUser('SELLER');
    const res = await createShop(seller.accessToken);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
  });

  it('forbids a customer from creating a shop', async () => {
    const customer = await registerUser('CUSTOMER');
    const res = await createShop(customer.accessToken);
    expect(res.status).toBe(403);
  });

  it('does not show PENDING shops in the public list', async () => {
    const seller = await registerUser('SELLER');
    await createShop(seller.accessToken);
    const res = await api.get(`${API}/shops`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('prevents a seller from updating another seller\'s shop', async () => {
    const owner = await registerUser('SELLER');
    const other = await registerUser('SELLER');
    const created = await createShop(owner.accessToken);
    const shopId = created.body.data.id;

    const res = await api
      .patch(`${API}/shops/${shopId}`)
      .set(auth(other.accessToken))
      .send({ phone: '+992911111111' });
    expect(res.status).toBe(403);
  });

  it('lets an admin approve a shop, making it publicly visible', async () => {
    const seller = await registerUser('SELLER');
    const admin = await createUserWithRole('ADMIN');
    const created = await createShop(seller.accessToken, 'Approvable Shop');
    const shopId = created.body.data.id;

    const approve = await api.patch(`${API}/admin/shops/${shopId}/approve`).set(auth(admin.accessToken));
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('APPROVED');

    const publicList = await api.get(`${API}/shops`);
    expect(publicList.body.data).toHaveLength(1);
  });

  it('forbids a seller from using the admin approve endpoint', async () => {
    const seller = await registerUser('SELLER');
    const created = await createShop(seller.accessToken);
    const res = await api.patch(`${API}/admin/shops/${created.body.data.id}/approve`).set(auth(seller.accessToken));
    expect(res.status).toBe(403);
  });
});
