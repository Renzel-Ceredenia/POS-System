// ============================================================
// POS Professional – Profile Page Logic
// ============================================================

let profileProducts = {};

document.addEventListener('DOMContentLoaded', () => {
  bootstrapApp({
    pageId: 'nav-profile',
    onReady: initProfilePage
  });
});

async function initProfilePage(user) {
  renderProfileInfo(user);
  setupRoleVisibility(user);
  await loadProductsPanel();
  await loadInventoryEditor();

  // Check hash nav
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const nav = document.querySelector(`.profile-nav-item[data-panel="${hash}"]`);
    if (nav) nav.click();
  }

  // Password strength meter
  document.getElementById('pw-new').addEventListener('input', function() {
    const bar = document.getElementById('pw-strength-bar');
    const len = this.value.length;
    let width = 0, cls = '';
    if (len >= 8) { width = 40; cls = 'pw-weak'; }
    if (len >= 10 && /[A-Z]/.test(this.value) && /[0-9]/.test(this.value)) { width = 70; cls = 'pw-medium'; }
    if (len >= 12 && /[A-Z]/.test(this.value) && /[0-9]/.test(this.value) && /[^A-Za-z0-9]/.test(this.value)) { width = 100; cls = 'pw-strong'; }
    bar.style.width = width + '%';
    bar.className = 'password-strength-bar ' + cls;
  });
}

// ── Render Profile Info ───────────────────────────────────────

function renderProfileInfo(user) {
  const name = user.fullName || user.displayName || user.email;
  document.getElementById('profile-avatar-initials').textContent = (name || 'U').charAt(0).toUpperCase();
  document.getElementById('profile-display-name').textContent = name;
  document.getElementById('profile-display-email').textContent = user.email || '—';
  document.getElementById('profile-display-role').textContent  = (user.role || '—').toUpperCase();
  document.getElementById('info-fullname').value  = name;
  document.getElementById('info-email').value     = user.email || '—';
  document.getElementById('info-role').value      = { admin:'Administrator', manager:'Manager', cashier:'Cashier' }[user.role] || user.role;
  document.getElementById('info-status').value    = user.status || 'active';
  document.getElementById('info-created').value   = user.createdAt ? formatDate(user.createdAt) : '—';
}

// ── Role Visibility ───────────────────────────────────────────

function setupRoleVisibility(user) {
  const canManageProducts = user.role === 'admin' || user.role === 'manager';
  if (!canManageProducts) {
    document.getElementById('nav-products-tab')?.classList.add('hidden');
    document.getElementById('nav-inventory-tab')?.classList.add('hidden');
  }
}

// ── Panel Switching ───────────────────────────────────────────

function switchProfilePanel(navItem, panelId) {
  document.querySelectorAll('.profile-nav-item').forEach(n => { n.classList.remove('active'); n.removeAttribute('aria-selected'); });
  document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('active'));
  navItem.classList.add('active');
  navItem.setAttribute('aria-selected', 'true');
  document.getElementById(panelId)?.classList.add('active');
}

// ── Password Change ───────────────────────────────────────────

async function changePassword() {
  const pw  = document.getElementById('pw-new').value;
  const cpw = document.getElementById('pw-confirm').value;
  if (!pw || pw.length < 8) { POSToast.error('Password must be at least 8 characters.'); return; }
  if (pw !== cpw) { POSToast.error('Passwords do not match.'); return; }
  const btn = document.getElementById('pw-save-btn');
  setLoading(btn, true, 'Saving...');
  try {
    await authManager.changePassword(pw);
    document.getElementById('pw-new').value = '';
    document.getElementById('pw-confirm').value = '';
    document.getElementById('pw-strength-bar').style.width = '0%';
    POSToast.success('Password updated successfully!');
    await logActivity(POSApp.user.uid, 'CHANGE_PASSWORD', 'Password changed').catch(()=>{});
  } catch (err) {
    POSToast.error('Failed to update password: ' + err.message);
  } finally {
    setLoading(btn, false);
  }
}

// ── Products Panel ────────────────────────────────────────────

async function loadProductsPanel() {
  if (POSApp.user.role === 'cashier') return;
  try {
    const data = await getAllProducts() || {};
    profileProducts = data;
    const cats = [...new Set(Object.values(data).filter(p=>!p.initialized&&p.category).map(p=>p.category))];
    const dl = document.getElementById('category-list');
    if (dl) dl.innerHTML = cats.map(c=>`<option value="${c}">`).join('');
    renderProductTable(Object.values(data).filter(p=>!p.initialized));
  } catch (err) {
    console.error('Products load error:', err);
  }
}

function renderProductTable(list) {
  const tbody = document.getElementById('products-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:var(--gap-lg);">No products found.</td></tr>`;
    return;
  }
  const isAdmin = POSApp.user.role === 'admin';
  tbody.innerHTML = list.map(p => {
    const qty = p.quantity || 0;
    const status = qty === 0 ? 'badge-danger' : qty <= (p.minStock||5) ? 'badge-warning' : 'badge-success';
    const statusText = qty === 0 ? 'Out of Stock' : qty <= (p.minStock||5) ? 'Low Stock' : 'In Stock';
    return `<tr>
      <td>${p.name}</td>
      <td>${p.category||'—'}</td>
      <td>${fc(p.price)}</td>
      <td>${p.quantity}</td>
      <td><span class="badge ${status}">${statusText}</span></td>
      <td class="product-actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditProduct('${p.id}')" aria-label="Edit ${p.name}">Edit</button>
        ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="removeProduct('${p.id}','${p.name.replace(/'/g,"\\'")}')">Delete</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function filterProductTable(q) {
  const list = Object.values(profileProducts).filter(p=>!p.initialized&&p.name.toLowerCase().includes(q.toLowerCase()));
  renderProductTable(list);
}

async function addProduct() {
  const name  = document.getElementById('p-name').value.trim();
  const cat   = document.getElementById('p-category').value.trim();
  const price = parseFloat(document.getElementById('p-price').value);
  const qty   = parseInt(document.getElementById('p-qty').value) || 0;
  const min   = parseInt(document.getElementById('p-minstk').value) || 5;
  const bar   = document.getElementById('p-barcode').value.trim();
  const desc  = document.getElementById('p-desc').value.trim();

  if (!name || isNaN(price) || price < 0) { POSToast.error('Please enter a valid name and price.'); return; }

  const btn = document.getElementById('add-product-btn');
  setLoading(btn, true, 'Saving...');

  try {
    const productData = { name, category: cat, price, quantity: qty, minStock: min, barcode: bar, description: desc, status: 'active', createdBy: POSApp.user.uid };
    const id = await createProduct(productData);
    await logActivity(POSApp.user.uid, 'CREATE_PRODUCT', `Product added: ${name}`).catch(()=>{});
    POSToast.success(`"${name}" added successfully!`);
    // Clear form
    ['p-name','p-category','p-price','p-qty','p-barcode','p-desc'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
    document.getElementById('p-minstk').value = '5';
    await loadProductsPanel();
  } catch (err) {
    POSToast.error('Failed to add product: ' + err.message);
  } finally {
    setLoading(btn, false);
  }
}

function openEditProduct(id) {
  const p = profileProducts[id];
  if (!p) return;
  document.getElementById('edit-p-id').value       = id;
  document.getElementById('edit-p-name').value     = p.name;
  document.getElementById('edit-p-category').value = p.category || '';
  document.getElementById('edit-p-price').value    = p.price;
  document.getElementById('edit-p-qty').value      = p.quantity;
  document.getElementById('edit-p-minstk').value   = p.minStock || 5;
  document.getElementById('edit-p-barcode').value  = p.barcode || '';
  document.getElementById('edit-p-desc').value     = p.description || '';
  document.getElementById('edit-p-status').value   = p.status || 'active';
  POSModal.open('edit-product-modal');
}

async function saveEditProduct() {
  const id    = document.getElementById('edit-p-id').value;
  const name  = document.getElementById('edit-p-name').value.trim();
  const price = parseFloat(document.getElementById('edit-p-price').value);
  const qty   = parseInt(document.getElementById('edit-p-qty').value);
  if (!name || isNaN(price) || isNaN(qty)) { POSToast.error('Please fill all required fields.'); return; }
  try {
    await updateProduct(id, {
      name,
      category:    document.getElementById('edit-p-category').value.trim(),
      price, quantity: qty,
      minStock:    parseInt(document.getElementById('edit-p-minstk').value)||5,
      barcode:     document.getElementById('edit-p-barcode').value.trim(),
      description: document.getElementById('edit-p-desc').value.trim(),
      status:      document.getElementById('edit-p-status').value,
      updatedBy:   POSApp.user.uid
    });
    await logActivity(POSApp.user.uid, 'UPDATE_PRODUCT', `Product updated: ${name}`).catch(()=>{});
    POSModal.close('edit-product-modal');
    POSToast.success('Product updated!');
    await loadProductsPanel();
    await loadInventoryEditor();
  } catch (err) {
    POSToast.error('Update failed: ' + err.message);
  }
}

async function removeProduct(id, name) {
  const ok = await POSConfirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`, 'Delete Product', true);
  if (!ok) return;
  try {
    await deleteProduct(id);
    await logActivity(POSApp.user.uid, 'DELETE_PRODUCT', `Product deleted: ${name}`).catch(()=>{});
    POSToast.success(`"${name}" deleted.`);
    await loadProductsPanel();
    await loadInventoryEditor();
  } catch (err) {
    POSToast.error('Delete failed: ' + err.message);
  }
}

// ── Inventory Editor ──────────────────────────────────────────

let inventoryList = [];

async function loadInventoryEditor() {
  if (POSApp.user.role === 'cashier') return;
  try {
    const data = await getAllProducts() || {};
    inventoryList = Object.values(data).filter(p => !p.initialized && p.status !== 'inactive');
    renderInventoryList(inventoryList);
  } catch (err) {
    console.error('Inventory editor load error:', err);
  }
}

function filterInventoryList(q) {
  const filtered = inventoryList.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  renderInventoryList(filtered);
}

function renderInventoryList(list) {
  const container = document.getElementById('inventory-editor-list');
  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-text">No products found.</div></div>`;
    return;
  }
  container.innerHTML = `
    <div class="table-wrapper">
      <table class="table" aria-label="Inventory editor">
        <thead><tr><th>Product</th><th>Category</th><th>Current Qty</th><th>Min Stock</th><th>Status</th><th>Adjust</th></tr></thead>
        <tbody>
          ${list.map(p => {
            const cls = p.quantity === 0 ? 'badge-danger' : p.quantity <= (p.minStock||5) ? 'badge-warning' : 'badge-success';
            const statusText = p.quantity === 0 ? 'Out' : p.quantity <= (p.minStock||5) ? 'Low' : 'OK';
            return `<tr>
              <td style="font-weight:600;">${p.name}</td>
              <td>${p.category||'—'}</td>
              <td style="font-weight:700;font-size:1.1rem;">${p.quantity}</td>
              <td>${p.minStock||5}</td>
              <td><span class="badge ${cls}">${statusText}</span></td>
              <td>
                <div style="display:flex;align-items:center;gap:4px;">
                  <button class="qty-btn" onclick="adjustInventory('${p.id}',-1)" aria-label="Decrease quantity of ${p.name}">−</button>
                  <input type="number" class="qty-input" id="inv-qty-${p.id}" value="${p.quantity}" min="0" style="width:60px;" aria-label="Quantity of ${p.name}">
                  <button class="qty-btn" onclick="adjustInventory('${p.id}',1)" aria-label="Increase quantity of ${p.name}">+</button>
                  <button class="btn btn-primary btn-sm" onclick="saveInventoryQty('${p.id}')" aria-label="Save quantity for ${p.name}">Save</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

async function adjustInventory(productId, delta) {
  const input = document.getElementById(`inv-qty-${productId}`);
  if (!input) return;
  const newVal = Math.max(0, parseInt(input.value || 0) + delta);
  input.value = newVal;
}

async function saveInventoryQty(productId) {
  const input = document.getElementById(`inv-qty-${productId}`);
  if (!input) return;
  const qty = parseInt(input.value);
  if (isNaN(qty) || qty < 0) { POSToast.error('Invalid quantity.'); return; }
  try {
    await updateInventory(productId, qty);
    const p = inventoryList.find(x => x.id === productId);
    if (p) p.quantity = qty;
    await logActivity(POSApp.user.uid, 'UPDATE_INVENTORY', `Inventory updated: ${p?.name} = ${qty}`).catch(()=>{});
    POSToast.success('Inventory updated!');
    renderInventoryList(inventoryList);
  } catch (err) {
    POSToast.error('Save failed: ' + err.message);
  }
}

// ── Helper ────────────────────────────────────────────────────
function setLoading(el, loading, text) {
  if (!el) return;
  if (loading) { el._orig = el.textContent; el.disabled = true; el.textContent = text||'Loading...'; }
  else { el.disabled = false; el.textContent = el._orig||'Save'; }
}
