#!/usr/bin/env bash
# Skills Setup Script
# 자동 생성됨 - 업데이트: node generate-skills-setup.js
# 생성 시각: 2026. 3. 27. 오후 7:25:05

set -e

GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

command -v git &>/dev/null || error "git이 설치되어 있지 않습니다."

SKILLS_DIR="$HOME/.claude/skills"
mkdir -p "$SKILLS_DIR"
info "Skills 설치를 시작합니다..."

# ── gstack
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

echo ""
info "설치 완료! 설치된 Skills:"
ls "$SKILLS_DIR"