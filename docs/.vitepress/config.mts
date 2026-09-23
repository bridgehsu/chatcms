import { defineConfig } from "vitepress";

/**
 * 本地默认 `/`（http://localhost:5173/）。
 * 自定义域名 chatcms.org：CI 使用 DOCS_BASE=/
 * 项目站回退：DOCS_BASE=/chatcms/
 */
const base = process.env.DOCS_BASE || "/";

/** 访问 github.io/chatcms/* 时跳到自定义域名（base=/ 时项目站资源路径会错） */
const githubIoRedirect = `(function(){var h=location.hostname;if(h!=="bridgehsu.github.io")return;var p=location.pathname;if(p!=="/chatcms"&&p.indexOf("/chatcms/")!==0)return;var rest=p.slice("/chatcms".length)||"/";location.replace("https://chatcms.org"+rest+location.search+location.hash);})();`;

export default defineConfig({
  title: "ChatCMS",
  description: "Tauri + React 桌面 Agent · 内容生产与智能会话",
  lang: "zh-CN",
  base,
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  /** 与桌面端默认深色主题一致 */
  appearance: "dark",

  head: [
    ["link", { rel: "icon", href: `${base}favicon.svg` }],
    ["script", {}, githubIoRedirect],
  ],

  markdown: {
    config(md) {
      const defaultFence = md.renderer.rules.fence!;
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (token.info.trim() === "mermaid") {
          const code = md.utils.escapeHtml(token.content.trim());
          return `<div class="mermaid">${code}</div>\n`;
        }
        return defaultFence(tokens, idx, options, env, self);
      };
    },
  },

  themeConfig: {
    logo: { src: "/logo.svg", alt: "ChatCMS" },
    siteTitle: "ChatCMS",
    nav: [
      { text: "指南", link: "/guide/overview" },
      { text: "概念", link: "/concepts/agent-loop" },
      { text: "功能", link: "/features/video" },
      {
        text: "GitHub",
        link: "https://github.com/bridgehsu/chatcms",
      },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "开始",
          items: [
            { text: "项目概览", link: "/guide/overview" },
            { text: "安装与启动", link: "/guide/getting-started" },
          ],
        },
      ],
      "/concepts/": [
        {
          text: "核心概念",
          items: [
            { text: "Agent Loop", link: "/concepts/agent-loop" },
            { text: "多 Agent", link: "/concepts/multi-agent" },
          ],
        },
      ],
      "/features/": [
        {
          text: "功能说明",
          items: [{ text: "视频服务", link: "/features/video" }],
        },
      ],
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/bridgehsu/chatcms" },
    ],
    footer: {
      message: "Released under the project license.",
      copyright: "Copyright © ChatCMS contributors",
    },
    search: { provider: "local" },
    outline: { label: "本页目录", level: [2, 3] },
    docFooter: { prev: "上一页", next: "下一页" },
    returnToTopLabel: "回到顶部",
    sidebarMenuLabel: "菜单",
    darkModeSwitchLabel: "外观",
  },
});
