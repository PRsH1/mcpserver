#!/usr/bin/env bash
# MCP Server Setup Script
# 자동 생성됨 - 업데이트: node generate-mcp-setup.js
# 생성 시각: 2026. 3. 21. 오전 12:25:28

set -e

GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

command -v claude &>/dev/null || error "claude CLI가 설치되어 있지 않습니다. https://claude.ai/code"
info "Claude Code 버전: $(claude --version 2>/dev/null || echo '확인 불가')"

# ── github 토큰 입력
if [ -z "${GITHUB_TOKEN}" ]; then
  read -rsp "github Token 입력 (화면에 표시 안 됨): " GITHUB_TOKEN; echo ""
fi
[ -z "${GITHUB_TOKEN}" ] && error "github Token이 입력되지 않았습니다."

SCOPE="${SCOPE:-local}"
info "적용 범위: ${SCOPE}  (전역 적용하려면: SCOPE=user bash setup-mcp.sh)"

add_mcp() {
  local name="$1"; shift
  # 지정한 SCOPE에 이미 존재하면 삭제 후 재등록 (설정 업데이트 보장)
  if claude mcp get "$name" 2>/dev/null | grep -qi "scope.*${SCOPE}"; then
    claude mcp remove "$name" -s "$SCOPE" &>/dev/null
    info "기존 설정 제거: $name (${SCOPE})"
  fi
  claude mcp add "$@" --scope "$SCOPE" && info "추가 완료: $name"
}

info "MCP 서버 추가를 시작합니다..."

# ── context7
add_mcp "context7" "context7" \
  --transport http \
  "https://mcp.context7.com/mcp"

# ── notion
add_mcp "notion" "notion" \
  --transport http \
  "https://mcp.notion.com/mcp"

# ── github
add_mcp "github" "github" \
  --transport http \
  "https://api.githubcopilot.com/mcp/" \
  --header "Authorization: Bearer ${GITHUB_TOKEN}"

# ── chrome-devtools
add_mcp "chrome-devtools" "chrome-devtools" \
  "npx" "chrome-devtools-mcp@latest"

echo ""
info "설치된 MCP 서버 목록:"
claude mcp list

info "완료! claude.ai Gmail 등 OAuth 서버는 Claude Code 로그인 후 자동 연결됩니다."