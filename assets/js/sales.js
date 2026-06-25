// ============================================================
// POS Professional – Sales / POS Page Logic
// Formula: Total = (Price × Quantity) − Discount  (NO TAX)
// ============================================================

let allProducts = {};
let cart = [];

document.addEventListener('DOMContentLoaded', () => {
  bootstrapApp({
    requireRoles: ['admin', 'manager', 'cashier'],
    pageId: 'nav-sales',
    onReady: initSalesPage
  });
});

async function initSalesPage() {
  await loadProducts();
  await loadRecentTransactions();
  bindSalesEvents();
}

// ── Load Products ─────────────────────────────────────────────

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  try {
    const data = await getAllProducts() || {};
    allProducts = data;
    const list = Object.values(data).filter(p => !p.initialized && p.status === 'active');

    // Build category filters
    const cats = [...new Set(list.map(p => p.category).filter(Boolean))];
    const filterBar = document.getElementById('category-filters');
    filterBar.innerHTML = `<button class="filter-btn active" data-cat="" onclick="filterByCategory(this, '')">All</button>`;
    cats.forEach(c => {
      filterBar.insertAdjacentHTML('beforeend', `<button class="filter-btn" data-cat="${c}" onclick="filterByCategory(this, '${c}')">${c}</button>`);
    });

    renderProducts(list);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-text">Failed to load products.</div></div>`;
    console.error('Products load error:', err);
  }
}

function renderProducts(list) {
  const grid = document.getElementById('products-grid');
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon" aria-hidden="true">📦</div><div class="empty-state-title">No products available</div></div>`;
    return;
  }
  grid.innerHTML = list.map(p => {
    const oos = p.quantity <= 0;
    const low = p.quantity > 0 && p.quantity <= (p.minStock || 5);
    return `
    <div class="product-card ${oos ? 'out-of-stock' : ''}" onclick="${oos ? '' : `addToCart('${p.id}')`}"
         role="button" tabindex="${oos ? -1 : 0}" aria-label="${p.name}, ${fc(p.price)}"
         onkeypress="if(event.key==='Enter'&&!${oos})addToCart('${p.id}')">
      <div class="product-card-img" aria-hidden="true">${p.image || '📦'}</div>
      <div class="product-card-name">${p.name}</div>
      <div class="product-card-category">${p.category || 'General'}</div>
      <div class="product-card-price">${fc(p.price)}</div>
      <div class="product-card-stock ${low ? 'low' : oos ? 'out' : ''}">
        ${oos ? 'Out of stock' : low ? `Low: ${p.quantity} left` : `${p.quantity} in stock`}
      </div>
      ${!oos ? `<div class="add-overlay" aria-hidden="true">+ Add to Cart</div>` : ''}
    </div>`;
  }).join('');
}

// ── Filter ─────────────────────────────────────────────────────

function filterByCategory(btn, cat) {
  document.querySelectorAll('#category-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const search = document.getElementById('product-search').value.toLowerCase();
  const list = Object.values(allProducts).filter(p => {
    if (p.initialized) return false;
    if (p.status !== 'active') return false;
    if (cat && p.category !== cat) return false;
    if (search && !p.name.toLowerCase().includes(search) && !String(p.barcode || '').includes(search)) return false;
    return true;
  });
  renderProducts(list);
}

// ── Search ─────────────────────────────────────────────────────

function bindSalesEvents() {
  document.getElementById('product-search').addEventListener('input', function() {
    const search = this.value.toLowerCase();
    const activeCat = document.querySelector('#category-filters .filter-btn.active')?.dataset.cat || '';
    const list = Object.values(allProducts).filter(p => {
      if (p.initialized || p.status !== 'active') return false;
      if (activeCat && p.category !== activeCat) return false;
      return p.name.toLowerCase().includes(search) || String(p.barcode || '').includes(search);
    });
    renderProducts(list);
  });

  document.getElementById('discount-input').addEventListener('input', updateCartTotals);
  document.getElementById('amount-received').addEventListener('input', updateChange);
}

// ── Cart ──────────────────────────────────────────────────────

function addToCart(productId) {
  const product = allProducts[productId];
  if (!product || product.quantity <= 0) { POSToast.warning('Product is out of stock.'); return; }

  const existing = cart.find(i => i.id === productId);
  if (existing) {
    if (existing.qty >= product.quantity) { POSToast.warning('Not enough stock.'); return; }
    existing.qty++;
  } else {
    cart.push({ id: productId, name: product.name, price: product.price, qty: 1, maxQty: product.quantity, category: product.category });
  }
  renderCart();
  POSToast.info(`${product.name} added to cart`);
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  renderCart();
}

function changeQty(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty < 1) { removeFromCart(productId); return; }
  if (newQty > item.maxQty) { POSToast.warning('Not enough stock.'); return; }
  item.qty = newQty;
  renderCart();
}

function setQty(productId, val) {
  const qty = parseInt(val);
  const item = cart.find(i => i.id === productId);
  if (!item || isNaN(qty)) return;
  if (qty < 1) { removeFromCart(productId); return; }
  if (qty > item.maxQty) { POSToast.warning('Not enough stock.'); return; }
  item.qty = qty;
  updateCartTotals();
}

function clearCart() {
  if (!cart.length) return;
  POSConfirm('Are you sure you want to clear the cart?', 'Clear Cart').then(ok => {
    if (!ok) return;
    cart = [];
    renderCart();
    document.getElementById('discount-input').value = '0';
    document.getElementById('amount-received').value = '';
    updateChange();
  });
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const countEl   = document.getElementById('cart-count');
  const emptyEl   = document.getElementById('empty-cart');

  countEl.textContent = cart.reduce((s, i) => s + i.qty, 0);

  if (!cart.length) {
    container.innerHTML = `<div class="empty-state" id="empty-cart"><div class="empty-state-icon" aria-hidden="true">🛒</div><div class="empty-state-title">Cart is empty</div><div class="empty-state-text">Click a product to add it</div></div>`;
    updateCartTotals();
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item" role="listitem" aria-label="${item.name}">
      <div>
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${fc(item.price)} each</div>
        <div class="cart-item-subtotal">${fc(item.price * item.qty)}</div>
      </div>
      <div>
        <div class="cart-qty-controls">
          <button class="qty-btn" onclick="changeQty('${item.id}',-1)" aria-label="Decrease quantity">−</button>
          <input class="qty-input" type="number" value="${item.qty}" min="1" max="${item.maxQty}"
            onchange="setQty('${item.id}',this.value)" aria-label="Quantity of ${item.name}">
          <button class="qty-btn" onclick="changeQty('${item.id}',1)" aria-label="Increase quantity">+</button>
        </div>
        <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" aria-label="Remove ${item.name}">✕ Remove</button>
      </div>
    </div>`).join('');

  updateCartTotals();
}

function updateCartTotals() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = parseFloat(document.getElementById('discount-input')?.value) || 0;
  const total    = Math.max(0, subtotal - discount);

  document.getElementById('cart-subtotal').textContent = fc(subtotal);
  document.getElementById('cart-total').textContent    = fc(total);
  updateChange();
}

function updateChange() {
  const total    = cart.reduce((s,i)=>s+i.price*i.qty,0) - (parseFloat(document.getElementById('discount-input')?.value)||0);
  const received = parseFloat(document.getElementById('amount-received')?.value) || 0;
  const change   = Math.max(0, received - Math.max(0, total));
  document.getElementById('change-amount').textContent = fc(change);
}

// ── Checkout ──────────────────────────────────────────────────

async function completeSale() {
  if (!cart.length) { POSToast.warning('Cart is empty.'); return; }

  const subtotal  = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount  = parseFloat(document.getElementById('discount-input').value) || 0;
  const total     = Math.max(0, subtotal - discount);
  const received  = parseFloat(document.getElementById('amount-received').value) || 0;
  const method    = document.getElementById('payment-method').value;

  if (method === 'cash' && received < total) {
    POSToast.error('Amount received is less than total.');
    return;
  }

  const btn = document.getElementById('checkout-btn');
  setLoading(btn, true, 'Processing...');

  try {
    // Build transaction
    const txnData = {
      items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
      subtotal, discount, tax: 0, total,
      amountReceived: received,
      change: Math.max(0, received - total),
      paymentMethod: method,
      userId: POSApp.user.uid,
      cashierName: POSApp.user.fullName || POSApp.user.email,
      status: 'completed'
    };

    const txnId = await createSaleTransaction(txnData);

    // Deduct inventory
    for (const item of cart) {
      const product = allProducts[item.id];
      if (product) {
        const newQty = Math.max(0, product.quantity - item.qty);
        await updateInventory(item.id, newQty);
        allProducts[item.id].quantity = newQty;
      }
    }

    // Log
    await logActivity(POSApp.user.uid, 'COMPLETE_SALE', `Sale ${txnId}: ${fc(total)} (${method})`).catch(()=>{});

    // Show receipt
    showReceipt({ ...txnData, id: txnId });

    // Reset
    cart = [];
    renderCart();
    document.getElementById('discount-input').value = '0';
    document.getElementById('amount-received').value = '';
    updateChange();

    await loadRecentTransactions();
    POSToast.success('Sale completed successfully!');
  } catch (err) {
    console.error('Checkout error:', err);
    POSToast.error('Sale failed: ' + (err.message || 'Unknown error'));
  } finally {
    setLoading(btn, false);
  }
}

// ── Receipt ───────────────────────────────────────────────────

function showReceipt(txn) {
  const change = Math.max(0, (txn.amountReceived || 0) - txn.total);
  document.getElementById('receipt-content').innerHTML = `
    <div class="receipt">
      <div class="receipt-header">
        <h2>${POSApp.settings?.businessName || 'POS Professional'}</h2>
        <div style="font-size:.75rem;color:var(--clr-text-muted);">${POSApp.settings?.businessAddress || ''}</div>
        <div style="font-size:.75rem;margin-top:4px;">${formatDateTime(new Date().toISOString())}</div>
        <div style="font-size:.75rem;">Receipt #${txn.id}</div>
      </div>
      <div style="border-top:1px dashed var(--clr-border);margin:var(--gap-sm) 0;"></div>
      ${(txn.items||[]).map(i=>`
        <div class="receipt-line">
          <span>${i.name} × ${i.qty}</span>
          <span>${fc(i.price * i.qty)}</span>
        </div>`).join('')}
      <div style="border-top:1px dashed var(--clr-border);margin:var(--gap-sm) 0;"></div>
      <div class="receipt-line"><span>Subtotal</span><span>${fc(txn.subtotal)}</span></div>
      <div class="receipt-line"><span>Discount</span><span>-${fc(txn.discount)}</span></div>
      <div class="receipt-line total"><span>TOTAL</span><span>${fc(txn.total)}</span></div>
      <div class="receipt-line"><span>Paid (${txn.paymentMethod})</span><span>${fc(txn.amountReceived)}</span></div>
      <div class="receipt-line"><span>Change</span><span>${fc(change)}</span></div>
      <div class="receipt-footer">${POSApp.settings?.receiptFooter || 'Thank you for your purchase!'}</div>
    </div>`;
  POSModal.open('receipt-modal');
}

function printReceipt() {
  const content = document.getElementById('receipt-content').innerHTML;
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) { POSToast.error('Pop-up blocked. Allow pop-ups to print.'); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>Receipt</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:monospace;padding:20px;font-size:12px}
    .receipt{max-width:300px}.receipt-line{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #ccc}
    .receipt-line.total{font-weight:700;font-size:14px}.receipt-header{text-align:center;margin-bottom:12px}
    .receipt-footer{text-align:center;margin-top:12px;font-size:11px}</style>
    </head><body>${content}</body></html>`);
  w.document.close(); w.print();
}

// ── Recent Transactions ───────────────────────────────────────

async function loadRecentTransactions() {
  const tbody = document.getElementById('txn-tbody');
  try {
    const data = await getAllSalesTransactions() || {};
    const txns = Object.values(data)
      .filter(t => !t.initialized)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 15);

    if (!txns.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:var(--gap-lg);">No transactions yet</td></tr>`;
      return;
    }
    tbody.innerHTML = txns.map(t => `
      <tr>
        <td>${formatDateTime(t.timestamp)}</td>
        <td>${(t.items||[]).length} item${(t.items||[]).length !== 1 ? 's' : ''}</td>
        <td>${fc(t.subtotal)}</td>
        <td>${fc(t.discount)}</td>
        <td style="font-weight:700;">${fc(t.total)}</td>
        <td>${t.paymentMethod || 'cash'}</td>
        <td><span class="badge badge-success">Completed</span></td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Could not load transactions.</td></tr>`;
  }
}
