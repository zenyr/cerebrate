# CLI Entry 패키지 아키텍처

## 개요

Cerebrate의 CLI 진입점은 **Bun-first with Compiled Fallback** 전략을 사용합니다. 사용자가 Bun을 가지고 있으면 네이티브 성능으로 실행하고, 없으면 컴파일된 바이너리로 자동 fallback합니다.

## 디렉토리 구조

```
cerebrate/
├── clis/
│   ├── entry/                           # cerebrate (메인 패키지, public)
│   │   ├── package.json
│   │   │   └── name: "cerebrate"
│   │   │   └── devDependencies: { "@cerebrate/cli": "workspace:*" }
│   │   ├── src/
│   │   │   ├── index.ts                 # Wrapper logic (Bun 감지 + 실행 경로 선택)
│   │   │   └── native.ts                # Bun 직접 실행용 엔트리
│   │   └── dist/
│   │       ├── index.js                 # bin: cerebrate → Node.js에서 실행
│   │       └── native.js                # @cerebrate/cli 번들 (Bun에서 실행)
│   │
│   ├── darwin-arm64/                    # @cerebrate/cli-darwin-arm64 (public)
│   │   ├── package.json
│   │   └── bin/
│   │       └── cerebrate                # 컴파일된 바이너리 (60MB)
│   │
│   ├── darwin-x64/                      # @cerebrate/cli-darwin-x64 (public)
│   ├── linux-x64/                       # @cerebrate/cli-linux-x64 (public)
│   ├── linux-arm64/                     # @cerebrate/cli-linux-arm64 (public)
│   └── windows-x64/                     # @cerebrate/cli-windows-x64 (public)
│
└── packages/
    └── cli/                             # @cerebrate/cli (소스코드, public)
        ├── package.json
        │   └── main: "src/index.ts"
        └── src/
            └── index.ts                 # 실제 CLI 로직
```

## 실행 플로우

### Case 1: Bun 사용자 (BUN=1)

```
$ BUN=1 cerebrate server
  ↓
dist/index.js (wrapper)
  ↓ Bun 감지 (bun --version)
  ↓ Bun 1.2+ 확인 (YAML 네이티브 모듈 필요)
  ↓ bun run dist/native.js server
  ↓
dist/native.js (번들된 CLI)
  ↓ @cerebrate/cli + workspace deps 모두 포함
  ↓
실행 ✅ (네이티브 성능)
```

### Case 2: 일반 사용자 (기본)

```
$ cerebrate server
  ↓
dist/index.js (wrapper)
  ↓ BUN env 없음
  ↓ Platform 감지 (darwin-arm64)
  ↓ require.resolve('@cerebrate/cli-darwin-arm64/bin/cerebrate')
  ↓
컴파일된 바이너리
  ↓
실행 ✅ (standalone)
```

## 패키지 구성

### 1. `clis/entry` (cerebrate)

메인 엔트리 패키지로, npm에서 `cerebrate`로 배포됩니다.

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

**핵심 포인트:**
- `devDependencies`로 `@cerebrate/cli` 참조 (빌드 타임에만 필요)
- `optionalDependencies`로 플랫폼별 바이너리 참조
- `dist/native.js`와 `dist/index.js` 모두 배포

### 2. `packages/cli` (@cerebrate/cli)

실제 CLI 로직이 들어있는 소스코드 패키지입니다. Bun 사용자를 위해 public으로 배포됩니다.

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

**핵심 포인트:**
- `main`: `src/index.ts` (소스 직접 export)
- `files`: `src/`만 포함 (소스코드 배포)
- workspace 의존성 그대로 유지

### 3. `clis/{platform}` (@cerebrate/cli-{platform})

각 플랫폼별 컴파일된 바이너리를 담은 패키지입니다.

**package.json 예시 (darwin-arm64):**

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

**핵심 포인트:**
- `os`, `cpu` 제약으로 플랫폼 특정
- `files`에 바이너리만 포함
- package.json과 바이너리 외에는 아무것도 없음

## 핵심 코드

### `clis/entry/src/native.ts`

```typescript
#!/usr/bin/env bun

// @cerebrate/cli를 직접 import하여 번들링
import { main } from '@cerebrate/cli/src/index';

main(process.argv.slice(2));
```

**빌드 명령어:**
```bash
bun build src/native.ts --outfile dist/native.js --target bun --format esm
```

**결과:**
- `dist/native.js`: 약 1-2MB
- `@cerebrate/cli` + 모든 workspace 의존성 포함
- Bun 런타임에서만 실행 가능

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
      // YAML 네이티브 모듈은 Bun 1.2+
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
  // 환경변수 BUN이 truthy면 Bun 직접 실행
  if (process.env.BUN) {
    const bunVersion = detectBun();
    if (bunVersion) {
      console.log(`🚀 Using Bun ${bunVersion}`);
      return runWithBun(args);
    }
    console.warn('⚠️  BUN env is set but Bun not found, using compiled binary');
  }

  // 기본: 컴파일된 바이너리
  return runCompiled(args);
};

main(process.argv.slice(2));
```

**빌드 명령어:**
```bash
bun build src/index.ts --outfile dist/index.js --target node --format esm
```

**결과:**
- `dist/index.js`: 약 10KB
- Node.js 18+ 호환
- shebang 포함 (`#!/usr/bin/env node`)

## 빌드 프로세스

### 로컬 빌드

```bash
# 1. Entry 패키지 빌드
cd clis/entry
bun run build
# → dist/native.js (1-2MB)
# → dist/index.js (10KB)

# 2. 플랫폼별 바이너리 빌드
cd ../..
./scripts/build-all-clis.sh
# → clis/darwin-arm64/bin/cerebrate
# → clis/darwin-x64/bin/cerebrate
# → clis/linux-x64/bin/cerebrate
# → clis/linux-arm64/bin/cerebrate
# → clis/windows-x64/bin/cerebrate.exe
```

### 빌드 스크립트

**`scripts/build-all-clis.sh`:**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "🔨 Building cerebrate CLI for all platforms..."

# 1. Entry 패키지 빌드
echo "📦 Building entry package..."
cd clis/entry
bun run build
cd ../..

# 2. 플랫폼별 바이너리 빌드
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

## 배포 전략

### 순서

1. **플랫폼별 바이너리 패키지 배포** (먼저)
   ```bash
   cd clis/darwin-arm64 && npm publish --access public
   cd ../darwin-x64 && npm publish --access public
   cd ../linux-x64 && npm publish --access public
   cd ../linux-arm64 && npm publish --access public
   cd ../windows-x64 && npm publish --access public
   ```

2. **소스코드 패키지 배포**
   ```bash
   cd packages/cli && npm publish --access public
   ```

3. **엔트리 패키지 배포** (마지막)
   ```bash
   cd clis/entry && npm publish --access public
   ```

### 자동화 스크립트

**`scripts/publish-all.sh`:**

```bash
#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-0.1.0}"

echo "📦 Publishing cerebrate v${VERSION}..."

# 1. 빌드
./scripts/build-all-clis.sh

# 2. 플랫폼 바이너리 패키지들 먼저 배포
for dir in clis/darwin-* clis/linux-* clis/windows-*; do
  if [ -d "$dir" ]; then
    echo "  → Publishing $(basename $dir)..."
    (cd "$dir" && npm version "$VERSION" --no-git-tag-version && npm publish --access public)
  fi
done

# 3. 소스 패키지 배포
echo "  → Publishing @cerebrate/cli..."
(cd packages/cli && npm version "$VERSION" --no-git-tag-version && npm publish --access public)

# 4. 엔트리 패키지 배포 (마지막)
echo "  → Publishing cerebrate..."
(cd clis/entry && npm version "$VERSION" --no-git-tag-version && npm publish --access public)

echo "✅ All packages published!"
```

## 패키지 크기 비교

```
cerebrate (entry package)
├── dist/index.js    ~10KB   (wrapper logic)
└── dist/native.js   ~1-2MB  (bundled CLI for Bun)
Total: ~2MB (압축 시 ~500KB)

@cerebrate/cli (source package)
└── src/            ~50KB   (TypeScript 소스)

@cerebrate/cli-darwin-arm64
└── bin/cerebrate   ~60MB   (compiled binary)

사용자별 다운로드 크기:
- Bun 없음: ~60MB (entry 2MB + binary 60MB)
- Bun 있음 (BUN=1): ~2MB (entry만)
```

## 사용자 경험

### 설치

```bash
# 일반 사용자 (바이너리 자동 선택)
npm install -g cerebrate

# Bun 사용자 (선택적으로 소스도 설치)
npm install -g cerebrate @cerebrate/cli
```

### 실행

```bash
# 기본 (컴파일된 바이너리)
cerebrate server

# Bun 강제 사용
BUN=1 cerebrate server

# 도움말
cerebrate --help
cerebrate server --help
```

### 환경변수

- `BUN=1`: Bun 네이티브 실행 강제
- `BUN=0` 또는 미설정: 컴파일된 바이너리 사용 (기본)

## 장점 정리

### 기존 방식 대비

**❌ 런타임 resolve 방식:**
```typescript
const cliEntry = require.resolve('@cerebrate/cli/src/index.ts');
// 문제점:
// - @cerebrate/cli가 런타임에 설치되어 있어야 함
// - workspace 의존성 해결 복잡
// - 런타임 오류 가능성
```

**✅ 빌드타임 번들링 방식:**
```typescript
import { main } from '@cerebrate/cli/src/index';
// 장점:
// - 빌드 타임에 모든 의존성 해결
// - dist/native.js에 모두 포함
// - 런타임 오류 없음
// - npm 배포 시 @cerebrate/cli 불필요
```

### 사용자 이점

1. **Bun 사용자**: 작은 번들 (~2MB vs ~60MB)
2. **일반 사용자**: 설정 없이 바로 작동 (standalone binary)
3. **개발자**: 소스코드 직접 참조 가능 (@cerebrate/cli)
4. **CI/CD**: 빠른 설치 (Bun 환경에서)

## 트레이드오프

### 장점
- ✅ 최적의 성능 (Bun 있으면 네이티브, 없으면 standalone)
- ✅ 작은 패키지 크기 (Bun 사용자는 2MB만 다운로드)
- ✅ 안정적 실행 (빌드타임 번들링으로 런타임 오류 없음)
- ✅ 유연성 (환경변수로 강제 선택 가능)

### 단점
- ❌ 복잡한 구조 (여러 패키지 관리)
- ❌ 빌드 프로세스 복잡도 증가
- ❌ 배포 순서 중요 (의존성 체인)
- ❌ 테스트 부담 (Bun/Node.js 양쪽 테스트 필요)

## 테스트

### 로컬 테스트

```bash
# 빌드
cd clis/entry
bun run build

# native.js 테스트 (Bun 필요)
bun run dist/native.js --help

# wrapper 테스트 (기본: 컴파일된 바이너리)
node dist/index.js --help

# wrapper 테스트 (Bun 모드)
BUN=1 node dist/index.js --help

# 번들 크기 확인
ls -lh dist/
```

### 배포 전 검증

```bash
# Dry-run
cd clis/entry
npm pack --dry-run

# 실제 tarball 생성
npm pack

# 로컬 설치 테스트
npm install -g ./cerebrate-0.1.0.tgz
cerebrate --version
npm uninstall -g cerebrate
```

## 참고사항

### Workspace 의존성 해결

`@cerebrate/cli`의 workspace 의존성들 (`@cerebrate/core`, `@cerebrate/server`, 등)은:

1. **빌드타임**: Bun이 `dist/native.js`에 모두 번들링
2. **npm 배포**: `@cerebrate/cli` 패키지가 `workspace:*` 의존성을 실제 버전으로 변환 필요
3. **해결책**: npm publish 시 `workspace:*` → `0.1.0`으로 자동 변환 (Bun/npm workspace 기능)

### Shebang 처리

- `dist/index.js`: `#!/usr/bin/env node` (Node.js)
- `dist/native.js`: `#!/usr/bin/env bun` (Bun, 선택적)

Bun build는 자동으로 shebang을 보존하므로 소스에서 지정하면 됩니다.

### 플랫폼 감지

`process.platform`과 `process.arch`를 조합하여 플랫폼 식별:

- `darwin-arm64`: macOS Apple Silicon
- `darwin-x64`: macOS Intel
- `linux-x64`: Linux x64
- `linux-arm64`: Linux ARM64
- `win32-x64`: Windows x64

지원하지 않는 플랫폼은 명확한 에러 메시지와 함께 종료합니다.

## 다음 단계

1. ✅ 아키텍처 설계 완료
2. ⬜ `clis/entry` 구조 생성
3. ⬜ `packages/cli` → `@cerebrate/cli` 설정 변경
4. ⬜ `clis/{platform}` 패키지들 생성
5. ⬜ 빌드 스크립트 작성
6. ⬜ 로컬 테스트
7. ⬜ 배포 스크립트 작성
8. ⬜ npm 배포
