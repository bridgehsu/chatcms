import type { ChannelKind } from "@/types";

export type ChannelPreset = {
  kind: ChannelKind;
  label: string;
  description: string;
};

/** 渠道目录（与后端 KIND_META 对齐） */
export const CHANNEL_PRESETS: ChannelPreset[] = [
  {
    kind: "telegram",
    label: "Telegram",
    description: "通过 Bot Token 长轮询与 Agent 对话",
  },
  {
    kind: "discord",
    label: "Discord",
    description: "Discord Bot（即将支持）",
  },
  {
    kind: "whatsapp",
    label: "WhatsApp",
    description: "WhatsApp Business API（即将支持）",
  },
  {
    kind: "feishu",
    label: "飞书",
    description: "飞书机器人（即将支持）",
  },
  {
    kind: "wechat",
    label: "微信",
    description: "企业微信 / 公众号（即将支持）",
  },
  {
    kind: "dingtalk",
    label: "钉钉",
    description: "钉钉机器人（即将支持）",
  },
];
