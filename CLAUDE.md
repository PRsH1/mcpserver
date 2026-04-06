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

1. `~/.claude.json` 파일 읽기 (파싱 실패 시 친화적 에러 출력 후 종료)
2. 루트 레벨 `mcpServers` (user scope) + `projects[*].mcpServers` (project scope) 합산
   - 같은 이름이면 project scope가 user scope를 덮어씀
   - 여러 프로젝트에 같은 이름이 있으면 `Object.values()` 순서(삽입 순서)의 나중 것이 우선
   - 각 서버의 원본 scope를 `originalScope` 맵으로 추적 → 생성된 스크립트에 주석으로 표시
3. 시크릿 처리 (스크립트에 값 하드코딩 방지):
   - HTTP 서버의 `Authorization: Bearer` 헤더 → 환경변수(`{NAME}_TOKEN`)로 치환
   - stdio 서버의 `env` 필드 → 해당 env var 이름 그대로 환경변수로 치환 (예: `BRAVE_API_KEY`)
4. URL, 커맨드, 인자, 헤더값에 포함된 특수문자(`"`, `$`, `` ` ``, `\`)를 `shellEscape()`로 이스케이프하여 셸 스크립트 injection 방지
5. `npx` 인자 중 `@latest`가 붙은 패키지는 generate 시점에 `npm view`로 실제 버전을 조회해 고정 (재현성 보장)
6. `setup-mcp.sh` 파일 생성

### setup-mcp.sh (자동 생성됨)

1. `SCOPE` 환경변수 검증: `local`, `user`, `project` 외의 값이면 즉시 에러 출력 후 종료
2. 선택 후 유효성 검증: 존재하지 않는 서버명 입력 시 경고 출력 후 필터링
3. 키가 필요한 서버는 선택된 경우에만 대화형으로 입력받음:
   - HTTP Bearer 토큰 서버(github 등) → `{NAME}_TOKEN` 변수로 입력
   - stdio env var 서버(brave-search 등) → 해당 env var명으로 입력
4. `add_mcp()` 함수로 서버 등록:
   - 지정한 SCOPE에서 먼저 remove 시도(없으면 무시) → add (grep 의존 없이 안정적)
   - stdio + env var 서버는 `-e KEY=${VAR} -- command` 형태로 등록
5. 각 서버 설치 실패 시 `FAILED` 배열에 누적 → 스크립트 종료 없이 계속 진행 → 마지막에 실패 목록 출력

### generate-skills-setup.js

1. `~/.claude/skills/` 디렉토리 스캔
2. 이름이 `.`으로 시작하는 숨김 디렉토리(백업·임시 폴더 등) skip
3. `.git` 디렉토리가 있는 폴더만 루트 스킬로 감지 (git clone으로 설치된 것)
   - `.git` 없는 폴더는 부모 스킬이 생성한 서브스킬이므로 skip
4. 각 루트 스킬의 git remote URL 추출
5. `setup` 스크립트 유무 감지 (설치 후 실행 여부 결정)
6. `setup-skills.sh` 파일 생성

### setup-skills.sh (자동 생성됨)

- 선택 후 유효성 검증: 존재하지 않는 스킬명 입력 시 경고 출력 후 필터링
- 이미 설치된 스킬이면 → `git pull --rebase` 로 업데이트
- 미설치면 → `git clone --single-branch --depth 1` 으로 설치
- `setup` 스크립트가 있으면 실행 (서브스킬 등록, 바이너리 빌드 등)
- git clone 또는 setup 실패 시 `FAILED` 배열에 누적 → 다음 스킬 계속 진행

## 주의사항

- `setup-mcp.sh`, `setup-skills.sh`는 직접 수정하지 말 것 — 각 generate 스크립트가 덮어씀
- 토큰·API 키는 셸 스크립트에 하드코딩되지 않음 (환경변수 또는 대화형 입력)
  - HTTP Bearer: `Authorization` 헤더 → `{NAME}_TOKEN` 환경변수
  - stdio env var: `claude mcp add -e KEY=val`로 추가한 값 → 동일 키 이름으로 치환
- OAuth 기반 서버(Gmail 등)는 스크립트로 등록하지 않음 — Claude Code 로그인 후 자동 연결
- notion은 Claude.ai 계정 연동(OAuth) 버전을 제거하고 HTTP 직접 등록 방식(user scope)으로 운용 중
- gstack skill은 `bun` 이 필요함 — setup-skills.sh 실행 전 설치 필요
- generate 실행 시 `npx pkg@latest` 형태의 패키지는 버전이 자동 고정됨 — 의도적으로 올리려면 generate를 다시 실행

## 자주 쓰는 명령어

```bash
# setup-mcp.sh 재생성
node generate-mcp-setup.js

# setup-skills.sh 재생성
node generate-skills-setup.js

# 타 PC에서 MCP 설치 — 대화형 선택
bash setup-mcp.sh

# 타 PC에서 MCP 설치 — 전체 설치
bash setup-mcp.sh all

# 타 PC에서 MCP 설치 — 특정 서버만 (이름 또는 번호)
bash setup-mcp.sh context7 github
bash setup-mcp.sh 1 3

# 타 PC에서 MCP 설치 (user scope - 전역)
SCOPE=user bash setup-mcp.sh

# 타 PC에서 Skills 설치 — 대화형 선택
bash setup-skills.sh

# 타 PC에서 Skills 설치 — 전체 / 특정 스킬만
bash setup-skills.sh all
bash setup-skills.sh gstack
```
