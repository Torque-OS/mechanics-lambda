import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/db.js', () => ({
  findCustomer: jest.fn(),
}));

jest.unstable_mockModule('../src/jwt.js', () => ({
  generateToken: jest.fn(() => 'mocked-token'),
}));

const { handler } = await import('../src/handler.js');
const { findCustomer } = await import('../src/db.js');
const { generateToken } = await import('../src/jwt.js');

describe('handler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when CPF is missing', async () => {
    const res = await handler({});
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('CPF is required');
  });

  it('returns 400 when CPF is invalid', async () => {
    const res = await handler({ cpf: '000.000.000-00' });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('Invalid CPF');
  });

  it('returns 404 when customer is not found', async () => {
    findCustomer.mockResolvedValue(null);
    const res = await handler({ cpf: '529.982.247-25' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when customer is inactive', async () => {
    findCustomer.mockResolvedValue({ id: '1', cpf: '52998224725', active: false });
    const res = await handler({ cpf: '529.982.247-25' });
    expect(res.statusCode).toBe(403);
  });

  it('returns 200 with token when CPF is valid and customer is active', async () => {
    const customer = { id: '1', cpf: '52998224725', active: true };
    findCustomer.mockResolvedValue(customer);
    const res = await handler({ cpf: '529.982.247-25' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).token).toBe('mocked-token');
    expect(generateToken).toHaveBeenCalledWith(customer);
  });
});
