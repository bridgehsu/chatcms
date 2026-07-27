import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { MarkdownCodeBlock } from "./MarkdownCodeBlock";

type Props = {
  content: string;
  /** 流式输出时在末尾追加光标 */
  streaming?: boolean;
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
  // 块级由 MarkdownCodeBlock 自带 pre；此处拆掉外层避免双重包裹
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = String(children).replace(/\n$/, "");
    const match = /language-([\w+-]+)/.exec(className ?? "");
    if (match || text.includes("\n")) {
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

/**
 * 助手消息 Markdown 渲染
 * react-markdown + GFM + sanitize，对齐 ChatGPT / Claude 可读排版
 */
export const MarkdownContent = ({ content, streaming = false }: Props) => {
  const text = typeof content === "string" ? content : String(content ?? "");
  if (!text.trim()) {
    return (
      <div className="md-content">
        <p className="md-content__placeholder">思考中…</p>
        {streaming && <span className="cursor" aria-hidden="true" />}
      </div>
    );
  }

  return (
    <div className={`md-content${streaming ? " is-streaming" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={components}
      >
        {text}
      </ReactMarkdown>
      {streaming && <span className="cursor" aria-hidden="true" />}
    </div>
  );
};
