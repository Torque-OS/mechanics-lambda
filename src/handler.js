import { validateCpf } from './cpf.js';
import { findCustomer } from './db.js';
import { generateToken } from './jwt.js';

export const handler = async (event) => {
  let body = event?.body;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return response(400, { error: 'Invalid JSON body' });
    }
  }

  const cpf = event?.cpf ?? body?.cpf;

  if (!cpf) {
    return response(400, { error: 'CPF is required' });
  }

  if (!validateCpf(cpf)) {
    return response(400, { error: 'Invalid CPF' });
  }

  const customer = await findCustomer(cpf);

  if (!customer) {
    return response(404, { error: 'Customer not found' });
  }

  if (!customer.active) {
    return response(403, { error: 'Customer is inactive' });
  }

  const token = generateToken(customer);

  return response(200, { token });
};

const response = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
