'use strict';

/* TrustScan popup logic. */

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const store = {
  async get(key, fallback) {
    const area = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)
      ? chrome.storage.local : null;
    if (area) return new Promise((res) => area.get([key], (o) => res(o && o[key] !== undefined ? o[key] : fallback)));
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
};

function scoreClass(score) {
  if (score >= 80) return 'score-low';
  if (score >= 50) return 'score-med';
  return 'score-high';
}

function openDashboard(url) {
  const base = chrome.runtime.getURL('dashboard/index.html');
  const target = url ? base + '?url=' + encodeURIComponent(url) : base;
  chrome.tabs.create({ url: target });
  window.close();
}

function openReport(id) {
  const base = chrome.runtime.getURL('dashboard/index.html');
  chrome.tabs.create({ url: base + '?view=reports&id=' + encodeURIComponent(id) });
  window.close();
}

async function initCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab && tab.url ? tab.url : '';
    if (/^https?:\/\//i.test(url)) {
      const host = new URL(url).hostname;
      $('#current-host').textContent = host;
      const btn = $('#analyze-tab');
      btn.disabled = false;
      btn.addEventListener('click', () => openDashboard(url));
    } else {
      $('#current-host').textContent = tab && tab.url ? tab.url.replace(/^([a-z-]+:).*/i, '$1 …') : '—';
      $('#current-note').hidden = false;
    }
  } catch (e) {
    $('#current-host').textContent = '—';
  }
}

async function initRecents() {
  const records = await store.get('trustscan_history', []);
  const list = $('#recents-list');
  if (!records.length) {
    list.innerHTML = '<div class="recent-empty">No scans yet — analyze a site to get started.</div>';
    return;
  }
  list.innerHTML = records.slice(0, 3).map((r) => `
    <div class="recent" data-id="${esc(r.id)}" title="${esc(r.url)}">
      <span class="avatar">${esc((r.host || '?').slice(0, 1))}</span>
      <span class="recent-host">${esc(r.host)}</span>
      <span class="score-chip ${scoreClass(r.score)}">${r.score}/100</span>
    </div>`).join('');
  list.querySelectorAll('.recent').forEach((el) => {
    el.addEventListener('click', () => openReport(el.dataset.id));
  });
}

$('#quick-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = $('#quick-url').value.trim();
  if (!raw) return;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
  openDashboard(withScheme);
});
$('#open-dashboard').addEventListener('click', () => openDashboard());
$('#open-history').addEventListener('click', () => openDashboard());

initCurrentTab();
initRecents();
