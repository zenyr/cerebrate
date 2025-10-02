import { describe, test, expect } from 'bun:test';
import { generateAuthCode, validateAuthCode } from './code-generator';
import { AUTH_CODE_PREFIX } from '@cerebrate/core/protocol';

describe('generateAuthCode', () => {
  test('generates code with correct prefix', () => {
    const code = generateAuthCode();
    expect(code.startsWith(AUTH_CODE_PREFIX)).toBe(true);
  });

  test('generates code with 21 character nanoid', () => {
    const code = generateAuthCode();
    const id = code.slice(AUTH_CODE_PREFIX.length);
    expect(id.length).toBe(21);
  });

  test('generates unique codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateAuthCode());
    }
    expect(codes.size).toBe(100);
  });

  test('uses URL-safe characters', () => {
    const code = generateAuthCode();
    const id = code.slice(AUTH_CODE_PREFIX.length);
    expect(/^[A-Za-z0-9_-]+$/.test(id)).toBe(true);
  });
});

describe('validateAuthCode', () => {
  test('validates correct format', () => {
    const code = generateAuthCode();
    expect(validateAuthCode(code)).toBe(true);
  });

  test('rejects code without prefix', () => {
    expect(validateAuthCode('abc123def456ghi789jkl')).toBe(false);
  });

  test('rejects code with wrong prefix', () => {
    expect(validateAuthCode('wrong-abc123def456ghi789jkl')).toBe(false);
  });

  test('rejects code with incorrect length', () => {
    expect(validateAuthCode(`${AUTH_CODE_PREFIX}short`)).toBe(false);
  });

  test('rejects code with invalid characters', () => {
    expect(validateAuthCode(`${AUTH_CODE_PREFIX}abc123def456!@#$%^&*()`)).toBe(false);
  });

  test('rejects empty string', () => {
    expect(validateAuthCode('')).toBe(false);
  });

  test('rejects code with only prefix', () => {
    expect(validateAuthCode(AUTH_CODE_PREFIX)).toBe(false);
  });
});
