# MCP Server Setup

Claude Code MCP 서버 설정을 여러 PC에서 동일하게 유지하기 위한 스크립트 모음입니다.

## 파일 구조

```
mcpserver/
├── generate-mcp-setup.js    # 현재 PC의 MCP 설정을 읽어 setup-mcp.sh 재생성
├── setup-mcp.sh             # 다른 PC에서 실행하는 MCP 설치 스크립트 (자동 생성)
├── generate-skills-setup.js # 현재 PC의 Skills를 읽어 setup-skills.sh 재생성
└── setup-skills.sh          # 다른 PC에서 실행하는 Skills 설치 스크립트 (자동 생성)
```

## MCP 서버 워크플로우

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

## Skills 워크플로우

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

### MCP 서버 설치

```bash
# 1. 저장소 clone
git clone https://github.com/PRsH1/mcpserver.git
cd mcpserver
git checkout mcpserver

# 2. MCP 서버 설치
bash setup-mcp.sh
```

### Skills 설치

```bash
# (저장소 clone 후)
bash setup-skills.sh
```

실행 시 토큰이 필요한 서버(GitHub 등)는 대화형으로 입력을 요청합니다.
입력 내용은 화면에 표시되지 않습니다.

### 적용 범위(scope) 옵션

| 명령어 | 설명 |
|--------|------|
| `bash setup-mcp.sh` | 현재 프로젝트에만 적용 (기본값) |
| `SCOPE=user bash setup-mcp.sh` | 모든 프로젝트에 전역 적용 |

### 중복 실행 시 동작

- 지정한 scope에 이미 같은 서버가 있으면 **삭제 후 재등록**합니다 (설정 업데이트 보장).
- 다른 scope에만 존재하는 경우 충돌 없이 추가됩니다.
- 따라서 설정이 변경된 후 **반복 실행해도 안전**합니다.

---

## 현재 등록된 MCP 서버

| 서버 | 타입 | 인증 |
|------|------|------|
| context7 | HTTP | 불필요 |
| notion | HTTP | 불필요 (HTTP 직접 등록, Claude.ai 계정 연동 아님) |
| github | HTTP | GitHub Personal Access Token 필요 |
| chrome-devtools | stdio | 불필요 (npx로 자동 설치) |
| claude.ai Gmail | HTTP | Claude.ai 계정 연동 (자동 연결) |

> **claude.ai Gmail** 은 Claude.ai 계정 OAuth로 연동됩니다.
> Claude Code 실행 후 동일 계정으로 로그인하면 자동으로 연결됩니다.

> **notion** 은 Claude.ai 계정 연동(OAuth) 버전을 제거하고 `https://mcp.notion.com/mcp` 에 HTTP로 직접 등록한 상태입니다 (user scope).

### GitHub Token 발급 방법

1. [https://github.com/settings/tokens](https://github.com/settings/tokens) 접속
2. **Generate new token (classic)** 클릭
3. 필요 권한 체크: `repo`, `read:org`, `read:user`, `copilot`
4. 생성된 토큰을 스크립트 실행 시 입력

---

## 새 MCP 서버 추가 후 동기화

이 PC에서 새 서버를 추가했을 때:

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

---

## 새 Skill 추가 후 동기화

이 PC에서 새 Skill을 설치했을 때:

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

> **감지 방식**: `~/.claude/skills/` 아래 `.git` 디렉토리가 있는 폴더만 루트 스킬로 인식합니다.
> 부모 스킬이 자동 생성한 서브스킬 디렉토리는 자동으로 제외됩니다.

---

## 현재 등록된 Skills

| 스킬 | 저장소 | setup 필요 |
|------|--------|-----------|
| gstack | https://github.com/garrytan/gstack.git | O (bun 필요) |

---

## generate-mcp-setup.js 상세

- `~/.claude.json`에서 루트 레벨 `mcpServers` (user scope)와 `projects[*].mcpServers` (project scope)를 모두 읽어 합산
- 같은 이름의 서버가 양쪽에 있으면 project scope 설정이 우선
- Authorization Bearer 토큰은 환경변수(`{NAME}_TOKEN`)로 치환하여 스크립트에 토큰이 노출되지 않도록 처리
