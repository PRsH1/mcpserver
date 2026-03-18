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
const projects = data.projects || {};

// 모든 프로젝트의 mcpServers 를 합산 (같은 이름이면 나중 것으로 덮어씀)
const merged = {};
for (const proj of Object.values(projects)) {
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

// ── setup-mcp.sh 내용 생성 ──────────────────────────────────────────────────
const lines = [];

lines.push('#!/usr/bin/env bash');
lines.push(`# MCP Server Setup Script`);
lines.push(`# 자동 생성됨 - 업데이트: node generate-mcp-setup.js`);
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

// 토큰 입력 프롬프트 (Authorization Bearer 가 있는 서버만)
for (const [name, varName] of Object.entries(tokenVars)) {
  lines.push(`# ── ${name} 토큰 입력`);
  lines.push(`if [ -z "\${${varName}}" ]; then`);
  lines.push(`  read -rsp "${name} Token 입력 (화면에 표시 안 됨): " ${varName}; echo ""`);
  lines.push(`fi`);
  lines.push(`[ -z "\${${varName}}" ] && error "${name} Token이 입력되지 않았습니다."`);
  lines.push('');
}

lines.push('SCOPE="${SCOPE:-local}"');
lines.push('info "적용 범위: ${SCOPE}  (전역 적용하려면: SCOPE=user bash setup-mcp.sh)"');
lines.push('');
lines.push('add_mcp() {');
lines.push('  local name="$1"; shift');
lines.push('  if claude mcp get "$name" &>/dev/null; then');
lines.push('    warn "이미 존재합니다. 건너뜀: $name"');
lines.push('  else');
lines.push('    claude mcp add "$@" --scope "$SCOPE" && info "추가 완료: $name"');
lines.push('  fi');
lines.push('}');
lines.push('');
lines.push('info "MCP 서버 추가를 시작합니다..."');
lines.push('');

// 서버별 add_mcp 명령 생성
for (const [name, cfg] of Object.entries(merged)) {
  lines.push(`# ── ${name}`);

  const args = [`add_mcp "${name}" "${name}"`];

  if (cfg.type === 'http' || cfg.url) {
    args.push('--transport http');
    args.push(`"${cfg.url}"`);
  } else if (cfg.command) {
    // stdio 타입
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

  // 인자가 길면 백슬래시로 줄바꿈
  lines.push(args.join(' \\\n  '));
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

// Unix 실행 권한 부여 (Windows 에서는 무시됨)
try { fs.chmodSync(outputPath, 0o755); } catch (_) {}

console.log(`[INFO] setup-mcp.sh 재생성 완료: ${outputPath}`);
console.log(`[INFO] 서버 수: ${Object.keys(merged).length}개`);
