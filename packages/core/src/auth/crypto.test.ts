import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { encrypt, decrypt, generateEncryptionKey } from './crypto';

describe('crypto', () => {
  const originalEnv = process.env.CEREBRATE_ENCRYPTION_KEY;

  beforeEach(() => {
    // Generate a valid 32-byte key for tests
    process.env.CEREBRATE_ENCRYPTION_KEY = generateEncryptionKey();
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv) {
      process.env.CEREBRATE_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.CEREBRATE_ENCRYPTION_KEY;
    }
  });

  describe('generateEncryptionKey', () => {
    test('generates 64 hex characters (32 bytes)', () => {
      const key = generateEncryptionKey();
      expect(key.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
    });

    test('generates unique keys', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 10; i++) {
        keys.add(generateEncryptionKey());
      }
      expect(keys.size).toBe(10);
    });
  });

  describe('encrypt', () => {
    test('encrypts plaintext to base64 string', () => {
      const plaintext = 'ck-test123456789012345';
      const ciphertext = encrypt(plaintext);
      
      expect(typeof ciphertext).toBe('string');
      expect(ciphertext).not.toBe(plaintext);
      expect(/^[A-Za-z0-9+/]+=*$/.test(ciphertext)).toBe(true);
    });

    test('produces different ciphertext for same plaintext', () => {
      const plaintext = 'ck-test123456789012345';
      const ciphertext1 = encrypt(plaintext);
      const ciphertext2 = encrypt(plaintext);
      
      expect(ciphertext1).not.toBe(ciphertext2);
    });

    test('throws error when encryption key is missing', () => {
      delete process.env.CEREBRATE_ENCRYPTION_KEY;
      
      expect(() => encrypt('test')).toThrow('CEREBRATE_ENCRYPTION_KEY environment variable is required');
    });

    test('throws error when encryption key is invalid length', () => {
      process.env.CEREBRATE_ENCRYPTION_KEY = 'short';
      
      expect(() => encrypt('test')).toThrow('Encryption key must be 32 bytes');
    });
  });

  describe('decrypt', () => {
    test('decrypts ciphertext back to original plaintext', () => {
      const plaintext = 'ck-test123456789012345';
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);
      
      expect(decrypted).toBe(plaintext);
    });

    test('handles unicode characters', () => {
      const plaintext = '한글테스트-ck-123456789';
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);
      
      expect(decrypted).toBe(plaintext);
    });

    test('throws error for invalid ciphertext format', () => {
      expect(() => decrypt('invalid')).toThrow();
    });

    test('throws error for tampered ciphertext', () => {
      const plaintext = 'ck-test123456789012345';
      const ciphertext = encrypt(plaintext);
      const tampered = ciphertext.slice(0, -5) + 'XXXXX';
      
      expect(() => decrypt(tampered)).toThrow();
    });

    test('throws error when decrypting with different key', () => {
      const plaintext = 'ck-test123456789012345';
      const ciphertext = encrypt(plaintext);
      
      // Change the key
      process.env.CEREBRATE_ENCRYPTION_KEY = generateEncryptionKey();
      
      expect(() => decrypt(ciphertext)).toThrow();
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    test('handles empty string', () => {
      const plaintext = '';
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);
      
      expect(decrypted).toBe(plaintext);
    });

    test('handles long strings', () => {
      const plaintext = 'ck-' + 'a'.repeat(1000);
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);
      
      expect(decrypted).toBe(plaintext);
    });

    test('handles special characters', () => {
      const plaintext = 'ck-!@#$%^&*()_+-=[]{}|;:,.<>?';
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);
      
      expect(decrypted).toBe(plaintext);
    });
  });
});
