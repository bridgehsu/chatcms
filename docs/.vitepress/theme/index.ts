import DefaultTheme from "vitepress/theme";
import { nextTick, onMounted, watch } from "vue";
import { useRoute } from "vitepress";
import mermaid from "mermaid";
import "./custom.css";

async function renderMermaid() {
  await nextTick();
  const nodes = document.querySelectorAll<HTMLElement>(".mermaid:not([data-processed])");
  if (!nodes.length) return;
  const dark = document.documentElement.classList.contains("dark");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: dark ? "dark" : "default",
    themeVariables: dark
      ? {
          primaryColor: "#1f2330",
          primaryTextColor: "#d4d4d8",
          primaryBorderColor: "#2e3040",
          lineColor: "#8b8b94",
          secondaryColor: "#191c24",
          tertiaryColor: "#0e1015",
          fontFamily: "Inter, system-ui, sans-serif",
        }
      : {
          primaryColor: "#eef0f3",
          primaryTextColor: "#1c1f26",
          primaryBorderColor: "#d1d5db",
          lineColor: "#6b7280",
          secondaryColor: "#ffffff",
          tertiaryColor: "#f3f4f6",
          fontFamily: "Inter, system-ui, sans-serif",
        },
  });
  await mermaid.run({ nodes });
}

export default {
  ...DefaultTheme,
  setup() {
    const route = useRoute();
    onMounted(() => {
      void renderMermaid();
    });
    watch(
      () => route.path,
      () => {
        void renderMermaid();
      },
    );
  },
};
