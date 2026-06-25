// ============================================================
// POS Professional – Settings Page Logic (Admin Only)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  bootstrapApp({
    requireRoles: ['admin'],
    pageId: 'nav-settings',
    onReady: initSettings
  });
});

async function initSettings() {
  await loadSettingsForm();
  await loadUsersTable();

  // Sync dark mode toggle
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const toggle = document.getElementById('dark-mode-toggle');
  if (toggle) toggle.checked = isDark;
}

// ── Panel Switching ───────────────────────────────────────────

function switchSettingsPanel(navItem, panelId) {
  document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
  navItem.classList.add('active');
  document.getElementById(panelId)?.classList.add('active');
}

// ── Load Settings ─────────────────────────────────────────────

async function loadSettingsForm() {
  try {
    const s = await getSettings() || {};
    setVal('biz-name',            s.businessName || '');
    setVal('biz-email',           s.businessEmail || '');
    setVal('biz-phone',           s.businessPhone || '');
    setVal('biz-address',         s.businessAddress || '');
    setVal('biz-currency',        s.currency || '₱');
    setVal('receipt-footer',      s.receiptFooter || 'Thank you for your purchase!');
    setVal('low-stock-threshold', s.lowStockThreshold || 5);
  } catch (err) {
    console.error('Settings load error:', err);
  }
}

// ── Save Business ─────────────────────────────────────────────

async function saveBusinessSettings() {
  const btn = document.getElementById('save-biz-btn');
  setLoading(btn, true, 'Saving...');
  try {
    await updateSettings({
      businessName:    document.getElementById('biz-name').value.trim(),
      businessEmail:   document.getElementById('biz-email').value.trim(),
      businessPhone:   document.getElementById('biz-phone').value.trim(),
      businessAddress: document.getElementById('biz-address').value.trim(),
      currency:        document.getElementById('biz-currency').value.trim() || '₱'
    });
    await logActivity(POSApp.user.uid, 'UPDATE_SETTINGS', 'Business settings updated').catch(()=>{});
    POSToast.success('Business settings saved!');
  } catch (err) {
    POSToast.error('Save failed: ' + err.message);
  } finally {
    setLoading(btn, false);
  }
}

// ── Save Receipt ──────────────────────────────────────────────

async function saveReceiptSettings() {
  const btn = document.getElementById('save-receipt-btn');
  setLoading(btn, true, 'Saving...');
  try {
    await updateSettings({
      receiptFooter:      document.getElementById('receipt-footer').value.trim(),
      lowStockThreshold:  parseInt(document.getElementById('low-stock-threshold').value) || 5
    });
    await logActivity(POSApp.user.uid, 'UPDATE_SETTINGS', 'Receipt settings updated').catch(()=>{});
    POSToast.success('Receipt settings saved!');
  } catch (err) {
    POSToast.error('Save failed: ' + err.message);
  } finally {
    setLoading(btn, false);
  }
}

// ── Create User ───────────────────────────────────────────────

async function createUserAccount() {
  const fullName = document.getElementById('nu-fullname').value.trim();
  const email    = document.getElementById('nu-email').value.trim();
  const password = document.getElementById('nu-password').value;
  const role     = document.getElementById('nu-role').value;

  if (!fullName || !email || !password) { POSToast.error('All fields are required.'); return; }
  if (password.length < 8) { POSToast.error('Password must be at least 8 characters.'); return; }
  if (!email.includes('@')) { POSToast.error('Please enter a valid email address.'); return; }

  const btn = document.getElementById('create-user-btn');
  setLoading(btn, true, 'Creating...');

  try {
    // Save current admin session info first
    const adminUser = auth.currentUser;

    // Create Firebase auth user via Admin SDK is not possible in frontend.
    // We use a workaround: create user, then re-sign-in admin.
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    const newUid = credential.user.uid;

    // Write to Realtime DB
    await createUser(newUid, {
      uid: newUid, fullName, email, role, status: 'active', firstLogin: true,
      createdBy: POSApp.user.uid
    });

    // Sign admin back in (the createUser call signs in as new user)
    // We need to re-authenticate the admin
    await auth.signOut();
    // Re-load page to prompt admin login (simplest safe approach)
    POSToast.success(`User "${fullName}" created! Please sign in again as admin.`);
    await logActivity(POSApp.user.uid, 'CREATE_USER', `User created: ${email} (${role})`).catch(()=>{});

    // Clear form
    ['nu-fullname','nu-email','nu-password'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
    document.getElementById('nu-role').value = 'cashier';

    setTimeout(() => window.location.href = '../pages/login.html', 2000);
  } catch (err) {
    let msg = err.message;
    if (err.code === 'auth/email-already-in-use') msg = 'This email is already registered.';
    if (err.code === 'auth/invalid-email') msg = 'Invalid email address.';
    if (err.code === 'auth/weak-password') msg = 'Password is too weak.';
    POSToast.error('Create user failed: ' + msg);
    setLoading(btn, false);
  }
}

// ── Load Users Table ──────────────────────────────────────────

async function loadUsersTable() {
  const tbody = document.getElementById('users-tbody');
  try {
    const data = await getAllUsers() || {};
    const users = Object.values(data).filter(u => !u.initialized);

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:var(--gap-lg);">No users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const statusCls = u.status === 'active' ? 'badge-success' : 'badge-danger';
      const isSelf    = u.uid === POSApp.user?.uid;
      return `<tr>
        <td style="font-weight:600;">${u.fullName || '—'}</td>
        <td>${u.email}</td>
        <td>
          <select class="user-role-select" onchange="changeUserRole('${u.uid}',this.value)" ${isSelf ? 'disabled' : ''} aria-label="Role for ${u.fullName}">
            <option value="cashier"  ${u.role==='cashier'  ? 'selected' : ''}>Cashier</option>
            <option value="manager"  ${u.role==='manager'  ? 'selected' : ''}>Manager</option>
            <option value="admin"    ${u.role==='admin'    ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td><span class="badge ${statusCls}">${u.status||'active'}</span></td>
        <td>${u.createdAt ? formatDate(u.createdAt) : '—'}</td>
        <td style="display:flex;gap:4px;flex-wrap:wrap;">
          ${u.status === 'active'
            ? `<button class="btn btn-warning btn-sm" onclick="toggleUserStatus('${u.uid}','disabled')" ${isSelf?'disabled':''}>Disable</button>`
            : `<button class="btn btn-success btn-sm" onclick="toggleUserStatus('${u.uid}','active')">Enable</button>`
          }
          <button class="btn btn-secondary btn-sm" onclick="openResetPassword('${u.uid}')">Reset PW</button>
          ${!isSelf ? `<button class="btn btn-danger btn-sm" onclick="deleteUserAccount('${u.uid}','${(u.email||'').replace(/'/g,"\\'")}')">Delete</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Could not load users.</td></tr>`;
    console.error('Users load error:', err);
  }
}

// ── User Actions ──────────────────────────────────────────────

async function changeUserRole(uid, newRole) {
  try {
    await updateUserRecord(uid, { role: newRole });
    await logActivity(POSApp.user.uid, 'UPDATE_USER', `Role changed for ${uid}: ${newRole}`).catch(()=>{});
    POSToast.success('Role updated!');
  } catch (err) {
    POSToast.error('Failed to update role: ' + err.message);
  }
}

async function toggleUserStatus(uid, newStatus) {
  const label = newStatus === 'disabled' ? 'disable' : 're-enable';
  const ok = await POSConfirm(`Are you sure you want to ${label} this user?`, 'Confirm', newStatus === 'disabled');
  if (!ok) return;
  try {
    await updateUserRecord(uid, { status: newStatus });
    await logActivity(POSApp.user.uid, 'UPDATE_USER', `User ${uid} status: ${newStatus}`).catch(()=>{});
    POSToast.success(`User ${label}d.`);
    await loadUsersTable();
  } catch (err) {
    POSToast.error('Failed: ' + err.message);
  }
}

async function deleteUserAccount(uid, email) {
  const ok = await POSConfirm(`Delete account for "${email}"? This cannot be undone.`, 'Delete User', true);
  if (!ok) return;
  try {
    await deleteUserRecord(uid);
    await logActivity(POSApp.user.uid, 'DELETE_USER', `User deleted: ${email}`).catch(()=>{});
    POSToast.success('User deleted.');
    await loadUsersTable();
  } catch (err) {
    POSToast.error('Delete failed: ' + err.message);
  }
}

// ── Reset Password ────────────────────────────────────────────

function openResetPassword(uid) {
  document.getElementById('reset-uid').value = uid;
  document.getElementById('reset-new-pw').value = '';
  POSModal.open('reset-pw-modal');
}

async function confirmResetPassword() {
  const uid = document.getElementById('reset-uid').value;
  const pw  = document.getElementById('reset-new-pw').value;
  if (!pw || pw.length < 8) { POSToast.error('Password must be at least 8 characters.'); return; }
  try {
    // Mark user as firstLogin so they change on next sign-in
    await updateUserRecord(uid, { firstLogin: true });
    // Note: Changing another user's password requires Admin SDK (not available in frontend).
    // Best practice: send reset email or use Admin SDK server-side.
    // Here we mark firstLogin=true so user is prompted to change on next login.
    await logActivity(POSApp.user.uid, 'RESET_PASSWORD', `Password reset for user ${uid}`).catch(()=>{});
    POSModal.close('reset-pw-modal');
    POSToast.success('Password reset flag set. User will be prompted on next login.');
  } catch (err) {
    POSToast.error('Reset failed: ' + err.message);
  }
}

// ── Appearance ────────────────────────────────────────────────

function toggleDarkMode(checkbox) {
  document.documentElement.setAttribute('data-theme', checkbox.checked ? 'dark' : 'light');
  localStorage.setItem('pos-theme', checkbox.checked ? 'dark' : 'light');
}

// ── Helpers ───────────────────────────────────────────────────

function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

function setLoading(el, loading, text) {
  if (!el) return;
  if (loading) { el._orig = el.textContent; el.disabled = true; el.textContent = text||'Loading...'; }
  else { el.disabled = false; el.textContent = el._orig||'Save'; }
}
