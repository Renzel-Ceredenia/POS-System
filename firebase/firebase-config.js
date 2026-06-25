// ============================================================
// Firebase Configuration & Core Database Operations
// POS Professional - Production Ready
// ============================================================

// ── IMPORTANT ─────────────────────────────────────────────────
// Replace the values below with your actual Firebase project config.
// Get it from: Firebase Console → Project Settings → Your Apps → SDK setup and configuration
// The databaseURL below is your confirmed Realtime Database URL.
// ─────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "AIzaSyCqa1c9vyRN1YAcOM5qdh4uUfF58z2OcTw",
  authDomain: "pos-electives.firebaseapp.com",
  databaseURL: "https://pos-electives-default-rtdb.firebaseio.com",
  projectId: "pos-electives",
  storageBucket: "pos-electives.firebasestorage.app",
  messagingSenderId: "567780458708",
  appId: "1:567780458708:web:87af3fae7cb53ef6a27b41",
  measurementId: "G-85NGGL71JC"
};

// Initialize Firebase (prevent double-init)
if (!firebase.apps || firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();

// Set Firebase persistence to LOCAL (survives browser refresh)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
  console.error('Could not set Firebase persistence:', err);
});

// ── Helpers ──────────────────────────────────────────────────

function dbRef(path) { return db.ref(path); }

async function dbRead(path) {
  const snap = await dbRef(path).once('value');
  return snap.val();
}

async function dbWrite(path, data) {
  await dbRef(path).set(data);
  return true;
}

async function dbUpdate(path, data) {
  await dbRef(path).update(data);
  return true;
}

async function dbPush(path, data) {
  const ref = dbRef(path).push();
  await ref.set(data);
  return ref.key;
}

async function dbRemove(path) {
  await dbRef(path).remove();
  return true;
}

function dbListen(path, cb) {
  dbRef(path).on('value', snap => cb(snap.val()));
  return () => dbRef(path).off('value');
}

// ── Products ─────────────────────────────────────────────────

async function getAllProducts() {
  return dbRead('admin/products');
}

async function getProduct(id) {
  return dbRead(`admin/products/${id}`);
}

async function createProduct(data) {
  const id = 'prod_' + Date.now();
  await dbWrite(`admin/products/${id}`, { ...data, id, createdAt: new Date().toISOString() });
  return id;
}

async function updateProduct(id, data) {
  return dbUpdate(`admin/products/${id}`, { ...data, updatedAt: new Date().toISOString() });
}

async function deleteProduct(id) {
  return dbRemove(`admin/products/${id}`);
}

// ── Inventory ─────────────────────────────────────────────────

async function getAllInventory() { return dbRead('admin/inventory'); }

async function updateInventory(productId, quantity) {
  return dbUpdate(`admin/products/${productId}`, {
    quantity,
    updatedAt: new Date().toISOString()
  });
}

// ── Sales ─────────────────────────────────────────────────────

async function getAllSalesTransactions() {
  return dbRead('admin/sales');
}

async function createSaleTransaction(data) {
  const id = 'txn_' + Date.now();
  await dbWrite(`admin/sales/${id}`, { ...data, id, timestamp: new Date().toISOString() });
  return id;
}

async function getSalesTransactionsByDate(date) {
  const all = await getAllSalesTransactions();
  if (!all) return {};
  const dateStr = new Date(date).toDateString();
  const filtered = {};
  Object.entries(all).forEach(([k, v]) => {
    if (new Date(v.timestamp).toDateString() === dateStr) filtered[k] = v;
  });
  return filtered;
}

// ── Users ─────────────────────────────────────────────────────

async function getAllUsers() { return dbRead('admin/users'); }
async function getUserFromDatabase(uid) { return dbRead(`admin/users/${uid}`); }

async function createUser(uid, data) {
  return dbWrite(`admin/users/${uid}`, {
    ...data,
    createdAt: new Date().toISOString(),
    status: data.status || 'active'
  });
}

async function updateUserRecord(uid, data) {
  return dbUpdate(`admin/users/${uid}`, { ...data, updatedAt: new Date().toISOString() });
}

async function deleteUserRecord(uid) {
  return dbRemove(`admin/users/${uid}`);
}

// ── Employees ─────────────────────────────────────────────────

async function getAllEmployees() { return dbRead('admin/employees'); }

async function createEmployee(data) {
  return dbPush('admin/employees', { ...data, createdAt: new Date().toISOString() });
}

async function updateEmployee(id, data) {
  return dbUpdate(`admin/employees/${id}`, data);
}

async function deleteEmployee(id) {
  return dbRemove(`admin/employees/${id}`);
}

// ── Settings ──────────────────────────────────────────────────

async function getSettings() { return dbRead('admin/settings'); }

async function updateSettings(data) {
  return dbUpdate('admin/settings', { ...data, updatedAt: new Date().toISOString() });
}

// ── Activity Logs ─────────────────────────────────────────────

async function logActivity(userId, action, description) {
  const id = 'log_' + Date.now();
  return dbWrite(`admin/logs/${id}`, {
    id, userId, action, description,
    timestamp: new Date().toISOString()
  });
}

async function getActivityLogs(limit = 50) {
  const logs = await dbRead('admin/logs');
  if (!logs) return [];
  return Object.values(logs)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

// ── Roles ─────────────────────────────────────────────────────

async function getRoles() { return dbRead('admin/roles'); }

// ── Analytics ─────────────────────────────────────────────────

async function getAnalyticsData() { return dbRead('admin/analytics'); }

console.log('✓ firebase-config.js loaded');
