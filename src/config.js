const DEFAULT_ISSUER = 'torque-os';
const DEFAULT_AUDIENCE = 'mechanics-software-api';
const DEFAULT_EXPIRATION_SECONDS = 3600;

export const CUSTOMER_ROLE = 'CUSTOMER';

export const jwtConfig = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) throw new Error('JWT_SECRET is not configured');

  const expiresIn = Number.parseInt(process.env.JWT_EXPIRATION ?? '', 10);

  return {
    secret,
    issuer: process.env.JWT_ISSUER || DEFAULT_ISSUER,
    audience: process.env.JWT_AUDIENCE || DEFAULT_AUDIENCE,
    expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : DEFAULT_EXPIRATION_SECONDS,
  };
};
