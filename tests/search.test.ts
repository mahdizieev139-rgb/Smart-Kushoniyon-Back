/**
 * Search tests: product/shop search, public visibility, pagination, filters.
 */
import { describe, it, expect } from 'vitest';
import { api, API, registerUser, createUserWithRole, auth } from './helpers';

async function seedApprovedProduct(name: string, price = 50) {
  const seller = await registerUser('SELLER');
  const admin = await createUserWithRole('ADMIN');
  const shop = await api
    .post(`${API}/shops`)
    .set(auth(seller.accessToken))
    .send({ translations: [{ locale: 'tj', name: `Shop ${name}` }] });
  const shopId = shop.body.data.id;
  await api.patch(`${API}/admin/shops/${shopId}/approve`).set(auth(admin.accessToken));

  const product = await api
    .post(`${API}/products`)
    .set(auth(seller.accessToken))
    .send({ shopId, price, translations: [{ locale: 'tj', name }] });
  await api.patch(`${API}/admin/products/${product.body.data.id}/approve`).set(auth(admin.accessToken));
  return { seller, admin, shopId };
}

describe('Search', () => {
  it('finds an approved product by name', async () => {
    await seedApprovedProduct('UniqueWidget');
    const res = await api.get(`${API}/search`).query({ q: 'UniqueWidget', type: 'products' });
    expect(res.status).toBe(200);
    expect(res.body.data.results.products.length).toBe(1);
  });

  it('does not return pending products in search', async () => {
    const seller = await registerUser('SELLER');
    const admin = await createUserWithRole('ADMIN');
    const shop = await api.post(`${API}/shops`).set(auth(seller.accessToken)).send({ translations: [{ locale: 'tj', name: 'S' }] });
    await api.patch(`${API}/admin/shops/${shop.body.data.id}/approve`).set(auth(admin.accessToken));
    // Product left PENDING on purpose.
    await api
      .post(`${API}/products`)
      .set(auth(seller.accessToken))
      .send({ shopId: shop.body.data.id, price: 10, translations: [{ locale: 'tj', name: 'HiddenGizmo' }] });

    const res = await api.get(`${API}/search`).query({ q: 'HiddenGizmo' });
    expect(res.body.data.results.products.length).toBe(0);
  });

  it('respects a price filter', async () => {
    await seedApprovedProduct('CheapThing', 10);
    await seedApprovedProduct('CheapThing', 999);
    const res = await api.get(`${API}/search`).query({ q: 'CheapThing', type: 'products', maxPrice: 50 });
    expect(res.body.data.results.products.length).toBe(1);
  });

  it('requires a query string', async () => {
    const res = await api.get(`${API}/search`);
    expect(res.status).toBe(400);
  });
});
