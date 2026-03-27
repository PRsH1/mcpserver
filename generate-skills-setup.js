#!/usr/bin/env node
/**
 * Skills 설정 동기화 스크립트
 * 현재 PC의 Skills 목록을 읽어 setup-skills.sh 를 자동으로 재생성합니다.
 * 새 Skill을 추가한 후 이 스크립트를 실행하세요.
 *
 * 사용법: node generate-skills-setup.js
 *
 * 감지 기준:
 *   - ~/.claude/skills/{name}/.git 존재 → 루트 스킬 (git clone으로 설치됨)
 *   - .git 없음 → 부모 스킬이 생성한 서브스킬 (skip)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ── Skills 디렉토리 ───────────────────────────────────────────────────────────
const skillsDir = path.join(os.homedir(), '.claude', 'skills');
if (!fs.existsSync(skillsDir)) {
  console.error(`[ERROR] Skills 디렉토리를 찾을 수 없습니다: ${skillsDir}`);
  process.exit(1);
}

// ── 루트 스킬 목록 추출 (.git 있는 것만) ────────────────────────────────────
const skills = [];
const entries = fs.readdirSync(skillsDir).sort();

for (const name of entries) {
  const fullPath = path.join(skillsDir, name);
  if (!fs.statSync(fullPath).isDirectory()) continue;

  const gitDir = path.join(fullPath, '.git');
  if (!fs.existsSync(gitDir)) {
    // .git 없음 → 서브스킬이므로 skip
    continue;
  }

  // git remote URL 추출
  let remoteUrl;
  try {
    remoteUrl = execSync('git remote get-url origin', {
      cwd: fullPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    console.warn(`[WARN] ${name}: git remote URL을 찾을 수 없습니다. (skip)`);
    continue;
  }

  const hasSetup = fs.existsSync(path.join(fullPath, 'setup'));

  skills.push({ name, remoteUrl, hasSetup });
  console.log(`[INFO] 루트 스킬 발견: ${name} (${remoteUrl})`);
}

if (skills.length === 0) {
  console.error('[ERROR] 등록된 루트 Skills가 없습니다 (git clone으로 설치된 스킬이 없음).');
  process.exit(1);
}

// ── setup-skills.sh 내용 생성 ────────────────────────────────────────────────
const lines = [];

lines.push('#!/usr/bin/env bash');
lines.push('# Skills Setup Script');
lines.push('# 자동 생성됨 - 업데이트: node generate-skills-setup.js');
lines.push(`# 생성 시각: ${new Date().toLocaleString('ko-KR')}`);
lines.push('');
lines.push('set -e');
lines.push('');
lines.push('GREEN="\\033[0;32m"; YELLOW="\\033[1;33m"; RED="\\033[0;31m"; NC="\\033[0m"');
lines.push('info()  { echo -e "${GREEN}[INFO]${NC} $1"; }');
lines.push('warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }');
lines.push('error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }');
lines.push('');
lines.push('command -v git &>/dev/null || error "git이 설치되어 있지 않습니다."');
lines.push('');

// ── 선택 가능한 스킬 목록 (배열) ─────────────────────────────────────────────
lines.push(`ALL_SKILLS=(${skills.map(s => `"${s.name}"`).join(' ')})`);
lines.push('');

// ── 스킬 목록 출력 + 선택 UI ─────────────────────────────────────────────────
lines.push('echo ""');
lines.push('echo "사용 가능한 Skills:"');
skills.forEach(({ name, remoteUrl, hasSetup }, i) => {
  const setupMark = hasSetup ? ' (setup 있음)' : '';
  const shortUrl = remoteUrl.replace('https://github.com/', 'github:');
  const label = `[${i + 1}] ${name}`;
  lines.push(`echo "  ${label.padEnd(20)} ${shortUrl}${setupMark}"`);
});
lines.push('echo ""');
lines.push('');

lines.push('# 인자로 이름/번호 전달 시 바로 사용, 없으면 대화형 선택');
lines.push('if [ $# -gt 0 ]; then');
lines.push('  if [ "$1" = "all" ]; then');
lines.push('    INSTALL_LIST=("${ALL_SKILLS[@]}")');
lines.push('  else');
lines.push('    INSTALL_LIST=("$@")');
lines.push('  fi');
lines.push('else');
lines.push('  echo "설치할 스킬을 선택하세요 (번호·이름 공백 구분, all=전체, Enter=전체)"');
lines.push('  read -rp "> " RAW_INPUT');
lines.push('  if [ -z "$RAW_INPUT" ] || [ "$RAW_INPUT" = "all" ]; then');
lines.push('    INSTALL_LIST=("${ALL_SKILLS[@]}")');
lines.push('  else');
lines.push('    INSTALL_LIST=()');
lines.push('    for item in $RAW_INPUT; do');
lines.push('      if [[ "$item" =~ ^[0-9]+$ ]]; then');
lines.push('        idx=$((item - 1))');
lines.push('        [ "$idx" -ge 0 ] && [ "$idx" -lt "${#ALL_SKILLS[@]}" ] \\');
lines.push('          && INSTALL_LIST+=("${ALL_SKILLS[$idx]}")');
lines.push('      else');
lines.push('        INSTALL_LIST+=("$item")');
lines.push('      fi');
lines.push('    done');
lines.push('  fi');
lines.push('fi');
lines.push('');

lines.push('[ "${#INSTALL_LIST[@]}" -eq 0 ] && error "설치할 스킬이 선택되지 않았습니다."');
lines.push('info "설치 대상: ${INSTALL_LIST[*]}"');
lines.push('echo ""');
lines.push('');

// ── should_install 헬퍼 ───────────────────────────────────────────────────────
lines.push('should_install() {');
lines.push('  local name="$1"');
lines.push('  for item in "${INSTALL_LIST[@]}"; do');
lines.push('    [ "$item" = "$name" ] && return 0');
lines.push('  done');
lines.push('  return 1');
lines.push('}');
lines.push('');

lines.push('SKILLS_DIR="$HOME/.claude/skills"');
lines.push('mkdir -p "$SKILLS_DIR"');
lines.push('info "Skills 설치를 시작합니다..."');
lines.push('');

// ── 스킬별 설치 (should_install 조건부) ──────────────────────────────────────
for (const { name, remoteUrl, hasSetup } of skills) {
  lines.push(`# ── ${name}`);
  lines.push(`if should_install "${name}"; then`);
  lines.push(`  SKILL_DIR="$SKILLS_DIR/${name}"`);
  lines.push(`  if [ -d "$SKILL_DIR/.git" ]; then`);
  lines.push(`    info "${name}: 이미 설치됨 → 최신 버전으로 업데이트 중..."`);
  lines.push(`    git -C "$SKILL_DIR" pull --rebase --autostash 2>/dev/null \\`);
  lines.push(`      || warn "${name}: git pull 실패 (기존 버전 유지)"`);
  lines.push(`  else`);
  lines.push(`    info "${name}: 클론 중... (${remoteUrl})"`);
  lines.push(`    git clone --single-branch --depth 1 "${remoteUrl}" "$SKILL_DIR"`);
  lines.push(`  fi`);
  if (hasSetup) {
    lines.push(`  info "${name}: setup 실행 중..."`);
    lines.push(`  (cd "$SKILL_DIR" && ./setup) || error "${name} setup 실패"`);
  }
  lines.push('fi');
  lines.push('');
}

lines.push('echo ""');
lines.push('info "설치 완료! 설치된 Skills (루트 스킬만):"');
lines.push('for d in "$SKILLS_DIR"/*/; do [ -d "$d/.git" ] && echo "  $(basename "$d")"; done');

// ── 파일 저장 ────────────────────────────────────────────────────────────────
const outputPath = path.join(__dirname, 'setup-skills.sh');
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
try { fs.chmodSync(outputPath, 0o755); } catch (_) {}

console.log(`[INFO] setup-skills.sh 재생성 완료: ${outputPath}`);
console.log(`[INFO] 루트 스킬 수: ${skills.length}개`);
