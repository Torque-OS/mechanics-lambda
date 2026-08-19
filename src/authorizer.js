import jwt from 'jsonwebtoken';

const DENIED = Object.freeze({ isAuthorized: false });

export const handler = async (event) => {
  const token = bearerToken(event);

  if (!token) return DENIED;

  const secret = process.env.JWT_SECRET;

  if (!secret) throw new Error('JWT_SECRET is not configured');

  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });

    return {
      isAuthorized: true,
      context: {
        customerId: payload.customerId ?? '',
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
