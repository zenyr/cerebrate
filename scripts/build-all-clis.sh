#!/usr/bin/env bash
set -euo pipefail

echo "🔨 Building cerebrate CLI for all platforms..."

# 1. Entry 패키지 빌드
echo ""
echo "📦 Building entry package..."
cd clis/entry
bun run build
cd ../..

echo ""
echo "✅ Entry package build complete!"
ls -lh clis/entry/dist/

# 2. 플랫폼별 바이너리 빌드
echo ""
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
echo "✅ All builds complete!"
echo ""
echo "📊 Build artifacts:"
echo ""
echo "Entry package:"
ls -lh clis/entry/dist/
echo ""
echo "Platform binaries:"
du -sh clis/*/bin/cerebrate* 2>/dev/null | sort || echo "No binaries found yet"
