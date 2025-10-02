import { AUTH_CODE_PREFIX } from '@cerebrate/core/protocol';

export const generateAuthCode = (): string => {
  const randomId = Math.random().toString(36).substring(2, 15);
  return `${AUTH_CODE_PREFIX}${randomId}`;
};

export const validateAuthCode = (code: string): boolean => {
  return code.startsWith(AUTH_CODE_PREFIX) && code.length > AUTH_CODE_PREFIX.length;
};
