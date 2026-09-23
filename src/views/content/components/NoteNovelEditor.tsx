import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Sparkles,
  Text as TextIcon,
} from "lucide-react";
import {
  addAIHighlight,
  AIHighlight,
  CharacterCount,
  Command,
  createSuggestionItems,
  EditorBubble,
  EditorBubbleItem,
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  EditorRoot,
  handleCommandNavigation,
  HighlightExtension,
  HorizontalRule,
  Placeholder,
  removeAIHighlight,
  renderItems,
  StarterKit,
  TaskItem,
  TaskList,
  TiptapLink,
  TiptapUnderline,
  useEditor,
  type EditorInstance,
} from "novel";
import { htmlToMarkdown, markdownToHtml } from "../utils/noteMarkdown";
import { NoteAiPanel, type NoteAiScope } from "./NoteAiPanel";

export type NoteNovelApi = {
  getMarkdown: () => string;
  getSelectedText: () => string;
  applyMarkdown: (markdown: string, mode?: "selection" | "document" | "insert") => void;
  openAi: (scope?: NoteAiScope) => void;
  focus: () => void;
};

type Props = {
  noteId: string;
  content: string;
  onChange: (markdown: string) => void;
  onReady?: (api: NoteNovelApi) => void;
};

/** Slash「AI 改写」回调（避免扩展重建） */
const slashAiOpenRef: { current: (() => void) | null } = { current: null };

const buildSuggestionItems = () =>
  createSuggestionItems([
    {
      title: "正文",
      description: "普通段落",
      searchTerms: ["p", "text", "paragraph"],
      icon: <TextIcon size={16} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      },
    },
    {
      title: "标题 1",
      description: "大标题",
      searchTerms: ["h1", "title"],
      icon: <Heading1 size={16} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
      },
    },
    {
      title: "标题 2",
      description: "中标题",
      searchTerms: ["h2", "subtitle"],
      icon: <Heading2 size={16} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
      },
    },
    {
      title: "标题 3",
      description: "小标题",
      searchTerms: ["h3"],
      icon: <Heading3 size={16} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
      },
    },
    {
      title: "无序列表",
      description: "项目符号",
      searchTerms: ["ul", "bullet"],
      icon: <List size={16} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "有序列表",
      description: "数字编号",
      searchTerms: ["ol", "number"],
      icon: <ListOrdered size={16} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "待办",
      description: "任务勾选",
      searchTerms: ["todo", "task", "checkbox"],
      icon: <CheckSquare size={16} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: "引用",
      description: "引用块",
      searchTerms: ["quote", "blockquote"],
      icon: <Quote size={16} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: "代码块",
      description: "代码片段",
      searchTerms: ["code"],
      icon: <Code2 size={16} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: "AI 改写",
      description: "在光标处打开 Ask AI",
      searchTerms: ["ai", "rewrite", "ask"],
      icon: <Sparkles size={16} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        // 等 slash tippy 收起后再开面板
        window.requestAnimationFrame(() => slashAiOpenRef.current?.());
      },
    },
  ]);

const suggestionItems = buildSuggestionItems();

const slashCommand = Command.configure({
  suggestion: {
    items: () => suggestionItems,
    render: renderItems,
  },
});

const extensions = [
  StarterKit.configure({
    bulletList: { HTMLAttributes: { class: "note-novel__ul" } },
    orderedList: { HTMLAttributes: { class: "note-novel__ol" } },
    listItem: { HTMLAttributes: { class: "note-novel__li" } },
    blockquote: { HTMLAttributes: { class: "note-novel__quote" } },
    codeBlock: { HTMLAttributes: { class: "note-novel__codeblock" } },
    code: { HTMLAttributes: { class: "note-novel__code", spellcheck: "false" } },
    heading: { levels: [1, 2, 3] },
    horizontalRule: false,
  }),
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === "heading") return "标题";
      return "写点什么… 输入 / 插入块，选中文字可 Ask AI";
    },
  }),
  TiptapLink.configure({
    openOnClick: false,
    HTMLAttributes: { class: "note-novel__link" },
  }),
  TiptapUnderline,
  TaskList.configure({ HTMLAttributes: { class: "note-novel__tasks" } }),
  TaskItem.configure({
    nested: true,
    HTMLAttributes: { class: "note-novel__task" },
  }),
  HorizontalRule.configure({
    HTMLAttributes: { class: "note-novel__hr" },
  }),
  HighlightExtension.configure({ multicolor: false }),
  AIHighlight,
  CharacterCount,
  slashCommand,
];

const coordsForAi = (editor: EditorInstance, scope: NoteAiScope) => {
  if (scope === "document") {
    const rect = editor.view.dom.getBoundingClientRect();
    return {
      top: Math.min(rect.top + 48, window.innerHeight - 320),
      left: Math.min(Math.max(16, rect.left + 24), window.innerWidth - 380),
    };
  }
  const { from, to } = editor.state.selection;
  const start = editor.view.coordsAtPos(from);
  const end = editor.view.coordsAtPos(to);
  return {
    top: Math.min(end.bottom + 10, window.innerHeight - 320),
    left: Math.min(Math.max(16, start.left), window.innerWidth - 380),
  };
};

const makeApi = (
  editor: EditorInstance,
  openAi: (scope?: NoteAiScope) => void,
): NoteNovelApi => ({
  getMarkdown: () => htmlToMarkdown(editor.getHTML()),
  getSelectedText: () => {
    const { from, to, empty } = editor.state.selection;
    if (empty) return "";
    return editor.state.doc.textBetween(from, to, "\n");
  },
  applyMarkdown: (markdown, mode = "selection") => {
    const html = markdownToHtml(markdown);
    const { empty } = editor.state.selection;
    if (mode === "document") {
      editor.chain().focus().setContent(html, false).run();
    } else if (mode === "insert" || empty) {
      editor.chain().focus().insertContent(html).run();
    } else {
      editor.chain().focus().deleteSelection().insertContent(html).run();
    }
  },
  openAi,
  focus: () => {
    editor.commands.focus();
  },
});

const EditorChrome = ({
  onReady,
  onChange,
  aiOpen,
  setAiOpen,
  aiScope,
  setAiScope,
  aiSource,
  setAiSource,
  aiAnchor,
  setAiAnchor,
}: {
  onReady?: (api: NoteNovelApi) => void;
  onChange: (markdown: string) => void;
  aiOpen: boolean;
  setAiOpen: (v: boolean) => void;
  aiScope: NoteAiScope;
  setAiScope: (s: NoteAiScope) => void;
  aiSource: string;
  setAiSource: (s: string) => void;
  aiAnchor: { top: number; left: number } | null;
  setAiAnchor: (a: { top: number; left: number } | null) => void;
}) => {
  const { editor } = useEditor();
  const timer = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);
  onChangeRef.current = onChange;
  onReadyRef.current = onReady;

  const openAi = useCallback(
    (scope?: NoteAiScope) => {
      if (!editor) return;
      const selected = editor.state.selection.empty
        ? ""
        : editor.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to,
            "\n",
          );
      let nextScope: NoteAiScope = scope ?? (selected ? "selection" : "insert");
      if (scope === "document") nextScope = "document";
      if (nextScope === "selection" && selected) {
        addAIHighlight(editor);
      }
      setAiScope(nextScope);
      setAiSource(
        nextScope === "document"
          ? htmlToMarkdown(editor.getHTML())
          : selected,
      );
      setAiAnchor(coordsForAi(editor, nextScope));
      setAiOpen(true);
    },
    [editor, setAiAnchor, setAiOpen, setAiScope, setAiSource],
  );

  const closeAi = useCallback(() => {
    if (editor) removeAIHighlight(editor);
    setAiOpen(false);
    setAiAnchor(null);
  }, [editor, setAiAnchor, setAiOpen]);

  const acceptAi = useCallback(
    (markdown: string, scope: NoteAiScope) => {
      if (!editor) return;
      removeAIHighlight(editor);
      const html = markdownToHtml(markdown);
      if (scope === "document") {
        editor.chain().focus().setContent(html, false).run();
      } else if (scope === "selection") {
        editor.chain().focus().deleteSelection().insertContent(html).run();
      } else {
        editor.chain().focus().insertContent(html).run();
      }
      onChangeRef.current(htmlToMarkdown(editor.getHTML()));
      setAiOpen(false);
      setAiAnchor(null);
    },
    [editor, setAiAnchor, setAiOpen],
  );

  useEffect(() => {
    slashAiOpenRef.current = () => openAi("insert");
    return () => {
      slashAiOpenRef.current = null;
    };
  }, [openAi]);

  useEffect(() => {
    if (!editor) return;
    onReadyRef.current?.(makeApi(editor, openAi));
  }, [editor, openAi]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        onChangeRef.current(htmlToMarkdown(editor.getHTML()));
      }, 280);
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [editor]);

  return (
    <>
      <EditorBubble
        tippyOptions={{ placement: "top" }}
        shouldShow={({ state }) => {
          if (aiOpen) return false;
          const { from, to } = state.selection;
          return from !== to;
        }}
        className="note-novel__bubble"
      >
        <EditorBubbleItem
          onSelect={() => openAi("selection")}
          className="note-novel__bubble-ai"
        >
          <Sparkles size={14} />
          Ask AI
        </EditorBubbleItem>
        <span className="note-novel__bubble-sep" />
        <EditorBubbleItem
          onSelect={(ed) => ed.chain().focus().toggleBold().run()}
          className="note-novel__bubble-btn"
        >
          <Bold size={14} />
        </EditorBubbleItem>
        <EditorBubbleItem
          onSelect={(ed) => ed.chain().focus().toggleItalic().run()}
          className="note-novel__bubble-btn"
        >
          <Italic size={14} />
        </EditorBubbleItem>
        <EditorBubbleItem
          onSelect={(ed) => ed.chain().focus().toggleCode().run()}
          className="note-novel__bubble-btn"
        >
          <Code2 size={14} />
        </EditorBubbleItem>
      </EditorBubble>

      <NoteAiPanel
        open={aiOpen}
        scope={aiScope}
        sourceText={aiSource}
        anchor={aiAnchor}
        onClose={closeAi}
        onAccept={acceptAi}
      />
    </>
  );
};

export const NoteNovelEditor = ({ noteId, content, onChange, onReady }: Props) => {
  const initialHtml = useMemo(() => markdownToHtml(content), [noteId]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiScope, setAiScope] = useState<NoteAiScope>("insert");
  const [aiSource, setAiSource] = useState("");
  const [aiAnchor, setAiAnchor] = useState<{ top: number; left: number } | null>(
    null,
  );

  useEffect(() => {
    setAiOpen(false);
    setAiAnchor(null);
  }, [noteId]);

  return (
    <div className="note-novel" key={noteId}>
      <EditorRoot>
        <EditorContent
          immediatelyRender={false}
          extensions={extensions}
          initialContent={undefined}
          className="note-novel__content"
          editorProps={{
            handleDOMEvents: {
              keydown: (_view, event) => handleCommandNavigation(event),
            },
            attributes: {
              class: "note-novel__prose",
            },
          }}
          onCreate={({ editor }) => {
            editor.commands.setContent(initialHtml, false);
          }}
        >
          <EditorCommand className="note-novel__command">
            <EditorCommandEmpty className="note-novel__command-empty">
              无匹配命令
            </EditorCommandEmpty>
            <EditorCommandList>
              {suggestionItems.map((item) => (
                <EditorCommandItem
                  value={item.title}
                  keywords={item.searchTerms}
                  key={item.title}
                  onCommand={(val) => item.command?.(val)}
                  className="note-novel__command-item"
                >
                  <span className="note-novel__command-icon">{item.icon}</span>
                  <span className="note-novel__command-meta">
                    <span className="note-novel__command-title">{item.title}</span>
                    <span className="note-novel__command-desc">{item.description}</span>
                  </span>
                </EditorCommandItem>
              ))}
            </EditorCommandList>
          </EditorCommand>
          <EditorChrome
            onReady={onReady}
            onChange={onChange}
            aiOpen={aiOpen}
            setAiOpen={setAiOpen}
            aiScope={aiScope}
            setAiScope={setAiScope}
            aiSource={aiSource}
            setAiSource={setAiSource}
            aiAnchor={aiAnchor}
            setAiAnchor={setAiAnchor}
          />
        </EditorContent>
      </EditorRoot>
    </div>
  );
};
