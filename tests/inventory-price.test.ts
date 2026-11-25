/**
 * Inventory, price history, and favorite price-change notifications.
 */
import { describe, it, expect } from 'vitest';
import { api, API, registerUser, auth, sellerWithApprovedShop, createApprovedProduct } from './helpers';

describe('Inventory & price history', () => {
  it('lets the owner update stock and availability', async () => {
    const { seller, admin, shopId } = await sellerWithApprovedShop();
    const productId = await createApprovedProduct(seller.accessToken, admin.accessToken, shopId);

    const res = await api
      .patch(`${API}/products/${productId}/stock`)
      .set(auth(seller.accessToken))
      .send({ availability: 'LIMITED_STOCK', stockQuantity: 5, stockUnit: 'pcs' });

    expect(res.status).toBe(200);
    expect(res.body.data.availability).toBe('LIMITED_STOCK');
    expect(res.body.data.stockQuantity).toBe(5);
    expect(res.body.data.lastStockUpdate).toBeTruthy();
  });

  it('prevents a different seller from updating stock', async () => {
    const { seller, admin, shopId } = await sellerWithApprovedShop();
    const productId = await createApprovedProduct(seller.accessToken, admin.accessToken, shopId);
    const intruder = await registerUser('SELLER');

    const res = await api
      .patch(`${API}/products/${productId}/stock`)
      .set(auth(intruder.accessToken))
      .send({ stockQuantity: 999 });
    expect(res.status).toBe(403);
  });

  it('records price history on creation and on price change', async () => {
    const { seller, admin, shopId } = await sellerWithApprovedShop();
    const productId = await createApprovedProduct(seller.accessToken, admin.accessToken, shopId, { price: 50 });

    // Change the price.
    await api.patch(`${API}/products/${productId}`).set(auth(seller.accessToken)).send({ price: 60 });

    const res = await api.get(`${API}/products/${productId}/price-history`);
    expect(res.status).toBe(200);
    // Two entries: initial (50) + change (50 -> 60), newest first.
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].newPrice).toBe('60.00');
    expect(res.body.data[0].oldPrice).toBe('50.00');
  });

  it('notifies a customer who favorited a product when its price changes', async () => {
    const { seller, admin, shopId } = await sellerWithApprovedShop();
    const productId = await createApprovedProduct(seller.accessToken, admin.accessToken, shopId, { price: 50 });
    const customer = await registerUser('CUSTOMER');

    await api.post(`${API}/favorites/products/${productId}`).set(auth(customer.accessToken));
    await api.patch(`${API}/products/${productId}`).set(auth(seller.accessToken)).send({ price: 40 });

    const notifs = await api.get(`${API}/notifications`).set(auth(customer.accessToken));
    expect(notifs.status).toBe(200);
    const priceChange = notifs.body.data.find((n: { type: string }) => n.type === 'PRICE_CHANGED');
    expect(priceChange).toBeTruthy();
  });
});
