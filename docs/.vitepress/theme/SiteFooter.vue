<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";
import type { DefaultTheme } from "vitepress/theme";

/** VitePress 内置社媒图标（与 nav socialLinks 的 icon 名对齐） */
const ICON_SVG: Record<string, string> = {
  github:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>',
  twitter:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>',
  discord:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.7 19.7 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14 14 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.8 19.8 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/></svg>',
};

const { theme, frontmatter } = useData();

const links = computed(() => (theme.value.socialLinks ?? []) as DefaultTheme.SocialLink[]);

const show = computed(() => frontmatter.value.footer !== false);

function iconHtml(icon: DefaultTheme.SocialLinkIcon): string {
  if (typeof icon === "object") return icon.svg;
  return ICON_SVG[icon] ?? "";
}
</script>

<template>
  <footer v-if="show" class="site-footer">
    <div class="site-footer__inner">
      <div class="site-footer__left">
        <p class="site-footer__msg">开源新媒体种草 Agent · 本地优先 · 可私有化</p>
        <p class="site-footer__copy">Copyright © ChatCMS contributors</p>
      </div>
      <div v-if="links.length" class="site-footer__social" aria-label="社交媒体">
        <a
          v-for="item in links"
          :key="item.link"
          class="site-footer__link"
          :href="item.link"
          :aria-label="item.ariaLabel ?? (typeof item.icon === 'string' ? item.icon : 'social')"
          target="_blank"
          rel="noopener noreferrer"
          v-html="iconHtml(item.icon)"
        />
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  position: relative;
  z-index: var(--vp-z-index-footer);
  border-top: 1px solid var(--vp-c-divider);
  padding: 28px 24px;
  background: transparent;
}

.site-footer__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px 32px;
  max-width: var(--vp-layout-max-width);
  margin: 0 auto;
}

.site-footer__left {
  min-width: 0;
}

.site-footer__msg,
.site-footer__copy {
  margin: 0;
  line-height: 1.55;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.site-footer__copy {
  margin-top: 0.2rem;
  color: var(--vp-c-text-3);
  font-weight: 450;
}

.site-footer__social {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}

.site-footer__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: var(--vp-c-text-2);
  transition: color 0.2s ease, background 0.2s ease;
}

.site-footer__link:hover {
  color: var(--vp-c-text-1);
  background: color-mix(in srgb, var(--vp-c-text-1) 6%, transparent);
}

.site-footer__link :deep(svg) {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

@media (max-width: 640px) {
  .site-footer__inner {
    flex-direction: column;
    align-items: flex-start;
  }

  .site-footer__social {
    margin-left: -6px;
  }
}
</style>
