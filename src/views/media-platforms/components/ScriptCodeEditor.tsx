import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { useThemeStore } from "@/stores/useThemeStore";

const lightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "var(--text)",
      fontSize: "13px",
      height: "100%",
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-content": {
      caretColor: "var(--accent)",
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      padding: "14px 0",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--text-dim)",
      border: "none",
      borderRight: "1px solid var(--border)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--accent) 6%, transparent)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--accent)",
    },
  },
  { dark: false },
);

const darkChrome = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      fontSize: "13px",
      height: "100%",
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-content": {
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      padding: "14px 0",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      border: "none",
      borderRight: "1px solid var(--border)",
    },
  },
  { dark: true },
);

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** 切换文件时强制 remount，避免光标/历史串档 */
  fileKey: string;
};

export const ScriptCodeEditor = ({ value, onChange, fileKey }: Props) => {
  const resolved = useThemeStore((s) => s.resolved);
  const isDark = resolved === "dark";

  return (
    <div className="script-pkg-editor__cm">
      <CodeMirror
        key={fileKey}
        value={value}
        height="100%"
        maxHeight="100%"
        theme={isDark ? oneDark : "light"}
        extensions={[
          javascript(),
          isDark ? darkChrome : lightTheme,
          EditorView.lineWrapping,
        ]}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          searchKeymap: true,
          history: true,
        }}
        placeholder="// 入口脚本（函数体）。return string | { title, text, url }"
        onChange={onChange}
      />
    </div>
  );
};

export default ScriptCodeEditor;
