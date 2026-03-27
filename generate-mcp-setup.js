#!/usr/bin/env node
/**
 * MCP 설정 동기화 스크립트
 * 현재 PC의 MCP 서버 목록을 읽어 setup-mcp.sh 를 자동으로 재생성합니다.
 * 새 MCP 서버를 추가한 후 이 스크립트를 실행하세요.
 *
 * 사용법: node generate-mcp-setup.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ── .claude.json 위치 ────────────────────────────────────────────────────────
const claudeJson = path.join(os.homedir(), '.claude.json');
if (!fs.existsSync(claudeJson)) {
  console.error(`[ERROR] 파일을 찾을 수 없습니다: ${claudeJson}`);
  process.exit(1);
}

// ── MCP 서버 목록 추출 ───────────────────────────────────────────────────────
const data = JSON.parse(fs.readFileSync(claudeJson, 'utf8'));

// 루트 레벨(user scope) + 프로젝트별 mcpServers 를 합산 (같은 이름이면 나중 것으로 덮어씀)
const merged = {};

// 1) 루트 레벨 mcpServers (user scope)
for (const [name, cfg] of Object.entries(data.mcpServers || {})) {
  merged[name] = JSON.parse(JSON.stringify(cfg));
}

// 2) 프로젝트별 mcpServers (project scope)
for (const proj of Object.values(data.projects || {})) {
  for (const [name, cfg] of Object.entries(proj.mcpServers || {})) {
    merged[name] = JSON.parse(JSON.stringify(cfg)); // deep copy
  }
}

if (Object.keys(merged).length === 0) {
  console.error('[ERROR] 등록된 MCP 서버가 없습니다.');
  process.exit(1);
}

console.log(`[INFO] 발견된 MCP 서버: ${Object.keys(merged).join(', ')}`);

// ── Authorization Bearer 헤더를 환경변수로 치환 ──────────────────────────────
// 토큰 변수명 매핑: { serverName -> ENV_VAR_NAME }
const tokenVars = {};
for (const [name, cfg] of Object.entries(merged)) {
  if (!cfg.headers) continue;
  for (const [hk, hv] of Object.entries(cfg.headers)) {
    if (/^bearer\s+\S+/i.test(hv)) {
      const varName = name.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_TOKEN';
      tokenVars[name] = varName;
    }
  }
}

// ── 서버별 표시 정보 준비 ────────────────────────────────────────────────────
// 번호 정렬용 배열
const serverNames = Object.keys(merged);

// 각 서버의 표시용 메타 정보
function serverMeta(name, cfg) {
  const type = (cfg.type === 'http' || cfg.url) ? 'HTTP ' : `stdio`;
  const auth = tokenVars[name] ? ' (토큰 필요)' : '';
  return `${type}${auth}`;
}

// ── setup-mcp.sh 내용 생성 ──────────────────────────────────────────────────
const lines = [];

lines.push('#!/usr/bin/env bash');
lines.push('# MCP Server Setup Script');
lines.push('# 자동 생성됨 - 업데이트: node generate-mcp-setup.js');
lines.push(`# 생성 시각: ${new Date().toLocaleString('ko-KR')}`);
lines.push('');
lines.push('set -e');
lines.push('');
lines.push('GREEN="\\033[0;32m"; YELLOW="\\033[1;33m"; RED="\\033[0;31m"; NC="\\033[0m"');
lines.push('info()  { echo -e "${GREEN}[INFO]${NC} $1"; }');
lines.push('warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }');
lines.push('error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }');
lines.push('');
lines.push('command -v claude &>/dev/null || error "claude CLI가 설치되어 있지 않습니다. https://claude.ai/code"');
lines.push(`info "Claude Code 버전: $(claude --version 2>/dev/null || echo '확인 불가')"`);
lines.push('');

// ── 선택 가능한 서버 목록 (배열) ─────────────────────────────────────────────
lines.push(`ALL_SERVERS=(${serverNames.map(n => `"${n}"`).join(' ')})`);
lines.push('');

// ── 서버 목록 출력 + 선택 UI ─────────────────────────────────────────────────
lines.push('echo ""');
lines.push('echo "사용 가능한 MCP 서버:"');
serverNames.forEach((name, i) => {
  const meta = serverMeta(name, merged[name]);
  const label = `[${i + 1}] ${name}`;
  lines.push(`echo "  ${label.padEnd(24)} ${meta}"`);
});
lines.push('echo ""');
lines.push('');

lines.push('# 인자로 이름/번호 전달 시 바로 사용, 없으면 대화형 선택');
lines.push('if [ $# -gt 0 ]; then');
lines.push('  if [ "$1" = "all" ]; then');
lines.push('    INSTALL_LIST=("${ALL_SERVERS[@]}")');
lines.push('  else');
lines.push('    INSTALL_LIST=("$@")');
lines.push('  fi');
lines.push('else');
lines.push(`  echo "설치할 서버를 선택하세요 (번호·이름 공백 구분, all=전체, Enter=전체)"`);
lines.push('  read -rp "> " RAW_INPUT');
lines.push('  if [ -z "$RAW_INPUT" ] || [ "$RAW_INPUT" = "all" ]; then');
lines.push('    INSTALL_LIST=("${ALL_SERVERS[@]}")');
lines.push('  else');
lines.push('    INSTALL_LIST=()');
lines.push('    for item in $RAW_INPUT; do');
lines.push('      if [[ "$item" =~ ^[0-9]+$ ]]; then');
lines.push('        idx=$((item - 1))');
lines.push('        [ "$idx" -ge 0 ] && [ "$idx" -lt "${#ALL_SERVERS[@]}" ] \\');
lines.push('          && INSTALL_LIST+=("${ALL_SERVERS[$idx]}")');
lines.push('      else');
lines.push('        INSTALL_LIST+=("$item")');
lines.push('      fi');
lines.push('    done');
lines.push('  fi');
lines.push('fi');
lines.push('');

lines.push('[ "${#INSTALL_LIST[@]}" -eq 0 ] && error "설치할 서버가 선택되지 않았습니다."');
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

// ── 토큰 입력 (선택된 서버에만) ──────────────────────────────────────────────
for (const [name, varName] of Object.entries(tokenVars)) {
  lines.push(`# ── ${name} 토큰 입력 (선택된 경우에만)`);
  lines.push(`if should_install "${name}"; then`);
  lines.push(`  if [ -z "\${${varName}}" ]; then`);
  lines.push(`    read -rsp "${name} Token 입력 (화면에 표시 안 됨): " ${varName}; echo ""`);
  lines.push(`  fi`);
  lines.push(`  [ -z "\${${varName}}" ] && error "${name} Token이 입력되지 않았습니다."`);
  lines.push(`fi`);
  lines.push('');
}

// ── SCOPE 설정 ───────────────────────────────────────────────────────────────
lines.push('SCOPE="${SCOPE:-local}"');
lines.push('info "적용 범위: ${SCOPE}  (전역 적용하려면: SCOPE=user bash setup-mcp.sh)"');
lines.push('');

// ── add_mcp 헬퍼 ─────────────────────────────────────────────────────────────
lines.push('add_mcp() {');
lines.push('  local name="$1"; shift');
lines.push('  # 지정한 SCOPE에 이미 존재하면 삭제 후 재등록 (설정 업데이트 보장)');
lines.push('  if claude mcp get "$name" 2>/dev/null | grep -qi "scope.*${SCOPE}"; then');
lines.push('    claude mcp remove "$name" -s "$SCOPE" &>/dev/null');
lines.push('    info "기존 설정 제거: $name (${SCOPE})"');
lines.push('  fi');
lines.push('  claude mcp add "$@" --scope "$SCOPE" && info "추가 완료: $name"');
lines.push('}');
lines.push('');

lines.push('info "MCP 서버 추가를 시작합니다..."');
lines.push('');

// ── 서버별 add_mcp 명령 생성 (should_install 조건부) ─────────────────────────
for (const [name, cfg] of Object.entries(merged)) {
  lines.push(`# ── ${name}`);

  const args = [`add_mcp "${name}" "${name}"`];

  if (cfg.type === 'http' || cfg.url) {
    args.push('--transport http');
    args.push(`"${cfg.url}"`);
  } else if (cfg.command) {
    const cmdArgs = (cfg.args || []).map(a => `"${a}"`).join(' ');
    args.push(`"${cfg.command}" ${cmdArgs}`.trim());
  }

  if (cfg.headers) {
    for (const [hk, hv] of Object.entries(cfg.headers)) {
      const varName = tokenVars[name];
      if (varName) {
        args.push(`--header "${hk}: Bearer \${${varName}}"`);
      } else {
        args.push(`--header "${hk}: ${hv}"`);
      }
    }
  }

  lines.push(`should_install "${name}" && ${args.join(' \\\n  ')}`);
  lines.push('');
}

lines.push('echo ""');
lines.push('info "설치된 MCP 서버 목록:"');
lines.push('claude mcp list');
lines.push('');
lines.push('info "완료! claude.ai Gmail 등 OAuth 서버는 Claude Code 로그인 후 자동 연결됩니다."');

// ── 파일 저장 ────────────────────────────────────────────────────────────────
const outputPath = path.join(__dirname, 'setup-mcp.sh');
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');

try { fs.chmodSync(outputPath, 0o755); } catch (_) {}

console.log(`[INFO] setup-mcp.sh 재생성 완료: ${outputPath}`);
console.log(`[INFO] 서버 수: ${Object.keys(merged).length}개`);
