/**
 * Auth tests: registration, login, invalid credentials, refresh, logout, me.
 */
import { describe, it, expect } from 'vitest';
import { api, API, registerUser, auth } from './helpers';

describe('Auth', () => {
  it('registers a new user and returns an access token', async () => {
    const res = await api
      .post(`${API}/auth/register`)
      .send({ name: 'Ali', email: 'ali@test.local', password: 'Password123!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('ali@test.local');
    // The password hash must never be exposed.
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects registration with a duplicate email', async () => {
    await api.post(`${API}/auth/register`).send({ name: 'Alice', email: 'dup@test.local', password: 'Password123!' });
    const res = await api.post(`${API}/auth/register`).send({ name: 'Bob', email: 'dup@test.local', password: 'Password123!' });
    expect(res.status).toBe(409);
  });

  it('rejects registration without email or phone', async () => {
    const res = await api.post(`${API}/auth/register`).send({ name: 'NoContact', password: 'Password123!' });
    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials', async () => {
    await api.post(`${API}/auth/register`).send({ name: 'Login', email: 'login@test.local', password: 'Password123!' });
    const res = await api.post(`${API}/auth/login`).send({ email: 'login@test.local', password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects login with a wrong password', async () => {
    await api.post(`${API}/auth/register`).send({ name: 'Wrong', email: 'wrong@test.local', password: 'Password123!' });
    const res = await api.post(`${API}/auth/login`).send({ email: 'wrong@test.local', password: 'BadPassword!' });
    expect(res.status).toBe(401);
  });

  it('returns the current user from /auth/me with a valid token', async () => {
    const user = await registerUser('CUSTOMER');
    const res = await api.get(`${API}/auth/me`).set(auth(user.accessToken));
    expect(res.status).toBe(200);
    // /auth/me returns { user } to match the login/register envelope.
    expect(res.body.data.user.id).toBe(user.id);
  });

  it('rejects /auth/me without a token', async () => {
    const res = await api.get(`${API}/auth/me`);
    expect(res.status).toBe(401);
  });

  it('refreshes the access token using the refresh cookie', async () => {
    // Use a persistent agent so the HttpOnly cookie is stored and resent.
    const agent = (await import('supertest')).default.agent((await import('../src/app')).createApp());
    await agent.post(`${API}/auth/register`).send({ name: 'Refresh', email: 'refresh@test.local', password: 'Password123!' });
    const res = await agent.post(`${API}/auth/refresh`).send();
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('logs out and clears the session', async () => {
    const agent = (await import('supertest')).default.agent((await import('../src/app')).createApp());
    await agent.post(`${API}/auth/register`).send({ name: 'Out', email: 'out@test.local', password: 'Password123!' });
    const logout = await agent.post(`${API}/auth/logout`).send();
    expect(logout.status).toBe(200);
    // After logout the refresh token is revoked, so refresh must fail.
    const refresh = await agent.post(`${API}/auth/refresh`).send();
    expect(refresh.status).toBe(401);
  });
});
