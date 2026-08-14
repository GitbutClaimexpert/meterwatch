/* =========================================================================
   EventEats — data layer (PostgreSQL)
   One pool, three tables: stalls, menu_items, orders.
   Photos are stored as resized data-URL strings on the menu_items row
   (the frontend downsizes to ~900px JPEG before upload), so no file volume
   is required. If dish-photo volume grows large, move photos to a Railway
   volume or object storage and keep only a URL here.
   ========================================================================= */
'use strict';

const { Pool } = require('pg');
const crypto = require('crypto');

const conn = process.env.DATABASE_URL || '';
const isLocal = /localhost|127\.0\.0\.1|@postgres[:/]/.test(conn);
const pool = new Pool({
  connectionString: conn,
  // Railway's managed Postgres requires SSL; local dev does not.
  ssl: conn && !isLocal ? { rejectUnauthorized: false } : false,
});

const q = (text, params) => pool.query(text, params);
const uid = (p) => p + '_' + crypto.randomBytes(6).toString('hex');
function code4() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += A[crypto.randomInt(A.length)];
  return s;
}

/* ------------------------------- schema --------------------------------- */
async function init() {
  await q(`CREATE TABLE IF NOT EXISTS stalls (
    id text PRIMARY KEY,
    name text NOT NULL,
    cuisine text,
    tagline text,
    emoji text,
    color text,
    sort integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
  )`);
  await q(`CREATE TABLE IF NOT EXISTS menu_items (
    id text PRIMARY KEY,
    stall_id text REFERENCES stalls(id) ON DELETE CASCADE,
    name text NOT NULL,
    descr text,
    price numeric NOT NULL DEFAULT 0,
    emoji text,
    photo text,
    available boolean DEFAULT true,
    sort integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
  )`);
  await q(`CREATE TABLE IF NOT EXISTS orders (
    id text PRIMARY KEY,
    code text,
    stall_id text,
    stall_name text,
    items jsonb NOT NULL,
    total numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'placed',
    payment jsonb,
    customer text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`);
  // location pin (added via migration so existing databases pick it up)
  await q(`ALTER TABLE stalls ADD COLUMN IF NOT EXISTS lat double precision`);
  await q(`ALTER TABLE stalls ADD COLUMN IF NOT EXISTS lng double precision`);
  // hero photo shown on the stall card (added via migration)
  await q(`ALTER TABLE stalls ADD COLUMN IF NOT EXISTS photo text`);
  // small key/value store for one-off data migrations (e.g. demo reseeds)
  await q(`CREATE TABLE IF NOT EXISTS app_meta (key text PRIMARY KEY, value text)`);
  await q(`CREATE TABLE IF NOT EXISTS vendors (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text,
    stall_id text REFERENCES stalls(id) ON DELETE SET NULL,
    invite_code text,
    invite_expires timestamptz,
    active boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    last_login timestamptz
  )`);
  await q(`CREATE INDEX IF NOT EXISTS idx_items_stall ON menu_items(stall_id)`);
  await q(`CREATE INDEX IF NOT EXISTS idx_orders_stall ON orders(stall_id)`);
  await q(`CREATE INDEX IF NOT EXISTS idx_vendors_invite ON vendors(invite_code)`);

  const { rows } = await q('SELECT count(*)::int AS n FROM stalls');
  if (rows[0].n === 0) await seed();
  await reseedDemoV2();
  await backfillSamplePhotos();
}

/* --------------------- sample dish photos (demo only) ------------------- */
// Real food photos bundled with the app (served from the frontend at /food/...)
// so the seeded demo dishes look real. Vendors upload their own for their stalls.
const SAMPLE_PHOTOS = {
  // The Burger Joint
  'Classic Cheeseburger': '/food/burger.jpg',
  'Veggie Burger': '/food/burger.jpg',
  // Dawg House
  'The Classic Dawg': '/food/hotdog.jpg',
  'Loaded Dawg': '/food/hotdog.jpg',
  // Gelato Station
  'Gelato Waffle Cone': '/food/gelato.jpg',
  'Gelato Cup (2 scoops)': '/food/gelato.jpg',
  // Pizzeria Bella
  'Margherita Slice': '/food/pizza.jpg',
  'Pepperoni Slice': '/food/pizza.jpg',
};
// Apply the bundled photos to the existing sample dishes on deploy (fills empty
// photos and replaces any earlier stock-photo URLs), without touching real
// vendor uploads (which are stored as data URLs).
async function backfillSamplePhotos() {
  for (const [name, url] of Object.entries(SAMPLE_PHOTOS)) {
    await q(`UPDATE menu_items SET photo=$2 WHERE name=$1 AND (photo IS NULL OR photo='' OR photo LIKE 'http%')`, [name, url]);
  }
  // Clear any leftover external stock-photo URLs from other dishes.
  await q(`UPDATE menu_items SET photo=NULL WHERE photo LIKE 'https://loremflickr%'`);
}

/* ---------------------------- demo stall data --------------------------- */
// The four demo stalls shown on a fresh install. Vendors add their own via
// the vendor/admin flow; these are just so the app looks alive on day one.
const DEMO_STALLS = [
  { name: 'The Burger Joint', cuisine: 'Gourmet Burgers', tagline: 'Custom-grind beef and veggie options', emoji: '🍔', color: '#0F5C4B', photo: '/food/burger.jpg', menu: [
    { name: 'Classic Cheeseburger', desc: 'Juicy, hand-pressed beef grilled on a toasted brioche bun, topped with melted cheddar', price: 95, emoji: '🍔' },
    { name: 'Veggie Burger', desc: 'Hand-pressed veggie patty, fresh salad and house sauce on a brioche bun', price: 85, emoji: '🥬' },
  ] },
  { name: 'Dawg House', cuisine: 'Classic Hotdogs', tagline: 'Traditional and creative toppings', emoji: '🌭', color: '#C4A24C', photo: '/food/hotdog.jpg', menu: [
    { name: 'The Classic Dawg', desc: 'Premium all-beef frankfurter in a soft bun with tangy mustard and ketchup', price: 75, emoji: '🌭' },
    { name: 'Loaded Dawg', desc: 'All-beef frankfurter piled with gourmet toppings of your choice', price: 95, emoji: '🌭' },
  ] },
  { name: 'Gelato Station', cuisine: 'Gelato & Desserts', tagline: 'Award-winning handcrafted gelato', emoji: '🍦', color: '#6B4A7A', photo: '/food/gelato.jpg', menu: [
    { name: 'Gelato Waffle Cone', desc: 'A smooth swirl of rich, creamy gelato piped into a crispy waffle cone', price: 55, emoji: '🍦' },
    { name: 'Gelato Cup (2 scoops)', desc: 'Two scoops of handcrafted gelato served in a cup', price: 50, emoji: '🍨' },
  ] },
  { name: 'Pizzeria Bella', cuisine: 'Artisan Pizza', tagline: 'Wood-fired, hand-tossed classic slices', emoji: '🍕', color: '#8C2F39', photo: '/food/pizza.jpg', menu: [
    { name: 'Margherita Slice', desc: 'Neapolitan-style slice: San Marzano tomatoes, buffalo mozzarella, fresh basil, char-spotted crust', price: 60, emoji: '🍕' },
    { name: 'Pepperoni Slice', desc: 'Wood-fired, hand-tossed slice loaded with pepperoni', price: 70, emoji: '🍕' },
  ] },
];

// Names of the original demo stalls, replaced by the reseed below.
const OLD_DEMO_STALLS = ['Smoke & Fire BBQ', 'Bunny Chow Bros', 'Taco Loco', 'Sweet Peaks', 'Green Bowl', 'Boerie & Co'];

/* ----------------------- one-off demo reseed (v2) ----------------------- */
// The live database was first seeded with the original 6 SA demo stalls.
// This migration swaps that demo content for the new 4 stalls, ONCE, without
// touching any stalls a real vendor created (only the known old demo names are
// removed). Runs at most once, guarded by app_meta.menu_version.
async function reseedDemoV2() {
  const { rows } = await q(`SELECT value FROM app_meta WHERE key='menu_version'`);
  if (rows[0] && rows[0].value === '2') return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Remove the old demo sample orders and stalls (cascades to their items).
    await client.query(`DELETE FROM orders WHERE customer IN ('Thandi M.','Sipho K.')`);
    await client.query(
      `DELETE FROM orders WHERE stall_id IN (SELECT id FROM stalls WHERE name = ANY($1))`,
      [OLD_DEMO_STALLS]);
    await client.query(`DELETE FROM stalls WHERE name = ANY($1)`, [OLD_DEMO_STALLS]);

    // Insert the new demo stalls only if they aren't already present.
    let sortBase = (await client.query(`SELECT COALESCE(MAX(sort),-1)+1 AS s FROM stalls`)).rows[0].s;
    for (const s of DEMO_STALLS) {
      const exists = await client.query(`SELECT 1 FROM stalls WHERE name=$1`, [s.name]);
      if (exists.rowCount) continue;
      const id = uid('stall');
      await client.query('INSERT INTO stalls(id,name,cuisine,tagline,emoji,color,photo,sort) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [id, s.name, s.cuisine, s.tagline, s.emoji, s.color, s.photo, sortBase++]);
      let isort = 0;
      for (const m of s.menu) {
        await client.query('INSERT INTO menu_items(id,stall_id,name,descr,price,emoji,photo,available,sort) VALUES($1,$2,$3,$4,$5,$6,$7,true,$8)',
          [uid('itm'), id, m.name, m.desc, m.price, m.emoji, SAMPLE_PHOTOS[m.name] || null, isort++]);
      }
    }
    await client.query(
      `INSERT INTO app_meta(key,value) VALUES('menu_version','2')
       ON CONFLICT (key) DO UPDATE SET value='2'`);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/* -------------------------------- seed ---------------------------------- */
async function seed() {
  const stalls = DEMO_STALLS;

  const created = [];
  let sort = 0;
  for (const s of stalls) {
    const id = uid('stall');
    await q('INSERT INTO stalls(id,name,cuisine,tagline,emoji,color,photo,sort) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, s.name, s.cuisine, s.tagline, s.emoji, s.color, s.photo || null, sort++]);
    let isort = 0;
    const items = [];
    for (const m of s.menu) {
      const iid = uid('itm');
      await q('INSERT INTO menu_items(id,stall_id,name,descr,price,emoji,photo,available,sort) VALUES($1,$2,$3,$4,$5,$6,$7,true,$8)',
        [iid, id, m.name, m.desc, m.price, m.emoji, SAMPLE_PHOTOS[m.name] || null, isort++]);
      items.push({ id: iid, ...m });
    }
    created.push({ id, name: s.name, items });
  }

  // a couple of sample incoming orders so the vendor dashboard isn't empty
  const s0 = created[0], s1 = created[1];
  await createOrders([
    {
      stallId: s0.id, stallName: s0.name,
      items: [{ id: s0.items[0].id, name: s0.items[0].name, price: s0.items[0].price, qty: 2 }],
      total: s0.items[0].price * 2,
      payment: { method: 'card', status: 'paid', last4: '4242' },
      customer: 'Thandi M.',
    },
    {
      stallId: s1.id, stallName: s1.name,
      items: [
        { id: s1.items[0].id, name: s1.items[0].name, price: s1.items[0].price, qty: 1 },
        { id: s1.items[1].id, name: s1.items[1].name, price: s1.items[1].price, qty: 1 },
      ],
      total: s1.items[0].price + s1.items[1].price,
      payment: { method: 'collect', status: 'due' },
      customer: 'Sipho K.',
    },
  ]);
  // nudge the second sample order along so statuses look realistic
  await q(`UPDATE orders SET status='preparing' WHERE customer='Sipho K.'`);
}

/* ------------------------------- reads ---------------------------------- */
async function getStalls() {
  const stalls = (await q('SELECT * FROM stalls ORDER BY sort, created_at')).rows;
  const items = (await q('SELECT * FROM menu_items ORDER BY sort, created_at')).rows;
  return stalls.map((s) => ({
    id: s.id, name: s.name, cuisine: s.cuisine, tagline: s.tagline, emoji: s.emoji, color: s.color, photo: s.photo || null,
    location: (s.lat != null && s.lng != null) ? { lat: Number(s.lat), lng: Number(s.lng) } : null,
    menu: items.filter((i) => i.stall_id === s.id).map((i) => ({
      id: i.id, name: i.name, desc: i.descr, price: Number(i.price),
      emoji: i.emoji, photo: i.photo, available: i.available,
    })),
  }));
}

function mapOrder(o) {
  return {
    id: o.id, code: o.code, stallId: o.stall_id, stallName: o.stall_name,
    items: o.items, total: Number(o.total), status: o.status, payment: o.payment,
    customer: o.customer,
    createdAt: new Date(o.created_at).getTime(),
    updatedAt: new Date(o.updated_at).getTime(),
  };
}
async function getOrders() {
  const { rows } = await q('SELECT * FROM orders ORDER BY created_at');
  return rows.map(mapOrder);
}

/* ------------------------------- writes --------------------------------- */
async function createStall(d) {
  const id = uid('stall');
  const { rows } = await q('SELECT COALESCE(MAX(sort),0)+1 AS s FROM stalls');
  const lat = d.lat != null && d.lat !== '' ? parseFloat(d.lat) : null;
  const lng = d.lng != null && d.lng !== '' ? parseFloat(d.lng) : null;
  await q('INSERT INTO stalls(id,name,cuisine,tagline,emoji,color,sort,lat,lng) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id, String(d.name).trim(), (d.cuisine || 'Food').trim(), (d.tagline || '').trim(), d.emoji || '🍽️', d.color || '#FF5A3C', rows[0].s,
     isNaN(lat) ? null : lat, isNaN(lng) ? null : lng]);
  return id;
}

async function addItem(stallId, d) {
  const id = uid('itm');
  const { rows } = await q('SELECT COALESCE(MAX(sort),0)+1 AS s FROM menu_items WHERE stall_id=$1', [stallId]);
  await q('INSERT INTO menu_items(id,stall_id,name,descr,price,emoji,photo,available,sort) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id, stallId, String(d.name).trim(), (d.desc || '').trim(), num(d.price), d.emoji || '🍽️', d.photo || null, d.available !== false, rows[0].s]);
  return id;
}

async function updateItem(id, d) {
  await q('UPDATE menu_items SET name=$2, descr=$3, price=$4, photo=$5, available=$6 WHERE id=$1',
    [id, String(d.name).trim(), (d.desc || '').trim(), num(d.price), d.photo || null, d.available !== false]);
}

async function setAvailability(id, available) {
  await q('UPDATE menu_items SET available=$2 WHERE id=$1', [id, !!available]);
}

async function setStallLocation(id, lat, lng) {
  const la = parseFloat(lat), ln = parseFloat(lng);
  if (isNaN(la) || isNaN(ln)) throw new Error('bad coords');
  await q('UPDATE stalls SET lat=$2, lng=$3 WHERE id=$1', [id, la, ln]);
}

async function deleteItem(id) {
  await q('DELETE FROM menu_items WHERE id=$1', [id]);
}

async function createOrders(groups) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = [];
    for (const g of groups) {
      const id = uid('ord');
      const r = await client.query(
        `INSERT INTO orders(id,code,stall_id,stall_name,items,total,status,payment,customer)
         VALUES($1,$2,$3,$4,$5,$6,'placed',$7,$8) RETURNING *`,
        [id, code4(), g.stallId, g.stallName, JSON.stringify(g.items || []), num(g.total), JSON.stringify(g.payment || {}), (g.customer || 'Guest')]);
      out.push(r.rows[0]);
    }
    await client.query('COMMIT');
    return out.map(mapOrder);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function updateOrderStatus(id, status) {
  const allowed = ['placed', 'accepted', 'preparing', 'ready', 'collected', 'cancelled'];
  if (!allowed.includes(status)) throw new Error('bad status');
  // When a pay-on-collection order is collected, mark it paid.
  await q(
    `UPDATE orders
       SET status=$2,
           updated_at=now(),
           payment = CASE WHEN $2='collected' AND payment->>'method'='collect'
                          THEN jsonb_set(payment,'{status}','"paid"') ELSE payment END
     WHERE id=$1`,
    [id, status]);
}

function num(v) { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; }

/* ------------------------------ ownership ------------------------------- */
async function getItemStallId(itemId) {
  const { rows } = await q('SELECT stall_id FROM menu_items WHERE id=$1', [itemId]);
  return rows[0] ? rows[0].stall_id : null;
}
async function getOrderStallId(orderId) {
  const { rows } = await q('SELECT stall_id FROM orders WHERE id=$1', [orderId]);
  return rows[0] ? rows[0].stall_id : null;
}

/* ------------------------------- vendors -------------------------------- */
async function createVendorWithStall(d) {
  const stallId = await createStall({
    name: d.stallName || d.name + "'s stall",
    cuisine: d.cuisine, tagline: d.tagline, emoji: d.emoji, color: d.color,
  });
  const id = uid('vnd');
  await q('INSERT INTO vendors(id,name,email,stall_id,invite_code,invite_expires) VALUES($1,$2,$3,$4,$5,$6)',
    [id, String(d.name || '').trim(), String(d.email || '').trim() || null, stallId, d.invite_code, d.invite_expires]);
  return { id, stallId };
}
async function listVendors() {
  const { rows } = await q(`SELECT v.*, s.name AS stall_name FROM vendors v LEFT JOIN stalls s ON s.id=v.stall_id ORDER BY v.created_at DESC`);
  return rows.map((v) => ({
    id: v.id, name: v.name, email: v.email, stallId: v.stall_id, stallName: v.stall_name,
    active: v.active, createdAt: v.created_at, lastLogin: v.last_login, hasInvite: !!v.invite_code,
  }));
}
async function setVendorInvite(id, code, expires) {
  await q('UPDATE vendors SET invite_code=$2, invite_expires=$3 WHERE id=$1', [id, code, expires]);
}
async function getVendorByInvite(code) {
  if (!code) return null;
  const { rows } = await q('SELECT v.*, s.name AS stall_name FROM vendors v LEFT JOIN stalls s ON s.id=v.stall_id WHERE v.invite_code=$1', [code]);
  const v = rows[0];
  if (!v) return null;
  if (v.invite_expires && new Date(v.invite_expires).getTime() < Date.now()) return null;
  return { id: v.id, name: v.name, stallId: v.stall_id, stallName: v.stall_name };
}
async function getVendorById(id) {
  const { rows } = await q('SELECT v.*, s.name AS stall_name FROM vendors v LEFT JOIN stalls s ON s.id=v.stall_id WHERE v.id=$1', [id]);
  const v = rows[0];
  if (!v) return null;
  return { id: v.id, name: v.name, stallId: v.stall_id, stallName: v.stall_name };
}
async function markVendorLogin(id) {
  await q('UPDATE vendors SET active=true, last_login=now() WHERE id=$1', [id]);
}
async function deleteVendor(id) {
  await q('DELETE FROM vendors WHERE id=$1', [id]);
}

module.exports = {
  init, getStalls, getOrders, createStall, addItem, updateItem,
  setAvailability, setStallLocation, deleteItem, createOrders, updateOrderStatus,
  getItemStallId, getOrderStallId,
  createVendorWithStall, listVendors, setVendorInvite, getVendorByInvite,
  getVendorById, markVendorLogin, deleteVendor,
};
