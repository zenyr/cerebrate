# Bun Compile: 크로스 플랫폼 바이너리 빌드 및 NPM 배포 가이드

## 개요

Bun의 `--compile` 플래그는 TypeScript/JavaScript 파일을 단일 실행 파일로 번들링하는 기능을 제공합니다. 이 문서는 여러 플랫폼(Windows, Linux, macOS)용 바이너리를 빌드하고 npm 레지스트리에 배포하는 방법을 다룹니다.

## 지원하는 타겟 플랫폼

Bun은 다음 플랫폼에 대한 크로스 컴파일을 지원합니다:

| Target | OS | Architecture | Modern | Baseline | Notes |
|--------|----|--------------| -------|----------|-------|
| `bun-linux-x64` | Linux | x64 | ✅ | ✅ | glibc 기반 |
| `bun-linux-x64-baseline` | Linux | x64 (구형 CPU) | ❌ | ✅ | Nehalem (2013년 이전 CPU) |
| `bun-linux-x64-modern` | Linux | x64 (최신 CPU) | ✅ | ❌ | Haswell (2013년 이후 CPU, AVX2) |
| `bun-linux-arm64` | Linux | arm64 | ✅ | N/A | Graviton, Raspberry Pi |
| `bun-linux-x64-musl` | Linux | x64 | ✅ | ✅ | Alpine Linux 등 musl 기반 |
| `bun-linux-arm64-musl` | Linux | arm64 | ✅ | N/A | Alpine Linux ARM64 |
| `bun-windows-x64` | Windows | x64 | ✅ | ✅ | |
| `bun-windows-x64-baseline` | Windows | x64 (구형 CPU) | ❌ | ✅ | |
| `bun-windows-x64-modern` | Windows | x64 (최신 CPU) | ✅ | ❌ | |
| `bun-darwin-x64` | macOS | x64 | ✅ | ✅ | Intel Mac |
| `bun-darwin-arm64` | macOS | arm64 | ✅ | N/A | Apple Silicon (M1/M2/M3) |

### Modern vs Baseline

- **Modern**: AVX2 SIMD 최적화를 사용하는 빌드 (2013년 이후 CPU). 더 빠르지만 호환성이 제한적
- **Baseline**: 구형 CPU 지원 (2013년 이전). 속도는 느리지만 호환성이 높음
- 사용자가 "Illegal instruction" 오류를 보면 baseline 빌드가 필요함

## 기본 컴파일 방법

### 단일 플랫폼 (현재 OS)

```bash
bun build --compile src/index.ts --outfile bin/myapp
```

### 크로스 컴파일

```bash
# Linux x64 (서버용 - 가장 일반적)
bun build --compile --target=bun-linux-x64 src/index.ts --outfile bin/myapp-linux-x64

# Windows x64
bun build --compile --target=bun-windows-x64 src/index.ts --outfile bin/myapp-windows-x64.exe

# macOS Apple Silicon
bun build --compile --target=bun-darwin-arm64 src/index.ts --outfile bin/myapp-darwin-arm64

# macOS Intel
bun build --compile --target=bun-darwin-x64 src/index.ts --outfile bin/myapp-darwin-x64

# Linux ARM64 (Graviton, Raspberry Pi)
bun build --compile --target=bun-linux-arm64 src/index.ts --outfile bin/myapp-linux-arm64
```

### 프로덕션 권장 옵션

```bash
bun build --compile --minify --sourcemap --bytecode \
  --target=bun-linux-x64 \
  src/index.ts \
  --outfile bin/myapp
```

**플래그 설명:**
- `--minify`: 코드 크기 최적화 (메가바이트 단위 절약 가능)
- `--sourcemap`: 에러 스택트레이스를 원본 코드 위치로 매핑 (zstd 압축)
- `--bytecode`: 바이트코드 사전 컴파일로 시작 시간 50% 단축 (실험적 기능, CJS만 지원)

### Windows 전용 메타데이터

Windows 빌드 시 실행 파일 속성을 설정할 수 있습니다:

```bash
bun build --compile --target=bun-windows-x64 \
  src/index.ts \
  --outfile bin/myapp.exe \
  --windows-title "My Application" \
  --windows-publisher "My Company Inc" \
  --windows-version "1.2.3.4" \
  --windows-description "A powerful CLI tool" \
  --windows-copyright "© 2025 My Company" \
  --windows-icon "./assets/icon.ico" \
  --windows-hide-console  # GUI 앱인 경우
```

**주의:** Windows 메타데이터 플래그는 Windows에서 빌드할 때만 작동합니다 (크로스 컴파일 불가).

### macOS 코드 사이닝

macOS에서 Gatekeeper 경고를 방지하려면 코드 사이닝이 필요합니다:

```bash
# 기본 사이닝
codesign --deep --force -vvvv --sign "XXXXXXXXXX" ./myapp

# JIT 권한 포함 (권장)
codesign --deep --force -vvvv \
  --sign "XXXXXXXXXX" \
  --entitlements entitlements.plist \
  ./myapp

# 검증
codesign -vvv --verify ./myapp
```

**entitlements.plist** 예시:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-executable-page-protection</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
</dict>
</plist>
```

## NPM 레지스트리 배포 전략

크로스 플랫폼 바이너리를 npm에 배포하는 방법은 크게 **3가지 전략**이 있습니다.

### 전략 1: 단일 패키지 + Optional Dependencies (권장)

대부분의 Rust/Go 기반 도구들이 사용하는 방식입니다 (예: `esbuild`, `swc`, `prettier`).

**장점:**
- 사용자는 하나의 패키지만 설치
- 자동으로 플랫폼에 맞는 바이너리 다운로드
- npm/yarn/pnpm 모두 잘 지원

**단점:**
- 패키지 구조가 복잡함
- 여러 개의 플랫폼별 패키지 관리 필요

**구조:**

```
my-cli/                          # 메인 패키지
  ├── package.json               # optionalDependencies로 플랫폼 패키지들 참조
  ├── bin/
  │   └── my-cli.js              # 플랫폼 감지 및 적절한 바이너리 실행
  └── index.js

my-cli-darwin-arm64/             # macOS Apple Silicon 패키지
  ├── package.json
  └── bin/
      └── my-cli

my-cli-darwin-x64/               # macOS Intel 패키지
my-cli-linux-x64/                # Linux x64 패키지
my-cli-linux-arm64/              # Linux ARM64 패키지
my-cli-windows-x64/              # Windows x64 패키지
```

**메인 package.json:**

```json
{
  "name": "my-cli",
  "version": "1.0.0",
  "bin": {
    "my-cli": "./bin/my-cli.js"
  },
  "optionalDependencies": {
    "my-cli-darwin-arm64": "1.0.0",
    "my-cli-darwin-x64": "1.0.0",
    "my-cli-linux-x64": "1.0.0",
    "my-cli-linux-arm64": "1.0.0",
    "my-cli-windows-x64": "1.0.0"
  }
}
```

**bin/my-cli.js (래퍼 스크립트):**

```javascript
#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const PLATFORM_MAP = {
  'darwin-arm64': 'my-cli-darwin-arm64',
  'darwin-x64': 'my-cli-darwin-x64',
  'linux-x64': 'my-cli-linux-x64',
  'linux-arm64': 'my-cli-linux-arm64',
  'win32-x64': 'my-cli-windows-x64',
};

const platformKey = `${process.platform}-${process.arch}`;
const packageName = PLATFORM_MAP[platformKey];

if (!packageName) {
  console.error(`Unsupported platform: ${platformKey}`);
  process.exit(1);
}

let binaryPath;
try {
  binaryPath = require.resolve(`${packageName}/bin/my-cli${process.platform === 'win32' ? '.exe' : ''}`);
} catch (error) {
  console.error(`Failed to find binary for ${platformKey}. Try reinstalling.`);
  console.error(error.message);
  process.exit(1);
}

const result = spawnSync(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
  windowsHide: false,
});

process.exit(result.status ?? 1);
```

**플랫폼별 package.json 예시:**

```json
{
  "name": "my-cli-darwin-arm64",
  "version": "1.0.0",
  "os": ["darwin"],
  "cpu": ["arm64"],
  "files": ["bin/my-cli"]
}
```

### 전략 2: 모든 바이너리 포함 (간단하지만 비효율적)

**장점:**
- 구현이 매우 간단
- 설치 실패 위험 없음

**단점:**
- 패키지 크기가 매우 큼 (각 바이너리 60MB × 플랫폼 수)
- 다운로드 시간 증가
- 네트워크 비용 증가

```json
{
  "name": "my-cli",
  "version": "1.0.0",
  "bin": {
    "my-cli": "./bin/launcher.js"
  },
  "files": [
    "bin/my-cli-darwin-arm64",
    "bin/my-cli-darwin-x64",
    "bin/my-cli-linux-x64",
    "bin/my-cli-linux-arm64",
    "bin/my-cli-windows-x64.exe",
    "bin/launcher.js"
  ]
}
```

**bin/launcher.js:**

```javascript
#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const BINARY_MAP = {
  'darwin-arm64': 'my-cli-darwin-arm64',
  'darwin-x64': 'my-cli-darwin-x64',
  'linux-x64': 'my-cli-linux-x64',
  'linux-arm64': 'my-cli-linux-arm64',
  'win32-x64': 'my-cli-windows-x64.exe',
};

const platformKey = `${process.platform}-${process.arch}`;
const binaryName = BINARY_MAP[platformKey];

if (!binaryName) {
  console.error(`Unsupported platform: ${platformKey}`);
  process.exit(1);
}

const binaryPath = join(__dirname, binaryName);
const result = spawnSync(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
  windowsHide: false,
});

process.exit(result.status ?? 1);
```

### 전략 3: 다운로드 스크립트 (deprecated, 권장하지 않음)

과거 방식으로, postinstall 스크립트에서 바이너리를 다운로드합니다. 보안 문제와 설치 실패 위험이 있어 현재는 권장하지 않습니다.

## 실전: Cerebrate CLI 배포 설정

현재 `packages/cli` 패키지를 배포하기 위한 구체적인 단계입니다.

### 1단계: 빌드 스크립트 작성

`packages/cli/scripts/build-all.sh` 생성:

```bash
#!/usr/bin/env bash
set -euo pipefail

# 빌드 디렉토리 정리
rm -rf bin/*
mkdir -p bin

echo "Building for all platforms..."

# macOS Apple Silicon
echo "  → darwin-arm64"
bun build --compile --minify --sourcemap \
  --target=bun-darwin-arm64 \
  src/index.ts \
  --outfile bin/cerebrate-darwin-arm64

# macOS Intel
echo "  → darwin-x64"
bun build --compile --minify --sourcemap \
  --target=bun-darwin-x64 \
  src/index.ts \
  --outfile bin/cerebrate-darwin-x64

# Linux x64 (가장 일반적인 서버)
echo "  → linux-x64"
bun build --compile --minify --sourcemap \
  --target=bun-linux-x64 \
  src/index.ts \
  --outfile bin/cerebrate-linux-x64

# Linux x64 baseline (구형 CPU 지원)
echo "  → linux-x64-baseline"
bun build --compile --minify --sourcemap \
  --target=bun-linux-x64-baseline \
  src/index.ts \
  --outfile bin/cerebrate-linux-x64-baseline

# Linux ARM64
echo "  → linux-arm64"
bun build --compile --minify --sourcemap \
  --target=bun-linux-arm64 \
  src/index.ts \
  --outfile bin/cerebrate-linux-arm64

# Windows x64
echo "  → windows-x64"
bun build --compile --minify --sourcemap \
  --target=bun-windows-x64 \
  src/index.ts \
  --outfile bin/cerebrate-windows-x64.exe

# Windows x64 baseline
echo "  → windows-x64-baseline"
bun build --compile --minify --sourcemap \
  --target=bun-windows-x64-baseline \
  src/index.ts \
  --outfile bin/cerebrate-windows-x64-baseline.exe

echo "✅ All builds complete!"
ls -lh bin/
```

실행 권한 부여:

```bash
chmod +x packages/cli/scripts/build-all.sh
```

### 2단계: 런처 스크립트 작성

`packages/cli/bin/cerebrate` (기존 바이너리 대신):

```javascript
#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const BINARY_MAP = {
  'darwin-arm64': 'cerebrate-darwin-arm64',
  'darwin-x64': 'cerebrate-darwin-x64',
  'linux-x64': 'cerebrate-linux-x64',
  'linux-arm64': 'cerebrate-linux-arm64',
  'win32-x64': 'cerebrate-windows-x64.exe',
};

const platformKey = `${process.platform}-${process.arch}`;
let binaryName = BINARY_MAP[platformKey];

if (!binaryName) {
  console.error(`❌ Unsupported platform: ${platformKey}`);
  console.error('Supported platforms:');
  Object.keys(BINARY_MAP).forEach(key => console.error(`  - ${key}`));
  process.exit(1);
}

const binaryPath = join(__dirname, binaryName);

// 바이너리 존재 여부 확인
try {
  require('node:fs').accessSync(binaryPath);
} catch (error) {
  // baseline fallback (Linux/Windows)
  if (platformKey === 'linux-x64' || platformKey === 'win32-x64') {
    const baselineName = binaryName.replace(/(\.[^.]+)?$/, '-baseline$1');
    const baselinePath = join(__dirname, baselineName);
    try {
      require('node:fs').accessSync(baselinePath);
      console.warn('⚠️  Using baseline build for older CPU compatibility');
      binaryName = baselineName;
    } catch {
      console.error(`❌ Binary not found: ${binaryPath}`);
      console.error('Please reinstall the package.');
      process.exit(1);
    }
  } else {
    console.error(`❌ Binary not found: ${binaryPath}`);
    console.error('Please reinstall the package.');
    process.exit(1);
  }
}

const result = spawnSync(join(__dirname, binaryName), process.argv.slice(2), {
  stdio: 'inherit',
  windowsHide: false,
});

if (result.error) {
  console.error(`❌ Failed to execute: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
```

### 3단계: package.json 업데이트

```json
{
  "name": "cerebrate",
  "version": "0.1.0",
  "description": "A powerful MCP (Model Context Protocol) server manager",
  "private": false,
  "type": "module",
  "bin": {
    "cerebrate": "bin/cerebrate"
  },
  "files": [
    "bin/cerebrate",
    "bin/cerebrate-darwin-arm64",
    "bin/cerebrate-darwin-x64",
    "bin/cerebrate-linux-x64",
    "bin/cerebrate-linux-x64-baseline",
    "bin/cerebrate-linux-arm64",
    "bin/cerebrate-windows-x64.exe",
    "bin/cerebrate-windows-x64-baseline.exe"
  ],
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target bun",
    "compile": "bun build --compile src/index.ts --outfile bin/cerebrate",
    "compile:all": "./scripts/build-all.sh",
    "prepublishOnly": "bun run compile:all",
    "lint": "eslint src",
    "test": "bun test",
    "type-check": "tsc --noEmit"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "ai",
    "cli",
    "server-manager"
  ],
  "author": "zenyr",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/zenyr/cerebrate.git",
    "directory": "packages/cli"
  },
  "bugs": {
    "url": "https://github.com/zenyr/cerebrate/issues"
  },
  "homepage": "https://github.com/zenyr/cerebrate#readme",
  "engines": {
    "node": ">=18.0.0"
  },
  "os": [
    "darwin",
    "linux",
    "win32"
  ],
  "cpu": [
    "x64",
    "arm64"
  ],
  "devDependencies": {
    "@cerebrate/config": "workspace:*",
    "@types/bun": "^1.2.23",
    "typescript": "^5.7.3"
  },
  "dependencies": {
    "eslint": "^9.36.0",
    "@cerebrate/core": "workspace:*",
    "@cerebrate/server": "workspace:*",
    "@cerebrate/tui": "workspace:*",
    "json5": "^2.2.3",
    "zod": "^4.1.11"
  }
}
```

**주요 변경 사항:**
- `version`: `0.0.0` → `0.1.0` (실제 배포 전 적절히 수정)
- `files`: 모든 플랫폼 바이너리 포함
- `prepublishOnly`: 배포 전 자동으로 모든 플랫폼 빌드
- `keywords`, `repository`, `license` 등 메타데이터 추가
- `engines`, `os`, `cpu`: 지원 환경 명시

### 4단계: .npmignore 또는 files 관리

`packages/cli/.npmignore` (선택사항):

```
# Source code는 포함하지 않을 경우
# src/
# *.test.ts

# Development files
.turbo/
*.log
.DS_Store

# Build artifacts
dist/
node_modules/
```

**참고:** `package.json`의 `files` 필드가 있으면 `.npmignore`는 무시됩니다.

## CI/CD: GitHub Actions 설정

`.github/workflows/publish.yml`:

```yaml
name: Publish to NPM

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish (e.g., 1.0.0)'
        required: true
        type: string

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run tests
        run: bun test --filter=@cerebrate/cli

      - name: Type check
        run: bun run type-check --filter=@cerebrate/cli

      - name: Build all platforms
        run: bun run --filter=@cerebrate/cli compile:all

      - name: Verify binaries
        run: |
          echo "Checking binary sizes..."
          ls -lh packages/cli/bin/
          echo "Verifying binary count..."
          [ $(ls packages/cli/bin/ | wc -l) -eq 8 ] || exit 1

      - name: Setup Node.js for npm publish
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Publish to npm
        working-directory: packages/cli
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: npm publish --provenance --access public

      - name: Upload binaries as artifacts
        uses: actions/upload-artifact@v4
        with:
          name: cerebrate-binaries
          path: packages/cli/bin/cerebrate-*
          retention-days: 30
```

**설정 방법:**
1. GitHub Secrets에 `NPM_TOKEN` 추가 (npm access token)
2. npm에서 automation token 생성: https://www.npmjs.com/settings/~/tokens
3. `--provenance`: npm provenance를 활성화하여 보안 강화 (선택사항)

## 배포 전 체크리스트

### 1. 로컬에서 테스트

```bash
# 모든 플랫폼 빌드
cd packages/cli
./scripts/build-all.sh

# 현재 플랫폼 바이너리 테스트
./bin/cerebrate-darwin-arm64 --help  # macOS Apple Silicon
./bin/cerebrate-linux-x64 --help     # Linux
# Windows는 WSL이나 Wine으로 테스트

# 런처 스크립트 테스트
node bin/cerebrate --help
```

### 2. Dry-run으로 패키지 확인

```bash
# 패키지에 포함될 파일 확인
npm pack --dry-run

# 배포 시뮬레이션
npm publish --dry-run

# 로컬 설치 테스트
npm pack
npm install -g ./cerebrate-0.1.0.tgz
cerebrate --help
npm uninstall -g cerebrate
```

### 3. 버전 관리

```bash
# 버전 업데이트 (semantic versioning)
npm version patch  # 0.1.0 → 0.1.1 (bug fixes)
npm version minor  # 0.1.0 → 0.2.0 (new features)
npm version major  # 0.1.0 → 1.0.0 (breaking changes)
```

### 4. npm 계정 확인

```bash
# 로그인 여부 확인
npm whoami

# 로그인 (필요시)
npm login

# 2FA 설정 여부 확인
npm profile get

# 조직 권한 확인 (scoped package인 경우)
npm org ls <org-name>
```

### 5. 패키지 메타데이터 검증

- [ ] `name`: 고유하고 명확한가?
- [ ] `version`: semantic versioning을 따르는가?
- [ ] `description`: 명확한가?
- [ ] `keywords`: 검색 가능한가?
- [ ] `repository`: 올바른 URL인가?
- [ ] `license`: 명시되어 있는가?
- [ ] `engines`: 최소 Node.js 버전이 명시되어 있는가?
- [ ] `bin`: 실행 파일 경로가 올바른가?
- [ ] `files`: 모든 필요한 파일이 포함되어 있는가?

### 6. 실제 배포

```bash
# 최종 배포
cd packages/cli
npm publish --access public

# scoped package인 경우
npm publish --access public
```

## 배포 후 검증

```bash
# npm에서 다운로드 테스트
npx cerebrate@latest --version

# 전역 설치 테스트
npm install -g cerebrate
cerebrate --version
cerebrate --help

# 제거
npm uninstall -g cerebrate
```

## 고급 주제

### 바이너리 크기 최적화

현재 각 바이너리가 약 60MB로 큰 편입니다. 다음 방법으로 최적화할 수 있습니다:

1. **--minify**: 이미 적용 중
2. **--bytecode**: 실험적이지만 효과적
3. **Dead code elimination**: 사용하지 않는 imports 제거
4. **External dependencies**: 큰 의존성을 external로 처리 (제한적)

```bash
# 최대 최적화
bun build --compile --minify --sourcemap --bytecode \
  --target=bun-linux-x64 \
  src/index.ts \
  --outfile bin/cerebrate
```

### UPX 압축 (선택적)

바이너리를 UPX로 압축하면 크기를 30-50% 줄일 수 있습니다:

```bash
# UPX 설치
brew install upx  # macOS
apt install upx   # Linux

# 압축 (최대 압축률)
upx --best --lzma bin/cerebrate-linux-x64

# 압축 해제 (필요시)
upx -d bin/cerebrate-linux-x64
```

**주의:**
- 압축 시 시작 시간이 약간 늘어남
- 일부 안티바이러스가 오탐지할 수 있음
- macOS 코드 사이닝 후에는 압축 불가

### 다중 엔트리포인트 (Worker 지원)

Worker를 사용하는 경우:

```bash
bun build --compile \
  src/index.ts \
  src/worker.ts \
  --outfile bin/cerebrate
```

코드에서:

```typescript
new Worker('./worker.ts');
new Worker(new URL('./worker.ts', import.meta.url));
```

### 에셋 임베딩

파일을 바이너리에 포함:

```typescript
// 파일 임베딩
import icon from './icon.png' with { type: 'file' };
import { file } from 'bun';

const bytes = await file(icon).arrayBuffer();

// SQLite DB 임베딩
import db from './data.db' with { type: 'sqlite', embed: 'true' };
console.log(db.query('SELECT * FROM users').all());

// 임베딩된 파일 목록
import { embeddedFiles } from 'bun';
console.log(embeddedFiles.map(f => f.name));
```

디렉토리 임베딩:

```bash
bun build --compile src/index.ts ./public/**/*.png
```

### N-API 애드온 지원

`.node` 파일 임베딩 (Bun v1.0.23+):

```javascript
const addon = require('./addon.node');
console.log(addon.hello());
```

## 트러블슈팅

### "Illegal instruction" 오류

**원인:** 구형 CPU가 AVX2를 지원하지 않음

**해결:**
```bash
# baseline 빌드 사용
bun build --compile --target=bun-linux-x64-baseline src/index.ts --outfile bin/myapp
```

### 크로스 컴파일 시 네이티브 모듈 오류

**원인:** N-API 애드온이 타겟 플랫폼용으로 빌드되지 않음

**해결:**
- 각 플랫폼에서 직접 빌드
- Docker를 사용한 크로스 컴파일 환경 구축
- GitHub Actions의 matrix build 사용

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
```

### npm publish 시 파일 크기 초과

npm은 패키지당 최대 크기 제한이 없지만, 레지스트리에 따라 제한이 있을 수 있습니다.

**해결:**
- 전략 1 (optional dependencies) 사용
- 바이너리를 별도 CDN에 호스팅
- GitHub Releases에 바이너리 업로드 후 postinstall에서 다운로드

### Windows에서 코드 사이닝

**해결:**
- Windows에서 빌드 시에만 메타데이터 플래그 사용 가능
- 크로스 컴파일된 Windows 바이너리는 Windows에서 사후 서명 필요

## 참고 자료

- [Bun Documentation - Executables](https://bun.sh/docs/bundler/executables)
- [npm Package Best Practices](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [esbuild npm 패키지 구조](https://www.npmjs.com/package/esbuild) (optional dependencies 예시)
- [swc npm 패키지 구조](https://www.npmjs.com/package/@swc/core) (optional dependencies 예시)

## 실전 예시: 유명 프로젝트들

### esbuild
- 메인 패키지: `esbuild`
- 플랫폼 패키지: `@esbuild/darwin-arm64`, `@esbuild/linux-x64`, 등
- optional dependencies로 플랫폼별 패키지 참조

### swc
- 메인 패키지: `@swc/core`
- 플랫폼 패키지: `@swc/core-darwin-arm64`, 등
- optional dependencies 사용

### turbo
- 단일 패키지에 모든 바이너리 포함
- postinstall 스크립트로 적절한 바이너리 선택

## 결론

Bun의 `--compile` 기능은 TypeScript/JavaScript를 단일 실행 파일로 배포할 수 있는 강력한 도구입니다. 크로스 플랫폼 지원을 위해서는:

1. **빌드**: 모든 타겟 플랫폼에 대해 바이너리 생성
2. **런처**: Node.js 스크립트로 플랫폼별 바이너리 선택
3. **배포**: npm에 모든 바이너리 포함하거나 optional dependencies 사용
4. **CI/CD**: GitHub Actions로 자동화

**권장 접근법:** 초기에는 모든 바이너리를 포함하는 단순한 방법(전략 2)으로 시작하고, 사용자가 많아지면 optional dependencies 방식(전략 1)으로 전환하세요.
