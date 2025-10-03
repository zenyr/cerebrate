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
clis/
  entry/                   # cerebrate (메인 CLI 진입점, public)
    - dist/index.js        # Wrapper (Bun 감지 + 실행 경로 선택)
    - dist/native.js       # @cerebrate/cli 번들 (Bun 직접 실행)
  darwin-arm64/            # @cerebrate/cli-darwin-arm64 (바이너리, public)
  darwin-x64/              # @cerebrate/cli-darwin-x64 (바이너리, public)
  linux-x64/               # @cerebrate/cli-linux-x64 (바이너리, public)
  linux-arm64/             # @cerebrate/cli-linux-arm64 (바이너리, public)
  windows-x64/             # @cerebrate/cli-windows-x64 (바이너리, public)

packages/
  cli/                     # @cerebrate/cli (소스코드, public)
    - server, http-server, tui 명령어 지원
    - Bun 사용자를 위한 소스 배포
  core/                    # @cerebrate/core (공통 로직)
    - protocol/            # MCP 타입, capability 감지
    - registry/            # ToolRegistry, enableTools 로직
    - auth/                # 인증코드 생성/검증
  client/                  # @cerebrate/client (MCP 클라이언트)
  server/                  # @cerebrate/server (MCP 서버, HTTP/SSE 지원)
    - /mcp: Streamable HTTP 엔드포인트 (예정)
    - /sse: SSE 엔드포인트
  tui/                     # @cerebrate/tui (터미널 UI)
  config/                  # @cerebrate/config (공통 tsconfig/eslint)
```

**CLI Entry 전략**: Bun-first with Compiled Fallback
- 환경변수 `BUN=1`: Bun 네이티브 실행 (dist/native.js, 1-2MB)
- 기본값: 플랫폼별 컴파일된 바이너리 (60MB)
- 상세: [docs/cli-entry.md](./cli-entry.md)

#### 5. **기술적 세부사항**

- **프로토콜 지원**:
  - stdio: 기본 MCP 프로토콜
  - HTTP: Hono 기반 엔드포인트 지원
    - `/mcp`: Streamable HTTP 엔드포인트 (예정)
    - `/sse`: SSE (Server-Sent Events) 엔드포인트
- **CLI 진입점**: `cerebrate` 패키지로 `cerebrate server`, `cerebrate http-server`, `cerebrate tui` 명령어 지원
- **설정 파일**: JSON5 형식으로 MCP 서버 설정 로드 (--config 옵션, 기본값: `$HOME/.config/cerebrate/settings.json5`)
- **타입 안정성**: MCP Tool은 `@modelcontextprotocol/sdk`의 `Tool` 타입 직접 사용
- **클라이언트 감지**: `initialize` 핸드셰이크에서 `clientInfo.name`과 `protocolVersion`으로 동적 툴 업데이트 지원 여부 판단
- **네임스페이싱**: 모든 활성화된 툴은 `{scope}/{toolName}` 형태로 제공
- **테스트**: bun:test 전용 사용 (jest/vitest 금지), co-location 전략, 96%+ 커버리지 목표

#### 6. **개발 로드맵**

현재 완료된 기능과 향후 계획:

**✅ Phase 1-3: Core Infrastructure (완료)**
- ToolRegistry, 인증 시스템, MCP Integration 완료
- 커버리지: 99%+ (funcs), 100% (lines)

**✅ Phase 5: CLI Distribution (완료)**
- Bun-first 배포 전략 구현
- 5개 플랫폼 크로스 컴파일 완료
- 빌드 자동화 스크립트

**🔄 Phase 4: UI & DX (진행 중)**
- [x] Hono HTTP 프로토콜 기본 지원
- [x] CLI 인터페이스 및 설정 로더
- [ ] Streamable HTTP 완성 (`/mcp` 엔드포인트)
- [ ] HTTP 인증 키 관리 (.env)
- [ ] TUI 구현 (scope 모니터링)

**📋 Phase 6: 배포 및 프로덕션 준비**

*배포 자동화*
- `scripts/publish-all.sh` 순차 배포 스크립트
- GitHub Actions CI/CD 파이프라인
  - 플랫폼별 빌드 매트릭스
  - 자동 릴리즈 태깅 (semantic versioning)
  - npm 배포 자동화

*npm 패키지 배포*
- `cerebrate` (메인, optionalDependencies 포함)
- `@cerebrate/cli` (소스 패키지, Bun 사용자용)
- `@cerebrate/cli-{platform}` (5개 바이너리)
- 배포 후 설치 검증 (E2E 테스트)

*프로덕션 강화*
- 환경변수 검증 (CEREBRATE_ENCRYPTION_KEY 필수화)
- 구조화된 에러 핸들링 (error codes)
- 로깅 시스템 (`--verbose`, `--quiet` 옵션)

**📋 Phase 7: 보안 강화**

*HTTP 인증 완성*
- `.env`에서 `CEREBRATE_HTTP_KEY` 관리
- 인증 미들웨어 구현 (Authorization: Bearer)
- Rate limiting (IP 기반, 분당 요청 수 제한)
- NODE_ENV=test 환경에서는 인증 스킵

*인증 코드 CLI 관리*
```bash
cerebrate auth list          # 등록된 클라이언트 목록
cerebrate auth generate      # 새 인증 코드 생성
cerebrate auth revoke <code> # 인증 코드 폐기
cerebrate auth info <code>   # 코드 상세 정보 (생성일, 마지막 사용)
```

*감사 로그*
- 툴 실행 이력 (timestamp, scope, tool, args, result)
- 인증 실패 로그 (IP, timestamp, reason)
- scope 활성화/비활성화 이력
- SQLite 기반 로그 저장소 (선택적 retention 정책)

**📋 Phase 8: 모니터링 및 디버깅**

*TUI 완성 (@opentui/react)*
- 실시간 대시보드
  - 활성화된 scope 목록
  - 연결된 클라이언트 (clientInfo.name, 접속 시간)
  - 최근 툴 호출 로그 (실시간 스트림)
- 통계 페이지
  - 툴별 호출 빈도 (Top 10)
  - 평균 실행 시간 (scope별)
  - 성공/실패율
- 키보드 단축키 (q: 종료, r: 새로고침, /: 검색)

*디버그 모드*
```bash
cerebrate server --debug          # 상세 로그 출력
cerebrate server --dump-protocol  # MCP 메시지 덤프 (JSON)
cerebrate server --profile        # 성능 프로파일링
```

**📋 Phase 9: Streamable HTTP 완성**

*`/mcp` 엔드포인트 구현*
- Streamable HTTP 프로토콜 완전 구현
- 청크 기반 스트리밍 응답 (Transfer-Encoding: chunked)
- 타임아웃 처리 (idle timeout, request timeout)
- 에러 복구 (reconnection logic)

*HTTP Transport 테스트*
- Integration test suite
- MCP Inspector 호환성 검증
- Claude Desktop, Continue 등 주요 클라이언트 테스트
- 네트워크 지연/실패 시뮬레이션

**📋 Phase 10: 확장 기능**

*스마트 툴 추천*
- LLM 대화 컨텍스트 분석 (키워드 추출)
- 자동 scope 활성화 제안
  - "파일을 읽고 싶어" → filesystem scope 제안
  - "GitHub 이슈 생성" → github scope 제안
- 사용 패턴 학습 (자주 함께 사용되는 scope 그룹화)

*플러그인 시스템*
```typescript
// 커스텀 툴 등록 API
cerebrate.registerPlugin({
  name: 'my-custom-tool',
  scope: 'custom',
  tools: [...],
  handler: async (tool, args) => { ... }
});
```
- 외부 플러그인 로드 (`~/.config/cerebrate/plugins/`)
- 플러그인 마켓플레이스 (장기 목표)

*API Reverse Proxy (MITM)*
- LLM API 호출 인터셉트 엔드포인트
- 매직워드 추출 (정규식/LLM 기반)
- 동적 툴 주입 (대화 중 실시간 툴 추가)
- 사용 예시:
  ```
  User: "날씨 확인해줘"
  → Cerebrate가 "날씨" 감지
  → weather scope 자동 활성화
  → LLM에게 weather/get_current 툴 제공
  ```

**📋 Phase 11: 사용자 경험 개선**

*CLI UX*
```bash
cerebrate init              # Interactive 설정 마법사
cerebrate doctor            # 환경 검증 (Bun 버전, 설정 파일, 권한)
cerebrate completion bash   # 자동 완성 스크립트 출력
cerebrate config validate   # 설정 파일 검증
cerebrate config edit       # 기본 에디터로 설정 파일 열기
```

*문서화*
- 사용자 가이드
  - Quick Start (5분 안에 시작하기)
  - 설정 파일 레퍼런스
  - 트러블슈팅 FAQ
- API 레퍼런스 (TypeDoc 자동 생성)
- 예제 설정 모음
  - filesystem + github 조합
  - brave-search + filesystem
  - 커스텀 MCP 서버 통합
- 비디오 튜토리얼 (선택)

*커뮤니티*
- CONTRIBUTING.md (개발 환경 설정, PR 가이드)
- Issue/PR 템플릿
- Code of Conduct
- 예제 프로젝트 showcase
- Discord/GitHub Discussions

**📋 Phase 12: 성능 최적화**

*캐싱*
- 툴 메타데이터 인메모리 캐싱 (TTL 기반)
- 설정 파일 hot reload (파일 변경 감지)
- MCP 클라이언트 커넥션 풀
  - 재사용 가능한 stdio 프로세스 풀
  - Lazy initialization (필요 시 연결)

*벤치마크*
- 툴 실행 성능 측정 (p50, p95, p99)
- 메모리 사용량 프로파일링
- 컴파일 바이너리 크기 최적화
  - Tree-shaking 최적화
  - 불필요한 의존성 제거
  - 목표: 현재 60-115MB → 40-80MB

*성능 목표*
- 툴 프록시 오버헤드: <10ms (p95)
- 메모리 사용: <100MB (idle), <500MB (active)
- 시작 시간: <1초 (컴파일 바이너리), <100ms (Bun)

---

#### 7. **우선순위**

**즉시 착수 (현재 필요)**
1. Phase 4 미완료 (Streamable HTTP, HTTP 인증)
2. Phase 6 배포 (실제 사용자 확보)

**단기 (1-2주)**
3. Phase 7 보안 (프로덕션 필수)
4. Phase 8 모니터링 (TUI, 디버깅)

**중기 (1-2개월)**
5. Phase 9 HTTP 완성
6. Phase 11 UX 개선

**장기 (필요 시)**
7. Phase 10 확장 기능
8. Phase 12 최적화
