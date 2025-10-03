#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Publishing cerebrate packages..."

# Check if npm token is set
if [[ -z "${NPM_TOKEN:-}" ]]; then
  echo "❌ NPM_TOKEN environment variable is required"
  exit 1
fi

# Configure npm
npm config set //registry.npmjs.org/:_authToken="$NPM_TOKEN"

# Function to publish a package
publish_package() {
  local package_dir="$1"
  local package_name="$2"

  echo ""
  echo "📦 Publishing $package_name..."
  cd "$package_dir"

  # Check if package.json exists
  if [[ ! -f "package.json" ]]; then
    echo "❌ package.json not found in $package_dir"
    return 1
  fi

  # Publish
  npm publish --access public

  echo "✅ $package_name published successfully"
  cd - >/dev/null
}

# Publish packages in order
echo "Publishing core packages..."
publish_package "packages/core" "@cerebrate/core"
publish_package "packages/client" "@cerebrate/client"
publish_package "packages/server" "@cerebrate/server"
publish_package "packages/config" "@cerebrate/config"
publish_package "packages/cli" "@cerebrate/cli"
publish_package "packages/tui" "@cerebrate/tui"

echo ""
echo "Publishing CLI packages..."
publish_package "clis/entry" "cerebrate"

# Publish platform binaries
PLATFORMS=(
  "darwin-arm64"
  "darwin-x64"
  "linux-x64"
  "linux-arm64"
  "windows-x64"
)

for platform in "${PLATFORMS[@]}"; do
  package_name="@cerebrate/cli-${platform}"
  publish_package "clis/${platform}" "$package_name"
done

echo ""
echo "🎉 All packages published successfully!"
echo ""
echo "📋 Next steps:"
echo "  - Update version numbers for next release"
echo "  - Create GitHub release with changelog"
echo "  - Update documentation if needed"