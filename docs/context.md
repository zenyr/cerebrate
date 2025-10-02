# Cerebrate 프로젝트 컨텍스트

## 프로젝트 개요

- **목적**: MCP MITM 서버로 AI 클라이언트의 토큰 사용 최적화
- **핵심 아이디어**: 필요한 MCP 툴만 동적으로 활성화하여 LLM 컨텍스트 절약
- **포트**: 3878 (cer-e-br-ate)
- **기술 스택**: Bun, TypeScript, MCP Protocol

## 핵심 아키텍처 결정 (ADR)

### ADR-001: 동적 툴 활성화 메커니즘

**결정**: `enableTools` 툴 + MCP 표준 `notifications/tools/list_changed` 사용

**컨텍스트**:

- 모든 하위 MCP 서버의 툴을 처음부터 노출하면 LLM 컨텍스트 낭비
- 필요한 툴만 선택적으로 노출하는 메커니즘 필요

**결정 내용**:

```typescript
// 초기 상태: 2개 툴만 노출
tools/list → [enableTools, listAvailableScopes]

// LLM이 필요 시 활성화
enableTools({ scope: "filesystem" })
→ notifications/tools/list_changed 발송
→ tools/list → [enableTools, listAvailableScopes, filesystem/read_file, ...]
```

**근거**:

- MCP 표준 `notifications/tools/list_changed` 활용 (표준 준수)
- 초기 툴 목록 최소화로 토큰 절약
- LLM이 필요한 scope만 명시적으로 요청

**트레이드오프**:

- 장점: 토큰 최적화, 명시적 제어
- 단점: 미지원 클라이언트는 재접속 필요 (fallback 제공)

**대안 검토**:

1. Lazy Activation: 모든 툴 노출하되 내부적으로 lazy connect → 토큰 최적화 실패
2. Static Exposure: 사전 설정된 툴만 노출 → 유연성 부족

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

### ADR-003: 타입 네이밍 (Tool → MCPTool)

**결정**: MCP Tool 타입을 `MCPTool`로 명명

**근거**:

- AI SDK와 같은 라이브러리의 `Tool` 타입과 충돌 방지
- MCP 프로토콜의 툴임을 명확히 표현

**적용 위치**: `@cerebrate/core/protocol/types.ts`

## 패키지 구조 (실용적 분할)

```
packages/
  @cerebrate/core/           # 공통 로직 통합
    src/
      protocol/              # MCP 타입 정의, capability 감지
        - types.ts           # MCPTool, InitializeParams 등
        - capability-detector.ts
      registry/              # 툴 관리 로직
        - tool-registry.ts   # ToolRegistry 클래스
        - core-tools.ts      # ENABLE_TOOLS, LIST_AVAILABLE_SCOPES
      auth/                  # 인증 로직
        - code-generator.ts  # ck-{nanoid} 생성/검증

  @cerebrate/client/         # MCP 클라이언트 (하위 서버 연결)
  @cerebrate/server/         # MCP 서버 (AI 앱 대응)
  @cerebrate/tui/            # 터미널 UI (모니터링/제어)
  @cerebrate/config/         # 공유 tsconfig/eslint
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

### Capability Detector

**위치**: `@cerebrate/core/protocol/capability-detector.ts`

**기능**:

```typescript
detectToolListChangeSupport(params: InitializeParams): 'supported' | 'unknown'
```

**판단 기준** (우선순위 순):

1. Known client whitelist: `claude-desktop`, `continue`, `zed`
2. Explicit capability: `capabilities.experimental.toolListChanged === true`
3. Protocol version: `>= 2024-11-05`

**활용**:

- supported → 즉시 `notifications/tools/list_changed` 발송
- unknown → fallback 전략 (재접속 안내 or lazy activation)

### Core Tools

**위치**: `@cerebrate/core/registry/core-tools.ts`

**ENABLE_TOOLS**:

```typescript
{
  name: 'enableTools',
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
  inputSchema: { properties: {} }  // 인자 없음
}
```

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
   - 클라이언트 capability 감지
   - 인증코드 검증 (ck-{nanoid})

2. tools/list 요청
   → [enableTools, listAvailableScopes] 반환
```

### 3. LLM이 툴 활성화

```
1. enableTools({ scope: "filesystem" })
   - ToolRegistry.activateScope("filesystem")

2. 클라이언트 capability에 따라:
   a) supported: notifications/tools/list_changed 발송
   b) unknown: response에 "재접속 필요" 메시지

3. 클라이언트가 tools/list 재요청
   → [enableTools, listAvailableScopes, filesystem/*, ...]
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

## 다음 구현 우선순위

### Phase 1: Core Infrastructure

- [x] ToolRegistry 구현
- [x] Capability detector 구현
- [x] Core tools 정의
- [ ] 인증 (SQLite + 암호화)

### Phase 2: MCP Integration

- [ ] MCP 클라이언트 구현 (하위 서버 연결)
  - stdio 프로토콜 지원
  - tools/list 조회 및 scope 등록
- [ ] MCP 서버 구현 (AI 앱 대응)
  - initialize 핸들러
  - tools/list 핸들러
  - tools/call 핸들러 + 프록시
  - notifications/tools/list_changed 발송

### Phase 3: Tool Handlers

- [ ] enableTools 핸들러
- [ ] listAvailableScopes 핸들러
- [ ] 프록시 로직 (네임스페이스 파싱)

### Phase 4: UI & DX

- [ ] TUI 구현 (활성화된 scope 모니터링)
- [ ] 설정 파일 로더
- [ ] CLI 인터페이스

## 미해결 질문 & 기술 선택

**Q1: SQLite 암호화 라이브러리?**

- 옵션: better-sqlite3 + sqlcipher, bun:sqlite + 직접 암호화
- 고려사항: Bun 네이티브 지원 vs 기능 풍부함

**Q2: MCP 서버 설정 파일 형식?**

- 옵션: JSON, YAML, TypeScript config
- 고려사항: 타입 안정성, 사용자 친화성

**Q3: Fallback 전략 채택?**

- 옵션: 재접속 안내 only vs lazy activation 병행
- 고려사항: UX vs 토큰 최적화 목표

**Q4: TUI 프레임워크?**

- 현재: @opentui/react
- 대안: ink, blessed
- 고려사항: React 친숙도, 기능

## 참고 자료

- MCP Specification: https://spec.modelcontextprotocol.io/
- notifications/tools/list_changed: MCP 표준 알림
- Bun workspaces: https://bun.sh/docs/install/workspaces
