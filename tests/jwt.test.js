import jwt from 'jsonwebtoken';
import { generateToken } from '../src/jwt.js';

const SECRET = 'test-secret-with-at-least-32-characters!!';
const CUSTOMER = { id: 'a3f1c2d4-0000-4000-8000-000000000001', cpf: '52998224725', active: true };

describe('generateToken', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
    delete process.env.JWT_EXPIRATION;
  });

  it('emits the claim set mechanics-software validates', () => {
    const decoded = jwt.verify(generateToken(CUSTOMER), SECRET);

    expect(decoded.sub).toBe(CUSTOMER.id);
    expect(decoded.cpf).toBe(CUSTOMER.cpf);
    expect(decoded.role).toBe('CUSTOMER');
    expect(decoded.iss).toBe('torque-os');
    expect(decoded.aud).toBe('mechanics-software-api');
    expect(decoded.jti).toEqual(expect.any(String));
  });

  it('signs with HS256', () => {
    const { header } = jwt.decode(generateToken(CUSTOMER), { complete: true });

    expect(header.alg).toBe('HS256');
  });

  it('defaults to a one hour lifetime', () => {
    const decoded = jwt.verify(generateToken(CUSTOMER), SECRET);

    expect(decoded.exp - decoded.iat).toBe(3600);
  });

  it('honours JWT_EXPIRATION in seconds', () => {
    process.env.JWT_EXPIRATION = '900';

    const decoded = jwt.verify(generateToken(CUSTOMER), SECRET);

    expect(decoded.exp - decoded.iat).toBe(900);
  });

  it('falls back to the default lifetime when JWT_EXPIRATION is not a number', () => {
    process.env.JWT_EXPIRATION = 'not-a-number';

    const decoded = jwt.verify(generateToken(CUSTOMER), SECRET);

    expect(decoded.exp - decoded.iat).toBe(3600);
  });

  it('honours issuer and audience overrides', () => {
    process.env.JWT_ISSUER = 'custom-issuer';
    process.env.JWT_AUDIENCE = 'custom-audience';

    const decoded = jwt.verify(generateToken(CUSTOMER), SECRET, {
      issuer: 'custom-issuer',
      audience: 'custom-audience',
    });

    expect(decoded.iss).toBe('custom-issuer');
    expect(decoded.aud).toBe('custom-audience');
  });

  it('throws when the secret is not configured', () => {
    delete process.env.JWT_SECRET;

    expect(() => generateToken(CUSTOMER)).toThrow('JWT_SECRET is not configured');
  });

  it('coerces a numeric customer id into a string subject', () => {
    const decoded = jwt.verify(generateToken({ ...CUSTOMER, id: 42 }), SECRET);

    expect(decoded.sub).toBe('42');
  });
});
