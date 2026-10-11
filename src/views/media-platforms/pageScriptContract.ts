/**
 * 渠道脚本（页面脚本）薄契约：编辑器模板 / 保存前校验 / 与文档对齐。
 *
 * 运行时：优先 Chrome userScripts；未开启时可由扩展 debugger 回退。
 * 有会话文案时前置 `const __CHATCMS_INPUT__ = "..."`。
 * 防风控请开启扩展详情中的「允许运行用户脚本」并重载。
 */

export type ScriptLintIssue = {
  level: "error" | "warn";
  message: string;
};

export type ScriptTemplateKind = "collect" | "fill" | "ai";

export const SCRIPT_CONTRACT_SUMMARY = [
  "入口是函数体（可 await），不要写 import / export",
  "运行：扩展 User Scripts（需开启「允许运行用户脚本」并重载）",
  "会话文案：__CHATCMS_INPUT__（可能不存在）",
  "成功有正文：string 或 { title?, text, url? }",
  "成功无正文：不 return / '' / { ok: true }",
  "失败：{ ok: false, error } 或 throw",
  "要调 AI：返回 ai_complete（扩展后台代调）；勿在页内 fetch(127.0.0.1)",
] as const;

export const SCRIPT_EDITOR_PLACEHOLDER =
  "// 函数体。return string | { title, text, url } | { ok:false, error }\n" +
  "// 入参：__CHATCMS_INPUT__ · AI：return { ai_complete: { content, system_prompt } }";

const TEMPLATE_COLLECT = `\
// 采集脚本（函数体，可 await）
// 成功有正文 → 会话直出；成功无正文 → 提示已完成；失败 → 会话 AI 说明原因

var text = String(
  (document.body && (document.body.innerText || document.body.textContent)) || '',
)
  .replace(/\\u00a0/g, ' ')
  .replace(/\\n{3,}/g, '\\n\\n')
  .trim();

if (!text) {
  return { ok: false, error: '页面正文为空，请确认已打开目标页' };
}

return {
  title: document.title || '',
  text: text.slice(0, 20000),
  url: location.href,
};
`;

const TEMPLATE_FILL = `\
// 填页脚本（函数体，可 await）
// 会话传入文案在 __CHATCMS_INPUT__；副作用成功可无正文

var content =
  typeof __CHATCMS_INPUT__ !== 'undefined' && __CHATCMS_INPUT__
    ? String(__CHATCMS_INPUT__).trim()
    : '';

if (!content) {
  return {
    ok: false,
    error: '缺少要填入的文案（请在 @ 脚本时附带正文，或先让助手生成）',
  };
}

// TODO: 定位输入框并写入 content
// var el = document.querySelector('textarea');
// if (!el) return { ok: false, error: '未找到输入框' };
// el.value = content;
// el.dispatchEvent(new Event('input', { bubbles: true }));

return { ok: true };
`;

const TEMPLATE_AI = `\
// 采页 + AI（函数体）
// 禁止页内 fetch(127.0.0.1)。正文只放在 ai_complete 一份，避免返回值过大被 Chrome 丢弃。

var pageText = String(
  (document.body && (document.body.innerText || document.body.textContent)) || '',
)
  .trim()
  .slice(0, 12000);

if (!pageText || pageText.length < 20) {
  return { ok: false, error: '页面正文为空或过短' };
}

var userContent = [
  '【URL】' + location.href,
  '【页面】' + (document.title || ''),
  '【页面正文】\\n' + pageText,
  '【AI任务】\\n请整理以上内容，用中文简洁输出。找不到的信息写「未找到」。',
].join('\\n\\n');

return {
  title: (document.title ? document.title + ' · ' : '') + 'AI整理',
  url: location.href,
  ai_complete: {
    content: userContent,
    system_prompt: '你是页面信息整理助手。只依据用户提供的正文，不要编造。',
  },
};
`;

export const SCRIPT_TEMPLATES: Record<
  ScriptTemplateKind,
  { label: string; source: string }
> = {
  collect: { label: "采集模板", source: TEMPLATE_COLLECT },
  fill: { label: "填页模板", source: TEMPLATE_FILL },
  ai: { label: "采页+AI 模板", source: TEMPLATE_AI },
};

export const lintPageScript = (source: string): ScriptLintIssue[] => {
  const issues: ScriptLintIssue[] = [];
  const t = source.trim();
  if (!t) {
    issues.push({ level: "error", message: "脚本为空" });
    return issues;
  }

  if (/^\s*import\s/m.test(t) || /^\s*export\s/m.test(t)) {
    issues.push({
      level: "error",
      message: "入口须为函数体，不要写 import / export",
    });
  }

  if (t.includes("【需要AI解析】") || t.includes("__CHATCMS_NEEDS_LLM__")) {
    issues.push({
      level: "warn",
      message: "请改用 return { ai_complete: { content, system_prompt } }",
    });
  }

  if (
    /fetch\s*\(\s*['`]https?:\/\/127\.0\.0\.1/i.test(t) ||
    /fetch\s*\(\s*['`]https?:\/\/localhost/i.test(t)
  ) {
    issues.push({
      level: "warn",
      message:
        "页内 fetch 本机易被 Chrome 私网拦截；请改用 ai_complete 由扩展代调",
    });
  }

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {})
      .constructor as new (...args: string[]) => (...a: unknown[]) => Promise<unknown>;
    // eslint-disable-next-line no-new
    new AsyncFunction(t);
  } catch (e) {
    issues.push({
      level: "error",
      message: `语法错误：${e instanceof Error ? e.message : String(e)}`,
    });
  }

  return issues;
};
