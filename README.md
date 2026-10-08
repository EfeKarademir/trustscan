# TrustScan — Website Trust Analyzer

A Chromium-browser extension that analyzes any website's security posture before you trust it.
Works in **Chrome, Opera / Opera GX, Edge, Brave, Vivaldi** and other Chromium browsers (Manifest V3).

<p align="center"><img src="assets/icons/icon128.png" width="88" alt="TrustScan"></p>

## What it does

Enter a URL (or use the toolbar popup / right-click menu) and TrustScan inspects publicly
visible technical indicators and presents them in a security dashboard:

| Category | What is checked | How |
|---|---|---|
| **SSL / TLS** | HTTPS availability, certificate validity, issuer, expiry | Direct connection + certificate transparency (crt.sh) |
| **Security headers** | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy | Live response headers |
| **DNS** | A, AAAA, MX, NS records + DNSSEC | DNS-over-HTTPS (Cloudflare or Google) |
| **Domain** | Registrar, registration date, age, expiry | RDAP (with IANA bootstrap fallback) |
| **Redirects** | Full redirect chain, HTTP→HTTPS upgrade | Manual redirect following |
| **Reputation** | Malicious / phishing / malware reports | Optional Google Safe Browsing API key; otherwise estimated from technical signals |

Results are scored 0–100 and labeled **Low / Medium / High Risk**. The dashboard includes a
scan history (search / filter / sort), a professional report view with **Export PDF**, and a
technical-details section for security students (monospace headers, TLS info, DNS records, IP, ASN).

> **Important:** TrustScan is an analysis tool, not a guarantee of website safety. It reports
> *indicators* — it never claims a website "is safe".

## Install (unpacked)

1. Open your browser's extensions page:
   - Chrome / Brave / Vivaldi: `chrome://extensions`
   - Opera / Opera GX: `opera://extensions`
   - Edge: `edge://extensions`
2. Enable **Developer mode** (toggle, usually top-right).
3. Click **Load unpacked** and select this `trustscan/` folder.
4. Pin the TrustScan icon to your toolbar.

### Use it

- **Toolbar popup** → "Analyze this page" for the current tab, or type a URL.
- **Right-click** any link or page → *"Analyze with TrustScan"*.
- The **dashboard** opens in a new tab with Overview, Scan Website, Scan History, Reports and Settings.

## Settings

- **Live network checks** — off = fully simulated results (useful for demos/training).
- **DNS-over-HTTPS provider** — Cloudflare or Google.
- **Certificate transparency lookup / RDAP lookups** — toggle enrichment sources.
- **Google Safe Browsing API key** *(optional)* — enables live phishing/malware checks
  against Google's threat feed. Without a key, reputation is estimated from
  domain age, DNSSEC, TLS posture and headers (labeled as such, capped, never claimed as certainty).
- **History retention** — keep all / 90 days / 30 days / last 10 scans.

## Privacy

All analysis runs locally in your browser. Scan history and settings are stored in
`chrome.storage.local` on your device only. Nothing is uploaded anywhere.

### About the permissions

- `storage` — saving your scan history and settings locally.
- `tabs` / `activeTab` — reading the current tab's URL when you request an analysis.
- `contextMenus` — the right-click "Analyze with TrustScan" entries.
- `<all_urls>` (host permissions) — fetching the analyzed site's headers, DNS, RDAP and
  certificate data directly from the extension, bypassing CORS.

## How scoring works

Each category is scored 0–100 and the overall score is a weighted sum:
TLS 25% · Headers 20% · DNS 10% · Domain 15% · Redirects 10% · Reputation 20%.
Risk bands: **≥ 80 Low · 50–79 Medium · < 50 High**.

Subdomains are handled correctly: registration, NS/MX, certificate and reputation lookups
run against the *registered domain* (`www.youtube.com` → `youtube.com`), while connection
and redirect analysis runs against the host you entered.

Certificate-transparency data is only trusted when the entry is **currently valid** —
expired historical log entries are ignored.

## Development

```
trustscan/
├── manifest.json            # MV3 manifest
├── background/service-worker.js
├── popup/                   # toolbar popup
├── dashboard/               # the full app (SPA)
│   ├── index.html · styles.css · app.js
│   ├── engine.js            # analysis engine (DOM-free, testable)
│   └── storage.js           # chrome.storage w/ localStorage fallback
├── assets/                  # bundled fonts + generated icons
└── test/engine.test.js      # engine unit tests (Node)
```

Run the engine tests:

```bash
node test/engine.test.js
```

The dashboard can also be opened as a plain web page during development (it falls back to
`localStorage`); note that live cross-origin checks require the extension context.

## Limitations

- Browsers don't expose TLS version or full certificate details to JavaScript; the
  browser-validated chain is reported, and issuer/expiry come from certificate-transparency
  logs when available.
- Reputation requires a Safe Browsing API key for live threat-feed data.
- Some country-code TLDs don't expose RDAP data.

## Disclaimer

TrustScan is an analysis tool, **not a guarantee of website safety**. See
[**DISCLAIMER.md**](DISCLAIMER.md) for the full legal disclaimer, limitation of liability,
and terms of use.
