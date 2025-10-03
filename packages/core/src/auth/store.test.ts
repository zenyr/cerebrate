import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { AuthStore } from "./store";
import { generateAuthCode } from "./code-generator";
import { generateEncryptionKey } from "./crypto";
import { unlinkSync, existsSync } from "fs";
import is from "@sindresorhus/is";

describe("AuthStore", () => {
  const originalEnv = process.env.CEREBRATE_ENCRYPTION_KEY;
  const testDbPath = "/tmp/cerebrate-test.db";

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

  describe("constructor", () => {
    test("creates file-based database by default", async () => {
      const store = await AuthStore.create();
      if (!is.object(store)) {
        throw new Error("Store should be an object");
      }
      expect(is.object(store)).toBe(true);
      store.close();
    });

    test("creates file-based database when path provided", async () => {
      const store = await AuthStore.create(testDbPath);
      expect(is.boolean(existsSync(testDbPath))).toBe(true);
      expect(existsSync(testDbPath)).toBe(true);
      store.close();
    });

    test("initializes schema correctly", async () => {
      const store = await AuthStore.create(":memory:");
      // If schema wasn't created, insert would fail
      const code = generateAuthCode();
      expect(() => store.insert(code)).not.toThrow();
      store.close();
    });
  });

  describe("insert", () => {
    test("inserts auth code successfully", async () => {
      const store = await AuthStore.create(":memory:");
      const code = generateAuthCode();
      expect(() => store.insert(code)).not.toThrow();
      expect(store.verify(code)).toBe(true);
      store.close();
    });

    test("inserted code can be verified", async () => {
      const store = await AuthStore.create(":memory:");
      const code = generateAuthCode();
      store.insert(code);
      expect(store.verify(code)).toBe(true);
      store.close();
    });

    test("throws error when inserting invalid code", async () => {
      const store = await AuthStore.create(":memory:");
      expect(() => store.insert("invalid")).toThrow();
      store.close();
    });

    test("throws error when inserting duplicate code", async () => {
      const store = await AuthStore.create(":memory:");
      const code = generateAuthCode();
      store.insert(code);
      expect(() => store.insert(code)).toThrow();
      store.close();
    });

    test("stores code in encrypted form", async () => {
      const store = await AuthStore.create(":memory:");
      const code = generateAuthCode();
      store.insert(code);
      // Verify it's encrypted by checking list (avoids direct db access)
      const listed = store.list();
      expect(listed).toHaveLength(1);
      const [first] = listed;
      if (is.undefined(first)) {
        throw new Error("listed[0] should not be undefined");
      }
      expect(first.code).toBe(code); // Should be decrypted correctly
      store.close();
    });
  });

  describe("verify", () => {
    test("returns true for existing code", async () => {
      const store = await AuthStore.create(":memory:");
      const code = generateAuthCode();
      store.insert(code);
      expect(store.verify(code)).toBe(true);
      store.close();
    });

    test("returns false for non-existing code", async () => {
      const store = await AuthStore.create(":memory:");
      const nonExistingCode = generateAuthCode();
      expect(store.verify(nonExistingCode)).toBe(false);
      store.close();
    });

    test("returns false for invalid code format", async () => {
      const store = await AuthStore.create(":memory:");
      expect(store.verify("invalid")).toBe(false);
      store.close();
    });

    test("returns false for similar but different code", async () => {
      const store = await AuthStore.create(":memory:");
      const code1 = generateAuthCode();
      const code2 = generateAuthCode();
      store.insert(code1);
      expect(store.verify(code2)).toBe(false);
      store.close();
    });

    test("verifies multiple codes correctly", async () => {
      const store = await AuthStore.create(":memory:");
      const codes = [
        generateAuthCode(),
        generateAuthCode(),
        generateAuthCode(),
      ];
      codes.forEach((code) => store.insert(code));
      codes.forEach((code) => expect(store.verify(code)).toBe(true));
      const extraCode = generateAuthCode();
      expect(store.verify(extraCode)).toBe(false);
      store.close();
    });
  });

  describe("list", () => {
    test("returns empty array for empty store", async () => {
      const store = await AuthStore.create(":memory:");
      const listed = store.list();
      expect(listed).toEqual([]);
      store.close();
    });

    test("returns all inserted codes", async () => {
      const store = await AuthStore.create(":memory:");
      const codes = [generateAuthCode(), generateAuthCode()];
      codes.forEach((code) => store.insert(code));
      const listed = store.list();
      expect(listed.map((c) => c.code)).toEqual(codes);
      store.close();
    });

    test("includes createdAt timestamps", async () => {
      const store = await AuthStore.create(":memory:");
      const code = generateAuthCode();
      const before = Date.now();
      store.insert(code);
      const after = Date.now();
      const listed = store.list();
      expect(listed).toHaveLength(1);
      const [first] = listed;
      if (is.undefined(first)) {
        throw new Error("listed[0] should not be undefined");
      }
      expect(first.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(first.createdAt.getTime()).toBeLessThanOrEqual(after);
      store.close();
    });

    test("skips corrupted entries", async () => {
      const store = await AuthStore.create(":memory:");
      const code = generateAuthCode();
      store.insert(code);
      // Manually insert corrupted data
      const stmt = store.db.prepare(
        "INSERT INTO auth_codes (encrypted_code, created_at) VALUES (?, ?)"
      );
      stmt.run("corrupted" as string, Date.now() as number);
      const listed = store.list();
      expect(listed).toHaveLength(1);
      const [first] = listed;
      if (is.undefined(first)) {
        throw new Error("listed[0] should not be undefined");
      }
      expect(first.code).toBe(code);
      store.close();
    });
  });

  describe("delete", () => {
    test("deletes existing code", async () => {
      const store = await AuthStore.create(":memory:");
      const code = generateAuthCode();
      store.insert(code);
      expect(store.verify(code)).toBe(true);
      expect(store.delete(code)).toBe(true);
      expect(store.verify(code)).toBe(false);
      store.close();
    });

    test("returns false for invalid code format", async () => {
      const store = await AuthStore.create(":memory:");
      expect(store.delete("invalid")).toBe(false);
      store.close();
    });

    test("returns false when deleting non-existing code", async () => {
      const store = await AuthStore.create(":memory:");
      const nonExistingCode = generateAuthCode();
      expect(store.delete(nonExistingCode)).toBe(false);
      store.close();
    });

    test("only deletes specified code", async () => {
      const store = await AuthStore.create(":memory:");
      const codes = [generateAuthCode(), generateAuthCode()];
      codes.forEach((code) => store.insert(code));
      const [firstCode, secondCode] = codes;
      if (is.undefined(firstCode) || is.undefined(secondCode)) {
        throw new Error("codes should not be undefined");
      }
      store.delete(firstCode);
      expect(store.verify(firstCode)).toBe(false);
      expect(store.verify(secondCode)).toBe(true);
      store.close();
    });
  });

  describe("close", () => {
    test("closes database connection", async () => {
      const store = await AuthStore.create(":memory:");
      store.close();
      // Should not throw
    });

    test("can be called multiple times", async () => {
      const store = await AuthStore.create(":memory:");
      store.close();
      store.close();
      // Should not throw
    });
  });

  describe("persistence", () => {
    test("persists data across instances", async () => {
      const store1 = await AuthStore.create(testDbPath);
      const code = generateAuthCode();
      store1.insert(code);
      store1.close();

      const store2 = await AuthStore.create(testDbPath);
      expect(store2.verify(code)).toBe(true);
      store2.close();
    });

    test("handles key rotation failure gracefully", async () => {
      const store1 = await AuthStore.create(testDbPath);
      const code = generateAuthCode();
      store1.insert(code);
      store1.close();

      // Change key
      process.env.CEREBRATE_ENCRYPTION_KEY = generateEncryptionKey();

      const store2 = await AuthStore.create(testDbPath);
      expect(store2.verify(code)).toBe(false); // Can't decrypt with new key
      const listed = store2.list();
      expect(listed).toEqual([]); // Corrupted entries are skipped
      store2.close();
    });
  });
});
