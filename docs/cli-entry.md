# CLI Entry Package Architecture

## Overview

Cerebrate's CLI entry point uses a **Bun-first with Compiled Fallback** strategy. If the user has Bun, it runs with native performance; otherwise, it automatically falls back to a compiled binary.

## Directory Structure

```
cerebrate/
├── clis/
│   ├── entry/                           # cerebrate (main package, public)
│   │   ├── package.json
│   │   │   └── name: "cerebrate"
│   │   │   └── devDependencies: { "@cerebrate/cli": "workspace:*" }
│   │   ├── src/
│   │   │   ├── index.ts                 # Wrapper logic (Bun detection + execution path selection)
│   │   │   └── native.ts                # Entry for direct Bun execution
│   │   └── dist/
│   │       ├── index.js                 # bin: cerebrate → Executed in Node.js
│   │       └── native.js                # @cerebrate/cli bundle (executed in Bun)
│   │
│   ├── darwin-arm64/                    # @cerebrate/cli-darwin-arm64 (public)
│   │   ├── package.json
│   │   └── bin/
│   │       └── cerebrate                # Compiled binary (60MB)
│   │
│   ├── darwin-x64/                      # @cerebrate/cli-darwin-x64 (public)
│   ├── linux-x64/                       # @cerebrate/cli-linux-x64 (public)
│   ├── linux-arm64/                     # @cerebrate/cli-linux-arm64 (public)
│   └── windows-x64/                     # @cerebrate/cli-windows-x64 (public)
│
└── packages/
    └── cli/                             # @cerebrate/cli (source code, public)
        ├── package.json
        │   └── main: "src/index.ts"
        └── src/
            └── index.ts                 # Actual CLI logic
```

## Execution Flow

### Case 1: Bun User (BUN=1)

```
$ BUN=1 cerebrate server
  ↓
dist/index.js (wrapper)
  ↓ Bun detection (bun --version)
  ↓ Bun 1.2+ confirmation (requires YAML native module)
  ↓ bun run dist/native.js server
  ↓
dist/native.js (bundled CLI)
  ↓ Includes @cerebrate/cli + all workspace dependencies
  ↓
Execution ✅ (native performance)
```

### Case 2: Regular User (Default)

```
$ cerebrate server
  ↓
dist/index.js (wrapper)
  ↓ No BUN env
  ↓ Platform detection (darwin-arm64)
  ↓ require.resolve('@cerebrate/cli-darwin-arm64/bin/cerebrate')
  ↓
Compiled binary
  ↓
Execution ✅ (standalone)
```

## Package Configuration

### 1. `clis/entry` (cerebrate)

The main entry package, distributed as `cerebrate` on npm.

**package.json:**

```json
{
  "name": "cerebrate",
  "version": "0.1.0",
  "description": "MCP server manager - works with or without Bun",
  "private": false,
  "type": "module",
  "bin": {
    "cerebrate": "./dist/index.js"
  },
  "files": ["dist/"],
  "scripts": {
    "build:native": "bun build src/native.ts --outfile dist/native.js --target bun --format esm",
    "build:wrapper": "bun build src/index.ts --outfile dist/index.js --target node --format esm",
    "build": "bun run build:native && bun run build:wrapper",
    "prepublishOnly": "bun run build"
  },
  "keywords": ["mcp", "model-context-protocol", "cli", "bun"],
  "author": "zenyr",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/zenyr/cerebrate.git",
    "directory": "clis/entry"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "optionalDependencies": {
    "@cerebrate/cli-darwin-arm64": "0.1.0",
    "@cerebrate/cli-darwin-x64": "0.1.0",
    "@cerebrate/cli-linux-x64": "0.1.0",
    "@cerebrate/cli-linux-arm64": "0.1.0",
    "@cerebrate/cli-windows-x64": "0.1.0"
  },
  "devDependencies": {
    "@cerebrate/cli": "workspace:*"
  }
}
```

**Key Points:**
- References `@cerebrate/cli` as `devDependencies` (only needed at build time)
- References platform-specific binaries as `optionalDependencies`
- Distributes both `dist/native.js` and `dist/index.js`

### 2. `packages/cli` (@cerebrate/cli)

The source code package containing the actual CLI logic. Distributed publicly for Bun users.

**package.json:**

```json
{
  "name": "@cerebrate/cli",
  "version": "0.1.0",
  "description": "Cerebrate CLI source code (for Bun users)",
  "private": false,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./src/*": "./src/*"
  },
  "files": ["src/", "package.json"],
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target bun",
    "compile": "bun build --compile src/index.ts --outfile bin/cerebrate",
    "lint": "eslint src",
    "test": "bun test",
    "type-check": "tsc --noEmit"
  },
  "keywords": ["mcp", "cli", "bun"],
  "author": "zenyr",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/zenyr/cerebrate.git",
    "directory": "packages/cli"
  },
  "engines": {
    "bun": ">=1.2.0"
  },
  "dependencies": {
    "@cerebrate/core": "workspace:*",
    "@cerebrate/server": "workspace:*",
    "@cerebrate/tui": "workspace:*",
    "json5": "^2.2.3",
    "zod": "^4.1.11"
  },
  "devDependencies": {
    "@cerebrate/config": "workspace:*",
    "@types/bun": "^1.2.23",
    "eslint": "^9.36.0",
    "typescript": "^5.7.3"
  }
}
```

**Key Points:**
- `main`: `src/index.ts` (direct source export)
- `files`: Only includes `src/` (distributes source code)
- Maintains workspace dependencies as-is

### 3. `clis/{platform}` (@cerebrate/cli-{platform})

Packages containing compiled binaries for each platform.

**package.json Example (darwin-arm64):**

```json
{
  "name": "@cerebrate/cli-darwin-arm64",
  "version": "0.1.0",
  "description": "Cerebrate CLI binary for macOS Apple Silicon",
  "private": false,
  "os": ["darwin"],
  "cpu": ["arm64"],
  "files": ["bin/cerebrate"],
  "repository": {
    "type": "git",
    "url": "https://github.com/zenyr/cerebrate.git",
    "directory": "clis/darwin-arm64"
  },
  "license": "MIT"
}
```

**Key Points:**
- Platform-specific with `os`, `cpu` constraints
- `files` includes only the binary
- Contains only package.json and binary

## Core Code

### `clis/entry/src/native.ts`

```typescript
#!/usr/bin/env bun

// Directly import @cerebrate/cli for bundling
import { main } from '@cerebrate/cli/src/index';

main(process.argv.slice(2));
```

**Build Command:**
```bash
bun build src/native.ts --outfile dist/native.js --target bun --format esm
```

**Result:**
- `dist/native.js`: ~1-2MB
- Includes `@cerebrate/cli` + all workspace dependencies
- Executable only in Bun runtime

### `clis/entry/src/index.ts`

```typescript
#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const detectBun = (): string | null => {
  try {
    const result = spawnSync('bun', ['--version'], { encoding: 'utf-8' });
    if (result.status === 0) {
      const version = result.stdout.trim();
      const [major, minor] = version.split('.').map(Number);
      // YAML native module requires Bun 1.2+
      if (major > 1 || (major === 1 && minor >= 2)) {
        return version;
      }
    }
  } catch {}
  return null;
};

const runWithBun = (args: string[]) => {
  const nativePath = join(__dirname, 'native.js');
  const result = spawnSync('bun', ['run', nativePath, ...args], {
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
};

const runCompiled = (args: string[]) => {
  const platform = `${process.platform}-${process.arch}`;
  const BINARY_MAP: Record<string, string> = {
    'darwin-arm64': '@cerebrate/cli-darwin-arm64',
    'darwin-x64': '@cerebrate/cli-darwin-x64',
    'linux-x64': '@cerebrate/cli-linux-x64',
    'linux-arm64': '@cerebrate/cli-linux-arm64',
    'win32-x64': '@cerebrate/cli-windows-x64',
  };

  const pkgName = BINARY_MAP[platform];
  if (!pkgName) {
    console.error(`❌ Unsupported platform: ${platform}`);
    console.error('Supported:', Object.keys(BINARY_MAP).join(', '));
    process.exit(1);
  }

  try {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const binaryPath = require.resolve(`${pkgName}/bin/cerebrate${ext}`);
    const result = spawnSync(binaryPath, args, { stdio: 'inherit' });
    process.exit(result.status ?? 1);
  } catch (error) {
    console.error(`❌ Binary not found for ${platform}`);
    console.error('Try: npm install -g cerebrate --force');
    process.exit(1);
  }
};

const main = (args: string[]) => {
  // If BUN env is truthy, run directly with Bun
  if (process.env.BUN) {
    const bunVersion = detectBun();
    if (bunVersion) {
      console.log(`🚀 Using Bun ${bunVersion}`);
      return runWithBun(args);
    }
    console.warn('⚠️  BUN env is set but Bun not found, using compiled binary');
  }

  // Default: compiled binary
  return runCompiled(args);
};

main(process.argv.slice(2));
```

**Build Command:**
```bash
bun build src/index.ts --outfile dist/index.js --target node --format esm
```

**Result:**
- `dist/index.js`: ~10KB
- Compatible with Node.js 18+
- Includes shebang (`#!/usr/bin/env node`)

## Build Process

### Local Build

```bash
# 1. Build entry package
cd clis/entry
bun run build
# → dist/native.js (1-2MB)
# → dist/index.js (10KB)

# 2. Build platform-specific binaries
cd ../..
./scripts/build-all-clis.sh
# → clis/darwin-arm64/bin/cerebrate
# → clis/darwin-x64/bin/cerebrate
# → clis/linux-x64/bin/cerebrate
# → clis/linux-arm64/bin/cerebrate
# → clis/windows-x64/bin/cerebrate.exe
```

### Build Script

**`scripts/build-all-clis.sh`:**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "🔨 Building cerebrate CLI for all platforms..."

# 1. Build entry package
echo "📦 Building entry package..."
cd clis/entry
bun run build
cd ../..

# 2. Build platform binaries
echo "🔧 Building platform binaries..."
CLI_SOURCE="packages/cli/src/index.ts"

PLATFORMS=(
  "darwin-arm64:bun-darwin-arm64"
  "darwin-x64:bun-darwin-x64"
  "linux-x64:bun-linux-x64"
  "linux-arm64:bun-linux-arm64"
  "windows-x64:bun-windows-x64"
)

for platform_pair in "${PLATFORMS[@]}"; do
  IFS=':' read -r platform target <<< "$platform_pair"
  
  OUTPUT_DIR="clis/${platform}"
  mkdir -p "${OUTPUT_DIR}/bin"
  
  if [[ "$platform" == windows-* ]]; then
    OUTPUT_FILE="${OUTPUT_DIR}/bin/cerebrate.exe"
  else
    OUTPUT_FILE="${OUTPUT_DIR}/bin/cerebrate"
  fi
  
  echo "  → ${platform} (${target})"
  bun build --compile --minify --sourcemap \
    --target="${target}" \
    "${CLI_SOURCE}" \
    --outfile="${OUTPUT_FILE}"
done

echo ""
echo "✅ Build complete!"
echo ""
echo "📊 Build artifacts:"
echo "Entry package:"
ls -lh clis/entry/dist/
echo ""
echo "Platform binaries:"
du -sh clis/*/bin/cerebrate* | sort
```

## Distribution Strategy

### Order

1. **Publish platform-specific binary packages** (first)
   ```bash
   cd clis/darwin-arm64 && npm publish --access public
   cd ../darwin-x64 && npm publish --access public
   cd ../linux-x64 && npm publish --access public
   cd ../linux-arm64 && npm publish --access public
   cd ../windows-x64 && npm publish --access public
   ```

2. **Publish source code package**
   ```bash
   cd packages/cli && npm publish --access public
   ```

3. **Publish entry package** (last)
   ```bash
   cd clis/entry && npm publish --access public
   ```

### Automation Script

**`scripts/publish-all.sh`:**

```bash
#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-0.1.0}"

echo "📦 Publishing cerebrate v${VERSION}..."

# 1. Build
./scripts/build-all-clis.sh

# 2. Publish platform binary packages first
for dir in clis/darwin-* clis/linux-* clis/windows-*; do
  if [ -d "$dir" ]; then
    echo "  → Publishing $(basename $dir)..."
    (cd "$dir" && npm version "$VERSION" --no-git-tag-version && npm publish --access public)
  fi
done

# 3. Publish source package
echo "  → Publishing @cerebrate/cli..."
(cd packages/cli && npm version "$VERSION" --no-git-tag-version && npm publish --access public)

# 4. Publish entry package (last)
echo "  → Publishing cerebrate..."
(cd clis/entry && npm version "$VERSION" --no-git-tag-version && npm publish --access public)

echo "✅ All packages published!"
```

## Package Size Comparison

```
cerebrate (entry package)
├── dist/index.js    ~10KB   (wrapper logic)
└── dist/native.js   ~1-2MB  (bundled CLI for Bun)
Total: ~2MB (compressed ~500KB)

@cerebrate/cli (source package)
└── src/            ~50KB   (TypeScript source)

@cerebrate/cli-darwin-arm64
└── bin/cerebrate   ~60MB   (compiled binary)

Download sizes by user:
- Without Bun: ~60MB (entry 2MB + binary 60MB)
- With Bun (BUN=1): ~2MB (entry only)
```

## User Experience

### Installation

```bash
# Regular user (automatic binary selection)
npm install -g cerebrate

# Bun user (optionally install source too)
npm install -g cerebrate @cerebrate/cli
```

### Execution

```bash
# Default (compiled binary)
cerebrate server

# Force Bun usage
BUN=1 cerebrate server

# Help
cerebrate --help
cerebrate server --help
```

### Environment Variables

- `BUN=1`: Force native Bun execution
- `BUN=0` or unset: Use compiled binary (default)

## Advantages Summary

### Compared to Previous Approach

**❌ Runtime resolve approach:**
```typescript
const cliEntry = require.resolve('@cerebrate/cli/src/index.ts');
// Issues:
// - @cerebrate/cli must be installed at runtime
// - Complex workspace dependency resolution
// - Potential runtime errors
```

**✅ Build-time bundling approach:**
```typescript
import { main } from '@cerebrate/cli/src/index';
// Advantages:
// - All dependencies resolved at build time
// - Everything included in dist/native.js
// - No runtime errors
// - @cerebrate/cli not needed for npm distribution
```

### User Benefits

1. **Bun users**: Smaller bundle (~2MB vs ~60MB)
2. **Regular users**: Works immediately without setup (standalone binary)
3. **Developers**: Can reference source code directly (@cerebrate/cli)
4. **CI/CD**: Fast installation (in Bun environment)

## Trade-offs

### Advantages
- ✅ Optimal performance (native if Bun available, standalone otherwise)
- ✅ Small package size (Bun users download only 2MB)
- ✅ Stable execution (no runtime errors due to build-time bundling)
- ✅ Flexibility (can force selection via environment variable)

### Disadvantages
- ❌ Complex structure (multiple packages to manage)
- ❌ Increased build process complexity
- ❌ Important deployment order (dependency chain)
- ❌ Testing burden (need to test both Bun/Node.js)

## Testing

### Local Testing

```bash
# Build
cd clis/entry
bun run build

# Test native.js (requires Bun)
bun run dist/native.js --help

# Test wrapper (default: compiled binary)
node dist/index.js --help

# Test wrapper (Bun mode)
BUN=1 node dist/index.js --help

# Check bundle sizes
ls -lh dist/
```

### Pre-deployment Verification

```bash
# Dry-run
cd clis/entry
npm pack --dry-run

# Generate actual tarball
npm pack

# Local install test
npm install -g ./cerebrate-0.1.0.tgz
cerebrate --version
npm uninstall -g cerebrate
```

## Notes

### Workspace Dependency Resolution

Workspace dependencies of `@cerebrate/cli` (`@cerebrate/core`, `@cerebrate/server`, etc.) are:

1. **Build-time**: Bun bundles everything into `dist/native.js`
2. **npm distribution**: `@cerebrate/cli` package needs to convert `workspace:*` dependencies to actual versions
3. **Solution**: Automatic conversion from `workspace:*` to `0.1.0` during npm publish (Bun/npm workspace feature)

### Shebang Handling

- `dist/index.js`: `#!/usr/bin/env node` (Node.js)
- `dist/native.js`: `#!/usr/bin/env bun` (Bun, optional)

Bun build automatically preserves shebangs, so specify them in the source.

### Platform Detection

Combine `process.platform` and `process.arch` to identify platform:

- `darwin-arm64`: macOS Apple Silicon
- `darwin-x64`: macOS Intel
- `linux-x64`: Linux x64
- `linux-arm64`: Linux ARM64
- `win32-x64`: Windows x64

Unsupported platforms exit with clear error messages.

## Next Steps

1. ✅ Architecture design complete
2. ⬜ Create `clis/entry` structure
3. ⬜ Change `packages/cli` → `@cerebrate/cli` configuration
4. ⬜ Create `clis/{platform}` packages
5. ⬜ Write build scripts
6. ⬜ Local testing
7. ⬜ Write deployment scripts
8. ⬜ npm distribution