'use strict';

/* TrustScan — background service worker (MV3).
 * Registers context-menu entries and opens the dashboard tab. */

const DASHBOARD = 'dashboard/index.html';

function openDashboard(targetUrl) {
  const base = chrome.runtime.getURL(DASHBOARD);
  const url = targetUrl
    ? base + '?url=' + encodeURIComponent(targetUrl)
    : base;
  chrome.tabs.query({ url: base + '*' }, (tabs) => {
    const existing = tabs && tabs[0];
    if (existing) {
      chrome.tabs.update(existing.id, { url: url, active: true });
      if (existing.windowId) chrome.windows.update(existing.windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: url });
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'ts-page',
      title: 'Analyze this page with TrustScan',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'ts-link',
      title: 'Analyze link with TrustScan',
      contexts: ['link']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const target = info.linkUrl || info.pageUrl || (tab && tab.url);
  if (!target || !/^https?:/i.test(target)) return;
  openDashboard(target);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'open-dashboard' && msg.url) openDashboard(msg.url);
});
