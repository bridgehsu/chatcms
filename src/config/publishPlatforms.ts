/** 发布到浏览器插件的平台预设（name 对齐 chatcms-extesion SyncData） */

export type PublishKind = "dynamic" | "article" | "video";

export type PublishPlatformOption = {
  id: string;
  label: string;
  kind: PublishKind;
};

export const DYNAMIC_PLATFORMS: PublishPlatformOption[] = [
  { id: "DYNAMIC_REDNOTE", label: "小红书", kind: "dynamic" },
  { id: "DYNAMIC_DOUYIN", label: "抖音", kind: "dynamic" },
  { id: "DYNAMIC_WEIBO", label: "微博", kind: "dynamic" },
  { id: "DYNAMIC_BILIBILI", label: "B站动态", kind: "dynamic" },
  { id: "DYNAMIC_ZHIHU", label: "知乎想法", kind: "dynamic" },
  { id: "DYNAMIC_WEIXINCHANNEL", label: "视频号", kind: "dynamic" },
  { id: "DYNAMIC_KUAISHOU", label: "快手", kind: "dynamic" },
];

export const ARTICLE_PLATFORMS: PublishPlatformOption[] = [
  { id: "ARTICLE_WEIXIN", label: "微信公众号", kind: "article" },
  { id: "ARTICLE_ZHIHU", label: "知乎文章", kind: "article" },
  { id: "ARTICLE_CSDN", label: "CSDN", kind: "article" },
  { id: "ARTICLE_JUEJIN", label: "掘金", kind: "article" },
  { id: "ARTICLE_JIANSHU", label: "简书", kind: "article" },
  { id: "ARTICLE_TOUTIAO", label: "头条号", kind: "article" },
];

export const VIDEO_PLATFORMS: PublishPlatformOption[] = [
  { id: "VIDEO_DOUYIN", label: "抖音", kind: "video" },
  { id: "VIDEO_REDNOTE", label: "小红书", kind: "video" },
  { id: "VIDEO_BILIBILI", label: "B站", kind: "video" },
  { id: "VIDEO_KUAISHOU", label: "快手", kind: "video" },
  { id: "VIDEO_WEIXINCHANNEL", label: "视频号", kind: "video" },
  { id: "VIDEO_ZHIHU", label: "知乎视频", kind: "video" },
];

export const platformsForKind = (kind: PublishKind) => {
  if (kind === "dynamic") return DYNAMIC_PLATFORMS;
  if (kind === "article") return ARTICLE_PLATFORMS;
  return VIDEO_PLATFORMS;
};

export const PUBLISH_BRIDGE_PORT = 17890;

export const publishMediaUrl = (kind: "image" | "video", id: string) =>
  `http://127.0.0.1:${PUBLISH_BRIDGE_PORT}/media/${kind}/${id}`;

export const publishPlaceholderCoverUrl = () =>
  `http://127.0.0.1:${PUBLISH_BRIDGE_PORT}/media/placeholder/cover.png`;
