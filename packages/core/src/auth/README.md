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
  generateEncryptionKey 
} from '@cerebrate/core/auth';

// Generate encryption key (do this once, store in env)
const key = generateEncryptionKey();
console.log('Add this to your .env:', key);

// Create auth store
const store = new AuthStore('./cerebrate.db');

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
