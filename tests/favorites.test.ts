/**
 * Favorites tests: add/remove, ownership isolation, guest rejection.
 */
import { describe, it, expect } from 'vitest';
import { api, API, registerUser, auth, sellerWithApprovedShop, createApprovedProduct } from './helpers';

describe('Favorites', () => {
  it('lets a customer favorite and list a product', async () => {
    const { seller, admin, shopId } = await sellerWithApprovedShop();
    const productId = await createApprovedProduct(seller.accessToken, admin.accessToken, shopId);
    const customer = await registerUser('CUSTOMER');

    const add = await api.post(`${API}/favorites/products/${productId}`).set(auth(customer.accessToken));
    expect(add.status).toBe(201);

    const list = await api.get(`${API}/favorites`).set(auth(customer.accessToken));
    expect(list.status).toBe(200);
    expect(list.body.data.products).toHaveLength(1);
    expect(list.body.data.products[0].id).toBe(productId);
  });

  it('is idempotent (no duplicate favorites)', async () => {
    const { seller, admin, shopId } = await sellerWithApprovedShop();
    const productId = await createApprovedProduct(seller.accessToken, admin.accessToken, shopId);
    const customer = await registerUser('CUSTOMER');

    await api.post(`${API}/favorites/products/${productId}`).set(auth(customer.accessToken));
    await api.post(`${API}/favorites/products/${productId}`).set(auth(customer.accessToken));
    const list = await api.get(`${API}/favorites`).set(auth(customer.accessToken));
    expect(list.body.data.products).toHaveLength(1);
  });

  it('keeps favorites private to each customer', async () => {
    const { seller, admin, shopId } = await sellerWithApprovedShop();
    const productId = await createApprovedProduct(seller.accessToken, admin.accessToken, shopId);
    const a = await registerUser('CUSTOMER');
    const b = await registerUser('CUSTOMER');

    await api.post(`${API}/favorites/products/${productId}`).set(auth(a.accessToken));
    const bList = await api.get(`${API}/favorites`).set(auth(b.accessToken));
    expect(bList.body.data.products).toHaveLength(0);
  });

  it('rejects guests', async () => {
    const res = await api.get(`${API}/favorites`);
    expect(res.status).toBe(401);
  });

  it('lets a customer remove a favorite', async () => {
    const { seller, admin, shopId } = await sellerWithApprovedShop();
    const productId = await createApprovedProduct(seller.accessToken, admin.accessToken, shopId);
    const customer = await registerUser('CUSTOMER');

    await api.post(`${API}/favorites/products/${productId}`).set(auth(customer.accessToken));
    const del = await api.delete(`${API}/favorites/products/${productId}`).set(auth(customer.accessToken));
    expect(del.status).toBe(200);
    const list = await api.get(`${API}/favorites`).set(auth(customer.accessToken));
    expect(list.body.data.products).toHaveLength(0);
  });
});
