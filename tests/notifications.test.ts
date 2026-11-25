/**
 * Notification ownership + read/delete tests.
 * We generate a real notification via the favorite -> price-change flow.
 */
import { describe, it, expect } from 'vitest';
import { api, API, registerUser, auth, sellerWithApprovedShop, createApprovedProduct } from './helpers';

// Returns a customer who has exactly one PRICE_CHANGED notification.
async function customerWithNotification() {
  const { seller, admin, shopId } = await sellerWithApprovedShop();
  const productId = await createApprovedProduct(seller.accessToken, admin.accessToken, shopId, { price: 50 });
  const customer = await registerUser('CUSTOMER');
  await api.post(`${API}/favorites/products/${productId}`).set(auth(customer.accessToken));
  await api.patch(`${API}/products/${productId}`).set(auth(seller.accessToken)).send({ price: 40 });
  return customer;
}

describe('Notifications', () => {
  it('lists the user\'s notifications with an unread count', async () => {
    const customer = await customerWithNotification();
    const res = await api.get(`${API}/notifications`).set(auth(customer.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.meta.unreadCount).toBe(1);
  });

  it('prevents a user from reading another user\'s notification', async () => {
    const owner = await customerWithNotification();
    const other = await registerUser('CUSTOMER');
    const list = await api.get(`${API}/notifications`).set(auth(owner.accessToken));
    const notifId = list.body.data[0].id;

    const res = await api.patch(`${API}/notifications/${notifId}/read`).set(auth(other.accessToken));
    expect(res.status).toBe(404);
  });

  it('marks all as read and deletes own notification', async () => {
    const customer = await customerWithNotification();
    const all = await api.patch(`${API}/notifications/read-all`).set(auth(customer.accessToken));
    expect(all.status).toBe(200);

    const list = await api.get(`${API}/notifications`).set(auth(customer.accessToken));
    expect(list.body.meta.unreadCount).toBe(0);

    const del = await api.delete(`${API}/notifications/${list.body.data[0].id}`).set(auth(customer.accessToken));
    expect(del.status).toBe(200);
  });
});
