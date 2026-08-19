import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { CUSTOMER_ROLE, jwtConfig } from './config.js';

export const generateToken = (customer) => {
  const { secret, issuer, audience, expiresIn } = jwtConfig();

  return jwt.sign(
    { cpf: customer.cpf, role: CUSTOMER_ROLE },
    secret,
    {
      algorithm: 'HS256',
      subject: String(customer.id),
      issuer,
      audience,
      expiresIn,
      jwtid: randomUUID(),
    }
  );
};
