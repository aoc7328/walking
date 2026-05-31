// ==UserScript==
// @name         圖片批次抓取器
// @namespace    vincent.image-grabber
// @version      0.1
// @description  在索引頁一鍵抓取所有詳情頁的原圖
// @match        https://example.com/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  // ===== 你只要改這三個 =====
  const CONFIG = {
    // 索引頁裡每個縮圖外層的 <a> 連結
    thumbLinkSelector: '.gallery a.thumb',

    // 詳情頁裡那張原圖（先試 img，找不到再試 a）
    fullImageSelector: '#main-image, .full-image img, a.download-original',

    // 想從 <img> 抓 src 還是從 <a> 抓 href？預設自動判斷
    // 'auto' = 元素是 img 就抓 src，是 a 就抓 href
    attribute: 'auto',
  };
  // =========================

  // 浮動按鈕
  const btn = document.createElement('button');
  btn.textContent = '抓全部';
  Object.assign(btn.style, {
    position: 'fixed', top: '20px', right: '20px', zIndex: 99999,
    padding: '12px 20px', fontSize: '16px', background: '#2563eb',
    color: 'white', border: 'none', borderRadius: '8px',
    cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  });
  document.body.appendChild(btn);

  const status = document.createElement('div');
  Object.assign(status.style, {
    position: 'fixed', top: '70px', right: '20px', zIndex: 99999,
    padding: '10px 14px', fontSize: '13px', background: 'rgba(0,0,0,0.8)',
    color: 'white', borderRadius: '6px', maxWidth: '280px',
    whiteSpace: 'pre-wrap', display: 'none',
  });
  document.body.appendChild(status);

  const log = (msg) => {
    status.style.display = 'block';
    status.textContent = msg;
    console.log('[grabber]', msg);
  };

  // 用 fetch 拉詳情頁 HTML，parse 出原圖 URL
  const fetchDetailPage = (url) => new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      onload: (res) => {
        try {
          const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
          const el = doc.querySelector(CONFIG.fullImageSelector);
          if (!el) return reject(new Error('找不到原圖元素: ' + url));

          let imgUrl;
          if (CONFIG.attribute === 'auto') {
            imgUrl = el.tagName === 'IMG' ? el.src : el.href;
          } else {
            imgUrl = el.getAttribute(CONFIG.attribute);
          }
          if (!imgUrl) return reject(new Error('元素沒有 URL: ' + url));
          // 轉絕對 URL
          resolve(new URL(imgUrl, url).href);
        } catch (e) { reject(e); }
      },
      onerror: reject,
    });
  });

  // 用 GM_download 下載（會走瀏覽器下載資料夾）
  const download = (url, name) => new Promise((resolve, reject) => {
    GM_download({
      url, name,
      onload: () => resolve(),
      onerror: (e) => reject(e),
      ontimeout: () => reject(new Error('timeout')),
    });
  });

  // 從 URL 推檔名
  const filenameFromUrl = (url, idx) => {
    try {
      const u = new URL(url);
      const last = u.pathname.split('/').filter(Boolean).pop() || `image-${idx}`;
      // 如果沒有副檔名就補 .jpg
      return /\.\w{2,5}$/.test(last) ? last : `${last}.jpg`;
    } catch {
      return `image-${idx}.jpg`;
    }
  };

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = '抓取中...';

    const links = [...document.querySelectorAll(CONFIG.thumbLinkSelector)]
      .map(a => a.href)
      .filter(Boolean);

    if (!links.length) {
      log('找不到任何縮圖連結，檢查 thumbLinkSelector 是否正確');
      btn.disabled = false;
      btn.textContent = '抓全部';
      return;
    }

    log(`找到 ${links.length} 個項目，開始抓取...`);

    let ok = 0, fail = 0;
    for (let i = 0; i < links.length; i++) {
      const detailUrl = links[i];
      try {
        const imgUrl = await fetchDetailPage(detailUrl);
        await download(imgUrl, filenameFromUrl(imgUrl, i + 1));
        ok++;
      } catch (e) {
        console.error('[grabber] 失敗', detailUrl, e);
        fail++;
      }
      log(`進度 ${i + 1}/${links.length}（成功 ${ok}，失敗 ${fail}）`);
      // 禮貌間隔，避免被當成攻擊
      await new Promise(r => setTimeout(r, 600));
    }

    log(`完成！成功 ${ok}，失敗 ${fail}`);
    btn.disabled = false;
    btn.textContent = '抓全部';
  });
})();
