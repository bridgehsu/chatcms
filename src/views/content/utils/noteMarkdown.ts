import { marked } from "marked";
import TurndownService from "turndown";

marked.setOptions({
  gfm: true,
  breaks: false,
});

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});

turndown.addRule("taskListItem", {
  filter: (node) =>
    node.nodeName === "LI" &&
    (node as HTMLElement).getAttribute?.("data-type") === "taskItem",
  replacement: (_content, node) => {
    const el = node as HTMLElement;
    const checked = el.getAttribute("data-checked") === "true";
    const text = el.textContent?.trim() ?? "";
    return `- [${checked ? "x" : " "}] ${text}\n`;
  },
});

turndown.addRule("strikethrough", {
  filter: ["del", "s", "strike"] as unknown as TurndownService.Filter,
  replacement: (content) => `~~${content}~~`,
});

turndown.addRule("underline", {
  filter: ["u"] as unknown as TurndownService.Filter,
  replacement: (content) => content,
});

turndown.addRule("keepPreCode", {
  filter: (node) =>
    node.nodeName === "PRE" && node.firstChild?.nodeName === "CODE",
  replacement: (_content, node) => {
    const code = node.firstChild as HTMLElement;
    const lang = (code.getAttribute("class") || "")
      .replace(/^language-/, "")
      .trim();
    const text = code.textContent || "";
    return `\n\`\`\`${lang}\n${text.replace(/\n$/, "")}\n\`\`\`\n\n`;
  },
});

export const markdownToHtml = (markdown: string): string => {
  const src = markdown.trim();
  if (!src) return "<p></p>";
  const html = marked.parse(src, { async: false }) as string;
  return html.trim() || "<p></p>";
};

export const htmlToMarkdown = (html: string): string => {
  const md = turndown.turndown(html || "");
  return md.replace(/\n{3,}/g, "\n\n").trim();
};
