# 渠道脚本规范

渠道脚本（插件脚本）在**当前浏览器标签页**执行，供会话 `@脚本` / `@任务` 调用。平台只约定薄契约；DOM 选择器与业务逻辑自定。

## 运行方式

- 入口文件（默认 `main.js`）是 **异步函数体**，可使用 `await`
- 不要写 `import` / `export`、不要写完整 HTML 页面
- 浏览器扩展执行动态脚本（MV3 禁止扩展内 `eval`）：**优先 Chrome User Scripts**（脚本由桌面运行时下发，无需每次打包扩展）
- **推荐**：扩展侧栏设置 → **打开扩展详情** → 开启 **允许运行用户脚本** → **我已开启，重载扩展**
- **回退（默认开）**：User Scripts 未就绪时自动用 `chrome.debugger` 跑通；防风控请尽快开启用户脚本（开启后不再走 debugger）。侧栏可关掉该回退
- 有会话传入文案时，扩展会在脚本前注入：

```js
const __CHATCMS_INPUT__ = "...";
```

填页类脚本读取 `__CHATCMS_INPUT__`；纯采集可忽略。

## 返回值

| 场景 | 返回 | 会话行为 |
|------|------|----------|
| 成功且有正文 | `string` 或 `{ title?, text, url? }` | **直出**正文 |
| 成功无正文（填表等） | 不 `return` / `''` / `{ ok: true }` | **直出**「已执行完成」 |
| 失败 | `{ ok: false, error: '...' }` 或 `throw` | 交给会话 AI **说明原因与重试** |

`text` / `content` / `body` 字段均可作为正文（扩展侧归一化）。

## 调用 AI

**不要**在页面脚本里 `fetch('http://127.0.0.1:...')`：公网站点（如 zhipin.com）会被 Chrome **私网访问**拦截，导致脚本挂起直至超时。

正确做法：返回 `ai_complete`，由扩展后台代调本机桥：

```js
return {
  title: '…',
  text: '可选预览',
  url: location.href,
  ai_complete: {
    content: '给模型的用户消息',
    system_prompt: '可选系统提示',
  },
};
```

扩展会 `POST http://127.0.0.1:17890/chat/complete`，再把模型结果当作脚本正文回传。

注意：`ai_complete.content` 与 `text` **不要重复塞同一大段正文**，否则 `executeScript` 返回值可能被 Chrome 结构化克隆丢弃，表现为「执行成功但无正文」。

## 与会话编排的关系

1. 只 `@` 或带执行意图 → 直接跑脚本  
2. 成功有正文 → 短路直出  
3. 成功无正文 → 短路「已完成」  
4. 失败 → 会话模型根据错误文案解释  

## 编辑器

「插件脚本」编辑页左侧有契约摘要，编辑栏可插入**采集 / 填页 / 采页+AI**模板；保存时做语法与契约软校验。

## 示例仓库种子

- `scripts/media/boss-greet-collect.js` — 采集  
- `scripts/media/boss-greet-fill.js` — 填页  
- `scripts/media/boss-job-jd-parse.js` — 采页 + `fetch` AI  
