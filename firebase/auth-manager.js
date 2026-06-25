// ============================================================
// Authentication Manager
// POS Professional - Production Ready
// ============================================================

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.userRole = null;
    this.isAuthenticated = false;
    this._listeners = [];
  }

  // ── Role Permissions ─────────────────────────────────────────

  _getPermissions() {
    return {
      admin: {
        dashboard: true, sales: true, analytics: true, profile: true,
        settings: true, users: true, employees: true,
        products: { create: true, read: true, update: true, delete: true },
        inventory: { read: true, update: true }
      },
      manager: {
        dashboard: true, sales: true, analytics: true, profile: true,
        settings: false, users: false, employees: false,
        products: { create: true, read: true, update: true, delete: false },
        inventory: { read: true, update: true }
      },
      cashier: {
        dashboard: false, sales: true, analytics: false, profile: true,
        settings: false, users: false, employees: false,
        products: { create: false, read: true, update: false, delete: false },
        inventory: { read: true, update: false }
      }
    };
  }

  hasPermission(feature, action = null) {
    if (!this.userRole) return false;
    const perms = this._getPermissions()[this.userRole];
    if (!perms) return false;
    const f = perms[feature];
    if (f === undefined) return false;
    if (f === true || f === false) return f;
    if (typeof f === 'object' && action) return f[action] === true;
    return false;
  }

  canDo(feature, action = null) { return this.hasPermission(feature, action); }
  isAdmin()   { return this.userRole === 'admin'; }
  isManager() { return this.userRole === 'manager'; }
  isCashier() { return this.userRole === 'cashier'; }
  canAccessAnalytics() { return this.hasPermission('analytics'); }
  canAccessSettings()  { return this.hasPermission('settings'); }
  canProcessSales()    { return this.hasPermission('sales'); }
  canManageUsers()     { return this.hasPermission('users'); }
  canManageProducts(action = 'read') { return this.hasPermission('products', action); }

  // ── Auth Listener ─────────────────────────────────────────────

  setupAuthListener() {
    auth.onAuthStateChanged(async (firebaseUser) => {
      console.log('AUTH READY');
      console.log('Firebase User:', firebaseUser);
      
      if (firebaseUser) {
        try {
          const userData = await getUserFromDatabase(firebaseUser.uid);
          console.log('Database User:', userData);
          
          if (userData && userData.status !== 'disabled') {
            this.currentUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: userData.fullName || userData.displayName || firebaseUser.email,
              role: userData.role || 'cashier',
              firstLogin: userData.firstLogin || false,
              ...userData
            };
            this.userRole = this.currentUser.role;
            this.isAuthenticated = true;

            // Store session
            sessionStorage.setItem('posUser', JSON.stringify(this.currentUser));
            console.log('Session Restored');

            this._emit('login', this.currentUser);
          } else {
            await auth.signOut();
            this._clearSession();
            this._emit('logout', null);
          }
        } catch (err) {
          console.error('Auth state error:', err);
          this._clearSession();
          this._emit('error', err);
        }
      } else {
        this._clearSession();
        this._emit('logout', null);
      }
    });
  }

  // ── Login / Logout ────────────────────────────────────────────

  async login(email, password) {
    try {
      const result = await auth.signInWithEmailAndPassword(email, password);
      const userData = await getUserFromDatabase(result.user.uid);

      if (!userData) throw new Error('User record not found. Contact administrator.');
      if (userData.status === 'disabled') throw new Error('Your account has been disabled. Contact administrator.');

      // Check first login
      if (userData.firstLogin) {
        return { success: true, firstLogin: true, uid: result.user.uid };
      }

      await logActivity(result.user.uid, 'LOGIN', `Login: ${email}`).catch(() => {});
      return { success: true, firstLogin: false };
    } catch (err) {
      let msg = err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please wait and try again.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network error. Check your connection.';
      }
      return { success: false, error: msg };
    }
  }

  async logout() {
    try {
      if (this.currentUser) {
        await logActivity(this.currentUser.uid, 'LOGOUT', `Logout: ${this.currentUser.email}`).catch(() => {});
      }
      await auth.signOut();
      this._clearSession();
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  // ── Password Change ───────────────────────────────────────────

  async changePassword(newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    await user.updatePassword(newPassword);

    // Clear first-login flag
    if (this.currentUser) {
      await updateUserRecord(this.currentUser.uid, { firstLogin: false }).catch(() => {});
      this.currentUser.firstLogin = false;
      sessionStorage.setItem('posUser', JSON.stringify(this.currentUser));
    }
    return true;
  }

  async resetPasswordForUser(email) {
    await auth.sendPasswordResetEmail(email);
    return true;
  }

  // ── Session ───────────────────────────────────────────────────

  loadSession() {
    try {
      const raw = sessionStorage.getItem('posUser');
      if (raw) {
        const user = JSON.parse(raw);
        this.currentUser = user;
        this.userRole = user.role;
        this.isAuthenticated = true;
        return user;
      }
    } catch (_) {}
    return null;
  }

  _clearSession() {
    this.currentUser = null;
    this.userRole = null;
    this.isAuthenticated = false;
    sessionStorage.removeItem('posUser');
  }

  // ── UI Updates ────────────────────────────────────────────────

  updateUIForRole() {
    if (!this.currentUser) return;

    const map = {
      'nav-analytics': this.canAccessAnalytics(),
      'nav-settings':  this.canAccessSettings(),
      'nav-users':     this.canManageUsers(),
      'nav-employees': this.isAdmin(),
    };

    Object.entries(map).forEach(([id, show]) => {
      const el = document.getElementById(id);
      if (el) el.style.display = show ? '' : 'none';
    });

    // User display
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const initEl = document.getElementById('sidebar-user-initials');

    if (nameEl) nameEl.textContent = this.currentUser.displayName || this.currentUser.email;
    if (roleEl) roleEl.textContent = (this.userRole || '').toUpperCase();
    if (initEl) {
      const n = this.currentUser.displayName || this.currentUser.email || 'U';
      initEl.textContent = n.charAt(0).toUpperCase();
    }
  }

  // ── Events ────────────────────────────────────────────────────

  on(event, cb) { this._listeners.push({ event, cb }); }
  _emit(event, data) {
    this._listeners.filter(l => l.event === event).forEach(l => l.cb(data));
    document.dispatchEvent(new CustomEvent('auth:' + event, { detail: data }));
  }
}

const authManager = new AuthManager();

// Initialize auth listener globally (run exactly once)
authManager.setupAuthListener();

// Auth guard helper used by all pages
function requireAuth(redirectTo = '../pages/login.html') {
  const user = authManager.loadSession();
  if (!user || !user.uid) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

function requireRole(roles, redirectTo = '../pages/dashboard.html') {
  const user = authManager.currentUser;
  if (!user || !roles.includes(user.role)) {
    POSToast.error('Access denied. You do not have permission to view this page.');
    setTimeout(() => window.location.href = redirectTo, 1500);
    return false;
  }
  return true;
}

console.log('✓ auth-manager.js loaded');
