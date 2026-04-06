#!/usr/bin/env bash
# Skills Setup Script
# 자동 생성됨 - 업데이트: node generate-skills-setup.js
# 생성 시각: 2026. 4. 7. 오전 12:08:18

set -e

GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

command -v git &>/dev/null || error "git이 설치되어 있지 않습니다."

ALL_SKILLS=("gstack")

echo ""
echo "사용 가능한 Skills:"
echo "  [1] gstack           github:garrytan/gstack.git (setup 있음)"
echo ""

# 인자로 이름/번호 전달 시 바로 사용, 없으면 대화형 선택
if [ $# -gt 0 ]; then
  if [ "$1" = "all" ]; then
    INSTALL_LIST=("${ALL_SKILLS[@]}")
  else
    INSTALL_LIST=("$@")
  fi
else
  echo "설치할 스킬을 선택하세요 (번호·이름 공백 구분, all=전체, Enter=전체)"
  read -rp "> " RAW_INPUT
  if [ -z "$RAW_INPUT" ] || [ "$RAW_INPUT" = "all" ]; then
    INSTALL_LIST=("${ALL_SKILLS[@]}")
  else
    INSTALL_LIST=()
    for item in $RAW_INPUT; do
      if [[ "$item" =~ ^[0-9]+$ ]]; then
        idx=$((item - 1))
        [ "$idx" -ge 0 ] && [ "$idx" -lt "${#ALL_SKILLS[@]}" ] \
          && INSTALL_LIST+=("${ALL_SKILLS[$idx]}")
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
  for _s in "${ALL_SKILLS[@]}"; do [ "$_item" = "$_s" ] && _found=true && break; done
  if $_found; then _VALID+=("$_item");
  else warn "알 수 없는 스킬: '$_item' (무시됨)"; fi
done
INSTALL_LIST=("${_VALID[@]}"); unset _VALID _item _found _s
[ "${#INSTALL_LIST[@]}" -eq 0 ] && error "유효한 스킬이 선택되지 않았습니다."
info "설치 대상: ${INSTALL_LIST[*]}"
echo ""

should_install() {
  local name="$1"
  for item in "${INSTALL_LIST[@]}"; do
    [ "$item" = "$name" ] && return 0
  done
  return 1
}

SKILLS_DIR="$HOME/.claude/skills"
mkdir -p "$SKILLS_DIR"

FAILED=()
info "Skills 설치를 시작합니다..."

# ── gstack
if should_install "gstack"; then
  SKILL_DIR="$SKILLS_DIR/gstack"
  _skill_ok=true
  if [ -d "$SKILL_DIR/.git" ]; then
    info "gstack: 이미 설치됨 → 최신 버전으로 업데이트 중..."
    git -C "$SKILL_DIR" pull --rebase --autostash 2>/dev/null \
      || warn "gstack: git pull 실패 (기존 버전 유지)"
  else
    info "gstack: 클론 중... (https://github.com/garrytan/gstack.git)"
    git clone --single-branch --depth 1 "https://github.com/garrytan/gstack.git" "$SKILL_DIR" \
      || { warn "gstack: git clone 실패"; _skill_ok=false; FAILED+=("gstack"); }
  fi
  if $_skill_ok; then
    info "gstack: setup 실행 중..."
    (cd "$SKILL_DIR" && ./setup) \
      || { warn "gstack: setup 실패"; FAILED+=("gstack"); }
  fi
fi

echo ""
info "설치된 Skills (루트 스킬만):"
for d in "$SKILLS_DIR"/*/; do [ -d "$d/.git" ] && echo "  $(basename "$d")"; done

if [ "${#FAILED[@]}" -gt 0 ]; then
  warn "설치 실패한 스킬 (${#FAILED[@]}개): ${FAILED[*]}"
else
  info "모든 스킬이 성공적으로 설치되었습니다."
fi