'use strict';

/* ============================================================================
   TrustScan dashboard application
   Views: Overview · Scan Website · Link Checker · Scan History · Reports · Settings
   ========================================================================== */

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

/* ---------------------------------------------------------------- icons */
const I = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5L2.8 19.5h18.4z"/><path d="M12 9.5v4.5"/><circle cx="12" cy="16.8" r="0.4" fill="currentColor"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r="0.4" fill="currentColor"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9.5l6 6 6-6"/></svg>',
  arrowR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15"/><path d="M14 6.5L20 12l-6 5.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20.5 20"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5.5M14 11v5.5"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4 18.5h16"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 3.5V7h-3.5"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.3 4 5.2 4 8.5s-1.4 6.2-4 8.5c-2.6-2.3-4-5.2-4-8.5s1.4-6.2 4-8.5z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15" r="0.4" fill="currentColor"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 2.8v5.4c0 4.4-3 8-7 9.3-4-1.3-7-4.9-7-9.3V5.8z"/><path d="M9 12l2.2 2.2L15.5 9"/></svg>',
  network: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M12 7.2v4.3M10.8 12.7L6.3 17.2M13.2 12.7l4.5 4.5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>',
  redirect: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5h12.5M13.5 5l3.5 3.5-3.5 3.5"/><path d="M20 15.5H7.5M10.5 12L7 15.5l3.5 3.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  radar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.2"/><path d="M12 12l5.5-5.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.6 1.6"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.6-1.6"/></svg>',
  unlink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.6 1.6"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.6-1.6"/><path d="M3 3l18 18"/></svg>'
};

const CATEGORY_ICONS = {
  tls: I.lock, headers: I.shield, dns: I.network,
  domain: I.calendar, redirects: I.redirect, reputation: I.eye
};

const CATEGORY_INFO = {
  tls: 'Checks whether the website uses encryption (HTTPS) to protect your data, and whether its digital certificate is valid and trusted.',
  headers: 'Checks for security settings that tell your browser how to behave — like blocking malicious scripts, preventing the page from being embedded in other sites, and controlling what information is shared.',
  dns: 'Looks up the domain\'s "address book" entries to verify the website is reachable and check for signs of tampering.',
  domain: 'Checks who registered the domain and when. Very new domains are more likely to be scams, while old, established domains are generally more trustworthy.',
  redirects: 'Follows the chain of redirects when you visit the site, checking that you end up on a secure (HTTPS) page and that the path is not suspiciously long.',
  reputation: 'Checks whether the website appears on lists of known malicious, phishing, or malware-distributing sites.'
};

const SEVERITY_META = {
  critical: { icon: I.x, label: 'Critical' },
  high: { icon: I.warn, label: 'High' },
  medium: { icon: I.warn, label: 'Medium' },
  low: { icon: I.info, label: 'Low' },
  info: { icon: I.info, label: 'Info' },
  pass: { icon: I.check, label: 'Pass' }
};

const RISK_META = {
  low: { label: 'LOW RISK', cls: 'risk-low', color: '#3ecf8e', text: 'No major security indicators were detected.' },
  medium: { label: 'MEDIUM RISK', cls: 'risk-med', color: '#ffb224', text: 'Some security indicators were detected — review the findings below.' },
  high: { label: 'HIGH RISK', cls: 'risk-high', color: '#f0655a', text: 'Multiple risk indicators were detected — proceed with caution.' }
};

/* ------------------------------------------------- plain-language glossary */
const TERM_GLOSSARY = {
  'Content-Security-Policy': 'A rule that tells your browser which websites are allowed to load scripts, images, and other content on this page. It helps stop attackers from injecting malicious code into the page you are viewing.',
  'CSP': 'Short for Content-Security-Policy — a rule that tells your browser which sources are allowed to load content on a page, helping prevent code injection attacks.',
  'Strict-Transport-Security': 'A setting that forces browsers to always use a secure (HTTPS) connection to this website, preventing attackers from intercepting your traffic over an insecure connection.',
  'HSTS': 'Short for Strict-Transport-Security — forces browsers to always use HTTPS for this site.',
  'X-Frame-Options': 'A setting that prevents other websites from embedding this page inside their own page (in a frame). This stops "clickjacking" attacks where hidden buttons trick you into clicking something you did not intend.',
  'X-Content-Type-Options': 'A setting that stops browsers from guessing what type of file they received. Without it, a browser might mistake a text file for executable code.',
  'Referrer-Policy': 'Controls how much of the page address (URL) is shared with other websites when you click a link. Helps protect your privacy.',
  'Permissions-Policy': 'Controls which browser features (like camera, microphone, or location) a website is allowed to use.',
  'DNSSEC': 'A security extension for DNS that adds digital signatures to domain records, making it harder for attackers to redirect you to a fake website.',
  'DNS': 'The "phone book" of the internet — it translates website names (like google.com) into the numerical addresses computers use to connect.',
  'TLS': 'The encryption technology that protects data sent between your browser and a website, keeping it private and tamper-proof.',
  'SSL': 'An older name for TLS — the encryption that keeps your connection to a website private.',
  'Certificate': 'A digital ID card that proves a website is who it claims to be. Issued by trusted organizations called Certificate Authorities.',
  'Certificate Authority': 'A trusted organization that issues digital certificates proving a website\'s identity.',
  'Clickjacking': 'An attack that tricks you into clicking hidden elements on a webpage by covering them with something else (like a fake button).',
  'MIME sniffing': 'When a browser guesses a file\'s type instead of trusting what the server says. This can be exploited to run malicious code.',
  'MX Record': 'A DNS record that tells the internet which servers handle email for this domain.',
  'NS Record': 'A DNS record that lists the servers responsible for answering questions about this domain.',
  'A Record': 'A DNS record that maps a domain name to an IPv4 address (like 93.184.216.34).',
  'AAAA Record': 'A DNS record that maps a domain name to an IPv6 address (the newer, longer format).',
  'ASN': 'A unique number that identifies the network or organization (like Google or Cloudflare) that owns a range of IP addresses.',
  'RDAP': 'A protocol for looking up who registered a domain, when it was registered, and when it expires.',
  'Phishing': 'Fake websites or messages designed to trick you into entering passwords, credit card numbers, or other personal information.',
  'Malware': 'Malicious software designed to damage your device, steal data, or spy on you.',
  'Threat intelligence': 'Data feeds that track known malicious websites, used to warn visitors about dangerous sites.',
  'frame-ancestors': 'A part of Content-Security-Policy that controls which websites can embed this page in a frame (similar to X-Frame-Options).',
  'Registrar': 'The company where a domain name was registered (like GoDaddy or Namecheap).',
  'Nameserver': 'A server that stores DNS records for a domain and answers questions about it.',
  'Redirect': 'When a website automatically sends you from one address to another (like from http:// to https://, or from an old domain to a new one).',
  'HTTP': 'The unencrypted protocol for transferring web pages. Data sent over HTTP can be read or modified by anyone in between.',
  'HTTPS': 'The encrypted, secure version of HTTP. The "S" stands for "Secure" — data is encrypted so others cannot read it.',
  'Subdomain': 'A subdivision of a domain, like "mail.google.com" is a subdomain of "google.com".',
  'Reputation': 'An assessment of whether a website is known to be safe or dangerous, based on threat data and technical signals.',
  'Safe Browsing': 'Google\'s service that maintains a list of known dangerous websites and warns users before they visit them.',
  'Self-signed certificate': 'A certificate created by the website itself rather than a trusted Certificate Authority. Browsers do not trust these by default.',
  'Certificate transparency': 'A public log of all issued certificates, allowing anyone to check what certificates exist for a domain.'
};

/* Render a technical term with an inline info tooltip for non-experts. */
function termHTML(term) {
  const info = TERM_GLOSSARY[term];
  if (!info) return esc(term);
  const id = 'tip-' + term.toLowerCase().replace(/[^a-z0-9]/g, '');
  return '<span class="term" tabindex="0" data-tip="' + id + '">' + esc(term) +
    '<span class="term-icon">' + I.info + '</span>' +
    '<span class="term-tip" id="' + id + '" role="tooltip">' + esc(info) + '</span></span>';
}

/* ---------------------------------------------------------------- helpers */
function scoreColor(score) {
  if (score >= 80) return '#3ecf8e';
  if (score >= 50) return '#ffb224';
  return '#f0655a';
}
function scoreClass(score) {
  if (score >= 80) return 'score-low';
  if (score >= 50) return 'score-med';
  return 'score-high';
}
function riskLabel(risk) { return (RISK_META[risk] || RISK_META.medium).label; }

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 45 * 1000) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 7) return d + 'd ago';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtFullDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}
const isReducedMotion = () =>
  App.settings.reduceMotion === true ||
  (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ------------------------------------------------------------------ state */
const App = {
  view: 'overview',
  viewParam: null,
  records: [],
  settings: {
    liveChecks: true,
    dohProvider: 'cloudflare',
    ctLookup: true,
    rdapLookup: true,
    safeBrowsingKey: '',
    retention: 'all',
    reduceMotion: false
  },
  current: null,
  scanning: false,
  linkChecking: false,
  linkResult: null,
  historyUI: { q: '', risk: 'all', sort: 'new' }
};

const DEFAULT_SETTINGS = { ...App.settings };

/* ------------------------------------------------------------ demo records */
function demoRecord(host, score, risk, hoursAgo, categories, findings, tech, url) {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0, pass: 0 };
  findings.forEach((f) => { if (summary[f.severity] !== undefined) summary[f.severity]++; });
  return {
    id: 'demo-' + host,
    url: url || 'https://' + host + '/',
    host, scheme: 'https',
    score, risk,
    timestamp: Date.now() - hoursAgo * 3600000,
    durationMs: 3200,
    live: false, simulated: true, demo: true,
    categories, findings, summary, tech
  };
}

function cat(id, label, score, explanation, checks, chain) {
  return { id, label, icon: id, score, explanation, checks, chain: chain || null };
}
function chk(label, value, status, note) {
  return { label, value, status, note: note || null };
}
function fnd(severity, title, explanation, details, recommendation) {
  return { severity, title, explanation, details, recommendation };
}

function buildDemoRecords() {
  const exampleCom = demoRecord(
    'example.com', 92, 'low', 2,
    [
      cat('tls', 'SSL / TLS', 100, 'HTTPS enabled with a valid certificate', [
        chk('HTTPS Enabled', 'Yes', 'pass'),
        chk('Certificate Valid', 'Trusted by the browser', 'pass'),
        chk('TLS Version', 'TLS 1.3', 'pass'),
        chk('Certificate Issuer', "Let's Encrypt · R11", 'pass'),
        chk('Expiration Date', 'May 12, 2026 (in 45 days)', 'pass')
      ]),
      cat('headers', 'Security Headers', 70, '3 of 5 protective headers present', [
        chk('Content-Security-Policy', 'Missing', 'warn'),
        chk('Strict-Transport-Security', 'max-age=31536000', 'pass'),
        chk('X-Frame-Options', 'SAMEORIGIN', 'pass'),
        chk('X-Content-Type-Options', 'nosniff', 'pass'),
        chk('Referrer-Policy', 'Missing', 'warn')
      ]),
      cat('dns', 'DNS', 90, 'Records resolved · no DNSSEC', [
        chk('A Record', '93.184.216.34', 'pass'),
        chk('AAAA Record', 'None', 'info'),
        chk('MX Record', 'None', 'info', 'No mail servers — intentional for a documentation domain.'),
        chk('NS Record', 'a.iana-servers.net, b.iana-servers.net', 'pass'),
        chk('DNSSEC', 'Not detected', 'warn')
      ]),
      cat('domain', 'Domain', 100, 'Established registration (28 years old)', [
        chk('Domain Age', '28 years', 'pass'),
        chk('Registrar', 'ICANN', 'info'),
        chk('Registration Date', 'Aug 14, 1995', 'info'),
        chk('Expiration Date', 'Aug 13, 2026 (in 300 days)', 'info'),
        chk('Nameservers', 'a.iana-servers.net, b.iana-servers.net', 'info')
      ]),
      cat('redirects', 'Redirect Analysis', 100, 'HTTP upgrades to HTTPS (3 steps)', [
        chk('HTTP → HTTPS', 'Upgraded', 'pass'),
        chk('Redirect chain length', '3 steps', 'pass'),
        chk('Final URL', 'https://www.example.com/', 'pass')
      ], [
        { url: 'http://example.com', status: 301 },
        { url: 'https://example.com', status: 301 },
        { url: 'https://www.example.com', status: 200 }
      ]),
      cat('reputation', 'Reputation', 85, 'No threat indicators found', [
        chk('Known malicious reports', 'None found', 'pass'),
        chk('Phishing indicators', 'None found', 'pass'),
        chk('Malware indicators', 'None found', 'pass'),
        chk('Threat intelligence status', 'Heuristic estimate', 'info', 'No threat-feed API key configured; estimated from technical signals.')
      ])
    ],
    [
      fnd('pass', 'HTTPS is properly configured', 'The website uses encrypted HTTPS connections.',
        "Certificate issued by Let's Encrypt · R11, valid until May 12, 2026. The certificate chain is trusted by the browser.",
        'Renew certificates before expiry and keep the TLS configuration current.'),
      fnd('pass', 'HSTS is enabled', 'The website instructs browsers to use HTTPS.',
        'Strict-Transport-Security: max-age=31536000',
        'Consider adding includeSubDomains and submitting the domain to the HSTS preload list.'),
      fnd('medium', 'Content Security Policy is missing', 'A CSP can reduce the risk of certain browser-based attacks, such as cross-site scripting and data injection.',
        'No Content-Security-Policy header was present in the response.',
        "Add a Content-Security-Policy header such as \"default-src 'self'\" and tighten directives over time."),
      fnd('low', 'X-Content-Type-Options is missing', 'Browsers may sniff and misinterpret content types on some responses.',
        'No X-Content-Type-Options header was present in the response.',
        'Add "X-Content-Type-Options: nosniff".')
    ],
    {
      responseHeaders: [
        ['content-type', 'text/html; charset=UTF-8'],
        ['server', 'BigCDN'],
        ['strict-transport-security', 'max-age=31536000'],
        ['x-frame-options', 'SAMEORIGIN'],
        ['x-content-type-options', 'nosniff'],
        ['last-modified', 'Thu, 17 Oct 2019 07:18:26 GMT'],
        ['etag', '"3147526947+ident"'],
        ['cache-control', 'max-age=604800']
      ],
      tls: { protocol: 'TLS 1.3', issuer: "Let's Encrypt · R11", valid: true, notBefore: '2026-02-12', notAfter: '2026-05-12', daysLeft: 45 },
      dns: { A: ['93.184.216.34'], AAAA: [], MX: [], NS: ['a.iana-servers.net', 'b.iana-servers.net'], dnssec: false },
      ip: '93.184.216.34',
      asn: { number: 'AS150023', name: 'Example CDN, Inc.' },
      server: 'BigCDN',
      chain: [
        { url: 'http://example.com', status: 301 },
        { url: 'https://example.com', status: 301 },
        { url: 'https://www.example.com', status: 200 }
      ],
      status: 200,
      timingMs: 148
    }
  );

  const github = demoRecord(
    'github.com', 96, 'low', 26,
    [
      cat('tls', 'SSL / TLS', 100, 'HTTPS enabled with a valid certificate', [
        chk('HTTPS Enabled', 'Yes', 'pass'),
        chk('Certificate Valid', 'Trusted by the browser', 'pass'),
        chk('TLS Version', 'TLS 1.3', 'pass'),
        chk('Certificate Issuer', 'Sectigo Limited · Sectigo RSA', 'pass'),
        chk('Expiration Date', 'Mar 8, 2027 (in 210 days)', 'pass')
      ]),
      cat('headers', 'Security Headers', 90, '5 of 5 protective headers present', [
        chk('Content-Security-Policy', "default-src 'none'; base-uri 'self'; ...", 'pass'),
        chk('Strict-Transport-Security', 'max-age=31536000; includeSubDomains', 'pass'),
        chk('X-Frame-Options', 'deny', 'pass'),
        chk('X-Content-Type-Options', 'nosniff', 'pass'),
        chk('Referrer-Policy', 'strict-origin-when-cross-origin, no-referrer', 'pass')
      ]),
      cat('dns', 'DNS', 100, 'Records resolved · DNSSEC signed', [
        chk('A Record', '140.82.121.3', 'pass'),
        chk('AAAA Record', '2a04:4a00:5::963', 'pass'),
        chk('MX Record', '1 aspmx.l.google.com, ...', 'pass'),
        chk('NS Record', 'dns1.p08.nsone.net, ...', 'pass'),
        chk('DNSSEC', 'Enabled (validated)', 'pass')
      ]),
      cat('domain', 'Domain', 100, 'Established registration (18 years old)', [
        chk('Domain Age', '18 years', 'pass'),
        chk('Registrar', 'MarkMonitor Inc.', 'info'),
        chk('Registration Date', 'Oct 9, 2007', 'info'),
        chk('Expiration Date', 'Mar 9, 2027 (in 155 days)', 'info'),
        chk('Nameservers', 'dns1.p08.nsone.net, dns2.p08.nsone.net', 'info')
      ]),
      cat('redirects', 'Redirect Analysis', 100, 'HTTP upgrades to HTTPS (2 steps)', [
        chk('HTTP → HTTPS', 'Upgraded', 'pass'),
        chk('Redirect chain length', '2 steps', 'pass'),
        chk('Final URL', 'https://github.com/', 'pass')
      ], [
        { url: 'http://github.com', status: 301 },
        { url: 'https://github.com', status: 200 }
      ]),
      cat('reputation', 'Reputation', 90, 'No threat indicators found', [
        chk('Known malicious reports', 'None found', 'pass'),
        chk('Phishing indicators', 'None found', 'pass'),
        chk('Malware indicators', 'None found', 'pass'),
        chk('Threat intelligence status', 'Safe Browsing — clean', 'pass')
      ])
    ],
    [
      fnd('pass', 'HTTPS is properly configured', 'The website uses encrypted HTTPS connections.',
        'Certificate issued by Sectigo Limited · Sectigo RSA, valid until Mar 8, 2027.',
        'Renew certificates before expiry and keep the TLS configuration current.'),
      fnd('pass', 'Content Security Policy is enforced', 'The website restricts which resources the page may load, limiting browser-based attack techniques.',
        "Content-Security-Policy: default-src 'none'; base-uri 'self'; ...",
        'Keep the policy under review as the site evolves.'),
      fnd('pass', 'HSTS is enabled', 'The website instructs browsers to use HTTPS.',
        'Strict-Transport-Security: max-age=31536000; includeSubDomains',
        'Consider submitting the domain to the HSTS preload list.'),
      fnd('pass', 'Established domain registration', 'The domain has been registered for 18 years.',
        'Registered Oct 9, 2007 via MarkMonitor Inc.',
        'No action needed.')
    ],
    {
      responseHeaders: [
        ['content-type', 'text/html; charset=utf-8'],
        ['server', 'GitHub.com'],
        ['content-security-policy', "default-src 'none'; base-uri 'self'"],
        ['strict-transport-security', 'max-age=31536000; includeSubDomains'],
        ['x-frame-options', 'deny'],
        ['x-content-type-options', 'nosniff'],
        ['referrer-policy', 'strict-origin-when-cross-origin, no-referrer']
      ],
      tls: { protocol: 'TLS 1.3', issuer: 'Sectigo Limited · Sectigo RSA', valid: true, notBefore: '2026-05-08', notAfter: '2027-03-08', daysLeft: 210 },
      dns: { A: ['140.82.121.3'], AAAA: ['2a04:4a00:5::963'], MX: [{ priority: '1', host: 'aspmx.l.google.com' }], NS: ['dns1.p08.nsone.net', 'dns2.p08.nsone.net'], dnssec: true },
      ip: '140.82.121.3',
      asn: { number: 'AS36459', name: 'GitHub, Inc.' },
      server: 'GitHub.com',
      chain: [{ url: 'http://github.com', status: 301 }, { url: 'https://github.com', status: 200 }],
      status: 200,
      timingMs: 96
    }
  );

  const sketchy = demoRecord(
    'suspicious-site.example', 31, 'high', 74,
    [
      cat('tls', 'SSL / TLS', 60, 'HTTPS with an untrusted certificate', [
        chk('HTTPS Enabled', 'Yes', 'pass'),
        chk('Certificate Valid', 'Not trusted (self-signed)', 'fail'),
        chk('TLS Version', 'TLS 1.2', 'warn'),
        chk('Certificate Issuer', 'Self-signed', 'fail'),
        chk('Expiration Date', 'Oct 15, 2026 (in 11 days)', 'fail')
      ]),
      cat('headers', 'Security Headers', 10, '0 of 5 protective headers present', [
        chk('Content-Security-Policy', 'Missing', 'warn'),
        chk('Strict-Transport-Security', 'Missing', 'warn'),
        chk('X-Frame-Options', 'Missing', 'warn'),
        chk('X-Content-Type-Options', 'Missing', 'warn'),
        chk('Referrer-Policy', 'Missing', 'warn')
      ]),
      cat('dns', 'DNS', 80, 'Records resolved · no DNSSEC', [
        chk('A Record', '45.133.1.87', 'pass'),
        chk('AAAA Record', 'None', 'info'),
        chk('MX Record', 'None', 'info'),
        chk('NS Record', 'ns1.suspicious-site.example, ns2.suspicious-site.example', 'pass'),
        chk('DNSSEC', 'Not detected', 'warn')
      ]),
      cat('domain', 'Domain', 8, 'Registered very recently', [
        chk('Domain Age', '12 days', 'fail'),
        chk('Registrar', 'NameSilo, LLC', 'info'),
        chk('Registration Date', 'Sep 22, 2026', 'info'),
        chk('Expiration Date', 'Sep 22, 2027 (in 352 days)', 'info'),
        chk('Nameservers', 'ns1.suspicious-site.example, ns2.suspicious-site.example', 'info')
      ]),
      cat('redirects', 'Redirect Analysis', 25, 'HTTP does not redirect to HTTPS', [
        chk('HTTP → HTTPS', 'Not upgraded', 'fail'),
        chk('Redirect chain length', '1 step', 'pass'),
        chk('Final URL', 'http://suspicious-site.example', 'fail')
      ], [
        { url: 'http://suspicious-site.example', status: 200 }
      ]),
      cat('reputation', 'Reputation', 10, 'Flagged by threat intelligence', [
        chk('Known malicious reports', '2 reports', 'fail'),
        chk('Phishing indicators', 'Detected', 'fail'),
        chk('Malware indicators', 'Detected', 'fail'),
        chk('Threat intelligence status', 'Flagged by Safe Browsing', 'fail')
      ])
    ],
    [
      fnd('critical', 'Flagged by threat intelligence', 'This site appears in threat-intelligence reports as dangerous to visitors.',
        'Threat types: SOCIAL_ENGINEERING (phishing), MALWARE',
        'Avoid visiting this site, downloading files from it, or submitting any information.'),
      fnd('high', 'Domain registered 12 days ago', 'Newly registered domains are statistically over-represented in phishing and scam campaigns.',
        'Registered Sep 22, 2026 via NameSilo, LLC.',
        'Treat unfamiliar young domains with extra caution and avoid sharing sensitive information.'),
      fnd('high', 'HTTP does not redirect to HTTPS', 'The site also serves content over plain HTTP, which can be read or modified in transit.',
        'The http:// address returned a direct 200 response without redirecting.',
        'Configure a permanent redirect from http:// to https:// on the web server.'),
      fnd('medium', 'Certificate is not trusted', 'The HTTPS certificate is self-signed and not chained to a trusted authority.',
        'Issuer: Self-signed. Valid until Oct 15, 2026.',
        'Obtain a certificate from a trusted, publicly-known certificate authority.'),
      fnd('medium', 'Content Security Policy is missing', 'A CSP can reduce the risk of certain browser-based attacks, such as cross-site scripting and data injection.',
        'No Content-Security-Policy header was present in the response.',
        "Add a Content-Security-Policy header such as \"default-src 'self'\" and tighten directives over time.")
    ],
    {
      responseHeaders: [
        ['content-type', 'text/html; charset=UTF-8'],
        ['server', 'nginx/1.18.0'],
        ['x-powered-by', 'PHP/7.4.3']
      ],
      tls: { protocol: 'TLS 1.2', issuer: 'Self-signed', valid: false, notBefore: '2026-09-22', notAfter: '2026-10-15', daysLeft: 11 },
      dns: { A: ['45.133.1.87'], AAAA: [], MX: [], NS: ['ns1.suspicious-site.example', 'ns2.suspicious-site.example'], dnssec: false },
      ip: '45.133.1.87',
      asn: { number: 'AS49123', name: 'Prefix Hosting Ltd.' },
      server: 'nginx/1.18.0',
      chain: [{ url: 'http://suspicious-site.example', status: 200 }],
      status: 200,
      timingMs: 412
    }
  );

  return [exampleCom, github, sketchy];
}

/* -------------------------------------------------------------- toasts */
function showToast(msg, type, opts) {
  type = type || 'info';
  opts = opts || {};
  const wrap = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  const icon = type === 'success' ? I.check : type === 'error' ? I.x : type === 'warn' ? I.warn : I.info;
  el.innerHTML = '<span>' + icon + '</span><span class="msg">' + esc(msg) + '</span>' +
    (opts.action ? '<button class="t-action">' + esc(opts.action) + '</button>' : '') +
    '<button class="t-close" aria-label="Dismiss">' + I.x + '</button>';
  const kill = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 260);
  };
  el.querySelector('.t-close').addEventListener('click', kill);
  if (opts.action && opts.onAction) {
    el.querySelector('.t-action').addEventListener('click', () => { opts.onAction(); kill(); });
  }
  wrap.appendChild(el);
  setTimeout(kill, opts.duration || 4600);
}

/* -------------------------------------------------------------- router */
const VIEW_TITLES = {
  overview: 'Overview',
  scan: 'Scan Website',
  linkcheck: 'Link Checker',
  history: 'Scan History',
  reports: 'Reports',
  settings: 'Settings'
};

function route(view, param) {
  App.view = view;
  App.viewParam = param || null;
  render();
  window.scrollTo(0, 0);
}

function render() {
  $$('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.nav === App.view);
  });
  $('#topbar-title').textContent = VIEW_TITLES[App.view] || 'TrustScan';

  const v = $('#view');
  if (App.view === 'overview') v.innerHTML = viewOverview();
  else if (App.view === 'scan') v.innerHTML = viewScan();
  else if (App.view === 'linkcheck') v.innerHTML = viewLinkChecker();
  else if (App.view === 'history') v.innerHTML = viewHistory();
  else if (App.view === 'reports') v.innerHTML = viewReports();
  else if (App.view === 'settings') v.innerHTML = viewSettings();

  afterRender();
}

function afterRender() {
  // topbar subtitle
  const sub = $('#topbar-sub');
  if (App.view === 'scan') {
    sub.textContent = App.scanning ? 'Scanning ' + (App.current && App.current.host ? App.current.host : '') + '…'
      : (App.current ? App.current.host : 'Analyze a website');
  } else if (App.view === 'linkcheck') {
    sub.textContent = App.linkChecking ? 'Checking link…'
      : (App.linkResult ? 'Link analysis complete' : 'See where a link really leads');
  } else if (App.view === 'history') {
    sub.textContent = App.records.length + (App.records.length === 1 ? ' scan stored' : ' scans stored');
  } else if (App.view === 'overview') {
    sub.textContent = 'Analyze any website before you trust it';
  } else if (App.view === 'reports') {
    sub.textContent = App.current ? 'Report for ' + App.current.host : 'Exportable security reports';
  } else {
    sub.textContent = 'Analysis preferences and data';
  }

  // animated result view
  if (App.view === 'scan' && !App.scanning && App.current) animateResult();
  // score bars in overview stats
  $$('[data-bar]').forEach((el) => {
    requestAnimationFrame(() => { el.style.width = el.dataset.bar + '%'; });
  });
  // auto focus scan input on the idle scan view
  if (App.view === 'scan' && !App.scanning && !App.current) {
    const inp = $('[data-scan-input]');
    if (inp) inp.focus();
  }
  // auto focus link input on the idle link checker view
  if (App.view === 'linkcheck' && !App.linkChecking && !App.linkResult) {
    const inp = $('[data-link-input]');
    if (inp) inp.focus();
  }
}

/* ----------------------------------------------------------------- views */

function scanbarHTML(placeholder, btnLabel) {
  return `
    <form class="scan-card" data-scanform>
      <span class="globe">${I.globe}</span>
      <input class="scan-input" data-scan-input type="text" spellcheck="false"
             autocomplete="off" placeholder="${esc(placeholder)}" aria-label="Website URL">
      <button class="btn btn-primary" type="submit">${esc(btnLabel)}</button>
    </form>
    <div class="privacy-note">${I.lock} Only publicly accessible technical information is analyzed.</div>`;
}

function viewOverview() {
  const recents = App.records.slice(0, 5);
  const stats = computeStats();

  return `
  <section class="hero">
    <h1>Analyze any website<br>before you trust it.</h1>
    <p class="hero-sub">Inspect security configuration, DNS, certificates, redirects and reputation indicators in seconds.</p>
    ${scanbarHTML('https://example.com', 'Analyze Website')}
    <div style="margin-top:14px">
      <button class="btn btn-ghost btn-sm" data-nav="linkcheck">${I.link} Check where a link leads</button>
    </div>
  </section>

  ${stats.total > 0 ? `
  <div class="stats-row fade-up" style="--d:.05s">
    <div class="stat"><div class="s-label">Scans performed</div><div class="s-value">${stats.total}</div></div>
    <div class="stat"><div class="s-label">Average score</div><div class="s-value">${stats.avg}<small>/100</small></div></div>
    <div class="stat"><div class="s-label">Low risk share</div><div class="s-value">${stats.lowPct}<small>%</small></div></div>
    <div class="stat"><div class="s-label">Last scan</div><div class="s-value" style="font-size:16px;line-height:2">${esc(stats.last)}</div></div>
  </div>` : ''}

  <div class="section-head">
    <h2>Recent scans</h2>
    ${App.records.length ? '<button class="btn btn-ghost btn-sm" data-nav="history">View all</button>' : ''}
  </div>
  <div class="recent-list">
    ${recents.length ? recents.map(recentRowHTML).join('') : `
      <div class="empty">
        ${I.radar}
        <div class="e-title">No scans yet</div>
        <p>Enter a website address above to run your first analysis.</p>
      </div>`}
  </div>

  <div class="section-head">
    <h2>What gets analyzed</h2>
  </div>
  <div class="tiles fade-up" style="--d:.08s">
    <div class="tile"><div class="t-icon">${I.lock}</div><div class="t-name">SSL / TLS</div><div class="t-desc">Encryption and certificate validity, issuer and expiry.</div></div>
    <div class="tile"><div class="t-icon">${I.shield}</div><div class="t-name">Security headers</div><div class="t-desc">CSP, HSTS, clickjacking and MIME-spoofing protections.</div></div>
    <div class="tile"><div class="t-icon">${I.network}</div><div class="t-name">DNS</div><div class="t-desc">A, AAAA, MX and NS records, plus DNSSEC signing.</div></div>
    <div class="tile"><div class="t-icon">${I.calendar}</div><div class="t-name">Domain registration</div><div class="t-desc">Registrar, registration date and domain age via RDAP.</div></div>
    <div class="tile"><div class="t-icon">${I.redirect}</div><div class="t-name">Redirects</div><div class="t-desc">Full redirect chain and HTTP-to-HTTPS upgrades.</div></div>
    <div class="tile"><div class="t-icon">${I.eye}</div><div class="t-name">Reputation</div><div class="t-desc">Malicious, phishing and malware threat indicators.</div></div>
  </div>`;
}

function recentRowHTML(r) {
  return `
  <button class="recent-row" data-action="view" data-id="${esc(r.id)}">
    <span class="avatar">${esc((r.host || '?').slice(0, 1))}</span>
    <span class="rr-main">
      <div class="rr-host">${esc(r.host)} ${r.demo ? '<span class="chip chip-demo">sample</span>' : ''}</div>
      <div class="rr-url">${esc(r.url)}</div>
    </span>
    <span class="rr-score ${scoreClass(r.score)}" style="color:${scoreColor(r.score)}">${r.score}/100</span>
    <span class="rr-risk" style="color:${RISK_META[r.risk].color}">${riskLabel(r.risk)}</span>
    <span class="rr-time">${timeAgo(r.timestamp)}</span>
    <span class="rr-chevron">${I.chevron}</span>
  </button>`;
}

function computeStats() {
  const total = App.records.length;
  const avg = total ? Math.round(App.records.reduce((a, r) => a + r.score, 0) / total) : 0;
  const low = total ? App.records.filter((r) => r.risk === 'low').length : 0;
  const lowPct = total ? Math.round((low / total) * 100) : 0;
  const last = total ? (Date.now() - App.records[0].timestamp < 120000 ? 'just now' : timeAgo(App.records[0].timestamp)) : '—';
  return { total, avg, lowPct, last };
}

/* ---- scan view ---- */
function viewScan() {
  if (App.scanning) return scanProgressHTML();
  if (App.current) return resultHTML(App.current);
  return `
  <section class="hero" style="padding-bottom:0">
    <h1 style="font-size:clamp(24px,3vw,32px)">Scan a website.</h1>
    <p class="hero-sub" style="margin-top:8px">Enter a URL to analyze, or inspect the page currently open in this browser.</p>
    <div style="max-width:720px">
      ${scanbarHTML('https://example.com', 'Analyze Website')}
      <div style="margin-top:14px">
        <button class="btn btn-ghost btn-sm" data-action="scan-tab">${I.globe} Analyze current tab</button>
      </div>
    </div>
  </section>
  <div class="section-head"><h2>Recent scans</h2></div>
  <div class="recent-list">${App.records.slice(0, 4).map(recentRowHTML).join('') || emptyScanHTML()}</div>`;
}

function emptyScanHTML() {
  return `<div class="empty">${I.radar}<div class="e-title">Nothing scanned yet</div><p>Enter a website address above to start.</p></div>`;
}

/* ---- link checker view ---- */
function viewLinkChecker() {
  if (App.linkChecking) return linkProgressHTML();
  if (App.linkResult) return linkResultHTML(App.linkResult);
  return `
  <section class="hero" style="padding-bottom:0">
    <h1 style="font-size:clamp(24px,3vw,32px)">Where does this link lead?</h1>
    <p class="hero-sub" style="margin-top:8px">Paste any link — shortened URLs, redirect links, or downloads — and see exactly where it takes you before you click.</p>
    <div style="max-width:720px">
      <form class="scan-card" data-linkform>
        <span class="globe" style="color:var(--accent)">${I.link}</span>
        <input class="scan-input" data-link-input type="text" spellcheck="false"
               autocomplete="off" placeholder="https://bit.ly/… or any link you want to check" aria-label="Link to check">
        <button class="btn btn-primary" type="submit">Check Link</button>
      </form>
      <div class="privacy-note">${I.lock} The link is resolved from your browser — nothing is uploaded or stored.</div>
    </div>
  </section>

  <div class="section-head"><h2>What gets checked</h2></div>
  <div class="tiles fade-up" style="--d:.08s">
    <div class="tile"><div class="t-icon" style="color:var(--accent)">${I.redirect}</div><div class="t-name">Redirect chain</div><div class="t-desc">Follows every hop to reveal the true final destination, even through URL shorteners.</div></div>
    <div class="tile"><div class="t-icon" style="color:var(--amber)">${I.download}</div><div class="t-name">Download detection</div><div class="t-desc">Identifies if the link triggers a file download — executables, archives, documents and more.</div></div>
    <div class="tile"><div class="t-icon" style="color:var(--red)">${I.shield}</div><div class="t-name">Risk assessment</div><div class="t-desc">Checks the destination against known scam patterns, domain age, and threat intelligence.</div></div>
  </div>`;
}

function linkProgressHTML() {
  const steps = (TrustEngine.LINK_STEP_LABELS || ['Checking link...']).map((label, i) => `
    <li class="step ${i === 0 ? 'active' : ''}" data-lstep="${i}">
      <span class="s-icon">
        ${i === 0 ? spinnerSVG() : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>`}
      </span>
      <span>${esc(label.replace('...', ''))}</span>
      <span class="s-time"></span>
    </li>`).join('');

  return `
  <section class="scan-progress">
    <div class="scan-target">
      <span class="pulse-dot"></span>${esc(App.linkTarget || '')}
    </div>
    <div class="scan-current"><span data-link-current-label>${esc((TrustEngine.LINK_STEP_LABELS || ['Checking'])[0])}</span><span class="ellip"></span></div>
    <ol class="steps">${steps}</ol>
    <div class="progressbar"><i data-link-progress-bar style="width:6%"></i></div>
  </section>
  <div class="skel-result">
    <div class="skeleton skel-ring"></div>
    <div class="skel-side">
      <div class="skeleton sk"></div>
      <div class="skeleton sk"></div>
    </div>
  </div>`;
}

function updateLinkStep(idx, ms) {
  const stepEl = $('[data-lstep="' + idx + '"]');
  if (stepEl) {
    stepEl.classList.remove('active');
    stepEl.classList.add('done');
    stepEl.querySelector('.s-icon').innerHTML = I.check;
    if (ms) stepEl.querySelector('.s-time').textContent = (ms / 1000).toFixed(1) + 's';
  }
  const labels = TrustEngine.LINK_STEP_LABELS || [];
  const next = $('[data-lstep="' + (idx + 1) + '"]');
  if (next) {
    next.classList.add('active');
    next.querySelector('.s-icon').innerHTML = spinnerSVG();
    const lbl = $('[data-link-current-label]');
    if (lbl) lbl.textContent = labels[idx + 1] || 'Finishing...';
  } else {
    const lbl = $('[data-link-current-label]');
    if (lbl) lbl.textContent = 'Compiling result';
  }
  const bar = $('[data-link-progress-bar]');
  if (bar) bar.style.width = Math.min(100, Math.round(((idx + 1) / (labels.length || 4)) * 100)) + '%';
}

function linkResultHTML(r) {
  const iconMap = { check: I.check, x: I.x, warn: I.warn, download: I.download, info: I.info };
  const vIcon = iconMap[r.verdictIcon] || I.info;
  const chainLen = r.chain ? r.chain.length : 0;
  const hops = Math.max(0, chainLen - 1);

  return `
  <div class="result-head fade-up">
    <div>
      <div class="rh-host" style="font-size:18px">
        ${I.link} Link Checker
        ${r.live ? '<span class="chip chip-live">live check</span>' : '<span class="chip chip-est">estimated</span>'}
      </div>
      <div class="rh-url" style="margin-top:6px">${esc(r.originalUrl)}</div>
      <div class="rh-meta">
        <span>Checked ${timeAgo(r.timestamp) === 'just now' ? 'just now' : timeAgo(r.timestamp)}</span>
        <span class="sep">·</span>
        <span>${(r.durationMs / 1000).toFixed(1)}s</span>
        <span class="sep">·</span>
        <span>${hops} redirect${hops === 1 ? '' : 's'} followed</span>
      </div>
    </div>
    <span class="risk-badge" style="color:${r.verdictColor};border-color:${r.verdictColor}55;background:${r.verdictColor}14">
      <span class="dot" style="background:${r.verdictColor}"></span>${r.verdictLabel}
    </span>
  </div>

  <!-- Verdict card -->
  <div class="link-verdict-card fade-up" style="--d:.05s; border-color:${r.verdictColor}44">
    <div class="lv-icon" style="color:${r.verdictColor};background:${r.verdictColor}14;border-color:${r.verdictColor}44">
      ${vIcon}
    </div>
    <div class="lv-body">
      <div class="lv-label" style="color:${r.verdictColor}">${r.verdictLabel}</div>
      <div class="lv-desc">${esc(r.verdictDesc)}</div>
    </div>
  </div>

  <!-- Where it leads -->
  <div class="section-head"><h2>Where this link leads</h2></div>
  <div class="link-dest-card fade-up" style="--d:.1s">
    <div class="ld-row">
      <span class="ld-label">${I.link} Original link</span>
      <span class="ld-value mono">${esc(r.originalUrl)}</span>
    </div>
    <div class="ld-arrow">${I.arrowR}</div>
    <div class="ld-row ${r.finalUrl !== r.originalUrl ? 'changed' : ''}">
      <span class="ld-label">${I.globe} Final destination</span>
      <span class="ld-value mono">${esc(r.finalUrl)}</span>
      ${r.finalUrl !== r.originalUrl ? '<span class="chip chip-demo" style="margin-left:8px">redirected</span>' : ''}
    </div>
    ${r.isDownload ? `
    <div class="ld-arrow">${I.arrowR}</div>
    <div class="ld-row download">
      <span class="ld-label">${I.download} Download</span>
      <span class="ld-value">
        <span class="mono">${esc(r.downloadFileName || 'Unknown file')}</span>
        <span class="ld-note">${esc(r.downloadReason || '')}</span>
      </span>
    </div>` : ''}
    ${r.contentType ? `
    <div class="ld-row">
      <span class="ld-label">Content type</span>
      <span class="ld-value mono">${esc(r.contentType)}</span>
    </div>` : ''}
    ${r.finalStatus ? `
    <div class="ld-row">
      <span class="ld-label">HTTP status</span>
      <span class="ld-value mono">${r.finalStatus}</span>
    </div>` : ''}
  </div>

  <!-- Redirect chain -->
  ${chainLen > 1 ? `
  <div class="section-head"><h2>Redirect chain</h2><span class="hint">${chainLen} step${chainLen === 1 ? '' : 's'}</span></div>
  <div class="link-chain-card fade-up" style="--d:.12s">
    ${r.chain.map((c, i) => {
      const scheme = (c.url || '').startsWith('https') ? 'https' : 'http';
      const isFinal = c.final || i === r.chain.length - 1;
      const cls = isFinal ? 'final' : scheme;
      const arrow = !isFinal ? `<span class="chain-arrow">${I.arrowR}${c.status ? esc(String(c.status)) : ''}</span>` : '';
      const errBadge = c.error ? '<span class="chip" style="color:var(--red);border-color:var(--red-line)">error</span>' : '';
      const loopBadge = c.loop ? '<span class="chip" style="color:var(--amber);border-color:var(--amber-line)">loop</span>' : '';
      return `<span class="chain-node ${cls}"><span class="st">${isFinal ? 'FINAL' : esc(String(c.status || '—'))}</span>${esc(c.url)} ${errBadge}${loopBadge}</span>${arrow}`;
    }).join('')}
  </div>` : ''}

  <!-- Risk reasons -->
  ${r.destReasons && r.destReasons.length ? `
  <div class="section-head"><h2>Analysis details</h2></div>
  <div class="link-reasons fade-up" style="--d:.14s">
    ${r.destReasons.map((reason) => `
      <div class="link-reason">
        <span class="lr-icon" style="color:${r.destRisk === 'high' ? 'var(--red)' : r.destRisk === 'medium' ? 'var(--amber)' : 'var(--green)'}">
          ${r.destRisk === 'high' ? I.x : r.destRisk === 'medium' ? I.warn : I.check}
        </span>
        <span>${esc(reason)}</span>
      </div>`).join('')}
  </div>` : ''}

  <!-- Actions -->
  <div class="result-actions fade-up" style="--d:.16s; margin-top:24px">
    <button class="btn btn-primary btn-sm" data-action="new-link">${I.link} Check another link</button>
    ${!r.isDownload && r.reachable ? `<button class="btn btn-ghost btn-sm" data-action="scan-final" data-url="${esc(r.finalUrl)}">${I.radar} Full scan of destination</button>` : ''}
    <span class="spacer"></span>
    <button class="btn btn-ghost btn-sm" data-action="copy-final" data-url="${esc(r.finalUrl)}">${I.file} Copy final URL</button>
  </div>

  <div class="privacy-note" style="margin-top:16px">
    ${I.info} This analysis shows where a link leads based on publicly visible redirect and response data. It is not a guarantee of safety.
  </div>`;
}

function scanProgressHTML() {
  const steps = TrustEngine.STEP_LABELS.map((label, i) => `
    <li class="step ${i === 0 ? 'active' : ''}" data-step="${i}">
      <span class="s-icon">
        ${i === 0 ? spinnerSVG() : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>`}
      </span>
      <span>${esc(label.replace('...', ''))}</span>
      <span class="s-time"></span>
    </li>`).join('');

  return `
  <section class="scan-progress">
    <div class="scan-target">
      <span class="pulse-dot"></span>${esc(App.scanTarget || '')}
    </div>
    <div class="scan-current"><span data-current-label>${esc(TrustEngine.STEP_LABELS[0])}</span><span class="ellip"></span></div>
    <ol class="steps">${steps}</ol>
    <div class="progressbar"><i data-progress-bar style="width:6%"></i></div>
  </section>
  <div class="skel-result">
    <div class="skeleton skel-ring"></div>
    <div class="skel-side">
      <div class="skeleton sk"></div>
      <div class="skeleton sk"></div>
      <div class="skeleton sk"></div>
    </div>
  </div>
  <div class="skel-cats">
    ${'<div class="skeleton sk"></div>'.repeat(6)}
  </div>`;
}

function spinnerSVG() {
  return '<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-dasharray="42" stroke-dashoffset="26"/></svg>';
}

function updateScanStep(idx, ms) {
  const stepEl = $('[data-step="' + idx + '"]');
  if (stepEl) {
    stepEl.classList.remove('active');
    stepEl.classList.add('done');
    stepEl.querySelector('.s-icon').innerHTML = I.check;
    if (ms) stepEl.querySelector('.s-time').textContent = (ms / 1000).toFixed(1) + 's';
  }
  const next = $('[data-step="' + (idx + 1) + '"]');
  if (next) {
    next.classList.add('active');
    next.querySelector('.s-icon').innerHTML = spinnerSVG();
    $('[data-current-label]').textContent = TrustEngine.STEP_LABELS[idx + 1];
  } else {
    const label = $('[data-current-label]');
    if (label) label.textContent = 'Compiling report';
  }
  const bar = $('[data-progress-bar]');
  if (bar) bar.style.width = Math.min(100, Math.round(((idx + 1) / 5) * 100)) + '%';
}

/* ---- result view ---- */
const RING_C = 527.79;

function resultHTML(r) {
  const meta = RISK_META[r.risk];
  const issues = r.summary.critical + r.summary.high + r.summary.medium + r.summary.low;

  return `
  <div class="result-head fade-up">
    <div>
      <div class="rh-host">${esc(r.host)}
        ${r.live ? '<span class="chip chip-live">live scan</span>' : '<span class="chip chip-est">estimated</span>'}
        ${r.demo ? '<span class="chip chip-demo">sample</span>' : ''}
      </div>
      <div class="rh-url">${esc(r.url)}</div>
      <div class="rh-meta">
        <span>${timeAgo(r.timestamp) === 'just now' ? 'Analyzed just now' : 'Analyzed ' + timeAgo(r.timestamp)}</span>
        <span class="sep">·</span>
        <span>${(r.durationMs / 1000).toFixed(1)}s</span>
        <span class="sep">·</span>
        <span>${issues} indicator${issues === 1 ? '' : 's'} detected</span>
      </div>
    </div>
    <span class="risk-badge ${meta.cls}"><span class="dot"></span>${meta.label}</span>
  </div>

  <div class="result-hero">
    <div class="score-card fade-up" style="--d:.05s">
      <div class="score-ring" style="--glow:${meta.color}55">
        <svg viewBox="0 0 200 200" role="img" aria-label="Trust score ${r.score} out of 100">
          <circle class="track" cx="100" cy="100" r="84"></circle>
          <circle class="value" id="ring-value" cx="100" cy="100" r="84"
                  style="stroke:${meta.color};stroke-dasharray:${RING_C};stroke-dashoffset:${RING_C}"></circle>
        </svg>
        <div class="ring-center">
          <div class="ring-num"><span data-count="${r.score}">0</span><small>/100</small></div>
          <div class="ring-caption">TRUST SCORE</div>
        </div>
      </div>
      <div class="score-under">
        <span class="risk-badge ${meta.cls}"><span class="dot"></span>${meta.label}</span>
        <p class="support">${meta.text}</p>
      </div>
    </div>

    <div class="result-side">
      <div class="card breakdown fade-up" style="--d:.1s">
        <h3>Risk breakdown by category</h3>
        ${r.categories.map((c) => `
          <div class="bd-row" style="color:${scoreColor(c.score)}">
            <span class="bd-name">${esc(c.label)}</span>
            <span class="bd-bar"><i data-bar="${c.score}"></i></span>
            <span class="bd-score" style="color:${scoreColor(c.score)}">${c.score}/100</span>
          </div>`).join('')}
      </div>
      <div class="result-actions fade-up" style="--d:.15s">
        <button class="btn btn-ghost btn-sm" data-action="rescan" data-url="${esc(r.url)}">${I.refresh} Rescan</button>
        <button class="btn btn-ghost btn-sm" data-action="open-report" data-id="${esc(r.id)}">${I.file} Open report</button>
        <button class="btn btn-primary btn-sm" data-action="export-pdf" data-id="${esc(r.id)}">${I.download} Export PDF</button>
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" data-action="new">New scan</button>
      </div>
    </div>
  </div>

  <div class="section-head"><h2>Categories</h2><span class="hint">Click a card for details</span></div>
  <div class="cats-grid">
    ${r.categories.map((c, i) => categoryCardHTML(c, i)).join('')}
  </div>

  <div class="section-head">
    <h2>Security Findings</h2>
    <div class="sev-chips">
      ${r.summary.critical ? `<span class="sev-chip sev-critical">${r.summary.critical} critical</span>` : ''}
      ${r.summary.high ? `<span class="sev-chip sev-high">${r.summary.high} high</span>` : ''}
      ${r.summary.medium ? `<span class="sev-chip sev-medium">${r.summary.medium} medium</span>` : ''}
      ${r.summary.low ? `<span class="sev-chip sev-low">${r.summary.low} low</span>` : ''}
    </div>
  </div>
  <div class="findings-grid">
    <div class="findings-list">
      ${r.findings.map((f, i) => findingHTML(f, i)).join('')}
    </div>
    <div class="risk-summary fade-up" style="--d:.1s">
      <h3>Risk Summary</h3>
      <div class="rs-tiles">
        ${rsTile('critical', 'Critical', r.summary.critical)}
        ${rsTile('high', 'High', r.summary.high)}
        ${rsTile('medium', 'Medium', r.summary.medium)}
        ${rsTile('low', 'Low', r.summary.low)}
      </div>
      <div class="rs-bar">
        <i class="b-critical" style="width:${pct(r.summary.critical, issues)}%"></i>
        <i class="b-high" style="width:${pct(r.summary.high, issues)}%"></i>
        <i class="b-medium" style="width:${pct(r.summary.medium, issues)}%"></i>
        <i class="b-low" style="width:${pct(r.summary.low, issues)}%"></i>
      </div>
      <div class="rs-foot">${issues === 0
        ? 'No issue-level findings were detected in this scan.'
        : 'Based on indicators observed at scan time — not a guarantee of website safety.'}</div>
    </div>
  </div>

  ${technicalHTML(r)}
  ${glossaryHTML()}`;
}

/* Plain-language glossary of security terms shown at the bottom of results */
function glossaryHTML() {
  const entries = Object.entries(TERM_GLOSSARY)
    .sort((a, b) => a[0].localeCompare(b[0]));
  return `
  <div class="section-head" style="margin-top:40px">
    <h2>Security terms explained</h2>
    <span class="hint">Plain-language definitions</span>
  </div>
  <section class="glossary card fade-up" data-accordion>
    <button class="glossary-head" data-toggle>
      ${I.info}<span>New to security terms? Read this</span>
      <span class="hint">Click to expand</span>
      <span class="spacer"></span>
      <span class="glossary-chevron">${I.chevron}</span>
    </button>
    <div class="glossary-expand">
      <div class="glossary-expand-inner">
        <div class="glossary-grid">
          ${entries.map(([term, def]) => `
            <div class="glossary-item">
              <div class="g-term">${esc(term)}</div>
              <div class="g-def">${esc(def)}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  </section>`;
}

function pct(n, total) { return total ? Math.round((n / total) * 100) : 0; }

function rsTile(key, label, n) {
  return `<div class="rs-tile ${key} ${n === 0 ? 'zero' : ''}">
    <span class="n">${n}</span><span class="l">${label}</span>
  </div>`;
}

function categoryCardHTML(c, i) {
  const status = c.score >= 80 ? 'st-pass' : c.score >= 50 ? 'st-warn' : 'st-fail';
  const info = CATEGORY_INFO[c.id] || '';
  return `
  <section class="cat fade-up" style="--d:${0.05 + i * 0.04}s" data-accordion>
    <div class="cat-head" data-toggle>
      <span class="cat-icon ${status}">${CATEGORY_ICONS[c.icon] || I.shield}</span>
      <span class="cat-title">
        <span class="c-name">${esc(c.label)}
          <span class="score-chip ${scoreClass(c.score)}">${c.score}/100</span>
        </span>
        <span class="c-exp">${esc(c.explanation)}</span>
      </span>
      <span class="cat-chevron">${I.chevron}</span>
    </div>
    <div class="cat-expand">
      <div class="cat-expand-inner">
        ${info ? `<div class="cat-info">${I.info}<span>${esc(info)}</span></div>` : ''}
        <div class="checks">
          ${c.checks.map(checkRowHTML).join('')}
          ${c.chain && c.chain.length ? chainHTML(c.chain) : ''}
        </div>
      </div>
    </div>
  </section>`;
}

function checkRowHTML(ck) {
  const icon = ck.status === 'pass' ? I.check : ck.status === 'warn' ? I.warn
    : ck.status === 'fail' ? I.x : I.info;
  return `
  <div class="check">
    <span class="ck-icon ck-${ck.status}">${icon}</span>
    <span class="ck-body">
      <span class="ck-label">${termHTML(ck.label)}</span>
      <div class="ck-value">${esc(ck.value)}</div>
      ${ck.note ? `<div class="ck-note">${esc(ck.note)}</div>` : ''}
    </span>
  </div>`;
}

function chainHTML(chain) {
  return `
  <div class="chain">
    ${chain.map((c, i) => {
      const scheme = c.url.startsWith('https') ? 'https' : 'http';
      const cls = c.final ? 'final' : scheme;
      const arrow = i < chain.length - 1
        ? `<span class="chain-arrow">${I.arrowR}${c.status ? esc(String(c.status)) : ''}</span>` : '';
      return `<span class="chain-node ${cls}"><span class="st">${c.final ? 'FINAL' : esc(String(c.status || '—'))}</span>${esc(c.url)}</span>${arrow}`;
    }).join('')}
  </div>
  <div class="chain-note">Each step shows the redirect status returned by the previous URL.</div>`;
}

function findingHTML(f, i) {
  const m = SEVERITY_META[f.severity];
  return `
  <section class="finding f-sev-${f.severity} fade-up" style="--d:${i * 0.03}s" data-accordion>
    <div class="f-head" data-toggle>
      <span class="f-icon">${m.icon}</span>
      <span class="f-title">
        <span class="t">${esc(f.title)}</span>
        <span class="e">${esc(f.explanation)}</span>
      </span>
      <span class="f-chevron">${I.chevron}</span>
    </div>
    <div class="f-expand">
      <div class="f-expand-inner">
        <div class="f-details">
          <div class="f-block">
            <div class="fb-label">TECHNICAL DETAILS</div>
            <code>${esc(f.details || '—')}</code>
          </div>
          <div class="f-block">
            <div class="fb-label">RECOMMENDATION</div>
            <div class="fb-text">${esc(f.recommendation || '—')}</div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function technicalHTML(r) {
  const t = r.tech || {};
  const tlsRows = [
    ['Protocol', t.tls ? t.tls.protocol : '—'],
    ['Certificate issuer', t.tls ? t.tls.issuer : '—'],
    ['Valid', t.tls && t.tls.valid ? 'Yes (trusted chain)' : 'No / unknown'],
    ['Expires', t.tls && t.tls.notAfter ? t.tls.notAfter : '—']
  ];
  const dnsRows = [
    ['A', (t.dns && t.dns.A || []).join(', ') || '—'],
    ['AAAA', (t.dns && t.dns.AAAA || []).join(', ') || '—'],
    ['MX', (t.dns && t.dns.MX || []).map((m) => (m.priority + ' ' + m.host)).join(', ') || '—'],
    ['NS', (t.dns && t.dns.NS || []).join(', ') || '—'],
    ['DNSSEC', t.dns && t.dns.dnssec ? 'Validated (AD flag)' : 'Not detected']
  ];
  return `
  <section class="tech" data-accordion>
    <button class="tech-head" data-toggle>
      ${I.network}<span>Technical details</span>
      <span class="hint">for advanced users</span>
      <span class="spacer"></span>
      <span class="tech-chevron">${I.chevron}</span>
    </button>
    <div class="tech-expand">
      <div class="tech-expand-inner">
        <div class="tech-body">
          <div class="tech-grid">
            <div class="tech-panel">
              <div class="tp-title">RESPONSE HEADERS</div>
              ${(t.responseHeaders || []).map(([k, v]) => `<div class="tech-kv"><span class="k">${esc(k)}:</span><span class="v">${esc(v)}</span></div>`).join('') || '<div class="tech-kv"><span class="v">—</span></div>'}
            </div>
            <div class="tech-panel">
              <div class="tp-title">TLS INFORMATION</div>
              ${tlsRows.map(([k, v]) => `<div class="tech-kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('')}
              <div class="tp-title" style="margin-top:14px">CONNECTION</div>
              <div class="tech-kv"><span class="k">IP address</span><span class="v hl">${esc(t.ip || '—')}</span></div>
              <div class="tech-kv"><span class="k">ASN</span><span class="v">${esc(t.asn ? ((t.asn.number || '') + (t.asn.name ? ' — ' + t.asn.name : '')) : '—')}</span></div>
              <div class="tech-kv"><span class="k">Server</span><span class="v">${esc(t.server || '—')}</span></div>
            </div>
            <div class="tech-panel">
              <div class="tp-title">DNS RECORDS</div>
              ${dnsRows.map(([k, v]) => `<div class="tech-kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('')}
              <div class="tp-title" style="margin-top:14px">REDIRECT CHAIN</div>
              ${(t.chain || []).map((c) => `<div class="tech-kv"><span class="k">${esc(String(c.status || '—'))}</span><span class="v">${esc(c.url)}</span></div>`).join('') || '<div class="tech-kv"><span class="v">—</span></div>'}
              <div class="tp-title" style="margin-top:14px">RESPONSE</div>
              <div class="tech-kv"><span class="k">Status</span><span class="v hl">${esc(String(t.status || '—'))}</span></div>
              <div class="tech-kv"><span class="k">Time</span><span class="v">${t.timingMs != null ? esc(String(t.timingMs)) + ' ms' : '—'}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

/* result animations */
function animateResult() {
  const ring = $('#ring-value');
  const counter = $('[data-count]');
  if (!ring || !counter) return;

  const score = parseInt(counter.dataset.count, 10) || 0;
  if (isReducedMotion()) {
    ring.style.strokeDashoffset = RING_C * (1 - score / 100);
    counter.textContent = score;
    $$('[data-bar]').forEach((el) => { el.style.width = el.dataset.bar + '%'; });
    return;
  }
  requestAnimationFrame(() => {
    ring.style.strokeDashoffset = RING_C * (1 - score / 100);
  });
  const t0 = performance.now();
  const dur = 1250;
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    counter.textContent = Math.round(eased * score);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---- history view ---- */
function viewHistory() {
  const { q, risk, sort } = App.historyUI;
  let rows = App.records.slice();
  if (q) rows = rows.filter((r) => r.host.includes(q.toLowerCase()) || r.url.toLowerCase().includes(q.toLowerCase()));
  if (risk !== 'all') rows = rows.filter((r) => r.risk === risk);
  if (sort === 'new') rows.sort((a, b) => b.timestamp - a.timestamp);
  else if (sort === 'old') rows.sort((a, b) => a.timestamp - b.timestamp);
  else if (sort === 'score-desc') rows.sort((a, b) => b.score - a.score);
  else if (sort === 'score-asc') rows.sort((a, b) => a.score - b.score);

  return `
  <div class="history-toolbar">
    <div class="input" style="display:flex;align-items:center;gap:8px;padding:0">
      <span style="padding-left:12px;display:flex;color:var(--text-3)">${I.search}</span>
      <input data-role="h-search" type="text" placeholder="Search website or URL…" value="${esc(q)}"
             style="flex:1;background:none;border:none;outline:none;color:inherit;font:inherit;padding:9.5px 12px 9.5px 4px">
    </div>
    <select class="select" data-role="h-risk">
      <option value="all" ${risk === 'all' ? 'selected' : ''}>All risk levels</option>
      <option value="low" ${risk === 'low' ? 'selected' : ''}>Low risk</option>
      <option value="medium" ${risk === 'medium' ? 'selected' : ''}>Medium risk</option>
      <option value="high" ${risk === 'high' ? 'selected' : ''}>High risk</option>
    </select>
    <select class="select" data-role="h-sort">
      <option value="new" ${sort === 'new' ? 'selected' : ''}>Newest first</option>
      <option value="old" ${sort === 'old' ? 'selected' : ''}>Oldest first</option>
      <option value="score-desc" ${sort === 'score-desc' ? 'selected' : ''}>Highest score</option>
      <option value="score-asc" ${sort === 'score-asc' ? 'selected' : ''}>Lowest score</option>
    </select>
    <span class="count">${rows.length} of ${App.records.length} scans</span>
  </div>
  ${rows.length ? `
  <div class="table-wrap">
    <table class="table">
      <thead><tr>
        <th>Website</th><th>Score</th><th>Risk</th><th>Date</th><th style="text-align:right">Actions</th>
      </tr></thead>
      <tbody>
        ${rows.map((r) => `
        <tr data-action="view" data-id="${esc(r.id)}">
          <td><div class="td-host">
            <span class="avatar">${esc((r.host || '?').slice(0, 1))}</span>
            <span>
              <div class="h">${esc(r.host)} ${r.demo ? '<span class="chip chip-demo">sample</span>' : ''}</div>
              <div class="u">${esc(r.url)}</div>
            </span>
          </div></td>
          <td><span class="td-score" style="color:${scoreColor(r.score)}">${r.score}/100</span></td>
          <td><span class="td-risk" style="color:${RISK_META[r.risk].color}">${riskLabel(r.risk)}</span></td>
          <td><span class="td-date">${timeAgo(r.timestamp)}</span></td>
          <td>
            <div class="td-actions">
              <button class="row-btn" data-action="view" data-id="${esc(r.id)}" title="Open result">${I.eye}</button>
              <button class="row-btn" data-action="open-report" data-id="${esc(r.id)}" title="Open report">${I.file}</button>
              <button class="row-btn danger" data-action="delete" data-id="${esc(r.id)}" title="Delete scan">${I.trash}</button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : `
  <div class="card"><div class="empty">
    ${I.clock}
    <div class="e-title">${App.records.length ? 'No scans match your filters' : 'No scans yet'}</div>
    <p>${App.records.length ? 'Try clearing the search or filters.' : 'Analyze a website to build your scan history.'}
    </p>
    ${App.records.length ? '' : '<button class="btn btn-primary btn-sm" data-nav="scan">Scan a website</button>'}
  </div></div>`}`;
}

/* ---- reports view ---- */
function viewReports() {
  const records = App.records.slice().sort((a, b) => b.timestamp - a.timestamp);
  if (!records.length) {
    return `<div class="card"><div class="empty">${I.file}
      <div class="e-title">No reports available</div>
      <p>Reports are generated from completed scans. Run a scan to create one.</p>
      <button class="btn btn-primary btn-sm" data-nav="scan">Scan a website</button></div></div>`;
  }
  const current = records.find((r) => r.id === App.viewParam) || App.current && records.find((r) => r.id === App.current.id) || records[0];

  return `
  <div class="report-toolbar">
    <select class="select" data-role="report-select">
      ${records.map((r) => `<option value="${esc(r.id)}" ${r.id === current.id ? 'selected' : ''}>${esc(r.host)} — ${r.score}/100 — ${timeAgo(r.timestamp)}</option>`).join('')}
    </select>
    <span class="spacer"></span>
    <button class="btn btn-ghost btn-sm" data-action="view" data-id="${esc(current.id)}">${I.eye} Open in scanner</button>
    <button class="btn btn-primary btn-sm" data-action="export-pdf" data-id="${esc(current.id)}">${I.download} Export PDF Report</button>
  </div>
  <article class="report fade-up">${reportBodyHTML(current)}</article>`;
}

function reportBodyHTML(r) {
  const meta = RISK_META[r.risk];
  const issues = r.findings.filter((f) => f.severity !== 'pass' && f.severity !== 'info');
  const recommendations = r.findings.filter((f) => f.severity !== 'pass' && f.severity !== 'info' && f.recommendation);
  return `
    <div class="print-banner" style="border:1px solid var(--line);border-radius:12px;padding:16px 18px;">
      <div style="font-family:var(--font-display);font-weight:700;font-size:16px;">TrustScan — Website Trust &amp; Security Report</div>
      <div style="color:var(--text-3);font-size:11.5px;margin-top:3px;">Generated ${fmtFullDate(Date.now())} by TrustScan v1.0.0</div>
    </div>
    <div class="rep-head">
      <div class="rh-left">
        <div class="rep-kicker">WEBSITE SECURITY REPORT</div>
        <h2>${esc(r.host)}</h2>
        <div class="rep-url">${esc(r.url)}</div>
      </div>
      <div class="rep-mark">
        <img src="../assets/icons/icon128.png" alt=""> TrustScan
      </div>
    </div>
    <div class="rep-meta">
      <div class="m"><div class="k">Overall score</div><div class="v" style="color:${scoreColor(r.score)}">${r.score}<small>/100</small></div></div>
      <div class="m"><div class="k">Risk level</div><div class="v" style="color:${meta.color}">${meta.label}</div></div>
      <div class="m"><div class="k">Findings</div><div class="v">${issues.length}</div></div>
      <div class="m"><div class="k">Scan date</div><div class="v" style="font-size:13.5px;line-height:1.7">${fmtFullDate(r.timestamp)}</div></div>
    </div>

    <div class="rep-section">
      <h3>Category scores</h3>
      ${r.categories.map((c) => `
        <div class="rep-cat" style="color:${scoreColor(c.score)}">
          <span class="n">${esc(c.label)}</span>
          <span class="bar"><i style="width:${c.score}%"></i></span>
          <span class="s">${c.score}/100</span>
        </div>`).join('')}
    </div>

    <div class="rep-section">
      <h3>Findings</h3>
      <div class="rep-findings">
        ${r.findings.map((f) => `
          <div class="rep-finding">
            <span class="f-icon f-sev-${f.severity}" style="width:24px;height:24px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:7px;border:1px solid var(--line-2);color:${f.severity === 'pass' ? 'var(--green)' : f.severity === 'critical' || f.severity === 'high' ? 'var(--red)' : f.severity === 'medium' ? 'var(--amber)' : f.severity === 'low' ? 'var(--blue)' : 'var(--text-3)'}">${SEVERITY_META[f.severity].icon}</span>
            <div>
              <div class="rf-title">${esc(f.title)}</div>
              <div class="rf-exp">${esc(f.explanation)}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    ${recommendations.length ? `
    <div class="rep-section">
      <h3>Recommendations</h3>
      <div class="rep-findings">
        ${recommendations.map((f) => `
          <div class="rep-finding">
            <span style="color:var(--accent);flex:none;padding-top:1px">${I.arrowR}</span>
            <div><div class="rf-exp" style="color:var(--text-2)"><b style="color:var(--text)">${esc(f.title)}.</b> ${esc(f.recommendation)}</div></div>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <div class="rep-disclaimer">
      This report reflects technical indicators observed at the time of the scan (${fmtFullDate(r.timestamp)}). It is an analysis of publicly
      visible configuration and reputation signals — not a guarantee of website safety. Website operators may change configurations at any time.
    </div>`;
}

/* ---- settings view ---- */
function viewSettings() {
  const s = App.settings;
  const isExt = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

  return `
  <div class="settings-grid">
    <section class="card set-card">
      <h3>Analysis</h3>
      <p class="sc-sub">How websites are inspected when you run a scan.</p>
      <div class="set-row">
        <div class="sr-info">
          <div class="sr-title">Live network checks</div>
          <div class="sr-desc">Query the site directly, DNS-over-HTTPS, RDAP and certificate transparency. When off, all results are simulated.</div>
        </div>
        <div class="sr-ctrl"><label class="toggle"><input type="checkbox" data-setting="liveChecks" ${s.liveChecks ? 'checked' : ''}><span class="track"></span></label></div>
      </div>
      <div class="set-row">
        <div class="sr-info">
          <div class="sr-title">DNS-over-HTTPS provider</div>
          <div class="sr-desc">Resolver used for A, AAAA, MX, NS and DNSSEC lookups.</div>
        </div>
        <div class="sr-ctrl">
          <select class="select" data-setting="dohProvider">
            <option value="cloudflare" ${s.dohProvider !== 'google' ? 'selected' : ''}>Cloudflare</option>
            <option value="google" ${s.dohProvider === 'google' ? 'selected' : ''}>Google</option>
          </select>
        </div>
      </div>
      <div class="set-row">
        <div class="sr-info">
          <div class="sr-title">Certificate transparency lookup</div>
          <div class="sr-desc">Fetch certificate issuer and validity dates from crt.sh logs.</div>
        </div>
        <div class="sr-ctrl"><label class="toggle"><input type="checkbox" data-setting="ctLookup" ${s.ctLookup ? 'checked' : ''}><span class="track"></span></label></div>
      </div>
      <div class="set-row">
        <div class="sr-info">
          <div class="sr-title">Domain registration lookup</div>
          <div class="sr-desc">Fetch registrar, registration and expiration dates via RDAP.</div>
        </div>
        <div class="sr-ctrl"><label class="toggle"><input type="checkbox" data-setting="rdapLookup" ${s.rdapLookup ? 'checked' : ''}><span class="track"></span></label></div>
      </div>
      <div class="set-row">
        <div class="sr-info">
          <div class="sr-title">Google Safe Browsing API key</div>
          <div class="sr-desc">Optional. Enables live phishing / malware checks against Google's threat feed.</div>
        </div>
        <div class="sr-ctrl">
          <input class="input" type="password" data-setting="safeBrowsingKey" placeholder="API key (optional)"
                 value="${esc(s.safeBrowsingKey)}">
        </div>
      </div>
    </section>

    <section class="card set-card">
      <h3>Data</h3>
      <p class="sc-sub">Scan history is stored locally on this device${isExt ? ' (chrome.storage.local)' : ''}.</p>
      <div class="set-row">
        <div class="sr-info">
          <div class="sr-title">History retention</div>
          <div class="sr-desc">Automatically remove scans older than the selected window.</div>
        </div>
        <div class="sr-ctrl">
          <select class="select" data-setting="retention">
            <option value="all" ${s.retention === 'all' ? 'selected' : ''}>Keep all</option>
            <option value="90d" ${s.retention === '90d' ? 'selected' : ''}>90 days</option>
            <option value="30d" ${s.retention === '30d' ? 'selected' : ''}>30 days</option>
            <option value="10" ${s.retention === '10' ? 'selected' : ''}>Last 10 scans</option>
          </select>
        </div>
      </div>
      <div class="set-row">
        <div class="sr-info">
          <div class="sr-title">Interface</div>
          <div class="sr-desc">Reduce motion disables score counters and transitions.</div>
        </div>
        <div class="sr-ctrl"><label class="toggle"><input type="checkbox" data-setting="reduceMotion" ${s.reduceMotion ? 'checked' : ''}><span class="track"></span></label></div>
      </div>
      <div class="set-row">
        <div class="sr-info">
          <div class="sr-title">Clear all scan data</div>
          <div class="sr-desc">Delete every stored scan and report from this device.</div>
        </div>
        <div class="sr-ctrl"><button class="btn btn-danger btn-sm" data-action="clear-data">Clear data</button></div>
      </div>
    </section>

    <section class="card set-card">
      <h3>About</h3>
      <p class="sc-sub">TrustScan v1.0.0 — Website Trust &amp; Security Analyzer.</p>
      <div class="about-list">
        <div class="kv"><span>Scans performed</span><span>${App.records.length}</span></div>
        <div class="kv"><span>Storage</span><span>${isExt ? 'chrome.storage.local' : 'localStorage'}</span></div>
        <div class="kv"><span>Permissions</span><span>Storage, tabs, context menu, all hosts</span></div>
      </div>
      <p class="sr-desc" style="margin-top:14px;line-height:1.6">
        Host permissions let TrustScan fetch the analyzed site's headers and DNS directly from your browser.
        Nothing is uploaded anywhere — all analysis runs locally in the dashboard.
      </p>
      <p class="sr-desc" style="margin-top:10px;line-height:1.6">
        TrustScan is an indicator-analysis tool. It does not certify that any website is safe.
        See the project DISCLAIMER.md for full terms.
      </p>
    </section>
  </div>`;
}

/* ------------------------------------------------------------ scan flow */
async function startScan(rawUrl) {
  if (App.scanning) return;
  const nu = TrustEngine.normUrl(rawUrl);
  if (!nu.valid) {
    showToast(nu.error, 'error');
    return;
  }
  App.scanning = true;
  App.scanTarget = nu.url;
  App.current = null;
  route('scan');
  const t0 = Date.now();

  let report;
  try {
    report = await TrustEngine.analyze(nu.url, App.settings, (step) => {
      updateScanStep(step.index, step.ms);
    });
  } catch (e) {
    App.scanning = false;
    showToast((e && e.message) || 'Analysis failed unexpectedly.', 'error');
    render();
    return;
  }

  // replace or insert into history
  const existing = App.records.findIndex((r) => r.host === report.host);
  if (existing !== -1) App.records.splice(existing, 1);
  App.records.unshift(report);
  await Store.set('trustscan_history', App.records);

  App.current = report;
  App.scanning = false;
  render();
  const meta = RISK_META[report.risk];
  showToast('Analysis complete — ' + report.host + ' scored ' + report.score + '/100 (' + meta.label.toLowerCase() + ').', 'success');
}

/* ------------------------------------------------------------ link check flow */
async function startLinkCheck(rawUrl) {
  if (App.linkChecking) return;
  const nu = TrustEngine.normUrl(rawUrl);
  if (!nu.valid) {
    showToast(nu.error, 'error');
    return;
  }
  App.linkChecking = true;
  App.linkTarget = nu.url;
  App.linkResult = null;
  route('linkcheck');

  let result;
  try {
    result = await TrustEngine.checkLink(nu.url, App.settings, (step) => {
      updateLinkStep(step.index, step.ms);
    });
  } catch (e) {
    App.linkChecking = false;
    showToast((e && e.message) || 'Link check failed unexpectedly.', 'error');
    render();
    return;
  }

  App.linkResult = result;
  App.linkChecking = false;
  render();
  showToast('Link check complete — ' + result.verdictLabel.toLowerCase() + '.', result.verdict === 'safe' ? 'success' : result.verdict === 'risky' || result.verdict === 'download-risky' ? 'error' : 'warn');
}

/* ------------------------------------------------------------- actions */
async function deleteRecord(id) {
  const idx = App.records.findIndex((r) => r.id === id);
  if (idx === -1) return;
  const removed = App.records[idx];
  App.records.splice(idx, 1);
  await Store.set('trustscan_history', App.records);
  if (App.current && App.current.id === id) App.current = null;
  if (App.viewParam === id) App.viewParam = null;
  render();
  showToast('Scan for ' + removed.host + ' removed.', 'info', {
    action: 'Undo',
    onAction: async () => {
      App.records.splice(Math.min(idx, App.records.length), 0, removed);
      await Store.set('trustscan_history', App.records);
      render();
      showToast('Scan restored.', 'success');
    },
    duration: 7000
  });
}

async function saveSettings(patch) {
  Object.assign(App.settings, patch);
  await Store.set('trustscan_settings', App.settings);
  document.body.classList.toggle('reduce-motion', !!App.settings.reduceMotion);
  applyRetention();
}

function applyRetention() {
  const mode = App.settings.retention;
  if (mode === 'all') return;
  const before = App.records.length;
  if (mode === '90d' || mode === '30d') {
    const cutoff = Date.now() - (mode === '90d' ? 90 : 30) * 86400000;
    App.records = App.records.filter((r) => r.timestamp >= cutoff || r.demo);
  } else if (mode === '10') {
    App.records = App.records.slice(0, Math.min(10, App.records.length));
  }
  if (App.records.length !== before) Store.set('trustscan_history', App.records);
}

async function handleAction(data, el) {
  if (data.action === 'new') { App.current = null; route('scan'); return; }
  if (data.action === 'rescan') { startScan(data.url); return; }
  if (data.action === 'view') {
    const r = App.records.find((x) => x.id === data.id);
    if (!r) return;
    App.current = r;
    route('scan');
    return;
  }
  if (data.action === 'open-report') {
    route('reports', data.id);
    return;
  }
  if (data.action === 'export-pdf') {
    if (App.view !== 'reports' || !App.viewParam || App.viewParam !== data.id) {
      route('reports', data.id);
    }
    showToast('Opening the print dialog — choose “Save as PDF” to export the report.', 'info');
    setTimeout(() => window.print(), 420);
    return;
  }
  if (data.action === 'delete') {
    deleteRecord(data.id);
    return;
  }
  if (data.action === 'scan-tab') {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && /^https?:/i.test(tab.url)) { startScan(tab.url); return; }
        showToast('The active tab is not an analyzable http(s) page.', 'warn');
      } catch (e) { showToast('Could not read the active tab.', 'error'); }
    } else {
      showToast('Tab access is only available inside the extension dashboard.', 'warn');
    }
    return;
  }
  if (data.action === 'clear-data') {
    if (el.dataset.confirm !== '1') {
      el.dataset.confirm = '1';
      el.textContent = 'Click again to confirm';
      setTimeout(() => { el.dataset.confirm = ''; el.textContent = 'Clear data'; }, 3200);
      return;
    }
    App.records = [];
    App.current = null;
    await Store.set('trustscan_history', App.records);
    el.dataset.confirm = '';
    el.textContent = 'Clear data';
    render();
    showToast('All scan data cleared.', 'success');
    return;
  }
  if (data.action === 'new-link') { App.linkResult = null; route('linkcheck'); return; }
  if (data.action === 'scan-final') { startScan(data.url); return; }
  if (data.action === 'copy-final') {
    try {
      await navigator.clipboard.writeText(data.url);
      showToast('Final URL copied to clipboard.', 'success');
    } catch (e) {
      showToast('Could not copy — please copy manually.', 'warn');
    }
    return;
  }
}

/* ----------------------------------------------------------------- events */
document.addEventListener('click', (ev) => {
  const nav = ev.target.closest('[data-nav]');
  if (nav) { route(nav.dataset.nav); return; }

  const tog = ev.target.closest('[data-toggle]');
  if (tog) {
    const acc = tog.closest('[data-accordion]');
    if (acc) acc.classList.toggle('open');
    return;
  }

  const del = ev.target.closest('[data-action="delete"]');
  if (del) { ev.stopPropagation(); handleAction(del.dataset, del); return; }

  const act = ev.target.closest('[data-action]');
  if (act) { handleAction(act.dataset, act); return; }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('[data-scanform]');
  if (form) {
    ev.preventDefault();
    const input = form.querySelector('[data-scan-input]');
    if (input) startScan(input.value);
    return;
  }
  const linkForm = ev.target.closest('[data-linkform]');
  if (linkForm) {
    ev.preventDefault();
    const input = linkForm.querySelector('[data-link-input]');
    if (input) startLinkCheck(input.value);
    return;
  }
});

document.addEventListener('input', (ev) => {
  const role = ev.target.dataset ? ev.target.dataset.role : '';
  if (role === 'h-search') {
    App.historyUI.q = ev.target.value.trim();
    const pos = ev.target.selectionStart;
    render();
    const inp = $('[data-role="h-search"]');
    if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
  }
});

document.addEventListener('change', (ev) => {
  const role = ev.target.dataset ? ev.target.dataset.role : '';
  const setting = ev.target.dataset ? ev.target.dataset.setting : '';

  if (role === 'h-risk') { App.historyUI.risk = ev.target.value; render(); return; }
  if (role === 'h-sort') { App.historyUI.sort = ev.target.value; render(); return; }
  if (role === 'report-select') { route('reports', ev.target.value); return; }

  if (setting) {
    let value = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    saveSettings({ [setting]: value }).then(() => showToast('Settings saved.', 'success'));
  }
});

$('#btn-new-scan').addEventListener('click', () => {
  App.current = null;
  route('scan');
});

window.addEventListener('keydown', (ev) => {
  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'k') {
    ev.preventDefault();
    route('scan');
  }
});

/* ------------------------------------------------------------------- boot */
(async function boot() {
  const settings = await Store.get('trustscan_settings', null);
  if (settings) Object.assign(App.settings, settings);
  document.body.classList.toggle('reduce-motion', !!App.settings.reduceMotion);

  let records = await Store.get('trustscan_history', null);
  if (!records || !records.length) {
    records = buildDemoRecords();
    await Store.set('trustscan_history', records);
  }
  App.records = records.sort((a, b) => b.timestamp - a.timestamp);
  applyRetention();

  const params = new URLSearchParams(location.search);
  const pendingUrl = params.get('url');
  const openReport = params.get('view') === 'reports' ? params.get('id') : null;
  if (pendingUrl || openReport) {
    history.replaceState(null, '', location.pathname);
  }

  render();

  if (pendingUrl) startScan(decodeURIComponent(pendingUrl));
  else if (openReport) {
    const rec = App.records.find((r) => r.id === openReport);
    if (rec) { App.current = rec; route('reports', rec.id); }
    else showToast('That report is no longer stored.', 'warn');
  }
})();
