import { validateCpf } from './cpf.js';
import { findCustomer } from './db.js';
import { generateToken } from './jwt.js';

export const handler = async (event) => {
  const cpf = event?.cpf ?? event?.body?.cpf ?? JSON.parse(event?.body ?? '{}')?.cpf;

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

  const token = generateToken({ customerId: customer.id, cpf: customer.cpf });

  return response(200, { token });
};

const response = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
