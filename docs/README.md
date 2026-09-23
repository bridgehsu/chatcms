# 文档站（VitePress）

正文在 `guide/` · `concepts/` · `features/`；分层流程图源在 `drawio/`（可导出 SVG 放到 `public/`）。

## 推荐：在仓库根目录启动

```bash
cd /path/to/chatcms
pnpm docs:dev
```

浏览器打开 http://localhost:6173/

> 不要在 `docs/` 里执行 `pnpm run dev`——那会启动**桌面应用**的 Vite（15420），不是文档站。

## 也可以在 docs/ 下启动

```bash
cd docs
pnpm dev
```

（使用本目录 `package.json` 的脚本，等价于 `vitepress dev .`）

## 构建

根目录：

```bash
pnpm docs:build
pnpm docs:preview
```
