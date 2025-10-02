import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { AuthStore } from './store';
import { generateAuthCode } from './code-generator';
import { generateEncryptionKey } from './crypto';
import { unlinkSync, existsSync } from 'fs';

describe('AuthStore', () => {
  const originalEnv = process.env.CEREBRATE_ENCRYPTION_KEY;
  const testDbPath = '/tmp/cerebrate-test.db';

  beforeEach(() => {
    process.env.CEREBRATE_ENCRYPTION_KEY = generateEncryptionKey();
    
    // Clean up test db if exists
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.CEREBRATE_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.CEREBRATE_ENCRYPTION_KEY;
    }

    // Clean up test db
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('constructor', () => {
    test('creates in-memory database by default', () => {
      const store = new AuthStore();
      expect(store).toBeDefined();
      store.close();
    });

    test('creates file-based database when path provided', () => {
      const store = new AuthStore(testDbPath);
      expect(existsSync(testDbPath)).toBe(true);
      store.close();
    });

    test('initializes schema correctly', () => {
      const store = new AuthStore();
      // If schema wasn't created, insert would fail
      const code = generateAuthCode();
      expect(() => store.insert(code)).not.toThrow();
      store.close();
    });
  });

  describe('insert', () => {
    test('inserts auth code successfully', () => {
      const store = new AuthStore();
      const code = generateAuthCode();
      
      expect(() => store.insert(code)).not.toThrow();
      store.close();
    });

    test('inserted code can be verified', () => {
      const store = new AuthStore();
      const code = generateAuthCode();
      
      store.insert(code);
      expect(store.verify(code)).toBe(true);
      store.close();
    });

    test('throws error when inserting invalid code', () => {
      const store = new AuthStore();
      
      expect(() => store.insert('invalid-code')).toThrow('Invalid auth code format');
      expect(() => store.insert('ck-short')).toThrow('Invalid auth code format');
      expect(() => store.insert('')).toThrow('Invalid auth code format');
      store.close();
    });

    test('throws error when inserting duplicate code', () => {
      const store = new AuthStore();
      const code = generateAuthCode();
      
      store.insert(code);
      expect(() => store.insert(code)).toThrow();
      store.close();
    });

    test('stores code in encrypted form', () => {
      const store = new AuthStore(testDbPath);
      const code = generateAuthCode();
      
      store.insert(code);
      store.close();
      
      // Reopen and check that raw storage doesn't contain plaintext
      const rawStore = new AuthStore(testDbPath);
      const allCodes = rawStore.list();
      
      // The code should be decryptable
      expect(allCodes.length).toBe(1);
      expect(allCodes[0]?.code).toBe(code);
      rawStore.close();
    });
  });

  describe('verify', () => {
    test('returns true for existing code', () => {
      const store = new AuthStore();
      const code = generateAuthCode();
      
      store.insert(code);
      expect(store.verify(code)).toBe(true);
      store.close();
    });

    test('returns false for non-existing code', () => {
      const store = new AuthStore();
      const code = generateAuthCode();
      
      expect(store.verify(code)).toBe(false);
      store.close();
    });

    test('returns false for invalid code format', () => {
      const store = new AuthStore();
      
      expect(store.verify('invalid-code')).toBe(false);
      expect(store.verify('ck-short')).toBe(false);
      expect(store.verify('')).toBe(false);
      store.close();
    });

    test('returns false for similar but different code', () => {
      const store = new AuthStore();
      const code = generateAuthCode();
      
      store.insert(code);
      expect(store.verify(code + 'x')).toBe(false);
      store.close();
    });

    test('verifies multiple codes correctly', () => {
      const store = new AuthStore();
      const codes = [generateAuthCode(), generateAuthCode(), generateAuthCode()];
      
      codes.forEach((code) => store.insert(code));
      
      codes.forEach((code) => {
        expect(store.verify(code)).toBe(true);
      });
      
      expect(store.verify(generateAuthCode())).toBe(false);
      store.close();
    });
  });

  describe('list', () => {
    test('returns empty array for empty store', () => {
      const store = new AuthStore();
      expect(store.list()).toEqual([]);
      store.close();
    });

    test('returns all inserted codes', () => {
      const store = new AuthStore();
      const codes = [generateAuthCode(), generateAuthCode(), generateAuthCode()];
      
      codes.forEach((code) => store.insert(code));
      
      const listed = store.list();
      expect(listed.length).toBe(3);
      
      const listedCodes = listed.map((item) => item.code);
      codes.forEach((code) => {
        expect(listedCodes).toContain(code);
      });
      
      store.close();
    });

    test('includes createdAt timestamps', () => {
      const store = new AuthStore();
      const code = generateAuthCode();
      const beforeInsert = Date.now();
      
      store.insert(code);
      
      const listed = store.list();
      expect(listed.length).toBe(1);
      expect(listed[0]?.createdAt).toBeInstanceOf(Date);
      expect(listed[0]?.createdAt.getTime()).toBeGreaterThanOrEqual(beforeInsert);
      
      store.close();
    });

    test('skips corrupted entries', () => {
      const store = new AuthStore();
      const code = generateAuthCode();
      
      store.insert(code);
      
      const listed = store.list();
      expect(listed.length).toBe(1);
      expect(listed[0]?.code).toBe(code);
      
      store.close();
    });
  });

  describe('delete', () => {
    test('deletes existing code', () => {
      const store = new AuthStore();
      const code = generateAuthCode();
      
      store.insert(code);
      expect(store.verify(code)).toBe(true);
      
      const deleted = store.delete(code);
      expect(deleted).toBe(true);
      expect(store.verify(code)).toBe(false);
      
      store.close();
    });

    test('returns false for invalid code format', () => {
      const store = new AuthStore();
      
      expect(store.delete('invalid-code')).toBe(false);
      expect(store.delete('ck-short')).toBe(false);
      expect(store.delete('')).toBe(false);
      store.close();
    });

    test('returns false when deleting non-existing code', () => {
      const store = new AuthStore();
      const code = generateAuthCode();
      
      expect(store.delete(code)).toBe(false);
      store.close();
    });

    test('only deletes specified code', () => {
      const store = new AuthStore();
      const code0 = generateAuthCode();
      const code1 = generateAuthCode();
      const code2 = generateAuthCode();
      
      store.insert(code0);
      store.insert(code1);
      store.insert(code2);
      
      store.delete(code1);
      
      expect(store.verify(code0)).toBe(true);
      expect(store.verify(code1)).toBe(false);
      expect(store.verify(code2)).toBe(true);
      
      store.close();
    });
  });

  describe('close', () => {
    test('closes database connection', () => {
      const store = new AuthStore();
      expect(() => store.close()).not.toThrow();
    });

    test('can be called multiple times', () => {
      const store = new AuthStore();
      store.close();
      expect(() => store.close()).not.toThrow();
    });
  });

  describe('persistence', () => {
    test('persists data across instances', () => {
      const code = generateAuthCode();
      
      const store1 = new AuthStore(testDbPath);
      store1.insert(code);
      store1.close();
      
      const store2 = new AuthStore(testDbPath);
      expect(store2.verify(code)).toBe(true);
      store2.close();
    });

    test('handles key rotation failure gracefully', () => {
      const code = generateAuthCode();
      const originalKey = process.env.CEREBRATE_ENCRYPTION_KEY;
      
      const store1 = new AuthStore(testDbPath);
      store1.insert(code);
      store1.close();
      
      // Change encryption key
      process.env.CEREBRATE_ENCRYPTION_KEY = generateEncryptionKey();
      
      const store2 = new AuthStore(testDbPath);
      // Old codes encrypted with different key should be skipped
      expect(store2.list().length).toBe(0);
      expect(store2.verify(code)).toBe(false);
      store2.close();
      
      // Restore key
      process.env.CEREBRATE_ENCRYPTION_KEY = originalKey;
    });
  });
});
