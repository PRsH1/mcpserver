# MCP Server Setup

Claude Code MCP 서버 설정과 Skills를 여러 PC에서 동일하게 유지하기 위한 스크립트 모음입니다.

## 파일 구조

```
mcpserver/
├── generate-mcp-setup.js    # 현재 PC의 MCP 설정을 읽어 setup-mcp.sh 재생성
├── setup-mcp.sh             # 다른 PC에서 실행하는 MCP 설치 스크립트 (자동 생성)
├── generate-skills-setup.js # 현재 PC의 Skills를 읽어 setup-skills.sh 재생성
└── setup-skills.sh          # 다른 PC에서 실행하는 Skills 설치 스크립트 (자동 생성)
```

## 워크플로우

### MCP 서버

```
이 PC에서 새 MCP 서버 추가
          ↓
  claude mcp add [서버명] ...
          ↓
  node generate-mcp-setup.js   ← setup-mcp.sh 자동 업데이트
          ↓
       git push
          ↓
  다른 PC에서 git pull 후
  bash setup-mcp.sh
```

### Skills

```
이 PC에서 새 Skill 설치
          ↓
  git clone ... ~/.claude/skills/[스킬명]
          ↓
  node generate-skills-setup.js  ← setup-skills.sh 자동 업데이트
          ↓
       git push
          ↓
  다른 PC에서 git pull 후
  bash setup-skills.sh
```

---

## 다른 PC에서 설치하기

### 사전 요구사항

- [Claude Code](https://claude.ai/code) 설치
- Node.js 설치 (generate 스크립트 실행 시 필요)
- Git 설치
- [Bun](https://bun.sh/) 설치 (gstack 등 일부 스킬에 필요)

### 저장소 clone

```bash
git clone https://github.com/PRsH1/mcpserver.git
cd mcpserver
git checkout mcpserver
```

### MCP 서버 설치

```bash
bash setup-mcp.sh
```

실행하면 설치할 서버를 선택할 수 있습니다.

```
사용 가능한 MCP 서버:
  [1] context7             HTTP  [user]
  [2] notion               HTTP  [user]
  [3] github               HTTP  [user]   (키 필요)
  [4] chrome-devtools      stdio [user]
  [5] filesystem           stdio [user]
  [6] brave-search         stdio [user]   (키 필요)

설치할 서버를 선택하세요 (번호·이름 공백 구분, all=전체, Enter=전체)
> 1 3
```

존재하지 않는 서버명·번호를 입력하면 경고 후 자동으로 무시됩니다.

| 실행 방법 | 설명 |
|-----------|------|
| `bash setup-mcp.sh` | 대화형 선택 (번호·이름 입력 또는 Enter=전체) |
| `bash setup-mcp.sh all` | 전체 설치 |
| `bash setup-mcp.sh context7 github` | 이름으로 직접 지정 |
| `bash setup-mcp.sh 1 3` | 번호로 직접 지정 |
| `SCOPE=user bash setup-mcp.sh` | user scope로 전역 설치 |

토큰이 필요한 서버(GitHub 등)는 해당 서버를 선택했을 때만 입력을 요청합니다.
입력 내용은 화면에 표시되지 않습니다.

### Skills 설치

```bash
bash setup-skills.sh
```

MCP와 동일한 방식으로 선택할 수 있습니다.

```
사용 가능한 Skills:
  [1] gstack               github:garrytan/gstack.git (setup 있음)

설치할 스킬을 선택하세요 (번호·이름 공백 구분, all=전체, Enter=전체)
> 1
```

| 실행 방법 | 설명 |
|-----------|------|
| `bash setup-skills.sh` | 대화형 선택 |
| `bash setup-skills.sh all` | 전체 설치 |
| `bash setup-skills.sh gstack` | 이름으로 직접 지정 |

이미 설치된 스킬은 `git pull --rebase`로 업데이트합니다.

### 적용 범위(scope) 옵션 — MCP 전용

| 명령어 | 설명 |
|--------|------|
| `bash setup-mcp.sh` | 현재 프로젝트에만 적용 (기본값: local) |
| `SCOPE=user bash setup-mcp.sh` | 모든 프로젝트에 전역 적용 |
| `SCOPE=project bash setup-mcp.sh` | 현재 프로젝트에 적용 (local과 동일) |

유효한 SCOPE 값은 `local`, `user`, `project` 세 가지입니다. 그 외 값을 지정하면 즉시 에러가 출력됩니다.

### 중복 실행 시 동작

- **MCP**: 지정한 scope에 이미 같은 서버가 있으면 삭제 후 재등록 (설정 업데이트 보장)
- **Skills**: 이미 설치된 경우 `git pull --rebase`로 업데이트
- 반복 실행해도 안전합니다.

---

## 현재 등록된 MCP 서버

| 서버 | 타입 | 인증 | 용도 |
|------|------|------|------|
| context7 | HTTP | 불필요 | 라이브러리·프레임워크 문서 검색 |
| notion | HTTP | 불필요 (HTTP 직접 등록) | Notion 페이지 읽기/쓰기 |
| github | HTTP | GitHub PAT 필요 | 이슈·PR·코드 검색 |
| chrome-devtools | stdio | 불필요 (npx 자동 설치) | 브라우저 자동화·디버깅 |
| filesystem | stdio | 불필요 | 로컬 파일 읽기/쓰기 |
| brave-search | stdio | Brave API Key 필요 | 웹 검색 |
| claude.ai Gmail | HTTP | Claude.ai 계정 연동 (자동) | Gmail 읽기/쓰기 |

> **claude.ai Gmail** 은 Claude.ai 계정 OAuth로 연동됩니다.
> Claude Code 실행 후 동일 계정으로 로그인하면 자동으로 연결됩니다.

> **notion** 은 Claude.ai 계정 연동(OAuth) 버전을 제거하고 `https://mcp.notion.com/mcp` 에 HTTP로 직접 등록한 상태입니다 (user scope).

> **filesystem** 은 `C:/Users/LSH`, `D:/Workspace`, `D:/` 세 경로에 접근을 허용합니다.
> 다른 PC에서 설치 시 경로를 조정하려면 `claude mcp add` 후 `generate-mcp-setup.js`를 재실행하세요.

### GitHub Token 발급 방법

1. [https://github.com/settings/tokens](https://github.com/settings/tokens) 접속
2. **Generate new token (classic)** 클릭
3. 필요 권한 체크: `repo`, `read:org`, `read:user`, `copilot`
4. 생성된 토큰을 스크립트 실행 시 입력

### Brave Search API Key 발급 방법

1. [https://brave.com/search/api](https://brave.com/search/api) 접속
2. 무료 플랜으로 가입 (2,000 queries/월 무료)
3. API Key 발급 후 스크립트 실행 시 입력

---

## 현재 등록된 Skills

| 스킬 | 저장소 | setup 필요 |
|------|--------|-----------|
| gstack | https://github.com/garrytan/gstack.git | O (bun 필요) |

> **감지 방식**: `~/.claude/skills/` 아래 `.git` 디렉토리가 있는 폴더만 루트 스킬로 인식합니다.
> 부모 스킬이 자동 생성한 서브스킬 디렉토리(예: `gstack-*`)는 자동으로 제외됩니다.

---

## 새 MCP 서버 추가 후 동기화

```bash
# 1. Claude Code에 MCP 서버 추가
claude mcp add [서버명] --transport http [URL]

# 2. setup-mcp.sh 재생성
node generate-mcp-setup.js

# 3. 변경사항 push
git add setup-mcp.sh
git commit -m "MCP 서버 추가: [서버명]"
git push
```

## 새 Skill 추가 후 동기화

```bash
# 1. Skill 설치 (git clone 방식)
git clone --single-branch --depth 1 [REPO_URL] ~/.claude/skills/[스킬명]
cd ~/.claude/skills/[스킬명] && ./setup  # setup 스크립트가 있는 경우

# 2. setup-skills.sh 재생성
node generate-skills-setup.js

# 3. 변경사항 push
git add setup-skills.sh
git commit -m "Skills 추가: [스킬명]"
git push
```

---

## generate-mcp-setup.js 상세

- `~/.claude.json`에서 루트 레벨 `mcpServers` (user scope)와 `projects[*].mcpServers` (project scope)를 모두 읽어 합산
- 같은 이름의 서버가 양쪽에 있으면 project scope 설정이 우선
- 각 서버의 원본 scope를 추적하여 서버 목록에 `[user]` / `[project]` 태그로 표시
- 시크릿 자동 처리 (스크립트에 값 노출 없음):
  - HTTP 서버의 `Authorization: Bearer` 헤더 → `{NAME}_TOKEN` 환경변수로 치환
  - stdio 서버의 `env` 필드 → 동일 키 이름의 환경변수로 치환 (예: `BRAVE_API_KEY`)
  - 설치 시 해당 서버가 선택된 경우에만 대화형으로 입력 요청
- `npx pkg@latest` 형태의 패키지는 generate 실행 시 `npm view`로 현재 버전을 조회해 고정
- URL, 커맨드, 인자 등 설정값에 포함된 특수문자(`"`, `$`, `` ` ``, `\`)는 자동으로 이스케이프
- 각 서버 설치 실패 시 전체 중단 없이 계속 진행, 마지막에 실패 목록 일괄 출력
