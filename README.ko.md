<p align="center">
  <img src="assets/banner.png" alt="AiDE Banner" width="800" />
</p>

<h1 align="center">AiDE — AI 개발 환경</h1>

<p align="center">
  <strong>중국어 LLM을 위한 데스크톱 코딩 에이전트 — Claude Code·Codex와 동등한 기능의 오픈소스 대안</strong>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-green" alt="Platform" />
  <img src="https://img.shields.io/badge/framework-Tauri%20v2-orange" alt="Framework" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node" />
  <img src="https://img.shields.io/badge/version-0.1.0-informational" alt="Version" />
</p>

<p align="center">
  <img src="assets/logos/deepseek.png" height="32" alt="DeepSeek" />
  &nbsp;&nbsp;
  <img src="assets/logos/qwen.png" height="32" alt="Qwen" />
  &nbsp;&nbsp;
  <img src="assets/logos/glm.png" height="32" alt="GLM" />
  &nbsp;&nbsp;
  <img src="assets/logos/kimi.png" height="32" alt="Kimi" />
  &nbsp;&nbsp;
  <img src="assets/logos/doubao.png" height="32" alt="Doubao" />
  &nbsp;&nbsp;
  <img src="assets/logos/minimax.png" height="32" alt="MiniMax" />
</p>

---

## 다운로드

<p align="center">

| 플랫폼 | 설치 파일 | 포터블 |
|---|---|---|
| **Windows x64** | [AiDE-0.1.0-x64-setup.exe](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-x64-setup.exe) | [AiDE-0.1.0-x64.zip](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-x64.zip) |
| **Windows arm64** | [AiDE-0.1.0-arm64-setup.exe](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-arm64-setup.exe) | [AiDE-0.1.0-arm64.zip](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-arm64.zip) |
| **macOS (Apple Silicon)** | [AiDE-0.1.0-aarch64.dmg](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-aarch64.dmg) | — |
| **macOS (Intel)** | [AiDE-0.1.0-x64.dmg](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-x64.dmg) | — |
| **Linux x64** | [AiDE-0.1.0-amd64.AppImage](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-amd64.AppImage) | [AiDE-0.1.0-amd64.deb](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-amd64.deb) |
| **Linux arm64** | [AiDE-0.1.0-arm64.AppImage](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-arm64.AppImage) | [AiDE-0.1.0-arm64.deb](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-arm64.deb) |
| **CLI (npm)** | `npm install -g @aide-dev/cli` | — |

</p>

> 모든 릴리스는 [GitHub Releases](https://github.com/appleweiping/AiDE-dev/releases) 페이지에 있습니다. 데스크톱 앱은 새 버전이 출시되면 자동으로 업데이트를 알립니다.

---

## AiDE란?

AiDE는 Claude Code와 Codex의 기능을 중국어 LLM 생태계에 제공하는 오픈소스 데스크톱 코딩 에이전트입니다. 경량 Tauri 셸(~5MB)을 통해 Windows·macOS·Linux에서 네이티브로 실행되며, DeepSeek·Qwen·GLM·Kimi·Doubao·MiniMax 또는 OpenAI 호환 API 엔드포인트에 연결할 수 있습니다. 파일 편집·셸 실행·웹 검색·Git 작업·MCP 도구 등 완전한 에이전트 루프가 로컬에서 실행되며, 3단계 권한 시스템으로 항상 제어권을 유지합니다.

## 왜 AiDE인가?

| | Claude Code | Codex | **AiDE** |
|---|---|---|---|
| 모델 지원 | Claude만 | GPT만 | **6개 중국어 LLM + OpenAI 호환 API** |
| 데스크톱 크기 | Electron (~150 MB) | Electron | **Tauri (~5 MB)** |
| 오픈소스 | 아니오 | 일부 | **예 — Apache-2.0** |
| 중국어 최적화 | 기본 | 기본 | **네이티브 중국어 UI + 중국어 모델 프리셋** |
| 커스텀 API 엔드포인트 | 우회 필요 | 우회 필요 | **일급 `base_url` + key 지원** |
| 가격 | $20/월~ | $20/월~ | **종량제; 중국어 모델로 최저 ¥0.001/호출** |
| 사고/추론 | Claude 3.7+ | o1/o3 | **DeepSeek R1, QwQ Plus** |
| 비전 | Claude 3+ | GPT-4V | **Qwen, GLM, Doubao** |
| 컨텍스트 윈도우 | 200K | 128K | **최대 1M 토큰 (MiniMax)** |

## 스크린샷

<!-- screenshots coming soon -->

---

## 기능

### 에이전트 기능

AiDE는 전체 코딩 워크플로우를 커버하는 15개의 내장 도구를 제공합니다:

| 도구 | 설명 |
|---|---|
| **FileRead** | 줄 번호 오프셋으로 파일 읽기; 이미지·PDF·Jupyter 노트북 지원 |
| **FileWrite** | 파일을 원자적으로 생성 또는 덮어쓰기 |
| **FileEdit** | 정밀한 문자열 교체 편집 — 전체 재작성 불필요 |
| **Bash** | 타임아웃 제어와 백그라운드 모드로 셸 명령 실행 |
| **PowerShell** | Bash와 동일한 안전 제어를 갖춘 Windows PowerShell 실행 |
| **Glob** | 대규모 코드베이스에서 빠른 파일 패턴 매칭 |
| **Grep** | ripgrep 기반 정규식 콘텐츠 검색 |
| **WebSearch** | 최신 정보를 위한 실시간 웹 검색 |
| **WebFetch** | 에이전트를 위한 URL 콘텐츠 가져오기 및 파싱 |
| **NotebookEdit** | Jupyter `.ipynb` 파일의 개별 셀 편집 |
| **Monitor** | 백그라운드 프로세스의 stdout 스트리밍; 각 줄이 이벤트 발생 |
| **NodeREPL** | 호출 간 상태를 유지하는 영구 JavaScript 실행 환경 |
| **Cron** | cron 표현식으로 일회성 또는 반복 작업 스케줄링 |
| **AskUser** | 에이전트 루프를 일시 중지하고 사용자에게 다중 선택 질문 제시 |
| **SubAgent** | 독립적인 하위 작업을 위한 병렬 서브에이전트 생성 |

### 데스크톱 애플리케이션

데스크톱 앱은 Tauri v2 + React로 구축되어 다음 패널로 구성됩니다:

**채팅 및 세션**
- `Chat` — 도구 호출 렌더링과 Diff 미리보기가 있는 스트리밍 메시지 뷰
- `SessionList` — 과거 대화 탐색·검색·복원
- `SessionTabs` — 멀티탭 인터페이스 (Ctrl+T / Ctrl+W); 우클릭 메뉴로 이름 변경·복제·다른 탭 닫기
- `TokenUsage` — 상태 표시줄에 실시간 토큰 수와 예상 비용 표시

**코드 리뷰 및 Diff**
- 헝크 단위로 수락/거부/편집할 수 있는 시각적 Diff 뷰어
- 구문 강조 표시된 나란히 보기 또는 통합 보기

**프로젝트 관리**
- `FileExplorer` — 클릭으로 열 수 있는 접을 수 있는 파일 트리 (Ctrl+B)
- `GitPanel` — 브랜치 목록·커밋 히스토리·스테이징 영역·PR 생성
- `WorktreePanel` — 격리된 실험을 위한 Git Worktree 생성 및 전환
- `RagPanel` — TF-IDF 기반 로컬 프로젝트 인덱스 검색

**자동화 및 에이전트**
- `Terminal` — 내장 xterm.js 터미널 (Ctrl+\`)
- `TaskList` — 실시간 진행 상황이 있는 플로팅 작업 체크리스트
- `SubAgentPanel` — 병렬 서브에이전트 실행 모니터링 및 관리
- `McpManager` — MCP 도구 서버 연결·설정·검사
- `PluginMarketplace` — 플러그인 탐색·설치·업데이트

**설정 및 시스템**
- `Settings` — 프로바이더 선택·API 키·모델·권한 모드·테마
- `CommandPalette` — 퍼지 검색 명령 실행기 (Ctrl+Shift+P)
- `ApprovalDialog` — "선택 기억" 기능이 있는 위험한 작업 승인 모달
- `UpdateNotification` — 버전 건너뛰기 지원 앱 내 업데이트 배너
- 백그라운드 작동을 위한 시스템 트레이 통합

### 프로바이더 지원

| 프로바이더 | 모델 | 컨텍스트 윈도우 | 도구 사용 | 사고 | 비전 |
|---|---|---|---|---|---|
| **DeepSeek** | deepseek-chat (V3), deepseek-reasoner (R1) | 64K | V3만 | R1 | 아니오 |
| **Qwen (Alibaba)** | qwen-max, qwen-plus, qwq-plus | 32K – 131K | 예 | QwQ | 예 |
| **GLM (Zhipu)** | glm-4-plus, glm-4-flash | 128K | 예 | 아니오 | 예 |
| **Kimi (Moonshot)** | moonshot-v1-128k, moonshot-v1-32k | 32K – 128K | 예 | 아니오 | 아니오 |
| **Doubao (ByteDance)** | doubao-1.5-pro-256k, doubao-1.5-lite-32k | 32K – 256K | 예 | 아니오 | 예 |
| **MiniMax** | MiniMax-Text-01 | 1,000,000 | 예 | 아니오 | 아니오 |
| **커스텀** | 모든 모델 | 설정 가능 | 엔드포인트 의존 | 엔드포인트 의존 | 엔드포인트 의존 |

### 확장성

- **MCP 프로토콜** — 모든 MCP 도구 서버에 연결; 도구 검색·리소스 읽기·멀티서버 병렬 연결을 포함한 전체 클라이언트 사양 구현
- **플러그인 시스템** — 플러그인은 표준 npm 패키지; 커스텀 도구·명령·UI 패널 등록 가능
- **VS Code 확장** — VS Code 내에서 AiDE 에이전트 사용 (Phase 3)
- **OpenAI 호환 API** — OpenAI 채팅 완성 형식을 지원하는 모든 프로바이더가 즉시 작동

### 보안 및 권한

AiDE는 3단계 권한 모델을 사용합니다:

| 모드 | 동작 |
|---|---|
| **안전** (기본값) | 모든 파일 쓰기와 셸 명령에 명시적 승인 필요 |
| **신뢰** | 승인된 명령은 자동 실행; 새로운 고위험 작업만 확인 |
| **잠금** | 읽기 전용 모드; 쓰기나 셸 실행 불가 |

승인 시스템은 위험 수준별로 명령을 분류하고, 실행 전 전체 명령이 담긴 모달을 표시하며, "이 선택 기억" 기능을 지원합니다. 파일 샌드박스는 설정된 작업 디렉토리 내로 쓰기를 제한합니다.

---

## 빠른 시작

### 사전 요구 사항

- Node.js 22 이상
- pnpm 9 이상
- Rust stable 툴체인 (Tauri 셸 컴파일용 — [rustup.rs](https://rustup.rs)로 설치)
- Windows 10+ / macOS 12+ / Ubuntu 20.04+

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/AiDE-dev/aide.git
cd aide

# 모든 워크스페이스 의존성 설치
pnpm install

# 개발 모드로 데스크톱 앱 시작 (핫 리로드)
pnpm --filter @aide/desktop tauri dev

# 또는 CLI만 사용 (Rust 불필요)
pnpm --filter @aide/cli dev -- --provider deepseek --key sk-xxx "이 프로젝트의 아키텍처를 설명해줘"
```

### 프로덕션 빌드

```bash
# 데스크톱 설치 파일 빌드
pnpm --filter @aide/desktop tauri build

# 출력 위치:
# Windows:  packages/desktop/src-tauri/target/release/bundle/msi/
# macOS:    packages/desktop/src-tauri/target/release/bundle/dmg/
# Linux:    packages/desktop/src-tauri/target/release/bundle/appimage/
```

---

## 설정

### 첫 실행

첫 실행 시 설정 패널을 엽니다 (기어 아이콘 또는 Ctrl+Shift+P → "Settings"):

1. 드롭다운에서 프로바이더 선택
2. API 키 입력
3. 모델 선택
4. "연결 테스트" 클릭

### 설정 파일

AiDE는 설정을 `~/.aide/config.toml`에 저장합니다:

```toml
[provider]
id = "deepseek"
base_url = "https://api.deepseek.com"
api_key = "sk-xxx"
model = "deepseek-chat"

[agent]
max_iterations = 50
thinking_enabled = true
permission_mode = "safe"   # safe | trusted | locked

[[mcp.servers]]
name = "filesystem"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "./"]
```

### 환경 변수

| 변수 | 설명 |
|---|---|
| `AIDE_PROVIDER` | 기본 프로바이더 ID (예: `deepseek`) |
| `AIDE_API_KEY` | API 키 (설정 파일 덮어쓰기) |
| `AIDE_BASE_URL` | 커스텀 API 기본 URL |
| `AIDE_MODEL` | 사용할 모델 ID |
| `AIDE_PERMISSION_MODE` | `safe`, `trusted`, 또는 `locked` |
| `AIDE_WORK_DIR` | 에이전트 작업 디렉토리 |
| `AIDE_MAX_ITERATIONS` | 에이전트 루프 최대 반복 횟수 (기본값: 50) |

---

## CLI 레퍼런스

```bash
aide [옵션] [프롬프트]
```

| 플래그 | 단축형 | 설명 |
|---|---|---|
| `--provider <id>` | `-p` | 프로바이더 ID: `deepseek`, `qwen`, `glm`, `kimi`, `doubao`, `minimax`, `custom` |
| `--key <key>` | `-k` | API 키 |
| `--base-url <url>` | | 커스텀 API 기본 URL |
| `--model <id>` | `-m` | 모델 ID |
| `--dir <path>` | `-d` | 작업 디렉토리 (기본값: 현재 디렉토리) |
| `--thinking` | | 사고/추론 모드 활성화 |
| `--permission <mode>` | | 권한 모드: `safe`, `trusted`, `locked` |
| `--max-iter <n>` | | 에이전트 최대 반복 횟수 (기본값: 50) |
| `--interactive` | `-i` | 인터랙티브 REPL 세션 시작 |
| `--version` | `-v` | 버전 출력 후 종료 |
| `--help` | `-h` | 도움말 표시 |

---

## 로드맵

### Phase 1 — 기반 (완료)

- [x] 채팅 인터페이스가 있는 데스크톱 앱
- [x] 6개 중국어 LLM 프로바이더 프리셋
- [x] 완전한 도구 스위트 (15개 도구)
- [x] 승인 다이얼로그가 있는 3단계 권한 시스템
- [x] 세션 영속성 (JSON)
- [x] 이중 언어 UI (영어 + 중국어)
- [x] 시각적 Diff 뷰어
- [x] 플랜 모드
- [x] 명령 팔레트
- [x] MCP 클라이언트
- [x] 플러그인 시스템

### Phase 2 — 협업 (완료)

- [x] MCP 매니저 UI
- [x] Git 워크플로우 패널
- [x] 서브에이전트 병렬 작업 실행
- [x] 자동 업데이터
- [x] SQLite 세션 스토어
- [x] 세션 탭 (멀티탭 인터페이스)
- [x] Worktree 패널

### Phase 3 — 인텔리전스 (완료)

- [x] 플러그인 마켓플레이스
- [x] Worktree 샌드박스
- [x] RAG 로컬 인덱싱 (TF-IDF)
- [x] VS Code 확장 스캐폴드
- [x] 서브에이전트 패널 UI

### Phase 4 — 미래

- [ ] 모바일 컴패니언 앱 (iOS / Android)
- [ ] 음성 입력 및 텍스트 음성 변환 출력
- [ ] 협업 모드 (공유 세션, 멀티유저)
- [ ] 세션 및 설정 클라우드 동기화
- [ ] 중국어 LLM을 위한 파인튜닝된 도구 사용 모델
- [ ] 시맨틱 RAG (벡터 임베딩)

---

## 기여

전체 가이드는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참조하세요.

---

## 자주 묻는 질문

**Q: AiDE를 사용하려면 유료 구독이 필요한가요?**
아니오. AiDE는 무료 오픈소스입니다. 선택한 프로바이더에 대한 API 호출 비용만 지불합니다. DeepSeek V3는 1K 토큰당 약 ¥0.001 — Claude Code나 Codex 구독보다 훨씬 저렴합니다.

**Q: AiDE가 내 코드를 서드파티 서버에 전송하나요?**
AiDE는 설정한 LLM 프로바이더에 명시적으로 전송한 메시지만 보냅니다. 텔레메트리·분석·데이터 수집은 일절 없습니다. 에이전트는 완전히 사용자의 머신에서 실행됩니다.

**Q: 로컬 모델 (Ollama, LM Studio)과 함께 사용할 수 있나요?**
예. 프로바이더로 "Custom"을 선택하고, 기본 URL을 로컬 서버(예: `http://localhost:11434/v1`)로 설정하고, API 키에 임의의 문자열을 입력합니다. 도구 사용은 로컬 모델이 OpenAI function-calling 형식을 지원하는지에 따라 달라집니다.

**Q: AiDE는 Cursor나 Windsurf와 어떻게 다른가요?**
Cursor와 Windsurf는 완전한 IDE 대체품입니다. AiDE는 기존 편집기와 함께 작동하는 독립형 에이전트입니다. Claude Code나 Codex와 철학적으로 더 가깝습니다 — 특정 작업을 위해 호출하는 터미널/데스크톱 에이전트입니다.

**Q: Tauri 빌드가 실패합니다. 어떻게 해야 하나요?**
Rust stable 툴체인이 설치되어 있는지 확인하세요 (`rustup toolchain install stable`). Windows에서는 MSVC 빌드 도구 (Visual Studio Build Tools 2022)도 필요합니다. 플랫폼별 지침은 [Tauri 사전 요구 사항 가이드](https://tauri.app/start/prerequisites/)를 참조하세요.

---

## 라이선스

[Apache-2.0](LICENSE) — 상업적 이용을 포함하여 자유롭게 사용·수정·배포할 수 있습니다.

---

## 감사의 말

- [Tauri](https://tauri.app) — 5MB 크로스플랫폼 데스크톱 앱을 가능하게 해준 것에 감사
- [React](https://react.dev)와 React 생태계
- [xterm.js](https://xtermjs.org) — 터미널 에뮬레이터
- [DeepSeek](https://deepseek.com), [Alibaba Cloud](https://www.alibabacloud.com), [Zhipu AI](https://zhipuai.cn), [Moonshot AI](https://moonshot.cn), [ByteDance](https://bytedance.com), [MiniMax](https://minimax.chat) — 세계 수준의 LLM과 오픈 API 구축에 감사
- [Model Context Protocol](https://modelcontextprotocol.io) 팀 (Anthropic)
- 모든 기여자와 얼리 어답터
