const API = '/api/items';
let allItems = [];
let printSelection = new Map(); // id -> item

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'dashboard') loadDashboard();
    if (btn.dataset.tab === 'items') loadItems();
    if (btn.dataset.tab === 'print') loadPrintTab();
    if (btn.dataset.tab === 'reports') loadReports();
    if (btn.dataset.tab === 'scan') document.getElementById('scanner-input').focus();
  });
});

// ---------- Helpers ----------
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (res.status === 401) {
    window.location.href = '/auth/login.html';
    throw new Error('not_logged_in');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}
function money(n) { return '$' + Number(n).toFixed(2); }

// ---------- Dashboard ----------
async function loadDashboard() {
  const items = await api('');
  const totalItems = items.length;
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = items.reduce((s, i) => s + i.quantity * i.price, 0);
  const lowStock = items.filter(i => i.quantity <= i.reorder_level);

  document.getElementById('stat-total-items').textContent = totalItems;
  document.getElementById('stat-total-units').textContent = totalUnits;
  document.getElementById('stat-total-value').textContent = money(totalValue);
  document.getElementById('stat-low-stock').textContent = lowStock.length;

  const tbody = document.querySelector('#low-stock-table tbody');
  tbody.innerHTML = lowStock.map(i => `
    <tr>
      <td>${escapeHtml(i.name)}</td>
      <td>${escapeHtml(i.barcode)}</td>
      <td>${i.quantity}</td>
      <td>${i.reorder_level}</td>
      <td>${escapeHtml(i.location || '-')}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="color:#6b7280">No low stock items 🎉</td></tr>';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Items tab ----------
async function loadItems() {
  const q = document.getElementById('search-box').value;
  const category = document.getElementById('category-filter').value;
  const lowOnly = document.getElementById('low-stock-filter').checked;

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (lowOnly) params.set('low_stock', '1');

  allItems = await api('?' + params.toString());
  renderItemsTable(allItems);
  await refreshCategoryFilter();
}

async function refreshCategoryFilter() {
  const sel = document.getElementById('category-filter');
  const current = sel.value;
  const cats = await api('/categories');
  sel.innerHTML = '<option value="">All Categories</option>' +
    cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  sel.value = current;
}

function renderItemsTable(items) {
  const tbody = document.querySelector('#items-table tbody');
  tbody.innerHTML = items.map(i => `
    <tr class="${i.quantity <= i.reorder_level ? 'low-stock-row' : ''}">
      <td>${escapeHtml(i.name)}</td>
      <td>${escapeHtml(i.barcode)}</td>
      <td>${escapeHtml(i.category || '-')}</td>
      <td>${i.quantity}</td>
      <td>${money(i.price)}</td>
      <td>${escapeHtml(i.supplier || '-')}</td>
      <td>${escapeHtml(i.location || '-')}</td>
      <td>
        <button class="btn small" onclick="openAdjustModal(${i.id})">Adjust</button>
        <button class="btn small" onclick="openEditModal(${i.id})">Edit</button>
        <button class="btn small danger" onclick="deleteItem(${i.id})">Delete</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="8" style="color:#6b7280">No items found</td></tr>';
}

document.getElementById('search-box').addEventListener('input', debounce(loadItems, 250));
document.getElementById('category-filter').addEventListener('change', loadItems);
document.getElementById('low-stock-filter').addEventListener('change', loadItems);

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---------- Add/Edit modal ----------
const itemModal = document.getElementById('item-modal');
document.getElementById('add-item-btn').addEventListener('click', () => openEditModal(null));
document.getElementById('modal-cancel-btn').addEventListener('click', () => itemModal.classList.remove('open'));

function openEditModal(id) {
  document.getElementById('item-form').reset();
  document.getElementById('item-id').value = id || '';
  if (id) {
    const item = allItems.find(i => i.id === id) || {};
    document.getElementById('modal-title').textContent = 'Edit Item';
    document.getElementById('f-name').value = item.name || '';
    document.getElementById('f-barcode').value = item.barcode || '';
    document.getElementById('f-category').value = item.category || '';
    document.getElementById('f-quantity').value = item.quantity ?? 0;
    document.getElementById('f-quantity').disabled = true; // qty changes go through Adjust
    document.getElementById('f-reorder').value = item.reorder_level ?? 0;
    document.getElementById('f-price').value = item.price ?? 0;
    document.getElementById('f-supplier').value = item.supplier || '';
    document.getElementById('f-location').value = item.location || '';
  } else {
    document.getElementById('modal-title').textContent = 'Add Item';
    document.getElementById('f-quantity').disabled = false;
  }
  itemModal.classList.add('open');
}

document.getElementById('item-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('item-id').value;
  const payload = {
    name: document.getElementById('f-name').value,
    barcode: document.getElementById('f-barcode').value,
    category: document.getElementById('f-category').value,
    reorder_level: document.getElementById('f-reorder').value,
    price: document.getElementById('f-price').value,
    supplier: document.getElementById('f-supplier').value,
    location: document.getElementById('f-location').value,
  };
  if (!id) payload.quantity = document.getElementById('f-quantity').value;

  try {
    if (id) {
      await api('/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('', { method: 'POST', body: JSON.stringify(payload) });
    }
    itemModal.classList.remove('open');
    loadItems();
    loadDashboard();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

async function deleteItem(id) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  await api('/' + id, { method: 'DELETE' });
  loadItems();
  loadDashboard();
}

// ---------- Adjust stock modal ----------
const adjustModal = document.getElementById('adjust-modal');
document.getElementById('adjust-cancel-btn').addEventListener('click', () => adjustModal.classList.remove('open'));

function openAdjustModal(id) {
  const item = allItems.find(i => i.id === id);
  document.getElementById('adjust-item-id').value = id;
  document.getElementById('adjust-item-name').textContent = item ? item.name : '';
  document.getElementById('adjust-change').value = '';
  document.getElementById('adjust-reason').value = '';
  adjustModal.classList.add('open');
}

document.getElementById('adjust-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('adjust-item-id').value;
  const change = document.getElementById('adjust-change').value;
  const reason = document.getElementById('adjust-reason').value;
  try {
    await api(`/${id}/adjust`, { method: 'POST', body: JSON.stringify({ change, reason }) });
    adjustModal.classList.remove('open');
    loadItems();
    loadDashboard();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

// ---------- Scan tab ----------
const scannerInput = document.getElementById('scanner-input');
scannerInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const code = scannerInput.value.trim();
    scannerInput.value = '';
    if (code) await handleScannedCode(code);
  }
});

async function handleScannedCode(code) {
  const resultDiv = document.getElementById('scan-result');
  try {
    const item = await api('/barcode/' + encodeURIComponent(code));
    resultDiv.innerHTML = `
      <div class="result-card">
        <h3>${escapeHtml(item.name)}</h3>
        <div class="hint">${escapeHtml(item.category || '')} ${item.location ? '· ' + escapeHtml(item.location) : ''}</div>
        <div class="qty-big">${item.quantity}</div>
        <div class="hint">units in stock (reorder at ${item.reorder_level})</div>
        <img class="barcode-img" src="${API}/${item.id}/barcode.png" alt="barcode">
        <div class="modal-actions" style="justify-content:center">
          <button class="btn" onclick="quickAdjust(${item.id}, -1)">-1</button>
          <button class="btn" onclick="quickAdjust(${item.id}, 1)">+1</button>
          <button class="btn primary" onclick="openAdjustModal(${item.id})">Adjust Stock</button>
        </div>
      </div>
    `;
  } catch (err) {
    resultDiv.innerHTML = `<p style="color:#dc2626">No item found for barcode "${escapeHtml(code)}".</p>`;
  }
}

async function quickAdjust(id, change) {
  await api(`/${id}/adjust`, { method: 'POST', body: JSON.stringify({ change, reason: change > 0 ? 'quick +1' : 'quick -1' }) });
  const item = await api('/' + id);
  handleScannedCode(item.barcode);
}

// Camera scanning via html5-qrcode (supports CODE_128 and other 1D formats)
let html5QrCode = null;
let cameraRunning = false;
document.getElementById('camera-toggle-btn').addEventListener('click', async () => {
  const btn = document.getElementById('camera-toggle-btn');
  if (!cameraRunning) {
    html5QrCode = new Html5Qrcode('camera-reader');
    try {
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        async (decodedText) => {
          await handleScannedCode(decodedText);
        },
        () => {}
      );
      cameraRunning = true;
      btn.textContent = 'Stop Camera Scanner';
    } catch (err) {
      alert('Could not start camera: ' + err.message);
    }
  } else {
    await html5QrCode.stop();
    html5QrCode.clear();
    cameraRunning = false;
    btn.textContent = 'Start Camera Scanner';
  }
});

// ---------- Print labels tab ----------
async function loadPrintTab() {
  const items = await api('');
  renderPrintSelectTable(items);
}

document.getElementById('print-search').addEventListener('input', debounce(async () => {
  const q = document.getElementById('print-search').value;
  const items = await api('?q=' + encodeURIComponent(q));
  renderPrintSelectTable(items);
}, 250));

function renderPrintSelectTable(items) {
  const tbody = document.querySelector('#print-select-table tbody');
  tbody.innerHTML = items.map(i => `
    <tr>
      <td><input type="checkbox" data-id="${i.id}" ${printSelection.has(i.id) ? 'checked' : ''}></td>
      <td>${escapeHtml(i.name)}</td>
      <td>${escapeHtml(i.barcode)}</td>
    </tr>
  `).join('');
  tbody.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = Number(cb.dataset.id);
      const item = items.find(i => i.id === id);
      if (cb.checked) printSelection.set(id, item);
      else printSelection.delete(id);
      renderLabelSheet();
    });
  });
}

function renderLabelSheet() {
  const sheet = document.getElementById('label-sheet');
  const items = Array.from(printSelection.values());
  document.getElementById('print-count').textContent = items.length;
  sheet.innerHTML = items.map(i => `
    <div class="label-card">
      <img src="${API}/${i.id}/barcode.png" alt="${escapeHtml(i.barcode)}">
      <div class="label-name">${escapeHtml(i.name)}</div>
    </div>
  `).join('') || '<p class="hint">Select items on the left to add them here.</p>';
}

document.getElementById('print-btn').addEventListener('click', () => {
  if (printSelection.size === 0) { alert('Select at least one item first.'); return; }
  window.print();
});
document.getElementById('print-clear-btn').addEventListener('click', () => {
  printSelection.clear();
  renderLabelSheet();
  loadPrintTab();
});

// ---------- Reports tab ----------
async function reportsApi(path) {
  const res = await fetch('/api/reports' + path);
  if (res.status === 401) {
    window.location.href = '/auth/login.html';
    throw new Error('not_logged_in');
  }
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

async function loadReports() {
  const [summary, lowStock, movements] = await Promise.all([
    reportsApi('/summary'),
    reportsApi('/low-stock'),
    reportsApi('/movements?limit=100'),
  ]);

  document.getElementById('r-total-items').textContent = summary.totalItems;
  document.getElementById('r-total-units').textContent = summary.totalUnits;
  document.getElementById('r-total-value').textContent = money(summary.totalValue);
  document.getElementById('r-low-stock').textContent = summary.lowStockCount;
  document.getElementById('report-generated-at').textContent =
    'Generated ' + new Date(summary.generatedAt).toLocaleString();

  const catBody = document.querySelector('#category-report-table tbody');
  catBody.innerHTML = summary.byCategory.map(c => `
    <tr>
      <td>${escapeHtml(c.category)}</td>
      <td>${c.itemCount}</td>
      <td>${c.totalUnits}</td>
      <td>${money(c.totalValue)}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="color:#6b7280">No items yet</td></tr>';

  const lowBody = document.querySelector('#report-lowstock-table tbody');
  lowBody.innerHTML = lowStock.map(i => `
    <tr>
      <td>${escapeHtml(i.name)}</td>
      <td>${escapeHtml(i.barcode)}</td>
      <td>${escapeHtml(i.category || '-')}</td>
      <td>${i.quantity}</td>
      <td>${i.reorder_level}</td>
      <td>${escapeHtml(i.location || '-')}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="color:#6b7280">No low stock items 🎉</td></tr>';

  const moveBody = document.querySelector('#report-movements-table tbody');
  moveBody.innerHTML = movements.map(m => `
    <tr>
      <td>${new Date(m.created_at).toLocaleString()}</td>
      <td>${escapeHtml(m.item_name)}</td>
      <td>${escapeHtml(m.barcode)}</td>
      <td style="color:${m.change > 0 ? '#16a34a' : '#dc2626'}">${m.change > 0 ? '+' : ''}${m.change}</td>
      <td>${escapeHtml(m.reason || '-')}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="color:#6b7280">No stock movements yet</td></tr>';
}

document.getElementById('dl-inventory-csv').addEventListener('click', () => {
  window.location.href = '/api/reports/inventory?format=csv';
});
document.getElementById('dl-lowstock-csv').addEventListener('click', () => {
  window.location.href = '/api/reports/low-stock?format=csv';
});
document.getElementById('dl-movements-csv').addEventListener('click', () => {
  window.location.href = '/api/reports/movements?format=csv&limit=1000';
});

// ---------- Account menu (logout / change password) ----------
const accountBtn = document.getElementById('account-btn');
const accountDropdown = document.getElementById('account-dropdown');
accountBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  accountDropdown.classList.toggle('open');
});
document.addEventListener('click', () => accountDropdown.classList.remove('open'));

fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => {
  if (data && data.username) {
    document.getElementById('account-username').textContent = data.username;
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/auth/login.html';
});

const passwordModal = document.getElementById('password-modal');
const passwordForm = document.getElementById('password-form');
const passwordError = document.getElementById('password-error');

document.getElementById('change-password-btn').addEventListener('click', () => {
  accountDropdown.classList.remove('open');
  passwordForm.reset();
  passwordError.style.display = 'none';
  passwordModal.classList.add('open');
});
document.getElementById('password-cancel-btn').addEventListener('click', () => {
  passwordModal.classList.remove('open');
});

passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  passwordError.style.display = 'none';
  const currentPassword = document.getElementById('pw-current').value;
  const newPassword = document.getElementById('pw-new').value;
  const confirmPassword = document.getElementById('pw-confirm').value;

  if (newPassword !== confirmPassword) {
    passwordError.textContent = 'New password and confirmation do not match.';
    passwordError.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      passwordModal.classList.remove('open');
      alert('Password updated successfully.');
    } else {
      const messages = {
        current_password_incorrect: 'Your current password is incorrect.',
        password_too_short: 'New password must be at least 8 characters.',
      };
      passwordError.textContent = messages[data.error] || 'Could not update password.';
      passwordError.style.display = 'block';
    }
  } catch (err) {
    passwordError.textContent = 'Could not reach the server.';
    passwordError.style.display = 'block';
  }
});

// ---------- Init ----------
loadDashboard();
