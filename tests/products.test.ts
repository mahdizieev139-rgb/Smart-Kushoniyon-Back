/**
 * Product tests: create (pending), ownership, approval, public visibility,
 * soft delete.
 */
import { describe, it, expect } from 'vitest';
import { api, API, registerUser, createUserWithRole, auth } from './helpers';

// Helper: seller creates an (approved) shop and returns its id.
async function sellerWithApprovedShop() {
  const seller = await registerUser('SELLER');
  const admin = await createUserWithRole('ADMIN');
  const shop = await api
    .post(`${API}/shops`)
    .set(auth(seller.accessToken))
    .send({ translations: [{ locale: 'tj', name: 'Shop' }] });
  const shopId = shop.body.data.id;
  await api.patch(`${API}/admin/shops/${shopId}/approve`).set(auth(admin.accessToken));
  return { seller, admin, shopId };
}

async function createProduct(token: string, shopId: string, name = 'Tile') {
  return api
    .post(`${API}/products`)
    .set(auth(token))
    .send({ shopId, price: 45.5, translations: [{ locale: 'tj', name }] });
}

describe('Products', () => {
  it('creates a product in PENDING status', async () => {
    const { seller, shopId } = await sellerWithApprovedShop();
    const res = await createProduct(seller.accessToken, shopId);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.price).toBe('45.50');
  });

  it('prevents creating a product for a shop you do not own', async () => {
    const { shopId } = await sellerWithApprovedShop();
    const intruder = await registerUser('SELLER');
    const res = await createProduct(intruder.accessToken, shopId);
    expect(res.status).toBe(403);
  });

  it('hides PENDING products from the public list', async () => {
    const { seller, shopId } = await sellerWithApprovedShop();
    await createProduct(seller.accessToken, shopId);
    const res = await api.get(`${API}/products`);
    expect(res.body.data).toHaveLength(0);
  });

  it('shows APPROVED products publicly after admin approval', async () => {
    const { seller, admin, shopId } = await sellerWithApprovedShop();
    const product = await createProduct(seller.accessToken, shopId);
    const productId = product.body.data.id;

    const approve = await api.patch(`${API}/admin/products/${productId}/approve`).set(auth(admin.accessToken));
    expect(approve.status).toBe(200);

    const res = await api.get(`${API}/products`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(productId);
  });

  it('lets the owner soft-delete their product', async () => {
    const { seller, shopId } = await sellerWithApprovedShop();
    const product = await createProduct(seller.accessToken, shopId);
    const del = await api.delete(`${API}/products/${product.body.data.id}`).set(auth(seller.accessToken));
    expect(del.status).toBe(200);

    // Fetching the (now soft-deleted) product returns 404.
    const get = await api.get(`${API}/products/${product.body.data.id}`);
    expect(get.status).toBe(404);
  });
});
