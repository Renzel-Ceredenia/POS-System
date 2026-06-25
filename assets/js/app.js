// ============================================================
// POS Professional – App Initialization (all protected pages)
// ============================================================

// Global app state
const POSApp = {
  user: null,
  settings: null,
  currency: '₱'
};

// ── Bootstrap ─────────────────────────────────────────────────

async function bootstrapApp(options = {}) {
  const { requireRoles = null, pageId = null, onReady = null } = options;

  // Show loading state
  showAuthLoading();

  // Wait for Firebase auth to initialize
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (fbUser) => {
      try {
        // Firebase auth determined - check if logged in
        if (!fbUser) {
          // Not logged in - redirect to login page
          hideAuthLoading();
          window.location.href = '../pages/login.html';
          return;
        }

        // User is logged in via Firebase - verify database record
        const userData = await getUserFromDatabase(fbUser.uid);
        
        if (!userData || userData.status === 'disabled') {
          // No valid database record - sign out and redirect
          await auth.signOut();
          authManager._clearSession();
          hideAuthLoading();
          window.location.href = '../pages/login.html';
          return;
        }

        // Valid user - construct full user object
        const user = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: userData.fullName || userData.displayName || fbUser.email,
          role: userData.role || 'cashier',
          firstLogin: userData.firstLogin || false,
          ...userData
        };

        // Role check
        if (requireRoles && !requireRoles.includes(user.role)) {
          hideAuthLoading();
          POSToast.error('Access denied. You do not have permission to view this page.');
          setTimeout(() => window.location.href = 'dashboard.html', 1500);
          return;
        }

        // Set global state
        POSApp.user = user;
        authManager.currentUser = user;
        authManager.userRole = user.role;
        authManager.isAuthenticated = true;
        sessionStorage.setItem('posUser', JSON.stringify(user));

        // Load settings
        try {
          POSApp.settings = await getSettings() || {};
          POSApp.currency = POSApp.settings.currency || '₱';
        } catch (e) {
          POSApp.settings = {};
        }

        // Render UI
        renderSidebarUser();
        authManager.updateUIForRole();
        if (pageId) setActiveNav(pageId);
        startClock('topbar-time');
        initSidebar();
        initDarkMode();

        // Hide loading
        hideAuthLoading();

        // First-login modal
        if (POSApp.user.firstLogin) {
          showFirstLoginModal();
        }

        // Call page-specific ready callback
        if (typeof onReady === 'function') {
          await onReady(POSApp.user);
        }

        resolve();
      } catch (err) {
        console.error('Bootstrap error:', err);
        hideAuthLoading();
        window.location.href = '../pages/login.html';
      }
    });
  });
}

// ── Auth Loading Screen ───────────────────────────────────────

function showAuthLoading() {
  if (document.getElementById('auth-loading-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'auth-loading-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--clr-bg-page, #ffffff);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
  `;
  overlay.innerHTML = `
    <div style="text-align: center;">
      <div class="spinner" style="
        width: 48px;
        height: 48px;
        border: 4px solid var(--clr-border, #e0e0e0);
        border-top-color: var(--clr-primary, #2563eb);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 16px;
      "></div>
      <div style="color: var(--clr-text-muted, #6b7280); font-size: 14px;">
        Authenticating...
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideAuthLoading() {
  const overlay = document.getElementById('auth-loading-overlay');
  if (overlay) overlay.remove();
}

// ── Render Sidebar User ───────────────────────────────────────

function renderSidebarUser() {
  const user = POSApp.user;
  if (!user) return;
  const name = user.fullName || user.displayName || user.email;
  const n = document.getElementById('sidebar-user-name');
  const r = document.getElementById('sidebar-user-role');
  const i = document.getElementById('sidebar-user-initials');
  if (n) n.textContent = name;
  if (r) r.textContent = (user.role || '').toUpperCase();
  if (i) i.textContent = (name || 'U').charAt(0).toUpperCase();
}

// ── Logout ────────────────────────────────────────────────────

async function handleLogout() {
  const ok = await POSConfirm('Are you sure you want to log out?', 'Log Out');
  if (!ok) return;
  await authManager.logout();
  window.location.href = '../pages/login.html';
}

// ── First Login Modal ─────────────────────────────────────────

function showFirstLoginModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'first-login-modal';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <span class="modal-title">🔑 Change Your Password</span>
      </div>
      <div class="modal-body">
        <p style="color:var(--clr-text-muted);margin-bottom:var(--gap-md);font-size:.9rem;">
          This is your first login. You must set a new password before continuing.
        </p>
        <div class="form-group" style="margin-bottom:var(--gap-md);">
          <label class="form-label">New Password</label>
          <input class="form-control" type="password" id="fl-new-pw" placeholder="Minimum 8 characters" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label class="form-label">Confirm Password</label>
          <input class="form-control" type="password" id="fl-confirm-pw" placeholder="Repeat new password" autocomplete="new-password">
        </div>
        <div id="fl-msg" style="font-size:.85rem;color:var(--clr-danger);margin-top:var(--gap-sm);"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="fl-save-btn">Set Password &amp; Continue</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  document.getElementById('fl-save-btn').addEventListener('click', async () => {
    const pw  = document.getElementById('fl-new-pw').value;
    const cpw = document.getElementById('fl-confirm-pw').value;
    const msg = document.getElementById('fl-msg');
    if (!pw || pw.length < 8) { msg.textContent = 'Password must be at least 8 characters.'; return; }
    if (pw !== cpw) { msg.textContent = 'Passwords do not match.'; return; }
    try {
      await authManager.changePassword(pw);
      overlay.remove();
      document.body.style.overflow = '';
      POSToast.success('Password updated successfully!');
    } catch (err) {
      msg.textContent = err.message || 'Failed to update password.';
    }
  });
}

// ── FC Currency ───────────────────────────────────────────────

function fc(amount) {
  return formatCurrency(amount, POSApp.currency || '₱');
}

console.log('✓ app.js loaded');
