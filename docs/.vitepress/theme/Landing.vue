<script setup lang="ts">
import { withBase } from "vitepress";

const faqs = [
  {
    q: "ChatCMS 是什么？",
    a: "面向新媒体种草的开源桌面 Agent。把采集、写作、生图生视频、多平台发布放进本机工作台，数据与账号留在你自己的机器上。",
  },
  {
    q: "适合谁用？",
    a: "品牌与电商运营、达人工作室、独立创作者，以及需要私有化 / 二开的技术团队。",
  },
  {
    q: "和网页 SaaS 有什么区别？",
    a: "本地优先：会话、素材、账号保险柜落在本机；权限与审计可查。敏感内容不必上云。",
  },
  {
    q: "能否二开和私有化？",
    a: "可以。源码开放，Skills / MCP / 模型可插拔，可按品类扩展 Agent 角色与流水线。",
  },
];
</script>

<template>
  <div class="lp">
    <div class="lp-glow" aria-hidden="true" />

    <header class="lp-hero">
      <div class="lp-hero__copy">
        <p class="lp-eyebrow">为受够工具碎片化的种草团队而做</p>
        <h1 class="lp-title">
          让 Agent 帮你种草。<br />
          <span>你掌控节奏与数据。</span>
        </h1>
        <p class="lp-sub">
          开源桌面端新媒体种草 Agent。选题、文案、成片、发布——一条链路完成，全部留在本地。
        </p>
        <div class="lp-actions">
          <a class="lp-btn lp-btn--primary" :href="withBase('/guide/getting-started')">开始种草</a>
          <a
            class="lp-btn lp-btn--ghost"
            href="https://github.com/bridgehsu/chatcms"
            target="_blank"
            rel="noreferrer"
          >星标 GitHub</a>
        </div>
        <p class="lp-note">开源免费 · 本地优先 · 可私有化</p>
      </div>

      <aside class="lp-demo" aria-label="产品示意">
        <div class="lp-demo__chrome">
          <span /><span /><span />
          <em>ChatCMS · Agent</em>
        </div>
        <div class="lp-demo__body">
          <div class="lp-demo__side">
            <b>种草主脑</b>
            <i>文案 Agent</i>
            <i>视觉 Agent</i>
            <i>剪辑 Agent</i>
          </div>
          <div class="lp-demo__main">
            <div class="lp-demo__bubble lp-demo__bubble--user">
              帮我做一篇小红书种草：春季防晒，语气真实一点
            </div>
            <div class="lp-demo__bubble lp-demo__bubble--ai">
              已选定「文案 Agent」· 正在检索知识库爆款结构…
              <div class="lp-demo__tags">
                <span>洞察</span><span>大纲</span><span>成稿</span>
              </div>
            </div>
            <div class="lp-demo__preview">
              <strong>春日轻薄防晒｜真的不假白</strong>
              <p>通勤党实测一周：成膜快、不搓泥，妆前也能叠…</p>
            </div>
          </div>
        </div>
      </aside>
    </header>

    <section class="lp-strip">
      <p>打通种草全链路</p>
      <ul>
        <li>Ask / Agent / Search</li>
        <li>多角色协作</li>
        <li>笔记 · 生图 · 成片</li>
        <li>采集与发布</li>
        <li>权限审计</li>
      </ul>
    </section>

    <section class="lp-case">
      <p class="lp-kicker">The case</p>
      <h2 class="lp-h2">别再当「人肉内容中台」。</h2>
      <p class="lp-body lp-body--wide">
        选题、文案、出图、发稿被拆成十几个工具。如果日常生产不再靠人肉串联，团队只处理真正值得拍板的决策呢？
      </p>
    </section>

    <section class="lp-feature">
      <div class="lp-feature__copy">
        <p class="lp-kicker">Multi-agent</p>
        <h2 class="lp-h2">你的种草搭档，不只是聊天</h2>
        <p class="lp-body">
          Agent 模式带工具与技能上场。主脑调度文案、视觉、剪辑角色，像带一支随时在线的种草小队。
        </p>
      </div>
      <div class="lp-panel">
        <div class="lp-panel__row"><span>模式</span><b>Agent</b></div>
        <div class="lp-panel__row"><span>角色</span><b>种草文案 · 已绑定</b></div>
        <div class="lp-panel__row"><span>技能</span><b>content-publish · image-brief</b></div>
        <div class="lp-panel__row lp-panel__row--ok"><span>状态</span><b>工具授权 · 可审计</b></div>
      </div>
    </section>

    <section class="lp-feature lp-feature--rev">
      <div class="lp-feature__copy">
        <p class="lp-kicker">Pipeline</p>
        <h2 class="lp-h2">从灵感到成片，不断线</h2>
        <p class="lp-body">
          采集、笔记、图片工厂、口播 / 生视频、发布桥接接在同一工作台——少切换，多产出。数据留在本机。
        </p>
        <a class="lp-text-link" :href="withBase('/guide/overview')">了解产品能力 →</a>
      </div>
      <div class="lp-steps-card">
        <div><span>01</span><strong>洞察</strong><em>采集 · 知识库</em></div>
        <div><span>02</span><strong>创作</strong><em>会话 · 笔记 · 成片</em></div>
        <div><span>03</span><strong>发布</strong><em>桥接 · 多平台</em></div>
        <div><span>04</span><strong>复盘</strong><em>链路 · 权限</em></div>
      </div>
    </section>

    <section class="lp-setup">
      <p class="lp-kicker">Get started</p>
      <h2 class="lp-h2">安装。配角色。开始种草。</h2>
      <ol class="lp-setup__list">
        <li>
          <strong>安装桌面端</strong>
          <p>启动 ChatCMS，连上你的模型供应商。</p>
        </li>
        <li>
          <strong>配置种草角色</strong>
          <p>为文案 / 视觉 / 剪辑建立 Agent 与技能。</p>
        </li>
        <li>
          <strong>跑通一条链路</strong>
          <p>从洞察到发布，用 Agent 模式走完一遍。</p>
        </li>
      </ol>
    </section>

    <section class="lp-examples">
      <p class="lp-kicker">Examples</p>
      <h2 class="lp-h2">这些事，以前要开五个软件</h2>
      <div class="lp-examples__grid">
        <article>
          <span>文案</span>
          <q>写一篇小红书种草：气垫粉底，避雷假白</q>
        </article>
        <article>
          <span>成片</span>
          <q>按口播稿做成 9:16，8 秒，字幕偏大</q>
        </article>
        <article>
          <span>发布</span>
          <q>对接发布桥接，准备发到小红书</q>
        </article>
      </div>
    </section>

    <section class="lp-faq">
      <p class="lp-kicker">FAQ</p>
      <h2 class="lp-h2">常见问题</h2>
      <div class="lp-faq__list">
        <details v-for="item in faqs" :key="item.q" class="lp-faq__item">
          <summary>{{ item.q }}</summary>
          <p>{{ item.a }}</p>
        </details>
      </div>
    </section>

    <section class="lp-finale">
      <h2 class="lp-h2">别再为工具切换买单。</h2>
      <p class="lp-body">开源、本机、可扩展——把下一场种草交给 Agent。</p>
      <div class="lp-actions">
        <a class="lp-btn lp-btn--primary" :href="withBase('/guide/getting-started')">免费开始种草</a>
        <a class="lp-btn lp-btn--ghost" :href="withBase('/concepts/agent-loop')">看 Agent Loop →</a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lp {
  position: relative;
  isolation: isolate;
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 32px 120px;
  overflow: clip;
}

.lp-glow {
  position: absolute;
  inset: -8% -30% auto;
  height: 70vh;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(ellipse 48% 40% at 18% 8%, rgba(255, 92, 92, 0.18), transparent 70%),
    radial-gradient(ellipse 40% 34% at 88% 0%, rgba(20, 184, 166, 0.1), transparent 68%);
}

.lp-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 56px;
  align-items: center;
  padding: 80px 0 72px;
  min-height: min(84vh, 720px);
}

.lp-eyebrow {
  margin: 0 0 1.35rem;
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--oc-accent-hover);
}

.lp-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 5.4vw, 3.85rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.04em;
  color: var(--vp-c-text-1);
}

.lp-title span {
  background: linear-gradient(105deg, #ffb4b4, #ff5c5c 50%, #14b8a6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.lp-sub {
  margin: 1.6rem 0 0;
  max-width: 30em;
  font-size: 1.12rem;
  line-height: 1.8;
  color: var(--vp-c-text-2);
}

.lp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 2.25rem;
}

.lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 1.45rem;
  border-radius: 10px;
  font-family: var(--font-display);
  font-size: 0.98rem;
  font-weight: 650;
  text-decoration: none !important;
  transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
}

.lp-btn:hover {
  transform: translateY(-2px);
}

.lp-btn--primary {
  color: #fff !important;
  background: var(--oc-accent);
  box-shadow: 0 14px 36px color-mix(in srgb, var(--oc-accent) 40%, transparent);
}

.lp-btn--primary:hover {
  background: var(--oc-accent-hover);
}

.lp-btn--ghost {
  color: var(--vp-c-text-1) !important;
  border: 1px solid var(--vp-c-border);
  background: color-mix(in srgb, var(--oc-bg-elevated) 45%, transparent);
}

.lp-note {
  margin: 1.15rem 0 0;
  font-size: 0.9rem;
  color: var(--vp-c-text-3);
}

.lp-demo {
  border-radius: 16px;
  border: 1px solid var(--vp-c-border);
  background: color-mix(in srgb, var(--oc-card) 88%, transparent);
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

.lp-demo__chrome {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 16px;
  background: var(--oc-bg-elevated);
  border-bottom: 1px solid var(--vp-c-divider);
}

.lp-demo__chrome span {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #2e3040;
}

.lp-demo__chrome span:nth-child(1) {
  background: #ff5c5c;
}
.lp-demo__chrome span:nth-child(2) {
  background: #f59e0b;
}
.lp-demo__chrome span:nth-child(3) {
  background: #14b8a6;
}

.lp-demo__chrome em {
  margin-left: 8px;
  font-style: normal;
  font-size: 0.78rem;
  color: var(--vp-c-text-3);
}

.lp-demo__body {
  display: grid;
  grid-template-columns: 118px 1fr;
  min-height: 320px;
}

.lp-demo__side {
  padding: 16px 12px;
  border-right: 1px solid var(--vp-c-divider);
  background: rgba(0, 0, 0, 0.2);
}

.lp-demo__side b,
.lp-demo__side i {
  display: block;
  font-style: normal;
  font-size: 0.78rem;
  padding: 9px 8px;
  border-radius: 8px;
  margin-bottom: 6px;
}

.lp-demo__side b {
  color: #fff;
  background: color-mix(in srgb, var(--oc-accent) 28%, transparent);
  font-weight: 650;
}

.lp-demo__side i {
  color: var(--vp-c-text-3);
}

.lp-demo__main {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.lp-demo__bubble {
  padding: 14px 16px;
  border-radius: 12px;
  font-size: 0.9rem;
  line-height: 1.6;
}

.lp-demo__bubble--user {
  align-self: flex-end;
  max-width: 92%;
  background: color-mix(in srgb, var(--oc-accent) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--oc-accent) 35%, transparent);
  color: var(--vp-c-text-1);
}

.lp-demo__bubble--ai {
  align-self: flex-start;
  max-width: 95%;
  background: var(--oc-bg-elevated);
  border: 1px solid var(--vp-c-border);
  color: var(--vp-c-text-2);
}

.lp-demo__tags {
  display: flex;
  gap: 6px;
  margin-top: 12px;
}

.lp-demo__tags span {
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.72rem;
  background: rgba(20, 184, 166, 0.15);
  color: #5eead4;
}

.lp-demo__preview {
  margin-top: auto;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px dashed var(--vp-c-border);
  background: rgba(255, 255, 255, 0.02);
}

.lp-demo__preview strong {
  display: block;
  font-size: 0.92rem;
  color: var(--vp-c-text-1);
  margin-bottom: 8px;
}

.lp-demo__preview p {
  margin: 0;
  font-size: 0.84rem;
  color: var(--vp-c-text-3);
  line-height: 1.55;
}

.lp-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px 32px;
  padding: 28px 0;
  margin: 8px 0 96px;
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
}

.lp-strip > p {
  margin: 0;
  font-size: 0.88rem;
  color: var(--vp-c-text-3);
}

.lp-strip ul {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 22px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.lp-strip li {
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.lp-kicker {
  margin: 0 0 1rem;
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--oc-accent-hover);
}

.lp-h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 3.2vw, 2.5rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.18;
  color: var(--vp-c-text-1);
}

.lp-body {
  margin: 1.25rem 0 0;
  max-width: 32rem;
  font-size: 1.08rem;
  line-height: 1.8;
  color: var(--vp-c-text-2);
}

.lp-body--wide {
  max-width: 40rem;
}

.lp-text-link {
  display: inline-block;
  margin-top: 1.5rem;
  font-family: var(--font-display);
  font-weight: 650;
  font-size: 0.95rem;
  color: var(--oc-accent-hover) !important;
  text-decoration: none !important;
}

.lp-case {
  margin-bottom: 120px;
  max-width: 44rem;
  padding-top: 16px;
}

.lp-feature {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 56px;
  align-items: center;
  margin-bottom: 120px;
}

.lp-feature--rev .lp-feature__copy {
  order: 2;
}
.lp-feature--rev .lp-steps-card {
  order: 1;
}

.lp-panel,
.lp-steps-card {
  border-radius: 16px;
  border: 1px solid var(--vp-c-border);
  background: color-mix(in srgb, var(--oc-card) 80%, transparent);
  overflow: hidden;
}

.lp-panel__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 0.95rem;
}

.lp-panel__row:last-child {
  border-bottom: none;
}

.lp-panel__row span {
  color: var(--vp-c-text-3);
}

.lp-panel__row b {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.lp-panel__row--ok b {
  color: #5eead4;
}

.lp-steps-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.lp-steps-card > div {
  padding: 28px 22px;
  border-right: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
}

.lp-steps-card > div:nth-child(2n) {
  border-right: none;
}

.lp-steps-card > div:nth-child(n + 3) {
  border-bottom: none;
}

.lp-steps-card span {
  display: block;
  margin-bottom: 0.75rem;
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--oc-accent);
}

.lp-steps-card strong {
  display: block;
  font-family: var(--font-display);
  font-size: 1.15rem;
  margin-bottom: 0.45rem;
  color: var(--vp-c-text-1);
}

.lp-steps-card em {
  font-style: normal;
  font-size: 0.9rem;
  color: var(--vp-c-text-3);
}

.lp-setup {
  margin-bottom: 120px;
}

.lp-setup__list {
  list-style: none;
  margin: 2.5rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  counter-reset: setup;
}

.lp-setup__list li {
  padding: 1.75rem 1.4rem;
  border-radius: 14px;
  border: 1px solid var(--vp-c-border);
  background: color-mix(in srgb, var(--oc-card) 70%, transparent);
  counter-increment: setup;
}

.lp-setup__list li::before {
  content: counter(setup, decimal-leading-zero);
  display: block;
  margin-bottom: 1rem;
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--oc-accent);
}

.lp-setup__list strong {
  display: block;
  font-family: var(--font-display);
  font-size: 1.1rem;
  margin-bottom: 0.55rem;
  color: var(--vp-c-text-1);
}

.lp-setup__list p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.65;
  color: var(--vp-c-text-3);
}

.lp-examples {
  margin-bottom: 120px;
}

.lp-examples__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 2.5rem;
}

.lp-examples__grid article {
  padding: 1.6rem 1.4rem;
  border-radius: 14px;
  border: 1px solid var(--vp-c-border);
  background: color-mix(in srgb, var(--oc-card) 65%, transparent);
}

.lp-examples__grid span {
  display: inline-block;
  margin-bottom: 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--oc-accent-hover);
}

.lp-examples__grid q {
  display: block;
  quotes: "“" "”";
  font-size: 1.02rem;
  line-height: 1.65;
  color: var(--vp-c-text-1);
}

.lp-faq {
  margin-bottom: 100px;
  max-width: 640px;
}

.lp-faq__list {
  margin-top: 2rem;
  border-top: 1px solid var(--vp-c-divider);
}

.lp-faq__item {
  border-bottom: 1px solid var(--vp-c-divider);
}

.lp-faq__item summary {
  cursor: pointer;
  list-style: none;
  padding: 1.35rem 0;
  font-family: var(--font-display);
  font-size: 1.08rem;
  font-weight: 650;
  color: var(--vp-c-text-1);
}

.lp-faq__item summary::-webkit-details-marker {
  display: none;
}

.lp-faq__item p {
  margin: 0 0 1.35rem;
  font-size: 1rem;
  line-height: 1.75;
  color: var(--vp-c-text-2);
}

.lp-finale {
  padding: 64px 0 8px;
  border-top: 1px solid var(--vp-c-divider);
}

.lp-finale .lp-body {
  margin-bottom: 0.25rem;
}

@media (max-width: 960px) {
  .lp-hero,
  .lp-feature,
  .lp-feature--rev .lp-feature__copy,
  .lp-feature--rev .lp-steps-card,
  .lp-setup__list,
  .lp-examples__grid {
    grid-template-columns: 1fr;
  }

  .lp-feature--rev .lp-feature__copy,
  .lp-feature--rev .lp-steps-card {
    order: initial;
  }

  .lp-hero {
    min-height: auto;
    gap: 40px;
    padding: 48px 0 56px;
  }

  .lp-case,
  .lp-feature,
  .lp-setup,
  .lp-examples {
    margin-bottom: 80px;
  }
}

@media (max-width: 640px) {
  .lp {
    padding: 0 20px 88px;
  }

  .lp-demo__body {
    grid-template-columns: 1fr;
  }

  .lp-demo__side {
    display: flex;
    gap: 6px;
    border-right: none;
    border-bottom: 1px solid var(--vp-c-divider);
    overflow-x: auto;
  }

  .lp-demo__side b,
  .lp-demo__side i {
    white-space: nowrap;
    margin: 0;
  }
}

:global(html:not(.dark)) .lp-title span {
  background: linear-gradient(105deg, #0f1218, #e11d48 55%, #0d9488);
  -webkit-background-clip: text;
  background-clip: text;
}

:global(html:not(.dark)) .lp-demo,
:global(html:not(.dark)) .lp-panel,
:global(html:not(.dark)) .lp-steps-card,
:global(html:not(.dark)) .lp-setup__list li,
:global(html:not(.dark)) .lp-examples__grid article {
  background: #fff;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.06);
}
</style>
