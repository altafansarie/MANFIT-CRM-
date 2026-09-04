/**
 * MANFIT Luxury CRM - High-Resilience Database Layer
 * Primary: In-Browser IndexedDB
 * Fallback: LocalStorage / Memory Store (Ensures 100% operation even in strict/private browsers, GitHub Pages, or if IndexedDB is restricted)
 */

const DB_NAME = 'ManfitCRM_DB';
const DB_VERSION = 1;

const DEFAULT_SAMPLE_PRODUCTS = [
  { id: 'prod_1', name: 'Italian Slim Fit Charcoal Suit', category: 'Suits', sku: 'MF-SUIT-01', price: 14500, stock: 18, sizes: ['38', '40', '42', '44'] },
  { id: 'prod_2', name: 'Royal Navy Blazer (Brass Buttons)', category: 'Blazers', sku: 'MF-BLZ-02', price: 8900, stock: 24, sizes: ['38', '40', '42'] },
  { id: 'prod_3', name: 'Egyptian Giza Cotton Formal Shirt', category: 'Formal Shirts', sku: 'MF-SHT-03', price: 2800, stock: 45, sizes: ['39', '40', '42', '44'] },
  { id: 'prod_4', name: 'Classic Khaki Chino Trousers', category: 'Trousers', sku: 'MF-TRS-04', price: 2400, stock: 32, sizes: ['30', '32', '34', '36'] },
  { id: 'prod_5', name: 'Raw Silk Festive Kurta & Jacket', category: 'Ethnic Wear', sku: 'MF-ETH-05', price: 9500, stock: 12, sizes: ['M', 'L', 'XL'] },
  { id: 'prod_6', name: 'Premium Oxford Casual Button-down', category: 'Casual Shirts', sku: 'MF-CSH-06', price: 2200, stock: 38, sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'prod_7', name: 'Handcrafted Italian Leather Belt', category: 'Accessories', sku: 'MF-ACC-07', price: 1800, stock: 50, sizes: ['Free Size'] },
  { id: 'prod_8', name: 'Pure Silk Jacquard Necktie & Cufflinks', category: 'Accessories', sku: 'MF-ACC-08', price: 1500, stock: 40, sizes: ['Standard'] }
];

class IndexedDBStorage {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.useFallback = false;
    this.memoryStore = {
      sales: [],
      customers: [],
      products: [...DEFAULT_SAMPLE_PRODUCTS],
      settings: { db_seeded: true, lastInvoiceNum: 0 }
    };
  }

  // Safe LocalStorage helpers for fallback
  _lsGet(key, def = null) {
    try {
      const val = localStorage.getItem('manfit_db_' + key);
      return val ? JSON.parse(val) : def;
    } catch (e) {
      return this.memoryStore[key] || def;
    }
  }

  _lsSet(key, val) {
    this.memoryStore[key] = val;
    try {
      localStorage.setItem('manfit_db_' + key, JSON.stringify(val));
    } catch (e) {}
  }

  async init() {
    if (this.isReady) return this.db || this;

    // Check if IndexedDB exists in browser environment
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB not available in this environment. Falling back to LocalStorage.');
      this.useFallback = true;
      this.isReady = true;
      return this;
    }

    return new Promise((resolve) => {
      let resolved = false;

      // Safety timeout: if IndexedDB hangs or is blocked, fallback immediately within 2 seconds
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          console.warn('IndexedDB initialization timed out. Switching to LocalStorage fallback.');
          this.useFallback = true;
          this.isReady = true;
          resolved = true;
          resolve(this);
        }
      }, 2000);

      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          if (!db.objectStoreNames.contains('sales')) {
            const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
            salesStore.createIndex('invoiceNo', 'invoiceNo', { unique: true });
            salesStore.createIndex('date', 'date', { unique: false });
            salesStore.createIndex('customerId', 'customerId', { unique: false });
            salesStore.createIndex('customerPhone', 'customerPhone', { unique: false });
            salesStore.createIndex('paymentStatus', 'paymentStatus', { unique: false });
            salesStore.createIndex('paymentMethod', 'paymentMethod', { unique: false });
          }

          if (!db.objectStoreNames.contains('customers')) {
            const customersStore = db.createObjectStore('customers', { keyPath: 'id' });
            customersStore.createIndex('phone', 'phone', { unique: true });
            customersStore.createIndex('name', 'name', { unique: false });
            customersStore.createIndex('totalSpent', 'totalSpent', { unique: false });
          }

          if (!db.objectStoreNames.contains('products')) {
            const productsStore = db.createObjectStore('products', { keyPath: 'id' });
            productsStore.createIndex('sku', 'sku', { unique: false });
            productsStore.createIndex('category', 'category', { unique: false });
            productsStore.createIndex('name', 'name', { unique: false });
          }

          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        };

        request.onsuccess = (event) => {
          clearTimeout(timeoutId);
          this.db = event.target.result;
          this.isReady = true;
          this.useFallback = false;

          // Database ready! Resolve promise immediately
          if (!resolved) {
            resolved = true;
            resolve(this.db);
          }

          // Run defaults seeding safely in background
          this.checkAndSeedDefaults().catch(err => {
            console.warn('Seeding background notice:', err);
          });
        };

        request.onerror = (event) => {
          clearTimeout(timeoutId);
          console.warn('IndexedDB open error, using LocalStorage fallback:', event.target ? event.target.error : event);
          this.useFallback = true;
          this.isReady = true;
          if (!resolved) {
            resolved = true;
            resolve(this);
          }
        };

        request.onblocked = () => {
          clearTimeout(timeoutId);
          console.warn('IndexedDB blocked by other tab, using fallback.');
          this.useFallback = true;
          this.isReady = true;
          if (!resolved) {
            resolved = true;
            resolve(this);
          }
        };
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn('IndexedDB throw exception, using fallback:', err);
        this.useFallback = true;
        this.isReady = true;
        if (!resolved) {
          resolved = true;
          resolve(this);
        }
      }
    });
  }

  _getTransaction(storeName, mode = 'readonly') {
    if (this.useFallback || !this.db) return null;
    try {
      const tx = this.db.transaction(storeName, mode);
      return tx.objectStore(storeName);
    } catch (e) {
      console.warn(`Failed to create transaction for ${storeName}, falling back:`, e);
      return null;
    }
  }

  // --- CRUD FOR SALES ---
  async getAllSales() {
    await this.init();
    if (this.useFallback || !this.db) {
      const list = this._lsGet('sales', []);
      return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    return new Promise((resolve) => {
      try {
        const store = this._getTransaction('sales', 'readonly');
        if (!store) return resolve(this._lsGet('sales', []));

        const request = store.getAll();
        request.onsuccess = () => {
          const sorted = (request.result || []).sort((a, b) => new Date(b.date) - new Date(a.date));
          resolve(sorted);
        };
        request.onerror = () => resolve(this._lsGet('sales', []));
      } catch (e) {
        resolve(this._lsGet('sales', []));
      }
    });
  }

  async getSaleById(id) {
    await this.init();
    if (this.useFallback || !this.db) {
      const list = this._lsGet('sales', []);
      return list.find(s => s.id === id) || null;
    }

    return new Promise((resolve) => {
      try {
        const store = this._getTransaction('sales', 'readonly');
        if (!store) return resolve(null);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async saveSale(sale) {
    await this.init();
    if (!sale.id) {
      sale.id = 'sale_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }
    if (!sale.createdAt) {
      sale.createdAt = new Date().toISOString();
    }

    // Always update fallback copy
    const fallbackList = this._lsGet('sales', []);
    const idx = fallbackList.findIndex(s => s.id === sale.id);
    if (idx >= 0) fallbackList[idx] = sale;
    else fallbackList.unshift(sale);
    this._lsSet('sales', fallbackList);

    await this._updateCustomerStats(sale.customerPhone, sale.customerName, sale.total);

    if (this.useFallback || !this.db) {
      return sale;
    }

    return new Promise((resolve) => {
      try {
        const store = this._getTransaction('sales', 'readwrite');
        if (!store) return resolve(sale);
        const request = store.put(sale);
        request.onsuccess = () => resolve(sale);
        request.onerror = () => resolve(sale);
      } catch (e) {
        resolve(sale);
      }
    });
  }

  async deleteSale(id) {
    await this.init();
    const fallbackList = this._lsGet('sales', []).filter(s => s.id !== id);
    this._lsSet('sales', fallbackList);

    if (this.useFallback || !this.db) return true;

    return new Promise((resolve) => {
      try {
        const store = this._getTransaction('sales', 'readwrite');
        if (!store) return resolve(true);
        const request = store.delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(true);
      } catch (e) {
        resolve(true);
      }
    });
  }

  // --- CRUD FOR CUSTOMERS ---
  async getAllCustomers() {
    await this.init();
    if (this.useFallback || !this.db) {
      const list = this._lsGet('customers', []);
      return list.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
    }

    return new Promise((resolve) => {
      try {
        const store = this._getTransaction('customers', 'readonly');
        if (!store) return resolve(this._lsGet('customers', []));
        const request = store.getAll();
        request.onsuccess = () => {
          const list = (request.result || []).sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
          resolve(list);
        };
        request.onerror = () => resolve(this._lsGet('customers', []));
      } catch (e) {
        resolve(this._lsGet('customers', []));
      }
    });
  }

  async saveCustomer(customer) {
    await this.init();
    if (!customer.id) {
      customer.id = 'cust_' + Date.now();
    }

    const fallbackList = this._lsGet('customers', []);
    const idx = fallbackList.findIndex(c => c.id === customer.id || (c.phone && c.phone === customer.phone));
    if (idx >= 0) fallbackList[idx] = customer;
    else fallbackList.push(customer);
    this._lsSet('customers', fallbackList);

    if (this.useFallback || !this.db) return customer;

    return new Promise((resolve) => {
      try {
        const store = this._getTransaction('customers', 'readwrite');
        if (!store) return resolve(customer);
        const request = store.put(customer);
        request.onsuccess = () => resolve(customer);
        request.onerror = () => resolve(customer);
      } catch (e) {
        resolve(customer);
      }
    });
  }

  async getCustomerByPhone(phone) {
    await this.init();
    const fallbackList = this._lsGet('customers', []);
    const found = fallbackList.find(c => c.phone === phone);
    if (found) return found;

    if (this.useFallback || !this.db) return null;

    return new Promise((resolve) => {
      try {
        const store = this._getTransaction('customers', 'readonly');
        if (!store) return resolve(null);
        const index = store.index('phone');
        const request = index.get(phone);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async _updateCustomerStats(phone, name, saleAmount) {
    if (!phone) return;
    try {
      let customer = await this.getCustomerByPhone(phone);
      if (!customer) {
        customer = {
          id: 'cust_' + Date.now(),
          name: name || 'Guest Customer',
          phone: phone,
          ordersCount: 1,
          totalSpent: parseFloat(saleAmount) || 0,
          firstVisit: new Date().toISOString(),
          lastVisit: new Date().toISOString()
        };
      } else {
        customer.ordersCount = (customer.ordersCount || 0) + 1;
        customer.totalSpent = (customer.totalSpent || 0) + (parseFloat(saleAmount) || 0);
        customer.lastVisit = new Date().toISOString();
        if (name && (!customer.name || customer.name === 'Guest Customer')) {
          customer.name = name;
        }
      }
      await this.saveCustomer(customer);
    } catch (e) {
      console.warn('Could not update customer record:', e);
    }
  }

  // --- CRUD FOR PRODUCTS / CATALOG ---
  async getAllProducts() {
    await this.init();
    if (this.useFallback || !this.db) {
      const list = this._lsGet('products', null);
      return list && list.length ? list : DEFAULT_SAMPLE_PRODUCTS;
    }

    return new Promise((resolve) => {
      try {
        const store = this._getTransaction('products', 'readonly');
        if (!store) {
          const fb = this._lsGet('products', null);
          return resolve(fb && fb.length ? fb : DEFAULT_SAMPLE_PRODUCTS);
        }
        const request = store.getAll();
        request.onsuccess = () => {
          const list = request.result || [];
          if (list.length === 0) {
            const fb = this._lsGet('products', null);
            return resolve(fb && fb.length ? fb : DEFAULT_SAMPLE_PRODUCTS);
          }
          resolve(list);
        };
        request.onerror = () => {
          const fb = this._lsGet('products', null);
          resolve(fb && fb.length ? fb : DEFAULT_SAMPLE_PRODUCTS);
        };
      } catch (e) {
        const fb = this._lsGet('products', null);
        resolve(fb && fb.length ? fb : DEFAULT_SAMPLE_PRODUCTS);
      }
    });
  }

  async saveProduct(product) {
    await this.init();
    if (!product.id) {
      product.id = 'prod_' + Date.now();
    }

    const fallbackList = this._lsGet('products', [...DEFAULT_SAMPLE_PRODUCTS]);
    const idx = fallbackList.findIndex(p => p.id === product.id);
    if (idx >= 0) fallbackList[idx] = product;
    else fallbackList.push(product);
    this._lsSet('products', fallbackList);

    if (this.useFallback || !this.db) return product;

    return new Promise((resolve) => {
      try {
        const store = this._getTransaction('products', 'readwrite');
        if (!store) return resolve(product);
        const request = store.put(product);
        request.onsuccess = () => resolve(product);
        request.onerror = () => resolve(product);
      } catch (e) {
        resolve(product);
      }
    });
  }

  async deleteProduct(id) {
    await this.init();
    const fallbackList = this._lsGet('products', [...DEFAULT_SAMPLE_PRODUCTS]).filter(p => p.id !== id);
    this._lsSet('products', fallbackList);

    if (this.useFallback || !this.db) return true;

    return new Promise((resolve) => {
      try {
        const store = this._getTransaction('products', 'readwrite');
        if (!store) return resolve(true);
        const request = store.delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(true);
      } catch (e) {
        resolve(true);
      }
    });
  }

  async deleteProductsByCategory(category) {
    await this.init();
    const fallbackList = this._lsGet('products', [...DEFAULT_SAMPLE_PRODUCTS]).filter(p => p.category !== category);
    this._lsSet('products', fallbackList);

    const all = await this.getAllProducts();
    const toDelete = all.filter(p => p.category === category);
    if (toDelete.length === 0 || this.useFallback || !this.db) return true;

    return new Promise((resolve) => {
      try {
        const store = this._getTransaction('products', 'readwrite');
        if (!store) return resolve(true);
        let count = 0;
        toDelete.forEach(p => {
          const req = store.delete(p.id);
          req.onsuccess = () => {
            count++;
            if (count === toDelete.length) resolve(true);
          };
          req.onerror = () => resolve(true);
        });
      } catch (e) {
        resolve(true);
      }
    });
  }

  // --- SETTINGS & BACKUP ---
  async getSetting(key, defaultValue = null) {
    await this.init();
    const settings = this._lsGet('settings', {});
    if (settings.hasOwnProperty(key)) return settings[key];

    if (this.useFallback || !this.db) return defaultValue;

    return new Promise((resolve) => {
      try {
        const store = this._getTransaction('settings', 'readonly');
        if (!store) return resolve(defaultValue);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : defaultValue);
        request.onerror = () => resolve(defaultValue);
      } catch (e) {
        resolve(defaultValue);
      }
    });
  }

  async setSetting(key, value) {
    await this.init();
    const settings = this._lsGet('settings', {});
    settings[key] = value;
    this._lsSet('settings', settings);

    if (this.useFallback || !this.db) return true;

    return new Promise((resolve) => {
      try {
        const store = this._getTransaction('settings', 'readwrite');
        if (!store) return resolve(true);
        const request = store.put({ key, value });
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(true);
      } catch (e) {
        resolve(true);
      }
    });
  }

  async exportEntireDatabase() {
    const sales = await this.getAllSales();
    const customers = await this.getAllCustomers();
    const products = await this.getAllProducts();
    return {
      appName: 'MANFIT CRM',
      exportDate: new Date().toISOString(),
      sales,
      customers,
      products
    };
  }

  async importEntireDatabase(data) {
    if (!data || !data.sales) throw new Error('Invalid backup file format');
    await this.init();

    this._lsSet('sales', data.sales || []);
    if (data.customers) this._lsSet('customers', data.customers);
    if (data.products) this._lsSet('products', data.products);

    if (this.useFallback || !this.db) return true;

    try {
      const clearStore = (storeName) => new Promise((resolve) => {
        try {
          const tx = this.db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        } catch (e) { resolve(); }
      });

      const addItems = (storeName, items) => new Promise((resolve) => {
        if (!items || items.length === 0) return resolve();
        try {
          const tx = this.db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          items.forEach(item => store.put(item));
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch (e) { resolve(); }
      });

      await clearStore('sales');
      await clearStore('customers');
      await clearStore('products');

      await addItems('sales', data.sales);
      if (data.customers) await addItems('customers', data.customers);
      if (data.products) await addItems('products', data.products);
    } catch (e) {}

    return true;
  }

  async clearAllSalesAndCustomers() {
    await this.init();
    this._lsSet('sales', []);
    this._lsSet('customers', []);
    await this.setSetting('lastInvoiceNum', 0);
    await this.setSetting('db_seeded', true);

    if (this.useFallback || !this.db) {
      console.log('All sales and customers wiped clean (Fallback store). Starting fresh from MF-2026-001.');
      return true;
    }

    try {
      const clearStore = (storeName) => new Promise((resolve) => {
        try {
          const tx = this.db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        } catch (e) { resolve(); }
      });

      await clearStore('sales');
      await clearStore('customers');
    } catch (e) {}

    console.log('All sales and customers wiped clean. Starting fresh from MF-2026-001.');
    return true;
  }

  async checkAndSeedDefaults(force = false) {
    try {
      // 1. One-time cleanup check
      let cleaned = false;
      try {
        cleaned = localStorage.getItem('manfit_sales_cleaned_v3') === 'done';
      } catch (e) {}

      if (!cleaned) {
        await this.clearAllSalesAndCustomers();
        try {
          localStorage.setItem('manfit_sales_cleaned_v3', 'done');
        } catch (e) {}
      }

      // 2. Check if products exist
      const existingProducts = await this.getAllProducts();
      if (!existingProducts || existingProducts.length === 0) {
        console.log('Initializing MANFIT default catalog products...');
        for (const prod of DEFAULT_SAMPLE_PRODUCTS) {
          await this.saveProduct(prod);
        }
      }

      await this.setSetting('db_seeded', true);
    } catch (err) {
      console.warn('checkAndSeedDefaults safely handled:', err);
    }
  }
}

// Export singleton instance
window.manfitDB = new IndexedDBStorage();
