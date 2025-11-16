#!/usr/bin/env bash
# Effect.ts Refactoring - GitHub Issue Creation Script
# Usage: GITHUB_TOKEN=your_token ./docs/create-issues.sh

set -e

REPO_OWNER="zenyr"
REPO_NAME="cerebrate"
GITHUB_API="https://api.github.com"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN environment variable required"
  echo "Usage: GITHUB_TOKEN=your_token $0"
  exit 1
fi

# Create main tracking issue
create_main_issue() {
  cat <<'EOF' | curl -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "$GITHUB_API/repos/$REPO_OWNER/$REPO_NAME/issues" \
    -d @-
{
  "title": "Effect.ts Refactoring - Complete Migration Plan",
  "body": "## Description\n\nComplete refactoring of Cerebrate codebase to leverage Effect.ts for improved type safety, error handling, resource management, and testability.\n\n**Documentation:** See [docs/effect-refactoring-plan.md](../docs/effect-refactoring-plan.md) for detailed plan.\n\n**Effect Submodule:** \`external/effect\` (commit: f445b87)\n\n## Current Pain Points\n\n- **Resource Management:** Manual cleanup, lifecycle leaks, no structured shutdown\n- **Error Handling:** 25+ generic errors, silent failures, no recovery strategies\n- **Async Complexity:** 101 async functions, manual timeouts, no cancellation\n- **Testing:** Manual mocks, complex setup/teardown\n- **Validation:** Mixed runtime validation, no compile-time guarantees\n\n## Timeline\n\n7-8 weeks, 212 hours estimated effort\n\n## Task Breakdown\n\n### Phase 1: Core Infrastructure (Week 1-2, 16h)\n- [ ] Setup Effect dependencies and workspace configuration\n- [ ] Define typed error hierarchy and service interfaces\n- [ ] Create base Layer infrastructure\n\n### Phase 2: Auth Store Refactoring (Week 2-3, 36h)\n- [ ] Refactor AuthStore with @effect/sql-sqlite-bun\n- [ ] Convert insert/verify/list/delete to Effect pipelines\n- [ ] Add resource management via Layer.scoped\n- [ ] Implement typed errors (InvalidAuthCodeError, DecryptionError)\n- [ ] Refactor CryptoService with Config for env vars\n- [ ] Update auth tests to Effect patterns\n\n### Phase 3: MCP Client Refactoring (Week 3-4, 20h)\n- [ ] Migrate MCPClient to @effect/rpc\n- [ ] Add retry logic via Schedule\n- [ ] Implement connection state tracking\n- [ ] Add graceful disconnection with acquireRelease\n- [ ] Update client tests\n\n### Phase 4: MCP Server Refactoring (Week 4-5, 48h)\n- [ ] Replace client Map with Ref for state management\n- [ ] Implement concurrent scope loading via Effect.forEach\n- [ ] Refactor request handlers with structured error handling\n- [ ] Add graceful shutdown support\n- [ ] Migrate stdio transport to @effect/platform Streams\n- [ ] Migrate HTTP/SSE transport to @effect/platform\n- [ ] Add structured logging via Effect.log\n- [ ] Update server tests\n\n### Phase 5: CLI & Config (Week 5-6, 40h)\n- [ ] Refactor config loading with Config provider\n- [ ] Remove silent error swallowing\n- [ ] Add schema migration support\n- [ ] Migrate CLI to @effect/cli\n- [ ] Remove manual DI from CLI\n- [ ] Add structured logging to CLI\n- [ ] Update CLI tests\n\n### Phase 6: Test Infrastructure (Week 6-7, 20h)\n- [ ] Integrate @effect/vitest\n- [ ] Replace manual cleanup with Effect.scoped\n- [ ] Create test Layers for DI\n- [ ] Migrate all 15 test files to Effect patterns\n\n### Phase 7: Integration & Migration (Week 7-8, 32h)\n- [ ] Remove all manual mocks from tests\n- [ ] Verify test isolation\n- [ ] Update README with Effect usage\n- [ ] Add architecture decision records\n- [ ] Create migration guide\n- [ ] Benchmark performance before/after\n- [ ] Verify startup time unchanged\n- [ ] Run memory leak testing\n\n## Success Metrics\n\n- [ ] Zero \`any\`, \`unknown\`, \`@ts-ignore\`\n- [ ] Zero \`as\`, \`!\` assertions\n- [ ] All async ops cancellable\n- [ ] No manual resource cleanup\n- [ ] 100% test coverage maintained\n- [ ] Startup time ≤ current baseline\n- [ ] All errors typed and recoverable\n\n## Affected Packages\n\n- \`@cerebrate/core\` - Auth, registry, protocols\n- \`@cerebrate/server\` - MCP server, transports\n- \`@cerebrate/client\` - MCP client\n- \`@cerebrate/cli\` - CLI commands, config\n- \`@cerebrate/test-utils\` - Test infrastructure\n\n## Dependencies\n\n- Phase 1 blocks all others\n- Phase 2 (Auth) independent\n- Phase 3 (Client) required for Phase 4\n- Phase 5 (CLI) depends on Phase 1\n- Phase 6 (Tests) depends on Phases 2-4\n- Phase 7 (Integration) depends on all\n\n## References\n\n- Effect Documentation: https://effect.website\n- Effect Submodule: \`external/effect/\`\n- Detailed Plan: [docs/effect-refactoring-plan.md](../docs/effect-refactoring-plan.md)",
  "labels": ["enhancement", "refactoring", "epic"]
}
EOF
}

echo "Creating main tracking issue..."
create_main_issue

echo "Done! Check your repository for the new issue."
echo ""
echo "To create individual task issues, edit this script and add more create_issue calls."
