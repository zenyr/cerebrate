import { Database } from 'bun:sqlite';
import { encrypt, decrypt } from './crypto';
import { validateAuthCode } from './code-generator';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export type AuthCode = {
  code: string;
  createdAt: Date;
};

export class AuthStore {
  public db: Database;

  private constructor(db: Database) {
    this.db = db;
  }

  static async create(dbPath?: string): Promise<AuthStore> {
    const defaultPath = dbPath ?? join(Bun.env.HOME ?? '~', '.config', 'cerebrate', 'db.sqlite');
    await AuthStore.ensureDirectory(defaultPath);
    const db = new Database(defaultPath);
    const store = new AuthStore(db);
    store.initializeSchema();
    return store;
  }

  private static async ensureDirectory(dbPath: string): Promise<void> {
    const dir = join(dbPath, '..');
    try {
      await mkdir(dir, { recursive: true });
    } catch {
      // Directory might already exist, ignore
    }
  }

  private initializeSchema = () => {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS auth_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        encrypted_code TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      )
    `);
  };

  insert = (code: string): void => {
    if (!validateAuthCode(code)) {
      throw new Error(`Invalid auth code format: ${code}`);
    }
    
    // Check for duplicate before inserting
    if (this.verify(code)) {
      throw new Error(`Auth code already exists: ${code}`);
    }
    
    const encryptedCode = encrypt(code);
    const createdAt = Date.now();
    
    const stmt = this.db.prepare(
      'INSERT INTO auth_codes (encrypted_code, created_at) VALUES (?, ?)'
    );
    
    stmt.run(encryptedCode, createdAt);
  };

  verify = (code: string): boolean => {
    if (!validateAuthCode(code)) {
      return false;
    }
    
    const stmt = this.db.prepare('SELECT encrypted_code FROM auth_codes');
    const rows = stmt.all() as Array<{ encrypted_code: string }>;
    
    for (const row of rows) {
      try {
        const decryptedCode = decrypt(row.encrypted_code);
        if (decryptedCode === code) {
          return true;
        }
      } catch {
        // Decryption failed, skip this row
        continue;
      }
    }
    
    return false;
  };

  list = (): AuthCode[] => {
    const stmt = this.db.prepare('SELECT encrypted_code, created_at FROM auth_codes');
    const rows = stmt.all() as Array<{ encrypted_code: string; created_at: number }>;
    
    return rows
      .map((row) => {
        try {
          return {
            code: decrypt(row.encrypted_code),
            createdAt: new Date(row.created_at),
          };
        } catch {
          // Decryption failed, skip this row
          return null;
        }
      })
      .filter((item): item is AuthCode => item !== null);
  };

  delete = (code: string): boolean => {
    if (!validateAuthCode(code)) {
      return false;
    }
    
    const stmt = this.db.prepare('SELECT id, encrypted_code FROM auth_codes');
    const rows = stmt.all() as Array<{ id: number; encrypted_code: string }>;
    
    for (const row of rows) {
      try {
        const decryptedCode = decrypt(row.encrypted_code);
        if (decryptedCode === code) {
          const deleteStmt = this.db.prepare('DELETE FROM auth_codes WHERE id = ?');
          deleteStmt.run(row.id);
          return true;
        }
      } catch {
        continue;
      }
    }
    
    return false;
  };

  close = () => {
    this.db.close();
  };
}
