import jwt from 'jsonwebtoken';
import { handler } from '../src/authorizer.js';

const SECRET = 'test-secret-with-at-least-32-characters!!';
const CUSTOMER_ID = 'a3f1c2d4-0000-4000-8000-000000000001';

const sign = (claims = {}, { secret = SECRET, ...options } = {}) =>
  jwt.sign({ customerId: CUSTOMER_ID, cpf: '52998224725', ...claims }, secret, {
    algorithm: 'HS256',
    expiresIn: 3600,
    ...options,
  });

const request = (token) => ({
  headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
});

describe('authorizer', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it('authorizes a token issued by the CPF login handler', async () => {
    const res = await handler(request(sign()));

    expect(res.isAuthorized).toBe(true);
    expect(res.context).toEqual({ customerId: CUSTOMER_ID, cpf: '52998224725' });
  });

  it('reads the header when API Gateway capitalizes it', async () => {
    const res = await handler({ headers: { Authorization: `Bearer ${sign()}` } });

    expect(res.isAuthorized).toBe(true);
  });

  it('denies a request without an Authorization header', async () => {
    expect(await handler(request())).toEqual({ isAuthorized: false });
  });

  it('denies a header that is not a Bearer scheme', async () => {
    const res = await handler({ headers: { authorization: `Basic ${sign()}` } });

    expect(res.isAuthorized).toBe(false);
  });

  it('denies a Bearer header with no token', async () => {
    const res = await handler({ headers: { authorization: 'Bearer' } });

    expect(res.isAuthorized).toBe(false);
  });

  it('denies a token signed with a different secret', async () => {
    const res = await handler(request(sign({}, { secret: 'another-secret-with-32-characters-min!!!' })));

    expect(res.isAuthorized).toBe(false);
  });

  it('denies an expired token', async () => {
    const res = await handler(request(sign({}, { expiresIn: -10 })));

    expect(res.isAuthorized).toBe(false);
  });

  it('denies a token signed with none', async () => {
    const res = await handler(request(jwt.sign({ customerId: CUSTOMER_ID }, '', { algorithm: 'none' })));

    expect(res.isAuthorized).toBe(false);
  });

  it('denies a garbage token', async () => {
    expect((await handler(request('not-a-jwt'))).isAuthorized).toBe(false);
  });

  it('fails loudly when the secret is not configured', async () => {
    const token = sign();
    delete process.env.JWT_SECRET;

    await expect(handler(request(token))).rejects.toThrow('JWT_SECRET is not configured');
  });
});
