/**
 * Customer <-> seller inquiry permission and flow tests.
 */
import { describe, it, expect } from 'vitest';
import { api, API, registerUser, auth, sellerWithApprovedShop } from './helpers';

async function createInquiry(customerToken: string, shopId: string) {
  return api
    .post(`${API}/inquiries`)
    .set(auth(customerToken))
    .send({ shopId, subject: 'Question', message: 'Is this available?' });
}

describe('Inquiries', () => {
  it('lets a customer create an inquiry and the seller see it', async () => {
    const { seller, shopId } = await sellerWithApprovedShop();
    const customer = await registerUser('CUSTOMER');

    const created = await createInquiry(customer.accessToken, shopId);
    expect(created.status).toBe(201);
    expect(created.body.data.messages).toHaveLength(1);

    // Seller sees it in their "seller" scope.
    const sellerList = await api.get(`${API}/inquiries?role=seller`).set(auth(seller.accessToken));
    expect(sellerList.body.data).toHaveLength(1);
  });

  it('prevents another customer from reading an inquiry', async () => {
    const { shopId } = await sellerWithApprovedShop();
    const customer = await registerUser('CUSTOMER');
    const other = await registerUser('CUSTOMER');

    const created = await createInquiry(customer.accessToken, shopId);
    const res = await api.get(`${API}/inquiries/${created.body.data.id}`).set(auth(other.accessToken));
    expect(res.status).toBe(403);
  });

  it('prevents an unrelated seller from reading an inquiry', async () => {
    const { shopId } = await sellerWithApprovedShop();
    const customer = await registerUser('CUSTOMER');
    const otherSeller = await registerUser('SELLER');

    const created = await createInquiry(customer.accessToken, shopId);
    const res = await api.get(`${API}/inquiries/${created.body.data.id}`).set(auth(otherSeller.accessToken));
    expect(res.status).toBe(403);
  });

  it('lets the seller reply and notifies the customer', async () => {
    const { seller, shopId } = await sellerWithApprovedShop();
    const customer = await registerUser('CUSTOMER');
    const created = await createInquiry(customer.accessToken, shopId);
    const inquiryId = created.body.data.id;

    const reply = await api
      .post(`${API}/inquiries/${inquiryId}/messages`)
      .set(auth(seller.accessToken))
      .send({ message: 'Yes, in stock.' });
    expect(reply.status).toBe(201);
    expect(reply.body.data.messages).toHaveLength(2);

    const notifs = await api.get(`${API}/notifications`).set(auth(customer.accessToken));
    const replied = notifs.body.data.find((n: { type: string }) => n.type === 'INQUIRY_REPLIED');
    expect(replied).toBeTruthy();
  });

  it('lets the seller resolve but forbids the customer from resolving', async () => {
    const { seller, shopId } = await sellerWithApprovedShop();
    const customer = await registerUser('CUSTOMER');
    const created = await createInquiry(customer.accessToken, shopId);
    const inquiryId = created.body.data.id;

    const denied = await api.patch(`${API}/inquiries/${inquiryId}/resolve`).set(auth(customer.accessToken));
    expect(denied.status).toBe(403);

    const ok = await api.patch(`${API}/inquiries/${inquiryId}/resolve`).set(auth(seller.accessToken));
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('RESOLVED');
  });
});
