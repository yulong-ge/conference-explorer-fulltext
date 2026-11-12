# conference-explorer-fulltext

[gisbi-kim conference-explorers](https://gisbi-kim.github.io/conference-explorers/neurips2026/)（neurips2026、icra2026 等）的浏览器用户脚本：在论文详情弹窗注入全文直链。

## 为什么需要

explorer 站点数据管线只收集两类链接：neurips.cc 官方海报页（仅摘要/日程）和 OpenReview 讨论页；全站所有论文的 `arxiv`/`pdf` 字段为空，没有任何全文入口。本脚本打开论文详情时按标题精确匹配 arXiv，注入以下链接：

- **OpenReview PDF** — `openreview.net/pdf?id=<forum>`，camera-ready 挂出后即全文
- **arXiv** / **arXiv PDF** — 按标题精确匹配预印本（规范化比较，不猜 ID）
- **alphaXiv** — 同一 arXiv ID 的 alphaXiv 阅读器页面
- 匹配不到时降级为灰色 **arXiv search** 链接，不伪造精确匹配

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)（Chrome/Brave/Edge 均可）。
2. 打开 [conference-explorer-fulltext.user.js](https://raw.githubusercontent.com/yulong-ge/conference-explorer-fulltext/main/userscript/conference-explorer-fulltext.user.js)，Tampermonkey 会弹出安装页。
3. 刷新任意 conference-explorer 页面，打开一篇论文详情验证。

## 更新

脚本头部带 `@updateURL`/`@downloadURL`，Tampermonkey 会自动检查并更新；也可在 Tampermonkey 仪表盘手动「检查更新」立即拉取。arXiv 匹配结果按标题缓存在站点 localStorage，首次打开约 3 秒后出链接（受 arXiv API 限速约束），重复打开零请求。

## 适用范围

`https://gisbi-kim.github.io/conference-explorers/*` 全部会议页面通用（同构 DOM）。arXiv 预印本覆盖率取决于论文是否放出预印本；无预印本的论文只提供搜索兜底。
