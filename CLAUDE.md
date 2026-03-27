# CLAUDE.md

## 프로젝트 개요

Claude Code MCP 서버 설정을 여러 PC에서 동일하게 유지하기 위한 동기화 도구.

## 파일 구조

```
mcpserver/
├── CLAUDE.md                  # 프로젝트 가이드 (이 파일)
├── README.md                  # 사용자 가이드
├── generate-mcp-setup.js      # ~/.claude.json → setup-mcp.sh 자동 생성
├── setup-mcp.sh               # 타 PC에서 실행하는 MCP 설치 스크립트 (자동 생성)
├── generate-skills-setup.js   # ~/.claude/skills/ → setup-skills.sh 자동 생성
└── setup-skills.sh            # 타 PC에서 실행하는 Skills 설치 스크립트 (자동 생성)
```

## 핵심 동작 흐름

### generate-mcp-setup.js

1. `~/.claude.json` 파일 읽기
2. 루트 레벨 `mcpServers` (user scope) + `projects[*].mcpServers` (project scope) 합산
   - 같은 이름이면 project scope가 user scope를 덮어씀
3. Authorization Bearer 토큰이 포함된 서버는 환경변수(`{NAME}_TOKEN`)로 치환하여 토큰 노출 방지
4. `setup-mcp.sh` 파일 생성

### setup-mcp.sh (자동 생성됨)

1. 토큰이 필요한 서버(github 등)는 대화형으로 입력받음
2. `add_mcp()` 함수로 서버 등록:
   - 지정한 SCOPE에 이미 존재하면 → remove 후 재등록 (설정 업데이트 보장)
   - 다른 scope에만 존재하면 → 그대로 추가
3. HTTP 서버는 `--transport http`, stdio 서버는 command + args 방식으로 추가

### generate-skills-setup.js

1. `~/.claude/skills/` 디렉토리 스캔
2. `.git` 디렉토리가 있는 폴더만 루트 스킬로 감지 (git clone으로 설치된 것)
   - `.git` 없는 폴더는 부모 스킬이 생성한 서브스킬이므로 skip
3. 각 루트 스킬의 git remote URL 추출
4. `setup` 스크립트 유무 감지 (설치 후 실행 여부 결정)
5. `setup-skills.sh` 파일 생성

### setup-skills.sh (자동 생성됨)

- 이미 설치된 스킬이면 → `git pull --rebase` 로 업데이트
- 미설치면 → `git clone --single-branch --depth 1` 으로 설치
- `setup` 스크립트가 있으면 실행 (서브스킬 등록, 바이너리 빌드 등)

## 주의사항

- `setup-mcp.sh`, `setup-skills.sh`는 직접 수정하지 말 것 — 각 generate 스크립트가 덮어씀
- `claude mcp get`은 scope 옵션을 지원하지 않으므로, 출력 문자열에서 scope를 grep으로 판별
- 토큰 값은 셸 스크립트에 하드코딩되지 않음 (환경변수 또는 대화형 입력)
- OAuth 기반 서버(Gmail 등)는 스크립트로 등록하지 않음 — Claude Code 로그인 후 자동 연결
- notion은 Claude.ai 계정 연동(OAuth) 버전을 제거하고 HTTP 직접 등록 방식(user scope)으로 운용 중
- gstack skill은 `bun` 이 필요함 — setup-skills.sh 실행 전 설치 필요

## 자주 쓰는 명령어

```bash
# setup-mcp.sh 재생성
node generate-mcp-setup.js

# setup-skills.sh 재생성
node generate-skills-setup.js

# 타 PC에서 MCP 설치 (프로젝트 scope)
bash setup-mcp.sh

# 타 PC에서 MCP 설치 (user scope - 전역)
SCOPE=user bash setup-mcp.sh

# 타 PC에서 Skills 설치
bash setup-skills.sh
```
