'use strict';

/* ============================================================================
   TrustScan analysis engine
   ----------------------------------------------------------------------------
   Performs live checks when possible:
     - HTTPS reachability + response headers (browser-validated certificate)
     - Redirect chain reconstruction (manual redirect following)
     - DNS records via DNS-over-HTTPS (Cloudflare / Google)
     - Domain registration via RDAP
     - Certificate issuer / validity via crt.sh (certificate transparency)
     - Optional Google Safe Browsing threat lookups
   When live checks are unavailable (offline, reserved TLD, or disabled in
   settings) it falls back to a deterministic simulated dataset so the UI
   stays fully usable. The engine is DOM-free and unit-testable in Node.
   ========================================================================== */

const TrustEngine = (() => {

  /* ------------------------------------------------------------- utilities */
  const DAY = 86400000;

  const hash32 = (str) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  const mulberry32 = (seed) => {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const RESERVED_TLDS = ['example', 'test', 'invalid', 'localhost', 'local', 'internal'];

  /* Common multi-part public suffixes (approximation of the full PSL). */
  const MULTI_TLDS = new Set([
    'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'net.uk', 'sch.uk', 'me.uk',
    'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'id.au', 'asn.au',
    'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp', 'ad.jp', 'ed.jp', 'gr.jp',
    'co.nz', 'net.nz', 'org.nz', 'govt.nz', 'ac.nz', 'school.nz', 'geek.nz',
    'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br', 'blog.br', 'wiki.br',
    'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'ac.cn',
    'com.mx', 'org.mx', 'net.mx', 'edu.mx', 'gob.mx',
    'co.in', 'net.in', 'org.in', 'firm.in', 'gen.in', 'ind.in', 'ac.in', 'edu.in', 'res.in', 'gov.in', 'mil.in',
    'co.za', 'org.za', 'net.za', 'web.za', 'gov.za', 'ac.za',
    'com.ar', 'net.ar', 'org.ar', 'gov.ar', 'edu.ar',
    'com.co', 'net.co', 'org.co', 'gov.co', 'edu.co', 'nom.co',
    'com.tw', 'org.tw', 'net.tw', 'edu.tw', 'gov.tw', 'idv.tw', 'com.hk', 'org.hk', 'net.hk', 'edu.hk', 'gov.hk', 'idv.hk',
    'com.sg', 'net.sg', 'org.sg', 'edu.sg', 'gov.sg', 'per.sg',
    'com.my', 'net.my', 'org.my', 'edu.my', 'gov.my', 'mil.my',
    'co.kr', 'or.kr', 'ne.kr', 're.kr', 'pe.kr', 'go.kr', 'mil.kr', 'ac.kr',
    'co.il', 'org.il', 'net.il', 'ac.il', 'gov.il', 'muni.il', 'idf.il',
    'com.tr', 'net.tr', 'org.tr', 'gov.tr', 'edu.tr', 'web.tr', 'av.tr', 'dr.tr',
    'com.ua', 'net.ua', 'org.ua', 'gov.ua', 'edu.ua', 'in.ua', 'kiev.ua',
    'com.ru', 'net.ru', 'org.ru', 'pp.ru', 'com.pl', 'net.pl', 'org.pl', 'edu.pl', 'gov.pl', 'info.pl', 'waw.pl',
    'com.pt', 'edu.pt', 'gov.pt', 'net.pt', 'org.pt', 'com.gr', 'edu.gr', 'net.gr', 'org.gr', 'gov.gr',
    'com.es', 'nom.es', 'org.es', 'gob.es', 'edu.es', 'com.se', 'org.se', 'pp.se', 'tm.se',
    'co.th', 'or.th', 'in.th', 'ac.th', 'go.th', 'net.th', 'com.vn', 'net.vn', 'org.vn', 'edu.vn', 'gov.vn',
    'com.ph', 'net.ph', 'org.ph', 'edu.ph', 'gov.ph', 'com.pk', 'net.pk', 'org.pk', 'edu.pk', 'gov.pk',
    'com.eg', 'net.eg', 'org.eg', 'edu.eg', 'gov.eg', 'com.sa', 'net.sa', 'org.sa', 'edu.sa', 'gov.sa',
    'com.ng', 'net.ng', 'org.ng', 'edu.ng', 'gov.ng', 'co.ke', 'or.ke', 'ne.ke', 'go.ke', 'ac.ke'
  ]);

  /* Derive the registrable domain (eTLD+1) from a hostname.
   * www.youtube.com → youtube.com · www.bbc.co.uk → bbc.co.uk */
  function registrableDomain(host) {
    const labels = host.split('.').filter(Boolean);
    if (labels.length <= 2) return labels.join('.');
    const last2 = labels.slice(-2).join('.');
    if (MULTI_TLDS.has(last2)) return labels.slice(-3).join('.');
    return last2;
  }
  const GOOD_HOSTS = [
    'google.com', 'github.com', 'cloudflare.com', 'mozilla.org', 'wikipedia.org',
    'apple.com', 'microsoft.com', 'amazon.com', 'stackoverflow.com', 'openai.com',
    'netflix.com', 'x.com', 'twitter.com', 'facebook.com', 'youtube.com', 'w3.org',
    'iana.org', 'reddit.com', 'linkedin.com', 'steampowered.com', 'steamcommunity.com',
    'valvesoftware.com', 'discord.com', 'twitch.tv', 'spotify.com', 'paypal.com',
    'stripe.com', 'shopify.com', 'wordpress.com', 'medium.com', 'npmjs.com',
    'vercel.com', 'heroku.com', 'digitalocean.com', 'aws.amazon.com', 'azure.com',
    'adobe.com', 'dropbox.com', 'slack.com', 'zoom.us', 'notion.so', 'figma.com',
    'canva.com', 'udemy.com', 'coursera.org', 'edx.org', 'bbc.com', 'cnn.com',
    'nytimes.com', 'theguardian.com', 'forbes.com', 'bloomberg.com', 'reuters.com'
  ];
  const SKETCHY_RE = /(suspicious|malware|phish|scam|fraud|lottery|paypa1|amaz0n|g00gle|-?bonus|-?prize|-?winner|-?free-?money|verify-?account|secure-?login|wallet-?connect-?app)/i;

  function normUrl(raw) {
    const input = String(raw || '').trim();
    if (!input) return { valid: false, error: 'Enter a website address to analyze.' };
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : 'https://' + input.replace(/^\/+/, '');
    let u;
    try { u = new URL(candidate); } catch { return { valid: false, error: 'That does not look like a valid website address.' }; }
    if (!/^https?:$/.test(u.protocol)) return { valid: false, error: 'Only http(s) addresses can be analyzed.' };
    const host = u.hostname.toLowerCase();
    if (!host || !host.includes('.') || /\s/.test(host)) return { valid: false, error: 'Enter a full domain, for example example.com' };
    u.hash = '';
    return { valid: true, url: u.href, host, scheme: u.protocol.replace(':', '') };
  }

  async function fetchT(url, opts = {}, ms = 9000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, Object.assign({ credentials: 'omit', cache: 'no-store' }, opts, { signal: ctrl.signal }));
    } finally { clearTimeout(timer); }
  }

  /* ---------------------------------------------------------- live modules */

  async function liveFetchPage(url) {
    const t0 = now();
    try {
      const res = await fetchT(url, { method: 'GET', redirect: 'follow' }, 12000);
      const headers = [];
      res.headers.forEach((v, k) => headers.push([k, v]));
      return {
        ok: true, status: res.status, headers,
        finalUrl: res.url, redirected: res.redirected,
        ms: Math.round(now() - t0)
      };
    } catch (e) {
      return {
        ok: false,
        error: (e && e.name === 'AbortError')
          ? 'The connection timed out.'
          : 'The connection failed (unreachable host or invalid TLS certificate).'
      };
    }
  }

  const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

  async function liveRedirectChain(url) {
    const chain = [];
    let current = url;
    for (let hops = 0; hops < 8; hops++) {
      let res;
      try {
        res = await fetchT(current, { method: 'GET', redirect: 'manual' }, 9000);
      } catch (e) {
        if (hops === 0) return { reachable: false, chain: [{ url: current, status: null, final: true, error: true }] };
        chain.push({ url: current, status: null, final: true, error: true });
        return { reachable: true, chain };
      }
      if (res.type === 'opaqueredirect' || res.status === 0) {
        // The browser hides intermediate hops — resolve the final target.
        try {
          const r2 = await fetchT(current, { method: 'GET', redirect: 'follow' }, 10000);
          chain.push({ url: current, status: null, final: false, opaque: true });
          chain.push({ url: r2.url, status: r2.status, final: true });
          return { reachable: true, chain, partial: true };
        } catch (e) {
          chain.push({ url: current, status: null, final: true, error: true });
          return { reachable: true, chain };
        }
      }
      const loc = res.headers.get('location');
      if (REDIRECT_STATUSES.includes(res.status) && loc) {
        let next;
        try { next = new URL(loc, current).href; } catch { next = null; }
        if (!next) { chain.push({ url: current, status: res.status, final: true }); return { reachable: true, chain }; }
        chain.push({ url: current, status: res.status, final: false });
        current = next;
        continue;
      }
      chain.push({ url: current, status: res.status, final: true });
      return { reachable: true, chain };
    }
    chain.push({ url: current, status: 310, final: true, loop: true });
    return { reachable: true, chain };
  }

  async function liveDohQuery(host, type, provider) {
    const url = provider === 'google'
      ? 'https://dns.google/resolve?name=' + encodeURIComponent(host) + '&type=' + type
      : 'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(host) + '&type=' + type;
    const opts = provider === 'google' ? {} : { headers: { accept: 'application/dns-json' } };
    const res = await fetchT(url, opts, 8000);
    if (!res.ok) throw new Error('DoH HTTP ' + res.status);
    return res.json();
  }

  async function liveDNS(host, rootDomain, provider) {
    // A/AAAA belong to the entered host; MX/NS only exist at the zone apex.
    const jobs = [
      { type: 'A', name: host },
      { type: 'AAAA', name: host },
      { type: 'MX', name: rootDomain },
      { type: 'NS', name: rootDomain }
    ];
    const results = await Promise.allSettled(jobs.map((j) => liveDohQuery(j.name, j.type, provider)));
    const out = { A: [], AAAA: [], MX: [], NS: [], dnssec: false, status: null };
    let anyOk = false, auth = false;
    results.forEach((r, i) => {
      if (r.status !== 'fulfilled' || !r.value) return;
      anyOk = true;
      const j = r.value;
      if (j.AD) auth = true;
      if (i === 0) out.status = j.Status;
      (Array.isArray(j.Answer) ? j.Answer : []).forEach((a) => {
        if (jobs[i].type === 'A' && a.type === 1) out.A.push(a.data);
        else if (jobs[i].type === 'AAAA' && a.type === 28) out.AAAA.push(a.data);
        else if (jobs[i].type === 'MX' && a.type === 15) {
          const parts = String(a.data).trim().split(/\s+/);
          const mxHost = (parts[1] || '').replace(/\.$/, '');
          if (mxHost && mxHost !== '.') out.MX.push({ priority: parts[0], host: mxHost });
        } else if (jobs[i].type === 'NS' && a.type === 2) {
          out.NS.push(String(a.data).replace(/\.$/, ''));
        }
      });
    });
    if (!anyOk) throw new Error('DNS lookups failed');
    out.dnssec = auth;
    return out;
  }

  let rdapBootstrapCache = null;

  async function rdapBootstrapServers(tld) {
    /* IANA's official registry of RDAP servers per TLD. Cached in memory. */
    if (!rdapBootstrapCache) {
      const res = await fetchT('https://data.iana.org/rdap/dns.json', {}, 10000);
      if (!res.ok) throw new Error('bootstrap HTTP ' + res.status);
      const j = await res.json();
      rdapBootstrapCache = Array.isArray(j.services) ? j.services : [];
    }
    const entry = rdapBootstrapCache.find((s) => Array.isArray(s[0]) && s[0].some((x) => String(x).toLowerCase() === tld));
    return entry && Array.isArray(entry[1]) ? entry[1] : [];
  }

  async function liveRDAP(rootDomain) {
    const tld = rootDomain.split('.').pop().toLowerCase();
    // Fast paths first (rdap.org works from browsers; verisign covers com/net).
    const endpoints = ['https://rdap.org/domain/' + encodeURIComponent(rootDomain)];
    if (tld === 'com' || tld === 'net') {
      endpoints.push('https://rdap.verisign.com/' + tld + '/v1/domain/' + encodeURIComponent(rootDomain));
    }
    const tryParse = async (endpoint) => {
      const res = await fetchT(endpoint, { headers: { accept: 'application/rdap+json' } }, 10000);
      if (!res.ok) throw new Error('RDAP HTTP ' + res.status);
      const j = await res.json();
      if (!j || typeof j !== 'object') throw new Error('RDAP response invalid');
      const out = { registrar: null, created: null, expires: null, nameservers: [] };
      (Array.isArray(j.events) ? j.events : []).forEach((e) => {
        if (e.eventAction === 'registration') out.created = e.eventDate;
        if (e.eventAction === 'expiration') out.expires = e.eventDate;
      });
      (Array.isArray(j.entities) ? j.entities : []).forEach((en) => {
        if (Array.isArray(en.roles) && en.roles.includes('registrar') && Array.isArray(en.vcardArray)) {
          en.vcardArray[1].forEach((f) => { if (f[0] === 'fn' && f[3]) out.registrar = f[3]; });
        }
      });
      (Array.isArray(j.nameservers) ? j.nameservers : []).forEach((ns) => {
        if (ns.ldhName) out.nameservers.push(String(ns.ldhName).toLowerCase());
      });
      if (!out.created && !out.registrar && !out.nameservers.length) throw new Error('RDAP data unavailable');
      return out;
    };

    let lastErr = null;
    for (const endpoint of endpoints) {
      try { return await tryParse(endpoint); } catch (e) { lastErr = e; }
    }
    // Registry-specific servers via the IANA bootstrap (e.g. .uk → Nominet).
    try {
      const servers = await rdapBootstrapServers(tld);
      for (const server of servers) {
        try {
          return await tryParse(server.replace(/\/+$/, '') + '/domain/' + encodeURIComponent(rootDomain));
        } catch (e) { lastErr = e; }
      }
    } catch (e) { lastErr = e; }
    throw lastErr || new Error('RDAP failed');
  }

  async function crtShQuery(q) {
    const res = await fetchT('https://crt.sh/?q=' + encodeURIComponent(q) + '&output=json', {}, 12000);
    if (!res.ok) throw new Error('crt.sh HTTP ' + res.status);
    const arr = await res.json();
    if (!Array.isArray(arr) || !arr.length) throw new Error('No CT entries');
    return arr;
  }

  function pickCurrentCert(arr, names) {
    /* CT logs contain expired and historical certificates. Only entries whose
     * validity window covers "now" are evidence of the deployed cert; pick
     * the one with the longest remaining validity (most likely the primary). */
    const now = Date.now();
    const has = (e, n) => String(e.name_value || '')
      .toLowerCase().split('\n').map((s) => s.trim()).includes(n);
    const current = (e) => {
      const nb = new Date(e.not_before).getTime();
      const na = new Date(e.not_after).getTime();
      return !isNaN(nb) && !isNaN(na) && nb <= now && na >= now;
    };
    for (const n of names) {
      const pool = arr.filter((e) => current(e) && has(e, n));
      if (pool.length) {
        pool.sort((a, b) => new Date(b.not_after) - new Date(a.not_after));
        return pool[0];
      }
    }
    return null;
  }

  async function liveCertificate(host, rootDomain) {
    let arr = await crtShQuery(host);
    let cert = pickCurrentCert(arr, [host]);
    if (!cert && rootDomain && rootDomain !== host) {
      try {
        arr = await crtShQuery(rootDomain);
        cert = pickCurrentCert(arr, [host, '*.' + rootDomain, rootDomain]);
      } catch (e) { /* fall through as unavailable */ }
    }
    if (!cert) throw new Error('No currently-valid certificate entry');
    const bits = String(cert.issuer_name || '').split(',').map((s) => s.trim());
    const o = (bits.find((s) => /^O=/i.test(s)) || '').replace(/^O=/i, '');
    const cn = (bits.find((s) => /^CN=/i.test(s)) || '').replace(/^CN=/i, '');
    return {
      issuer: [o, cn].filter(Boolean).join(' · ') || 'Unknown issuer',
      notBefore: cert.not_before,
      notAfter: cert.not_after
    };
  }

  async function liveSafeBrowsing(url, key) {
    const endpoint = 'https://safebrowsing.googleapis.com/v4/threatMatches:find?key=' + encodeURIComponent(key);
    const body = {
      client: { clientId: 'trustscan', clientVersion: '1.0.0' },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url }]
      }
    };
    const res = await fetchT(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }, 9000);
    if (!res.ok) throw new Error('Safe Browsing HTTP ' + res.status);
    const j = await res.json();
    return (j && Array.isArray(j.matches)) ? j.matches : [];
  }

  async function liveASN(ip) {
    try {
      const res = await fetchT('https://ipwho.is/' + encodeURIComponent(ip), {}, 7000);
      if (res.ok) {
        const j = await res.json();
        const c = j && j.connection;
        if (c && (c.asn || c.org || c.isp)) {
          return { number: c.asn ? 'AS' + String(c.asn) : '—', name: c.org || c.isp || '' };
        }
      }
    } catch (e) { /* try fallback */ }
    try {
      const res = await fetchT('http://ip-api.com/json/' + encodeURIComponent(ip) + '?fields=status,as,org,isp', {}, 7000);
      if (res.ok) {
        const j = await res.json();
        if (j && j.as) {
          return { number: String(j.as).startsWith('AS') ? String(j.as) : 'AS' + j.as, name: j.org || j.isp || '' };
        }
      }
    } catch (e) { /* give up */ }
    return null;
  }

  /* ------------------------------------------------------- simulated facts */
  const ISSUERS = [
    "Let's Encrypt · R11", 'Google Trust Services · WE1', 'DigiCert Inc · GeoTrust TLS RSA',
    'Sectigo Limited · Sectigo RSA', 'Amazon · Amazon RSA 2048', 'GoDaddy.com · GoDaddy RSA'
  ];
  const REGISTRARS = ['MarkMonitor Inc.', 'GoDaddy LLC', 'Cloudflare, Inc.', 'NameCheap Inc.', 'Gandi SAS', 'Tucows Domains Inc.'];
  const ASNS = ['Cloudflare, Inc.', 'Google LLC', 'Amazon.com, Inc.', 'Fastly, Inc.', 'Akamai Technologies', 'DigitalOcean, LLC'];

  function simFacts(host, rootDomain, url, scheme) {
    const rng = mulberry32(hash32(host));
    const forcedBad = SKETCHY_RE.test(rootDomain);
    const good = GOOD_HOSTS.includes(rootDomain) || (!forcedBad && rng() > 0.22);

    const httpsOk = forcedBad ? rng() > 0.45 : (good ? true : rng() > 0.3);
    const notAfter = Date.now() + Math.floor((httpsOk ? (18 + rng() * 70) : 4 + rng() * 10) * DAY);
    const notBefore = notAfter - Math.floor(60 * DAY);

    const excellent = GOOD_HOSTS.includes(rootDomain);
    let headers;
    if (forcedBad) {
      headers = {
        csp: null, hsts: null,
        xfo: rng() < 0.2 ? 'SAMEORIGIN' : null,
        xcto: rng() < 0.2 ? 'nosniff' : null,
        referrer: null, pp: null
      };
    } else if (excellent) {
      // Well-run sites correlate: hardened across the board.
      headers = {
        csp: "default-src 'self'; img-src 'self' data:; script-src 'self'",
        hsts: 'max-age=' + pick(rng, [15552000, 31536000, 63072000]),
        xfo: pick(rng, ['DENY', 'SAMEORIGIN']),
        xcto: 'nosniff',
        referrer: pick(rng, ['strict-origin-when-cross-origin', 'no-referrer', 'same-origin']),
        pp: rng() < 0.5 ? 'camera=(), microphone=(), geolocation=()' : null
      };
    } else if (good) {
      const full = rng() < 0.6;
      headers = {
        csp: full || rng() < 0.6 ? "default-src 'self'; img-src 'self' data:" : null,
        hsts: full || rng() < 0.8 ? 'max-age=' + pick(rng, [15552000, 31536000]) : null,
        xfo: full || rng() < 0.75 ? pick(rng, ['DENY', 'SAMEORIGIN']) : null,
        xcto: full || rng() < 0.85 ? 'nosniff' : null,
        referrer: full || rng() < 0.65 ? 'strict-origin-when-cross-origin' : null,
        pp: rng() < 0.35 ? 'camera=(), microphone=()' : null
      };
    } else {
      headers = {
        csp: rng() < 0.35 ? "default-src 'self' 'unsafe-inline'" : null,
        hsts: rng() < 0.45 ? 'max-age=' + pick(rng, [15552000, 31536000]) : null,
        xfo: rng() < 0.55 ? 'SAMEORIGIN' : null,
        xcto: rng() < 0.6 ? 'nosniff' : null,
        referrer: rng() < 0.4 ? 'strict-origin-when-cross-origin' : null,
        pp: rng() < 0.25 ? 'camera=(), microphone=()' : null
      };
    }

    const ip = [Math.floor(20 + rng() * 200), Math.floor(1 + rng() * 250), Math.floor(1 + rng() * 250), Math.floor(1 + rng() * 250)].join('.');
    const dns = {
      A: [ip].concat(rng() < 0.35 ? [[Math.floor(20 + rng() * 200), Math.floor(1 + rng() * 250), Math.floor(1 + rng() * 250), Math.floor(1 + rng() * 250)].join('.')] : []),
      AAAA: rng() < 0.6 ? ['2606:2800:' + Math.floor(rng() * 65535).toString(16) + ':220f:248:1899:' + Math.floor(rng() * 65535).toString(16) + ':1a2b'] : [],
      MX: (!forcedBad && rng() < 0.8) ? [{ priority: '10', host: 'mail.' + host }] : [],
      NS: forcedBad
        ? ['ns1.' + host, 'ns2.' + host]
        : pick(rng, [['ns1.' + host.split('.').slice(-2).join('.'), 'ns2.' + host.split('.').slice(-2).join('.')], ['dns1.registrar-servers.com', 'dns2.registrar-servers.com']]),
      dnssec: forcedBad ? false : (excellent ? true : rng() < (good ? 0.7 : 0.35)),
      status: 0
    };

    const ageDays = forcedBad ? Math.floor(8 + rng() * 80) : (excellent ? Math.floor(3650 + rng() * 5000) : (good ? Math.floor(730 + rng() * 6500) : Math.floor(40 + rng() * 900)));
    const domain = {
      ok: true,
      registrar: pick(rng, REGISTRARS),
      created: new Date(Date.now() - ageDays * DAY).toISOString(),
      expires: new Date(Date.now() + Math.floor((30 + rng() * 700)) * DAY).toISOString(),
      nameservers: dns.NS
    };

    const upgrade = forcedBad ? (rng() < 0.4 ? 'yes' : 'no') : (good ? 'yes' : (rng() < 0.6 ? 'yes' : 'no'));
    const chain = [];
    if (upgrade === 'yes') {
      chain.push({ url: 'http://' + host + '/', status: 301, final: false });
      if (rng() < 0.45) {
        chain.push({ url: 'https://' + host + '/', status: 301, final: false });
        chain.push({ url: 'https://www.' + host + '/', status: 200, final: true });
      } else {
        chain.push({ url: 'https://' + host + '/', status: 200, final: true });
      }
    } else {
      chain.push({ url: 'http://' + host + '/', status: 200, final: true });
    }

    const reputation = {
      matches: forcedBad
        ? [{ threatType: 'SOCIAL_ENGINEERING' }, { threatType: 'MALWARE' }]
        : []
    };

    return {
      https: { ok: httpsOk, error: httpsOk ? null : 'The connection failed (unreachable host or invalid TLS certificate).', source: 'sim' },
      cert: { issuer: pick(rng, ISSUERS), notBefore: new Date(notBefore).toISOString(), notAfter: new Date(notAfter).toISOString() },
      headers,
      dns,
      domain,
      redirects: { chain, upgrade, note: null },
      reputation,
      simBad: forcedBad
    };
  }

  /* ------------------------------------------------------- category builders */

  const daysUntil = (iso) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);

  function buildTLS(f) {
    const checks = [];
    const findings = [];
    const certDays = f.cert.notAfter ? daysUntil(f.cert.notAfter) : null;
    let score = 0;
    let explanation;

    if (!f.https.ok) {
      score = 0;
      explanation = 'HTTPS connection failed';
      checks.push({ label: 'HTTPS Enabled', value: 'No', status: 'fail' });
      checks.push({ label: 'Certificate Valid', value: 'Could not verify', status: 'fail' });
      checks.push({ label: 'TLS Version', value: '—', status: 'fail' });
      checks.push({ label: 'Certificate Issuer', value: '—', status: 'fail' });
      checks.push({ label: 'Expiration Date', value: '—', status: 'fail' });
      findings.push({
        severity: 'critical',
        title: 'HTTPS is unavailable or misconfigured',
        explanation: 'The website did not respond over a trusted HTTPS connection. Data sent to it would be unencrypted or unreadable.',
        details: f.https.error || 'The secure connection could not be established.',
        recommendation: 'Do not submit personal or payment information. Site operators should serve the site over HTTPS with a valid certificate from a trusted authority.'
      });
      return { id: 'tls', label: 'SSL / TLS', icon: 'lock', score, explanation, checks, findings };
    }

    score = 70;
    // The browser validated the chain (fetch succeeded over HTTPS), so the
    // certificate is trusted. CT data (issuer/expiry) is enrichment only.
    if (certDays === null) score += 20;
    else if (certDays > 30) score += 20;
    else if (certDays > 7) score += 10;
    else score -= 10;
    if (f.cert.issuer) score += 10;
    score = clamp(score, 0, 100);

    explanation = certDays !== null && certDays <= 30
      ? 'Valid HTTPS certificate expiring soon'
      : 'HTTPS enabled with a valid certificate';

    checks.push({ label: 'HTTPS Enabled', value: 'Yes', status: 'pass' });
    checks.push({ label: 'Certificate Valid', value: 'Trusted by the browser', status: 'pass' });
    checks.push({ label: 'TLS Version', value: f.https.protocol || 'TLS 1.2+ (enforced by browser)', status: 'pass', note: 'Modern browsers refuse connections below TLS 1.2.' });
    checks.push({ label: 'Certificate Issuer', value: f.cert.issuer || 'Not available', status: f.cert.issuer ? 'pass' : 'info', note: f.cert.issuer ? null : 'Certificate transparency lookup unavailable.' });
    checks.push({
      label: 'Expiration Date',
      value: f.cert.notAfter ? fmtDate(f.cert.notAfter) + ' (in ' + certDays + ' days)' : 'Not available',
      status: certDays === null ? 'info' : (certDays <= 30 ? 'warn' : 'pass')
    });

    findings.push({
      severity: 'pass',
      title: 'HTTPS is properly configured',
      explanation: 'The website uses encrypted HTTPS connections.',
      details: f.cert.issuer
        ? 'Certificate issued by ' + f.cert.issuer + ', valid until ' + fmtDate(f.cert.notAfter) + '. The certificate chain is trusted by the browser.'
        : 'The browser validated the certificate chain for this connection.',
      recommendation: 'Renew certificates before expiry and keep the TLS configuration current.'
    });

    if (certDays !== null && certDays <= 7) {
      findings.push({
        severity: 'medium',
        title: 'Certificate expires within ' + certDays + ' days',
        explanation: 'An expiring certificate will make browsers block access to the site.',
        details: 'Certificate validity ends ' + fmtDate(f.cert.notAfter) + '.',
        recommendation: 'Renew the certificate now and automate renewal to avoid outages.'
      });
    } else if (certDays !== null && certDays <= 30) {
      findings.push({
        severity: 'low',
        title: 'Certificate expires in ' + certDays + ' days',
        explanation: 'The current certificate will need renewal soon.',
        details: 'Certificate validity ends ' + fmtDate(f.cert.notAfter) + '.',
        recommendation: 'Schedule a renewal before the certificate expires.'
      });
    }
    if (!f.cert.issuer && f.tlsLive) {
      findings.push({
        severity: 'info',
        title: 'Certificate details unavailable',
        explanation: 'The connection is trusted, but issuer details could not be retrieved from certificate transparency logs.',
        details: 'The certificate-transparency lookup (crt.sh) did not respond in time.',
        recommendation: 'No action needed — the browser still validated the certificate chain.'
      });
    }
    return { id: 'tls', label: 'SSL / TLS', icon: 'lock', score, explanation, checks, findings };
  }

  function headerValue(h) { return h && h.value !== undefined ? h.value : h; }

  function buildHeaders(f) {
    const m = f.headers || {};
    const checks = [];
    const findings = [];

    if (!f.headersAvailable) {
      const na = { label: '', value: 'Unavailable — could not connect', status: 'info' };
      const rows = ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy'];
      rows.forEach((r) => checks.push({ label: r, value: 'Unavailable', status: 'info' }));
      return { id: 'headers', label: 'Security Headers', icon: 'shield', score: 0, explanation: 'Could not be analyzed (no response)', checks, findings };
    }

    const csp = m.csp || null;
    const cspStrict = !!(csp && !/unsafe-inline|unsafe-eval|\*\s*(https|src)/i.test(csp));
    const hsts = m.hsts || null;
    const xfo = m.xfo || null;
    const xcto = m.xcto || null;
    const referrer = m.referrer || null;
    const frameAncestors = !!(csp && /frame-ancestors/i.test(csp));
    const frameGuard = xfo || frameAncestors;

    let score = 0;
    score += csp ? (cspStrict ? 22 : 12) : 0;
    score += hsts ? 28 : 0;
    score += xfo ? 18 : (frameAncestors ? 15 : 0);
    score += xcto ? 12 : 0;
    score += referrer ? 20 : 0;

    // Well-known platforms get a reputation bonus: they are professionally
    // managed with dedicated security teams, so a missing optional header
    // should not disproportionately penalize them.
    const isWellKnown = GOOD_HOSTS.includes(f.rootDomain);
    const httpsOk = f.https && f.https.ok;
    let bonusNote = '';
    if (isWellKnown && httpsOk) {
      const bonus = 20;
      score = Math.min(100, score + bonus);
      bonusNote = ' · trusted platform';
    }

    const present = [csp, hsts, xfo || frameAncestors, xcto, referrer].filter(Boolean).length;
    const explanation = present + ' of 5 protective headers present' + bonusNote;

    checks.push({ label: 'Content-Security-Policy', value: csp || 'Missing', status: csp ? 'pass' : 'warn' });
    checks.push({ label: 'Strict-Transport-Security', value: hsts || 'Missing', status: hsts ? 'pass' : 'warn' });
    checks.push({ label: 'X-Frame-Options', value: xfo || (frameAncestors ? 'Covered by CSP frame-ancestors' : 'Missing'), status: frameGuard ? 'pass' : 'warn' });
    checks.push({ label: 'X-Content-Type-Options', value: xcto || 'Missing', status: xcto ? 'pass' : 'warn' });
    checks.push({ label: 'Referrer-Policy', value: referrer || 'Missing', status: referrer ? 'pass' : 'warn' });
    if (m.pp) checks.push({ label: 'Permissions-Policy', value: m.pp, status: 'info' });

    if (!csp) {
      findings.push({
        severity: 'medium',
        title: 'Content Security Policy is missing',
        explanation: 'A CSP can reduce the risk of certain browser-based attacks, such as cross-site scripting and data injection.',
        details: 'No Content-Security-Policy header was present in the response.',
        recommendation: "Add a Content-Security-Policy header such as \"default-src 'self'\" and tighten directives over time."
      });
    } else if (!cspStrict) {
      findings.push({
        severity: 'low',
        title: 'Content Security Policy is permissive',
        explanation: 'The policy includes directives (e.g. unsafe-inline or wildcards) that weaken its protection.',
        details: 'Content-Security-Policy: ' + csp,
        recommendation: 'Replace unsafe-inline with nonces or hashes and remove wildcard sources where possible.'
      });
    } else {
      findings.push({
        severity: 'pass',
        title: 'Content Security Policy is enforced',
        explanation: 'The website restricts which resources the page may load, limiting browser-based attack techniques.',
        details: 'Content-Security-Policy: ' + csp,
        recommendation: 'Keep the policy under review as the site evolves.'
      });
    }

    if (hsts) {
      findings.push({
        severity: 'pass',
        title: 'HSTS is enabled',
        explanation: 'The website instructs browsers to use HTTPS.',
        details: 'Strict-Transport-Security: ' + hsts,
        recommendation: 'Consider adding includeSubDomains and submitting the domain to the HSTS preload list.'
      });
    } else {
      findings.push({
        severity: 'medium',
        title: 'HSTS is missing',
        explanation: 'Browsers may initially connect over plain HTTP, which can be intercepted.',
        details: 'No Strict-Transport-Security header was present in the response.',
        recommendation: 'Add "Strict-Transport-Security: max-age=31536000" to all HTTPS responses.'
      });
    }

    if (frameGuard) {
      findings.push({
        severity: 'pass',
        title: 'Clickjacking protection is enabled',
        explanation: 'The site cannot be framed by other origins, preventing clickjacking attempts.',
        details: xfo ? 'X-Frame-Options: ' + xfo : 'CSP frame-ancestors restricts framing.',
        recommendation: 'Keep framing restrictions in place.'
      });
    } else {
      findings.push({
        severity: 'medium',
        title: 'Clickjacking protection is missing',
        explanation: 'Without X-Frame-Options or a CSP frame-ancestors directive, other sites may embed this page.',
        details: 'Neither X-Frame-Options nor CSP frame-ancestors was present.',
        recommendation: 'Add "X-Frame-Options: DENY" or a frame-ancestors directive to the CSP.'
      });
    }

    if (xcto) {
      findings.push({
        severity: 'pass',
        title: 'MIME-type sniffing is disabled',
        explanation: 'X-Content-Type-Options: nosniff prevents browsers from re-interpreting file contents.',
        details: 'X-Content-Type-Options: ' + xcto,
        recommendation: 'No action needed.'
      });
    } else {
      findings.push({
        severity: 'low',
        title: 'X-Content-Type-Options is missing',
        explanation: 'Browsers may sniff and misinterpret content types on some responses.',
        details: 'No X-Content-Type-Options header was present in the response.',
        recommendation: 'Add "X-Content-Type-Options: nosniff".'
      });
    }

    if (referrer) {
      findings.push({
        severity: 'pass',
        title: 'Referrer-Policy is set',
        explanation: 'The site controls how much URL information leaks to other origins.',
        details: 'Referrer-Policy: ' + referrer,
        recommendation: 'No action needed.'
      });
    } else {
      findings.push({
        severity: 'low',
        title: 'Referrer-Policy is missing',
        explanation: 'Full URLs may leak to third-party sites when visitors follow links.',
        details: 'No Referrer-Policy header was present in the response.',
        recommendation: 'Add "Referrer-Policy: strict-origin-when-cross-origin".'
      });
    }

    return { id: 'headers', label: 'Security Headers', icon: 'shield', score, explanation, checks, findings };
  }

  function buildDNS(f) {
    const d = f.dns;
    const checks = [];
    const findings = [];

    if (f.dnsFailed) {
      checks.push({ label: 'A Record', value: 'Lookup failed', status: 'fail' });
      checks.push({ label: 'AAAA Record', value: 'Lookup failed', status: 'fail' });
      checks.push({ label: 'MX Record', value: 'Lookup failed', status: 'fail' });
      checks.push({ label: 'NS Record', value: 'Lookup failed', status: 'fail' });
      checks.push({ label: 'DNSSEC', value: 'Lookup failed', status: 'fail' });
      findings.push({
        severity: 'high',
        title: 'DNS could not be resolved',
        explanation: 'DNS lookups for this domain failed, or the domain does not exist.',
        details: 'The resolver returned no usable records.',
        recommendation: 'Verify the domain name is spelled correctly and that DNS is configured.'
      });
      return { id: 'dns', label: 'DNS', icon: 'network', score: 0, explanation: 'DNS lookup failed', checks, findings };
    }

    let score = 0;
    score += d.A.length ? 30 : 0;
    score += d.AAAA.length ? 15 : 0;
    score += d.MX.length ? 20 : 10;
    score += d.NS.length ? 15 : 0;
    score += d.dnssec ? 20 : 0;
    score = clamp(score, 0, 100);

    const explanation = d.A.length
      ? (d.dnssec ? 'Records resolved · DNSSEC signed' : 'Records resolved · no DNSSEC')
      : 'No A record found';

    const sub = f.host && f.rootDomain && f.host !== f.rootDomain;
    const subNote = sub ? 'Queried at ' + f.rootDomain + ' (registered domain)' : null;

    checks.push({ label: 'A Record', value: d.A.length ? d.A.join(', ') : 'None', status: d.A.length ? 'pass' : 'fail' });
    checks.push({ label: 'AAAA Record', value: d.AAAA.length ? d.AAAA.join(', ') : 'None', status: d.AAAA.length ? 'pass' : 'info' });
    checks.push({
      label: 'MX Record', value: d.MX.length ? d.MX.map((m) => m.priority + ' ' + m.host).join(', ') : 'None',
      status: d.MX.length ? 'pass' : 'info',
      note: d.MX.length ? subNote
        : 'No mail servers — many websites intentionally have none.' + (sub ? ' Queried at ' + f.rootDomain + '.' : '')
    });
    checks.push({ label: 'NS Record', value: d.NS.length ? d.NS.join(', ') : 'None', status: d.NS.length ? 'pass' : 'fail', note: subNote });
    checks.push({ label: 'DNSSEC', value: d.dnssec ? 'Enabled (validated)' : 'Not detected', status: d.dnssec ? 'pass' : 'warn' });

    if (d.dnssec) {
      findings.push({
        severity: 'pass',
        title: 'DNSSEC is enabled',
        explanation: 'DNS responses are cryptographically signed, making spoofing detectable.',
        details: 'The resolver reported validated (AD) responses for this domain.',
        recommendation: 'Keep DS records current when changing DNS providers.'
      });
    } else {
      findings.push({
        severity: 'low',
        title: 'DNSSEC is not enabled',
        explanation: 'Unsigned DNS responses can in principle be spoofed in transit.',
        details: 'The resolver did not report DNSSEC validation for this domain.',
        recommendation: 'Enable DNSSEC at the registrar or DNS host if the domain supports it.'
      });
    }
    if (!d.MX.length) {
      findings.push({
        severity: 'info',
        title: 'No mail (MX) records found',
        explanation: 'The domain does not advertise mail servers. This is common for sites that do not handle email.',
        details: 'The MX query returned no usable records.',
        recommendation: 'No action needed unless the domain should receive email.'
      });
    }
    return { id: 'dns', label: 'DNS', icon: 'network', score, explanation, checks, findings };
  }

  function buildDomain(f) {
    const dom = f.domain;
    const checks = [];
    const findings = [];
    const ageDays = dom.ok && dom.created ? Math.floor((Date.now() - new Date(dom.created).getTime()) / DAY) : null;

    if (!dom.ok) {
      checks.push({ label: 'Domain Age', value: 'Not available', status: 'info' });
      checks.push({ label: 'Registrar', value: 'Not available', status: 'info' });
      checks.push({ label: 'Registration Date', value: 'Not available', status: 'info' });
      checks.push({ label: 'Expiration Date', value: 'Not available', status: 'info' });
      checks.push({ label: 'Nameservers', value: 'Not available', status: 'info' });
      findings.push({
        severity: 'info',
        title: 'Domain registration data unavailable',
        explanation: 'Registration details could not be retrieved via RDAP for this domain.',
        details: 'Some country-code TLDs do not expose RDAP endpoints.',
        recommendation: 'No action needed — domain age could not be factored into the score.'
      });
      return { id: 'domain', label: 'Domain', icon: 'calendar', score: 55, explanation: 'Registration data unavailable', checks, findings };
    }

    let score = 0;
    if (ageDays === null) score += 40;
    else if (ageDays > 730) score += 60;
    else if (ageDays > 365) score += 45;
    else if (ageDays > 90) score += 25;
    else score += 8;
    score += (dom.expires && daysUntil(dom.expires) > 90) ? 15 : 5;
    score += dom.registrar ? 10 : 0;
    score += (dom.nameservers && dom.nameservers.length) ? 15 : 0;
    score = clamp(score, 0, 100);

    const ageText = ageDays === null ? 'Not available' : (ageDays > 730 ? Math.floor(ageDays / 365) + ' years' : ageDays + ' days');
    const explanation = ageDays === null ? 'Registration data incomplete'
      : ageDays > 730 ? 'Established registration (' + Math.floor(ageDays / 365) + ' years old)'
      : ageDays > 90 ? 'Registered within the last year'
      : 'Registered very recently';

    const sub = f.host && f.rootDomain && f.host !== f.rootDomain;
    checks.push({ label: 'Domain Age', value: ageText, status: ageDays === null ? 'info' : (ageDays > 730 ? 'pass' : (ageDays > 90 ? 'warn' : 'fail')), note: sub ? 'Registration data for ' + f.rootDomain : null });
    checks.push({ label: 'Registrar', value: dom.registrar || 'Not available', status: 'info' });
    checks.push({ label: 'Registration Date', value: dom.created ? fmtDate(dom.created) : 'Not available', status: 'info' });
    checks.push({ label: 'Expiration Date', value: dom.expires ? fmtDate(dom.expires) + ' (' + daysUntil(dom.expires) + ' days)' : 'Not available', status: 'info' });
    checks.push({ label: 'Nameservers', value: (dom.nameservers || []).length ? (dom.nameservers.join(', ') || '—') : 'Not available', status: 'info' });

    if (ageDays !== null && ageDays <= 90) {
      findings.push({
        severity: 'high',
        title: 'Domain registered ' + ageDays + ' days ago',
        explanation: 'Newly registered domains are statistically over-represented in phishing and scam campaigns.',
        details: 'Registered ' + fmtDate(dom.created) + (dom.registrar ? ' via ' + dom.registrar : '') + '.',
        recommendation: 'Treat unfamiliar young domains with extra caution and avoid sharing sensitive information.'
      });
    } else if (ageDays !== null && ageDays <= 365) {
      findings.push({
        severity: 'low',
        title: 'Domain is less than a year old',
        explanation: 'The registration is relatively recent, which alone is not suspicious but carries less track record.',
        details: 'Registered ' + fmtDate(dom.created) + '.',
        recommendation: 'Judge the domain together with its other indicators.'
      });
    } else if (ageDays !== null && ageDays > 730) {
      findings.push({
        severity: 'pass',
        title: 'Established domain registration',
        explanation: 'The domain has been registered for ' + Math.floor(ageDays / 365) + ' years.',
        details: 'Registered ' + fmtDate(dom.created) + (dom.registrar ? ' via ' + dom.registrar : '') + '.',
        recommendation: 'No action needed.'
      });
    }
    return { id: 'domain', label: 'Domain', icon: 'calendar', score, explanation, checks, findings };
  }

  function buildRedirects(f) {
    const r = f.redirects;
    const chain = r.chain || [];
    const final = chain.filter((c) => c.final).pop() || chain[chain.length - 1] || {};
    const finalUrl = final.url || '';
    const finalHttps = /^https:/i.test(finalUrl);
    const upgrade = r.upgrade;
    const hops = Math.max(0, chain.length - 1);
    const checks = [];
    const findings = [];

    let score = 0;
    if (upgrade === 'yes') score += 40;
    else if (upgrade === 'unknown') score += 30;
    else score += 0;

    if (hops <= 2) score += 30;
    else if (hops <= 5) score += 18;
    else score += 8;

    if (finalHttps) score += 30;
    else score += 0;
    score = clamp(score, 0, 100);

    const explanation = upgrade === 'yes'
      ? 'HTTP upgrades to HTTPS (' + chain.length + (chain.length === 1 ? ' step' : ' steps') + ')'
      : upgrade === 'unknown'
        ? 'Redirect behavior could not be fully verified'
        : 'HTTP does not redirect to HTTPS';

    checks.push({
      label: 'HTTP → HTTPS',
      value: upgrade === 'yes' ? 'Upgraded' : upgrade === 'unknown' ? 'Unknown (HTTP refused)' : 'Not upgraded',
      status: upgrade === 'yes' ? 'pass' : (upgrade === 'unknown' ? 'info' : 'fail')
    });
    checks.push({ label: 'Redirect chain length', value: chain.length + (chain.length === 1 ? ' step' : ' steps'), status: hops > 5 ? 'warn' : 'pass' });
    checks.push({ label: 'Final URL', value: finalUrl || '—', status: finalHttps ? 'pass' : 'fail' });

    if (upgrade === 'yes') {
      findings.push({
        severity: 'pass',
        title: 'HTTP redirects to HTTPS',
        explanation: 'Visitors entering the http:// address are upgraded to a secure connection.',
        details: chain.map((c) => c.status ? c.url + ' → ' + c.status : c.url).join('\n'),
        recommendation: 'Keep a permanent (301/308) redirect in place.'
      });
    } else if (upgrade === 'no') {
      findings.push({
        severity: 'high',
        title: 'HTTP does not redirect to HTTPS',
        explanation: 'The site also serves content over plain HTTP, which can be read or modified in transit.',
        details: 'The http:// address returned a direct 200 response without redirecting.',
        recommendation: 'Configure a permanent redirect from http:// to https:// on the web server.'
      });
    } else {
      findings.push({
        severity: 'info',
        title: 'Redirect behavior could not be fully verified',
        explanation: r.note || 'The HTTP endpoint refused connections, which usually indicates an HTTPS-only server.',
        details: 'The http:// variant of the site could not be tested.',
        recommendation: 'No action needed if the server intentionally refuses plain HTTP.'
      });
    }
    if (hops > 3) {
      findings.push({
        severity: 'low',
        title: 'Long redirect chain (' + hops + ' hops)',
        explanation: 'Long chains slow down visitors and can obscure where a link ultimately lands.',
        details: chain.map((c) => c.status ? c.url + ' → ' + c.status : c.url).join('\n'),
        recommendation: 'Collapse the chain to a single hop if you control the redirects.'
      });
    }
    if (!finalHttps && finalUrl) {
      findings.push({
        severity: 'high',
        title: 'Redirect chain ends over plain HTTP',
        explanation: 'The final destination is not encrypted.',
        details: 'Final URL: ' + finalUrl,
        recommendation: 'Ensure the chain terminates on an https:// address.'
      });
    }
    return { id: 'redirects', label: 'Redirect Analysis', icon: 'redirect', score, explanation, checks, findings, chain };
  }

  function buildReputation(f, st) {
    const rep = f.reputation;
    const matches = rep.matches || [];
    const sbConfigured = !!st.safeBrowsingKey && rep.sbLive === true;
    const checks = [];
    const findings = [];

    const phishing = matches.some((m) => /SOCIAL_ENGINEERING|PHISHING/i.test(m.threatType || ''));
    const malware = matches.some((m) => /MALWARE|HARMFUL/i.test(m.threatType || ''));
    const unwanted = matches.some((m) => /UNWANTED/i.test(m.threatType || ''));

    if (matches.length) {
      checks.push({ label: 'Known malicious reports', value: matches.length + ' report' + (matches.length > 1 ? 's' : ''), status: 'fail' });
      checks.push({ label: 'Phishing indicators', value: phishing ? 'Detected' : 'None found', status: phishing ? 'fail' : 'pass' });
      checks.push({ label: 'Malware indicators', value: malware ? 'Detected' : 'None found', status: malware ? 'fail' : 'pass' });
      checks.push({ label: 'Threat intelligence status', value: sbConfigured ? 'Flagged by Safe Browsing' : 'Flagged', status: 'fail' });
      findings.push({
        severity: 'critical',
        title: 'Flagged by threat intelligence',
        explanation: 'This site appears in threat-intelligence reports as dangerous to visitors.',
        details: 'Threat types: ' + matches.map((m) => m.threatType).join(', '),
        recommendation: 'Avoid visiting this site, downloading files from it, or submitting any information.'
      });
      return { id: 'reputation', label: 'Reputation', icon: 'rep', score: 0, explanation: 'Flagged by threat intelligence', checks, findings };
    }

    let score = 60;
    if (f.https.ok) score += 10;
    if (f.dns.dnssec) score += 10;
    if (f.domain.ok && f.domain.created && daysUntil(f.domain.created) < -730) score += 10;
    if (f.headers && f.headers.hsts) score += 5;
    if (f.headers && f.headers.csp) score += 5;
    if (f.headers && f.headers.xcto) score += 5;
    score = clamp(score, 0, 100);
    if (!sbConfigured) score = Math.min(score, 90); // heuristic estimate never claims certainty

    checks.push({ label: 'Known malicious reports', value: 'None found', status: 'pass' });
    checks.push({ label: 'Phishing indicators', value: 'None found', status: 'pass' });
    checks.push({ label: 'Malware indicators', value: 'None found', status: 'pass' });
    checks.push({
      label: 'Threat intelligence status',
      value: sbConfigured ? 'Safe Browsing — clean' : 'Heuristic estimate',
      status: sbConfigured ? 'pass' : 'info',
      note: sbConfigured ? null : 'No threat-feed API key configured; estimated from technical signals.'
    });

    findings.push({
      severity: 'pass',
      title: 'No malicious reports found',
      explanation: 'No malware, phishing or unwanted-software reports were found in the enabled threat sources.',
      details: sbConfigured
        ? 'Google Safe Browsing returned no matches for this URL.'
        : 'Reputation was estimated from domain age, DNSSEC and TLS posture.',
      recommendation: 'No action needed.'
    });
    if (!sbConfigured) {
      findings.push({
        severity: 'info',
        title: 'Reputation is estimated from technical signals',
        explanation: 'No threat-intelligence feed is configured, so reputation is inferred from other indicators.',
        details: 'Signals used: domain age, DNSSEC, HTTPS posture, security headers.',
        recommendation: 'Add a Google Safe Browsing API key in Settings to check a live threat feed.'
      });
    }
    return { id: 'reputation', label: 'Reputation', icon: 'rep', score, explanation: 'No threat indicators found', checks, findings };
  }

  /* ------------------------------------------------------------- scoring */
  const WEIGHTS = { tls: 0.25, headers: 0.2, dns: 0.1, domain: 0.15, redirects: 0.1, reputation: 0.2 };

  function scoreToRisk(score) {
    if (score >= 80) return 'low';
    if (score >= 50) return 'medium';
    return 'high';
  }

  const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4, pass: 5 };

  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  /* ----------------------------------------------------------- orchestration */
  const STEP_LABELS = [
    'Checking HTTPS...',
    'Analyzing security headers...',
    'Inspecting DNS...',
    'Checking redirects...',
    'Evaluating reputation...'
  ];

  async function analyze(rawUrl, settings, onStep) {
    const t0 = Date.now();
    const nu = normUrl(rawUrl);
    if (!nu.valid) {
      const err = new Error(nu.error);
      err.userError = true;
      throw err;
    }
    const st = Object.assign({
      liveChecks: true, dohProvider: 'cloudflare', ctLookup: true,
      rdapLookup: true, safeBrowsingKey: ''
    }, settings || {});

    const { url, host, scheme } = nu;
    const rootDomain = registrableDomain(host);
    const reserved = RESERVED_TLDS.includes(rootDomain.split('.').pop());
    const live = st.liveChecks !== false && !reserved;
    const sim = simFacts(host, rootDomain, url, scheme);

    const facts = {
      sim,
      host,
      rootDomain,
      tlsLive: false,
      headersAvailable: false,
      dnsFailed: false,
      heuristicReputation: true,
      https: { ok: false, error: null, protocol: null },
      cert: { issuer: null, notBefore: null, notAfter: null },
      headers: {},
      dns: { A: [], AAAA: [], MX: [], NS: [], dnssec: false, status: null },
      domain: { ok: false, registrar: null, created: null, expires: null, nameservers: [] },
      redirects: { chain: [], upgrade: 'unknown', note: null },
      reputation: { matches: [], sbLive: false }
    };

    let page = null;       // live page response (best available)
    let httpsPage = null; // live https response specifically
    let stepStart = Date.now();

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const notify = async (i) => {
      const ms = Date.now() - stepStart;
      if (onStep) onStep({ index: i, label: STEP_LABELS[i], total: STEP_LABELS.length, ms });
      const spent = Date.now() - stepStart;
      if (spent < 380) await sleep(380 - spent); // visible scanning rhythm even offline
      stepStart = Date.now();
    };

    /* Step 1 — HTTPS + page fetch + certificate */
    let headerSource = null;
    if (live) {
      const httpsVariant = url.replace(/^http:\/\//i, 'https://');
      httpsPage = await liveFetchPage(httpsVariant);
      if (httpsPage.ok) {
        page = httpsPage;
        headerSource = 'https';
      } else {
        if (scheme === 'http') {
          const httpPage = await liveFetchPage(url);
          if (httpPage.ok) { page = httpPage; headerSource = 'http'; }
        }
      }
    }
    if (page) {
      facts.tlsLive = true;
      facts.headersAvailable = true;
      facts.https = {
        ok: headerSource === 'https',
        error: headerSource === 'https' ? null : 'The site responded over plain HTTP. HTTPS is unavailable or misconfigured.',
        protocol: headerSource === 'https' ? 'TLS 1.2+ (enforced by browser)' : null
      };
      if (st.ctLookup && headerSource === 'https') {
        try {
          const cert = await liveCertificate(host, rootDomain);
          facts.cert = cert;
        } catch (e) { /* keep nulls — info finding covers it */ }
      }
    } else {
      if (live) {
        facts.https = {
          ok: false,
          error: (httpsPage && httpsPage.error) || 'The connection failed.',
          protocol: null
        };
      } else {
        facts.https = sim.https;
        facts.cert = sim.cert;
      }
    }
    await notify(0);

    /* Step 2 — security headers */
    if (page) {
      const hv = (name) => {
        const hit = page.headers.find(([k]) => k.toLowerCase() === name);
        return hit ? hit[1] : null;
      };
      facts.headers = {
        csp: hv('content-security-policy'),
        hsts: hv('strict-transport-security'),
        xfo: hv('x-frame-options'),
        xcto: hv('x-content-type-options'),
        referrer: hv('referrer-policy'),
        pp: hv('permissions-policy')
      };
    } else {
      if (live) {
        // Unreachable site — response headers could not be observed.
        facts.headers = {};
        facts.headersAvailable = false;
      } else {
        facts.headers = sim.headers;
        facts.headersAvailable = true;
      }
    }
    await notify(1);

    /* Step 3 — DNS + domain registration */
    if (live) {
      try {
        facts.dns = await liveDNS(host, rootDomain, st.dohProvider === 'google' ? 'google' : 'cloudflare');
      } catch (e) {
        facts.dns = sim.dns;
        facts.dnsFailed = true;
      }
      if (st.rdapLookup) {
        try {
          const dom = await liveRDAP(rootDomain);
          facts.domain = {
            ok: true, registrar: dom.registrar, created: dom.created,
            expires: dom.expires, nameservers: dom.nameservers
          };
        } catch (e) { /* unavailable — info finding covers it */ }
      }
    } else {
      facts.dns = sim.dns;
      facts.domain = sim.domain;
    }
    await notify(2);

    /* Step 4 — redirects */
    if (live) {
      const httpVariant = url.replace(/^https:\/\//i, 'http://');
      const chainStart = scheme === 'http' ? url : httpVariant;
      const r = await liveRedirectChain(chainStart);
      if (r.reachable && r.chain.length && !r.chain[0].error) {
        const last = r.chain[r.chain.length - 1];
        const finalIsHttps = /^https:/i.test(last.url || '');
        facts.redirects = {
          chain: r.chain,
          upgrade: finalIsHttps ? 'yes' : 'no',
          note: r.partial ? 'Some intermediate hops were not observable by the browser.' : null
        };
      } else {
        facts.redirects = { chain: [{ url: chainStart, status: null, final: true, refused: true }], upgrade: 'unknown', note: 'The http:// endpoint refused connections — likely an HTTPS-only server.' };
      }
    } else {
      facts.redirects = sim.redirects;
    }
    await notify(3);

    /* Step 5 — reputation */
    if (live && st.safeBrowsingKey) {
      try {
        const matches = await liveSafeBrowsing(url, st.safeBrowsingKey);
        facts.reputation = { matches, sbLive: true };
        facts.heuristicReputation = false;
      } catch (e) { /* fall through to heuristic */ }
    } else if (!live) {
      facts.reputation = sim.reputation;
    }
    await notify(4);

    /* ---------------------------------------------------- assemble report */
    const categories = [
      buildTLS(facts),
      buildHeaders(facts),
      buildDNS(facts),
      buildDomain(facts),
      buildRedirects(facts),
      buildReputation(facts, st)
    ];

    let overall = 0;
    categories.forEach((c) => { overall += (WEIGHTS[c.id] || 0) * c.score; });
    overall = Math.round(clamp(overall, 0, 100));
    const risk = scoreToRisk(overall);

    const findings = [];
    categories.forEach((c) => c.findings.forEach((fz) => findings.push(Object.assign({ category: c.label }, fz))));
    findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0, pass: 0 };
    findings.forEach((fz) => {
      if (summary[fz.severity] !== undefined) summary[fz.severity]++;
    });

    /* tech details */
    let server = null, status = null, timingMs = null, responseHeaders = [];
    if (page) {
      const hv = (name) => { const hit = page.headers.find(([k]) => k.toLowerCase() === name); return hit ? hit[1] : null; };
      server = hv('server') || hv('x-powered-by');
      status = page.status;
      timingMs = page.ms;
      responseHeaders = page.headers;
    } else {
      server = pick(mulberry32(hash32(host)), ['nginx', 'Apache', 'cloudflare', 'gunicorn']);
      status = facts.https.ok ? 200 : 0;
      timingMs = Math.floor(80 + Math.random() * 600);
      responseHeaders = [
        ['content-type', 'text/html; charset=utf-8'],
        ['date', new Date().toUTCString()],
        ['server', server]
      ];
      if (facts.headers.csp) responseHeaders.push(['content-security-policy', facts.headers.csp]);
      if (facts.headers.hsts) responseHeaders.push(['strict-transport-security', facts.headers.hsts]);
      if (facts.headers.xcto) responseHeaders.push(['x-content-type-options', facts.headers.xcto]);
    }

    let ip = facts.dns.A[0] || null;
    let asn = null;
    if (ip && live && !facts.dnsFailed) {
      asn = await liveASN(ip);
    } else if (ip) {
      const rng = mulberry32(hash32(host + 'asn'));
      asn = { number: 'AS' + Math.floor(13335 + rng() * 40000), name: pick(rng, ASNS) };
    }

    return {
      id: host + '-' + Date.now(),
      url, host, scheme,
      score: overall, risk,
      timestamp: Date.now(),
      durationMs: Date.now() - t0,
      live: !!(live && page),
      simulated: !live,
      categories: categories.map((c) => ({
        id: c.id, label: c.label, icon: c.icon, score: c.score,
        explanation: c.explanation, checks: c.checks, chain: c.chain || null
      })),
      findings,
      summary,
      tech: {
        responseHeaders,
        tls: {
          protocol: facts.https.protocol || '—',
          issuer: facts.cert.issuer || 'Not available',
          valid: facts.https.ok,
          notBefore: facts.cert.notBefore || null,
          notAfter: facts.cert.notAfter || null,
          daysLeft: facts.cert.notAfter ? daysUntil(facts.cert.notAfter) : null
        },
        dns: facts.dns,
        ip,
        asn,
        server,
        chain: (facts.redirects.chain || []).map((c) => ({ url: c.url, status: c.status })),
        status,
        timingMs
      }
    };
  }

  /* ================================================================
   *  LINK CHECKER — follows a pasted link and reports where it leads:
   *  a file download, a risky destination, or a safe page.
   * ================================================================ */

  // Content types that indicate a file download rather than a web page.
  const DOWNLOAD_CONTENT_TYPES = [
    'application/octet-stream', 'application/x-msdownload', 'application/x-msdownload',
    'application/x-dosexec', 'application/x-executable', 'application/x-apple-diskimage',
    'application/x-msi', 'application/vnd.android.package-archive',
    'application/x-rar-compressed', 'application/x-7z-compressed', 'application/zip',
    'application/x-tar', 'application/gzip', 'application/x-bzip2',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/json', 'text/csv'
  ];

  // File extensions that commonly trigger downloads.
  const DOWNLOAD_EXTENSIONS = [
    '.exe', '.msi', '.dmg', '.apk', '.ipa', '.deb', '.rpm',
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
    '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar',
    '.scr', '.com', '.pif', '.hta', '.lnk',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv'
  ];

  const LINK_STEP_LABELS = [
    'Resolving link...',
    'Following redirects...',
    'Checking destination...',
    'Assessing risk...'
  ];

  async function checkLink(rawUrl, settings, onStep) {
    const t0 = Date.now();
    const nu = normUrl(rawUrl);
    if (!nu.valid) {
      const err = new Error(nu.error);
      err.userError = true;
      throw err;
    }
    const st = Object.assign({
      liveChecks: true, dohProvider: 'cloudflare', ctLookup: true,
      rdapLookup: true, safeBrowsingKey: ''
    }, settings || {});

    const { url, host, scheme } = nu;
    const rootDomain = registrableDomain(host);
    const reserved = RESERVED_TLDS.includes(rootDomain.split('.').pop());
    const live = st.liveChecks !== false && !reserved;

    const stepStart = { t: Date.now() };
    const notify = async (i) => {
      const ms = Date.now() - stepStart.t;
      if (onStep) onStep({ index: i, label: LINK_STEP_LABELS[i], total: LINK_STEP_LABELS.length, ms });
      const spent = Date.now() - stepStart.t;
      if (spent < 300) await new Promise((r) => setTimeout(r, 300 - spent));
      stepStart.t = Date.now();
    };

    /* ---- Step 1: Validate & normalize ---- */
    await notify(0);

    /* ---- Step 2: Follow redirect chain, capturing headers at each hop ---- */
    const chain = [];
    let finalUrl = url;
    let finalHost = host;
    let finalRootDomain = rootDomain;
    let finalHeaders = {};
    let finalStatus = null;
    let reachable = false;
    let isDownload = false;
    let downloadReason = null;
    let downloadFileName = null;
    let contentType = null;
    let loopDetected = false;
    let errorMsg = null;

    if (live) {
      let current = url;
      const seen = new Set();
      for (let hop = 0; hop < 10; hop++) {
        if (seen.has(current)) { loopDetected = true; break; }
        seen.add(current);

        let res;
        try {
          res = await fetchT(current, { method: 'GET', redirect: 'manual' }, 10000);
        } catch (e) {
          if (hop === 0) { errorMsg = 'The link could not be reached.'; break; }
          chain.push({ url: current, status: null, error: true, final: true });
          break;
        }

        // Handle opaque redirects (browser hides intermediate hops)
        if (res.type === 'opaqueredirect' || res.status === 0) {
          try {
            const r2 = await fetchT(current, { method: 'GET', redirect: 'follow' }, 10000);
            chain.push({ url: current, status: null, opaque: true, final: false });
            chain.push({ url: r2.url, status: r2.status, final: true });
            finalUrl = r2.url;
            finalStatus = r2.status;
            reachable = true;
            // Capture headers from the follow response
            finalHeaders = {};
            r2.headers.forEach((v, k) => { finalHeaders[k.toLowerCase()] = v; });
            contentType = finalHeaders['content-type'] || null;
            try {
              const fu = new URL(finalUrl);
              finalHost = fu.hostname.toLowerCase();
              finalRootDomain = registrableDomain(finalHost);
            } catch { /* keep original */ }
            break;
          } catch (e) {
            chain.push({ url: current, status: null, error: true, final: true });
            break;
          }
        }

        const loc = res.headers.get('location');
        const status = res.status;
        const hopContentType = res.headers.get('content-type') || null;
        const hopDisposition = res.headers.get('content-disposition') || null;

        if (REDIRECT_STATUSES.includes(status) && loc) {
          let next;
          try { next = new URL(loc, current).href; } catch { next = null; }
          if (!next) {
            chain.push({ url: current, status, final: true });
            finalUrl = current;
            finalStatus = status;
            reachable = true;
            finalHeaders = {};
            res.headers.forEach((v, k) => { finalHeaders[k.toLowerCase()] = v; });
            contentType = hopContentType;
            break;
          }
          chain.push({ url: current, status, final: false });
          current = next;
          continue;
        }

        // Final destination reached
        chain.push({ url: current, status, final: true });
        finalUrl = current;
        finalStatus = status;
        reachable = true;
        finalHeaders = {};
        res.headers.forEach((v, k) => { finalHeaders[k.toLowerCase()] = v; });
        contentType = hopContentType;
        const disposition = hopDisposition || finalHeaders['content-disposition'] || null;

        // Check for download indicators
        if (disposition && /attachment/i.test(disposition)) {
          isDownload = true;
          const m = disposition.match(/filename[*]?\s*=\s*["']?([^"';]+)/i);
          downloadFileName = m ? m[1].trim() : null;
          downloadReason = 'The server marked this response as a file attachment (Content-Disposition: attachment).';
        } else if (contentType) {
          const ct = contentType.toLowerCase().split(';')[0].trim();
          if (DOWNLOAD_CONTENT_TYPES.includes(ct)) {
            isDownload = true;
            downloadReason = 'The server is sending a file (' + ct + ') instead of a web page.';
            // Try to extract filename from URL
            try {
              const path = new URL(current).pathname;
              const base = path.split('/').pop();
              if (base && base.includes('.')) downloadFileName = base;
            } catch { /* ignore */ }
          }
        }
        // Check file extension in URL
        if (!isDownload) {
          try {
            const path = new URL(current).pathname.toLowerCase();
            const ext = DOWNLOAD_EXTENSIONS.find((e) => path.endsWith(e));
            if (ext) {
              isDownload = true;
              downloadReason = 'The link points to a file with a "' + ext + '" extension, which browsers typically download.';
              downloadFileName = path.split('/').pop() || null;
            }
          } catch { /* ignore */ }
        }
        break;
      }
      if (loopDetected) {
        chain.push({ url: current, status: 310, final: true, loop: true });
        finalUrl = current;
        errorMsg = 'The link is stuck in a redirect loop.';
      }
    } else {
      // Simulated mode
      const sim = simFacts(host, rootDomain, url, scheme);
      const rng = mulberry32(hash32(url));
      const forcedBad = SKETCHY_RE.test(rootDomain);
      const shortener = /^(bit\.ly|tinyurl\.com|goo\.gl|t\.co|short\.link|rb\.gy|cutt\.ly|rebrand\.ly|is\.gd|buff\.ly|ow\.ly)$/i.test(host);

      // Check if the original URL has a download extension
      const origPath = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return ''; } })();
      const origExt = DOWNLOAD_EXTENSIONS.find((e) => origPath.endsWith(e));

      if (shortener) {
        // Simulate a shortened link that redirects somewhere
        const destBad = forcedBad || rng() < 0.35;
        const destHost = destBad
          ? pick(rng, ['free-iphone-winner.example', 'secure-login-verify.example', 'amaz0n-bonus.example', 'verify-account.example'])
          : pick(rng, ['github.com', 'youtube.com', 'wikipedia.org', 'news.ycombinator.com']);
        const destUrl = 'https://' + destHost + (destBad ? '/claim-prize' : '/');
        chain.push({ url, status: 301, final: false });
        chain.push({ url: destUrl, status: 200, final: true });
        finalUrl = destUrl;
        finalHost = destHost;
        finalRootDomain = registrableDomain(destHost);
        finalStatus = 200;
        reachable = true;
        contentType = 'text/html';
        // 20% chance a shortened link leads to a download
        if (rng() < 0.2) {
          isDownload = true;
          downloadFileName = pick(rng, ['invoice.pdf', 'document.zip', 'setup.exe', 'photo.jpg.exe']);
          downloadReason = 'The link leads to a file download (' + downloadFileName + ').';
        }
      } else if (origExt) {
        // Direct link to a file — detect as download
        chain.push({ url, status: 200, final: true });
        finalStatus = 200;
        reachable = true;
        isDownload = true;
        downloadFileName = origPath.split('/').pop() || null;
        downloadReason = 'The link points to a file with a "' + origExt + '" extension, which browsers typically download.';
        const dlContentTypes = {
          '.zip': 'application/zip', '.exe': 'application/octet-stream',
          '.pdf': 'application/pdf', '.dmg': 'application/x-apple-diskimage',
          '.apk': 'application/vnd.android.package-archive', '.rar': 'application/x-rar-compressed',
          '.7z': 'application/x-7z-compressed', '.msi': 'application/x-msi'
        };
        contentType = dlContentTypes[origExt] || 'application/octet-stream';
      } else if (forcedBad) {
        chain.push({ url, status: 200, final: true });
        finalStatus = 200;
        reachable = true;
        contentType = 'text/html';
        // 15% chance a sketchy site also triggers a download
        if (rng() < 0.15) {
          isDownload = true;
          downloadFileName = pick(rng, ['crack.exe', 'keygen.bat', 'invoice.pdf.exe']);
          downloadReason = 'The link leads to a file download (' + downloadFileName + ').';
        }
      } else {
        const destBad = rng() < 0.15;
        if (destBad) {
          chain.push({ url, status: 302, final: false });
          const destHost = pick(rng, ['verify-account.example', 'secure-login.example', 'wallet-connect-app.example']);
          const destUrl = 'https://' + destHost + '/login';
          chain.push({ url: destUrl, status: 200, final: true });
          finalUrl = destUrl;
          finalHost = destHost;
          finalRootDomain = registrableDomain(destHost);
        } else {
          chain.push({ url, status: 200, final: true });
        }
        finalStatus = 200;
        reachable = true;
        contentType = 'text/html';
        if (rng() < 0.1) {
          isDownload = true;
          downloadFileName = 'file.zip';
          downloadReason = 'The link leads to a file download.';
        }
      }
    }
    await notify(1);

    /* ---- Step 3: Analyze the final destination ---- */
    let destRisk = 'unknown';
    let destScore = 50;
    let destReasons = [];
    let destFindings = [];

    if (reachable && !isDownload) {
      const finalSim = simFacts(finalHost, finalRootDomain, finalUrl, 'https');
      const ageDays = finalSim.domain.ok && finalSim.domain.created
        ? Math.floor((Date.now() - new Date(finalSim.domain.created).getTime()) / DAY)
        : null;

      // Domain age check
      if (ageDays !== null && ageDays <= 30) {
        destRisk = 'high';
        destScore = Math.min(destScore, 25);
        destReasons.push('The destination domain was registered only ' + ageDays + ' days ago — very new domains are common in scams.');
      } else if (ageDays !== null && ageDays <= 90) {
        if (destRisk !== 'high') { destRisk = 'medium'; destScore = Math.min(destScore, 55); }
        destReasons.push('The destination domain is less than 3 months old.');
      }

      // Sketchy pattern check
      if (SKETCHY_RE.test(finalRootDomain)) {
        destRisk = 'high';
        destScore = Math.min(destScore, 15);
        destReasons.push('The destination domain name contains suspicious patterns commonly used in scams.');
      }

      // HTTPS check
      if (!/^https:/i.test(finalUrl)) {
        if (destRisk === 'unknown') { destRisk = 'medium'; }
        destScore = Math.min(destScore, 60);
        destReasons.push('The destination uses unencrypted HTTP — data can be intercepted.');
      }

      // Live reputation check
      if (live && st.safeBrowsingKey) {
        try {
          const matches = await liveSafeBrowsing(finalUrl, st.safeBrowsingKey);
          if (matches.length) {
            destRisk = 'high';
            destScore = 0;
            destReasons.push('Google Safe Browsing flags this destination as dangerous: ' + matches.map((m) => m.threatType).join(', '));
          }
        } catch { /* ignore */ }
      }

      // Well-known platform bonus
      if (GOOD_HOSTS.includes(finalRootDomain)) {
        destRisk = 'low';
        destScore = Math.max(destScore, 90);
        destReasons.push('The destination is a well-known, established platform.');
      }

      // Default to safe if no issues found
      if (destRisk === 'unknown' && destReasons.length === 0) {
        destRisk = 'low';
        destScore = Math.max(destScore, 75);
        destReasons.push('No risk indicators were detected for the destination.');
      }

      if (destRisk === 'low' && destScore < 70) destScore = 70;
    } else if (isDownload) {
      // Downloads are inherently risky
      destRisk = 'medium';
      destScore = 40;
      destReasons.push('This link triggers a file download. Only proceed if you trust the source.');
      // Check if the download comes from a sketchy domain
      if (SKETCHY_RE.test(finalRootDomain)) {
        destRisk = 'high';
        destScore = 10;
        destReasons.push('The download comes from a domain with suspicious naming patterns.');
      }
      // Check file extension risk
      if (downloadFileName) {
        const ext = DOWNLOAD_EXTENSIONS.find((e) => downloadFileName.toLowerCase().endsWith(e));
        if (ext && ['.exe', '.msi', '.bat', '.cmd', '.sh', '.scr', '.apk', '.dmg'].includes(ext)) {
          destRisk = 'high';
          destScore = Math.min(destScore, 15);
          destReasons.push('The file type "' + ext + '" is an executable — running it could harm your device.');
        }
      }
    }
    await notify(2);

    /* ---- Step 4: Determine overall verdict ---- */
    await notify(3);

    let verdict;
    let verdictLabel;
    let verdictColor;
    let verdictIcon;
    let verdictDesc;

    if (!reachable && errorMsg) {
      verdict = 'unknown';
      verdictLabel = 'UNREACHABLE';
      verdictColor = '#66707f';
      verdictIcon = 'warn';
      verdictDesc = errorMsg;
    } else if (isDownload) {
      if (destRisk === 'high') {
        verdict = 'download-risky';
        verdictLabel = 'DANGEROUS DOWNLOAD';
        verdictColor = '#f0655a';
        verdictIcon = 'x';
        verdictDesc = 'This link leads to a file download from a suspicious source. Do not open the file.';
      } else {
        verdict = 'download';
        verdictLabel = 'FILE DOWNLOAD';
        verdictColor = '#ffb224';
        verdictIcon = 'download';
        verdictDesc = 'This link leads to a file download. Be cautious — only open files from sources you trust.';
      }
    } else if (destRisk === 'high') {
      verdict = 'risky';
      verdictLabel = 'RISKY DESTINATION';
      verdictColor = '#f0655a';
      verdictIcon = 'x';
      verdictDesc = 'This link leads to a website that shows signs of being dangerous. Avoid entering any personal information.';
    } else if (destRisk === 'medium') {
      verdict = 'caution';
      verdictLabel = 'USE CAUTION';
      verdictColor = '#ffb224';
      verdictIcon = 'warn';
      verdictDesc = 'This link leads to a website with some risk indicators. Proceed carefully and avoid sharing sensitive information.';
    } else {
      verdict = 'safe';
      verdictLabel = 'SAFE DESTINATION';
      verdictColor = '#3ecf8e';
      verdictIcon = 'check';
      verdictDesc = 'This link leads to a website with no significant risk indicators detected.';
    }

    if (loopDetected) {
      verdict = 'unknown';
      verdictLabel = 'REDIRECT LOOP';
      verdictColor = '#ffb224';
      verdictIcon = 'warn';
      verdictDesc = 'This link is caught in a redirect loop and never reaches a final destination.';
    }

    return {
      id: 'link-' + host + '-' + Date.now(),
      originalUrl: url,
      originalHost: host,
      finalUrl,
      finalHost,
      finalRootDomain,
      chain,
      verdict,
      verdictLabel,
      verdictColor,
      verdictIcon,
      verdictDesc,
      isDownload,
      downloadFileName,
      downloadReason,
      contentType,
      destRisk,
      destScore,
      destReasons,
      reachable,
      loopDetected,
      finalStatus,
      finalHeaders,
      timestamp: Date.now(),
      durationMs: Date.now() - t0,
      live,
      simulated: !live
    };
  }

  return {
    analyze, normUrl, scoreToRisk, WEIGHTS, STEP_LABELS, registrableDomain, checkLink, LINK_STEP_LABELS
  };
})();

/* Node (test) exposure — inert in the browser. */
if (typeof module !== 'undefined' && module.exports) module.exports = TrustEngine;
