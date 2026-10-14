// XoraLure storefront (vanilla JS single-page app)
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $('#app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const state = { products: [], byId: new Map(), vehicles: {}, categories: [], brands: [], version: null, hasFitment: false, hasGrades: false };
  // null stock = not tracked by the store → treat as available (cap per order)
  const avail = (p) => (p.stock == null ? 10 : p.stock);

  function setCatalog(products, categories) {
    state.products = products; state.categories = categories;
    state.byId = new Map(products.map((p) => [p.id, p]));
    state.brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort();
    state.hasFitment = products.some((p) => p.make && p.yearFrom);
    state.hasGrades = products.some((p) => p.grade);
    state.hasNew = products.some((p) => p.condition === 'New');
    const counts = products.reduce((m, p) => (m[p.category] = (m[p.category] || 0) + 1, m), {});
    $('#footerShop').innerHTML = '<h4>Shop</h4>' + [...categories].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).slice(0, 4)
      .map((c) => `<a href="#/shop?category=${encodeURIComponent(c.id)}">${esc(c.name)}</a>`).join('') + '<a href="#/shop">All parts</a>';
    AutoCorrect.setVocabulary([...Object.keys(state.vehicles), ...Object.values(state.vehicles).flat(), ...state.brands,
      ...categories.map((c) => c.name), ...categories.map((c) => c.id.replace(/-/g, ' ')),
      ...new Set(products.map((p) => p.subcategory).filter(Boolean))]);
  }

  // ---------- icons ----------
  const ICONS = {
    engine: '<path d="M7 8h3V6h4v2h3l2 3h2v6h-2l-2 3H7v-3H5v2H3V11h2v2h2V8Zm2 2v8h7l1.5-2.3V12.3L16 10H9Z"/>',
    gear: '<path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-1-8h2l.5 2.6 1.9.8 2.2-1.5 1.4 1.4-1.5 2.2.8 1.9L22 11v2l-2.6.5-.8 1.9 1.5 2.2-1.4 1.4-2.2-1.5-1.9.8L13 22h-2l-.5-2.6-1.9-.8-2.2 1.5-1.4-1.4 1.5-2.2-.8-1.9L2 13v-2l2.6-.5.8-1.9-1.5-2.2 1.4-1.4 2.2 1.5 1.9-.8L11 2Z"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
    snow: '<path d="M11 2h2v4.6l3-2 1 1.7-4 2.7v2h2l2.7-4 1.7 1-2 3H22v2h-4.6l2 3-1.7 1-2.7-4h-2v2l4 2.7-1 1.7-3-2V22h-2v-4.6l-3 2-1-1.7 4-2.7v-2H9l-2.7 4-1.7-1 2-3H2v-2h4.6l-2-3 1.7-1L9 11h2V9L7 6.3l1-1.7 3 2V2Z"/>',
    grid: '<path d="M3 4h18v16H3V4Zm2 2v2h14V6H5Zm0 4v2h14v-2H5Zm0 4v2h14v-2H5Z"/>',
    chip: '<path d="M9 2h2v2h2V2h2v2h2a2 2 0 0 1 2 2v2h2v2h-2v2h2v2h-2v2a2 2 0 0 1-2 2h-2v2h-2v-2h-2v2H9v-2H7a2 2 0 0 1-2-2v-2H3v-2h2v-2H3V8h2V6a2 2 0 0 1 2-2h2V2Zm-2 4v12h10V6H7Zm2 2h6v8H9V8Z"/>',
    light: '<path d="M9 5c5 0 9 3 9 7s-4 7-9 7H7V5h2Zm0 2v10c3.6-.2 7-2.2 7-5S12.6 7.2 9 7ZM2 7h4v2H2V7Zm0 4h4v2H2v-2Zm0 4h4v2H2v-2Z"/>',
    mirror: '<path d="M4 6c0-1.1.9-2 2-2h10a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-4v4H8v-4H6a2 2 0 0 1-2-2V6Zm2 0v8h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H6Z"/>',
    door: '<path d="M5 3h14v18H5V3Zm2 2v6h10V5H7Zm0 8v6h10v-6H7Zm7 1h2v2h-2v-2Z"/>',
    car: '<path d="M5 11 7 6h10l2 5h1a2 2 0 0 1 2 2v4h-2v2h-3v-2H7v2H4v-2H2v-4a2 2 0 0 1 2-2h1Zm2.2 0h9.6l-1.2-3H8.4l-1.2 3ZM6 13.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm12 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/>',
    wheel: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>',
    axle: '<path d="M2 9h3V7h3v4h8V7h3v2h3v6h-3v2h-3v-4H8v4H5v-2H2V9Z"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name] || ICONS.car}</svg>`;

  // ---------- API ----------
  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || (data.errors || []).join(' ') || 'Request failed'), { data, status: res.status });
    return data;
  }

  // ---------- storage-safe helpers ----------
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }
  };

  // ---------- cart ----------
  const cart = {
    items: store.get('xa_cart', []),
    save() { store.set('xa_cart', this.items); updateCartBadge(true); },
    add(id, qty = 1) {
      const p = state.byId.get(id); if (!p) return;
      const it = this.items.find((x) => x.id === id);
      const want = (it ? it.qty : 0) + qty;
      if (want > avail(p)) { toast(avail(p) ? `Only ${avail(p)} available.` : 'Sorry, this part just sold out.'); return; }
      if (it) it.qty = want; else this.items.push({ id, qty });
      this.save(); toast(`Added to cart — <a href="#/cart"><u>View cart</u></a>`);
    },
    setQty(id, qty) { const it = this.items.find((x) => x.id === id); if (it) { it.qty = Math.max(1, qty); this.save(); } },
    remove(id) { this.items = this.items.filter((x) => x.id !== id); this.save(); },
    clear() { this.items = []; this.save(); },
    lines() { return this.items.map((it) => ({ ...it, p: state.byId.get(it.id) })).filter((l) => l.p); },
    total() { return this.lines().reduce((s, l) => s + l.p.price * l.qty, 0); }
  };
  function updateCartBadge(bump) {
    const b = $('#cartCount');
    b.textContent = cart.items.reduce((s, i) => s + i.qty, 0);
    if (bump) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  }

  // ---------- toasts ----------
  function toast(html, action) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span>${html}</span>`;
    if (action) {
      const b = document.createElement('button'); b.textContent = action.label; b.onclick = action.run; t.appendChild(b);
    }
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), action ? 12000 : 3500);
  }

  // ---------- rendering helpers ----------
  const gradeTag = (g) => (g ? `<span class="tag tag-${g.toLowerCase()} grade" title="Grade ${g}">Grade ${g}</span>` : '');
  const badge = (p) => (p.grade ? gradeTag(p.grade) : p.condition === "New" ? `<span class="tag tag-new grade">New</span>` : "") + (p.listPrice > p.price ? `<span class="tag tag-sale">Save ${Math.round((1 - p.price / p.listPrice) * 100)}%</span>` : "");
  const listPrice = (p) => (p.listPrice > p.price ? `<s>${money(p.listPrice)}</s>` : '');
  // Real product photo when the store has one, category icon otherwise
  // (if the photo fails to load, the parent drops .has-photo and the icon shows)
  const picture = (p) => (p.image ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy" onerror="this.parentElement.classList.remove('has-photo');this.remove()">` : '') + icon(p.icon);
  function cardMeta(p) {
    const bits = [];
    if (p.brand) bits.push(esc(p.brand));
    if (p.sku && !p.grade) bits.push('Part # ' + esc(p.sku));
    if (p.miles) bits.push(`${p.miles.toLocaleString()} miles`);
    if (p.warrantyMonths) bits.push(`${p.warrantyMonths}-month warranty`);
    return bits.join(' · ');
  }
  function stockLabel(n) {
    if (n == null) return '<span class="stock-in">In stock</span>';
    if (n <= 0) return '<span class="stock-out">Out of stock</span>';
    if (n <= 2) return `<span class="stock-low">Only ${n} left</span>`;
    return `<span class="stock-in">In stock (${n})</span>`;
  }

  function productCard(p) {
    return `<article class="card" data-pid="${p.id}">
      <a href="#/part/${p.id}" class="card-img${p.image ? ' has-photo' : ''}">${badge(p)}${picture(p)}</a>
      <div class="card-body">
        <a href="#/part/${p.id}" class="card-title">${esc(p.title)}</a>
        <div class="card-meta">${cardMeta(p)}</div>
        <div class="price"><span data-live="price">${money(p.price)}</span>${listPrice(p)}</div>
        <div class="card-foot">
          <span data-live="stock">${stockLabel(p.stock)}</span>
          <button class="btn btn-primary" data-add="${p.id}" ${avail(p) ? '' : 'disabled'}>Add</button>
        </div>
      </div>
    </article>`;
  }

  function yearOptions(sel) {
    let o = '<option value="">Year</option>';
    for (let y = 2025; y >= 1995; y--) o += `<option ${String(sel) === String(y) ? 'selected' : ''}>${y}</option>`;
    return o;
  }
  const makeOptions = (sel) => '<option value="">Make</option>' + Object.keys(state.vehicles).map((m) => `<option ${m === sel ? 'selected' : ''}>${esc(m)}</option>`).join('');
  const modelOptions = (make, sel) => '<option value="">Model</option>' + (state.vehicles[make] || []).map((m) => `<option ${m === sel ? 'selected' : ''}>${esc(m)}</option>`).join('');
  const catOptions = (sel, label = 'Part') => `<option value="">${label}</option>` + state.categories.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

  // Year → Make → Model → Part dependent selects
  function bindVehicleSelects(root) {
    const make = $('[name=make]', root), model = $('[name=model]', root);
    if (!make || !model) return;
    make.addEventListener('change', () => { model.innerHTML = modelOptions(make.value); model.disabled = !make.value; });
    model.disabled = !make.value;
  }

  function vehicleFinder() {
    const saved = store.get('xa_vehicle', {});
    // Catalogs without year/make/model data get a category + brand finder instead
    if (!state.hasFitment) return `<form class="finder" id="finder">
      <h2>Find your part</h2>
      <p class="muted" style="margin-top:-4px">Search by part name, part number or brand.</p>
      <div class="steps">
        <input class="full" name="q" placeholder="e.g. fuel filter, brake pads, part #" aria-label="Keyword">
        <select name="category" aria-label="Category">${catOptions(saved.category, 'All categories')}</select>
        <select name="brand" aria-label="Brand"><option value="">All brands</option>${state.brands.map((b) => `<option ${b === saved.brand ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
        <button class="btn btn-primary full" type="submit">Search parts</button>
      </div>
      <p class="muted" style="font-size:13px;margin:12px 0 0">Need help finding the right part? <a href="#/quote" style="color:var(--orange-d);font-weight:600">Ask our experts</a>.</p>
    </form>`;
    return `<form class="finder" id="finder">
      <h2>Find your part</h2>
      <p class="muted" style="margin-top:-4px">Select your vehicle to see matching parts in stock.</p>
      <div class="steps">
        <select name="year" aria-label="Year">${yearOptions(saved.year)}</select>
        <select name="make" aria-label="Make">${makeOptions(saved.make)}</select>
        <select name="model" aria-label="Model">${modelOptions(saved.make, saved.model)}</select>
        <select name="category" aria-label="Part">${catOptions(saved.category)}</select>
        <button class="btn btn-primary full" type="submit">Search parts</button>
      </div>
      <p class="muted" style="font-size:13px;margin:12px 0 0">Can't find it? <a href="#/quote" style="color:var(--orange-d);font-weight:600">Request a free quote</a> — we search our partner network for you.</p>
    </form>`;
  }

  function bindFinder() {
    const f = $('#finder'); if (!f) return;
    bindVehicleSelects(f);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f));
      store.set('xa_vehicle', v);
      const qs = new URLSearchParams(Object.entries(v).filter(([, x]) => x));
      location.hash = '#/shop?' + qs;
    });
  }

  function showErrors(form, errors) {
    let box = $('.errors', form);
    if (!box) { box = document.createElement('div'); box.className = 'errors'; form.prepend(box); }
    box.innerHTML = `<ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ---------- search ----------
  function searchProducts(query) {
    const q = String(query).toLowerCase().trim();
    if (!q) return state.products;
    const tokens = q.split(/\s+/);
    const years = tokens.filter((t) => /^(19|20)\d{2}$/.test(t)).map(Number);
    const words = tokens.filter((t) => !/^(19|20)\d{2}$/.test(t));
    return state.products
      .map((p) => {
        // Year filter only applies to parts with known fitment; otherwise the year must appear in the text
        if (years.length && p.yearFrom && !years.some((y) => y >= p.yearFrom && y <= p.yearTo)) return null;
        const hay = `${p.title} ${p.brand || ''} ${p.make || ''} ${p.model || ''} ${p.categoryName} ${p.category} ${p.subcategory || ''} ${p.sku} ${Object.values(p.spec || {}).join(' ')}`.toLowerCase();
        if (years.length && !p.yearFrom && !years.some((y) => hay.includes(String(y)))) return null;
        let score = 0;
        for (const w of words) {
          if (hay.includes(w)) score += w.length > 3 ? 2 : 1;
          else if (w.length > 3 && hay.includes(w.replace(/s$/, ''))) score += 1;
          else return null;
        }
        return { p, score };
      })
      .filter(Boolean).sort((a, b) => b.score - a.score).map((x) => x.p);
  }

  // Returns results + the corrected query if the original found nothing
  function smartSearch(query) {
    let results = searchProducts(query);
    if (results.length || !query.trim()) return { results, corrected: null };
    const { corrected, changed } = AutoCorrect.correctQuery(query);
    if (changed) {
      results = searchProducts(corrected);
      if (results.length) return { results, corrected };
    }
    return { results: [], corrected: null };
  }

  function bindHeaderSearch() {
    const input = $('#searchInput'), list = $('#suggest'), form = $('#searchForm');
    let hl = -1;
    const close = () => { list.classList.remove('open'); hl = -1; };
    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (q.length < 2) return close();
      const { results, corrected } = smartSearch(q);
      let html = corrected ? `<li class="dym">Did you mean <b data-q="${esc(corrected)}">${esc(corrected)}</b>?</li>` : '';
      html += results.slice(0, 7).map((p) => `<li data-href="#/part/${p.id}"><span>${esc(p.title)}</span><b>${money(p.price)}</b></li>`).join('');
      if (!results.length) html += `<li data-href="#/quote">No exact match — <b>&nbsp;request a quote</b></li>`;
      else html += `<li data-href="#/shop?q=${encodeURIComponent(corrected || q)}"><span>See all ${results.length} results</span></li>`;
      list.innerHTML = html; list.classList.add('open'); hl = -1;
    });
    input.addEventListener('keydown', (e) => {
      const items = $$('li[data-href]', list);
      if (!items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        hl = (hl + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((li, i) => li.classList.toggle('hl', i === hl));
      } else if (e.key === 'Enter' && hl >= 0) {
        e.preventDefault(); location.hash = items[hl].dataset.href; close(); input.blur();
      } else if (e.key === 'Escape') close();
    });
    list.addEventListener('mousedown', (e) => {
      const dym = e.target.closest('[data-q]');
      if (dym) { e.preventDefault(); input.value = dym.dataset.q; input.dispatchEvent(new Event('input')); return; }
      const li = e.target.closest('li[data-href]');
      if (li) { location.hash = li.dataset.href; close(); }
    });
    input.addEventListener('blur', () => setTimeout(close, 150));
    form.addEventListener('submit', (e) => {
      e.preventDefault(); close();
      const q = input.value.trim();
      location.hash = '#/shop' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
  }

  // ---------- pages ----------
  const pages = {};

  // Small line icons for trust/feature blocks
  const TICONS = {
    lock: '<path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1Zm2 0h6V7a3 3 0 0 0-6 0v3Zm3 4a2 2 0 0 0-1 3.7V19h2v-1.3A2 2 0 0 0 12 14Z"/>',
    truck: '<path d="M2 5h12v3h4l4 5v5h-2a3 3 0 0 1-6 0H9a3 3 0 0 1-6 0H2V5Zm12 5v3h6l-2.4-3H14ZM6 17a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm11 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>',
    shield: '<path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1.2 13.6-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4-6.3 6.3Z"/>',
    undo: '<path d="M12 5V1L6 6l6 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8Z"/>',
    headset: '<path d="M12 2a9 9 0 0 0-9 9v6a3 3 0 0 0 3 3h2v-8H5v-1a7 7 0 0 1 14 0v1h-3v8h3v1h-6v2h6a2 2 0 0 0 2-2V11a9 9 0 0 0-9-9Z"/>',
    check: '<path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/>',
    tag: '<path d="M21.4 11.6 12.4 2.6A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .6.2 1.1.6 1.4l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8ZM6.5 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/>',
    star: '<path d="m12 17.3 6.2 3.7-1.6-7 5.4-4.7-7.1-.6L12 2 9.1 8.7 2 9.3l5.4 4.7-1.6 7L12 17.3Z"/>'
  };
  const ticon = (n) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${TICONS[n]}</svg>`;

  const TRUST_POINTS = [
    ['lock', 'Secure checkout', 'Encrypted payments'],
    ['truck', 'Fast shipping', 'Most orders ship in 1 business day'],
    ['undo', '30-day returns', 'Simple, no-hassle returns'],
    ['shield', 'Warranty included', 'Up to 24 months on new parts'],
    ['headset', 'Expert support', 'Mon–Sat, 8am–7pm']
  ];
  const trustBar = () => `<section class="trustbar"><div class="container trustbar-grid">${TRUST_POINTS.map(([i, t, d]) => `<div>${ticon(i)}<span><b>${t}</b><small>${d}</small></span></div>`).join('')}</div></section>`;

  // Shown on every product page, beside the buy box
  const trustBox = () => `<div class="trustbox">
    <div>${ticon('lock')}<span><b>Secure checkout</b> — your details are encrypted</span></div>
    <div>${ticon('shield')}<span><b>Fitment help</b> — not sure? <a href="#/quote">ask our team</a> before you buy</span></div>
    <div>${ticon('headset')}<span><b>Questions?</b> Call <a href="tel:+18005550199">(800) 555-0199</a></span></div>
  </div>`;

  // ---------- verified customer reviews ----------
  // Every review comes from a real order (order number + email checked by the server).
  const stars = (n) => `<span class="stars" aria-label="${n} out of 5 stars">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= Math.round(n) ? 'on' : ''}">${ticon('star')}</span>`).join('')}</span>`;
  const reviewCard = (r, showProduct) => `
    <figure class="review">
      ${stars(r.rating)}
      ${r.title ? `<b class="review-title">${esc(r.title)}</b>` : ''}
      <blockquote>${esc(r.text)}</blockquote>
      ${showProduct ? `<a class="review-product" href="#/part/${encodeURIComponent(r.productId)}">${esc(r.productTitle)}</a>` : ''}
      <figcaption><b>${esc(r.name)}</b> · ${new Date(r.createdAt).toLocaleDateString()} <span class="verified">${ticon('check')} Verified purchase</span></figcaption>
    </figure>`;

  async function loadReviews(target, productId) {
    const box = typeof target === 'string' ? $(target) : target;
    if (!box) return;
    try {
      const data = await api('/api/reviews?limit=' + (productId ? 20 : 6) + (productId ? '&product=' + encodeURIComponent(productId) : ''));
      if (!document.body.contains(box)) return; // page changed while loading
      const summary = $('[data-review-summary]', box.parentElement) || null;
      if (summary) summary.innerHTML = data.count ? `${stars(data.average)} <b>${data.average}</b> <span class="muted">out of 5 · ${data.count} verified review${data.count === 1 ? '' : 's'}</span>` : '';
      box.innerHTML = data.count ? `<div class="reviews">${data.reviews.map((r) => reviewCard(r, !productId)).join('')}</div>` : `
        <div class="empty reviews-empty">
          <h3>${productId ? 'No reviews for this part yet' : 'Reviews from verified customers'}</h3>
          <p class="muted">Every review on XoraLure comes from a real order — no paid or invented reviews. ${productId ? 'Bought this part?' : 'Ordered from us?'} Share your experience.</p>
          <a class="btn btn-ghost" href="#/review${productId ? '?product=' + encodeURIComponent(productId) : ''}">Write a review</a>
        </div>`;
    } catch { box.innerHTML = ''; }
  }

  pages.home = () => {
    const inStock = (p) => avail(p) > 0;
    const featured = [...state.products].filter((p) => inStock(p) && (!p.grade || p.grade === 'A'))
      .sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0) || (b.listPrice > b.price) - (a.listPrice > a.price) || b.updatedAt - a.updatedAt).slice(0, 8);
    const deals = state.products.filter((p) => inStock(p) && p.listPrice > p.price)
      .sort((a, b) => (1 - a.price / a.listPrice) < (1 - b.price / b.listPrice) ? 1 : -1).slice(0, 4);
    const counts = state.products.reduce((m, p) => (m[p.category] = (m[p.category] || 0) + 1, m), {});
    const brandCounts = state.products.reduce((m, p) => (p.brand && (m[p.brand] = (m[p.brand] || 0) + 1), m), {});
    const faq = [
      state.hasGrades && ['What do the A, B and C grades mean on used parts?', 'Grade A parts have the lowest miles and best condition. Grade B shows normal wear. Grade C is fully functional with cosmetic wear and the lowest price. Every used part is tested before it ships.'],
      ['How do I make sure the part fits?', 'Use the vehicle finder, then check the part number and details on the product page. Still not sure? Send us your vehicle details or 17-character VIN and our team will confirm fitment before you buy.'],
      ['How long does shipping take?', 'Most orders leave our warehouse within one business day and arrive in 3–5 business days. Large items such as engines ship by freight in 5–8 business days.'],
      ['What if I need to return something?', 'Unused parts can be returned within 30 days of delivery. See our <a href="#/warranty" style="color:var(--orange-d)">warranty & returns policy</a>.'],
      ['Is checkout secure?', 'Yes. Checkout runs over an encrypted connection and we never store full card numbers on our servers.']
    ].filter(Boolean);
    return `
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <span class="eyebrow">Trusted auto parts, delivered</span>
          <h1>The right part, <span>at the right price.</span></h1>
          <p>New aftermarket and quality-tested used OEM parts — searchable in seconds, priced fairly and backed by a real warranty.</p>
          <div class="hero-points"><span>Fitment help from experts</span><span>Fast shipping</span><span>30-day returns</span><span>Secure checkout</span></div>
          <div class="hero-stats">
            <div><b>${state.products.length.toLocaleString()}</b><small>parts in stock</small></div>
            <div><b>${state.categories.length}</b><small>categories</small></div>
            <div><b>${Object.keys(state.vehicles).length}+</b><small>vehicle makes</small></div>
          </div>
        </div>
        ${vehicleFinder()}
      </div>
    </section>
    ${trustBar()}

    <section class="section">
      <div class="container">
        <div class="section-head"><div><span class="kicker">Browse</span><h2>Shop by category</h2></div><a href="#/shop" class="link-more">View all parts →</a></div>
        <div class="cat-grid">
          ${state.categories.filter((c) => counts[c.id]).map((c) => `<a class="cat" href="#/shop?category=${encodeURIComponent(c.id)}">${icon(c.icon)}<div>${esc(c.name)}</div><small>${counts[c.id]} products</small></a>`).join('')}
        </div>
      </div>
    </section>

    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="section-head"><div><span class="kicker">Hand-picked</span><h2>Featured parts</h2></div><span class="muted">Prices and stock refresh automatically</span></div>
        <div class="grid">${featured.map(productCard).join('')}</div>
      </div>
    </section>

    ${deals.length ? `<section class="section deals-band">
      <div class="container">
        <div class="section-head"><div><span class="kicker">Limited stock</span><h2>Today's best deals</h2></div><a href="#/shop?sort=price-asc&instock=1" class="link-more">See more deals →</a></div>
        <div class="grid">${deals.map(productCard).join('')}</div>
      </div>
    </section>` : ''}

    ${state.brands.length ? `<section class="section">
      <div class="container">
        <div class="section-head"><div><span class="kicker">Quality you can count on</span><h2>Shop by brand</h2></div></div>
        <div class="brand-strip">${state.brands.map((b) => `<a href="#/shop?brand=${encodeURIComponent(b)}"><b>${esc(b)}</b><small>${brandCounts[b]} parts</small></a>`).join('')}</div>
      </div>
    </section>` : ''}

    <section class="section steps-band">
      <div class="container">
        <div class="section-head"><div><span class="kicker">Simple</span><h2>How it works</h2></div></div>
        <div class="how">
          <div><h3>Find your part</h3><p>${state.hasFitment ? 'Pick your year, make and model' : 'Search by part name, number or brand'} — or ask us with your VIN.</p></div>
          <div><h3>Compare & choose</h3><p>See condition, specs, warranty and live price before you add to cart.</p></div>
          <div><h3>Fast delivery</h3><p>Orders are packed and shipped quickly, with tracking on every order.</p></div>
          <div><h3>We've got your back</h3><p>Warranty coverage plus a 30-day return window.</p></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head"><div><span class="kicker">Why XoraLure</span><h2>Buy with confidence</h2></div></div>
        <div class="why">
          <div>${ticon('check')}<h3>Fitment you can trust</h3><p>Every listing shows exact year, make and model coverage. Our specialists will double-check fitment with your VIN on request.</p></div>
          <div>${ticon('shield')}<h3>Real warranty coverage</h3><p>Up to 24 months on new parts and up to 12 months on used drivetrain parts — clearly listed on every product.</p></div>
          <div>${ticon('tag')}<h3>Honest, upfront pricing</h3><p>The price you see is the price you pay. No hidden fees at checkout, and shipping costs are shown before you order.</p></div>
          <div>${ticon('headset')}<h3>Real people, real answers</h3><p>Talk to parts specialists who know cars — by phone, email or the contact form.</p></div>
        </div>
      </div>
    </section>

    <section class="section reviews-band">
      <div class="container">
        <div class="section-head"><div><span class="kicker">Customer reviews</span><h2>What customers say</h2><div class="review-summary" data-review-summary></div></div><a href="#/review" class="link-more">Write a review →</a></div>
        <div id="homeReviews"><p class="muted">Loading reviews…</p></div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head"><div><span class="kicker">Help center</span><h2>Frequently asked questions</h2></div></div>
        ${faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
      </div>
    </section>

    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="cta"><div><h2>Can't find the part you need?</h2><p style="margin:6px 0 0">Tell us what you're looking for and a parts specialist will get back to you fast.</p></div><a href="#/quote" class="btn">Ask an expert</a></div>
      </div>
    </section>

    <section class="section newsletter-band">
      <div class="container newsletter">
        <div><h2>Get deals & maintenance tips</h2><p>Occasional emails with exclusive discounts. Unsubscribe any time.</p></div>
        <form id="newsletter" novalidate>
          <div class="field" style="margin:0;flex:1"><input name="email" type="email" data-autofix="email" placeholder="you@example.com" aria-label="Email address" required></div>
          <button class="btn btn-primary">Subscribe</button>
        </form>
      </div>
    </section>`;
  };
  pages.home.after = () => {
    bindFinder();
    loadReviews('#homeReviews');
    const form = $('#newsletter'); if (!form) return;
    AutoCorrect.attach(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('[name=email]', form);
      input.dispatchEvent(new Event('blur'));
      try {
        await api('/api/subscribe', { method: 'POST', body: { email: input.value } });
        form.innerHTML = '<p class="stock-in" style="margin:0;font-size:16px">✓ You\'re subscribed — thanks!</p>';
      } catch (err) { toast(esc(err.message)); }
    });
  };

  pages.shop = (params) => {
    const f = {
      q: params.get('q') || '', year: params.get('year') || '', make: params.get('make') || '',
      model: params.get('model') || '', category: params.get('category') || '', brand: params.get('brand') || '',
      grade: params.get('grade') || '', cond: params.get('cond') || '', instock: params.get('instock') === '1', sort: params.get('sort') || 'relevance'
    };
    let { results, corrected } = smartSearch(f.q);
    if (f.year) results = results.filter((p) => +f.year >= p.yearFrom && +f.year <= p.yearTo);
    if (f.make) results = results.filter((p) => p.make === f.make);
    if (f.model) results = results.filter((p) => p.model === f.model);
    if (f.category) results = results.filter((p) => p.category === f.category);
    if (f.brand) results = results.filter((p) => p.brand === f.brand);
    if (f.grade) results = results.filter((p) => p.grade === f.grade);
    if (f.cond) results = results.filter((p) => (f.cond === 'new' ? p.condition === 'New' : p.condition !== 'New'));
    if (f.instock) results = results.filter((p) => avail(p) > 0);
    const sorters = { 'price-asc': (a, b) => a.price - b.price, 'price-desc': (a, b) => b.price - a.price, name: (a, b) => a.title.localeCompare(b.title), newest: (a, b) => (b.yearTo || 0) - (a.yearTo || 0), miles: (a, b) => (a.miles ?? 1e9) - (b.miles ?? 1e9) };
    if (sorters[f.sort]) results = [...results].sort(sorters[f.sort]);
    const sortOpts = [['relevance', 'Best match'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['name', 'Name A–Z']];
    if (state.hasFitment) sortOpts.push(['newest', 'Newest vehicles']);
    if (state.products.some((p) => p.miles)) sortOpts.push(['miles', 'Lowest miles']);

    // Paginate big catalogs so the page stays fast
    const PER = 48, page = Math.max(1, parseInt(params.get('page'), 10) || 1), pages = Math.ceil(results.length / PER);
    const shown = results.slice((page - 1) * PER, page * PER);
    const pageLink = (n) => { const q = new URLSearchParams(params); q.set('page', n); return '#/shop?' + q; };

    const vehicle = [f.year, f.make, f.model].filter(Boolean).join(' ');
    const catName = state.categories.find((c) => c.id === f.category)?.name;
    const heading = esc([vehicle, f.brand, catName].filter(Boolean).join(' ')) || (f.q ? `Results for “${esc(corrected || f.q)}”` : 'All parts');

    return `<div class="container shop">
      <form class="filters" id="filters">
        <h3>Filter parts</h3>
        <div class="field"><label>Keyword</label><input name="q" value="${esc(f.q)}" placeholder="Part name or number"></div>
        ${state.hasFitment ? `
        <div class="field"><label>Year</label><select name="year">${yearOptions(f.year)}</select></div>
        <div class="field"><label>Make</label><select name="make">${makeOptions(f.make)}</select></div>
        <div class="field"><label>Model</label><select name="model">${modelOptions(f.make, f.model)}</select></div>` : ''}
        <div class="field"><label>Category</label><select name="category">${catOptions(f.category, 'All categories')}</select></div>
        ${state.brands.length ? `<div class="field"><label>Brand</label><select name="brand"><option value="">All brands</option>${state.brands.map((b) => `<option ${b === f.brand ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></div>` : ''}
        ${state.hasNew && state.hasGrades ? `<div class="field"><label>Condition</label><select name="cond"><option value="">New & used</option><option value="new" ${f.cond === 'new' ? 'selected' : ''}>New</option><option value="used" ${f.cond === 'used' ? 'selected' : ''}>Used (OEM)</option></select></div>` : ''}
        ${state.hasGrades ? `<div class="field"><label>Grade</label><select name="grade"><option value="">Any grade</option>${['A', 'B', 'C'].map((g) => `<option ${g === f.grade ? 'selected' : ''}>${g}</option>`).join('')}</select></div>` : ''}
        <div class="field"><label style="display:flex;gap:8px;align-items:center;font-weight:500"><input type="checkbox" name="instock" value="1" ${f.instock ? 'checked' : ''} style="width:auto"> In stock only</label></div>
        <button class="btn btn-primary btn-block">Apply filters</button>
        <a href="#/shop" class="btn btn-ghost btn-block" style="margin-top:8px">Clear all</a>
      </form>
      <div>
        ${corrected ? `<div class="notice">Showing results for <b>${esc(corrected)}</b>. No results for “${esc(f.q)}”.</div>` : ''}
        <div class="toolbar">
          <div><h2 style="margin:0;font-size:22px">${heading}</h2><span class="muted">${results.length.toLocaleString()} part${results.length === 1 ? '' : 's'} found</span></div>
          <select id="sort" aria-label="Sort">
            ${sortOpts.map(([v, l]) => `<option value="${v}" ${v === f.sort ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        ${results.length ? `<div class="grid">${shown.map(productCard).join('')}</div>
          ${pages > 1 ? `<div class="pager">${page > 1 ? `<a class="btn btn-ghost" href="${pageLink(page - 1)}">← Previous</a>` : ''}<span class="muted">Page ${page} of ${pages}</span>${page < pages ? `<a class="btn btn-ghost" href="${pageLink(page + 1)}">Next →</a>` : ''}</div>` : ''}` : `
          <div class="empty"><h3>No parts match right now</h3><p class="muted">Inventory changes daily. Tell us what you need and we'll help you find it.</p>
          <a class="btn btn-primary" href="#/quote?${new URLSearchParams({ year: f.year, make: f.make, model: f.model, part: catName || f.q })}">Ask about this part</a></div>`}
      </div>
    </div>`;
  };
  pages.shop.after = () => {
    const form = $('#filters');
    bindVehicleSelects(form);
    const go = () => {
      const data = new FormData(form);
      data.set('sort', $('#sort').value);
      const qs = new URLSearchParams([...data].filter(([, v]) => v && v !== 'relevance'));
      location.hash = '#/shop' + (String(qs) ? '?' + qs : '');
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); go(); });
    $$('select', form).forEach((s) => s.addEventListener('change', go));
    $('[name=instock]', form).addEventListener('change', go);
    $('#sort').addEventListener('change', go);
  };

  pages.part = (params, id) => {
    const p = state.byId.get(id);
    if (!p) return `<div class="container page"><div class="empty"><h2>Part not found</h2><p class="muted">It may have sold. Try searching for a similar part.</p><a class="btn btn-primary" href="#/shop">Browse parts</a></div></div>`;
    const related = state.products.filter((x) => x.id !== p.id && ((p.make && x.make === p.make && x.model === p.model) || x.category === p.category))
      .sort((a, b) => (b.subcategory === p.subcategory) - (a.subcategory === p.subcategory)).slice(0, 4);
    const specRows = [
      p.brand && ['Brand', p.brand], p.sku && [p.grade ? 'SKU' : 'Part number', p.sku],
      p.make && ['Fits', `${p.yearFrom}–${p.yearTo} ${p.make} ${p.model}`],
      ['Category', p.subcategory ? `${p.categoryName} › ${p.subcategory}` : p.categoryName],
      p.grade ? ['Condition', `Grade ${p.grade} — ${p.condition}`] : p.condition && ['Condition', p.condition], p.miles && ['Mileage', p.miles.toLocaleString() + ' miles'],
      ...Object.entries(p.spec || {}).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), v]),
      p.warrantyMonths && ['Warranty', `${p.warrantyMonths} months`], p.shipping && ['Shipping', p.shipping]
    ].filter(Boolean);
    return `<div class="container">
      <nav class="crumbs"><a href="#/">Home</a> / <a href="#/shop?category=${encodeURIComponent(p.category)}">${esc(p.categoryName)}</a>${p.make ? ` / ${esc(p.make)} ${esc(p.model)}` : p.brand ? ` / ${esc(p.brand)}` : ''}</nav>
      <div class="pdp" data-pid="${p.id}">
        <div class="card-img${p.image ? ' has-photo' : ''}">${badge(p)}${picture(p)}</div>
        <div>
          <h1>${esc(p.title)}</h1>
          <div class="price"><span data-live="price">${money(p.price)}</span>${listPrice(p)}</div>
          <p data-live="stock" style="margin:6px 0 16px">${stockLabel(p.stock)}</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <div class="qty"><button type="button" data-q="-1" aria-label="Decrease">−</button><input id="qty" value="1" inputmode="numeric" aria-label="Quantity"><button type="button" data-q="1" aria-label="Increase">+</button></div>
            <button class="btn btn-primary" id="addBtn" ${avail(p) ? '' : 'disabled'} style="flex:1">Add to cart</button>
          </div>
          <a class="btn btn-ghost btn-block" style="margin-top:10px" href="#/quote?${new URLSearchParams({ year: p.yearFrom || '', make: p.make || '', model: p.model || '', part: p.sku ? `${p.title} (#${p.sku})` : p.title })}">Not sure it fits? Ask an expert</a>
          <table class="spec">${specRows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
          ${p.description ? `<h3>Description</h3><div class="desc">${esc(p.description)}</div>` : ''}
          <div class="perks"><span>${p.grade ? 'Tested and inspected before shipping' : 'Brand-new, in original packaging'}</span><span>Secure checkout</span><span>30-day hassle-free returns</span></div>
          ${trustBox()}
          <p class="muted" style="font-size:12px;margin-top:14px">Price and stock update live · last change <span data-live="updated">${new Date(p.updatedAt).toLocaleTimeString()}</span></p>
        </div>
      </div>
      <section class="pdp-reviews">
        <div class="section-head"><div><h2>Customer reviews</h2><div class="review-summary" data-review-summary></div></div><a class="link-more" href="#/review?product=${encodeURIComponent(p.id)}">Write a review →</a></div>
        <div id="productReviews"><p class="muted">Loading reviews…</p></div>
      </section>
      ${related.length ? `<div class="section-head"><h2>Related parts</h2></div><div class="grid" style="margin-bottom:56px">${related.map(productCard).join('')}</div>` : ''}
    </div>`;
  };
  pages.part.after = (params, id) => {
    loadReviews('#productReviews', id);
    const qty = $('#qty'); if (!qty) return;
    const clamp = () => { const p = state.byId.get(id); qty.value = Math.max(1, Math.min(avail(p) || 1, parseInt(qty.value, 10) || 1)); };
    $$('[data-q]').forEach((b) => b.addEventListener('click', () => { qty.value = (+qty.value || 1) + +b.dataset.q; clamp(); }));
    qty.addEventListener('change', clamp);
    $('#addBtn').addEventListener('click', () => cart.add(id, +qty.value || 1));
  };

  pages.cart = () => {
    const lines = cart.lines();
    if (!lines.length) return `<div class="container page"><div class="empty"><h2>Your cart is empty</h2><p class="muted">Find the right part for your vehicle in seconds.</p><a class="btn btn-primary" href="#/shop">Shop parts</a></div></div>`;
    return `<div class="container page"><h1>Your cart</h1>
      <div class="two-col">
        <div class="panel">${lines.map((l) => `
          <div class="line" data-pid="${l.p.id}">
            <div class="thumb${l.p.image ? ' has-photo' : ''}">${picture(l.p)}</div>
            <div><a href="#/part/${l.p.id}" style="font-weight:600">${esc(l.p.title)}</a>
              <div class="card-meta">${l.p.grade ? `Grade ${l.p.grade}` : l.p.sku ? `Part # ${esc(l.p.sku)}` : ''} · <span data-live="stock">${stockLabel(l.p.stock)}</span></div>
              <div style="display:flex;gap:12px;align-items:center;margin-top:6px">
                <div class="qty"><button data-dec="${l.p.id}" aria-label="Decrease">−</button><input value="${l.qty}" readonly aria-label="Quantity"><button data-inc="${l.p.id}" aria-label="Increase">+</button></div>
                <button class="link-btn" data-remove="${l.p.id}">Remove</button>
              </div>
            </div>
            <b data-live="price">${money(l.p.price)}</b>
          </div>`).join('')}
        </div>
        <aside class="panel">
          <h3>Order summary</h3>
          <div class="sum"><span>Subtotal</span><span id="subtotal">${money(cart.total())}</span></div>
          <div class="sum"><span>Shipping</span><span style="color:var(--green)">FREE</span></div>
          <div class="sum total"><span>Total</span><span id="grandTotal">${money(cart.total())}</span></div>
          <a href="#/checkout" class="btn btn-primary btn-block" style="margin-top:14px">Checkout</a>
          <a href="#/shop" class="btn btn-ghost btn-block" style="margin-top:8px">Continue shopping</a>
        </aside>
      </div></div>`;
  };
  pages.cart.after = () => {
    app.addEventListener('click', cartClicks);
  };
  function cartClicks(e) {
    const t = e.target.closest('[data-inc],[data-dec],[data-remove]'); if (!t) return;
    if (t.dataset.remove) cart.remove(t.dataset.remove);
    else {
      const id = t.dataset.inc || t.dataset.dec, it = cart.items.find((x) => x.id === id), p = state.byId.get(id);
      const n = it.qty + (t.dataset.inc ? 1 : -1);
      if (n > avail(p)) return toast(`Only ${avail(p)} available.`);
      cart.setQty(id, n);
    }
    render();
  }

  pages.checkout = () => {
    const lines = cart.lines();
    if (!lines.length) { location.hash = '#/cart'; return ''; }
    const c = store.get('xa_customer', {});
    return `<div class="container page"><h1>Checkout</h1>
      <div class="two-col">
        <form class="panel" id="checkoutForm" novalidate>
          <h3>Contact</h3>
          <div class="field"><label for="c-name">Full name</label><input id="c-name" name="name" data-autofix="name" autocomplete="name" value="${esc(c.name)}" required></div>
          <div class="row">
            <div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" data-autofix="email" autocomplete="email" value="${esc(c.email)}" required></div>
            <div class="field"><label for="c-phone">Phone</label><input id="c-phone" name="phone" type="tel" data-autofix="phone" autocomplete="tel" value="${esc(c.phone)}" required></div>
          </div>
          <h3 style="margin-top:8px">Shipping address</h3>
          <div class="field"><label for="c-addr">Street address</label><input id="c-addr" name="address" data-autofix="address" autocomplete="street-address" value="${esc(c.address)}" required></div>
          <div class="row-3">
            <div class="field"><label for="c-city">City</label><input id="c-city" name="city" data-autofix="city" autocomplete="address-level2" value="${esc(c.city)}" required></div>
            <div class="field"><label for="c-state">State</label><input id="c-state" name="state" data-autofix="state" autocomplete="address-level1" value="${esc(c.state)}" placeholder="TX" required></div>
            <div class="field"><label for="c-zip">ZIP</label><input id="c-zip" name="zip" data-autofix="zip" autocomplete="postal-code" inputmode="numeric" value="${esc(c.zip)}" required></div>
          </div>
          <h3 style="margin-top:8px">Payment</h3>
          <p class="notice" style="margin-top:0">Demo store: no card is charged. Connect Stripe or another payment provider in <code>server.js</code> before going live.</p>
          <button class="btn btn-primary btn-block" id="placeOrder">Place order · ${money(cart.total())}</button>
        </form>
        <aside class="panel">
          <h3>Order summary</h3>
          ${lines.map((l) => `<div class="sum" data-pid="${l.p.id}"><span>${l.qty} × ${esc(l.p.title)}</span><b data-live="price">${money(l.p.price)}</b></div>`).join('')}
          <div class="sum"><span>Shipping</span><span style="color:var(--green)">FREE</span></div>
          <div class="sum total"><span>Total</span><span id="grandTotal">${money(cart.total())}</span></div>
        </aside>
      </div></div>`;
  };
  pages.checkout.after = () => {
    const form = $('#checkoutForm'); if (!form) return;
    AutoCorrect.attach(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      $$('[data-autofix]', form).forEach((el) => el.dispatchEvent(new Event('blur')));
      const data = Object.fromEntries(new FormData(form));
      store.set('xa_customer', data);
      const btn = $('#placeOrder'); btn.disabled = true; btn.textContent = 'Placing order…';
      try {
        const res = await api('/api/order', { method: 'POST', body: { ...data, items: cart.items } });
        store.set('xa_last_order', { id: res.id, email: data.email });
        cart.clear();
        location.hash = `#/order/${res.id}`;
      } catch (err) {
        showErrors(form, err.data?.errors || [err.message]);
        btn.disabled = false; btn.textContent = `Place order · ${money(cart.total())}`;
      }
    });
  };

  // Write a review — verified buyers only (order number + email)
  pages.review = (params) => {
    const last = store.get('xa_last_order', {});
    return `<div class="container page narrow">
      <h1>Write a review</h1>
      <p class="muted">Reviews on XoraLure come only from verified customers. Enter your order number and the email you ordered with.</p>
      <form class="panel" id="reviewForm" novalidate>
        <div class="row">
          <div class="field"><label for="r-order">Order number</label><input id="r-order" name="orderId" value="${esc(params.get('order') || last.id || '')}" placeholder="XA…" style="text-transform:uppercase" required></div>
          <div class="field"><label for="r-email">Email</label><input id="r-email" name="email" type="email" data-autofix="email" value="${esc(params.get('email') || last.email || '')}" required></div>
        </div>
        <button type="button" class="btn btn-ghost btn-block" id="findOrder">Find my order</button>
        <div id="reviewStep2" hidden>
          <div class="field" style="margin-top:16px"><label for="r-product">Product</label><select id="r-product" name="productId"></select></div>
          <div class="field"><label>Your rating</label>
            <div class="star-input" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<label title="${n} star${n > 1 ? 's' : ''}"><input type="radio" name="rating" value="${n}"><span>${ticon('star')}</span></label>`).join('')}</div>
          </div>
          <div class="field"><label for="r-title">Headline <span class="muted" style="font-weight:400">(optional)</span></label><input id="r-title" name="title" maxlength="120" placeholder="Sum it up in a few words"></div>
          <div class="field"><label for="r-text">Your review</label><textarea id="r-text" name="text" rows="5" maxlength="2000" placeholder="How was the part, the fit, shipping and support?" required></textarea></div>
          <p class="muted" style="font-size:13px">Only your first name and last initial are shown.</p>
          <button class="btn btn-primary btn-block" id="reviewBtn">Submit review</button>
        </div>
      </form>
    </div>`;
  };
  pages.review.after = (params) => {
    const form = $('#reviewForm');
    AutoCorrect.attach(form);
    const want = params.get('product');
    const find = async () => {
      $('#r-email').dispatchEvent(new Event('blur'));
      const id = $('#r-order').value.trim().toUpperCase(), email = $('#r-email').value.trim();
      if (!id || !email) return showErrors(form, ['Enter your order number and email.']);
      try {
        const o = await api(`/api/orders/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`);
        $('#r-product').innerHTML = o.lines.map((l) => `<option value="${esc(l.id)}" ${l.id === want ? 'selected' : ''}>${esc(l.title)}</option>`).join('');
        $('#reviewStep2').hidden = false; $('#findOrder').hidden = true;
        const box = $('.errors', form); if (box) box.remove();
      } catch (err) { showErrors(form, [err.message]); }
    };
    $('#findOrder').addEventListener('click', find);
    if ($('#r-order').value && $('#r-email').value && (params.get('order') || want)) find();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if ($('#reviewStep2').hidden) return find();
      const data = Object.fromEntries(new FormData(form));
      const btn = $('#reviewBtn'); btn.disabled = true; btn.textContent = 'Submitting…';
      try {
        const r = await api('/api/reviews', { method: 'POST', body: data });
        app.innerHTML = `<div class="container page narrow"><div class="panel success"><div class="check">✓</div>
          <h1>Thank you for your review!</h1><p class="muted">It's now live on the product page.</p>
          <a class="btn btn-primary" href="#/part/${encodeURIComponent(r.productId)}">See your review</a></div></div>`;
      } catch (err) {
        showErrors(form, err.data?.errors || [err.message]);
        btn.disabled = false; btn.textContent = 'Submit review';
      }
    });
  };

  pages.order = (params, id) => {
    const last = store.get('xa_last_order', {});
    return `<div class="container page narrow"><div class="panel success">
      <div class="check">✓</div>
      <h1>Thank you — your order is confirmed!</h1>
      <p>Order number <b>${esc(id)}</b>. A confirmation will be sent to <b>${esc(last.email || 'your email')}</b>.</p>
      <p class="muted">Our team inspects and packs every part before shipping. You can track progress any time.</p>
      <a class="btn btn-primary" href="#/track?id=${encodeURIComponent(id)}&email=${encodeURIComponent(last.email || '')}">Track this order</a>
    </div></div>`;
  };

  pages.quote = (params) => {
    const c = store.get('xa_customer', {});
    const v = { year: params.get('year') || '', make: params.get('make') || '', model: params.get('model') || '', part: params.get('part') || '' };
    return `<div class="container page narrow">
      <h1>Request a free part quote</h1>
      <p class="muted">Tell us about your vehicle. A parts specialist will reply with price and availability, usually within one business hour.</p>
      <form class="panel" id="quoteForm" novalidate>
        <div class="row-3" style="grid-template-columns:1fr 1fr 1fr">
          <div class="field"><label>Year</label><select name="year" required>${yearOptions(v.year)}</select></div>
          <div class="field"><label>Make</label><select name="make" required>${makeOptions(v.make)}</select></div>
          <div class="field"><label>Model</label><select name="model" required>${modelOptions(v.make, v.model)}</select></div>
        </div>
        <div class="field"><label for="q-part">Part needed</label><input id="q-part" name="part" value="${esc(v.part)}" placeholder="e.g. transmission, driver side mirror" required></div>
        <div class="field"><label for="q-vin">VIN <span class="muted" style="font-weight:400">(optional, guarantees fitment)</span></label><input id="q-vin" name="vin" data-autofix="vin" maxlength="17" placeholder="17 characters" style="text-transform:uppercase;letter-spacing:1px"><small class="muted" id="vinCount"></small></div>
        <div class="field"><label for="q-name">Full name</label><input id="q-name" name="name" data-autofix="name" value="${esc(c.name)}" required></div>
        <div class="row">
          <div class="field"><label for="q-email">Email</label><input id="q-email" name="email" type="email" data-autofix="email" value="${esc(c.email)}" required></div>
          <div class="field"><label for="q-phone">Phone</label><input id="q-phone" name="phone" type="tel" data-autofix="phone" value="${esc(c.phone)}" required></div>
        </div>
        <div class="field"><label for="q-zip">ZIP code</label><input id="q-zip" name="zip" data-autofix="zip" inputmode="numeric" value="${esc(c.zip)}"></div>
        <div class="field"><label for="q-notes">Notes</label><textarea id="q-notes" name="notes" rows="3" placeholder="Engine size, options, part numbers…"></textarea></div>
        <button class="btn btn-primary btn-block" id="quoteBtn">Get my free quote</button>
      </form>
    </div>`;
  };
  pages.quote.after = () => {
    const form = $('#quoteForm');
    bindVehicleSelects(form);
    AutoCorrect.attach(form);
    const vin = $('#q-vin'), count = $('#vinCount');
    vin.addEventListener('input', () => { count.textContent = vin.value ? `${vin.value.length}/17` : ''; });
    // Part name gets the same spelling correction as search
    $('#q-part').addEventListener('blur', (e) => {
      const { corrected, changed } = AutoCorrect.correctQuery(e.target.value);
      if (changed && e.target.value) {
        const before = e.target.value; e.target.value = corrected;
        const n = document.createElement('small'); n.className = 'autofix-note'; n.textContent = `Auto-corrected from “${before}”`;
        e.target.parentElement.appendChild(n); setTimeout(() => n.remove(), 4000);
      }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      $$('[data-autofix]', form).forEach((el) => el.dispatchEvent(new Event('blur')));
      const data = Object.fromEntries(new FormData(form));
      const btn = $('#quoteBtn'); btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const res = await api('/api/quote', { method: 'POST', body: data });
        store.set('xa_customer', { ...store.get('xa_customer', {}), name: data.name, email: data.email, phone: data.phone, zip: data.zip });
        app.innerHTML = `<div class="container page narrow"><div class="panel success"><div class="check">✓</div>
          <h1>Quote request received</h1><p>Reference <b>${esc(res.id)}</b>. We'll contact you at <b>${esc(data.email)}</b> shortly.</p>
          <a class="btn btn-primary" href="#/shop">Keep browsing</a></div></div>`;
      } catch (err) {
        showErrors(form, err.data?.errors || [err.message]);
        btn.disabled = false; btn.textContent = 'Get my free quote';
      }
    });
  };

  pages.track = (params) => {
    const last = store.get('xa_last_order', {});
    return `<div class="container page narrow">
      <h1>Track your order</h1>
      <form class="panel" id="trackForm" novalidate>
        <div class="row">
          <div class="field"><label for="t-id">Order number</label><input id="t-id" name="id" value="${esc(params.get('id') || last.id || '')}" placeholder="XA…" style="text-transform:uppercase" required></div>
          <div class="field"><label for="t-email">Email</label><input id="t-email" name="email" type="email" data-autofix="email" value="${esc(params.get('email') || last.email || '')}" required></div>
        </div>
        <button class="btn btn-primary btn-block">Track order</button>
      </form>
      <div id="trackResult" style="margin-top:18px"></div>
    </div>`;
  };
  pages.track.after = (params) => {
    const form = $('#trackForm');
    AutoCorrect.attach(form);
    const run = async () => {
      const id = $('#t-id').value.trim().toUpperCase(), email = $('#t-email').value.trim();
      const out = $('#trackResult');
      if (!id || !email) return;
      try {
        const o = await api(`/api/orders/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`);
        const stages = ['Processing', 'Inspected & Packed', 'Shipped', 'Delivered'];
        const at = stages.indexOf(o.status);
        out.innerHTML = `<div class="panel"><h3>Order ${esc(o.id)} — ${esc(o.status)}</h3>
          <div class="timeline">${stages.map((s, i) => `<div class="${i <= at ? 'done' : ''}"><i></i>${s}</div>`).join('')}</div>
          ${o.lines.map((l) => `<div class="sum"><span>${l.qty} × ${esc(l.title)}<br><a class="link-more" style="font-size:13px" href="#/review?order=${encodeURIComponent(o.id)}&email=${encodeURIComponent(email)}&product=${encodeURIComponent(l.id)}">Review this part →</a></span><b>${money(l.price * l.qty)}</b></div>`).join('')}
          <div class="sum total"><span>Total</span><span>${money(o.total)}</span></div>
          <p class="muted">Shipping to ${esc(o.shipTo.city)}, ${esc(o.shipTo.state)} · placed ${new Date(o.createdAt).toLocaleString()}</p></div>`;
      } catch (err) { out.innerHTML = `<div class="errors">${esc(err.message)}</div>`; }
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); $('#t-email').dispatchEvent(new Event('blur')); run(); });
    if (params.get('id') && params.get('email')) run();
  };

  const policy = (title, body) => `<div class="container page narrow"><h1>${title}</h1>${body}<p class="muted" style="font-size:13px;margin-top:28px">Template policy — review and adapt with your legal advisor before launch.</p></div>`;
  pages.shipping = () => policy('Shipping policy', `
    <h3>Processing time</h3><p>Most in-stock orders are packed and shipped within one business day. Orders placed after 2pm or on Sundays ship the next business day.</p>
    <h3>Delivery time</h3><p>Standard ground delivery usually takes 3–5 business days in the contiguous United States. Engines, transmissions and other oversized items ship by freight in 5–8 business days.</p>
    <h3>Tracking</h3><p>You'll receive a tracking number by email when your order ships. You can also check status any time on the <a href="#/track" style="color:var(--orange-d)">order tracking page</a>.</p>
    <h3>Damaged in transit</h3><p>Please inspect your package on arrival. If anything is damaged, contact us within 48 hours with photos and we'll arrange a replacement.</p>`);
  pages.privacy = () => policy('Privacy policy', `
    <h3>What we collect</h3><p>Your name, email, phone and shipping address when you order, request a quote or contact us, plus your vehicle details when you provide them.</p>
    <h3>How we use it</h3><p>To process and ship orders, answer your questions, confirm part fitment and — only if you subscribe — send occasional emails about deals.</p>
    <h3>What we never do</h3><p>We never sell your personal information, and we never store full payment card numbers on our servers.</p>
    <h3>Your choices</h3><p>You can unsubscribe from emails at any time and ask us to view or delete your data by <a href="#/contact" style="color:var(--orange-d)">contacting us</a>.</p>`);
  pages.terms = () => policy('Terms of service', `
    <h3>Orders</h3><p>All orders are subject to availability and confirmation of the order price. We may cancel an order if a part is out of stock or a listing contains an error, and will refund you in full.</p>
    <h3>Fitment</h3><p>Customers are responsible for confirming fitment before installation. Our team is happy to verify fitment with your VIN before you order.</p>
    <h3>Installation</h3><p>We recommend professional installation. Labor costs are not covered by the warranty unless required by law.</p>
    <h3>Warranty & returns</h3><p>See our <a href="#/warranty" style="color:var(--orange-d)">warranty & returns policy</a> for full details.</p>`);

  pages.about = () => `<div class="container page narrow">
    <h1>About XoraLure</h1>
    <p>We help drivers and repair shops get back on the road for less. Every part we sell comes from a vetted network of professional recyclers, is inspected and graded, and ships with a warranty.</p>
    <h3>Why buy recycled OEM parts?</h3>
    <p>Original-equipment parts fit and perform the way your vehicle was designed — at a fraction of new dealer pricing — and reusing them keeps tons of metal and plastic out of landfills.</p>
    <h3>Our promise</h3>
    <div class="perks"><span>Honest grading and listed mileage</span><span>Free shipping on every order</span><span>Up to 12-month warranty</span><span>Real specialists who know cars</span></div>
  </div>`;

  pages.warranty = () => `<div class="container page narrow">
    <h1>Warranty & returns</h1>
    <h3>Warranty coverage</h3>
    <p><b>New parts:</b> 12–24 months depending on the part (shown on each product page).</p><p><b>Used OEM parts:</b> engines, transmissions and transfer cases 12 months; electrical and mechanical components 6 months; body parts and lighting 3 months.</p><p>Coverage begins on the delivery date.</p>
    <h3>30-day returns</h3>
    <p>Changed your mind? Return any unused, uninstalled part within 30 days of delivery for a full refund of the purchase price.</p>
    <h3>How to file a claim</h3>
    <p>Contact us with your order number and a description of the problem. We'll arrange a replacement or refund.</p>
    <a href="#/contact" class="btn btn-primary">Contact support</a>
  </div>`;

  pages.contact = () => {
    const c = store.get('xa_customer', {});
    return `<div class="container page narrow">
      <h1>Contact us</h1>
      <p class="muted">Call <b>(800) 555-0199</b> (Mon–Sat, 8am–7pm) or send a message below.</p>
      <form class="panel" id="contactForm" novalidate>
        <div class="row">
          <div class="field"><label for="m-name">Name</label><input id="m-name" name="name" data-autofix="name" value="${esc(c.name)}" required></div>
          <div class="field"><label for="m-email">Email</label><input id="m-email" name="email" type="email" data-autofix="email" value="${esc(c.email)}" required></div>
        </div>
        <div class="field"><label for="m-msg">Message</label><textarea id="m-msg" name="message" rows="5" required></textarea></div>
        <button class="btn btn-primary btn-block">Send message</button>
      </form>
    </div>`;
  };
  pages.contact.after = () => {
    const form = $('#contactForm');
    AutoCorrect.attach(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      $$('[data-autofix]', form).forEach((el) => el.dispatchEvent(new Event('blur')));
      try {
        await api('/api/contact', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
        form.outerHTML = `<div class="panel success"><div class="check">✓</div><h2>Message sent</h2><p class="muted">We'll reply within one business day.</p></div>`;
      } catch (err) { showErrors(form, err.data?.errors || [err.message]); }
    });
  };

  // ---------- router ----------
  function parseHash() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    return { name: parts[0] || 'home', arg: parts[1] ? decodeURIComponent(parts[1]) : undefined, params: new URLSearchParams(qs || '') };
  }

  function render() {
    app.removeEventListener('click', cartClicks);
    const { name, arg, params } = parseHash();
    const page = pages[name] || (() => `<div class="container page"><div class="empty"><h2>Page not found</h2><a class="btn btn-primary" href="#/">Go home</a></div></div>`);
    app.innerHTML = page(params, arg);
    page.after && page.after(params, arg);
    $$('.nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#/' + name));
    $('#nav').classList.remove('open');
    const t = { home: 'Quality Used & OEM Auto Parts', shop: 'Shop Parts', part: state.byId.get(arg)?.title, cart: 'Cart', checkout: 'Checkout', quote: 'Request a Quote', track: 'Track Order', about: 'About', contact: 'Contact', warranty: 'Warranty', shipping: 'Shipping Policy', privacy: 'Privacy Policy', terms: 'Terms of Service', review: 'Write a Review' }[name];
    document.title = `${t || "XoraLure"} — XoraLure`;
  }

  // Delegated "Add" buttons on product cards
  app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (b) { e.preventDefault(); cart.add(b.dataset.add); }
  });

  // ---------- live updates ----------
  function applyInventory(changes) {
    const cartIds = new Set(cart.items.map((i) => i.id));
    for (const c of changes) {
      const p = state.byId.get(c.id); if (!p) continue;
      const priceChanged = p.price !== c.price;
      Object.assign(p, c);
      $$(`[data-pid="${c.id}"]`).forEach((el) => {
        const price = $('[data-live=price]', el), stock = $('[data-live=stock]', el), upd = $('[data-live=updated]', el);
        if (price) price.textContent = money(p.price);
        if (stock) stock.innerHTML = stockLabel(p.stock);
        if (upd) upd.textContent = new Date(p.updatedAt).toLocaleTimeString();
        const add = $('[data-add]', el) || (el.classList.contains('pdp') && $('#addBtn'));
        if (add) add.disabled = avail(p) <= 0;
        el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      });
      if (cartIds.has(c.id)) {
        const it = cart.items.find((i) => i.id === c.id);
        if (avail(p) < it.qty) {
          if (avail(p) <= 0) { cart.remove(c.id); toast(`${esc(p.title)} sold out and was removed from your cart.`); }
          else { cart.setQty(c.id, avail(p)); toast(`Only ${avail(p)} of ${esc(p.title)} left — cart adjusted.`); }
        } else if (priceChanged) toast(`Price updated for ${esc(p.title)} in your cart: ${money(p.price)}`);
      }
    }
    const total = cart.total();
    ['#subtotal', '#grandTotal'].forEach((s) => { const el = $(s); if (el) el.textContent = money(total); });
    const po = $('#placeOrder'); if (po && !po.disabled) po.textContent = `Place order · ${money(total)}`;
  }

  function onNewVersion(v) {
    if (!state.version) { state.version = v; $('#versionTag').textContent = 'v' + v; return; }
    if (v === state.version) return;
    // Don't wipe a form the user is typing into — offer the update instead.
    const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (typing) toast('A new version of the site is available.', { label: 'Update now', run: () => location.reload() });
    else { toast('Updating to the latest version…'); setTimeout(() => location.reload(), 1200); }
  }

  function connectLive() {
    const pill = $('#livePill');
    if (!('EventSource' in window)) return pollVersion();
    const es = new EventSource('/api/stream');
    es.addEventListener('open', () => pill.classList.add('on'));
    es.addEventListener('error', () => {
      pill.classList.remove('on'); // EventSource auto-reconnects on network errors…
      // …but a closed stream (serverless hosts like Vercel) means: poll instead
      if (es.readyState === EventSource.CLOSED) { es.close(); pollVersion(); }
    });
    es.addEventListener('version', (e) => onNewVersion(JSON.parse(e.data).version));
    es.addEventListener('inventory', (e) => applyInventory(JSON.parse(e.data)));
    es.addEventListener('catalog', reloadCatalog);
    // A new verified review was posted: refresh the reviews on screen
    es.addEventListener('review', (e) => {
      const r = JSON.parse(e.data), { name, arg } = parseHash();
      if (name === 'home') loadReviews('#homeReviews');
      else if (name === 'part' && arg === r.productId) loadReviews('#productReviews', r.productId);
    });
  }

  // Products were added or removed (new import / store sync): fetch the new catalog
  // and re-render, unless the visitor is in the middle of filling a form.
  async function reloadCatalog() {
    try {
      const [products, categories] = await Promise.all([api('/api/products'), api('/api/categories')]);
      setCatalog(products, categories);
      const before = cart.items.length;
      cart.items = cart.items.filter((i) => state.byId.has(i.id)); cart.save();
      if (cart.items.length < before) toast('Some items in your cart are no longer available and were removed.');
      const busy = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (!busy && !['checkout', 'quote', 'contact'].includes(parseHash().name)) render();
      toast(`Catalog updated — ${products.length.toLocaleString()} parts available.`);
    } catch { /* will catch up on next visibility change */ }
  }
  // Polling mode: check for a new deploy every 30s and refresh prices/stock every 60s
  let polling = false;
  function pollVersion() {
    if (polling) return;
    polling = true;
    $('#livePill').classList.add('on');
    api('/api/version').then((v) => onNewVersion(v.version)).catch(() => {});
    setInterval(async () => { try { onNewVersion((await api('/api/version')).version); } catch { /* offline */ } }, 30000);
    setInterval(() => { if (document.visibilityState === 'visible') resync(); }, 60000);
  }

  // Full resync when the tab becomes visible again (catches anything missed while asleep)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resync(); });
  async function resync() {
    try {
      const fresh = await api('/api/products');
      if (fresh.length !== state.products.length || fresh.some((p) => !state.byId.has(p.id))) return reloadCatalog();
      applyInventory(fresh.filter((p) => { const o = state.byId.get(p.id); return o && (o.price !== p.price || o.stock !== p.stock); }));
    } catch { /* offline */ }
  }

  // ---------- boot ----------
  $('#year').textContent = new Date().getFullYear();
  $('#menuBtn').addEventListener('click', () => $('#nav').classList.toggle('open'));

  async function boot() {
    updateCartBadge();
    app.innerHTML = '<div class="container page"><p class="muted">Loading parts…</p></div>';
    try {
      const [products, vehicles, categories] = await Promise.all([api('/api/products'), api('/api/vehicles'), api('/api/categories')]);
      state.vehicles = vehicles;
      setCatalog(products, categories);
      cart.items = cart.items.filter((i) => state.byId.has(i.id)); cart.save();
    } catch {
      app.innerHTML = '<div class="container page"><div class="empty"><h2>We can\'t reach the store right now</h2><p class="muted">Check your connection — we\'ll retry automatically.</p></div></div>';
      setTimeout(boot, 5000);
      return;
    }
    bindHeaderSearch();
    window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
    render();
    connectLive();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  boot();
})();
