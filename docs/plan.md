### Cerebrate 프로젝트 계획 요약

"Cerebrate" 프로젝트는 MCP(MCP: Model Context Protocol, AI 모델과 도구 간 통신 프로토콜) 클라이언트와 서버를 겸비한 MITM(Man-in-the-Middle) 서버로 설계되었습니다. 주요 목표는 다른 MCP 서버의 기능을 지능적으로 부분 노출하여 AI 클라이언트의 토큰 사용을 최적화하는 것입니다. 아래에 핵심 내용을 효율적으로 정리하였습니다.

#### 1. **기본 개념 및 아키텍처**

- **역할**: Cerebrate는 AI 클라이언트 앱과 다른 MCP 서버 사이에서 중간자 역할을 하며, 필요에 따라 MCP 기능을 제한적으로 제공합니다.
- **포트**: 기본 포트는 3878 (단어 "cer-e-br-ate"에서 유래). 환경변수 `PORT` 또는 명령줄 인자로 변경 가능.
- **흐름**:
  ```
  (AI 클라이언트 앱) --(MCP 프로토콜)--> (Cerebrate MCP 서버)
       --> (Cerebrate MCP 클라이언트) --(MCP 프로토콜)--> (기타 MCP 서버)
  ```

#### 2. **라이프사이클 및 툴 활성화 메커니즘**

- **실행 단계**:
  1. Cerebrate 실행 시, 등록된 MCP 서버에 사전 접속하여 각 서버의 기능(툴, 리소스 등)을 파악.
  2. AI 앱이 Cerebrate에 MCP 클라이언트로 접속.
  3. Cerebrate는 초기에 `executeTool`과 `listAvailableScopes` 두 툴만 노출.
  4. resources/list로 `cerebrate://scopes` URI 제공, resources/read로 `cerebrate://scopes/{scope}` 또는 `cerebrate://scopes/{scope}/{tool}`로 세부 정보 읽기 (tool 호출 대안).
  5. initialize 완료 후 `notifications/tools/list_changed` 발송 → `enableTools`와 `listAvailableScopes`로 변경.
  6. LLM의 툴 사용:
     - 미지원 클라이언트: `executeTool({ scope: "filesystem", tool: "read_file", arguments: {...} })` 호출 → Cerebrate가 프록시
     - 지원 클라이언트: `enableTools({ scope: "filesystem" })` 호출 → 동적 툴 추가 → `filesystem/read_file` 직접 호출
  7. 활성화된 툴은 `{scope}/{toolName}` 형태로 네임스페이스 적용 (예: `filesystem/read_file`)
  8. LLM이 실제 툴 실행 요청 시, Cerebrate가 프록시로 하위 MCP 서버에 호출하고 결과 반환.
- **전제 조건**: Cerebrate를 로컬 MCP 서버로 미리 실행해두어야 함.

**툴 활성화 전략**:

- **이중 전략** (capability detection 기반):
  - 초기: `[executeTool, listAvailableScopes]`
  - initialize 완료 후: `notifications/tools/list_changed` 발송 → `[enableTools, listAvailableScopes]`
  - 실질적 제공: `[executeTool, enableTools, listAvailableScopes, {동적-툴}]`
  - 미지원 클라이언트: `executeTool(scope, tool, arguments)`로 간단 호출
  - 지원 클라이언트: `enableTools(scope)` 후 동적 툴 직접 호출 (타입 안전)

#### 3. **보안 및 인증**

- Cerebrate에 접속하려는 MCP 클라이언트 앱은 암호화된 SQLite 데이터베이스에 저장된 인증코드(`ck-{nanoid}` 형태)를 사용해야 합니다. 코드가 없으면 자동 생성하여 저장.

#### 4. **패키지 구조 (실용적 분할)**

```
packages/
  @cerebrate/cli/          # ✨ CLI 진입점 (cerebrate 명령어)
    - server, http-server, tui 명령어 지원
  @cerebrate/core/         # 공통 로직
    - protocol/            # MCP 타입, capability 감지
    - registry/            # ToolRegistry, enableTools 로직
    - auth/                # 인증코드 생성/검증
  @cerebrate/client/       # MCP 클라이언트 (하위 서버 연결)
  @cerebrate/server/       # MCP 서버 (AI 앱 대응, HTTP/SSE 지원)
    - /mcp: Streamable HTTP 엔드포인트 (예정)
    - /sse: SSE 엔드포인트
  @cerebrate/tui/          # 터미널 UI (툴 모니터링/제어)
  @cerebrate/config/       # 공통 tsconfig/eslint (ESLint .js로 변경)
```

#### 5. **기술적 세부사항**

- **프로토콜 지원**:
  - stdio: 기본 MCP 프로토콜
  - HTTP: Hono 기반 엔드포인트 지원
    - `/mcp`: Streamable HTTP 엔드포인트 (예정)
    - `/sse`: SSE (Server-Sent Events) 엔드포인트
- **CLI 진입점**: `@cerebrate/cli` 패키지로 `cerebrate server`, `cerebrate http-server` 명령어 지원
- **설정 파일**: JSON 형식으로 MCP 서버 설정 로드 (--config 옵션)
- **타입 안정성**: MCP Tool은 `@modelcontextprotocol/sdk`의 `Tool` 타입 직접 사용
- **클라이언트 감지**: `initialize` 핸드셰이크에서 `clientInfo.name`과 `protocolVersion`으로 동적 툴 업데이트 지원 여부 판단
- **네임스페이싱**: 모든 활성화된 툴은 `{scope}/{toolName}` 형태로 제공
- **테스트**: bun:test 전용 사용 (jest/vitest 금지), co-location 전략, 96%+ 커버리지 목표

#### 6. **향후 확장 아이디어**

- API 호출 Reverse Proxy(MITM) 엔드포인트를 추가하여, 매직워드(특정 키워드)를 추출하고 관련 툴을 동적으로 추가하는 기능 고려.
