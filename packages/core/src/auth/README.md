# Auth System Usage Example

## Environment Setup

```bash
# Generate a new encryption key (32 bytes = 64 hex chars)
export CEREBRATE_ENCRYPTION_KEY=$(bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

## Code Example

```typescript
import { 
  generateAuthCode, 
  validateAuthCode, 
  AuthStore,

// Create a new store with default file-based database at $HOME/.config/cerebrate/db.sqlite
const store = await AuthStore.create();

// Or specify a custom file path for persistent storage
const store = await AuthStore.create('./cerebrate.db');

// Or use in-memory database for testing
const store = await AuthStore.create(':memory:');

// Generate and store new auth code
const code = generateAuthCode();
console.log('Generated auth code:', code); // ck-xY3z...

store.insert(code);

// Verify auth code
if (store.verify(code)) {
  console.log('✓ Auth code is valid');
}

// List all codes
const allCodes = store.list();
console.log('All codes:', allCodes);

// Delete code
store.delete(code);

// Close database
store.close();
```

## Validation

```typescript
import { validateAuthCode } from '@cerebrate/core/auth';

validateAuthCode('ck-abc123def456ghi789jkl'); // true
validateAuthCode('invalid'); // false
validateAuthCode('ck-short'); // false (must be 21 chars)
```

## Security Features

- **Format**: `ck-{21 URL-safe chars}` using nanoid
- **Encryption**: AES-256-GCM with authenticated encryption
- **Storage**: Encrypted SQLite database
- **Key Management**: Environment variable `CEREBRATE_ENCRYPTION_KEY`
- **Validation**: Strict format checking on insert/verify/delete

## Testing

```bash
# Run auth tests
bun test src/auth/

# With coverage
bun test --coverage
```
