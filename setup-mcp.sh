#!/usr/bin/env bash
# MCP Server Setup Script
# 자동 생성됨 - 업데이트: node generate-mcp-setup.js
# 생성 시각: 2026. 4. 7. 오전 12:33:14

set -e

GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

command -v claude &>/dev/null || error "claude CLI가 설치되어 있지 않습니다. https://claude.ai/code"
info "Claude Code 버전: $(claude --version 2>/dev/null || echo '확인 불가')"

ALL_SERVERS=("context7" "notion" "github" "chrome-devtools" "filesystem" "brave-search" "tavily")

echo ""
echo "사용 가능한 MCP 서버:"
echo "  [1] context7             HTTP  [user]  "
echo "  [2] notion               HTTP  [user]  "
echo "  [3] github               HTTP  [user]   (키 필요)"
echo "  [4] chrome-devtools      stdio [user]  "
echo "  [5] filesystem           stdio [user]  "
echo "  [6] brave-search         stdio [user]   (키 필요)"
echo "  [7] tavily               stdio [user]   (키 필요)"
echo ""

# 인자로 이름/번호 전달 시 바로 사용, 없으면 대화형 선택
if [ $# -gt 0 ]; then
  if [ "$1" = "all" ]; then
    INSTALL_LIST=("${ALL_SERVERS[@]}")
  else
    INSTALL_LIST=("$@")
  fi
else
  echo "설치할 서버를 선택하세요 (번호·이름 공백 구분, all=전체, Enter=전체)"
  read -rp "> " RAW_INPUT
  if [ -z "$RAW_INPUT" ] || [ "$RAW_INPUT" = "all" ]; then
    INSTALL_LIST=("${ALL_SERVERS[@]}")
  else
    INSTALL_LIST=()
    for item in $RAW_INPUT; do
      if [[ "$item" =~ ^[0-9]+$ ]]; then
        idx=$((item - 1))
        [ "$idx" -ge 0 ] && [ "$idx" -lt "${#ALL_SERVERS[@]}" ] \
          && INSTALL_LIST+=("${ALL_SERVERS[$idx]}")
      else
        INSTALL_LIST+=("$item")
      fi
    done
  fi
fi

# 유효하지 않은 이름 경고 및 필터링
_VALID=()
for _item in "${INSTALL_LIST[@]}"; do
  _found=false
  for _s in "${ALL_SERVERS[@]}"; do [ "$_item" = "$_s" ] && _found=true && break; done
  if $_found; then _VALID+=("$_item");
  else warn "알 수 없는 서버: '$_item' (무시됨)"; fi
done
INSTALL_LIST=("${_VALID[@]}"); unset _VALID _item _found _s
[ "${#INSTALL_LIST[@]}" -eq 0 ] && error "유효한 서버가 선택되지 않았습니다."
info "설치 대상: ${INSTALL_LIST[*]}"
echo ""

should_install() {
  local name="$1"
  for item in "${INSTALL_LIST[@]}"; do
    [ "$item" = "$name" ] && return 0
  done
  return 1
}

# ── github 토큰 입력 (선택된 경우에만)
if should_install "github"; then
  if [ -z "${GITHUB_TOKEN}" ]; then
    read -rsp "github Token 입력 (화면에 표시 안 됨): " GITHUB_TOKEN; echo ""
  fi
  [ -z "${GITHUB_TOKEN}" ] && error "github Token이 입력되지 않았습니다."
fi

# ── brave-search BRAVE_API_KEY 입력 (선택된 경우에만)
if should_install "brave-search"; then
  if [ -z "${BRAVE_API_KEY}" ]; then
    read -rsp "brave-search BRAVE_API_KEY 입력 (화면에 표시 안 됨): " BRAVE_API_KEY; echo ""
  fi
  [ -z "${BRAVE_API_KEY}" ] && error "brave-search BRAVE_API_KEY가 입력되지 않았습니다."
fi

# ── tavily TAVILY_API_KEY 입력 (선택된 경우에만)
if should_install "tavily"; then
  if [ -z "${TAVILY_API_KEY}" ]; then
    read -rsp "tavily TAVILY_API_KEY 입력 (화면에 표시 안 됨): " TAVILY_API_KEY; echo ""
  fi
  [ -z "${TAVILY_API_KEY}" ] && error "tavily TAVILY_API_KEY가 입력되지 않았습니다."
fi

SCOPE="${SCOPE:-local}"
[[ "$SCOPE" =~ ^(local|user|project)$ ]] || error "SCOPE는 local, user, project 중 하나여야 합니다."
info "적용 범위: ${SCOPE}  (전역 적용하려면: SCOPE=user bash setup-mcp.sh)"

add_mcp() {
  local name="$1"; shift
  # 지정 SCOPE에서 먼저 제거 시도 (없어도 무시 — grep 의존 제거)
  if claude mcp remove "$name" -s "$SCOPE" &>/dev/null; then
    info "기존 설정 제거: $name (${SCOPE})"
  fi
  claude mcp add --scope "$SCOPE" "$@" && info "추가 완료: $name"
}

FAILED=()
info "MCP 서버 추가를 시작합니다..."

# ── context7 [원본 scope: user]
if should_install "context7"; then
  add_mcp "context7" "context7" \
    --transport http \
    "https://mcp.context7.com/mcp" \
    || { warn "context7 설치 실패"; FAILED+=("context7"); }
fi

# ── notion [원본 scope: user]
if should_install "notion"; then
  add_mcp "notion" "notion" \
    --transport http \
    "https://mcp.notion.com/mcp" \
    || { warn "notion 설치 실패"; FAILED+=("notion"); }
fi

# ── github [원본 scope: user]
if should_install "github"; then
  add_mcp "github" "github" \
    --transport http \
    "https://api.githubcopilot.com/mcp/" \
    --header "Authorization: Bearer ${GITHUB_TOKEN}" \
    || { warn "github 설치 실패"; FAILED+=("github"); }
fi

# ── chrome-devtools [원본 scope: user]
if should_install "chrome-devtools"; then
  add_mcp "chrome-devtools" "chrome-devtools" \
    "npx" "chrome-devtools-mcp@0.21.0" \
    || { warn "chrome-devtools 설치 실패"; FAILED+=("chrome-devtools"); }
fi

# ── filesystem [원본 scope: user]
if should_install "filesystem"; then
  add_mcp "filesystem" "filesystem" \
    "npx" "-y" "@modelcontextprotocol/server-filesystem" "C:/Users/LSH" "D:/Workspace" "D:/" \
    || { warn "filesystem 설치 실패"; FAILED+=("filesystem"); }
fi

# ── brave-search [원본 scope: user]
if should_install "brave-search"; then
  add_mcp "brave-search" "brave-search" \
    -e "BRAVE_API_KEY=${BRAVE_API_KEY}" \
    -- \
    "npx" "-y" "@modelcontextprotocol/server-brave-search" \
    || { warn "brave-search 설치 실패"; FAILED+=("brave-search"); }
fi

# ── tavily [원본 scope: user]
if should_install "tavily"; then
  add_mcp "tavily" "tavily" \
    -e "TAVILY_API_KEY=${TAVILY_API_KEY}" \
    -- \
    "npx" "-y" "tavily-mcp" \
    || { warn "tavily 설치 실패"; FAILED+=("tavily"); }
fi

echo ""
info "설치된 MCP 서버 목록:"
claude mcp list

if [ "${#FAILED[@]}" -gt 0 ]; then
  warn "설치 실패한 서버 (${#FAILED[@]}개): ${FAILED[*]}"
else
  info "모든 서버가 성공적으로 설치되었습니다."
fi
info "claude.ai Gmail 등 OAuth 서버는 Claude Code 로그인 후 자동 연결됩니다."