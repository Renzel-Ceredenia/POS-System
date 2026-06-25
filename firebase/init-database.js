// ============================================================
// Database Initializer - Runs ONCE to seed admin account
// and create default database structure
// POS Professional - Production Ready
// ============================================================

// ── Admin Seed Credentials ────────────────────────────────────
// Change these before running if desired.
// The admin will be required to change their password on first login.
const ADMIN_EMAIL    = 'admin@pos.local';
const ADMIN_PASSWORD = 'Admin@2026!';

async function initializeDatabase() {
  console.log('🚀 POS Database Initialization...');

  try {
    // ── 1. Ensure default DB structure exists ─────────────────
    await createDefaultStructure();

    // ── 2. Create admin Firebase Auth account if not exists ───
    await createAdminAccount();

    // ── 3. Seed sample products ───────────────────────────────
    await seedSampleProducts();

    console.log('✅ Database initialization complete.');
    return { success: true };
  } catch (err) {
    console.error('❌ Initialization failed:', err);
    return { success: false, error: err.message };
  }
}

// ── Default Structure ─────────────────────────────────────────

async function createDefaultStructure() {
  const existing = await dbRead('admin');

  // Settings
  if (!existing?.settings) {
    await dbWrite('admin/settings', {
      businessName:    'POS Professional',
      businessEmail:   'admin@pos.local',
      businessPhone:   '+1 (555) 000-0000',
      businessAddress: '123 Retail Street, Commerce City',
      currency:        '₱',
      currencyCode:    'PHP',
      receiptFooter:   'Thank you for your purchase!',
      lowStockThreshold: 5,
      createdAt: new Date().toISOString()
    });
    console.log('  ✓ Settings created');
  }

  // Roles
  if (!existing?.roles) {
    await dbWrite('admin/roles', {
      admin: {
        label: 'Administrator',
        permissions: ['dashboard','sales','analytics','profile','settings','users','employees','products','inventory']
      },
      manager: {
        label: 'Manager',
        permissions: ['dashboard','sales','analytics','profile','products','inventory']
      },
      cashier: {
        label: 'Cashier',
        permissions: ['sales','profile']
      }
    });
    console.log('  ✓ Roles created');
  }

  // Placeholder nodes
  const nodes = ['users','employees','products','inventory','sales','analytics','logs'];
  for (const node of nodes) {
    if (!existing?.[node]) {
      await dbWrite(`admin/${node}/_placeholder`, { initialized: true, createdAt: new Date().toISOString() });
      console.log(`  ✓ ${node} node created`);
    }
  }
}

// ── Admin Account ─────────────────────────────────────────────

async function createAdminAccount() {
  // Check if admin already exists in users node
  const users = await dbRead('admin/users');
  const hasAdmin = users && Object.values(users).some(u => u.role === 'admin' && u.email === ADMIN_EMAIL);

  if (hasAdmin) {
    console.log('  ℹ Admin account already exists — skipping.');
    return;
  }

  // Create Firebase Auth user
  let uid;
  try {
    const result = await auth.createUserWithEmailAndPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    uid = result.user.uid;
    console.log('  ✓ Admin Firebase Auth created');
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      // Sign in to get existing UID
      try {
        const result = await auth.signInWithEmailAndPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
        uid = result.user.uid;
        console.log('  ℹ Admin auth account already exists — using existing UID');
      } catch (signInErr) {
        console.warn('  ⚠ Could not sign in as admin:', signInErr.message);
        return;
      }
    } else {
      throw err;
    }
  }

  // Write admin record to database
  await dbWrite(`admin/users/${uid}`, {
    uid,
    fullName:    'System Administrator',
    username:    'admin',
    email:       ADMIN_EMAIL,
    role:        'admin',
    status:      'active',
    firstLogin:  false,
    createdAt:   new Date().toISOString(),
    createdBy:   'system'
  });

  console.log(`  ✓ Admin user record written (uid: ${uid})`);
  console.log(`  📧 Email:    ${ADMIN_EMAIL}`);
  console.log(`  🔑 Password: ${ADMIN_PASSWORD}`);
}

// ── Sample Products ───────────────────────────────────────────

async function seedSampleProducts() {
  const existing = await dbRead('admin/products');
  const realProducts = existing
    ? Object.values(existing).filter(p => !p.initialized)
    : [];

  if (realProducts.length > 0) {
    console.log(`  ℹ ${realProducts.length} products exist — skipping seed.`);
    return;
  }

  const samples = [
    { name: 'Mineral Water 500ml',  category: 'Beverages',   price: 25,   quantity: 100, minStock: 20, barcode: '8901234567890', status: 'active', description: 'Cold drinking water' },
    { name: 'White Bread Loaf',     category: 'Bakery',      price: 65,   quantity: 50,  minStock: 10, barcode: '8901234567891', status: 'active', description: 'Fresh white bread' },
    { name: 'Instant Coffee 3-in-1',category: 'Beverages',   price: 12,   quantity: 200, minStock: 30, barcode: '8901234567892', status: 'active', description: 'Sachet instant coffee' },
    { name: 'Banana (per kg)',       category: 'Produce',     price: 80,   quantity: 30,  minStock: 10, barcode: '8901234567893', status: 'active', description: 'Fresh Cavendish bananas' },
    { name: 'Canned Sardines',       category: 'Canned Goods',price: 35,   quantity: 80,  minStock: 15, barcode: '8901234567894', status: 'active', description: 'Tomato sauce sardines' },
    { name: 'Laundry Soap Bar',      category: 'Household',   price: 28,   quantity: 60,  minStock: 10, barcode: '8901234567895', status: 'active', description: 'Household laundry bar' },
    { name: 'Rice (1kg)',            category: 'Staples',     price: 55,   quantity: 200, minStock: 50, barcode: '8901234567896', status: 'active', description: 'Premium white rice' },
    { name: 'Cooking Oil 1L',        category: 'Condiments',  price: 120,  quantity: 40,  minStock: 10, barcode: '8901234567897', status: 'active', description: 'Vegetable cooking oil' },
    { name: 'Eggs (per dozen)',      category: 'Dairy & Eggs',price: 130,  quantity: 25,  minStock: 5,  barcode: '8901234567898', status: 'active', description: 'Fresh large eggs' },
    { name: 'Shampoo Sachet',        category: 'Personal Care',price: 8,   quantity: 300, minStock: 50, barcode: '8901234567899', status: 'active', description: 'Single-use shampoo sachet' },
  ];

  for (const p of samples) {
    const id = 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    await dbWrite(`admin/products/${id}`, {
      ...p, id,
      createdAt: new Date().toISOString(),
      createdBy: 'system'
    });
  }
  console.log(`  ✓ ${samples.length} sample products seeded`);
}

console.log('✓ init-database.js loaded');
