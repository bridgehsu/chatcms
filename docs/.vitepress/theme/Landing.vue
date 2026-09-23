<script setup lang="ts">
import { withBase } from "vitepress";
</script>

<template>
  <div class="lp">
    <div class="lp-glow" aria-hidden="true" />

    <header class="lp-hero">
      <p class="lp-brand">ChatCMS</p>
      <h1 class="lp-title">
        新媒体种草
        <span>Agent</span>
      </h1>
      <p class="lp-sub">
        开源桌面端 · 本地优先<br />
        选题、文案、成片、发布——一条链路种下去
      </p>
      <div class="lp-actions">
        <a class="lp-btn lp-btn--primary" :href="withBase('/guide/getting-started')">开始种草</a>
        <a
          class="lp-btn lp-btn--ghost"
          href="https://github.com/bridgehsu/chatcms"
          target="_blank"
          rel="noreferrer"
        >查看源码</a>
      </div>
    </header>

    <section class="lp-proof" aria-label="产品要点">
      <p><strong>本地可控</strong> 数据与账号留在本机</p>
      <p><strong>多 Agent</strong> 策划 / 文案 / 视觉协作</p>
      <p><strong>全链路</strong> 采集到发布不断线</p>
      <p><strong>可私有化</strong> 开源二开无锁云</p>
    </section>

    <section class="lp-section">
      <p class="lp-kicker">流水线</p>
      <h2 class="lp-h2">从灵感到发布</h2>
      <div class="lp-rail">
        <div class="lp-rail__item">
          <span>01</span>
          <strong>洞察</strong>
          <p>采集竞品与平台动态，沉淀可复用话术</p>
        </div>
        <div class="lp-rail__item">
          <span>02</span>
          <strong>创作</strong>
          <p>会话 Agent 写稿，笔记 / 生图 / 成片一体</p>
        </div>
        <div class="lp-rail__item">
          <span>03</span>
          <strong>发布</strong>
          <p>多平台桥接发稿，账号保险柜本机保管</p>
        </div>
        <div class="lp-rail__item">
          <span>04</span>
          <strong>复盘</strong>
          <p>会话链路可观测，下一轮种草更快</p>
        </div>
      </div>
    </section>

    <section class="lp-section lp-section--split">
      <div class="lp-split__copy">
        <p class="lp-kicker">为谁而做</p>
        <h2 class="lp-h2">真正在跑种草的人</h2>
        <p class="lp-body">
          不是又一个聊天窗口，而是把新媒体生产装进桌面工作台——少切换工具，多产出内容。
        </p>
      </div>
      <ul class="lp-who">
        <li>
          <strong>品牌 / 电商运营</strong>
          <span>可复制的采 → 写 → 出片 → 发</span>
        </li>
        <li>
          <strong>达人 / 工作室</strong>
          <span>多角色并行，本机控素材与账号</span>
        </li>
        <li>
          <strong>独立创作者</strong>
          <span>一个人也能跑完整套种草</span>
        </li>
        <li>
          <strong>技术负责人</strong>
          <span>开源可改，私有化不锁死</span>
        </li>
      </ul>
    </section>

    <section class="lp-finale">
      <h2 class="lp-h2">把下一场种草，交给 Agent</h2>
      <p class="lp-body">免费开源，安装即用。先跑通一条链路，再按品类扩展角色。</p>
      <div class="lp-actions">
        <a class="lp-btn lp-btn--primary" :href="withBase('/guide/getting-started')">免费开始</a>
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
  padding: 0 28px 96px;
  overflow: clip;
}

.lp-glow {
  position: absolute;
  inset: -8% -30% auto;
  height: 70vh;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(ellipse 50% 42% at 50% 0%, rgba(255, 92, 92, 0.22), transparent 70%),
    radial-gradient(ellipse 40% 36% at 12% 30%, rgba(20, 184, 166, 0.1), transparent 65%),
    radial-gradient(ellipse 36% 30% at 90% 20%, rgba(255, 255, 255, 0.04), transparent 60%);
  animation: lp-glow 16s ease-in-out infinite alternate;
}

@keyframes lp-glow {
  from {
    opacity: 0.85;
    transform: scale(1);
  }
  to {
    opacity: 1;
    transform: scale(1.06);
  }
}

.lp-hero {
  min-height: min(78vh, 720px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 72px 0 48px;
  animation: lp-rise 0.8s ease both;
}

@keyframes lp-rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.lp-brand {
  margin: 0 0 1.25rem;
  font-family: var(--font-display);
  font-size: clamp(1.15rem, 2.2vw, 1.45rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  background: linear-gradient(105deg, #fff 10%, #ffb4b4 50%, #ff5c5c 85%, #5eead4 130%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.lp-title {
  margin: 0;
  max-width: 11em;
  font-family: var(--font-display);
  font-size: clamp(2.75rem, 8vw, 5.25rem);
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -0.045em;
  color: var(--vp-c-text-1);
}

.lp-title span {
  display: inline-block;
  background: linear-gradient(105deg, #ff8585, #ff5c5c 55%, #14b8a6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.lp-sub {
  margin: 1.5rem 0 0;
  max-width: 22em;
  font-size: clamp(1.05rem, 2vw, 1.25rem);
  line-height: 1.7;
  color: var(--vp-c-text-2);
  animation: lp-rise 0.9s 0.08s ease both;
}

.lp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 2rem;
  animation: lp-rise 0.9s 0.14s ease both;
}

.lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 1.5rem;
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
  background: color-mix(in srgb, var(--oc-bg-elevated) 40%, transparent);
}

.lp-btn--ghost:hover {
  border-color: color-mix(in srgb, var(--oc-accent) 45%, var(--vp-c-border));
}

.lp-proof {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin: 8px 0 64px;
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
  animation: lp-rise 0.9s 0.2s ease both;
}

.lp-proof p {
  margin: 0;
  padding: 1.35rem 1.1rem;
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--vp-c-text-3);
}

.lp-proof p + p {
  border-left: 1px solid var(--vp-c-divider);
}

.lp-proof strong {
  display: block;
  margin-bottom: 0.3rem;
  font-family: var(--font-display);
  font-size: 0.98rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--vp-c-text-1);
}

.lp-section {
  margin-bottom: 72px;
}

.lp-kicker {
  margin: 0 0 0.75rem;
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--oc-accent-hover);
}

.lp-h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 3.5vw, 2.5rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.15;
  color: var(--vp-c-text-1);
}

.lp-body {
  margin: 1rem 0 0;
  max-width: 32rem;
  font-size: 1.05rem;
  line-height: 1.75;
  color: var(--vp-c-text-2);
}

.lp-rail {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 28px;
  margin-top: 2.25rem;
  padding-top: 1.75rem;
  border-top: 1px solid var(--vp-c-divider);
}

.lp-rail__item span {
  display: block;
  margin-bottom: 0.85rem;
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--oc-accent);
}

.lp-rail__item strong {
  display: block;
  margin-bottom: 0.55rem;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 650;
  letter-spacing: -0.025em;
  color: var(--vp-c-text-1);
}

.lp-rail__item p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.65;
  color: var(--vp-c-text-3);
}

.lp-section--split {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: 48px;
  align-items: start;
}

.lp-who {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--vp-c-divider);
}

.lp-who li {
  display: grid;
  gap: 0.25rem;
  padding: 1.15rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.lp-who strong {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--vp-c-text-1);
}

.lp-who span {
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--vp-c-text-3);
}

.lp-finale {
  margin-top: 24px;
  padding: 56px 0 8px;
  text-align: left;
  border-top: 1px solid var(--vp-c-divider);
}

.lp-finale .lp-actions {
  justify-content: flex-start;
}

@media (max-width: 900px) {
  .lp-proof,
  .lp-rail,
  .lp-section--split {
    grid-template-columns: 1fr 1fr;
  }

  .lp-proof p + p {
    border-left: none;
  }

  .lp-proof p:nth-child(odd) {
    border-right: 1px solid var(--vp-c-divider);
  }

  .lp-proof p:nth-child(-n + 2) {
    border-bottom: 1px solid var(--vp-c-divider);
  }
}

@media (max-width: 640px) {
  .lp {
    padding: 0 18px 72px;
  }

  .lp-hero {
    min-height: auto;
    padding: 48px 0 36px;
  }

  .lp-proof,
  .lp-rail,
  .lp-section--split {
    grid-template-columns: 1fr;
  }

  .lp-proof p,
  .lp-proof p:nth-child(odd) {
    border-right: none;
    border-left: none;
    border-bottom: 1px solid var(--vp-c-divider);
  }

  .lp-proof p:last-child {
    border-bottom: none;
  }

  .lp-section {
    margin-bottom: 56px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-glow,
  .lp-hero,
  .lp-sub,
  .lp-actions,
  .lp-proof {
    animation: none;
  }
}

:global(html:not(.dark)) .lp-brand {
  background: linear-gradient(105deg, #0f1218 0%, #be123c 55%, #0d9488 120%);
  -webkit-background-clip: text;
  background-clip: text;
}
</style>
