# Cerebrate 프로젝트 컨텍스트

## 프로젝트 개요

- **목적**: MCP MITM 서버로 AI 클라이언트의 토큰 사용 최적화
- **핵심 아이디어**: 필요한 MCP 툴만 동적으로 활성화하여 LLM 컨텍스트 절약
- **포트**: 3878 (cer-e-br-ate)
- **기술 스택**: Bun, TypeScript, MCP Protocol, Hono

## 핵심 아키텍처 결정 (ADR)

### ADR-001: 동적 툴 활성화 메커니즘

**결정**: `executeTool` + `enableTools` 이중 전략 + 범용 프록시

**컨텍스트**:

- 모든 하위 MCP 서버의 툴을 처음부터 노출하면 LLM 컨텍스트 낭비
- 필요한 툴만 선택적으로 노출하는 메커니즘 필요
- 클라이언트 capability 감지를 통해 동적 툴 업데이트 지원 여부 구분

**결정 내용**:

```typescript
// 초기 상태 (모든 클라이언트 동일)
tools/list → [executeTool, listAvailableScopes]

// initialize 완료 후
→ notifications/tools/list_changed 발송
→ tools/list → [enableTools, listAvailableScopes]

// 실질적으로 제공되는 툴: [executeTool, enableTools, listAvailableScopes, {동적-툴}]

// 미지원 클라이언트 (동적 업데이트 무시): executeTool, listAvailableScopes만 인지
→ listAvailableScopes 호출하여 scope 정보 획득
→ executeTool({ scope: "filesystem", tool: "read_file", arguments: {...} }) 호출
→ Cerebrate가 파싱하여 프록시

// 지원 클라이언트 (동적 업데이트 수신): enableTools, listAvailableScopes, 동적-툴 인지
→ enableTools({ scope: "filesystem" })
→ notifications/tools/list_changed 발송
→ tools/list → [enableTools, listAvailableScopes, filesystem/read_file, ...]
→ LLM이 filesystem/read_file 직접 호출 (타입 안전)
```

**근거**:

- Capability detection: list-changed 발송 후 툴 목록 변경으로 지원 여부 구분
- 이중 워크플로우: 미지원 클라이언트는 executeTool로 간단 호출, 지원 클라이언트는 enableTools로 최적화
- 컨텍스트 절약: 초기 2개 툴만 노출, 필요 시 확장
- 범용 호환: 모든 클라이언트 지원

**트레이드오프**:

- 장점: 명확한 capability detection, 최적화된 워크플로우
- 단점: 초기 list-changed 발송으로 약간의 복잡도 증가

### ADR-002: 네임스페이싱 전략

**결정**: `{scope}/{toolName}` 형식 사용

**예시**:

- `filesystem/read_file`
- `github/create_issue`
- `brave-search/search`

**근거**:

- 툴 출처 명확화 (어떤 MCP 서버에서 왔는지)
- 이름 충돌 방지 (여러 서버가 같은 툴명 가질 수 있음)
- scope 단위 활성화/비활성화 용이

### ADR-003: 타입 네이밍 (SDK 표준 사용) ✅ **수정됨**

**결정**: `@modelcontextprotocol/sdk`의 `Tool` 타입을 그대로 사용

**근거**:

- MCP 표준 타입명 준수
- SDK 문서와 호환성 유지
- 불필요한 alias 제거

**적용 위치**: `@cerebrate/core/protocol/types.ts`에서 reexport

### ADR-004: HTTP Protocol Support ✅ **구현 완료**

**결정**: Hono 기반 HTTP 프로토콜 지원 (Streamable HTTP + SSE)

**컨텍스트**:

- 현재 stdio 프로토콜만 지원하여 로컬 환경에 제한됨
- HTTP 기반 프로토콜로 확장하여 원격 접속 가능성 필요
- 보안 강화를 위해 key 기반 인증 요구

**결정 내용**:

- stdio 외에 Hono 기반 HTTP 프로토콜 지원
- 엔드포인트:
  - `/mcp`: Streamable HTTP 엔드포인트 (현재 placeholder, 추후 구현)
  - `/sse`: SSE (Server-Sent Events) 엔드포인트
- `createHonoApp()` 메서드로 외부 Hono 앱 생성 지원
- Bun.serve로 HTTP 서버 실행

**근거**:

- HTTP 기반으로 원격 MCP 클라이언트 지원 가능
- SSE로 실시간 통신 지원
- Hono의 경량성과 성능으로 효율적 구현
- `createHonoApp()`으로 외부 통합 용이

**트레이드오프**:

- 장점: 확장성 증가, 원격 접속 가능, 실시간 통신 지원
- 단점: 추가 복잡도 및 의존성 (Hono)

## 패키지 구조 (실용적 분할)

```
packages/
  @cerebrate/cli/            # ✨ CLI 진입점 (새로 추가)
    src/
      index.ts               # cerebrate 명령어 구현
    package.json             # bin: "cerebrate": "src/index.ts"

  @cerebrate/core/           # 공통 로직 통합
    src/
      protocol/              # MCP 타입 정의, capability 감지
        - types.ts           # MCPTool, InitializeParams 등
        - capability-detector.ts
      registry/              # 툴 관리 로직
        - tool-registry.ts   # ToolRegistry 클래스
        - core-tools.ts      # ENABLE_TOOLS, LIST_AVAILABLE_SCOPES, EXECUTE_TOOL
      auth/                  # 인증 로직
        - code-generator.ts  # ck-{nanoid} 생성/검증

  @cerebrate/client/         # MCP 클라이언트 (하위 서버 연결)
  @cerebrate/server/         # MCP 서버 (AI 앱 대응, HTTP/SSE 지원)
    - /mcp: Streamable HTTP 엔드포인트 (placeholder)
    - /sse: SSE 엔드포인트
    - createHonoApp(): 외부 Hono 앱 생성

  @cerebrate/tui/            # 터미널 UI (모니터링/제어)
  @cerebrate/config/         # 공유 tsconfig/eslint (ESLint .js로 변경)
```

**설계 원칙**:

- core에 비즈니스 로직 집중 (protocol, registry, auth)
- client/server 분리로 각각 재사용 가능
- tui는 독립적 모니터링 도구
- config로 프로젝트 전체 일관성 유지

## 핵심 컴포넌트 API

### ToolRegistry

**위치**: `@cerebrate/core/registry/tool-registry.ts`

**주요 메서드**:

```typescript
class ToolRegistry {
  registerScope(scope: ScopeInfo): void;
  activateScope(scopeName: string): boolean;
  deactivateScope(scopeName: string): void;
  getActiveScopeNames(): string[];
  getAvailableScopeNames(): string[];
  getExposedTools(): MCPTool[]; // 네임스페이스 적용된 툴 목록
  getScopeByToolName(toolName: ToolName): ScopeInfo | undefined;
}
```

**책임**:

- scope (MCP 서버) 등록 관리
- 활성화/비활성화 상태 추적
- 활성화된 scope의 툴 목록 제공 (자동 네임스페이싱)
- 툴 이름으로 원본 scope 조회

### Tool Name Parsing

**위치**: 향후 `@cerebrate/server`에서 구현

**기능**:

```typescript
parseToolName(toolName: string): { scope: string; tool: string } | null
// "filesystem/read_file" → { scope: "filesystem", tool: "read_file" }
```

**활용**:

- `tools/call` 요청 받을 때 네임스페이스 파싱
- 활성화되지 않은 scope의 툴 호출 시 에러 반환
- 해당 scope의 하위 MCP 서버로 프록시

### Core Tools

**위치**: `@cerebrate/core/registry/core-tools.ts`

**EXECUTE_TOOL** (새로 추가):

```typescript
{
  name: 'executeTool',
  description: 'Execute a tool by name from any available scope. Use this to run tools directly without activating scopes.',
  inputSchema: {
    properties: {
      toolName: { type: 'string' },    // {scope}/{tool} 형식 (예: "filesystem/read_file")
      arguments: { type: 'object' }    // 툴 인자
    }
  }
}
```

**ENABLE_TOOLS**:

```typescript
{
  name: 'enableTools',
  description: 'Activate MCP server scope. Tools will be available as {scope}/{tool}.',
  inputSchema: {
    properties: {
      scope: { type: 'string' }  // 활성화할 MCP 서버 이름
    }
  }
}
```

**LIST_AVAILABLE_SCOPES**:

```typescript
{
  name: 'listAvailableScopes',
  description: 'List all available MCP server scopes and their tools.',
  inputSchema: { properties: {} }  // 인자 없음
}
```

**Resources 지원** (TypeScript MCP SDK 활용):
- `resources/list`: `cerebrate://scopes` URI 반환 (사용 가능한 scope 목록)
- `resources/read`:
  - `cerebrate://scopes/{scope}`: 특정 scope의 툴 목록 및 기본 정보
  - `cerebrate://scopes/{scope}/{tool}`: 특정 툴의 세부 사용법 및 설명
- **구현 힌트**: `ResourceTemplate` 클래스로 URI 템플릿 정의 (예: `new ResourceTemplate("cerebrate://scopes/{scope}", { list: undefined })`), `server.registerResource`로 등록, 핸들러에서 `params.scope` 추출하여 동적 콘텐츠 해결.

## 실행 흐름 (Lifecycle)

### 1. Cerebrate 시작

```
1. 설정 파일 로드 (등록된 MCP 서버 목록)
2. 각 MCP 서버에 연결 (MCP 클라이언트로)
3. 각 서버의 tools/list 조회 → ToolRegistry에 scope 등록
4. MCP 서버 시작 (포트 3878)
```

### 2. AI 클라이언트 접속

```
1. initialize 핸드셰이크
   - 인증코드 검증 (ck-{nanoid})

2. tools/list 요청
   → [executeTool, listAvailableScopes]

3. resources/list 요청 (선택적)
   → `cerebrate://scopes` URI 반환

4. resources/read 요청 (선택적)
   → `cerebrate://scopes/{scope}` 또는 `cerebrate://scopes/{scope}/{tool}`로 세부 정보 읽기

5. initialize 완료 후
   → notifications/tools/list_changed 발송
   → tools/list → [enableTools, listAvailableScopes]
```

### 3. LLM이 툴 실행

```
1a. 미지원 클라이언트 (동적 업데이트 무시)
   - listAvailableScopes 호출하여 scope 정보 획득
   - executeTool({ scope: "filesystem", tool: "read_file", arguments: {...} }) 호출
   → Cerebrate가 파싱하여 프록시

1b. 지원 클라이언트 (동적 업데이트 수신)
   - enableTools({ scope: "filesystem" })
   → ToolRegistry.activateScope("filesystem")
   → notifications/tools/list_changed 발송
   → tools/list → [enableTools, listAvailableScopes, filesystem/read_file, ...]
   - LLM이 filesystem/read_file 직접 호출 (타입 안전)
```

### 4. LLM이 실제 툴 실행

```
1. tools/call { name: "filesystem/read_file", arguments: {...} }
2. Cerebrate가 파싱:
   - scope: "filesystem"
   - toolName: "read_file"
3. 해당 MCP 서버에 프록시 호출
4. 결과 반환
```

## 코딩 컨벤션

**TypeScript 규칙**:

- Strict mode 활성화
- `any`, `unknown`, `@ts-ignore` 금지 (util/test만 명시적 주석과 함께 허용)
- 테스트에서는 `@ts-expect-error` 사용 가능 (타입 에러 케이스 검증용)
- 추론 가능한 타입은 생략

**Import 규칙**:

- ✅ 명시적 확장자 없음: `import { foo } from './bar'`
- ❌ `.ts` 확장자 금지: `import { foo } from './bar.ts'`
- ✅ Workspace paths: `import { MCPTool } from '@cerebrate/core/protocol'`
- ❌ 상대 경로 최소화 (테스트 제외)

**스타일**:

- 함수형 스타일 선호
- `const foo = () => {}` (arrow function)
- Plain objects > classes (필요시 class 사용 가능)
- 주석 최소화 (self-documenting code)

**테스트 규칙**:

- bun:test 전용 사용 (jest/vitest 금지)
- 테스트 파일은 co-location (예: `tool-registry.test.ts`)
- 커버리지 목표: 적정 수준 (96%+ 권장, 100% 필수 아님)

## 다음 구현 우선순위

### Phase 1: Core Infrastructure ✅ **완료**

- [x] ToolRegistry 구현
- [x] Core tools 정의 (enableTools, listAvailableScopes)
- [x] Registry 테스트 작성 (커버리지 93.75%)
- [x] 인증 시스템 구현
  - [x] nanoid 기반 코드 생성 (`ck-{21chars}`)
  - [x] AES-256-GCM 레코드 레벨 암호화
  - [x] SQLite 저장소 (bun:sqlite)
  - [x] 테스트 작성 (커버리지 100%)
  - [x] 전체 커버리지: 99.11% funcs, 100% lines

### Phase 2: MCP Integration ✅ **완료**

- [x] MCP 클라이언트 구현 (하위 서버 연결)
  - stdio 프로토콜 지원
  - tools/list 조회 및 scope 등록
- [x] MCP 서버 구현 (AI 앱 대응)
  - initialize 핸들러
  - tools/list 핸들러
  - tools/call 핸들러 + 프록시
  - notifications/tools/list_changed 발송

### Phase 3: Tool Handlers ✅ **완료**

- [x] enableTools 핸들러
- [x] listAvailableScopes 핸들러
- [x] 프록시 로직 (네임스페이스 파싱)

### Phase 4: UI & DX

- [x] Hono 기반 HTTP 프로토콜 지원 추가 (/mcp, /sse 엔드포인트)
- [ ] Streamable HTTP 구현 (/mcp 엔드포인트 완성)
- [ ] .env에서 HTTP key 관리 및 검증 로직 구현 (NODE_ENV=test 제외 필수)
- [ ] TUI 구현 (활성화된 scope 모니터링)
- [x] CLI 인터페이스 구현 (@cerebrate/cli 패키지)
- [x] 설정 파일 로더 (JSON 형식, --config 옵션 지원)
- [ ] CLI 테스트에서 loadConfig mocking 구현 (현재 skip)

## 미해결 질문 & 기술 선택

**Q1: SQLite 암호화 라이브러리?** ✅ **해결**

- **결정**: Bun 네이티브 `bun:sqlite` + 레코드 레벨 암호화
- **근거**:
  - `bun:sqlite`는 SQLCipher 미지원 (전체 DB 암호화 불가)
  - 민감 데이터가 인증 코드뿐이므로 레코드 레벨 암호화로 충분
  - 인증 코드를 AES-256-GCM으로 암호화하여 저장/조회
  - 전체 파일 암호화 대비 성능 우수 (시작/종료 오버헤드 없음)
  - 키 관리: 환경변수 `CEREBRATE_ENCRYPTION_KEY` (32 bytes hex)

**Q2: MCP 서버 설정 파일 형식?** ✅ **해결**

- **결정**: JSON 형식
- **근거**:
  - Bun 네이티브 지원으로 별도 파서 불필요
  - 타입 안정성: Zod 스키마로 검증
  - 사용자 친화성: 간단한 구조로 설정 가능
  - CLI --config 옵션으로 로드

**Q3: Fallback 전략 채택?** ✅ **해결**

- 결정: 단일 전략 (capability detection 제거)
- 근거: 단순함, 모든 클라이언트 자동 적응

**Q4: TUI 프레임워크?**

- 현재: @opentui/react
- 대안: ink, blessed
- 고려사항: React 친숙도, 기능

**Q5: Hono 핸들러와 MCP SDK 스펙 싱크를 위한 패키지?** ✅ **해결**

- **결정**: `fetch-to-node` 패키지 사용
- **근거**:
  - Hono는 web fetch API를 사용하지만 MCP SDK는 Node.js 환경에서 작동
  - `fetch-to-node`는 Node.js fetch와 web fetch 간 변환을 제공하여 호환성 확보
  - MCP helper integration에서 Hono 핸들러와 MCP SDK 스펙을 싱크하는 데 사용됨 (힌트: toRequest 메소드로 Request 객체 생성 및 변환 가능)
  - 간단한 의존성 추가로 HTTP transport 지원 시 유용

## 참고 자료

- MCP Specification: https://spec.modelcontextprotocol.io/
- notifications/tools/list_changed: MCP 표준 알림
- Bun workspaces: https://bun.sh/docs/install/workspaces
