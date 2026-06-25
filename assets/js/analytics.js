// ============================================================
// POS Professional – Analytics Page Logic
// ============================================================

let allTxns = [];
let allProductsMap = {};

document.addEventListener('DOMContentLoaded', () => {
  bootstrapApp({
    requireRoles: ['admin', 'manager'],
    pageId: 'nav-analytics',
    onReady: initAnalytics
  });
});

async function initAnalytics() {
  await loadAllData();

  // Set default dates
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('daily-date').value = today;
  document.getElementById('weekly-date').value = today;
  const [yr, mo] = today.split('-');
  document.getElementById('monthly-date').value = `${yr}-${mo}`;
  document.getElementById('yearly-date').value = yr;

  await Promise.all([
    loadOverallKPIs(),
    updateDailyTab(),
    loadInventoryAnalytics(),
    loadAllTransactionsTable()
  ]);
}

async function loadAllData() {
  try {
    const [txnData, prodData] = await Promise.all([getAllSalesTransactions(), getAllProducts()]);
    allTxns = Object.values(txnData || {}).filter(t => !t.initialized);
    allProductsMap = prodData || {};
  } catch (err) {
    console.error('Analytics data load error:', err);
    POSToast.error('Could not load analytics data.');
  }
}

// ── Tab Switching ─────────────────────────────────────────────

function switchTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active'); btn.setAttribute('aria-selected','true');
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'daily')   updateDailyTab();
  if (tab === 'weekly')  updateWeeklyTab();
  if (tab === 'monthly') updateMonthlyTab();
  if (tab === 'yearly')  updateYearlyTab();
}

// ── Overall KPIs ──────────────────────────────────────────────

function loadOverallKPIs() {
  const m = calcMetrics(allTxns);
  document.getElementById('an-total-rev').textContent  = fc(m.totalRev);
  document.getElementById('an-total-txns').textContent = m.count;
  document.getElementById('an-items-sold').textContent = m.itemsSold;
  document.getElementById('an-avg-txn').textContent    = fc(m.avgTxn);
}

// ── Daily ─────────────────────────────────────────────────────

function updateDailyTab() {
  const dateVal = document.getElementById('daily-date').value;
  if (!dateVal) return;
  const d = new Date(dateVal); d.setHours(0,0,0,0);
  const txns = allTxns.filter(t => {
    const td = new Date(t.timestamp); td.setHours(0,0,0,0);
    return td.getTime() === d.getTime();
  });
  renderSummary('daily-summary', txns);
  renderTopProducts('daily-top-products', txns, 5);
  renderHourlyChart('daily-chart', txns);
}

function renderHourlyChart(elId, txns) {
  const hours = Array(24).fill(0);
  txns.forEach(t => { const h = new Date(t.timestamp).getHours(); hours[h] += t.total || 0; });
  const max = Math.max(...hours, 1);
  const el = document.getElementById(elId);
  el.innerHTML = hours.map((v, h) => `
    <div class="bar-col">
      <div class="bar-fill" style="height:${(v/max*100)||2}%" title="${h}:00 – ${fc(v)}"></div>
      <div class="bar-label">${h % 3 === 0 ? h + 'h' : ''}</div>
    </div>`).join('');
}

// ── Weekly ────────────────────────────────────────────────────

function updateWeeklyTab() {
  const dateVal = document.getElementById('weekly-date').value;
  if (!dateVal) return;
  const base = new Date(dateVal);
  const day  = base.getDay();
  const weekStart = new Date(base); weekStart.setDate(base.getDate() - day); weekStart.setHours(0,0,0,0);
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23,59,59,999);
  const txns = allTxns.filter(t => { const d = new Date(t.timestamp); return d >= weekStart && d <= weekEnd; });
  renderSummary('weekly-summary', txns);
  renderWeeklyChart('weekly-chart', txns, weekStart);
}

function renderWeeklyChart(elId, txns, weekStart) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const totals = Array(7).fill(0);
  txns.forEach(t => { const d = new Date(t.timestamp); totals[d.getDay()] += t.total || 0; });
  const max = Math.max(...totals, 1);
  const el = document.getElementById(elId);
  el.innerHTML = totals.map((v, i) => `
    <div class="bar-col">
      <div class="bar-fill" style="height:${(v/max*100)||2}%" title="${days[i]}: ${fc(v)}"></div>
      <div class="bar-label">${days[i]}</div>
    </div>`).join('');
}

// ── Monthly ───────────────────────────────────────────────────

function updateMonthlyTab() {
  const val = document.getElementById('monthly-date').value;
  if (!val) return;
  const [yr, mo] = val.split('-').map(Number);
  const start = new Date(yr, mo-1, 1); start.setHours(0,0,0,0);
  const end   = new Date(yr, mo, 0);   end.setHours(23,59,59,999);
  const txns  = allTxns.filter(t => { const d = new Date(t.timestamp); return d >= start && d <= end; });
  renderSummary('monthly-summary', txns);
  renderTopProducts('monthly-top', txns, 8);
}

// ── Yearly ────────────────────────────────────────────────────

function updateYearlyTab() {
  const yr = parseInt(document.getElementById('yearly-date').value);
  if (!yr) return;
  const start = new Date(yr,  0, 1); start.setHours(0,0,0,0);
  const end   = new Date(yr, 11, 31); end.setHours(23,59,59,999);
  const txns  = allTxns.filter(t => { const d = new Date(t.timestamp); return d >= start && d <= end; });
  renderSummary('yearly-summary', txns);
  renderYearlyChart('yearly-chart', txns);
}

function renderYearlyChart(elId, txns) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const totals = Array(12).fill(0);
  txns.forEach(t => { totals[new Date(t.timestamp).getMonth()] += t.total || 0; });
  const max = Math.max(...totals, 1);
  document.getElementById(elId).innerHTML = totals.map((v, i) => `
    <div class="bar-col">
      <div class="bar-fill" style="height:${(v/max*100)||2}%" title="${months[i]}: ${fc(v)}"></div>
      <div class="bar-label">${months[i]}</div>
    </div>`).join('');
}

// ── Helpers ───────────────────────────────────────────────────

function calcMetrics(txns) {
  const totalRev = txns.reduce((s,t)=>s+(t.total||0), 0);
  const itemsSold = txns.reduce((s,t)=>s+(t.items||[]).reduce((ss,i)=>ss+(i.qty||0),0), 0);
  return { count: txns.length, totalRev, itemsSold, avgTxn: txns.length ? totalRev/txns.length : 0 };
}

function renderSummary(elId, txns) {
  const m = calcMetrics(txns);
  document.getElementById(elId).innerHTML = [
    ['Total Revenue', fc(m.totalRev)],
    ['Transactions', m.count],
    ['Items Sold', m.itemsSold],
    ['Avg. Sale', fc(m.avgTxn)]
  ].map(([l,v])=>`<div class="summary-item"><span class="summary-item-label">${l}</span><span class="summary-item-val">${v}</span></div>`).join('');
}

function renderTopProducts(elId, txns, limit = 5) {
  const map = {};
  txns.forEach(t => (t.items||[]).forEach(i => {
    if (!map[i.id]) map[i.id] = { id: i.id, name: i.name, qty: 0, rev: 0 };
    map[i.id].qty += i.qty || 0;
    map[i.id].rev += (i.price||0) * (i.qty||0);
  }));
  const list = Object.values(map).sort((a,b)=>b.qty-a.qty).slice(0,limit);
  const maxQty = list[0]?.qty || 1;
  const el = document.getElementById(elId);
  if (!list.length) { el.innerHTML = `<div class="empty-state"><div class="empty-state-text">No sales data for this period.</div></div>`; return; }
  el.innerHTML = list.map((p, i) => `
    <div class="top-product-item">
      <div class="top-product-rank">${i+1}</div>
      <div class="top-product-name">${p.name}</div>
      <div class="top-product-bar"><div class="top-product-bar-fill" style="width:${(p.qty/maxQty*100)}%"></div></div>
      <div class="top-product-stats"><div class="top-product-qty">${p.qty} sold</div><div class="top-product-rev">${fc(p.rev)}</div></div>
    </div>`).join('');
}

// ── Inventory ─────────────────────────────────────────────────

async function loadInventoryAnalytics() {
  try {
    const products = Object.values(await getAllProducts()||{}).filter(p=>!p.initialized);
    const low  = products.filter(p=>p.quantity>0&&p.quantity<=(p.minStock||5));
    const out  = products.filter(p=>p.quantity===0);
    const val  = products.reduce((s,p)=>s+(p.price||0)*(p.quantity||0),0);
    document.getElementById('inv-total').textContent = products.length;
    document.getElementById('inv-low').textContent   = low.length;
    document.getElementById('inv-out').textContent   = out.length;
    document.getElementById('inv-value-display').textContent = fc(val);
  } catch (err) { console.error('Inventory analytics error:', err); }
}

// ── All Transactions Table ────────────────────────────────────

function loadAllTransactionsTable() {
  const tbody = document.getElementById('all-txn-tbody');
  if (!allTxns.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:var(--gap-lg);">No transactions found.</td></tr>`;
    return;
  }
  const sorted = [...allTxns].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
  tbody.innerHTML = sorted.map(t=>`
    <tr>
      <td>${formatDateTime(t.timestamp)}</td>
      <td>${(t.items||[]).length} items</td>
      <td>${fc(t.subtotal)}</td>
      <td>${fc(t.discount)}</td>
      <td style="font-weight:700;">${fc(t.total)}</td>
      <td>${t.paymentMethod||'—'}</td>
      <td>${t.cashierName||t.userId||'—'}</td>
    </tr>`).join('');
}

// ── Export ────────────────────────────────────────────────────

function exportTransactionsCSV() {
  if (!allTxns.length) { POSToast.warning('No transactions to export.'); return; }
  const rows = [['Date/Time','Items','Subtotal','Discount','Total','Payment','Cashier']];
  allTxns.forEach(t=>{
    rows.push([formatDateTime(t.timestamp),(t.items||[]).length,t.subtotal||0,t.discount||0,t.total||0,t.paymentMethod||'',t.cashierName||t.userId||'']);
  });
  exportCSV(rows, `sales-${new Date().toISOString().split('T')[0]}.csv`);
  POSToast.success('CSV exported successfully!');
}
