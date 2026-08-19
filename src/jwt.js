import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
const EXPIRATION = parseInt(process.env.JWT_EXPIRATION ?? '3600', 10);

export const generateToken = (payload) => {
  if (!SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRATION });
};
