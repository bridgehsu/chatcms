import { Component, useEffect, useState, type ComponentProps, type ErrorInfo, type ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { MarkdownCodeBlock } from "./MarkdownCodeBlock";

type RemarkPlugins = NonNullable<ComponentProps<typeof ReactMarkdown>["remarkPlugins"]>;

type Props = {
  content: string;
  /** 流式输出时在末尾追加光标 */
  streaming?: boolean;
};

/**
 * remark-gfm → mdast-util-gfm-autolink-literal 使用 lookbehind 正则。
 * macOS Monterey / Safari < 16.4 的 WebKit（Tauri WKWebView）会抛：
 *   SyntaxError: Invalid regular expression: invalid group specifier name
 * 静态 import 会在模块求值时直接崩整页，故必须特性探测 + 动态 import。
 */
const supportsRegexLookbehind = (() => {
  try {
    new RegExp("(?<=a)b");
    return true;
  } catch {
    return false;
  }
})();

let cachedGfm: RemarkPlugins | null | undefined;
let gfmLoad: Promise<RemarkPlugins | null> | null = null;

const loadRemarkGfm = (): Promise<RemarkPlugins | null> => {
  if (!supportsRegexLookbehind) return Promise.resolve(null);
  if (cachedGfm !== undefined) return Promise.resolve(cachedGfm);
  if (!gfmLoad) {
    gfmLoad = import("remark-gfm")
      .then((m) => {
        cachedGfm = [m.default];
        return cachedGfm;
      })
      .catch(() => {
        cachedGfm = null;
        return null;
      });
  }
  return gfmLoad;
};

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className"]],
  },
};

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const raw = String(children);
    const match = /language-([\w+-]+)/.exec(className ?? "");
    // 块级：有 language-，或去掉末尾换行后仍含换行，或原始带换行（无语言 fence）
    const isBlock = Boolean(match) || raw.includes("\n");
    const text = raw.replace(/\n$/, "");
    if (isBlock) {
      return <MarkdownCodeBlock language={match?.[1]}>{text}</MarkdownCodeBlock>;
    }
    return <code className="md-inline-code">{children}</code>;
  },
  table: ({ children }) => (
    <div className="md-table-wrap">
      <table>{children}</table>
    </div>
  ),
};

class MarkdownErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[MarkdownContent]", error, info);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

const PlainFallback = ({ text, streaming }: { text: string; streaming?: boolean }) => (
  <div className={`md-content${streaming ? " is-streaming" : ""}`}>
    <pre className="md-content__plain">{text}</pre>
    {streaming && <span className="cursor" aria-hidden="true" />}
  </div>
);

/**
 * 助手消息 Markdown 渲染
 * CommonMark 默认可用；GFM（表格等）仅在 WebKit 支持 lookbehind 时启用
 */
export const MarkdownContent = ({ content, streaming = false }: Props) => {
  const text = typeof content === "string" ? content : String(content ?? "");
  const [remarkPlugins, setRemarkPlugins] = useState<RemarkPlugins>(
    () => cachedGfm ?? []
  );

  useEffect(() => {
    if (!supportsRegexLookbehind) return;
    if (cachedGfm) {
      setRemarkPlugins(cachedGfm);
      return;
    }
    let cancelled = false;
    void loadRemarkGfm().then((plugins) => {
      if (!cancelled && plugins) setRemarkPlugins(plugins);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!text.trim()) {
    return (
      <div className="md-content">
        <p className="md-content__placeholder">思考中…</p>
        {streaming && <span className="cursor" aria-hidden="true" />}
      </div>
    );
  }

  return (
    <MarkdownErrorBoundary fallback={<PlainFallback text={text} streaming={streaming} />}>
      <div className={`md-content${streaming ? " is-streaming" : ""}`}>
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
          components={components}
        >
          {text}
        </ReactMarkdown>
        {streaming && <span className="cursor" aria-hidden="true" />}
      </div>
    </MarkdownErrorBoundary>
  );
};
