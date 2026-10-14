// Autocorrect utilities: fuzzy search spelling correction + form field fixing.
(function (global) {
  'use strict';

  // Damerau-Levenshtein (optimal string alignment) distance
  function distance(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    if (a === b) return 0;
    const d = [];
    for (let i = 0; i <= a.length; i++) d[i] = [i];
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  // Common slang / misspellings that edit distance alone won't catch well
  const SYNONYMS = {
    tranny: 'transmission', trans: 'transmission', gearbox: 'transmission', tranmission: 'transmission',
    motor: 'engine', 'long block': 'engine', longblock: 'engine',
    alt: 'alternator', genny: 'alternator', generator: 'alternator',
    'a/c': 'ac compressor', ac: 'ac compressor', aircon: 'ac compressor', compresser: 'ac compressor',
    pcm: 'ecu', ecm: 'ecu', computer: 'ecu', 'engine computer': 'ecu',
    rim: 'wheel', rims: 'wheel', tire: 'wheel',
    headlamp: 'headlight', 'head light': 'headlight', taillight: 'tail light', taillamp: 'tail light',
    'side mirror': 'mirror', 'wing mirror': 'mirror',
    cv: 'axle', 'cv axle': 'axle', driveshaft: 'axle', 'drive shaft': 'axle',
    'power steering': 'steering', 'rack and pinion': 'steering',
    chevy: 'chevrolet', vw: 'volkswagen', merc: 'mercedes-benz', mercedes: 'mercedes-benz', benz: 'mercedes-benz',
    beemer: 'bmw', bimmer: 'bmw', caddy: 'cadillac', ram: 'ram 1500', f150: 'f-150', 'f 150': 'f-150'
  };

  // Vocabulary is filled from live catalog data (makes, models, part names)
  let vocab = [];
  function setVocabulary(words) {
    const set = new Set();
    for (const w of words) {
      const lw = String(w).toLowerCase();
      set.add(lw);
      lw.split(/[\s/&()-]+/).forEach((t) => t.length > 2 && set.add(t));
    }
    Object.values(SYNONYMS).forEach((v) => set.add(v));
    vocab = [...set];
  }

  function bestMatch(token) {
    if (token.length < 3 || /^\d+$/.test(token)) return null;
    if (vocab.includes(token)) return null;
    const max = token.length <= 4 ? 1 : token.length <= 7 ? 2 : 3;
    let best = null, bestD = Infinity;
    for (const w of vocab) {
      if (Math.abs(w.length - token.length) > max) continue;
      const dd = distance(token, w);
      if (dd < bestD) { bestD = dd; best = w; }
    }
    return bestD <= max ? best : null;
  }

  // Returns { corrected, changed } for a free-text search query.
  function correctQuery(query) {
    let q = String(query).toLowerCase().trim().replace(/\s+/g, ' ');
    if (!q) return { corrected: '', changed: false };
    // phrase synonyms first (longest first)
    for (const k of Object.keys(SYNONYMS).sort((a, b) => b.length - a.length)) {
      const re = new RegExp(`(^|\\s)${k.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?=\\s|$)`, 'g');
      q = q.replace(re, `$1${SYNONYMS[k]}`);
    }
    const out = q.split(' ').map((t) => bestMatch(t) || t).join(' ');
    return { corrected: out, changed: out !== String(query).toLowerCase().trim().replace(/\s+/g, ' ') };
  }

  // ---------- form field auto-correction ----------
  const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'live.com', 'msn.com', 'comcast.net', 'att.net', 'verizon.net', 'protonmail.com'];
  const TLD_FIX = { con: 'com', cpm: 'com', cmo: 'com', ocm: 'com', vom: 'com', comm: 'com', nte: 'net', ner: 'net', ogr: 'org', orh: 'org' };

  function fixEmail(v) {
    let e = String(v).trim().toLowerCase().replace(/\s+/g, '').replace(/,/g, '.').replace(/\.{2,}/g, '.');
    const at = e.lastIndexOf('@');
    if (at < 1) return e;
    let [user, domain] = [e.slice(0, at), e.slice(at + 1)];
    const parts = domain.split('.');
    if (parts.length > 1 && TLD_FIX[parts[parts.length - 1]]) parts[parts.length - 1] = TLD_FIX[parts[parts.length - 1]];
    domain = parts.join('.');
    if (!domain.includes('.')) { // "gmail" -> "gmail.com"
      const hit = EMAIL_DOMAINS.find((d) => d.startsWith(domain + '.'));
      if (hit) domain = hit;
    }
    if (!EMAIL_DOMAINS.includes(domain)) {
      let best = null, bd = Infinity;
      for (const d of EMAIL_DOMAINS) { const dd = distance(domain, d); if (dd < bd) { bd = dd; best = d; } }
      if (bd <= 2) domain = best;
    }
    return `${user}@${domain}`;
  }

  function fixPhone(v) {
    let d = String(v).replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    if (d.length !== 10) return String(v).trim();
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  const SMALL = new Set(['de', 'la', 'van', 'von', 'der', 'and']);
  function fixName(v) {
    return String(v).trim().replace(/\s+/g, ' ').toLowerCase().split(' ')
      .map((w, i) => (i && SMALL.has(w) ? w : w.replace(/(^|[-'])([a-z])/g, (m, p, c) => p + c.toUpperCase()))).join(' ');
  }

  // VINs never contain I, O, Q — they're almost always typos for 1, 0, 0.
  function fixVin(v) {
    return String(v).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/I/g, '1').replace(/[OQ]/g, '0').slice(0, 17);
  }

  const STATES = { alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC' };
  function fixState(v) {
    const s = String(v).trim().toLowerCase().replace(/\./g, '');
    if (s.length === 2) return s.toUpperCase();
    if (STATES[s]) return STATES[s];
    let best = null, bd = Infinity;
    for (const k of Object.keys(STATES)) { const dd = distance(s, k); if (dd < bd) { bd = dd; best = k; } }
    return bd <= 2 ? STATES[best] : String(v).trim().toUpperCase();
  }

  function fixZip(v) {
    const d = String(v).replace(/[^\d]/g, '');
    return d.length === 9 ? `${d.slice(0, 5)}-${d.slice(5)}` : d.slice(0, 5);
  }

  function fixAddress(v) {
    const abbr = { st: 'St', ave: 'Ave', rd: 'Rd', blvd: 'Blvd', dr: 'Dr', ln: 'Ln', ct: 'Ct', hwy: 'Hwy', apt: 'Apt', ste: 'Ste', n: 'N', s: 'S', e: 'E', w: 'W' };
    return String(v).trim().replace(/\s+/g, ' ').split(' ').map((w) => {
      const k = w.toLowerCase().replace(/\.$/, '');
      return abbr[k] || (/^\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }).join(' ');
  }

  const FIXERS = { email: fixEmail, phone: fixPhone, name: fixName, vin: fixVin, state: fixState, zip: fixZip, address: fixAddress, city: fixName };

  // Wire up any <input data-autofix="kind"> inside root. Corrections apply on blur
  // and a small note tells the user what changed.
  function attach(root) {
    root.querySelectorAll('[data-autofix]').forEach((el) => {
      const fix = FIXERS[el.dataset.autofix];
      if (!fix || el.dataset.autofixBound) return;
      el.dataset.autofixBound = '1';
      if (el.dataset.autofix === 'vin') el.addEventListener('input', () => { el.value = fixVin(el.value); });
      el.addEventListener('blur', () => {
        if (!el.value) return;
        const before = el.value, after = fix(before);
        if (after !== before) {
          el.value = after;
          let note = el.parentElement.querySelector('.autofix-note');
          if (!note) { note = document.createElement('small'); note.className = 'autofix-note'; el.parentElement.appendChild(note); }
          note.textContent = `Auto-corrected from “${before}”`;
          setTimeout(() => note.remove(), 4000);
        }
      });
    });
  }

  global.AutoCorrect = { distance, setVocabulary, correctQuery, fixEmail, fixPhone, fixName, fixVin, fixState, fixZip, fixAddress, attach };
})(window);
