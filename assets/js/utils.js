// ============================================================
// POS Professional – Global Utilities
// ============================================================

// ── Currency ─────────────────────────────────────────────────

function formatCurrency(amount, symbol = '₱') {
  const n = parseFloat(amount) || 0;
  return symbol + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Date / Time ───────────────────────────────────────────────

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(dateStr) {
  return formatDate(dateStr) + ' ' + formatTime(dateStr);
}

function getDateRange(period) {
  const now = new Date();
  const start = new Date();
  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    start.setDate(1); start.setHours(0, 0, 0, 0);
  } else if (period === 'year') {
    start.setMonth(0, 1); start.setHours(0, 0, 0, 0);
  }
  return { start, end: now };
}

// ── Toast ─────────────────────────────────────────────────────

const POSToast = (() => {
  let container;
  function getContainer() {
    if (!container) {
      container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
    }
    return container;
  }

  function show(message, type = '', duration = 3500) {
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    getContainer().appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    setTimeout(() => {
      toast.classList.remove('show'); toast.classList.add('hide');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  return {
    success: (m, d) => show(m, 'success', d),
    error:   (m, d) => show(m, 'error',   d || 5000),
    warning: (m, d) => show(m, 'warning', d),
    info:    (m, d) => show(m, 'info',    d),
    show
  };
})();

// ── Modal ─────────────────────────────────────────────────────

const POSModal = (() => {
  function open(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
  }
  function close(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
  }
  function closeAll() {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    document.body.style.overflow = '';
  }
  // Close on overlay click
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) closeAll();
  });
  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAll();
  });
  return { open, close, closeAll };
})();

// ── Confirm Dialog ────────────────────────────────────────────

function POSConfirm(message, title = 'Confirm Action', dangerMode = false) {
  return new Promise(resolve => {
    const id = 'confirm-dialog';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'modal-overlay' + (dangerMode ? ' confirm-danger' : '');
      el.innerHTML = `
        <div class="modal" style="max-width:420px">
          <div class="modal-header">
            <span class="modal-title" id="confirm-title"></span>
            <button class="modal-close" id="confirm-cancel-x">✕</button>
          </div>
          <div class="modal-body"><p id="confirm-message" style="color:var(--clr-text-muted);font-size:.9rem;"></p></div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
            <button class="btn ${dangerMode ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">Confirm</button>
          </div>
        </div>`;
      document.body.appendChild(el);
    }
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    if (dangerMode) el.classList.add('confirm-danger');
    else el.classList.remove('confirm-danger');
    el.classList.add('open');

    function done(result) {
      el.classList.remove('open');
      resolve(result);
    }
    document.getElementById('confirm-ok').onclick = () => done(true);
    document.getElementById('confirm-cancel').onclick = () => done(false);
    document.getElementById('confirm-cancel-x').onclick = () => done(false);
  });
}

// ── Loading ───────────────────────────────────────────────────

function setLoading(element, loading, text = '') {
  if (!element) return;
  if (loading) {
    element._origHTML = element.innerHTML;
    element.disabled = true;
    element.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px"></span>${text ? ' ' + text : ''}`;
  } else {
    element.disabled = false;
    element.innerHTML = element._origHTML || element.innerHTML;
  }
}

// ── Sidebar ───────────────────────────────────────────────────

function initSidebar() {
  const sidebar  = document.querySelector('.sidebar');
  const overlay  = document.querySelector('.sidebar-overlay');
  const toggle   = document.querySelector('.menu-toggle');

  if (!sidebar) return;

  toggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('open');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}

// ── Active Nav ────────────────────────────────────────────────

function setActiveNav(pageId) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const active = document.getElementById(pageId);
  if (active) active.classList.add('active');
}

// ── Clock ─────────────────────────────────────────────────────

function startClock(elementId = 'topbar-time') {
  function update() {
    const el = document.getElementById(elementId);
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  update();
  setInterval(update, 1000);
}

// ── Dark Mode ─────────────────────────────────────────────────

function initDarkMode() {
  const stored = localStorage.getItem('pos-theme');
  if (stored === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
      localStorage.setItem('pos-theme', isDark ? 'light' : 'dark');
    });
  }
}

// ── Form Helpers ──────────────────────────────────────────────

function getFormData(formId) {
  const form = document.getElementById(formId);
  if (!form) return {};
  const data = {};
  form.querySelectorAll('[name]').forEach(el => {
    data[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
  });
  return data;
}

function clearForm(formId) {
  const form = document.getElementById(formId);
  if (form) form.reset();
}

function setFieldError(fieldId, message) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.classList.add('error');
  let err = el.parentElement.querySelector('.form-error');
  if (!err) {
    err = document.createElement('span');
    err.className = 'form-error';
    el.parentElement.appendChild(err);
  }
  err.textContent = message;
}

function clearFieldErrors(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
  form.querySelectorAll('.form-error').forEach(el => el.remove());
}

// ── Truncate ──────────────────────────────────────────────────

function truncate(str, len = 40) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

// ── CSV Export ────────────────────────────────────────────────

function exportCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

console.log('✓ utils.js loaded');
