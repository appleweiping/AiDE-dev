// i18n/index.ts — Mobile app internationalization
// Supports EN, ZH-CN, JA, KO — auto-detects device locale

import { getLocales } from 'expo-localization';

export type Locale = 'en' | 'zh' | 'ja' | 'ko';

export interface Strings {
  // Navigation
  chat: string;
  sessions: string;
  files: string;
  git: string;
  connect: string;

  // Chat
  messagePlaceholder: string;
  cancel: string;
  desktopConnected: string;
  desktopOffline: string;
  selectSession: string;
  notConnected: string;
  thinking: string;
  reasoning: string;

  // Approval
  approvalRequired: string;
  allow: string;
  deny: string;
  rememberChoice: string;

  // Sessions
  noSessions: string;
  newSession: string;
  forkSession: string;
  deleteSession: string;
  workingDir: string;

  // Model switcher
  switchModel: string;
  currentModel: string;
  provider: string;
  model: string;

  // Files
  fileExplorer: string;
  loading: string;
  noFiles: string;

  // Git
  gitStatus: string;
  branch: string;
  staged: string;
  unstaged: string;
  untracked: string;
  commitHistory: string;
  noChanges: string;

  // Connect
  connectToDesktop: string;
  scanQrCode: string;
  relayUrl: string;
  authToken: string;
  pushNotifications: string;
  ntfyTopic: string;
  ntfyHint: string;
  connectBtn: string;
  disconnectBtn: string;
  connecting: string;
  connected: string;
  connectionFailed: string;
  disconnected: string;
  missingFields: string;
  invalidQr: string;

  // Tool calls
  toolRunning: string;
  toolDone: string;
  toolError: string;
  showDetails: string;
  hideDetails: string;
  arguments: string;
  output: string;
  duration: string;

  // Diff
  added: string;
  removed: string;
  unchanged: string;
  diffPreview: string;
}

const en: Strings = {
  chat: 'Chat', sessions: 'Sessions', files: 'Files', git: 'Git', connect: 'Connect',
  messagePlaceholder: 'Message AiDE...', cancel: 'Cancel',
  desktopConnected: 'Desktop connected', desktopOffline: 'Desktop offline',
  selectSession: 'Select a session to start chatting', notConnected: 'Not connected to desktop',
  thinking: 'Thinking...', reasoning: 'Reasoning',
  approvalRequired: 'Approval Required', allow: 'Allow', deny: 'Deny', rememberChoice: 'Remember this choice',
  noSessions: 'No sessions yet', newSession: 'New Session', forkSession: 'Fork Session',
  deleteSession: 'Delete Session', workingDir: 'Working directory',
  switchModel: 'Switch Model', currentModel: 'Current model', provider: 'Provider', model: 'Model',
  fileExplorer: 'File Explorer', loading: 'Loading...', noFiles: 'No files',
  gitStatus: 'Git Status', branch: 'Branch', staged: 'Staged', unstaged: 'Unstaged',
  untracked: 'Untracked', commitHistory: 'Commit History', noChanges: 'No changes',
  connectToDesktop: 'Connect to Desktop',
  scanQrCode: 'Scan QR Code from AiDE desktop',
  relayUrl: 'Relay URL', authToken: 'Auth Token',
  pushNotifications: 'Push Notifications', ntfyTopic: 'ntfy topic (optional)',
  ntfyHint: 'Install the ntfy app and subscribe to this topic for notifications.',
  connectBtn: 'Connect', disconnectBtn: 'Disconnect',
  connecting: 'Connecting...', connected: 'Connected',
  connectionFailed: 'Connection failed', disconnected: 'Disconnected',
  missingFields: 'Enter relay URL and token, or scan the QR code.',
  invalidQr: 'Could not parse AiDE connection info.',
  toolRunning: 'Running', toolDone: 'Done', toolError: 'Error',
  showDetails: 'Show details', hideDetails: 'Hide details',
  arguments: 'Arguments', output: 'Output', duration: 'Duration',
  added: 'Added', removed: 'Removed', unchanged: 'Unchanged', diffPreview: 'Diff Preview',
};

const zh: Strings = {
  chat: '对话', sessions: '会话', files: '文件', git: 'Git', connect: '连接',
  messagePlaceholder: '发送消息给 AiDE...', cancel: '取消',
  desktopConnected: '桌面端已连接', desktopOffline: '桌面端离线',
  selectSession: '选择一个会话开始对话', notConnected: '未连接到桌面端',
  thinking: '思考中...', reasoning: '推理过程',
  approvalRequired: '需要审批', allow: '允许', deny: '拒绝', rememberChoice: '记住此选择',
  noSessions: '暂无会话', newSession: '新建会话', forkSession: '分叉会话',
  deleteSession: '删除会话', workingDir: '工作目录',
  switchModel: '切换模型', currentModel: '当前模型', provider: '提供商', model: '模型',
  fileExplorer: '文件浏览器', loading: '加载中...', noFiles: '暂无文件',
  gitStatus: 'Git 状态', branch: '分支', staged: '已暂存', unstaged: '未暂存',
  untracked: '未追踪', commitHistory: '提交历史', noChanges: '无变更',
  connectToDesktop: '连接到桌面端',
  scanQrCode: '扫描 AiDE 桌面端的二维码',
  relayUrl: '中继服务器地址', authToken: '认证令牌',
  pushNotifications: '推送通知', ntfyTopic: 'ntfy 主题（可选）',
  ntfyHint: '安装 ntfy 应用并订阅此主题以接收通知。',
  connectBtn: '连接', disconnectBtn: '断开连接',
  connecting: '连接中...', connected: '已连接',
  connectionFailed: '连接失败', disconnected: '已断开',
  missingFields: '请输入中继地址和令牌，或扫描二维码。',
  invalidQr: '无法解析 AiDE 连接信息。',
  toolRunning: '运行中', toolDone: '完成', toolError: '错误',
  showDetails: '展开详情', hideDetails: '收起详情',
  arguments: '参数', output: '输出', duration: '耗时',
  added: '新增', removed: '删除', unchanged: '未变', diffPreview: 'Diff 预览',
};

const ja: Strings = {
  chat: 'チャット', sessions: 'セッション', files: 'ファイル', git: 'Git', connect: '接続',
  messagePlaceholder: 'AiDEにメッセージを送信...', cancel: 'キャンセル',
  desktopConnected: 'デスクトップ接続済み', desktopOffline: 'デスクトップオフライン',
  selectSession: 'セッションを選択してチャットを開始', notConnected: 'デスクトップに未接続',
  thinking: '考え中...', reasoning: '推論プロセス',
  approvalRequired: '承認が必要', allow: '許可', deny: '拒否', rememberChoice: 'この選択を記憶',
  noSessions: 'セッションなし', newSession: '新しいセッション', forkSession: 'セッションをフォーク',
  deleteSession: 'セッションを削除', workingDir: '作業ディレクトリ',
  switchModel: 'モデルを切り替え', currentModel: '現在のモデル', provider: 'プロバイダー', model: 'モデル',
  fileExplorer: 'ファイルエクスプローラー', loading: '読み込み中...', noFiles: 'ファイルなし',
  gitStatus: 'Gitステータス', branch: 'ブランチ', staged: 'ステージ済み', unstaged: '未ステージ',
  untracked: '未追跡', commitHistory: 'コミット履歴', noChanges: '変更なし',
  connectToDesktop: 'デスクトップに接続',
  scanQrCode: 'AiDEデスクトップのQRコードをスキャン',
  relayUrl: 'リレーURL', authToken: '認証トークン',
  pushNotifications: 'プッシュ通知', ntfyTopic: 'ntfyトピック（任意）',
  ntfyHint: 'ntfyアプリをインストールしてこのトピックを購読すると通知を受け取れます。',
  connectBtn: '接続', disconnectBtn: '切断',
  connecting: '接続中...', connected: '接続済み',
  connectionFailed: '接続失敗', disconnected: '切断済み',
  missingFields: 'リレーURLとトークンを入力するか、QRコードをスキャンしてください。',
  invalidQr: 'AiDE接続情報を解析できませんでした。',
  toolRunning: '実行中', toolDone: '完了', toolError: 'エラー',
  showDetails: '詳細を表示', hideDetails: '詳細を非表示',
  arguments: '引数', output: '出力', duration: '所要時間',
  added: '追加', removed: '削除', unchanged: '変更なし', diffPreview: 'Diffプレビュー',
};

const ko: Strings = {
  chat: '채팅', sessions: '세션', files: '파일', git: 'Git', connect: '연결',
  messagePlaceholder: 'AiDE에 메시지 보내기...', cancel: '취소',
  desktopConnected: '데스크톱 연결됨', desktopOffline: '데스크톱 오프라인',
  selectSession: '채팅을 시작할 세션을 선택하세요', notConnected: '데스크톱에 연결되지 않음',
  thinking: '생각 중...', reasoning: '추론 과정',
  approvalRequired: '승인 필요', allow: '허용', deny: '거부', rememberChoice: '이 선택 기억',
  noSessions: '세션 없음', newSession: '새 세션', forkSession: '세션 포크',
  deleteSession: '세션 삭제', workingDir: '작업 디렉토리',
  switchModel: '모델 전환', currentModel: '현재 모델', provider: '프로바이더', model: '모델',
  fileExplorer: '파일 탐색기', loading: '로딩 중...', noFiles: '파일 없음',
  gitStatus: 'Git 상태', branch: '브랜치', staged: '스테이지됨', unstaged: '스테이지 안됨',
  untracked: '추적 안됨', commitHistory: '커밋 히스토리', noChanges: '변경 없음',
  connectToDesktop: '데스크톱에 연결',
  scanQrCode: 'AiDE 데스크톱의 QR 코드 스캔',
  relayUrl: '릴레이 URL', authToken: '인증 토큰',
  pushNotifications: '푸시 알림', ntfyTopic: 'ntfy 토픽 (선택)',
  ntfyHint: 'ntfy 앱을 설치하고 이 토픽을 구독하면 알림을 받을 수 있습니다.',
  connectBtn: '연결', disconnectBtn: '연결 해제',
  connecting: '연결 중...', connected: '연결됨',
  connectionFailed: '연결 실패', disconnected: '연결 해제됨',
  missingFields: '릴레이 URL과 토큰을 입력하거나 QR 코드를 스캔하세요.',
  invalidQr: 'AiDE 연결 정보를 파싱할 수 없습니다.',
  toolRunning: '실행 중', toolDone: '완료', toolError: '오류',
  showDetails: '상세 보기', hideDetails: '상세 숨기기',
  arguments: '인수', output: '출력', duration: '소요 시간',
  added: '추가됨', removed: '삭제됨', unchanged: '변경 없음', diffPreview: 'Diff 미리보기',
};

const LOCALES: Record<Locale, Strings> = { en, zh, ja, ko };

function detectLocale(): Locale {
  try {
    const tag = getLocales()[0]?.languageTag ?? 'en';
    if (tag.startsWith('zh')) return 'zh';
    if (tag.startsWith('ja')) return 'ja';
    if (tag.startsWith('ko')) return 'ko';
  } catch { /* ignore */ }
  return 'en';
}

let currentLocale: Locale = detectLocale();

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(): Strings {
  return LOCALES[currentLocale];
}

export function useTranslation(): Strings {
  return LOCALES[currentLocale];
}
