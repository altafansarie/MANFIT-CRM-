/**
 * MANFIT Luxury Apparel CRM - Main Application Controller
 * Handles UI interactions, Chart.js graphs, Sales CRUD, Modals, Invoicing & Export
 */

// Global State
let currentTab = 'dashboard';
let trendChart = null;
let categoryChart = null;
let paymentChart = null;
let currentSaleItems = [];
let allProductsList = [];
let activeInventoryCategory = 'ALL';

// Available Standard Categories & Sizes for Clothing
const DEFAULT_CATEGORIES = [
  'Jeans',
  'Formal pants',
  'T-shirts',
  'Formal Shirts',
  'Casual Shirts',
  'Trousers',
  'Under garments',
  'Accessories',
  'Jacket',
  'Sweaters',
  'traditional',
  'Tailoring'
];

let CLOTHING_CATEGORIES = (() => {
  try {
    const saved = localStorage.getItem('manfit_clothing_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  } catch (e) {
    return DEFAULT_CATEGORIES;
  }
})();

const CLOTHING_SIZES = ['28', '30', '32', '34', '36', '38', 'S', 'M', 'L', 'XL', 'XXL', 'Custom Fit', 'Free Size'];

// Format currency (INR/Generic currency standard)
function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// Format date nicely
function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateShort(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short'
  });
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing MANFIT Luxury CRM...');
  
  // 1. Setup UI listeners immediately and synchronously so buttons & navigation work right away
  setupNavigation();
  setupSaleFormListeners();
  setupFilterListeners();
  setupSettingsListeners();

  // 2. Initialize Database & Views asynchronously
  (async () => {
    try {
      await window.manfitDB.init();
    } catch (e) {
      console.warn('DB Init notice:', e);
    }

    try {
      await loadCatalogForDropdowns();
    } catch (e) {}

    try {
      await switchTab('dashboard');
    } catch (e) {
      console.warn('Dashboard view notice:', e);
      const dash = document.getElementById('view-dashboard');
      if (dash) dash.classList.remove('hidden');
    }

    try {
      resetSaleForm();
    } catch (e) {}
  })();
});

// --- NAVIGATION & ROUTING ---
function setupNavigation() {
  const navButtons = document.querySelectorAll('[data-tab-target]');
  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = btn.getAttribute('data-tab-target');
      switchTab(target);
    });
  });

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileNav = document.getElementById('mobileNav');
  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileNav.classList.toggle('hidden');
    });
  }
}

async function switchTab(tabId) {
  currentTab = tabId;

  // Update nav button active states immediately
  document.querySelectorAll('[data-tab-target]').forEach(btn => {
    if (btn.getAttribute('data-tab-target') === tabId) {
      btn.classList.add('nav-tab-active');
    } else {
      btn.classList.remove('nav-tab-active');
    }
  });

  // Hide all tab views immediately
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.add('hidden');
    view.classList.remove('animate-fade-in');
  });

  // Show active tab view immediately
  const activeView = document.getElementById(`view-${tabId}`);
  if (activeView) {
    activeView.classList.remove('hidden');
    activeView.classList.add('animate-fade-in');
  }

  // Close mobile nav if open
  const mobileNav = document.getElementById('mobileNav');
  if (mobileNav) mobileNav.classList.add('hidden');

  // Specific tab data reloaders protected with try/catch
  try {
    if (tabId === 'dashboard') {
      await renderDashboard();
    } else if (tabId === 'sales') {
      await renderSalesHistory();
    } else if (tabId === 'customers') {
      await renderCustomersList();
    } else if (tabId === 'inventory') {
      await renderInventoryList();
    } else if (tabId === 'settings') {
      await loadSettingsView();
    } else if (tabId === 'new-sale') {
      await loadCatalogForDropdowns();
    }
  } catch (err) {
    console.warn(`Tab ${tabId} reload warning:`, err);
  }
}

// --- DASHBOARD & ANALYTICS ---
async function renderDashboard() {
  const summary = await window.manfitAPI.getAnalyticsSummary();
  const recentSales = await window.manfitAPI.getSales({ limit: 6 });

  // Update Metric Counters with smooth animation
  animateCounter('stat-today-revenue', summary.todayRevenue, true);
  animateCounter('stat-today-orders', summary.todayOrdersCount);
  animateCounter('stat-today-items', summary.todayItemsCount);
  animateCounter('stat-today-aov', Math.round(summary.avgOrderValue), true);
  animateCounter('stat-total-revenue', summary.totalRevenue, true);

  // Render Charts
  renderTrendChart(summary.trend);
  renderCategoryChart(summary.categories);
  renderPaymentChart(summary.paymentMethods);

  // Render Recent Sales List
  const recentSalesContainer = document.getElementById('recentSalesList');
  if (recentSalesContainer) {
    if (recentSales.length === 0) {
      recentSalesContainer.innerHTML = `
        <div class="py-12 text-center text-zinc-500">
          <i class="fa-solid fa-receipt text-3xl mb-3 text-white/40"></i>
          <p>No sales recorded yet today. Click "New Sale" to record your first transaction.</p>
        </div>
      `;
    } else {
      recentSalesContainer.innerHTML = recentSales.slice(0, 6).map(sale => `
        <div class="flex items-center justify-between p-3.5 rounded-lg bg-[#111111]/80 hover:bg-[#1a1a1a] border border-white/10 transition-colors">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/20 font-semibold text-sm">
              <i class="fa-solid fa-bag-shopping"></i>
            </div>
            <div>
              <div class="font-medium text-white flex items-center gap-2">
                <span>${escapeHtml(sale.customerName || 'Walk-in Guest')}</span>
                <span class="text-xs px-2 py-0.5 rounded bg-zinc-800 text-white font-mono font-semibold">${sale.invoiceNo}</span>
              </div>
              <div class="text-xs text-zinc-400 mt-0.5">
                ${sale.items ? sale.items.length : 0} items • <span class="text-zinc-500">${formatDate(sale.date)}</span>
              </div>
            </div>
          </div>
          <div class="text-right">
            <div class="font-semibold text-white text-base">${formatCurrency(sale.total)}</div>
            <span class="inline-block text-[11px] px-2 py-0.5 rounded-full ${
              sale.paymentMethod === 'UPI' ? 'bg-zinc-800 text-white border border-white/30' :
              sale.paymentMethod === 'Card' ? 'bg-zinc-900 text-zinc-200 border border-white/20' :
              'bg-white/10 text-white border border-white/20'
            }">${sale.paymentMethod || 'Cash'}</span>
          </div>
        </div>
      `).join('');
    }
  }
}

function animateCounter(elementId, targetValue, isCurrency = false) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const startValue = 0;
  const duration = 600;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutQuad
    const ease = 1 - (1 - progress) * (1 - progress);
    const current = Math.round(startValue + (targetValue - startValue) * ease);

    el.innerText = isCurrency ? formatCurrency(current) : current.toLocaleString('en-IN');

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// Chart.js - 7-Day Revenue Trend
function renderTrendChart(trendData) {
  const ctx = document.getElementById('chartRevenueTrend');
  if (!ctx || typeof Chart === 'undefined') return;

  if (trendChart) trendChart.destroy();

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.01)');

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trendData.labels,
      datasets: [{
        label: 'Daily Revenue',
        data: trendData.data,
        borderColor: '#ffffff',
        backgroundColor: gradient,
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#000000',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0a0a0a',
          titleColor: '#ffffff',
          bodyColor: '#f1f5f9',
          borderColor: 'rgba(255, 255, 255, 0.25)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context) => ` Revenue: ${formatCurrency(context.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#cbd5e1', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#cbd5e1',
            font: { size: 11 },
            callback: (val) => '₹' + (val >= 1000 ? (val / 1000) + 'k' : val)
          }
        }
      }
    }
  });
}

// Chart.js - Category Doughnut
function renderCategoryChart(categoryData) {
  const ctx = document.getElementById('chartCategoryShare');
  if (!ctx || typeof Chart === 'undefined') return;

  if (categoryChart) categoryChart.destroy();

  const labels = Object.keys(categoryData);
  const data = Object.values(categoryData);

  const colors = [
    '#ffffff', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b',
    '#475569', '#334155', '#1e293b', '#0f172a', '#f8fafc'
  ];

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['No Data'],
      datasets: [{
        data: data.length ? data : [1],
        backgroundColor: labels.length ? colors.slice(0, labels.length) : ['#262626'],
        borderColor: '#050505',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#ffffff',
            font: { size: 11 },
            boxWidth: 12,
            padding: 12
          }
        },
        tooltip: {
          backgroundColor: '#0a0a0a',
          titleColor: '#ffffff',
          bodyColor: '#f1f5f9',
          borderColor: 'rgba(255, 255, 255, 0.25)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`
          }
        }
      },
      cutout: '68%'
    }
  });
}

// Chart.js - Payment Methods Split
function renderPaymentChart(paymentData) {
  const ctx = document.getElementById('chartPaymentMethods');
  if (!ctx || typeof Chart === 'undefined') return;

  if (paymentChart) paymentChart.destroy();

  const labels = Object.keys(paymentData);
  const data = Object.values(paymentData);

  paymentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          'rgba(255, 255, 255, 0.95)', // UPI
          'rgba(226, 232, 240, 0.85)', // Cash
          'rgba(148, 163, 184, 0.75)', // Card
          'rgba(71, 85, 105, 0.65)'     // Other
        ],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0a0a0a',
          titleColor: '#ffffff',
          bodyColor: '#f1f5f9',
          borderColor: 'rgba(255, 255, 255, 0.25)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => ` Total: ${formatCurrency(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#cbd5e1' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#cbd5e1',
            callback: (val) => '₹' + (val >= 1000 ? (val / 1000) + 'k' : val)
          }
        }
      }
    }
  });
}

// --- NEW SALE ENTRY (POS) ---
function resetSaleForm() {
  currentSaleItems = [];
  
  // Set date to current local datetime format for input[type=datetime-local]
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const nowStr = now.toISOString().slice(0, 16);
  
  const dateInput = document.getElementById('saleDateInput');
  if (dateInput) dateInput.value = nowStr;

  // Clear customer fields
  const custName = document.getElementById('custNameInput');
  const custPhone = document.getElementById('custPhoneInput');
  const notesInput = document.getElementById('alterationNotesInput');
  const discountInput = document.getElementById('saleDiscountInput');
  const taxInput = document.getElementById('saleTaxInput');

  if (custName) custName.value = '';
  if (custPhone) custPhone.value = '';
  if (notesInput) notesInput.value = '';
  if (discountInput) discountInput.value = '0';
  if (taxInput) taxInput.value = '0';

  // Add default first line item
  addLineItem();
  recalculateTotals();

  // Load next invoice number preview
  window.manfitAPI.peekNextInvoiceNumber().then(invNo => {
    const invLabel = document.getElementById('saleInvoicePreview');
    if (invLabel) invLabel.innerText = invNo;
  });
}

async function loadCatalogForDropdowns() {
  allProductsList = await window.manfitAPI.getProducts();
  const datalist = document.getElementById('catalogProductsList');
  if (datalist) {
    datalist.innerHTML = allProductsList.map(p => `
      <option value="${p.name}" data-price="${p.price}" data-category="${p.category}" data-sizes="${(p.sizes || []).join(',')}">
        ${p.category} - ${formatCurrency(p.price)}
      </option>
    `).join('');
  }
}

function setupSaleFormListeners() {
  // Add item button
  const addItemBtn = document.getElementById('addItemRowBtn');
  if (addItemBtn) {
    addItemBtn.addEventListener('click', () => {
      addLineItem();
    });
  }

  // Discount & Tax recalculation
  const discountInput = document.getElementById('saleDiscountInput');
  const taxInput = document.getElementById('saleTaxInput');
  if (discountInput) discountInput.addEventListener('input', recalculateTotals);
  if (taxInput) taxInput.addEventListener('input', recalculateTotals);

  // Customer phone lookup auto-fill
  const custPhone = document.getElementById('custPhoneInput');
  if (custPhone) {
    custPhone.addEventListener('blur', async () => {
      const phone = custPhone.value.trim();
      if (phone.length >= 7) {
        const cust = await window.manfitDB.getCustomerByPhone(phone);
        if (cust && cust.name) {
          const nameInput = document.getElementById('custNameInput');
          if (nameInput && !nameInput.value) {
            nameInput.value = cust.name;
            showToast(`Welcome back, ${cust.name}! (Past orders: ${cust.ordersCount})`, 'info');
          }
        }
      }
    });
  }

  // Sale form submission
  const saleForm = document.getElementById('newSaleForm');
  if (saleForm) {
    saleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaleSubmit();
    });
  }

  // Clear form button
  const resetBtn = document.getElementById('resetSaleBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear this sale entry?')) {
        resetSaleForm();
      }
    });
  }
}

function addLineItem(itemData = null) {
  const container = document.getElementById('saleItemsTableBody');
  if (!container) return;

  const itemId = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  const initialItem = itemData || {
    id: itemId,
    name: '',
    category: 'Suits',
    size: '40',
    quantity: 1,
    unitPrice: 0,
    total: 0
  };

  currentSaleItems.push(initialItem);

  const row = document.createElement('tr');
  row.id = `row-${itemId}`;
  row.className = 'border-b border-white/10 hover:bg-white/5 transition-colors';
  row.innerHTML = `
    <td class="p-3">
      <div class="relative">
        <input type="text" list="catalogProductsList" 
          class="w-full bg-[#0d0d0d] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-white focus:outline-none item-name-input" 
          placeholder="Outfit Type" 
          value="${escapeHtml(initialItem.name)}" required>
      </div>
    </td>
    <td class="p-3">
      <select class="w-full bg-[#0d0d0d] border border-white/15 rounded-lg px-2.5 py-2 text-xs text-zinc-200 focus:border-white focus:outline-none item-category-select">
        ${CLOTHING_CATEGORIES.map(cat => `<option value="${cat}" ${cat === initialItem.category ? 'selected' : ''}>${cat}</option>`).join('')}
      </select>
    </td>
    <td class="p-3">
      <select class="w-full bg-[#0d0d0d] border border-white/15 rounded-lg px-2 py-2 text-xs text-zinc-200 focus:border-white focus:outline-none item-size-select">
        ${CLOTHING_SIZES.map(s => `<option value="${s}" ${s === initialItem.size ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </td>
    <td class="p-3 w-28">
      <div class="flex items-center border border-white/15 rounded-lg overflow-hidden bg-[#0d0d0d]">
        <button type="button" class="px-2 py-1 bg-white/10 text-zinc-300 hover:text-white qty-minus-btn">-</button>
        <input type="number" min="1" max="999" value="${initialItem.quantity}" 
          class="w-full text-center bg-transparent py-1 text-sm text-white focus:outline-none item-qty-input">
        <button type="button" class="px-2 py-1 bg-white/10 text-zinc-300 hover:text-white qty-plus-btn">+</button>
      </div>
    </td>
    <td class="p-3 w-36">
      <div class="relative">
        <span class="absolute left-2.5 top-2 text-xs text-zinc-400">₹</span>
        <input type="number" min="0" step="1" value="${initialItem.unitPrice}" 
          class="w-full bg-[#0d0d0d] border border-white/15 rounded-lg pl-6 pr-2 py-2 text-sm text-right text-white focus:border-white focus:outline-none item-price-input" 
          placeholder="0.00" required>
      </div>
    </td>
    <td class="p-3 text-right font-semibold text-white item-row-total text-sm">
      ${formatCurrency(initialItem.total)}
    </td>
    <td class="p-3 text-center w-12">
      <button type="button" class="text-zinc-500 hover:text-rose-400 transition-colors remove-row-btn p-1.5" title="Remove line item">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </td>
  `;

  container.appendChild(row);

  // Hook row inputs
  const nameInput = row.querySelector('.item-name-input');
  const catSelect = row.querySelector('.item-category-select');
  const sizeSelect = row.querySelector('.item-size-select');
  const qtyInput = row.querySelector('.item-qty-input');
  const priceInput = row.querySelector('.item-price-input');
  const minusBtn = row.querySelector('.qty-minus-btn');
  const plusBtn = row.querySelector('.qty-plus-btn');
  const removeBtn = row.querySelector('.remove-row-btn');

  // When catalog product chosen, auto-populate category and price
  nameInput.addEventListener('change', () => {
    const matched = allProductsList.find(p => p.name.toLowerCase() === nameInput.value.toLowerCase());
    if (matched) {
      catSelect.value = matched.category;
      priceInput.value = matched.price;
      if (matched.sizes && matched.sizes.length > 0) {
        sizeSelect.value = matched.sizes[0];
      }
    }
    updateRowCalculations(row, itemId);
  });

  minusBtn.addEventListener('click', () => {
    let val = parseInt(qtyInput.value) || 1;
    if (val > 1) {
      qtyInput.value = val - 1;
      updateRowCalculations(row, itemId);
    }
  });

  plusBtn.addEventListener('click', () => {
    let val = parseInt(qtyInput.value) || 1;
    qtyInput.value = val + 1;
    updateRowCalculations(row, itemId);
  });

  qtyInput.addEventListener('input', () => updateRowCalculations(row, itemId));
  priceInput.addEventListener('input', () => updateRowCalculations(row, itemId));
  catSelect.addEventListener('change', () => updateRowCalculations(row, itemId));
  sizeSelect.addEventListener('change', () => updateRowCalculations(row, itemId));

  removeBtn.addEventListener('click', () => {
    if (currentSaleItems.length <= 1) {
      showToast('A sale must have at least one clothing item.', 'warning');
      return;
    }
    const nameVal = row.querySelector('.item-name-input').value.trim();
    const priceVal = parseFloat(row.querySelector('.item-price-input').value) || 0;
    if (nameVal || priceVal > 0) {
      if (!confirm(`Remove "${nameVal || 'this garment'}" from sale?`)) {
        return;
      }
    }
    currentSaleItems = currentSaleItems.filter(i => i.id !== itemId);
    row.remove();
    recalculateTotals();
  });

  updateRowCalculations(row, itemId);
}

function updateRowCalculations(row, itemId) {
  const name = row.querySelector('.item-name-input').value;
  const category = row.querySelector('.item-category-select').value;
  const size = row.querySelector('.item-size-select').value;
  const qty = parseInt(row.querySelector('.item-qty-input').value) || 1;
  const price = parseFloat(row.querySelector('.item-price-input').value) || 0;
  const total = qty * price;

  row.querySelector('.item-row-total').innerText = formatCurrency(total);

  // Update in array
  const itemObj = currentSaleItems.find(i => i.id === itemId);
  if (itemObj) {
    itemObj.name = name;
    itemObj.category = category;
    itemObj.size = size;
    itemObj.quantity = qty;
    itemObj.unitPrice = price;
    itemObj.total = total;
  }

  recalculateTotals();
}

function recalculateTotals() {
  const subtotal = currentSaleItems.reduce((acc, item) => acc + (parseFloat(item.total) || 0), 0);
  
  const discountVal = parseFloat(document.getElementById('saleDiscountInput')?.value) || 0;
  const taxPct = parseFloat(document.getElementById('saleTaxInput')?.value) || 0;

  const afterDiscount = Math.max(0, subtotal - discountVal);
  const taxAmount = (afterDiscount * taxPct) / 100;
  const grandTotal = Math.round(afterDiscount + taxAmount);

  // Update summary UI labels
  const subtotalEl = document.getElementById('summarySubtotal');
  const discountEl = document.getElementById('summaryDiscount');
  const taxEl = document.getElementById('summaryTax');
  const grandTotalEl = document.getElementById('summaryGrandTotal');

  if (subtotalEl) subtotalEl.innerText = formatCurrency(subtotal);
  if (discountEl) discountEl.innerText = '- ' + formatCurrency(discountVal);
  if (taxEl) taxEl.innerText = '+ ' + formatCurrency(taxAmount);
  if (grandTotalEl) grandTotalEl.innerText = formatCurrency(grandTotal);

  return { subtotal, discount: discountVal, tax: taxAmount, grandTotal };
}

async function handleSaleSubmit() {
  const { subtotal, discount, tax, grandTotal } = recalculateTotals();

  if (currentSaleItems.length === 0 || subtotal <= 0) {
    showToast('Please add at least one item with a valid price.', 'error');
    return;
  }

  // Validate item names
  const invalidItem = currentSaleItems.find(i => !i.name.trim() || i.unitPrice <= 0);
  if (invalidItem) {
    showToast('Please specify a valid item name and price for all rows.', 'error');
    return;
  }

  const custName = document.getElementById('custNameInput')?.value.trim() || 'Walk-in Customer';
  const custPhone = document.getElementById('custPhoneInput')?.value.trim() || '';
  const dateVal = document.getElementById('saleDateInput')?.value || new Date().toISOString();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Cash';
  const paymentStatus = document.querySelector('input[name="paymentStatus"]:checked')?.value || 'Paid';
  const alterationNotes = document.getElementById('alterationNotesInput')?.value.trim() || '';

  const salePayload = {
    date: new Date(dateVal).toISOString(),
    customerName: custName,
    customerPhone: custPhone,
    items: currentSaleItems.map(i => ({
      name: i.name,
      category: i.category,
      size: i.size,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.total
    })),
    subtotal: subtotal,
    discount: discount,
    tax: tax,
    total: grandTotal,
    paymentMethod: paymentMethod,
    paymentStatus: paymentStatus,
    alterationNotes: alterationNotes,
    salesperson: 'MANFIT Staff'
  };

  try {
    const savedSale = await window.manfitAPI.createSale(salePayload);
    showToast(`Sale recorded successfully! Invoice ${savedSale.invoiceNo}`, 'success');

    // Reset form for next sale
    resetSaleForm();

    // Show Printable Receipt Modal
    openReceiptModal(savedSale);

    // Refresh dashboard in background
    await renderDashboard();
  } catch (err) {
    console.error('Error saving sale:', err);
    showToast('Error saving sale transaction. Please check console.', 'error');
  }
}

// --- SALES HISTORY & DAILY REGISTER ---
async function renderSalesHistory() {
  const dateRange = document.getElementById('filterDateRange')?.value || 'today';
  const paymentMethod = document.getElementById('filterPaymentMethod')?.value || 'all';
  const paymentStatus = document.getElementById('filterPaymentStatus')?.value || 'all';
  const search = document.getElementById('searchSalesInput')?.value || '';

  const sales = await window.manfitAPI.getSales({
    dateRange,
    paymentMethod,
    paymentStatus,
    search
  });

  const tableBody = document.getElementById('salesHistoryTableBody');
  const countLabel = document.getElementById('salesFilteredCount');
  const totalAmountLabel = document.getElementById('salesFilteredTotal');

  if (countLabel) countLabel.innerText = `${sales.length} transactions`;

  const totalFilteredRevenue = sales.reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);
  if (totalAmountLabel) totalAmountLabel.innerText = formatCurrency(totalFilteredRevenue);

  if (!tableBody) return;

  if (sales.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="py-14 text-center text-zinc-500">
          <i class="fa-solid fa-magnifying-glass text-3xl mb-3 text-white/30"></i>
          <p class="text-sm">No sales found matching the selected filter criteria.</p>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = sales.map(sale => {
    const itemsSummary = (sale.items || []).map(i => `${i.quantity}x ${i.name} (${i.size})`).join(', ');
    return `
      <tr class="border-b border-[#231f1a] hover:bg-[#1a1815] transition-colors text-sm">
        <td class="p-3.5 font-mono text-white font-semibold">
          ${sale.invoiceNo}
        </td>
        <td class="p-3.5 text-zinc-400 whitespace-nowrap">
          ${formatDate(sale.date)}
        </td>
        <td class="p-3.5">
          <div class="font-medium text-white">${escapeHtml(sale.customerName || 'Walk-in')}</div>
          ${sale.customerPhone ? `<div class="text-xs text-zinc-500">${sale.customerPhone}</div>` : ''}
        </td>
        <td class="p-3.5 text-zinc-300 max-w-xs truncate" title="${escapeHtml(itemsSummary)}">
          <span class="text-xs text-zinc-400">${(sale.items || []).length} items:</span> ${escapeHtml(itemsSummary)}
        </td>
        <td class="p-3.5">
          <span class="text-xs px-2 py-0.5 rounded bg-zinc-800 text-white border border-white/20">${sale.paymentMethod || 'Cash'}</span>
          <span class="text-xs ml-1 px-1.5 py-0.5 rounded ${
            sale.paymentStatus === 'Paid' ? 'text-white font-medium' : 'text-zinc-400'
          }">• ${sale.paymentStatus || 'Paid'}</span>
        </td>
        <td class="p-3.5 text-right font-semibold text-white whitespace-nowrap">
          ${formatCurrency(sale.total)}
        </td>
        <td class="p-3.5 text-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="viewSaleReceipt('${sale.id}')" class="p-1.5 text-zinc-400 hover:text-white transition-colors" title="View & Print Invoice">
              <i class="fa-solid fa-receipt"></i>
            </button>
            <button onclick="confirmDeleteSale('${sale.id}', '${sale.invoiceNo}')" class="p-1.5 text-zinc-400 hover:text-rose-400 transition-colors" title="Delete record">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setupFilterListeners() {
  const dateRange = document.getElementById('filterDateRange');
  const paymentMethod = document.getElementById('filterPaymentMethod');
  const paymentStatus = document.getElementById('filterPaymentStatus');
  const searchInput = document.getElementById('searchSalesInput');

  if (dateRange) dateRange.addEventListener('change', renderSalesHistory);
  if (paymentMethod) paymentMethod.addEventListener('change', renderSalesHistory);
  if (paymentStatus) paymentStatus.addEventListener('change', renderSalesHistory);
  if (searchInput) {
    let timeout = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(renderSalesHistory, 250);
    });
  }

  // Export CSV button
  const exportCsvBtn = document.getElementById('exportSalesCsvBtn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportSalesToCSV);
  }

  // Print Daily Report button
  const printReportBtn = document.getElementById('printDailyReportBtn');
  if (printReportBtn) {
    printReportBtn.addEventListener('click', () => {
      window.print();
    });
  }
}

// Export filtered sales to CSV for Excel
async function exportSalesToCSV() {
  const dateRange = document.getElementById('filterDateRange')?.value || 'today';
  const sales = await window.manfitAPI.getSales({ dateRange });

  if (sales.length === 0) {
    showToast('No sales data to export.', 'warning');
    return;
  }

  const headers = ['Invoice No', 'Date & Time', 'Customer Name', 'Phone', 'Items Count', 'Subtotal', 'Discount', 'Tax', 'Total Amount', 'Payment Method', 'Payment Status', 'Alteration Notes'];
  
  const rows = sales.map(s => [
    `"${s.invoiceNo}"`,
    `"${formatDate(s.date)}"`,
    `"${(s.customerName || '').replace(/"/g, '""')}"`,
    `"${s.customerPhone || ''}"`,
    s.items ? s.items.length : 0,
    s.subtotal || 0,
    s.discount || 0,
    s.tax || 0,
    s.total || 0,
    `"${s.paymentMethod || 'Cash'}"`,
    `"${s.paymentStatus || 'Paid'}"`,
    `"${(s.alterationNotes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `MANFIT_Sales_Export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Sales report exported to CSV successfully!', 'success');
}

// --- CUSTOMERS DIRECTORY (CRM) ---
async function renderCustomersList() {
  const customers = await window.manfitAPI.getCustomers();
  const container = document.getElementById('customersTableBody');
  const countLabel = document.getElementById('customerTotalCount');

  if (countLabel) countLabel.innerText = `${customers.length} registered clients`;
  if (!container) return;

  if (customers.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="py-14 text-center text-zinc-500">
          <i class="fa-solid fa-users text-3xl mb-3 text-white/30"></i>
          <p>No customer profiles yet. They are automatically added when you record a sale!</p>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = customers.map(cust => `
    <tr class="border-b border-[#231f1a] hover:bg-[#1a1815] transition-colors text-sm">
      <td class="p-3.5">
        <div class="font-medium text-zinc-100">${escapeHtml(cust.name)}</div>
        <div class="text-xs text-zinc-500">${cust.email || 'No email registered'}</div>
      </td>
      <td class="p-3.5 text-zinc-300 font-mono text-xs">
        ${cust.phone || '—'}
      </td>
      <td class="p-3.5 text-center">
        <span class="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white border border-white/25 font-medium">
          ${cust.ordersCount || 1} orders
        </span>
      </td>
      <td class="p-3.5 text-right font-semibold text-white">
        ${formatCurrency(cust.totalSpent || 0)}
      </td>
      <td class="p-3.5 text-zinc-400 text-xs whitespace-nowrap">
        ${formatDate(cust.lastVisit)}
      </td>
      <td class="p-3.5 text-center">
        <button onclick="viewCustomerSales('${escapeHtml(cust.phone)}', '${escapeHtml(cust.name)}')" 
          class="px-2.5 py-1 text-xs rounded bg-white/10 hover:bg-white hover:text-black text-white transition-colors border border-white/20">
          <i class="fa-solid fa-clock-rotate-left mr-1"></i> Sales
        </button>
      </td>
    </tr>
  `).join('');
}

// --- GARMENTS & INVENTORY CATALOG ---
async function renderInventoryList() {
  const products = await window.manfitAPI.getProducts();
  const container = document.getElementById('inventoryTableBody');
  const countLabel = document.getElementById('inventoryTotalCount');
  const pillsContainer = document.getElementById('inventoryCategoryPills');
  const categoryActionButtons = document.getElementById('categoryActionButtons');
  const deleteCategoryBtn = document.getElementById('deleteCategoryBtn');
  const deleteCategoryBtnText = document.getElementById('deleteCategoryBtnText');

  if (countLabel) {
    countLabel.innerText = `${products.length} garments in catalog`;
  }

  // 1. Gather all unique categories (from standard list & products)
  const existingCategories = Array.from(new Set([
    ...CLOTHING_CATEGORIES,
    ...products.map(p => p.category).filter(Boolean)
  ]));

  // 2. Render Category Filter Pills
  if (pillsContainer) {
    let pillsHtml = `
      <button type="button" onclick="setInventoryCategory('ALL')" 
        class="text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
          activeInventoryCategory === 'ALL'
            ? 'bg-white text-black font-bold border-white shadow-md shadow-white/20'
            : 'bg-[#141414] text-zinc-400 hover:text-white border-white/15 hover:border-white/40'
        }">
        All Garments (${products.length})
      </button>
    `;

    existingCategories.forEach(cat => {
      const count = products.filter(p => p.category === cat).length;
      const isActive = activeInventoryCategory === cat;
      pillsHtml += `
        <button type="button" onclick="setInventoryCategory('${escapeHtml(cat)}')" 
          class="text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
            isActive
              ? 'bg-white text-black font-bold border-white shadow-md shadow-white/20'
              : 'bg-[#141414] text-zinc-400 hover:text-white border-white/15 hover:border-white/40'
          }">
          ${escapeHtml(cat)} (${count})
        </button>
      `;
    });

    pillsContainer.innerHTML = pillsHtml;
  }

  // 3. Category Deletion Action Button
  if (categoryActionButtons && deleteCategoryBtn && deleteCategoryBtnText) {
    if (activeInventoryCategory !== 'ALL') {
      categoryActionButtons.classList.remove('hidden');
      categoryActionButtons.classList.add('flex');
      const catCount = products.filter(p => p.category === activeInventoryCategory).length;
      deleteCategoryBtnText.innerText = `Delete "${activeInventoryCategory}" Category`;
      deleteCategoryBtn.onclick = () => confirmDeleteCategory(activeInventoryCategory, catCount);
    } else {
      categoryActionButtons.classList.add('hidden');
      categoryActionButtons.classList.remove('flex');
    }
  }

  // 4. Filter products for display
  let displayedProducts = products;
  if (activeInventoryCategory !== 'ALL') {
    displayedProducts = products.filter(p => p.category === activeInventoryCategory);
  }

  if (!container) return;

  if (displayedProducts.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="7" class="py-14 text-center text-zinc-500">
          <i class="fa-solid fa-shirt text-3xl mb-3 text-white/30"></i>
          <p class="text-sm">No garments found in ${activeInventoryCategory === 'ALL' ? 'the catalog' : `category "${escapeHtml(activeInventoryCategory)}"`}.</p>
          ${activeInventoryCategory !== 'ALL' ? `
            <p class="text-xs text-zinc-500 mt-1">You can delete this empty category using the "Delete Category" button above.</p>
          ` : ''}
        </td>
      </tr>
    `;
    return;
  }

  // 5. Render Table Rows with Actions (Garment Deletion)
  container.innerHTML = displayedProducts.map(prod => `
    <tr class="border-b border-white/10 hover:bg-white/5 transition-colors text-sm">
      <td class="p-3.5 font-mono text-xs text-white font-semibold">
        ${escapeHtml(prod.sku || 'MF-GEN')}
      </td>
      <td class="p-3.5 font-medium text-white">
        ${escapeHtml(prod.name)}
      </td>
      <td class="p-3.5">
        <span class="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
          ${escapeHtml(prod.category)}
        </span>
      </td>
      <td class="p-3.5 text-xs text-zinc-400">
        ${(prod.sizes || []).map(s => escapeHtml(s)).join(', ') || 'Standard'}
      </td>
      <td class="p-3.5 text-right font-semibold text-white">
        ${formatCurrency(prod.price)}
      </td>
      <td class="p-3.5 text-center">
        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          (prod.stock || 0) <= 5 ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40' :
          'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
        }">
          ${prod.stock || 0} in stock
        </span>
      </td>
      <td class="p-3.5 text-center whitespace-nowrap">
        <button onclick="confirmDeleteGarment('${prod.id}', '${escapeHtml(prod.name).replace(/'/g, "\\'")}', '${escapeHtml(prod.sku || '').replace(/'/g, "\\'")}')" 
          class="px-2.5 py-1 text-xs rounded border border-rose-900/60 bg-rose-950/30 text-rose-300 hover:bg-rose-900/60 hover:text-rose-100 transition-all cursor-pointer flex items-center gap-1 mx-auto"
          title="Delete this garment from catalog">
          <i class="fa-solid fa-trash-can text-[11px]"></i>
          <span>Delete</span>
        </button>
      </td>
    </tr>
  `).join('');
}

// Switch category in Garments Catalog
function setInventoryCategory(cat) {
  activeInventoryCategory = cat;
  renderInventoryList();
}
window.setInventoryCategory = setInventoryCategory;

// Delete single garment from catalog
async function confirmDeleteGarment(id, name, sku) {
  const skuInfo = sku ? ` (${sku})` : '';
  if (confirm(`Are you sure you want to delete "${name}"${skuInfo} from the MANFIT catalog?`)) {
    try {
      await window.manfitAPI.deleteProduct(id);
      showToast(`Garment "${name}" deleted from catalog.`, 'info');
      await loadCatalogForDropdowns();
      await renderInventoryList();
    } catch (err) {
      console.error('Failed to delete garment:', err);
      showToast('Error deleting garment from catalog.', 'error');
    }
  }
}
window.confirmDeleteGarment = confirmDeleteGarment;

// Delete entire garment category & its items
async function confirmDeleteCategory(category, count) {
  const confirmMsg = count > 0
    ? `Are you sure you want to delete category "${category}" and ALL ${count} garment(s) inside it? This cannot be undone.`
    : `Are you sure you want to delete category "${category}"?`;

  if (confirm(confirmMsg)) {
    try {
      // 1. Delete all garments in that category from DBMS
      await window.manfitAPI.deleteProductsByCategory(category);
      
      // 2. Remove category from CLOTHING_CATEGORIES
      CLOTHING_CATEGORIES = CLOTHING_CATEGORIES.filter(c => c !== category);
      localStorage.setItem('manfit_clothing_categories', JSON.stringify(CLOTHING_CATEGORIES));

      showToast(`Category "${category}" deleted successfully!`, 'success');
      activeInventoryCategory = 'ALL';
      await loadCatalogForDropdowns();
      await renderInventoryList();
      updateCategoryDropdowns();
    } catch (err) {
      console.error('Failed to delete category:', err);
      showToast('Error deleting category.', 'error');
    }
  }
}
window.confirmDeleteCategory = confirmDeleteCategory;

// Update category dropdowns in modal and forms
function updateCategoryDropdowns() {
  const newProdCatSelect = document.getElementById('newProdCategory');
  if (newProdCatSelect) {
    const currentVal = newProdCatSelect.value;
    newProdCatSelect.innerHTML = CLOTHING_CATEGORIES.map(cat => 
      `<option value="${escapeHtml(cat)}"${cat === currentVal ? ' selected' : ''}>${escapeHtml(cat)}</option>`
    ).join('');
  }
}
window.updateCategoryDropdowns = updateCategoryDropdowns;

// Quick Add Garment Modal setup
function setupInventoryModal() {
  const addProdBtn = document.getElementById('openAddProductModalBtn');
  const modal = document.getElementById('addProductModal');
  const closeBtn = document.getElementById('closeAddProductModalBtn');
  const form = document.getElementById('addProductForm');

  updateCategoryDropdowns();

  if (addProdBtn && modal) {
    addProdBtn.addEventListener('click', () => {
      updateCategoryDropdowns();
      modal.classList.remove('hidden');
    });
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newProdName').value.trim();
      const category = document.getElementById('newProdCategory').value;
      const sku = document.getElementById('newProdSku').value.trim();
      const price = parseFloat(document.getElementById('newProdPrice').value) || 0;
      const stock = parseInt(document.getElementById('newProdStock').value) || 0;
      const sizesStr = document.getElementById('newProdSizes').value.trim();
      const sizes = sizesStr ? sizesStr.split(',').map(s => s.trim()) : ['Standard'];

      // Ensure category exists in list
      if (!CLOTHING_CATEGORIES.includes(category)) {
        CLOTHING_CATEGORIES.push(category);
        localStorage.setItem('manfit_clothing_categories', JSON.stringify(CLOTHING_CATEGORIES));
      }

      await window.manfitAPI.saveProduct({ name, category, sku, price, stock, sizes });
      showToast(`Garment "${name}" added to MANFIT catalog!`, 'success');
      form.reset();
      modal.classList.add('hidden');
      await loadCatalogForDropdowns();
      await renderInventoryList();
      updateCategoryDropdowns();
    });
  }
}

// --- RECEIPT & INVOICE MODAL ---
async function viewSaleReceipt(saleId) {
  const sale = await window.manfitAPI.getSaleById(saleId);
  if (sale) {
    openReceiptModal(sale);
  } else {
    showToast('Sale record not found.', 'error');
  }
}

function openReceiptModal(sale) {
  const modal = document.getElementById('receiptModal');
  if (!modal) return;

  // Fill receipt fields
  document.getElementById('receiptInvoiceNo').innerText = sale.invoiceNo;
  document.getElementById('receiptDate').innerText = formatDate(sale.date);
  document.getElementById('receiptCustomerName').innerText = sale.customerName || 'Walk-in Client';
  document.getElementById('receiptCustomerPhone').innerText = sale.customerPhone || 'N/A';
  document.getElementById('receiptPaymentMethod').innerText = `${sale.paymentMethod || 'Cash'} (${sale.paymentStatus || 'Paid'})`;

  // Items table
  const itemsContainer = document.getElementById('receiptItemsBody');
  itemsContainer.innerHTML = (sale.items || []).map(item => `
    <tr class="border-b border-zinc-700/40 text-xs">
      <td class="py-2 text-left">
        <div class="font-medium text-zinc-100">${escapeHtml(item.name)}</div>
        <div class="text-[10px] text-zinc-400">Size: ${item.size} • ${item.category}</div>
      </td>
      <td class="py-2 text-center text-zinc-300">${item.quantity}</td>
      <td class="py-2 text-right text-zinc-300">${formatCurrency(item.unitPrice)}</td>
      <td class="py-2 text-right font-medium text-zinc-100">${formatCurrency(item.total)}</td>
    </tr>
  `).join('');

  // Totals
  document.getElementById('receiptSubtotal').innerText = formatCurrency(sale.subtotal || sale.total);
  document.getElementById('receiptDiscount').innerText = sale.discount ? '- ' + formatCurrency(sale.discount) : '₹0';
  document.getElementById('receiptTax').innerText = sale.tax ? '+ ' + formatCurrency(sale.tax) : '₹0';
  document.getElementById('receiptGrandTotal').innerText = formatCurrency(sale.total);

  // Alteration notes
  const notesBox = document.getElementById('receiptAlterationsBox');
  if (sale.alterationNotes) {
    notesBox.classList.remove('hidden');
    document.getElementById('receiptAlterationNotes').innerText = sale.alterationNotes;
  } else {
    notesBox.classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

function closeReceiptModal() {
  const modal = document.getElementById('receiptModal');
  if (modal) modal.classList.add('hidden');
}

async function confirmDeleteSale(id, invoiceNo) {
  if (confirm(`Are you sure you want to delete invoice ${invoiceNo}? This action cannot be undone.`)) {
    await window.manfitAPI.deleteSale(id);
    showToast(`Invoice ${invoiceNo} deleted.`, 'info');
    await renderSalesHistory();
    await renderDashboard();
  }
}

// Customer Past Sales Modal
async function viewCustomerSales(phone, name) {
  const allSales = await window.manfitAPI.getSales();
  const customerSales = allSales.filter(s => s.customerPhone === phone);

  alert(`Customer: ${name} (${phone})\nTotal Transactions: ${customerSales.length}\nTotal Purchases: ${formatCurrency(customerSales.reduce((a, b) => a + (parseFloat(b.total) || 0), 0))}`);
}

// --- SETTINGS & BACKUP ENGINE ---
function setupSettingsListeners() {
  setupInventoryModal();

  // Mode radio buttons
  const modeRadios = document.querySelectorAll('input[name="dbModeRadio"]');
  modeRadios.forEach(radio => {
    radio.addEventListener('change', async (e) => {
      const mode = e.target.value;
      window.manfitAPI.setMode(mode);
      showToast(`Database mode switched to ${mode === 'indexeddb' ? 'Local IndexedDB' : 'Node.js REST API'}`, 'info');
      await updateApiStatusBadge();
    });
  });

  // REST API URL save
  const saveUrlBtn = document.getElementById('saveApiUrlBtn');
  if (saveUrlBtn) {
    saveUrlBtn.addEventListener('click', async () => {
      const url = document.getElementById('restApiUrlInput').value.trim();
      if (url) {
        window.manfitAPI.setMode('rest', url);
        showToast(`API URL updated to: ${url}`, 'success');
        await updateApiStatusBadge();
      }
    });
  }

  // Backup DB Export Button
  const exportDbBtn = document.getElementById('backupDbBtn');
  if (exportDbBtn) {
    exportDbBtn.addEventListener('click', async () => {
      const data = await window.manfitDB.exportEntireDatabase();
      const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
      const a = document.createElement('a');
      a.setAttribute('href', jsonStr);
      a.setAttribute('download', `MANFIT_DB_BACKUP_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Database backup downloaded successfully!', 'success');
    });
  }

  // Restore DB File Input
  const restoreFileInput = document.getElementById('restoreDbFileInput');
  if (restoreFileInput) {
    restoreFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          await window.manfitDB.importEntireDatabase(parsed);
          showToast('Database restored successfully!', 'success');
          setTimeout(() => window.location.reload(), 1200);
        } catch (err) {
          showToast('Failed to restore backup: Invalid JSON file', 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  // Erase All Sales & Reset to MF-2026-001 Button
  const eraseBtn = document.getElementById('eraseAllSalesBtn');
  if (eraseBtn) {
    eraseBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to permanently erase all sales records and customer history? Starting invoice will reset to MF-2026-001.')) {
        await window.manfitAPI.clearAllSales();
        showToast('All sales erased! Sales register reset to start fresh from MF-2026-001.', 'success');
        setTimeout(() => window.location.reload(), 1200);
      }
    });
  }

  // Reset / Seed Sample Data Button
  const seedBtn = document.getElementById('seedSampleDataBtn');
  if (seedBtn) {
    seedBtn.addEventListener('click', async () => {
      if (confirm('This will load realistic sample sales and products for MANFIT. Continue?')) {
        await window.manfitDB.checkAndSeedDefaults(true);
        showToast('Sample clothing sales and inventory loaded!', 'success');
        setTimeout(() => window.location.reload(), 1000);
      }
    });
  }
}

async function loadSettingsView() {
  const currentMode = window.manfitAPI.getMode();
  const currentUrl = window.manfitAPI.baseUrl;

  const modeRadio = document.querySelector(`input[name="dbModeRadio"][value="${currentMode}"]`);
  if (modeRadio) modeRadio.checked = true;

  const urlInput = document.getElementById('restApiUrlInput');
  if (urlInput) urlInput.value = currentUrl;

  await updateApiStatusBadge();
}

async function updateApiStatusBadge() {
  const badge = document.getElementById('apiStatusBadge');
  const serverSection = document.getElementById('restServerSettingsSection');
  if (!badge) return;

  const mode = window.manfitAPI.getMode();
  if (mode === 'indexeddb') {
    badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block animate-pulse mr-1.5"></span> IndexedDB (In-Browser Storage Active)';
    badge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/50';
    if (serverSection) serverSection.classList.add('opacity-60');
  } else {
    if (serverSection) serverSection.classList.remove('opacity-60');
    badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Testing Server...';
    const isHealthy = await window.manfitAPI.checkServerHealth();
    if (isHealthy) {
      badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block mr-1.5"></span> REST Server Online';
      badge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/50';
    } else {
      badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block mr-1.5"></span> REST Server Offline (Fallback to IndexedDB)';
      badge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-rose-950/70 text-rose-300 border border-rose-800/50';
    }
  }
}

// --- UTILITIES: TOAST ALERTS & SANITIZING ---
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const colors = {
    success: 'border-emerald-700/60 bg-[#16221a] text-emerald-200',
    error: 'border-rose-700/60 bg-[#251517] text-rose-200',
    warning: 'border-amber-700/60 bg-[#261e12] text-amber-200',
    info: 'border-white/40 bg-[#141414] text-white'
  };

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg border shadow-2xl text-sm transition-all duration-300 pointer-events-auto transform translate-y-4 opacity-0 ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} text-base"></i>
    <span class="font-medium">${escapeHtml(message)}</span>
  `;

  toastContainer.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  }, 20);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(string) {
  if (!string) return '';
  const div = document.createElement('div');
  div.innerText = string;
  return div.innerHTML;
}

// Global functions for inline HTML attributes & dynamic table rows
window.switchTab = switchTab;
window.viewSaleReceipt = viewSaleReceipt;
window.closeReceiptModal = closeReceiptModal;
window.confirmDeleteSale = confirmDeleteSale;
window.confirmDeleteGarment = confirmDeleteGarment;
window.confirmDeleteCategory = confirmDeleteCategory;
window.setInventoryCategory = setInventoryCategory;
window.viewCustomerSales = viewCustomerSales;
window.exportSalesToCSV = exportSalesToCSV;
window.resetSaleForm = resetSaleForm;
window.addLineItem = addLineItem;
window.showToast = showToast;
