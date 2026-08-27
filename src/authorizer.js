import jwt from 'jsonwebtoken';
import { jwtConfig } from './config.js';

const DENIED = Object.freeze({ isAuthorized: false });

export const handler = async (event) => {
  const token = bearerToken(event);

  if (!token) return DENIED;

  const { secret, issuer, audience } = jwtConfig();

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer,
      audience,
    });

    return {
      isAuthorized: true,
      context: {
        sub: payload.sub ?? '',
        role: payload.role ?? '',
        cpf: payload.cpf ?? '',
      },
    };
  } catch {
    return DENIED;
  }
};

const bearerToken = (event) => {
  const header = event?.headers?.authorization ?? event?.headers?.Authorization;

  if (!header) return null;

  const [scheme, value] = header.split(' ');

  return scheme?.toLowerCase() === 'bearer' && value ? value : null;
};
