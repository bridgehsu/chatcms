<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { withBase } from "vitepress";

const faqs = [
  {
    q: "ChatCMS 是什么？",
    a: "面向新媒体种草的开源桌面 Agent：采集、写作、生图生视频、多平台发布在同一本机工作台完成，数据与账号留在你自己的机器上。",
  },
  {
    q: "适合谁用？",
    a: "品牌与电商运营、达人工作室、独立创作者，以及需要私有化或二开的技术团队。",
  },
  {
    q: "和云端 SaaS 有什么不同？",
    a: "本地优先。会话、素材、账号保险柜落在本机，权限与审计可查，敏感品类与账号策略不必上云。",
  },
  {
    q: "可以二开和私有化吗？",
    a: "可以。源码开放，Skills / MCP / 模型可插拔，可按品类扩展 Agent 角色与发布流水线。",
  },
];

/** 首页媒体平台：按场景分组（静态，不滚动） */
const platformGroups = [
  {
    title: "图文种草",
    items: [
      { logo: "xiaohongshu", name: "小红书" },
      { logo: "wechat", name: "微信公众号" },
      { logo: "zhihu", name: "知乎" },
      { logo: "weibo", name: "微博" },
    ],
  },
  {
    title: "短视频",
    items: [
      { logo: "douyin", name: "抖音" },
      { logo: "wechat-channels", name: "视频号" },
      { logo: "kuaishou", name: "快手" },
      { logo: "bilibili", name: "哔哩哔哩" },
    ],
  },
  {
    title: "海外渠道",
    items: [
      { logo: "x", name: "X / Twitter" },
      { logo: "linkedin", name: "LinkedIn" },
    ],
  },
];

const platformLogo = (id: string) => withBase(`/platforms/${id}.svg`);

/** 浏览器插件侧栏三态截图 */
const extensionShots = [
  {
    src: "ext1.png",
    title: "对话",
    desc: "关联当前网页，带上下文提问",
  },
  {
    src: "ext2.png",
    title: "导航",
    desc: "常用工具与平台入口一屏直达",
  },
  {
    src: "ext3.png",
    title: "发布",
    desc: "选平台填表，不自动点发布",
  },
];

onMounted(() => {
  document.documentElement.classList.add("is-landing");
});
onUnmounted(() => {
  document.documentElement.classList.remove("is-landing");
});
</script>

<template>
  <div class="lp">
    <div class="lp-glow" aria-hidden="true" />

    <!-- Hero：主张 + 主次 CTA + 大示意 -->
    <header class="lp-hero">
      <p class="lp-brand"><span>ChatCMS</span> 开源 · 本地</p>
      <h1 class="lp-title">
        新媒体智能体工作台
        <em>从灵感到发布，一条链路自动完成</em>
      </h1>
      <p class="lp-sub">
        开源桌面端。选题、文案、成片、采集与多平台发布一站完成，少切换工具，数据留在本机。
      </p>
      <div class="lp-actions">
        <div class="lp-actions__btns">
          <a class="lp-btn lp-btn--primary" :href="withBase('/guide/getting-started')"
            >开始使用<span class="lp-btn__arrow" aria-hidden="true">→</span></a
          >
          <a
            class="lp-btn lp-btn--ghost"
            href="https://github.com/bridgehsu/chatcms"
            target="_blank"
            rel="noreferrer"
            >查看源码</a
          >
        </div>
        <p class="lp-actions__note">本机运行 · 数据不出机器</p>
      </div>

      <aside class="lp-stage" aria-label="产品示意">
        <div class="lp-stage__glow" aria-hidden="true" />
        <div class="lp-stage__frame">
          <img
            class="lp-stage__shot"
            :src="withBase('/hero-app.png')"
            alt="ChatCMS 桌面端：智能会话工作台"
            width="1792"
            height="1090"
            loading="eager"
            decoding="async"
          />
        </div>
      </aside>
    </header>

    <!-- 信任条：一句即可 -->
    <section class="lp-trust" aria-label="产品特质">
      <p>开源 · 本地优先 · 可私有化</p>
    </section>

    <!-- 媒体平台覆盖：按场景分组 -->
    <section class="lp-platforms" aria-label="支持的媒体平台">
      <p class="lp-platforms__label">覆盖你每天在用的平台</p>
      <div class="lp-platforms__groups">
        <div v-for="group in platformGroups" :key="group.title" class="lp-platforms__group">
          <h3 class="lp-platforms__group-title">{{ group.title }}</h3>
          <ul class="lp-platforms__list">
            <li v-for="p in group.items" :key="p.name">
              <span
                class="lp-platforms__logo"
                :style="{
                  maskImage: `url(${platformLogo(p.logo)})`,
                  WebkitMaskImage: `url(${platformLogo(p.logo)})`,
                }"
                aria-hidden="true"
              />
              {{ p.name }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- 浏览器插件：对话 / 导航 / 发布 -->
    <section class="lp-ext" aria-label="浏览器插件">
      <p class="lp-kicker">浏览器插件</p>
      <h2 class="lp-h2">对话 · 导航 · 一键填表</h2>
      <p class="lp-body">
        桌面端产出内容，侧栏在创作者页完成对话、导航与填表——和本机工作台互补，数据仍走你的发布桥。
      </p>
      <div class="lp-ext__grid">
        <figure v-for="shot in extensionShots" :key="shot.src" class="lp-ext__card">
          <div class="lp-ext__frame">
            <img
              :src="withBase(`/extension/${shot.src}`)"
              :alt="`ChatCMS 插件 · ${shot.title}`"
              width="436"
              height="970"
              loading="lazy"
              decoding="async"
            />
          </div>
          <figcaption>
            <strong>{{ shot.title }}</strong>
            <span>{{ shot.desc }}</span>
          </figcaption>
        </figure>
      </div>
    </section>

    <section class="lp-case">
      <p class="lp-kicker">为什么需要</p>
      <h2 class="lp-h2">别再当人肉内容中台</h2>
      <p class="lp-body">
        选题、文案、出图、发稿拆在十几个工具里。ChatCMS 把种草生产装回一张桌面——团队只处理真正要拍板的事。
      </p>
    </section>

    <!-- 能力：叙事流，不做三连同质卡片 -->
    <section class="lp-story">
      <div class="lp-story__copy">
        <p class="lp-kicker">多角色协作</p>
        <h2 class="lp-h2">主脑调度，角色上场</h2>
        <p class="lp-body">
          为策划、文案、视觉、剪辑配置不同 Agent。主脑负责任务节奏，子代理并行产出，像一支随时在线的种草小队。
        </p>
      </div>
      <ul class="lp-roles">
        <li><strong>种草主脑</strong><span>拆解任务 · 调度角色</span></li>
        <li><strong>文案 Agent</strong><span>大纲 · 成稿 · 话术</span></li>
        <li><strong>视觉 Agent</strong><span>封面 · 图文 brief</span></li>
        <li><strong>剪辑 Agent</strong><span>口播 · 成片节奏</span></li>
      </ul>
    </section>

    <section class="lp-pipeline">
      <p class="lp-kicker">全链路</p>
      <h2 class="lp-h2">洞察 → 创作 → 发布 → 复盘</h2>
      <p class="lp-body">采集与知识库、笔记与媒体工厂、发布桥接与权限审计，串在同一工作台。</p>
      <ol class="lp-pipe">
        <li><span>01</span><strong>洞察</strong></li>
        <li><span>02</span><strong>创作</strong></li>
        <li><span>03</span><strong>发布</strong></li>
        <li><span>04</span><strong>复盘</strong></li>
      </ol>
      <a class="lp-more" :href="withBase('/guide/overview')">了解产品能力</a>
    </section>

    <section class="lp-local">
      <div>
        <p class="lp-kicker">本地优先</p>
        <h2 class="lp-h2">账号与素材，留在你的机器</h2>
        <p class="lp-body">
          会话、素材库、账号保险柜本机落地；工具执行按权限裁决。商业内容不必交给第三方云。
        </p>
      </div>
      <dl class="lp-local__list">
        <div><dt>本机会话 / 素材</dt><dd>可控</dd></div>
        <div><dt>账号保险柜</dt><dd>加密</dd></div>
        <div><dt>工具执行</dt><dd>需授权</dd></div>
        <div><dt>开源二开</dt><dd>可扩展</dd></div>
      </dl>
    </section>

    <section class="lp-start">
      <p class="lp-kicker">三步上手</p>
      <h2 class="lp-h2">安装 · 配角色 · 跑通一条链路</h2>
      <ol>
        <li>
          <strong>安装桌面端</strong>
          <p>启动 ChatCMS，接入模型供应商。</p>
        </li>
        <li>
          <strong>配置种草角色</strong>
          <p>建立文案 / 视觉 / 剪辑 Agent。</p>
        </li>
        <li>
          <strong>下达种草任务</strong>
          <p>用 Agent 模式从洞察走到发布。</p>
        </li>
      </ol>
    </section>

    <section class="lp-examples">
      <p class="lp-kicker">可以这样用</p>
      <h2 class="lp-h2">以前要开五个软件的事</h2>
      <div class="lp-examples__grid">
        <article>
          <span>文案</span>
          <p>写一篇小红书种草：气垫粉底，避雷假白</p>
        </article>
        <article>
          <span>成片</span>
          <p>按口播稿做成 9:16，8 秒，字幕偏大</p>
        </article>
        <article>
          <span>发布</span>
          <p>对接发布桥接，准备发到小红书</p>
        </article>
      </div>
    </section>

    <section id="faq" class="lp-faq">
      <p class="lp-kicker">常见问题</p>
      <h2 class="lp-h2">还有这些疑问</h2>
      <div class="lp-faq__list">
        <details v-for="item in faqs" :key="item.q">
          <summary>{{ item.q }}</summary>
          <p>{{ item.a }}</p>
        </details>
      </div>
    </section>

    <section class="lp-finale">
      <h2 class="lp-h2">把种草生产，留在自己的机器上</h2>
      <p class="lp-body">开源、本机、可扩展。你决定节奏与数据边界。</p>
      <div class="lp-actions">
        <a class="lp-btn lp-btn--primary" :href="withBase('/guide/getting-started')"
          >开始使用<span class="lp-btn__arrow" aria-hidden="true">→</span></a
        >
        <a class="lp-btn lp-btn--ghost" :href="withBase('/guide/overview')">产品能力</a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lp {
  position: relative;
  isolation: isolate;
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 28px 128px;
  overflow: clip;
}

.lp-glow {
  position: absolute;
  inset: -6% -16% auto;
  height: 62vh;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(ellipse 42% 36% at 50% 6%, rgba(255, 92, 92, 0.12), transparent 72%),
    radial-gradient(ellipse 26% 24% at 86% 16%, rgba(20, 184, 166, 0.05), transparent 70%);
}

/* ——— Hero ——— */
.lp-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: clamp(148px, 20vh, 220px) 0 40px;
  gap: 0;
}

.lp-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0 0 1.75rem;
  padding: 0.32rem 0.9rem 0.32rem 0.38rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--vp-c-border) 85%, transparent);
  background: color-mix(in srgb, var(--vp-c-bg-elv) 55%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--vp-c-text-3);
  box-shadow: 0 1px 0 color-mix(in srgb, #fff 4%, transparent) inset;
  animation: lp-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.lp-brand span {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  background: var(--oc-accent-subtle);
  color: var(--oc-accent-hover);
  font-family: var(--font-display);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.lp-title {
  margin: 0;
  max-width: 15em;
  font-family: var(--font-display);
  font-size: clamp(2.3rem, 5vw, 3.45rem);
  font-weight: 700;
  line-height: 1.16;
  letter-spacing: -0.042em;
  color: var(--vp-c-text-1);
  text-wrap: balance;
  animation: lp-rise 0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
}

.lp-title em {
  display: block;
  margin-top: 0.62rem;
  font-style: normal;
  font-size: 0.68em;
  font-weight: 650;
  letter-spacing: -0.028em;
  line-height: 1.35;
  color: var(--oc-accent-hover);
  text-wrap: balance;
}

.lp-sub {
  margin: 1.55rem 0 0;
  max-width: 30em;
  font-size: 1.05rem;
  line-height: 1.82;
  color: var(--vp-c-text-3);
  text-wrap: pretty;
  animation: lp-rise 0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
}

.lp-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.lp-hero .lp-actions {
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  margin-top: 2.2rem;
  animation: lp-rise 0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.16s both;
}

.lp-actions__btns {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.lp-actions__note {
  margin: 0;
  font-size: 0.86rem;
  letter-spacing: 0.01em;
  color: var(--vp-c-text-3);
  opacity: 0.88;
}

.lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 48px;
  padding: 0 1.45rem;
  border-radius: 10px;
  font-family: var(--font-display);
  font-size: 0.97rem;
  font-weight: 650;
  text-decoration: none !important;
  transition:
    transform 160ms ease,
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.lp-btn:hover {
  transform: translateY(-1px);
}

.lp-btn:focus-visible {
  outline: 2px solid var(--oc-accent);
  outline-offset: 3px;
}

.lp-btn__arrow {
  display: inline-block;
  transition: transform 160ms ease;
}

.lp-btn--primary:hover .lp-btn__arrow {
  transform: translateX(3px);
}

.lp-btn--primary {
  color: #fff !important;
  background: var(--oc-accent);
  box-shadow:
    0 1px 0 color-mix(in srgb, #fff 18%, transparent) inset,
    0 10px 28px color-mix(in srgb, var(--oc-accent) 28%, transparent);
}

.lp-btn--primary:hover {
  background: var(--oc-accent-hover);
  box-shadow:
    0 1px 0 color-mix(in srgb, #fff 18%, transparent) inset,
    0 12px 30px color-mix(in srgb, var(--oc-accent) 34%, transparent);
}

.lp-btn--ghost {
  color: var(--vp-c-text-1) !important;
  border: 1px solid var(--vp-c-border);
  background: color-mix(in srgb, var(--vp-c-bg-elv) 40%, transparent);
}

.lp-btn--ghost:hover {
  border-color: color-mix(in srgb, var(--oc-accent) 42%, var(--vp-c-border));
  background: color-mix(in srgb, var(--vp-c-bg-elv) 70%, transparent);
}

@keyframes lp-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-brand,
  .lp-title,
  .lp-sub,
  .lp-hero .lp-actions,
  .lp-stage {
    animation: none !important;
  }
  .lp-btn:hover,
  .lp-btn--primary:hover .lp-btn__arrow {
    transform: none;
  }
}

/* Stage — real product screenshot */
.lp-stage {
  position: relative;
  width: 100%;
  margin-top: clamp(88px, 12vh, 128px);
  animation: lp-rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.24s both;
}

.lp-stage__glow {
  position: absolute;
  inset: 18% -6% -14%;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(
    ellipse 68% 50% at 50% 42%,
    color-mix(in srgb, var(--oc-accent) 14%, transparent),
    transparent 72%
  );
  filter: blur(32px);
}

.lp-stage__frame {
  position: relative;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, #fff 7%, #1e2028);
  background: #12151c;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.28),
    0 20px 48px rgba(0, 0, 0, 0.38),
    0 4px 14px rgba(0, 0, 0, 0.22);
  overflow: hidden;
}

.lp-stage__shot {
  display: block;
  width: 100%;
  height: auto;
  vertical-align: top;
}

/* Trust */
.lp-trust {
  display: flex;
  justify-content: center;
  margin: 56px 0 48px;
  padding: 18px 0;
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
}
.lp-trust p {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
}

/* Platforms — scene groups */
.lp-platforms {
  margin: 0 0 88px;
  text-align: center;
}

.lp-platforms__label {
  margin: 0 0 1.5rem;
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 650;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.lp-platforms__groups {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px 28px;
  text-align: left;
}

.lp-platforms__group-title {
  margin: 0 0 0.85rem;
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0.05em;
  color: var(--oc-accent-hover);
}

.lp-platforms__list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lp-platforms__list li {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.85rem 0.5rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--vp-c-border);
  background: color-mix(in srgb, var(--vp-c-bg-elv) 55%, transparent);
  font-family: var(--font-display);
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
  white-space: nowrap;
}

.lp-platforms__logo {
  display: inline-block;
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
  background: currentColor;
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  opacity: 0.92;
}

@media (max-width: 860px) {
  .lp-platforms__groups {
    grid-template-columns: 1fr;
    gap: 22px;
  }
}

/* Extension — three vertical shots */
.lp-ext {
  margin: 0 0 112px;
  text-align: center;
}

.lp-ext .lp-body {
  margin-left: auto;
  margin-right: auto;
}

.lp-ext__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px 24px;
  margin-top: 2.5rem;
  align-items: start;
}

.lp-ext__card {
  margin: 0;
  text-align: left;
}

.lp-ext__frame {
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, #fff 7%, #1e2028);
  background: #0e1015;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.28),
    0 16px 36px rgba(0, 0, 0, 0.32),
    0 4px 12px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.lp-ext__frame img {
  display: block;
  width: 100%;
  height: auto;
}

.lp-ext__card figcaption {
  margin-top: 0.85rem;
  padding: 0 0.1rem;
}

.lp-ext__card strong {
  display: block;
  font-family: var(--font-display);
  font-size: 0.98rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
}

.lp-ext__card span {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.86rem;
  line-height: 1.5;
  color: var(--vp-c-text-3);
}

@media (max-width: 860px) {
  .lp-ext__grid {
    grid-template-columns: 1fr;
    max-width: 320px;
    margin-left: auto;
    margin-right: auto;
  }
}

.lp-kicker {
  margin: 0 0 0.85rem;
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 650;
  letter-spacing: 0.06em;
  color: var(--oc-accent-hover);
}

.lp-h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.65rem, 3vw, 2.35rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.2;
  color: var(--vp-c-text-1);
}

.lp-body {
  margin: 1.1rem 0 0;
  max-width: 34rem;
  font-size: 1.05rem;
  line-height: 1.8;
  color: var(--vp-c-text-2);
}

.lp-case {
  max-width: 36rem;
  margin: 0 auto 112px;
  text-align: center;
}
.lp-case .lp-body {
  margin-left: auto;
  margin-right: auto;
}

.lp-story {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: start;
  margin-bottom: 112px;
}

.lp-roles {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--vp-c-divider);
}
.lp-roles li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 1.2rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
.lp-roles strong {
  font-family: var(--font-display);
  font-size: 1.05rem;
  color: var(--vp-c-text-1);
}
.lp-roles span {
  font-size: 0.92rem;
  color: var(--vp-c-text-3);
  text-align: right;
}

.lp-pipeline {
  margin-bottom: 112px;
  text-align: center;
}
.lp-pipeline .lp-body {
  margin-left: auto;
  margin-right: auto;
}

.lp-pipe {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 2.5rem 0 0;
  padding: 0;
}
.lp-pipe li {
  padding: 1.5rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--vp-c-border);
  background: transparent;
}
.lp-pipe span {
  display: block;
  margin-bottom: 0.65rem;
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--oc-accent);
}
.lp-pipe strong {
  font-family: var(--font-display);
  font-size: 1.15rem;
  color: var(--vp-c-text-1);
}

.lp-more {
  display: inline-block;
  margin-top: 1.75rem;
  font-family: var(--font-display);
  font-weight: 650;
  font-size: 0.95rem;
  color: var(--vp-c-text-2) !important;
  text-decoration: none !important;
  border-bottom: 1px solid var(--vp-c-border);
  padding-bottom: 2px;
}
.lp-more:hover {
  color: var(--oc-accent-hover) !important;
  border-bottom-color: var(--oc-accent);
}

.lp-local {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 56px;
  align-items: center;
  margin-bottom: 112px;
  padding: 40px 0;
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
}

.lp-local__list {
  margin: 0;
  padding: 0;
}
.lp-local__list > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 1rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
.lp-local__list > div:last-child {
  border-bottom: none;
}
.lp-local__list dt {
  font-size: 0.98rem;
  color: var(--vp-c-text-1);
}
.lp-local__list dd {
  margin: 0;
  font-size: 0.85rem;
  color: var(--oc-accent-hover);
}

.lp-start {
  margin-bottom: 112px;
}
.lp-start ol {
  list-style: none;
  margin: 2.25rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  counter-reset: s;
}
.lp-start li {
  counter-increment: s;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 1.45rem 1.35rem 1.5rem;
  border-radius: 12px;
  border: 1px solid var(--vp-c-border);
  background: color-mix(in srgb, var(--vp-c-bg-elv) 55%, transparent);
  min-height: 100%;
}
.lp-start li::before {
  content: counter(s, decimal-leading-zero);
  display: block;
  margin-bottom: 0.35rem;
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--oc-accent);
}
.lp-start strong {
  display: block;
  font-family: var(--font-display);
  font-size: 1.08rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
}
.lp-start p {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.65;
  color: var(--vp-c-text-3);
}

.lp-examples {
  margin-bottom: 112px;
}
.lp-examples__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 2.25rem;
}
.lp-examples__grid article {
  padding: 1.5rem 1.35rem;
  border-radius: 12px;
  border: 1px solid var(--vp-c-border);
  background: transparent;
}
.lp-examples__grid span {
  display: block;
  margin-bottom: 0.85rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--oc-accent-hover);
}
.lp-examples__grid p {
  margin: 0;
  font-size: 1.02rem;
  line-height: 1.6;
  color: var(--vp-c-text-1);
}

.lp-faq {
  max-width: 640px;
  margin: 0 auto 96px;
  scroll-margin-top: 88px;
}
.lp-faq__list {
  margin-top: 1.75rem;
  border-top: 1px solid var(--vp-c-divider);
}
.lp-faq details {
  border-bottom: 1px solid var(--vp-c-divider);
}
.lp-faq summary {
  cursor: pointer;
  list-style: none;
  padding: 1.25rem 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 650;
  color: var(--vp-c-text-1);
}
.lp-faq summary::-webkit-details-marker {
  display: none;
}
.lp-faq details p {
  margin: 0 0 1.25rem;
  font-size: 0.98rem;
  line-height: 1.75;
  color: var(--vp-c-text-2);
}

.lp-finale {
  text-align: center;
  padding-top: 56px;
  border-top: 1px solid var(--vp-c-divider);
}
.lp-finale .lp-body {
  margin-left: auto;
  margin-right: auto;
}
.lp-finale .lp-actions {
  margin-top: 1.75rem;
}

@media (max-width: 960px) {
  .lp-story,
  .lp-local,
  .lp-pipe,
  .lp-examples__grid {
    grid-template-columns: 1fr;
  }

  .lp-start ol {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .lp-roles span {
    text-align: left;
  }

  .lp-roles li {
    flex-direction: column;
    gap: 4px;
  }

  .lp-case,
  .lp-story,
  .lp-pipeline,
  .lp-local,
  .lp-start,
  .lp-examples,
  .lp-ext {
    margin-bottom: 80px;
  }
}

@media (max-width: 640px) {
  .lp {
    padding: 0 18px 96px;
  }
  .lp-hero {
    padding-top: clamp(96px, 14vh, 140px);
    align-items: flex-start;
    text-align: left;
  }
  .lp-hero .lp-actions,
  .lp-actions__btns {
    align-items: flex-start;
  }
  .lp-start ol {
    grid-template-columns: 1fr;
  }
  .lp-stage {
    margin-top: 72px;
  }
  .lp-actions {
    justify-content: flex-start;
  }
  .lp-actions__note {
    text-align: left;
  }
  .lp-trust {
    justify-content: flex-start;
  }
  .lp-case,
  .lp-pipeline,
  .lp-finale,
  .lp-ext {
    text-align: left;
  }
  .lp-case .lp-body,
  .lp-pipeline .lp-body,
  .lp-finale .lp-body,
  .lp-ext .lp-body {
    margin-left: 0;
  }
  .lp-finale .lp-actions {
    justify-content: flex-start;
  }
}

/* Light overrides — whole selector must be inside :global(), otherwise Vue scoped
   compiles `:global(html:not(.dark)) .x` into `html:not(.dark) { … }` and can hide the page. */
:global(html:not(.dark) .lp-glow) {
  background:
    radial-gradient(ellipse 46% 36% at 50% 0%, rgba(225, 29, 72, 0.07), transparent 74%),
    radial-gradient(ellipse 28% 24% at 88% 16%, rgba(13, 148, 136, 0.04), transparent 70%);
}

:global(html:not(.dark) .lp-brand) {
  background: #fff;
  border-color: var(--oc-border);
  box-shadow: 0 1px 2px rgba(15, 18, 24, 0.04);
}

:global(html:not(.dark) .lp-btn--primary) {
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.2) inset,
    0 8px 22px rgba(225, 29, 72, 0.22);
}

:global(html:not(.dark) .lp-btn--ghost) {
  background: #fff;
  border-color: var(--oc-border-strong);
  box-shadow: 0 1px 2px rgba(15, 18, 24, 0.03);
}

:global(html:not(.dark) .lp-btn--ghost:hover) {
  background: #fff;
  border-color: color-mix(in srgb, var(--oc-accent) 35%, var(--oc-border-strong));
}

:global(html:not(.dark) .lp-stage__frame) {
  background: #fff;
  border-color: rgba(15, 18, 24, 0.08);
  box-shadow:
    0 0 0 1px rgba(15, 18, 24, 0.03),
    0 22px 48px rgba(15, 18, 24, 0.1),
    0 6px 16px rgba(15, 18, 24, 0.05);
}

:global(html:not(.dark) .lp-stage__glow) {
  display: none;
}

:global(html:not(.dark) .lp-platforms__list li) {
  background: #fff;
  border-color: var(--oc-border);
  box-shadow: 0 1px 2px rgba(15, 18, 24, 0.03);
  color: var(--vp-c-text-1);
}

:global(html:not(.dark) .lp-ext__frame) {
  background: #fff;
  border-color: rgba(15, 18, 24, 0.07);
  box-shadow:
    0 0 0 1px rgba(15, 18, 24, 0.025),
    0 12px 28px rgba(15, 18, 24, 0.07);
}

:global(html:not(.dark) .lp-start li) {
  background: #fff;
  border-color: var(--oc-border);
  box-shadow: 0 1px 2px rgba(15, 18, 24, 0.03);
}

:global(html:not(.dark) .lp-pipe li),
:global(html:not(.dark) .lp-examples__grid article) {
  background: #fff;
  border-color: var(--oc-border);
  box-shadow: 0 1px 2px rgba(15, 18, 24, 0.03);
}

:global(html:not(.dark) .lp-trust) {
  border-color: var(--oc-border);
}

:global(html:not(.dark) .lp-faq details),
:global(html:not(.dark) .lp-faq__list),
:global(html:not(.dark) .lp-finale) {
  border-color: var(--oc-border);
}
</style>
