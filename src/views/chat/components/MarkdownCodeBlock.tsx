import { useState, type ReactNode } from "react";
import { IconCheck, IconCopy } from "@/components/icons";

type Props = {
  language?: string;
  children: ReactNode;
};

/** 助手消息代码块：语言标签 + 一键复制（行业标配） */
export const MarkdownCodeBlock = ({ language, children }: Props) => {
  const [copied, setCopied] = useState(false);

  const text = String(children).replace(/\n$/, "");
  const label = language?.trim() || "code";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="md-code">
      <div className="md-code__bar">
        <span className="md-code__lang">{label}</span>
        <button
          type="button"
          className="md-code__copy"
          onClick={() => void handleCopy()}
          aria-label={copied ? "已复制" : "复制代码"}
        >
          {copied ? <IconCheck /> : <IconCopy />}
          <span>{copied ? "已复制" : "复制"}</span>
        </button>
      </div>
      <pre className="md-code__pre">
        <code className={language ? `language-${language}` : undefined}>{text}</code>
      </pre>
    </div>
  );
};
