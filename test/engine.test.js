/* Smoke test for TrustEngine (simulated mode — no network). Run: node test/engine.test.js */
const T = require('../dashboard/engine.js');

const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; }
  else console.log('ok  -', msg);
};

(async () => {
  // --- normUrl ---
  const n1 = T.normUrl('example.com');
  assert(n1.valid && n1.url === 'https://example.com/', 'normUrl adds https scheme');
  const n2 = T.normUrl('ftp://example.com');
  assert(!n2.valid, 'normUrl rejects non-http schemes');
  const n3 = T.normUrl('not a url at all!');
  assert(!n3.valid, 'normUrl rejects garbage');
  const n4 = T.normUrl('http://EXAMPLE.com/path#x');
  assert(n4.valid && n4.host === 'example.com', 'normUrl lowercases host, strips hash');

  // --- registrable domain ---
  assert(T.registrableDomain('www.youtube.com') === 'youtube.com', 'registrable: www.youtube.com → youtube.com');
  assert(T.registrableDomain('youtube.com') === 'youtube.com', 'registrable: youtube.com → youtube.com');
  assert(T.registrableDomain('www.bbc.co.uk') === 'bbc.co.uk', 'registrable: www.bbc.co.uk → bbc.co.uk');
  assert(T.registrableDomain('a.b.example.com.au') === 'example.com.au', 'registrable: deep multi-part TLD');
  assert(T.registrableDomain('example.com') === 'example.com', 'registrable: apex unchanged');

  // --- analyze (simulated) ---
  const settings = { liveChecks: false };
  const analyzeHost = async (raw) => T.analyze(raw, settings, null);

  // --- subdomain simulated scans key off the registered domain ---
  const subScan = await analyzeHost('www.wikipedia.org');
  assert(subScan.risk === 'low', 'www.wikipedia.org inherits root reputation (' + subScan.score + ')');
  const subBad = await analyzeHost('login.suspicious-site.example');
  assert(subBad.risk === 'high', 'sketchy subdomain stays high (' + subBad.score + ')');

  const good = await analyzeHost('https://github.com');
  assert(good.score >= 0 && good.score <= 100, 'score in range (github.com: ' + good.score + ')');
  assert(good.risk === 'low', 'github.com → low risk (' + good.score + ')');
  assert(good.categories.length === 6, 'six categories returned');
  assert(good.categories.every((c) => c.score >= 0 && c.score <= 100 && Array.isArray(c.checks)), 'categories have scores+checks');
  assert(good.findings.length > 0, 'findings present (' + good.findings.length + ')');
  assert(good.summary.critical + good.summary.high + good.summary.medium + good.summary.low
    === good.findings.filter((f) => !['pass', 'info'].includes(f.severity)).length, 'summary counts match findings');
  assert(good.tech && good.tech.tls && Array.isArray(good.tech.responseHeaders), 'tech block present');
  assert(good.categories.some((c) => c.chain && c.chain.length), 'redirect chain attached');

  const good2 = await analyzeHost('github.com');
  assert(good.score === good2.score, 'deterministic per host');

  const bad = await analyzeHost('https://suspicious-site.example');
  assert(bad.score < 50 && bad.risk === 'high', 'suspicious host → high risk (' + bad.score + ')');
  assert(bad.summary.critical >= 1, 'suspicious host has critical finding');
  assert(bad.simulated === true, 'reserved TLD forced to simulated');

  const scores = [];
  for (const h of ['wikipedia.org', 'shop-now-bonus.example', 'cloudflare.com', 'verify-account.example']) {
    const r = await analyzeHost(h);
    scores.push(h + '=' + r.score + '/' + r.risk);
    assert(r.risk === 'low' || r.risk === 'medium' || r.risk === 'high', 'risk label valid for ' + h);
  }
  console.log('    scores:', scores.join(', '));

  // weighted recomputation check
  const r = good;
  let expected = 0;
  r.categories.forEach((c) => { expected += (T.WEIGHTS[c.id] || 0) * c.score; });
  expected = Math.round(expected);
  assert(expected === r.score, 'overall score = weighted category sum (' + expected + ' vs ' + r.score + ')');

  // invalid input
  let threw = false;
  try { await analyzeHost('   '); } catch (e) { threw = !!e.userError; }
  assert(threw, 'empty input throws userError');

  console.log(process.exitCode ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED');
})();
