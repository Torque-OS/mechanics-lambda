import jwt from 'jsonwebtoken';
import { handler } from '../src/authorizer.js';

const SECRET = 'test-secret-with-at-least-32-characters!!';
const ISSUER = 'torque-os';
const AUDIENCE = 'mechanics-software-api';

const sign = (claims = {}, { secret = SECRET, ...options } = {}) =>
  jwt.sign({ cpf: '52998224725', role: 'CUSTOMER', ...claims }, secret, {
    algorithm: 'HS256',
    subject: 'a3f1c2d4-0000-4000-8000-000000000001',
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: 3600,
    ...options,
  });

const request = (token) => ({
  headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
});

describe('authorizer', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
  });

  it('authorizes a token issued by the CPF login handler', async () => {
    const res = await handler(request(sign()));

    expect(res.isAuthorized).toBe(true);
    expect(res.context).toEqual({
      sub: 'a3f1c2d4-0000-4000-8000-000000000001',
      role: 'CUSTOMER',
      cpf: '52998224725',
    });
  });

  it('authorizes a staff token minted by mechanics-software', async () => {
    const res = await handler(request(sign({ role: 'ADMIN', cpf: undefined })));

    expect(res.isAuthorized).toBe(true);
    expect(res.context.role).toBe('ADMIN');
  });

  it('reads the header when API Gateway capitalizes it', async () => {
    const res = await handler({ headers: { Authorization: `Bearer ${sign()}` } });

    expect(res.isAuthorized).toBe(true);
  });

  it('denies a request without an Authorization header', async () => {
    const res = await handler(request());

    expect(res).toEqual({ isAuthorized: false });
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

  it('denies a token from an unknown issuer', async () => {
    const res = await handler(request(sign({}, { issuer: 'someone-else' })));

    expect(res.isAuthorized).toBe(false);
  });

  it('denies a token minted for a different audience', async () => {
    const res = await handler(request(sign({}, { audience: 'another-api' })));

    expect(res.isAuthorized).toBe(false);
  });

  it('denies a garbage token', async () => {
    const res = await handler(request('not-a-jwt'));

    expect(res.isAuthorized).toBe(false);
  });

  it('fails loudly when the secret is not configured', async () => {
    const token = sign();
    delete process.env.JWT_SECRET;

    await expect(handler(request(token))).rejects.toThrow('JWT_SECRET is not configured');
  });
});
