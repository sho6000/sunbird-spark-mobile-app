#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$ROOT_DIR/config"
PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); }
fail() { FAIL=$((FAIL + 1)); echo "  [FAIL] $1"; }

echo ""
echo "============================================"
echo "  Mobile Automation — Setup Script"
echo "============================================"
echo ""

# ── Check Prerequisites ──

echo "--- Checking prerequisites ---"

if command -v node &>/dev/null; then
    echo "  [OK] Node.js $(node --version)"
    pass
else
    fail "Node.js not found — install from https://nodejs.org (v18+)"
fi

if command -v java &>/dev/null; then
    java_version=$(java -version 2>&1 | head -1 | grep -oP '(\d+\.?\d*)' | head -1)
    echo "  [OK] Java $java_version"
    pass
else
    fail "Java not found — install JDK 17+"
fi

if [ -n "${ANDROID_HOME:-}" ] || [ -n "${ANDROID_SDK_ROOT:-}" ]; then
    echo "  [OK] Android SDK found"
    pass
else
    fail "ANDROID_HOME / ANDROID_SDK_ROOT not set — install Android Studio and set the env variable"
fi

if command -v appium &>/dev/null; then
    appium_version=$(appium --version 2>/dev/null || echo "unknown")
    echo "  [OK] Appium $appium_version"
    pass
else
    echo "  [WARN] Appium not installed globally — install with: npm i -g appium"
    echo "         Or use npx: npx appium"
fi

echo ""

# ── Create .env from example ──

echo "--- Environment file ---"

ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE="$ROOT_DIR/data/.envExample"

if [ -f "$ENV_FILE" ]; then
    echo "  [SKIP] .env already exists at $ENV_FILE"
else
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo "  [OK] Created .env from .envExample"
    echo "  >>> EDIT $ENV_FILE with your credentials and device settings <<<"
fi
pass

echo ""

# ── Install npm dependencies ──

echo "--- Installing dependencies ---"

if [ -f "$CONFIG_DIR/package.json" ]; then
    cd "$CONFIG_DIR"
    npm install
    echo "  [OK] npm dependencies installed"
    pass
else
    fail "package.json not found in $CONFIG_DIR"
fi

echo ""

# ── Create report directories ──

echo "--- Report directories ---"

mkdir -p "$ROOT_DIR/reports/android/test-results"
mkdir -p "$ROOT_DIR/reports/android/screenshots"
echo "  [OK] Report directories created"
pass

echo ""

# ── Summary ──

echo "============================================"
echo "  Setup complete: $PASS passed, $FAIL failed"
echo "============================================"
echo ""
echo "  Next steps:"
echo "  1. Edit $ROOT_DIR/.env with your credentials"
echo "  2. Place your APK at $ROOT_DIR/app/android/ (or update APP_PATH in .env)"
  echo "  3. Run tests (Appium is auto-managed): cd $CONFIG_DIR && npm run test"
echo ""

if [ "$FAIL" -gt 0 ]; then
    echo "  WARNING: $FAIL prerequisite(s) missing — fix before running tests."
    exit 1
fi
