'use strict';

/* Storage layer — chrome.storage.local with a localStorage fallback so the
 * dashboard also runs as a plain web page during development. */

const Store = (() => {
  const area = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)
    ? chrome.storage.local
    : null;

  async function get(key, fallback) {
    if (area) {
      return new Promise((resolve) => {
        area.get([key], (obj) => {
          resolve(obj && obj[key] !== undefined ? obj[key] : fallback);
        });
      });
    }
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  }

  async function set(key, value) {
    if (area) {
      return new Promise((resolve) => area.set({ [key]: value }, resolve));
    }
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
    return value;
  }

  return { get, set };
})();
