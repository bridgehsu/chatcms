import type { BusinessMapState, MapDeadline } from "../types";

const id = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** 业务地图默认数据（自媒体运营语境） */
export const createSeedState = (): BusinessMapState => ({
  note: "",
  favorites: [
    { id: id(), title: "智能会话", desc: "AI 创作与问答工作台", mark: "聊", url: "#/chat", tone: "red" },
    { id: id(), title: "内容发布", desc: "多平台一键分发", mark: "发", url: "#/media-platforms", tone: "teal" },
    { id: id(), title: "图片生成", desc: "AI 生成封面与配图", mark: "图", url: "#/images/generate", tone: "violet" },
    { id: id(), title: "视频管理", desc: "素材库与成片管理", mark: "视", url: "#/videos", tone: "blue" },
    { id: id(), title: "任务调度", desc: "自动化工作流管理", mark: "调", url: "#/schedules", tone: "amber" },
    { id: id(), title: "账号中心", desc: "多平台账号统一管理", mark: "账", url: "#/accounts", tone: "slate" },
  ],
  sections: [
    // ── 内容生产 ────────────────────────────────────────────────────────────
    {
      id: "content-production",
      title: "内容生产",
      icon: "✎",
      sort_order: 1,
      locked: true,
      collapsed: false,
      links: [
        { id: id(), title: "AI 写作", desc: "智能生成图文、脚本、文案", mark: "写", url: "#/chat", tone: "red" },
        { id: id(), title: "图文稿库", desc: "选题、大纲与成稿归档", mark: "稿", url: "#/content", tone: "amber" },
        { id: id(), title: "图片素材", desc: "封面与配图资源池", mark: "图", url: "#/images", tone: "violet" },
        { id: id(), title: "AI 生图", desc: "一键生成封面与插图", mark: "绘", url: "#/images/generate", tone: "blue" },
        { id: id(), title: "视频素材", desc: "成片、切片与混剪管理", mark: "剪", url: "#/videos", tone: "teal" },
        { id: id(), title: "AI 生视频", desc: "文生视频与图生视频", mark: "生", url: "#/videos/generate", tone: "red" },
        { id: id(), title: "知识记忆", desc: "写入 Agent 可检索知识库", mark: "记", url: "#/settings/knowledge", tone: "slate" },
        { id: id(), title: "剪映创作", desc: "专业视频剪辑工具", mark: "剪", url: "https://www.capcut.cn", tone: "blue" },
      ],
    },
    // ── 平台矩阵 ────────────────────────────────────────────────────────────
    {
      id: "platforms",
      title: "平台矩阵",
      icon: "◉",
      sort_order: 2,
      locked: true,
      collapsed: false,
      links: [
        { id: id(), title: "微信公众号", desc: "图文内容发布与粉丝运营", mark: "微", url: "https://mp.weixin.qq.com", tone: "teal" },
        { id: id(), title: "抖音创作", desc: "短视频发布与数据中心", mark: "抖", url: "https://creator.douyin.com", tone: "red" },
        { id: id(), title: "小红书", desc: "图文笔记与种草运营", mark: "红", url: "https://creator.xiaohongshu.com", tone: "red" },
        { id: id(), title: "B 站创作", desc: "长视频与专栏内容运营", mark: "B", url: "https://member.bilibili.com/platform/home", tone: "blue" },
        { id: id(), title: "微博", desc: "热点话题与粉丝互动", mark: "博", url: "https://weibo.com", tone: "red" },
        { id: id(), title: "知乎", desc: "问答与专栏深度内容", mark: "知", url: "https://www.zhihu.com", tone: "blue" },
        { id: id(), title: "今日头条", desc: "资讯与短视频分发", mark: "头", url: "https://mp.toutiao.com", tone: "red" },
        { id: id(), title: "YouTube", desc: "海外视频平台运营", mark: "YT", url: "https://studio.youtube.com", tone: "red" },
        { id: id(), title: "X / Twitter", desc: "海外社交媒体运营", mark: "X", url: "https://twitter.com", tone: "slate" },
        { id: id(), title: "Instagram", desc: "海外图文与 Reels", mark: "IN", url: "https://www.instagram.com", tone: "violet" },
        { id: id(), title: "快手", desc: "短视频与直播运营", mark: "快", url: "https://cp.kuaishou.com", tone: "amber" },
        { id: id(), title: "视频号", desc: "微信生态短视频", mark: "号", url: "https://channels.weixin.qq.com", tone: "teal" },
      ],
    },
    // ── 选题策划 ────────────────────────────────────────────────────────────
    {
      id: "topic-planning",
      title: "选题策划",
      icon: "◈",
      sort_order: 3,
      locked: true,
      collapsed: false,
      links: [
        { id: id(), title: "微博热搜", desc: "实时热点话题追踪", mark: "热", url: "https://s.weibo.com/top/summary", tone: "red" },
        { id: id(), title: "百度热搜", desc: "全网搜索热点词", mark: "百", url: "https://top.baidu.com/board?tab=realtime", tone: "blue" },
        { id: id(), title: "抖音热点", desc: "短视频热门话题", mark: "抖", url: "https://www.douyin.com/hot", tone: "red" },
        { id: id(), title: "知乎热榜", desc: "优质问答内容选题", mark: "知", url: "https://www.zhihu.com/hot", tone: "blue" },
        { id: id(), title: "头条热榜", desc: "资讯热点聚合", mark: "头", url: "https://www.toutiao.com/hot-event/hot-board", tone: "amber" },
        { id: id(), title: "Google Trends", desc: "全球搜索趋势分析", mark: "GT", url: "https://trends.google.com/trends", tone: "teal" },
        { id: id(), title: "5118 选词", desc: "关键词挖掘与竞争分析", mark: "词", url: "https://www.5118.com", tone: "violet" },
        { id: id(), title: "AI 选题", desc: "让 AI 生成爆款选题方向", mark: "题", url: "#/chat", tone: "red" },
      ],
    },
    // ── 创意工具 ────────────────────────────────────────────────────────────
    {
      id: "creative-tools",
      title: "创意工具",
      icon: "⬡",
      sort_order: 4,
      locked: true,
      collapsed: false,
      links: [
        { id: id(), title: "Canva", desc: "在线设计封面与海报", mark: "Ca", url: "https://www.canva.cn", tone: "teal" },
        { id: id(), title: "即时设计", desc: "国内协作设计平台", mark: "设", url: "https://js.design", tone: "violet" },
        { id: id(), title: "稿定设计", desc: "模板化快速出图", mark: "稿", url: "https://www.gaoding.com", tone: "amber" },
        { id: id(), title: "创客贴", desc: "营销物料快速制作", mark: "创", url: "https://www.chuangkit.com", tone: "red" },
        { id: id(), title: "醒图", desc: "手机端图片美化编辑", mark: "醒", url: "https://xingtu.com", tone: "blue" },
        { id: id(), title: "Unsplash", desc: "免费高清图片素材库", mark: "Un", url: "https://unsplash.com", tone: "slate" },
        { id: id(), title: "Pexels", desc: "免费图片与视频素材", mark: "Pe", url: "https://www.pexels.com", tone: "teal" },
        { id: id(), title: "iconfont", desc: "国内最大图标库", mark: "图", url: "https://www.iconfont.cn", tone: "red" },
        { id: id(), title: "字由", desc: "正版商用字体管理", mark: "字", url: "https://www.hellofont.cn", tone: "blue" },
        { id: id(), title: "即创", desc: "抖音 AI 视频创作工具", mark: "创", url: "https://jichuang.douyin.com", tone: "red" },
      ],
    },
    // ── 数据监控 ────────────────────────────────────────────────────────────
    {
      id: "data-monitor",
      title: "数据监控",
      icon: "◑",
      sort_order: 5,
      locked: true,
      collapsed: false,
      links: [
        { id: id(), title: "抖音数据", desc: "短视频播放与粉丝趋势", mark: "抖", url: "https://creator.douyin.com/creator-micro/data/overview", tone: "red" },
        { id: id(), title: "公众号数据", desc: "图文阅读与转化分析", mark: "微", url: "https://mp.weixin.qq.com/cgi-bin/masssendpage", tone: "teal" },
        { id: id(), title: "B 站数据", desc: "视频播放与粉丝分析", mark: "B", url: "https://member.bilibili.com/platform/data/overview", tone: "blue" },
        { id: id(), title: "小红书数据", desc: "笔记互动与曝光分析", mark: "红", url: "https://creator.xiaohongshu.com/creator/notes", tone: "red" },
        { id: id(), title: "西瓜视频", desc: "头条系视频数据中心", mark: "瓜", url: "https://studio.ixigua.com/data", tone: "amber" },
        { id: id(), title: "飞瓜数据", desc: "抖音/B 站竞品监控", mark: "飞", url: "https://www.feigua.io", tone: "violet" },
        { id: id(), title: "新榜", desc: "公众号与自媒体排行榜", mark: "榜", url: "https://www.newrank.cn", tone: "blue" },
        { id: id(), title: "蝉妈妈", desc: "抖音电商与带货数据", mark: "蝉", url: "https://www.chanmama.com", tone: "red" },
      ],
    },
    // ── 发布与分发 ────────────────────────────────────────────────────────────
    {
      id: "publish-distribute",
      title: "发布与分发",
      icon: "▶",
      sort_order: 6,
      locked: true,
      collapsed: false,
      links: [
        { id: id(), title: "多平台发布", desc: "统一管理各平台发布", mark: "发", url: "#/media-platforms", tone: "teal" },
        { id: id(), title: "定时任务", desc: "自动定时发布工作流", mark: "定", url: "#/schedules", tone: "amber" },
        { id: id(), title: "渠道推送", desc: "Telegram 等外发通道", mark: "推", url: "#/settings/channels", tone: "blue" },
        { id: id(), title: "内容日历", desc: "发布计划与内容排期", mark: "历", url: "#/schedules", tone: "violet" },
        { id: id(), title: "一键分发", desc: "AI 辅助多平台适配改写", mark: "分", url: "#/chat", tone: "red" },
        { id: id(), title: "草稿箱", desc: "待发布内容暂存管理", mark: "草", url: "#/content", tone: "slate" },
      ],
    },
    // ── 账号运营 ────────────────────────────────────────────────────────────
    {
      id: "account-ops",
      title: "账号运营",
      icon: "◎",
      sort_order: 7,
      locked: true,
      collapsed: false,
      links: [
        { id: id(), title: "账号管理", desc: "多平台账号与权限中心", mark: "账", url: "#/accounts", tone: "red" },
        { id: id(), title: "Agent 管理", desc: "多 Agent 角色与分工", mark: "代", url: "#/agents", tone: "violet" },
        { id: id(), title: "粉丝互动", desc: "评论回复与私信管理", mark: "粉", url: "#/chat", tone: "teal" },
        { id: id(), title: "权限控制", desc: "操作权限与审核流程", mark: "权", url: "#/settings/permissions", tone: "slate" },
        { id: id(), title: "微信客服", desc: "公众号消息与自动回复", mark: "服", url: "https://mp.weixin.qq.com", tone: "teal" },
        { id: id(), title: "社群管理", desc: "微信群与用户社群运营", mark: "群", url: "#/chat", tone: "amber" },
      ],
    },
    // ── 商业变现 ────────────────────────────────────────────────────────────
    {
      id: "monetization",
      title: "商业变现",
      icon: "◈",
      sort_order: 8,
      locked: true,
      collapsed: false,
      links: [
        { id: id(), title: "抖音带货", desc: "选品与橱窗管理", mark: "货", url: "https://fxg.jinritemai.com", tone: "red" },
        { id: id(), title: "小红书带货", desc: "笔记挂链与合作管理", mark: "链", url: "https://www.xiaohongshu.com", tone: "red" },
        { id: id(), title: "B 站充电", desc: "视频会员与充电计划", mark: "电", url: "https://member.bilibili.com", tone: "blue" },
        { id: id(), title: "知乎盐选", desc: "付费专栏内容变现", mark: "盐", url: "https://www.zhihu.com/creator", tone: "blue" },
        { id: id(), title: "广告投放", desc: "品牌合作与软广管理", mark: "广", url: "#/accounts", tone: "amber" },
        { id: id(), title: "星图平台", desc: "抖音达人合作接单", mark: "星", url: "https://star.douyin.com", tone: "violet" },
        { id: id(), title: "蒲公英", desc: "微博/小红书商业合作", mark: "蒲", url: "https://pugongying.bilibili.com", tone: "teal" },
        { id: id(), title: "知识付费", desc: "课程与电子书销售", mark: "课", url: "#/content", tone: "amber" },
      ],
    },
    // ── AI 工具 ────────────────────────────────────────────────────────────
    {
      id: "ai-tools",
      title: "AI 工具箱",
      icon: "⚡",
      sort_order: 9,
      locked: true,
      collapsed: false,
      links: [
        { id: id(), title: "模型配置", desc: "管理 Provider 与 API 密钥", mark: "模", url: "#/models", tone: "teal" },
        { id: id(), title: "MCP 工具", desc: "扩展 Agent 能力边界", mark: "工", url: "#/mcp", tone: "blue" },
        { id: id(), title: "技能管理", desc: "自定义 Agent 技能库", mark: "技", url: "#/skills", tone: "violet" },
        { id: id(), title: "ChatGPT", desc: "OpenAI 对话与创作", mark: "GP", url: "https://chat.openai.com", tone: "teal" },
        { id: id(), title: "Claude", desc: "Anthropic 长文本处理", mark: "Cl", url: "https://claude.ai", tone: "amber" },
        { id: id(), title: "Kimi", desc: "长文档解析与总结", mark: "Ki", url: "https://kimi.moonshot.cn", tone: "blue" },
        { id: id(), title: "通义千问", desc: "阿里系 AI 创作助手", mark: "通", url: "https://tongyi.aliyun.com", tone: "red" },
        { id: id(), title: "豆包", desc: "字节系 AI 内容创作", mark: "豆", url: "https://www.doubao.com", tone: "violet" },
        { id: id(), title: "即梦 AI", desc: "视频与图片 AI 生成", mark: "梦", url: "https://jimeng.jianying.com", tone: "red" },
        { id: id(), title: "Midjourney", desc: "高质量 AI 图像生成", mark: "MJ", url: "https://www.midjourney.com", tone: "violet" },
      ],
    },
    // ── 团队协作 ────────────────────────────────────────────────────────────
    {
      id: "team-collab",
      title: "团队协作",
      icon: "⬡",
      sort_order: 10,
      locked: true,
      collapsed: false,
      links: [
        { id: id(), title: "飞书", desc: "团队文档与任务管理", mark: "飞", url: "https://www.feishu.cn", tone: "blue" },
        { id: id(), title: "钉钉", desc: "企业沟通与审批流程", mark: "钉", url: "https://www.dingtalk.com", tone: "blue" },
        { id: id(), title: "腾讯文档", desc: "多人协同文档编辑", mark: "文", url: "https://docs.qq.com", tone: "teal" },
        { id: id(), title: "石墨文档", desc: "轻量协作文档工具", mark: "石", url: "https://shimo.im", tone: "amber" },
        { id: id(), title: "即时通讯", desc: "频道推送与通知管理", mark: "聊", url: "#/settings/channels", tone: "violet" },
        { id: id(), title: "审核中心", desc: "内容发布前审核流程", mark: "审", url: "#/settings/permissions", tone: "slate" },
        { id: id(), title: "Notion", desc: "内容规划与知识管理", mark: "No", url: "https://www.notion.so", tone: "slate" },
      ],
    },
    // ── 行业资讯 ────────────────────────────────────────────────────────────
    {
      id: "industry-news",
      title: "行业资讯",
      icon: "◑",
      sort_order: 11,
      locked: true,
      collapsed: false,
      links: [
        { id: id(), title: "人人都是产品经理", desc: "互联网与运营行业资讯", mark: "人", url: "https://www.woshipm.com", tone: "blue" },
        { id: id(), title: "卡思数据", desc: "短视频行业深度报告", mark: "卡", url: "https://www.caasdata.com", tone: "violet" },
        { id: id(), title: "36氪", desc: "科技与创业热点资讯", mark: "36", url: "https://36kr.com", tone: "blue" },
        { id: id(), title: "虎嗅", desc: "商业与科技深度分析", mark: "虎", url: "https://www.huxiu.com", tone: "amber" },
        { id: id(), title: "刺猬公社", desc: "内容产业与自媒体观察", mark: "刺", url: "https://www.ciweigongshe.net", tone: "teal" },
        { id: id(), title: "新媒体课堂", desc: "运营技能与增长学习", mark: "课", url: "https://www.newmediatool.com", tone: "red" },
        { id: id(), title: "运营研究社", desc: "运营方法论与案例", mark: "运", url: "https://www.yunyingyjsh.com", tone: "violet" },
      ],
    },
  ],
  metrics: [],
});

/** 示例里程碑（相对今天） */
export const buildDeadlines = (now = new Date()): MapDeadline[] => {
  const year = now.getFullYear();
  const end = new Date(year, 11, 31);
  const msDay = 86400000;
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msDay));
  const weeksLeft = Math.ceil(daysLeft / 7);

  const holiday = (month: number, day: number, label: string): MapDeadline => {
    let target = new Date(year, month - 1, day);
    if (target.getTime() < now.getTime()) {
      target = new Date(year + 1, month - 1, day);
    }
    return {
      id: label,
      label,
      days: Math.max(0, Math.ceil((target.getTime() - now.getTime()) / msDay)),
    };
  };

  const holidays = [
    holiday(1, 1, "元旦"),
    holiday(1, 29, "春节"),
    holiday(2, 14, "情人节"),
    holiday(3, 8, "妇女节"),
    holiday(3, 15, "消费者日"),
    holiday(4, 5, "清明"),
    holiday(5, 1, "劳动节"),
    holiday(5, 4, "青年节"),
    holiday(5, 20, "520"),
    holiday(6, 1, "儿童节"),
    holiday(6, 18, "618"),
    holiday(7, 7, "七夕"),
    holiday(9, 10, "教师节"),
    holiday(10, 1, "国庆"),
    holiday(11, 11, "双十一"),
    holiday(12, 12, "双十二"),
    holiday(12, 25, "圣诞"),
  ].sort((a, b) => a.days - b.days);

  return [
    {
      id: "year",
      label: `${year} 年剩 ${weeksLeft} 周 · 距年底 ${daysLeft} 天`,
      days: daysLeft,
    },
    ...holidays,
  ];
};
