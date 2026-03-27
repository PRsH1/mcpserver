#!/usr/bin/env bash
# Skills Setup Script
# 자동 생성됨 - 업데이트: node generate-skills-setup.js
# 생성 시각: 2026. 3. 28. 오전 1:39:44

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

[ "${#INSTALL_LIST[@]}" -eq 0 ] && error "설치할 스킬이 선택되지 않았습니다."
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
info "Skills 설치를 시작합니다..."

# ── gstack
if should_install "gstack"; then
  SKILL_DIR="$SKILLS_DIR/gstack"
  if [ -d "$SKILL_DIR/.git" ]; then
    info "gstack: 이미 설치됨 → 최신 버전으로 업데이트 중..."
    git -C "$SKILL_DIR" pull --rebase --autostash 2>/dev/null \
      || warn "gstack: git pull 실패 (기존 버전 유지)"
  else
    info "gstack: 클론 중... (https://github.com/garrytan/gstack.git)"
    git clone --single-branch --depth 1 "https://github.com/garrytan/gstack.git" "$SKILL_DIR"
  fi
  info "gstack: setup 실행 중..."
  (cd "$SKILL_DIR" && ./setup) || error "gstack setup 실패"
fi

echo ""
info "설치 완료! 설치된 Skills (루트 스킬만):"
for d in "$SKILLS_DIR"/*/; do [ -d "$d/.git" ] && echo "  $(basename "$d")"; done