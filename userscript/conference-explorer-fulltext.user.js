// ==UserScript==
// @name         gisbi-kim conference-explorer 全文直链
// @namespace    local.gisbi-kim-explorer-fulltext
// @version      1.1.1
// @description  在论文详情弹窗注入 OpenReview PDF / arXiv / arXiv PDF / alphaXiv 直链；arXiv 按标题精确匹配，匹配不到时给搜索链接
// @match        https://gisbi-kim.github.io/conference-explorers/*
// @grant        GM_xmlhttpRequest
// @connect      export.arxiv.org
// @run-at       document-idle
// @homepageURL  https://github.com/yulong-ge/conference-explorer-fulltext
// @updateURL    https://raw.githubusercontent.com/yulong-ge/conference-explorer-fulltext/main/userscript/conference-explorer-fulltext.user.js
// @downloadURL  https://raw.githubusercontent.com/yulong-ge/conference-explorer-fulltext/main/userscript/conference-explorer-fulltext.user.js
// ==/UserScript==

(function () {
  'use strict';

  // arXiv API 礼貌间隔（官方建议 ≥3s）
  const MIN_INTERVAL_MS = 3200;
  let lastRequestAt = 0;
  const inflight = new Map();

  // localStorage 缓存：normTitle -> { id } | null（null = 已查过且无精确匹配）
  // 键带版本：v1 缓存存的是 {abs, pdf} 缺 id，换键作废
  const CACHE_KEY = 'ft-arxiv-cache-v2';
  const loadCache = () => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch { return {}; }
  };
  const store = loadCache();
  const saveCache = () => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(store)); } catch { /* 隐私模式等场景缓存不可用，跳过 */ }
  };

  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function fetchArxiv(title) {
    const key = norm(title);
    const cached = store[key];
    if (cached === null) return Promise.resolve(null);
    if (cached && typeof cached.id === 'string') return Promise.resolve(cached);
    // 形状不符的旧缓存视为未命中，重新查询
    if (inflight.has(key)) return inflight.get(key);

    const task = (async () => {
      const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await sleep(wait);
      lastRequestAt = Date.now();

      const url = 'https://export.arxiv.org/api/query?max_results=10&search_query=' +
        encodeURIComponent('ti:"' + title.replace(/"/g, ' ') + '"');
      const res = await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET', url, timeout: 20000,
          onload: resolve,
          onerror: () => reject(new Error('网络错误')),
          ontimeout: () => reject(new Error('超时')),
        });
      });
      if (res.status !== 200) throw new Error('arXiv HTTP ' + res.status);

      const doc = new DOMParser().parseFromString(res.responseText, 'application/xml');
      const want = norm(title);
      let hit = null;
      for (const e of doc.querySelectorAll('entry')) {
        const t = (e.querySelector('title')?.textContent || '').replace(/\s+/g, ' ').trim();
        if (norm(t) !== want) continue;
        const m = (e.querySelector('id')?.textContent || '').match(/arxiv\.org\/abs\/([^v?#]+)/);
        if (m) { hit = { id: m[1] }; break; }
      }
      store[key] = hit;
      saveCache();
      return hit;
    })().finally(() => inflight.delete(key));

    inflight.set(key, task);
    return task;
  }

  // 弹窗内可能有 i18n 注入的中文标题 h2；优先取纯 ASCII 的英文标题
  function pickTitle(detail) {
    const texts = [...detail.querySelectorAll('h2')].map((h) => h.textContent.replace(/\s+/g, ' ').trim());
    return texts.find((t) => t.length > 10 && /^[\x00-\x7F]+$/.test(t)) || texts[0];
  }

  function inject(res, links) {
    res.querySelectorAll('[data-ft]').forEach((n) => n.remove());
    for (const [label, href, muted] of links) {
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = label + ' ↗';
      a.dataset.ft = '1';
      if (muted) a.style.color = 'var(--muted)';
      res.appendChild(a);
    }
  }

  const searchUrl = (title) =>
    'https://arxiv.org/search/?query=' + encodeURIComponent(title) + '&searchtype=all';

  async function enrich(detail) {
    const res = detail.querySelector('.resources');
    if (!res || res.dataset.ftBusy) return;
    const title = pickTitle(detail);
    if (!title) return;
    res.dataset.ftBusy = '1';

    const links = [];

    // OpenReview PDF 直链：camera-ready 一挂上即可打开全文
    const orForum = [...res.querySelectorAll('a')].find((a) => /openreview\.net\/forum\?/.test(a.href));
    const oid = orForum && new URL(orForum.href).searchParams.get('id');
    if (oid) links.push(['OpenReview PDF', 'https://openreview.net/pdf?id=' + oid]);

    try {
      const hit = await fetchArxiv(title);
      if (hit) {
        links.push(
          ['arXiv', 'https://arxiv.org/abs/' + hit.id],
          ['arXiv PDF', 'https://arxiv.org/pdf/' + hit.id],
          ['alphaXiv', 'https://www.alphaxiv.org/abs/' + hit.id],
        );
      } else {
        links.push(['arXiv search', searchUrl(title), true]);
      }
    } catch (e) {
      links.push(['arXiv 查询失败（' + e.message + '）', searchUrl(title), true]);
    }

    inject(res, links);
  }

  const observer = new MutationObserver(() => {
    const detail = document.getElementById('paper-detail');
    if (detail) enrich(detail);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
