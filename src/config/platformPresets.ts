/** 内容平台账号预设（微信 / 抖音 / 小红书等） */

export type PlatformId =
  | "wechat_mp"
  | "wechat_channels"
  | "xiaohongshu"
  | "douyin"
  | "kuaishou"
  | "bilibili"
  | "weibo"
  | "zhihu"
  | "twitter"
  | "linkedin"
  | "telegram"
  | "custom";

export type PlatformPreset = {
  id: PlatformId;
  label: string;
  /** 账号标识字段文案 */
  accountIdLabel: string;
  accountIdPlaceholder: string;
  /** 主密钥字段文案 */
  accessKeyLabel: string;
  accessKeyPlaceholder: string;
  /** 辅密钥字段文案 */
  secretKeyLabel: string;
  secretKeyPlaceholder: string;
};

export const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    id: "wechat_mp",
    label: "微信公众号",
    accountIdLabel: "AppID",
    accountIdPlaceholder: "wx……",
    accessKeyLabel: "AppSecret",
    accessKeyPlaceholder: "应用密钥",
    secretKeyLabel: "Access Token（可选）",
    secretKeyPlaceholder: "可留空，运行时再换取",
  },
  {
    id: "wechat_channels",
    label: "微信视频号",
    accountIdLabel: "账号 / 主体 ID",
    accountIdPlaceholder: "视频号标识",
    accessKeyLabel: "Access Token",
    accessKeyPlaceholder: "接口凭证",
    secretKeyLabel: "Refresh Token（可选）",
    secretKeyPlaceholder: "刷新凭证",
  },
  {
    id: "xiaohongshu",
    label: "小红书",
    accountIdLabel: "App Key / 账号",
    accountIdPlaceholder: "开放平台 App Key",
    accessKeyLabel: "Access Token",
    accessKeyPlaceholder: "访问令牌",
    secretKeyLabel: "App Secret",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "douyin",
    label: "抖音",
    accountIdLabel: "Client Key / open_id",
    accountIdPlaceholder: "开放平台 Client Key",
    accessKeyLabel: "Access Token",
    accessKeyPlaceholder: "访问令牌",
    secretKeyLabel: "Client Secret",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "kuaishou",
    label: "快手",
    accountIdLabel: "App ID / open_id",
    accountIdPlaceholder: "开放平台 App ID",
    accessKeyLabel: "Access Token",
    accessKeyPlaceholder: "访问令牌",
    secretKeyLabel: "App Secret",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "bilibili",
    label: "哔哩哔哩",
    accountIdLabel: "UID / client_id",
    accountIdPlaceholder: "账号或应用 ID",
    accessKeyLabel: "Access Token",
    accessKeyPlaceholder: "访问令牌",
    secretKeyLabel: "App Secret",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "weibo",
    label: "微博",
    accountIdLabel: "App Key / UID",
    accountIdPlaceholder: "开放平台 App Key",
    accessKeyLabel: "Access Token",
    accessKeyPlaceholder: "访问令牌",
    secretKeyLabel: "App Secret",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "zhihu",
    label: "知乎",
    accountIdLabel: "Client ID / 账号",
    accountIdPlaceholder: "开放平台 Client ID",
    accessKeyLabel: "Access Token",
    accessKeyPlaceholder: "访问令牌",
    secretKeyLabel: "Client Secret",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "twitter",
    label: "X / Twitter",
    accountIdLabel: "API Key / username",
    accountIdPlaceholder: "API Key 或 @handle",
    accessKeyLabel: "Bearer / Access Token",
    accessKeyPlaceholder: "Bearer Token",
    secretKeyLabel: "API Secret / Access Secret",
    secretKeyPlaceholder: "密钥",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    accountIdLabel: "Client ID / URN",
    accountIdPlaceholder: "Client ID",
    accessKeyLabel: "Access Token",
    accessKeyPlaceholder: "访问令牌",
    secretKeyLabel: "Client Secret",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "telegram",
    label: "Telegram",
    accountIdLabel: "Bot username / Chat ID",
    accountIdPlaceholder: "@bot 或 chat_id",
    accessKeyLabel: "Bot Token",
    accessKeyPlaceholder: "123456:ABC-DEF…",
    secretKeyLabel: "备用密钥（可选）",
    secretKeyPlaceholder: "可留空",
  },
  {
    id: "custom",
    label: "自定义平台",
    accountIdLabel: "账号标识",
    accountIdPlaceholder: "平台侧账号 / App ID",
    accessKeyLabel: "主密钥",
    accessKeyPlaceholder: "Token / API Key",
    secretKeyLabel: "辅密钥（可选）",
    secretKeyPlaceholder: "Secret / Refresh Token",
  },
];

export const PLATFORM_OPTIONS = PLATFORM_PRESETS.map((p) => ({
  value: p.id,
  label: p.label,
}));

export const getPlatform = (id: string): PlatformPreset =>
  PLATFORM_PRESETS.find((p) => p.id === id) ?? PLATFORM_PRESETS[PLATFORM_PRESETS.length - 1];

export const platformLabel = (id: string): string => getPlatform(id).label;
