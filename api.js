/**
 * MANFIT Luxury Apparel CRM - Unified API Service Layer
 * Supports switching between Local Browser DBMS (IndexedDB) & Node.js/SQLite REST API
 */

const API_MODE_KEY = 'manfit_api_mode'; // 'indexeddb' or 'rest'
const API_BASE_URL_KEY = 'manfit_api_url';
const DEFAULT_API_URL = 'http://localhost:5000/api';

class ManfitAPIService {
  constructor() {
    this.mode = localStorage.getItem(API_MODE_KEY) || 'indexeddb';
    this.baseUrl = localStorage.getItem(API_BASE_URL_KEY) || DEFAULT_API_URL;
  }

  setMode(mode, url = null) {
    this.mode = mode;
    localStorage.setItem(API_MODE_KEY, mode);
    if (url) {
      this.baseUrl = url;
      localStorage.setItem(API_BASE_URL_KEY, url);
    }
  }

  getMode() {
    return this.mode;
  }

  // --- SALES APIS ---
  async getSales(filters = {}) {
    if (this.mode === 'rest') {
      try {
        const queryParams = new URLSearchParams(filters).toString();
        const res = await fetch(`${this.baseUrl}/sales?${queryParams}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return await res.json();
      } catch (err) {
        console.warn('REST API failed, fallback to local IndexedDB:', err);
      }
    }
    // Fallback or default to IndexedDB
    let sales = await window.manfitDB.getAllSales();

    // Client-side filtering
    if (filters.dateRange) {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      if (filters.dateRange === 'today') {
        sales = sales.filter(s => s.date.startsWith(today));
      } else if (filters.dateRange === 'yesterday') {
        sales = sales.filter(s => s.date.startsWith(yesterday));
      } else if (filters.dateRange === 'week') {
        const weekAgo = new Date(Date.now() - 7 * 86400000);
        sales = sales.filter(s => new Date(s.date) >= weekAgo);
      } else if (filters.dateRange === 'month') {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        sales = sales.filter(s => new Date(s.date) >= monthStart);
      }
    }

    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate + 'T00:00:00');
      const end = new Date(filters.endDate + 'T23:59:59');
      sales = sales.filter(s => {
        const d = new Date(s.date);
        return d >= start && d <= end;
      });
    }

    if (filters.paymentMethod && filters.paymentMethod !== 'all') {
      sales = sales.filter(s => s.paymentMethod === filters.paymentMethod);
    }

    if (filters.paymentStatus && filters.paymentStatus !== 'all') {
      sales = sales.filter(s => s.paymentStatus === filters.paymentStatus);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      sales = sales.filter(s =>
        (s.invoiceNo && s.invoiceNo.toLowerCase().includes(q)) ||
        (s.customerName && s.customerName.toLowerCase().includes(q)) ||
        (s.customerPhone && s.customerPhone.toLowerCase().includes(q)) ||
        (s.items && s.items.some(i => i.name.toLowerCase().includes(q) || (i.category && i.category.toLowerCase().includes(q))))
      );
    }

    return sales;
  }

  async createSale(saleData) {
    if (!saleData.invoiceNo) {
      saleData.invoiceNo = await this.generateNextInvoiceNumber();
    }
    if (!saleData.date) {
      saleData.date = new Date().toISOString();
    }

    if (this.mode === 'rest') {
      try {
        const res = await fetch(`${this.baseUrl}/sales`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saleData)
        });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return await res.json();
      } catch (err) {
        console.warn('REST API save failed, saving to local IndexedDB:', err);
      }
    }

    return await window.manfitDB.saveSale(saleData);
  }

  async getSaleById(id) {
    if (this.mode === 'rest') {
      try {
        const res = await fetch(`${this.baseUrl}/sales/${id}`);
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    return await window.manfitDB.getSaleById(id);
  }

  async deleteSale(id) {
    if (this.mode === 'rest') {
      try {
        const res = await fetch(`${this.baseUrl}/sales/${id}`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (e) {}
    }
    return await window.manfitDB.deleteSale(id);
  }

  async clearAllSales() {
    if (this.mode === 'rest') {
      try {
        await fetch(`${this.baseUrl}/sales/clear-all`, { method: 'POST' });
      } catch (e) {}
    }
    return await window.manfitDB.clearAllSalesAndCustomers();
  }

  // --- CUSTOMER APIS ---
  async getCustomers() {
    if (this.mode === 'rest') {
      try {
        const res = await fetch(`${this.baseUrl}/customers`);
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    return await window.manfitDB.getAllCustomers();
  }

  async saveCustomer(customer) {
    if (this.mode === 'rest') {
      try {
        const res = await fetch(`${this.baseUrl}/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customer)
        });
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    return await window.manfitDB.saveCustomer(customer);
  }

  // --- PRODUCT CATALOG APIS ---
  async getProducts() {
    if (this.mode === 'rest') {
      try {
        const res = await fetch(`${this.baseUrl}/products`);
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    return await window.manfitDB.getAllProducts();
  }

  async saveProduct(product) {
    if (this.mode === 'rest') {
      try {
        const res = await fetch(`${this.baseUrl}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(product)
        });
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    return await window.manfitDB.saveProduct(product);
  }

  async deleteProduct(id) {
    if (this.mode === 'rest') {
      try {
        const res = await fetch(`${this.baseUrl}/products/${id}`, { method: 'DELETE' });
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    return await window.manfitDB.deleteProduct(id);
  }

  async deleteProductsByCategory(category) {
    if (this.mode === 'rest') {
      try {
        const res = await fetch(`${this.baseUrl}/products/category/${encodeURIComponent(category)}`, { method: 'DELETE' });
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    return await window.manfitDB.deleteProductsByCategory(category);
  }

  // --- ANALYTICS / KPI ENGINE ---
  async getAnalyticsSummary() {
    const allSales = await this.getSales();
    const today = new Date().toISOString().split('T')[0];

    const todaySales = allSales.filter(s => s.date.startsWith(today));
    const todayRevenue = todaySales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const todayOrdersCount = todaySales.length;
    const todayItemsCount = todaySales.reduce((sum, s) => {
      return sum + (s.items ? s.items.reduce((iSum, item) => iSum + (parseInt(item.quantity) || 1), 0) : 0);
    }, 0);
    const avgOrderValue = todayOrdersCount > 0 ? (todayRevenue / todayOrdersCount) : 0;

    const totalRevenue = allSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

    // 7 Days Trend
    const last7DaysLabels = [];
    const last7DaysData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      last7DaysLabels.push(`${dayName} (${d.getDate()})`);

      const dayTotal = allSales
        .filter(s => s.date.startsWith(dateStr))
        .reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
      last7DaysData.push(dayTotal);
    }

    // Category Distribution
    const categoryTotals = {};
    allSales.forEach(s => {
      (s.items || []).forEach(item => {
        const cat = item.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (parseFloat(item.total) || 0);
      });
    });

    // Payment Methods Split
    const paymentMethods = { Cash: 0, UPI: 0, Card: 0, Other: 0 };
    allSales.forEach(s => {
      const pm = s.paymentMethod || 'Cash';
      if (paymentMethods.hasOwnProperty(pm)) {
        paymentMethods[pm] += parseFloat(s.total) || 0;
      } else {
        paymentMethods['Other'] += parseFloat(s.total) || 0;
      }
    });

    return {
      todayRevenue,
      todayOrdersCount,
      todayItemsCount,
      avgOrderValue,
      totalRevenue,
      totalOrdersCount: allSales.length,
      trend: {
        labels: last7DaysLabels,
        data: last7DaysData
      },
      categories: categoryTotals,
      paymentMethods
    };
  }

  // --- INVOICE SEQUENCING ---
  async peekNextInvoiceNumber() {
    let lastNum = await window.manfitDB.getSetting('lastInvoiceNum', 0);
    const nextNum = (parseInt(lastNum) || 0) + 1;
    const padded = String(nextNum).padStart(3, '0');
    return `MF-${new Date().getFullYear()}-${padded}`;
  }

  async generateNextInvoiceNumber() {
    let lastNum = await window.manfitDB.getSetting('lastInvoiceNum', 0);
    const nextNum = (parseInt(lastNum) || 0) + 1;
    await window.manfitDB.setSetting('lastInvoiceNum', nextNum);
    const padded = String(nextNum).padStart(3, '0');
    return `MF-${new Date().getFullYear()}-${padded}`;
  }

  // --- HEALTH CHECK FOR REST SERVER ---
  async checkServerHealth(url = null) {
    const targetUrl = url || this.baseUrl;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${targetUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok;
    } catch (e) {
      return false;
    }
  }
}

// Export singleton instance
window.manfitAPI = new ManfitAPIService();
