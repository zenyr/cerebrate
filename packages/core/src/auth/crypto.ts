import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export type EncryptionKey = Buffer;

const getEncryptionKey = (): EncryptionKey => {
  const keyHex = process.env.CEREBRATE_ENCRYPTION_KEY;
  
  if (!keyHex) {
    throw new Error('CEREBRATE_ENCRYPTION_KEY environment variable is required');
  }
  
  const key = Buffer.from(keyHex, 'hex');
  
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars)`);
  }
  
  return key;
};

export const generateEncryptionKey = (): string => {
  return randomBytes(KEY_LENGTH).toString('hex');
};

export const encrypt = (plaintext: string): string => {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv(12) + authTag(16) + encrypted
  const result = Buffer.concat([iv, authTag, encrypted]);
  return result.toString('base64');
};

export const decrypt = (ciphertext: string): string => {
  const key = getEncryptionKey();
  const data = Buffer.from(ciphertext, 'base64');
  
  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid ciphertext: too short');
  }
  
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  
  return decrypted.toString('utf8');
};
