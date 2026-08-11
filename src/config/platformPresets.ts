/** 内容平台账号预设（微信 / 抖音 / 小红书等）——本机密码本 */

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
  /** 创作者 / 开放平台入口 */
  homeUrl: string;
  /** 公钥字段文案 */
  accountIdLabel: string;
  accountIdPlaceholder: string;
  /** 密码 / Token */
  accessKeyLabel: string;
  accessKeyPlaceholder: string;
  /** 私钥 */
  secretKeyLabel: string;
  secretKeyPlaceholder: string;
};

export const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    id: "wechat_mp",
    label: "微信公众号",
    homeUrl: "https://mp.weixin.qq.com/",
    accountIdLabel: "公钥（AppID）",
    accountIdPlaceholder: "wx……",
    accessKeyLabel: "密码 / AppSecret",
    accessKeyPlaceholder: "应用密钥",
    secretKeyLabel: "私钥 / Token（可选）",
    secretKeyPlaceholder: "可留空",
  },
  {
    id: "wechat_channels",
    label: "微信视频号",
    homeUrl: "https://channels.weixin.qq.com/",
    accountIdLabel: "公钥（账号 ID）",
    accountIdPlaceholder: "视频号标识",
    accessKeyLabel: "密码 / Access Token",
    accessKeyPlaceholder: "接口凭证",
    secretKeyLabel: "私钥 / Refresh Token",
    secretKeyPlaceholder: "刷新凭证",
  },
  {
    id: "xiaohongshu",
    label: "小红书",
    homeUrl: "https://creator.xiaohongshu.com/",
    accountIdLabel: "公钥（App Key / 账号）",
    accountIdPlaceholder: "开放平台 App Key",
    accessKeyLabel: "密码 / Access Token",
    accessKeyPlaceholder: "访问令牌或登录密码",
    secretKeyLabel: "私钥（App Secret）",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "douyin",
    label: "抖音",
    homeUrl: "https://creator.douyin.com/",
    accountIdLabel: "公钥（Client Key）",
    accountIdPlaceholder: "开放平台 Client Key",
    accessKeyLabel: "密码 / Access Token",
    accessKeyPlaceholder: "访问令牌或登录密码",
    secretKeyLabel: "私钥（Client Secret）",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "kuaishou",
    label: "快手",
    homeUrl: "https://cp.kuaishou.com/",
    accountIdLabel: "公钥（App ID）",
    accountIdPlaceholder: "开放平台 App ID",
    accessKeyLabel: "密码 / Access Token",
    accessKeyPlaceholder: "访问令牌或登录密码",
    secretKeyLabel: "私钥（App Secret）",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "bilibili",
    label: "哔哩哔哩",
    homeUrl: "https://member.bilibili.com/",
    accountIdLabel: "公钥（UID / client_id）",
    accountIdPlaceholder: "账号或应用 ID",
    accessKeyLabel: "密码 / Access Token",
    accessKeyPlaceholder: "访问令牌或登录密码",
    secretKeyLabel: "私钥（App Secret）",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "weibo",
    label: "微博",
    homeUrl: "https://weibo.com/",
    accountIdLabel: "公钥（App Key / UID）",
    accountIdPlaceholder: "开放平台 App Key",
    accessKeyLabel: "密码 / Access Token",
    accessKeyPlaceholder: "访问令牌或登录密码",
    secretKeyLabel: "私钥（App Secret）",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "zhihu",
    label: "知乎",
    homeUrl: "https://www.zhihu.com/",
    accountIdLabel: "公钥（Client ID / 账号）",
    accountIdPlaceholder: "开放平台 Client ID",
    accessKeyLabel: "密码 / Access Token",
    accessKeyPlaceholder: "访问令牌或登录密码",
    secretKeyLabel: "私钥（Client Secret）",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "twitter",
    label: "X / Twitter",
    homeUrl: "https://x.com/",
    accountIdLabel: "公钥（API Key / @handle）",
    accountIdPlaceholder: "API Key 或 @handle",
    accessKeyLabel: "密码 / Bearer Token",
    accessKeyPlaceholder: "Bearer / 登录密码",
    secretKeyLabel: "私钥（API Secret）",
    secretKeyPlaceholder: "密钥",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    homeUrl: "https://www.linkedin.com/",
    accountIdLabel: "公钥（Client ID）",
    accountIdPlaceholder: "Client ID",
    accessKeyLabel: "密码 / Access Token",
    accessKeyPlaceholder: "访问令牌或登录密码",
    secretKeyLabel: "私钥（Client Secret）",
    secretKeyPlaceholder: "应用密钥",
  },
  {
    id: "telegram",
    label: "Telegram",
    homeUrl: "https://my.telegram.org/",
    accountIdLabel: "公钥（Bot / Chat ID）",
    accountIdPlaceholder: "@bot 或 chat_id",
    accessKeyLabel: "密码 / Bot Token",
    accessKeyPlaceholder: "123456:ABC-DEF…",
    secretKeyLabel: "私钥（可选）",
    secretKeyPlaceholder: "可留空",
  },
  {
    id: "custom",
    label: "自定义平台",
    homeUrl: "",
    accountIdLabel: "公钥",
    accountIdPlaceholder: "账号 / App ID",
    accessKeyLabel: "密码 / Token",
    accessKeyPlaceholder: "登录密码或 Token",
    secretKeyLabel: "私钥",
    secretKeyPlaceholder: "Secret",
  },
];

export const PLATFORM_OPTIONS = PLATFORM_PRESETS.map((p) => ({
  value: p.id,
  label: p.label,
}));

export const getPlatform = (id: string): PlatformPreset =>
  PLATFORM_PRESETS.find((p) => p.id === id) ?? PLATFORM_PRESETS[PLATFORM_PRESETS.length - 1];

/** 预设显示中文名；自由输入则原样展示 */
export const platformLabel = (id: string): string => {
  const found = PLATFORM_PRESETS.find((p) => p.id === id);
  return found ? found.label : id;
};

export const platformHomeUrl = (id: string): string => {
  const found = PLATFORM_PRESETS.find((p) => p.id === id);
  return found?.homeUrl ?? "";
};
