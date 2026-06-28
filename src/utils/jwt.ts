import jwt, { type SignOptions } from 'jsonwebtoken';
import config from '../config';

export interface JwtPayload {
  sub: string;
  email: string;
}

export function sign(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwt.secret, options);
}

export function verify(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}
