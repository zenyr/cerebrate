import { nanoid } from 'nanoid';
import { AUTH_CODE_PREFIX } from '@cerebrate/core/protocol';

export const generateAuthCode = (): string => {
  const id = nanoid(21); // 21 chars = ~149 bits entropy
  return `${AUTH_CODE_PREFIX}${id}`;
};

export const validateAuthCode = (code: string): boolean => {
  if (!code.startsWith(AUTH_CODE_PREFIX)) {
    return false;
  }
  
  const id = code.slice(AUTH_CODE_PREFIX.length);
  // nanoid uses URL-safe chars: A-Za-z0-9_-
  return /^[A-Za-z0-9_-]{21}$/.test(id);
};
