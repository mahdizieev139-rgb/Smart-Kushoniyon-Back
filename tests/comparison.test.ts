/**
 * Product price comparison tests.
 */
import { describe, it, expect } from 'vitest';
import { prisma } from '../src/config/database';
import { api, API, registerUser, createUserWithRole, auth, sellerWithApprovedShop, createApprovedProduct } from './helpers';

// Create an ACTIVE category and return its id (comparison matches on category).
async function createCategory() {
  const cat = await prisma.category.create({
    data: { slug: `cat-${Date.now()}-${Math.round(Math.random() * 1e6)}`, translations: { create: [{ locale: 'tj', name: 'Tiles' }] } },
  });
  return cat.id;
}

describe('Price comparison', () => {
  it('finds an equivalent product from a DIFFERENT shop, sorted by price', async () => {
    const categoryId = await createCategory();

    // Shop A — source product at 50.
    const a = await sellerWithApprovedShop('Shop A');
    const sourceId = await createApprovedProduct(a.seller.accessToken, a.admin.accessToken, a.shopId, {
      categoryId,
      price: 50,
      brand: 'Acme',
      stockUnit: 'm2',
    });

    // Shop B — cheaper equivalent at 42 (same category + brand).
    const b = await sellerWithApprovedShop('Shop B');
    await createApprovedProduct(b.seller.accessToken, b.admin.accessToken, b.shopId, {
      categoryId,
      price: 42,
      brand: 'Acme',
      stockUnit: 'm2',
    });

    const res = await api.get(`${API}/products/${sourceId}/compare`);
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);
    expect(res.body.data.comparisons[0].price).toBe('42.00');
    // matched on category + brand + unit.
    expect(res.body.data.comparisons[0].matchedOn).toContain('brand');
  });

  it('does not compare against the product\'s own shop', async () => {
    const categoryId = await createCategory();
    const a = await sellerWithApprovedShop('Shop A');
    const sourceId = await createApprovedProduct(a.seller.accessToken, a.admin.accessToken, a.shopId, { categoryId, price: 50 });
    // Another product in the SAME shop, same category.
    await createApprovedProduct(a.seller.accessToken, a.admin.accessToken, a.shopId, { categoryId, price: 30 });

    const res = await api.get(`${API}/products/${sourceId}/compare`);
    expect(res.body.data.count).toBe(0);
  });

  it('returns 404 for a non-approved source product', async () => {
    const seller = await registerUser('SELLER');
    await createUserWithRole('ADMIN');
    const shop = await api.post(`${API}/shops`).set(auth(seller.accessToken)).send({ translations: [{ locale: 'tj', name: 'S' }] });
    // Shop + product left unapproved.
    const product = await api
      .post(`${API}/products`)
      .set(auth(seller.accessToken))
      .send({ shopId: shop.body.data.id, price: 10, translations: [{ locale: 'tj', name: 'X' }] });

    const res = await api.get(`${API}/products/${product.body.data.id}/compare`);
    expect(res.status).toBe(404);
  });
});
