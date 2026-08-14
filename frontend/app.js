/* =========================================================================
   EventEats — PWA frontend (API-backed)
   Talks to the EventEats API (see config.js -> window.API_BASE) so stalls,
   menus and orders are shared live across every device. Only per-device
   state (role, cart, which orders are "mine") is kept in localStorage.
   ========================================================================= */

'use strict';

/* ------------------------------- helpers -------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const CUR = 'R';
const money = (n) => CUR + Number(n).toFixed(2);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// If a dish photo fails to load, fall back to the emoji tile.
function imgFail(el, emoji, cls) {
  const d = document.createElement('div');
  d.className = cls || (el.className + ' placeholder');
  d.textContent = emoji || '🍽️';
  el.replaceWith(d);
}
window.imgFail = imgFail;

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ------------------------------- API layer ------------------------------ */
const API = (function () {
  let b = (window.API_BASE || '').trim().replace(/\/+$/, '');
  if (!b && /^(localhost|127\.0\.0\.1)/.test(location.hostname)) b = 'http://localhost:3001';
  return b;
})();
async function api(path, opts) {
  const headers = { 'Content-Type': 'application/json' };
  const va = state.session && state.session.vendorAuth;
  if (va && va.token) headers.Authorization = 'Bearer ' + va.token;
  const r = await fetch(API + path, Object.assign({ headers }, opts));
  if (!r.ok) throw new Error('API ' + r.status + ' ' + path);
  return r.status === 204 ? null : r.json();
}

/* ------------------------------ app state ------------------------------- */
let state = { stalls: [], orders: [], session: null };
const SKEY = 'eventeats_session_v1';

function defaultSession() {
  return {
    role: 'attendee',
    attendee: { page: 'stalls', stallId: null, lastOrderIds: [] },
    vendorStallId: null,
    vendorPage: 'orders',
    cart: [],            // {stallId, itemId, qty}
    myOrderIds: [],      // ids of orders placed on this device
    attendeeName: '',
    checkout: { method: 'card', name: '', card: { number: '', exp: '', cvv: '', holder: '' } },
    editor: null,        // transient dish editor
    stallEditor: null,   // transient stall editor
    overlay: null,       // 'itemEditor' | 'stallEditor'
    vendorAuth: null,    // {token, vendorId, name, stallId, stallName} once signed in
    vendorCode: '',      // transient sign-in code field
    installDismissed: false,
  };
}

function serializeSession() {
  const s = state.session;
  return {
    role: s.role,
    attendee: { page: s.attendee.page, stallId: s.attendee.stallId, lastOrderIds: s.attendee.lastOrderIds },
    vendorStallId: s.vendorStallId,
    vendorPage: s.vendorPage,
    cart: s.cart,
    myOrderIds: s.myOrderIds,
    attendeeName: s.attendeeName,
    checkout: { method: s.checkout.method, name: s.checkout.name, card: { number: '', exp: '', cvv: '', holder: '' } },
    vendorAuth: s.vendorAuth,
    installDismissed: s.installDismissed,
  };
}
function persist() { try { localStorage.setItem(SKEY, JSON.stringify(serializeSession())); } catch (e) {} }
function setState(mutator) { mutator(state); persist(); render(); }

async function refresh() {
  const [stalls, orders] = await Promise.all([api('/api/stalls'), api('/api/orders')]);
  state.stalls = stalls;
  state.orders = orders;
}

/* --------------------------- cart / order utils ------------------------- */
const stallById = (id) => state.stalls.find((s) => s.id === id);
const itemById = (stall, id) => stall && stall.menu.find((m) => m.id === id);
function cartQty(stallId, itemId) {
  const l = state.session.cart.find((c) => c.stallId === stallId && c.itemId === itemId);
  return l ? l.qty : 0;
}
function setCartQty(stallId, itemId, qty) {
  const cart = state.session.cart;
  const idx = cart.findIndex((c) => c.stallId === stallId && c.itemId === itemId);
  if (qty <= 0) { if (idx >= 0) cart.splice(idx, 1); }
  else if (idx >= 0) cart[idx].qty = qty;
  else cart.push({ stallId, itemId, qty });
}
function cartCount() { return state.session.cart.reduce((n, c) => n + c.qty, 0); }
function cartTotal() {
  return state.session.cart.reduce((sum, c) => {
    const st = stallById(c.stallId); const it = itemById(st, c.itemId);
    return sum + (it ? it.price * c.qty : 0);
  }, 0);
}
function cartByStall() {
  const groups = {};
  for (const c of state.session.cart) {
    const st = stallById(c.stallId); const it = itemById(st, c.itemId);
    if (!st || !it) continue;
    (groups[st.id] = groups[st.id] || { stall: st, lines: [] }).lines.push({ item: it, qty: c.qty });
  }
  return Object.values(groups);
}
function myOrders() {
  const ids = state.session.myOrderIds || [];
  return state.orders.filter((o) => ids.includes(o.id));
}

const STATUS_FLOW = ['placed', 'accepted', 'preparing', 'ready', 'collected'];
const STATUS_LABEL = { placed: 'New', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready to collect', collected: 'Collected', cancelled: 'Cancelled' };
const NEXT_ACTION = { placed: 'Accept order', accepted: 'Start preparing', preparing: 'Mark ready', ready: 'Mark collected' };

/* ------------------------------ image resize ---------------------------- */
function resizeImage(file, maxDim = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
        else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* --------------------------- location / maps ---------------------------- */
function captureLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no-geolocation'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}
function directionsUrl(loc, provider) {
  const { lat, lng } = loc;
  if (provider === 'waze') return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  // Google Maps directions (opens the Maps app on phones, web elsewhere)
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
function openDirections(loc, provider) {
  window.open(directionsUrl(loc, provider), '_blank', 'noopener');
}

/* =============================== RENDER ================================= */
function render() {
  if (!state.session) return;
  const s = state.session;
  let html = '';
  html += renderAppbar();
  if (s.role === 'attendee') {
    const p = s.attendee.page;
    if (p === 'stalls') html += renderStalls();
    else if (p === 'stall') html += renderStallDetail();
    else if (p === 'cart') html += renderCartScreen();
    else if (p === 'checkout') html += renderCheckout();
    else if (p === 'confirm') html += renderConfirm();
    else if (p === 'orders') html += renderMyOrders();
  } else {
    if (!s.vendorAuth) html += renderVendorSignIn();
    else if (s.vendorPage === 'orders') html += renderVendorOrders();
    else html += renderVendorMenu();
  }
  html += renderBottomNav();
  if (['stalls', 'stall'].includes(s.attendee.page) && s.role === 'attendee' && cartCount() > 0) {
    html += renderCartFab();
  }
  app.innerHTML = html;
  if (s.overlay) mountOverlay(s.overlay);
}

function renderAppbar() {
  const s = state.session;
  let sub = '';
  if (s.role === 'attendee') {
    sub = `<div class="appbar-sub"><span class="dot"></span> Spring Food Festival · Order ahead, skip the queue</div>`;
  } else if (s.vendorAuth) {
    sub = `<div class="stall-picker" style="justify-content:space-between">
        <div style="min-width:0">
          <label>Your stall</label>
          <div style="color:#fff;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.vendorAuth.stallName || '—')}</div>
        </div>
        <button class="role-logout" data-action="vendor-logout">Log out</button>
      </div>`;
  } else {
    sub = '';
  }
  return `
  <header class="appbar">
    <div class="appbar-top">
      <div class="brand"><span class="logo">🍴</span> Event<em>Eats</em></div>
      <div class="role-switch">
        <button data-action="role" data-role="attendee" class="${s.role === 'attendee' ? 'active' : ''}">Attendee</button>
        <button data-action="role" data-role="vendor" class="${s.role === 'vendor' ? 'active' : ''}">Vendor</button>
      </div>
    </div>
    ${sub}
  </header>`;
}

function installBanner() {
  if (state.session.installDismissed || !deferredPrompt) return '';
  return `<div class="install-banner">
    <span style="font-size:22px">📲</span>
    <div class="ib-txt"><b>Install EventEats</b> — add it to your home screen for one-tap ordering.</div>
    <button class="btn btn-primary btn-sm" data-action="install">Install</button>
    <button class="icon-btn" data-action="dismiss-install" style="width:34px;height:34px">✕</button>
  </div>`;
}

/* ------------------------------ attendee -------------------------------- */
function renderStalls() {
  if (!state.stalls.length) {
    return `<main class="screen"><div class="center-empty"><div class="big">🍽️</div>No stalls yet.<br>Switch to Vendor to add the first one.</div></main>`;
  }
  const cards = state.stalls.map((st) => {
    const count = st.menu.filter((m) => m.available).length;
    return `
    <div class="stall-card" data-action="open-stall" data-id="${st.id}" style="border-left-color:${st.color}">
      <div class="stall-head">
        <div class="emoji" style="background:${shade(st.color, 80)}">${st.photo
          ? `<img class="stall-thumb" src="${st.photo}" alt="" loading="lazy" onerror="imgFail(this,'${st.emoji || '🍽️'}','stall-thumb-ph')">`
          : esc(st.emoji)}</div>
        <div>
          <div class="b-name">${esc(st.name)}</div>
          <div class="b-cuisine">${esc(st.cuisine)}</div>
        </div>
      </div>
      <div class="stall-foot">
        <div class="tag">${esc(st.tagline)}</div>
        <div class="pill-group">
          ${st.location ? '<span class="pill pill-loc">📍 At event</span>' : ''}
          <span class="pill">${count} item${count === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>`;
  }).join('');
  return `<main class="screen">
    ${installBanner()}
    <div class="section-title">Stalls at this event</div>
    <div class="stall-grid">${cards}</div>
    <div class="spacer"></div>
  </main>`;
}

function renderStallDetail() {
  const st = stallById(state.session.attendee.stallId);
  if (!st) { state.session.attendee.page = 'stalls'; return renderStalls(); }
  const items = st.menu.map((m) => {
    const q = cartQty(st.id, m.id);
    const photo = m.photo
      ? `<img class="item-photo" src="${m.photo}" alt="${esc(m.name)}" loading="lazy" onerror="imgFail(this,'${m.emoji || '🍽️'}','item-photo placeholder')">`
      : `<div class="item-photo placeholder">${esc(m.emoji || '🍽️')}</div>`;
    let control;
    if (!m.available) control = `<span class="sold-out">Sold out</span>`;
    else if (q > 0) control = `
      <div class="stepper">
        <button data-action="qty" data-stall="${st.id}" data-item="${m.id}" data-d="-1">−</button>
        <span class="n">${q}</span>
        <button data-action="qty" data-stall="${st.id}" data-item="${m.id}" data-d="1">+</button>
      </div>`;
    else control = `<button class="add-btn" data-action="qty" data-stall="${st.id}" data-item="${m.id}" data-d="1">Add</button>`;
    return `
    <div class="item-card">
      ${photo}
      <div class="item-main">
        <div class="item-name">${esc(m.name)}</div>
        <div class="item-desc">${esc(m.desc || '')}</div>
        <div class="item-foot">
          <span class="price">${money(m.price)}</span>
          ${control}
        </div>
      </div>
    </div>`;
  }).join('');
  const directions = st.location ? `
    <div class="dir-row">
      <button class="btn btn-dark" data-action="directions" data-id="${st.id}" data-prov="google">🧭 Take me to the stall</button>
      <button class="btn btn-ghost btn-waze" data-action="directions" data-id="${st.id}" data-prov="waze">Waze</button>
    </div>` : '';
  return `<main class="screen">
    <div class="subhead">
      <button class="icon-btn" data-action="nav" data-page="stalls">←</button>
      <div>
        <h2>${esc(st.emoji)} ${esc(st.name)}</h2>
        <div class="sub">${esc(st.cuisine)} · ${esc(st.tagline)}</div>
      </div>
    </div>
    ${directions}
    <div class="menu-list">${items || `<div class="center-empty"><div class="big">🍽️</div>This stall hasn't added dishes yet.</div>`}</div>
    <div class="spacer"></div>
  </main>`;
}

function renderCartScreen() {
  const groups = cartByStall();
  if (!groups.length) {
    return `<main class="screen">
      <div class="subhead"><button class="icon-btn" data-action="nav" data-page="stalls">←</button><h2>Your cart</h2></div>
      <div class="center-empty"><div class="big">🛒</div>Your cart is empty.<br>Add some dishes to get started.</div>
    </main>`;
  }
  const body = groups.map((g) => `
    <div class="cart-stall">${esc(g.stall.emoji)} ${esc(g.stall.name)}</div>
    ${g.lines.map((l) => `
      <div class="cart-line">
        <div class="stepper">
          <button data-action="qty" data-stall="${g.stall.id}" data-item="${l.item.id}" data-d="-1">−</button>
          <span class="n">${l.qty}</span>
          <button data-action="qty" data-stall="${g.stall.id}" data-item="${l.item.id}" data-d="1">+</button>
        </div>
        <div class="cl-name">${esc(l.item.name)}</div>
        <div class="cl-price">${money(l.item.price * l.qty)}</div>
      </div>`).join('')}
  `).join('');
  return `<main class="screen">
    <div class="subhead"><button class="icon-btn" data-action="nav" data-page="stalls">←</button><h2>Your cart</h2></div>
    ${body}
    <div class="divider"></div>
    <div class="summary-row"><span>Items</span><span>${cartCount()}</span></div>
    <div class="summary-row total"><span>Total</span><span>${money(cartTotal())}</span></div>
    <div class="spacer"></div>
    <button class="btn btn-primary" data-action="nav" data-page="checkout">Checkout · ${money(cartTotal())}</button>
    <div style="height:8px"></div>
    <button class="btn btn-ghost" data-action="nav" data-page="stalls">Add more food</button>
    <div class="spacer"></div>
  </main>`;
}

function renderCheckout() {
  const c = state.session.checkout;
  const groups = cartByStall();
  const orderLines = groups.map((g) =>
    `<div class="summary-row"><span>${esc(g.stall.name)} · ${g.lines.reduce((n, l) => n + l.qty, 0)} item(s)</span><span>${money(g.lines.reduce((s, l) => s + l.item.price * l.qty, 0))}</span></div>`
  ).join('');
  const cardFields = c.method === 'card' ? `
    <div class="card-fields">
      <div class="field">
        <label>Card number</label>
        <input inputmode="numeric" placeholder="4242 4242 4242 4242" data-model="checkout.card.number" value="${esc(c.card.number)}" maxlength="19">
      </div>
      <div class="field"><div class="row">
        <div><label>Expiry</label><input inputmode="numeric" placeholder="MM/YY" data-model="checkout.card.exp" value="${esc(c.card.exp)}" maxlength="5"></div>
        <div><label>CVV</label><input inputmode="numeric" placeholder="123" data-model="checkout.card.cvv" value="${esc(c.card.cvv)}" maxlength="4"></div>
      </div></div>
      <div class="field">
        <label>Name on card</label>
        <input placeholder="Full name" data-model="checkout.card.holder" value="${esc(c.card.holder)}">
      </div>
      <div class="hint">🔒 Demo checkout — no real card is charged. Try <b>4242 4242 4242 4242</b>.</div>
    </div>` : `<div class="hint" style="margin-bottom:6px">💵 Pay with cash or card at the stall when you collect.</div>`;
  return `<main class="screen">
    <div class="subhead"><button class="icon-btn" data-action="nav" data-page="cart">←</button><h2>Checkout</h2></div>

    <div class="section-title">Order summary</div>
    ${orderLines}
    <div class="summary-row total"><span>Total</span><span>${money(cartTotal())}</span></div>
    <div class="divider"></div>

    <div class="section-title">Your name</div>
    <div class="field">
      <input placeholder="Name for the collection" data-model="checkout.name" value="${esc(c.name)}">
      <div class="hint">Shown to the vendor so they can hand over your order.</div>
    </div>

    <div class="section-title">Payment</div>
    <div class="pay-methods">
      <div class="pay-opt ${c.method === 'card' ? 'sel' : ''}" data-action="pay-method" data-m="card">
        <span class="p-emoji">💳</span>
        <div class="p-txt"><div class="p-title">Pay now by card</div><div class="p-sub">Order is confirmed instantly</div></div>
        <span class="radio"></span>
      </div>
      <div class="pay-opt ${c.method === 'collect' ? 'sel' : ''}" data-action="pay-method" data-m="collect">
        <span class="p-emoji">💵</span>
        <div class="p-txt"><div class="p-title">Pay on collection</div><div class="p-sub">Pay at the stall when you pick up</div></div>
        <span class="radio"></span>
      </div>
    </div>
    ${cardFields}
    <div class="spacer"></div>
    <button class="btn btn-primary" data-action="place-order" id="placeBtn">
      ${c.method === 'card' ? 'Pay ' + money(cartTotal()) + ' & place order' : 'Place order · ' + money(cartTotal())}
    </button>
    <div style="height:6px"></div>
    <div class="hint" style="text-align:center">You'll get a collection code for each stall.</div>
    <div class="spacer"></div>
  </main>`;
}

function renderConfirm() {
  const ids = state.session.attendee.lastOrderIds;
  const orders = state.orders.filter((o) => ids.includes(o.id));
  const codes = orders.map((o) => `
    <div class="code-card">
      <div class="lbl">Collection code</div>
      <div class="code">${esc(o.code)}</div>
      <div class="stall">${esc(o.stallName)} · ${money(o.total)}</div>
    </div>`).join('');
  return `<main class="screen">
    <div class="confirm-hero">
      <div class="confirm-check">✓</div>
      <h2>Order placed!</h2>
      <p class="muted">Show your code${orders.length > 1 ? 's' : ''} at the stall to collect. No queue needed.</p>
    </div>
    ${codes}
    <button class="btn btn-dark" data-action="nav" data-page="orders">Track my orders</button>
    <div style="height:8px"></div>
    <button class="btn btn-ghost" data-action="nav" data-page="stalls">Back to stalls</button>
    <div class="spacer"></div>
  </main>`;
}

function statusTrack(status) {
  if (status === 'cancelled') return '';
  const flow = STATUS_FLOW;
  const idx = flow.indexOf(status);
  const labels = ['Placed', 'Accepted', 'Preparing', 'Ready', 'Collected'];
  return `<div class="track">${flow.map((st, i) => {
    const cls = i < idx ? 'done' : i === idx ? 'active' : '';
    const mark = i < idx ? '✓' : (i + 1);
    return `<div class="step ${cls}"><div class="bar"></div><div class="dot">${mark}</div><div class="lbl">${labels[i]}</div></div>`;
  }).join('')}</div>`;
}

function renderMyOrders() {
  const mine = myOrders().sort((a, b) => b.createdAt - a.createdAt);
  if (!mine.length) {
    return `<main class="screen">
      <div class="section-title">My orders</div>
      <div class="center-empty"><div class="big">🧾</div>No orders yet.<br>Your pre-orders will appear here with live status.</div>
    </main>`;
  }
  const cards = mine.map((o) => `
    <div class="order-card">
      <div class="order-head">
        <div>
          <div class="o-stall">${esc(o.stallName)}</div>
          <div class="order-code">Code <b>${esc(o.code)}</b> · ${money(o.total)} · ${o.payment.method === 'card' ? 'Paid' : 'Pay on collection'}</div>
        </div>
        <span class="status-badge st-${o.status}">${STATUS_LABEL[o.status]}</span>
      </div>
      <div class="order-items">${o.items.map((i) => `${i.qty}× ${esc(i.name)}`).join(' · ')}</div>
      ${statusTrack(o.status)}
    </div>`).join('');
  return `<main class="screen">
    <div class="section-title">My orders</div>
    ${cards}
    <div class="spacer"></div>
  </main>`;
}

/* ------------------------------- vendor --------------------------------- */
function ensureVendorStall() {
  const s = state.session;
  if (s.vendorAuth) { s.vendorStallId = s.vendorAuth.stallId; return stallById(s.vendorAuth.stallId) || null; }
  let st = stallById(s.vendorStallId);
  if (!st && state.stalls[0]) { st = state.stalls[0]; s.vendorStallId = st.id; }
  return st;
}

function renderVendorOrders() {
  const st = ensureVendorStall();
  if (!st) return `<main class="screen"><div class="center-empty"><div class="big">🍽️</div>No stalls yet.<br>Open the Menu tab to add your first stall.</div></main>`;
  const stId = st.id;
  const orders = state.orders.filter((o) => o.stallId === stId).sort((a, b) => {
    const rank = (o) => STATUS_FLOW.indexOf(o.status);
    return rank(a) - rank(b) || a.createdAt - b.createdAt;
  });
  const active = orders.filter((o) => !['collected', 'cancelled'].includes(o.status));
  const revenue = orders.filter((o) => (o.payment && o.payment.status === 'paid') || o.status === 'collected').reduce((s, o) => s + o.total, 0);
  const stats = `
    <div class="stat-row">
      <div class="stat"><div class="num">${active.length}</div><div class="lbl">Active orders</div></div>
      <div class="stat"><div class="num">${orders.filter((o) => o.status === 'ready').length}</div><div class="lbl">Ready</div></div>
      <div class="stat"><div class="num">${money(revenue).replace('.00', '')}</div><div class="lbl">Revenue</div></div>
    </div>`;
  let list;
  if (!orders.length) {
    list = `<div class="center-empty"><div class="big">📭</div>No orders yet for ${esc(st.name)}.<br>Switch to Attendee to place a test order.</div>`;
  } else {
    list = orders.map((o) => {
      const mins = Math.max(0, Math.round((Date.now() - o.createdAt) / 60000));
      const nextBtn = NEXT_ACTION[o.status]
        ? `<button class="btn btn-primary btn-sm" data-action="advance" data-id="${o.id}">${NEXT_ACTION[o.status]}</button>` : '';
      const cancelBtn = ['placed', 'accepted'].includes(o.status)
        ? `<button class="btn btn-danger-ghost btn-sm" data-action="cancel-order" data-id="${o.id}">Cancel</button>` : '';
      return `
      <div class="vendor-order st-${o.status}">
        <div class="order-head">
          <div>
            <div class="o-stall">${esc(o.customer || 'Guest')} · <span class="order-code">Code ${esc(o.code)}</span></div>
            <div class="order-code">${mins === 0 ? 'just now' : mins + ' min ago'} · ${o.payment && o.payment.method === 'card' ? '💳 Paid' : '💵 Pay on collect'}</div>
          </div>
          <span class="status-badge st-${o.status}">${STATUS_LABEL[o.status]}</span>
        </div>
        <div class="order-items">${o.items.map((i) => `<b>${i.qty}×</b> ${esc(i.name)}`).join(' · ')}</div>
        <div class="order-foot"><span class="price">${money(o.total)}</span></div>
        ${(nextBtn || cancelBtn) ? `<div class="vo-actions">${cancelBtn}${nextBtn}</div>` : ''}
      </div>`;
    }).join('');
  }
  return `<main class="screen">
    <div class="section-title">${esc(st.emoji)} ${esc(st.name)} — Orders</div>
    ${stats}
    ${list}
    <div class="spacer"></div>
  </main>`;
}

function renderVendorMenu() {
  const st = ensureVendorStall();
  if (!st) {
    return `<main class="screen">
      <div class="center-empty" style="padding-top:50px"><div class="big">🏬</div>Your stall isn't set up yet.<br>Contact the event admin.</div>
    </main>`;
  }
  const rows = st.menu.map((m) => `
    <div class="mm-row">
      ${m.photo ? `<img src="${m.photo}" alt="" loading="lazy" onerror="imgFail(this,'${m.emoji || '🍽️'}','ph')">` : `<div class="ph">${esc(m.emoji || '🍽️')}</div>`}
      <div class="mm-info">
        <div class="mm-name">${esc(m.name)}</div>
        <div class="mm-price">${money(m.price)} ${m.available ? '' : '· <span class="mm-off">Sold out</span>'}</div>
      </div>
      <label class="switch" title="Available">
        <input type="checkbox" ${m.available ? 'checked' : ''} data-action="toggle-avail" data-id="${m.id}">
        <span class="slider"></span>
      </label>
      <button class="icon-btn" data-action="edit-item" data-id="${m.id}" style="width:38px;height:38px">✏️</button>
    </div>`).join('');
  const loc = st.location;
  const locCard = `
    <div class="loc-card">
      <span class="loc-ico">${loc ? '📍' : '🗺️'}</span>
      <div class="loc-txt">
        <b>${loc ? 'Stall location set' : 'Set your stall location'}</b>
        <div class="muted">${loc ? 'Attendees can now navigate to you' : 'Drop a pin when you set up so attendees can find you'}</div>
      </div>
      <button class="btn btn-sm ${loc ? 'btn-ghost' : 'btn-primary'}" data-action="set-location">${loc ? 'Update pin' : '📍 Drop pin'}</button>
    </div>`;
  return `<main class="screen">
    <div class="menu-head">
      <div class="section-title" style="margin:0">${esc(st.emoji)} ${esc(st.name)} — Menu</div>
    </div>
    ${locCard}
    ${rows || `<div class="center-empty"><div class="big">🍽️</div>No dishes yet.<br>Add your first dish below.</div>`}
    <div class="spacer"></div>
    <button class="btn btn-primary" data-action="add-item">+ Add a dish</button>
    <div class="spacer"></div>
  </main>`;
}

/* ------------------------------ overlays -------------------------------- */
function mountOverlay(type) {
  if (type === 'itemEditor') mountItemEditor();
  else if (type === 'stallEditor') mountStallEditor();
}

const EMOJI_CHOICES = ['🍖','🍔','🌮','🍕','🍦','🥗','🌭','🍜','🍗','🥙','🍩','🥤','☕','🍢','🧇','🍛'];
const COLOR_CHOICES = ['#0F5C4B','#3E6B57','#7A3B3B','#9C6B3F','#B08D3E','#5B6E8C','#6B5B7A','#8C5A4A','#4A5D4A','#2C3E4A'];

function mountStallEditor() {
  const e = state.session.stallEditor;
  if (!e) return;
  const emojiChips = EMOJI_CHOICES.map((em) =>
    `<button class="chip-emoji ${e.emoji === em ? 'sel' : ''}" data-action="pick-emoji" data-v="${em}">${em}</button>`).join('');
  const colorChips = COLOR_CHOICES.map((c) =>
    `<button class="chip-color ${e.color === c ? 'sel' : ''}" data-action="pick-color" data-v="${c}" style="background:${c}"></button>`).join('');
  const html = `
  <div class="sheet-backdrop" data-action="close-overlay">
    <div class="sheet" data-stop="1">
      <div class="sheet-grip"></div>
      <h3>Add a new stall</h3>
      <div class="stall-preview" style="background:linear-gradient(120deg, ${e.color}, ${shade(e.color, -18)})">
        <div class="sp-emoji">${e.emoji}</div>
        <div>
          <div class="sp-name">${esc(e.name || 'Your stall name')}</div>
          <div class="sp-cuisine">${esc(e.cuisine || 'Cuisine / category')}</div>
        </div>
      </div>
      <div class="field"><label>Stall name</label><input data-model="stallEditor.name" value="${esc(e.name)}" placeholder="e.g. Mama's Kitchen"></div>
      <div class="field"><label>Cuisine / category</label><input data-model="stallEditor.cuisine" value="${esc(e.cuisine)}" placeholder="e.g. Halaal · Grill"></div>
      <div class="field"><label>Tagline</label><input data-model="stallEditor.tagline" value="${esc(e.tagline)}" placeholder="e.g. Home-style curries & rotis"></div>
      <div class="field"><label>Icon</label><div class="chip-row">${emojiChips}</div></div>
      <div class="field"><label>Banner colour</label><div class="chip-row">${colorChips}</div></div>
      <button class="btn btn-primary" data-action="create-stall">Create stall</button>
      <div style="height:8px"></div>
      <button class="btn btn-ghost" data-action="close-overlay">Cancel</button>
      <div class="spacer"></div>
    </div>
  </div>`;
  app.insertAdjacentHTML('beforeend', html);
}

function mountItemEditor() {
  const e = state.session.editor;
  if (!e) return;
  const isNew = !e.id;
  const preview = e.photo
    ? `<img src="${e.photo}" alt="">`
    : `<div class="pu-txt"><div class="pu-emoji">🍽️</div>No photo yet</div>`;
  const html = `
  <div class="sheet-backdrop" data-action="close-overlay">
    <div class="sheet" data-stop="1">
      <div class="sheet-grip"></div>
      <h3>${isNew ? 'Add a dish' : 'Edit dish'}</h3>
      <div class="field">
        <label>Photo of the dish</label>
        <div class="photo-preview">${preview}</div>
        <div class="photo-actions">
          <label class="btn btn-ghost btn-photo">📷 Take photo
            <input type="file" accept="image/*" capture="environment" data-action="upload-photo">
          </label>
          <label class="btn btn-ghost btn-photo">🖼️ Choose
            <input type="file" accept="image/*" data-action="upload-photo">
          </label>
        </div>
        <div class="hint">Snap the dish with your camera, or pick an existing photo. ${e.photo ? '<button class="btn-sm" style="color:#c62828;font-weight:700" data-action="remove-photo">Remove photo</button>' : ''}</div>
      </div>
      <div class="field"><label>Dish name</label><input data-model="editor.name" value="${esc(e.name)}" placeholder="e.g. Beef Brisket Roll"></div>
      <div class="field"><label>Description</label><textarea data-model="editor.desc" rows="2" placeholder="Short, tasty description">${esc(e.desc)}</textarea></div>
      <div class="field"><label>Price (${CUR})</label><input inputmode="decimal" data-model="editor.price" value="${esc(e.price)}" placeholder="0.00"></div>
      <div class="field">
        <label class="switch-line" style="display:flex;align-items:center;gap:10px;font-size:14px;font-weight:650;color:var(--ink)">
          <span class="switch"><input type="checkbox" ${e.available ? 'checked' : ''} data-action="editor-avail"><span class="slider"></span></span>
          Available to order
        </label>
      </div>
      <button class="btn btn-primary" data-action="save-item">${isNew ? 'Add dish' : 'Save changes'}</button>
      <div style="height:8px"></div>
      ${isNew ? '' : '<button class="btn btn-danger-ghost" data-action="delete-item">Delete dish</button><div style="height:8px"></div>'}
      <button class="btn btn-ghost" data-action="close-overlay">Cancel</button>
      <div class="spacer"></div>
    </div>
  </div>`;
  app.insertAdjacentHTML('beforeend', html);
}

function renderCartFab() {
  return `<button class="fab-cart" data-action="nav" data-page="cart">
    <span class="c-left"><span class="badge">${cartCount()}</span> View cart</span>
    <span class="c-total">${money(cartTotal())}</span>
  </button>`;
}

function renderBottomNav() {
  const s = state.session;
  if (s.role === 'attendee') {
    if (['cart', 'checkout', 'confirm'].includes(s.attendee.page)) return '';
    const p = s.attendee.page;
    const ordersCount = myOrders().filter((o) => !['collected', 'cancelled'].includes(o.status)).length;
    return `<nav class="bottom-nav">
      <button data-action="nav" data-page="stalls" class="${p === 'stalls' || p === 'stall' ? 'active' : ''}"><span class="ic">🏬</span>Stalls</button>
      <button data-action="nav" data-page="orders" class="${p === 'orders' ? 'active' : ''}"><span class="ic">🧾</span>My Orders${ordersCount ? ' (' + ordersCount + ')' : ''}</button>
    </nav>`;
  }
  if (!s.vendorAuth) return ''; // sign-in screen has no bottom nav
  return `<nav class="bottom-nav">
    <button data-action="vnav" data-page="orders" class="${s.vendorPage === 'orders' ? 'active' : ''}"><span class="ic">📋</span>Orders</button>
    <button data-action="vnav" data-page="menu" class="${s.vendorPage === 'menu' ? 'active' : ''}"><span class="ic">🍽️</span>Menu</button>
  </nav>`;
}

function renderVendorSignIn() {
  const code = state.session.vendorCode || '';
  return `<main class="screen">
    <div class="center-empty" style="padding:44px 24px 10px">
      <div class="big">🔐</div>
      <h2 style="margin-bottom:6px">Vendor sign in</h2>
      <p class="muted" style="max-width:320px;margin:0 auto">Open the invite link emailed to you to sign in to your stall — no password needed. Or paste your access code below.</p>
    </div>
    <div class="field"><label>Access code</label><input data-model="vendorCode" value="${esc(code)}" placeholder="Paste your invite code" autocomplete="off"></div>
    <button class="btn btn-primary" data-action="vendor-signin">Sign in to my stall</button>
    <div style="height:8px"></div>
    <button class="btn btn-ghost" data-action="role" data-role="attendee">Back to browsing</button>
    <div class="spacer"></div>
  </main>`;
}

/* ------------------------------ color util ------------------------------ */
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = pct / 100;
  r = Math.round(Math.min(255, Math.max(0, r + 255 * f)));
  g = Math.round(Math.min(255, Math.max(0, g + 255 * f)));
  b = Math.round(Math.min(255, Math.max(0, b + 255 * f)));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* ============================ EVENT HANDLING =========================== */
function setPath(path, value) {
  const parts = path.split('.');
  let o = state;
  if (parts[0] === 'checkout' || parts[0] === 'editor' || parts[0] === 'stallEditor' || parts[0] === 'vendorCode') o = state.session;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = value;
}
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-model]');
  if (!el) return;
  let v = el.value;
  const path = el.getAttribute('data-model');
  if (path === 'checkout.card.number') v = formatCardNumber(v);
  if (path === 'checkout.card.exp') v = formatExpiry(v);
  if (el.value !== v) { el.value = v; }
  setPath(path, v);
  if (path.indexOf('checkout') === 0) persist();
});

function formatCardNumber(v) {
  const digits = v.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(v) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + '/' + d.slice(2);
}

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.matches('[data-action="pick-stall"]')) {
    setState((s) => { s.session.vendorStallId = el.value; });
  } else if (el.matches('[data-action="toggle-avail"]')) {
    const id = el.getAttribute('data-id');
    const available = el.checked;
    try {
      await api('/api/items/' + id + '/availability', { method: 'PATCH', body: JSON.stringify({ available }) });
      await refresh(); render();
    } catch (e) { toast('Could not update availability'); render(); }
  } else if (el.matches('[data-action="editor-avail"]')) {
    state.session.editor.available = el.checked;
  } else if (el.matches('[data-action="upload-photo"]')) {
    const file = el.files && el.files[0];
    if (!file) return;
    try {
      state.session.editor.photo = await resizeImage(file);
      render();
    } catch (e) { toast('Could not load that image'); }
  }
});

document.addEventListener('click', async (ev) => {
  const t = ev.target.closest('[data-action]');
  if (!t) return;
  const a = t.getAttribute('data-action');

  switch (a) {
    case 'role':
      setState((st) => { st.session.role = t.getAttribute('data-role'); });
      break;
    case 'nav':
      navAttendee(t.getAttribute('data-page'));
      break;
    case 'vnav':
      setState((st) => { st.session.vendorPage = t.getAttribute('data-page'); });
      break;
    case 'open-stall':
      setState((st) => { st.session.attendee.stallId = t.getAttribute('data-id'); st.session.attendee.page = 'stall'; });
      break;
    case 'qty': {
      const stallId = t.getAttribute('data-stall');
      const itemId = t.getAttribute('data-item');
      const d = parseInt(t.getAttribute('data-d'), 10);
      setState(() => setCartQty(stallId, itemId, cartQty(stallId, itemId) + d));
      break;
    }
    case 'pay-method':
      setState((st) => { st.session.checkout.method = t.getAttribute('data-m'); });
      break;
    case 'place-order':
      await placeOrder();
      break;
    case 'advance':
      await advanceOrder(t.getAttribute('data-id'));
      break;
    case 'cancel-order':
      await setOrderStatus(t.getAttribute('data-id'), 'cancelled');
      break;
    case 'add-item':
      openEditor(null);
      break;
    case 'add-stall':
      openStallEditor();
      break;
    case 'vendor-signin':
      await redeemInvite((state.session.vendorCode || '').trim());
      break;
    case 'vendor-logout':
      setState((st) => { st.session.vendorAuth = null; st.session.vendorCode = ''; st.session.role = 'attendee'; });
      toast('Logged out');
      break;
    case 'set-location':
      await setStallLocation();
      break;
    case 'directions': {
      const st = stallById(t.getAttribute('data-id'));
      if (st && st.location) openDirections(st.location, t.getAttribute('data-prov'));
      break;
    }
    case 'pick-emoji':
      state.session.stallEditor.emoji = t.getAttribute('data-v'); render();
      break;
    case 'pick-color':
      state.session.stallEditor.color = t.getAttribute('data-v'); render();
      break;
    case 'create-stall':
      await createStall();
      break;
    case 'edit-item':
      openEditor(t.getAttribute('data-id'));
      break;
    case 'save-item':
      await saveItem();
      break;
    case 'delete-item':
      await deleteItem();
      break;
    case 'remove-photo':
      state.session.editor.photo = null; render();
      break;
    case 'close-overlay':
      if (t.classList.contains('sheet-backdrop') && ev.target !== t) break;
      closeOverlay();
      break;
    case 'install':
      doInstall();
      break;
    case 'dismiss-install':
      setState((st) => { st.session.installDismissed = true; });
      break;
    case 'retry-boot':
      boot();
      break;
  }
});

function navAttendee(page) {
  setState((st) => { st.session.attendee.page = page; });
  window.scrollTo(0, 0);
}

/* ------------------------------- editors -------------------------------- */
function openEditor(id) {
  const st = ensureVendorStall();
  if (!st) { toast('Create a stall first'); return; }
  if (id) {
    const m = itemById(st, id);
    state.session.editor = { id: m.id, name: m.name, desc: m.desc || '', price: String(m.price), emoji: m.emoji || '🍽️', photo: m.photo, available: m.available };
  } else {
    state.session.editor = { id: null, name: '', desc: '', price: '', emoji: '🍽️', photo: null, available: true };
  }
  setState((s) => { s.session.overlay = 'itemEditor'; });
}
function closeOverlay() {
  setState((s) => { s.session.overlay = null; s.session.editor = null; s.session.stallEditor = null; });
}

function openStallEditor() {
  state.session.stallEditor = { name: '', cuisine: '', tagline: '', emoji: '🍖', color: '#0F5C4B' };
  setState((s) => { s.session.overlay = 'stallEditor'; });
}

async function createStall() {
  const e = state.session.stallEditor;
  const name = (e.name || '').trim();
  if (!name) { toast('Please add a stall name'); return; }
  let id;
  try {
    const r = await api('/api/stalls', { method: 'POST', body: JSON.stringify({ name, cuisine: (e.cuisine || '').trim(), tagline: (e.tagline || '').trim(), emoji: e.emoji, color: e.color }) });
    id = r.id;
    await refresh();
  } catch (err) { toast('Could not create stall'); return; }
  state.session.vendorStallId = id;
  state.session.vendorPage = 'menu';
  state.session.overlay = null;
  state.session.stallEditor = null;
  persist(); render();
  toast('Stall created — now add some dishes');
}

async function redeemInvite(code) {
  if (!code) { toast('Enter your access code'); return false; }
  let r;
  try {
    r = await api('/api/vendors/redeem', { method: 'POST', body: JSON.stringify({ code }) });
  } catch (e) { toast('That code is invalid or expired'); return false; }
  state.session.vendorAuth = { token: r.token, vendorId: r.vendor.id, name: r.vendor.name, stallId: r.vendor.stallId, stallName: r.vendor.stallName };
  state.session.role = 'vendor';
  state.session.vendorStallId = r.vendor.stallId;
  state.session.vendorPage = 'orders';
  state.session.vendorCode = '';
  try { await refresh(); } catch (e) {}
  persist(); render();
  toast('Signed in — ' + r.vendor.name);
  return true;
}

async function setStallLocation() {
  const st = ensureVendorStall();
  if (!st) { toast('Create a stall first'); return; }
  toast('Getting your location…');
  let loc;
  try {
    loc = await captureLocation();
  } catch (e) {
    toast('Location unavailable — allow location access and try again');
    return;
  }
  try {
    await api('/api/stalls/' + st.id + '/location', { method: 'PATCH', body: JSON.stringify(loc) });
    await refresh();
  } catch (e) { toast('Could not save location'); return; }
  render();
  toast('📍 Stall pin dropped');
}

async function saveItem() {
  const e = state.session.editor;
  const name = (e.name || '').trim();
  const price = parseFloat(String(e.price).replace(',', '.'));
  if (!name) { toast('Please add a dish name'); return; }
  if (!(price >= 0) || isNaN(price)) { toast('Please enter a valid price'); return; }
  const payload = { name, desc: (e.desc || '').trim(), price, photo: e.photo, available: e.available };
  try {
    if (e.id) await api('/api/items/' + e.id, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/api/stalls/' + state.session.vendorStallId + '/items', { method: 'POST', body: JSON.stringify(payload) });
    await refresh();
  } catch (err) { toast('Could not save dish'); return; }
  const wasEdit = !!e.id;
  state.session.overlay = null; state.session.editor = null;
  persist(); render();
  toast(wasEdit ? 'Dish updated' : 'Dish added');
}

async function deleteItem() {
  const e = state.session.editor;
  try {
    await api('/api/items/' + e.id, { method: 'DELETE' });
    await refresh();
  } catch (err) { toast('Could not delete dish'); return; }
  state.session.overlay = null; state.session.editor = null;
  persist(); render();
  toast('Dish deleted');
}

async function advanceOrder(id) {
  const o = state.orders.find((x) => x.id === id);
  if (!o) return;
  const i = STATUS_FLOW.indexOf(o.status);
  if (i < 0 || i >= STATUS_FLOW.length - 1) return;
  await setOrderStatus(id, STATUS_FLOW[i + 1]);
}
async function setOrderStatus(id, status) {
  try {
    await api('/api/orders/' + id, { method: 'PATCH', body: JSON.stringify({ status }) });
    await refresh(); render();
    if (status === 'cancelled') toast('Order cancelled');
  } catch (e) { toast('Could not update order'); }
}

/* ------------------------------ place order ----------------------------- */
async function placeOrder() {
  const c = state.session.checkout;
  const name = (c.name || '').trim();
  if (!name) { toast('Please enter your name'); return; }
  let last4 = null;
  if (c.method === 'card') {
    const num = c.card.number.replace(/\s/g, '');
    if (num.length < 15) { toast('Enter a valid card number'); return; }
    if (!/^\d{2}\/\d{2}$/.test(c.card.exp)) { toast('Enter card expiry as MM/YY'); return; }
    if (c.card.cvv.length < 3) { toast('Enter the 3-digit CVV'); return; }
    if (!c.card.holder.trim()) { toast('Enter the name on the card'); return; }
    last4 = num.slice(-4);
    const btn = $('#placeBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing payment…'; }
    await new Promise((r) => setTimeout(r, 900)); // simulate gateway
  }

  const groups = cartByStall().map((g) => ({
    stallId: g.stall.id, stallName: g.stall.name,
    items: g.lines.map((l) => ({ id: l.item.id, name: l.item.name, price: l.item.price, qty: l.qty })),
    total: g.lines.reduce((s2, l) => s2 + l.item.price * l.qty, 0),
    payment: { method: c.method, status: c.method === 'card' ? 'paid' : 'due', last4 },
    customer: name,
  }));
  if (!groups.length) { toast('Your cart is empty'); return; }

  let created;
  try {
    const r = await api('/api/orders', { method: 'POST', body: JSON.stringify({ orders: groups }) });
    created = r.orders || [];
  } catch (e) {
    toast('Could not place order — check your connection');
    const btn = $('#placeBtn'); if (btn) { btn.disabled = false; btn.textContent = 'Place order'; }
    return;
  }

  const ids = created.map((o) => o.id);
  state.session.myOrderIds = (state.session.myOrderIds || []).concat(ids);
  state.session.cart = [];
  state.session.attendee.lastOrderIds = ids;
  state.session.attendee.page = 'confirm';
  state.session.attendeeName = name;
  state.session.checkout.card = { number: '', exp: '', cvv: '', holder: '' };
  try { await refresh(); } catch (e) {}
  persist(); render();
  window.scrollTo(0, 0);
  toast(c.method === 'card' ? 'Payment successful' : 'Order placed');
}

/* ------------------------------- install -------------------------------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (state.session && state.session.role === 'attendee' && state.session.attendee.page === 'stalls') render();
});
async function doInstall() {
  if (!deferredPrompt) { toast('Use your browser menu → “Add to Home Screen”'); return; }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  setState((st) => { st.session.installDismissed = true; });
}

/* ------------------------------ boot states ----------------------------- */
function bootLoading() {
  app.innerHTML = `<header class="appbar"><div class="appbar-top"><div class="brand"><span class="logo">🍴</span> Event<em>Eats</em></div></div></header>
    <main class="screen"><div class="center-empty"><div class="big">⏳</div>Loading…</div></main>`;
}
function bootError() {
  app.innerHTML = `<header class="appbar"><div class="appbar-top"><div class="brand"><span class="logo">🍴</span> Event<em>Eats</em></div></div></header>
    <main class="screen"><div class="center-empty"><div class="big">📡</div>Can't reach the EventEats server.<br>
    <span class="muted">Make sure the backend is running and that <b>config.js</b> points to it.</span>
    <div style="height:16px"></div>
    <button class="btn btn-primary" data-action="retry-boot">Retry</button></div></main>`;
}

/* -------------------------------- boot ---------------------------------- */
let pollTimer;
function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (document.hidden || !state.session) return;
    const s = state.session;
    if (s.overlay) return;                                    // don't disrupt an open editor
    if (s.role === 'attendee' && s.attendee.page === 'checkout') return; // don't wipe the card form
    try {
      const before = JSON.stringify(state.stalls) + '|' + JSON.stringify(state.orders);
      await refresh();
      if (before !== JSON.stringify(state.stalls) + '|' + JSON.stringify(state.orders)) render();
    } catch (e) { /* transient network error; try again next tick */ }
  }, 4000);
}

async function boot() {
  bootLoading();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) {}
  const d = defaultSession();
  state.session = Object.assign({}, d, saved || {});
  state.session.attendee = Object.assign({}, d.attendee, (saved && saved.attendee) || {});
  state.session.checkout = Object.assign({}, d.checkout, (saved && saved.checkout) || {});
  state.session.checkout.card = { number: '', exp: '', cvv: '', holder: '' };
  state.session.cart = (saved && saved.cart) || [];
  state.session.myOrderIds = (saved && saved.myOrderIds) || [];
  state.session.vendorAuth = (saved && saved.vendorAuth) || null;
  state.session.vendorCode = '';
  state.session.editor = null; state.session.stallEditor = null; state.session.overlay = null;
  if (['confirm', 'checkout', 'cart'].includes(state.session.attendee.page)) state.session.attendee.page = 'stalls';

  // Magic-link sign-in: ?invite=CODE from the emailed link
  const invite = new URLSearchParams(location.search).get('invite');
  let inviteFailed = false;
  if (invite) {
    try {
      const r = await api('/api/vendors/redeem', { method: 'POST', body: JSON.stringify({ code: invite }) });
      state.session.vendorAuth = { token: r.token, vendorId: r.vendor.id, name: r.vendor.name, stallId: r.vendor.stallId, stallName: r.vendor.stallName };
      state.session.role = 'vendor';
      state.session.vendorStallId = r.vendor.stallId;
      state.session.vendorPage = 'orders';
    } catch (e) { inviteFailed = true; }
    history.replaceState({}, document.title, location.pathname);
  } else if (state.session.vendorAuth) {
    try {
      const me = await api('/api/vendors/me');
      Object.assign(state.session.vendorAuth, { name: me.vendor.name, stallName: me.vendor.stallName, stallId: me.vendor.stallId });
      state.session.vendorStallId = me.vendor.stallId;
    } catch (e) {
      state.session.vendorAuth = null;
      if (state.session.role === 'vendor') state.session.role = 'attendee';
    }
  }

  try {
    await refresh();
  } catch (e) {
    bootError();
    return;
  }
  if (inviteFailed) toast('That invite link is invalid or expired');
  if (!state.session.vendorStallId && state.stalls[0]) state.session.vendorStallId = state.stalls[0].id;
  render();
  startPolling();
}

boot();
