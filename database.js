/**
 * MANFIT Luxury CRM - Backend DBMS Driver
 * Features dual-layer storage:
 * 1. Native Node.js SQLite Database (`manfit.db`) if supported by Node runtime
 * 2. Or resilient File-based Persistent JSON DBMS (`manfit_db.json`)
 */

const fs = require('fs');
const path = require('path');

class ManfitDatabase {
  constructor() {
    this.dbType = 'json'; // 'sqlite' or 'json'
    this.dbFilePath = path.join(__dirname, 'manfit.db');
    this.jsonFilePath = path.join(__dirname, 'manfit_db.json');
    this.sqliteDb = null;
    this.inMemoryData = {
      sales: [],
      customers: [],
      products: [],
      settings: {}
    };
  }

  async init() {
    // Try to load Node's native SQLite (Node v22.5+)
    try {
      const sqlite = require('node:sqlite');
      if (sqlite && sqlite.DatabaseSync) {
        this.sqliteDb = new sqlite.DatabaseSync(this.dbFilePath);
        this.dbType = 'sqlite';
        this.initSqliteTables();
        console.log('✓ SQLite DBMS successfully initialized at:', this.dbFilePath);
        return;
      }
    } catch (e) {
      // Native sqlite not present or failed, fall back to JSON
    }

    // Fallback: Persistent JSON database
    this.dbType = 'json';
    if (fs.existsSync(this.jsonFilePath)) {
      try {
        const raw = fs.readFileSync(this.jsonFilePath, 'utf8');
        this.inMemoryData = JSON.parse(raw);
      } catch (err) {
        console.warn('Error reading existing JSON DB, reinitializing:', err);
      }
    } else {
      this.seedInitialData();
      this.saveJsonDb();
    }
    console.log('✓ JSON DBMS initialized at:', this.jsonFilePath);
  }

  initSqliteTables() {
    this.sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        invoiceNo TEXT UNIQUE,
        date TEXT,
        customerName TEXT,
        customerPhone TEXT,
        items TEXT,
        subtotal REAL,
        discount REAL,
        tax REAL,
        total REAL,
        paymentMethod TEXT,
        paymentStatus TEXT,
        alterationNotes TEXT,
        salesperson TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT UNIQUE,
        email TEXT,
        ordersCount INTEGER DEFAULT 0,
        totalSpent REAL DEFAULT 0,
        firstVisit TEXT,
        lastVisit TEXT
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT,
        category TEXT,
        sku TEXT UNIQUE,
        price REAL,
        stock INTEGER,
        sizes TEXT
      );
    `);

    // Check if products empty and seed catalog
    const stmt = this.sqliteDb.prepare("SELECT COUNT(*) as count FROM products");
    const countRow = stmt.get();
    if (countRow.count === 0) {
      this.seedSqliteData();
    }
  }

  seedSqliteData() {
    console.log('Seeding SQLite database with MANFIT initial products catalog...');
    const insertProduct = this.sqliteDb.prepare(`
      INSERT OR IGNORE INTO products (id, name, category, sku, price, stock, sizes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const products = [
      ['prod_1', 'Italian Slim Fit Charcoal Suit', 'Suits', 'MF-SUIT-01', 14500, 18, JSON.stringify(['38', '40', '42', '44'])],
      ['prod_2', 'Royal Navy Blazer (Brass Buttons)', 'Blazers', 'MF-BLZ-02', 8900, 24, JSON.stringify(['38', '40', '42'])],
      ['prod_3', 'Egyptian Giza Cotton Formal Shirt', 'Formal Shirts', 'MF-SHT-03', 2800, 45, JSON.stringify(['39', '40', '42', '44'])],
      ['prod_4', 'Classic Khaki Chino Trousers', 'Trousers', 'MF-TRS-04', 2400, 32, JSON.stringify(['30', '32', '34', '36'])],
      ['prod_5', 'Raw Silk Festive Kurta & Jacket', 'Ethnic Wear', 'MF-ETH-05', 9500, 12, JSON.stringify(['M', 'L', 'XL'])],
      ['prod_6', 'Handcrafted Italian Leather Belt', 'Accessories', 'MF-ACC-07', 1800, 50, JSON.stringify(['Free Size'])]
    ];

    for (const p of products) {
      insertProduct.run(...p);
    }
  }

  seedInitialData() {
    this.inMemoryData = {
      products: [
        { id: 'prod_1', name: 'Italian Slim Fit Charcoal Suit', category: 'Suits', sku: 'MF-SUIT-01', price: 14500, stock: 18, sizes: ['38', '40', '42', '44'] },
        { id: 'prod_2', name: 'Royal Navy Blazer (Brass Buttons)', category: 'Blazers', sku: 'MF-BLZ-02', price: 8900, stock: 24, sizes: ['38', '40', '42'] },
        { id: 'prod_3', name: 'Egyptian Giza Cotton Formal Shirt', category: 'Formal Shirts', sku: 'MF-SHT-03', price: 2800, stock: 45, sizes: ['39', '40', '42', '44'] },
        { id: 'prod_4', name: 'Classic Khaki Chino Trousers', category: 'Trousers', sku: 'MF-TRS-04', price: 2400, stock: 32, sizes: ['30', '32', '34', '36'] }
      ],
      customers: [],
      sales: [],
      settings: { lastInvoiceNum: 0 }
    };
  }

  clearAllSalesAndCustomers() {
    if (this.dbType === 'sqlite') {
      this.sqliteDb.exec("DELETE FROM sales; DELETE FROM customers;");
      return true;
    }
    this.inMemoryData.sales = [];
    this.inMemoryData.customers = [];
    if (this.inMemoryData.settings) {
      this.inMemoryData.settings.lastInvoiceNum = 0;
    }
    this.saveJsonDb();
    return true;
  }

  saveJsonDb() {
    if (this.dbType === 'json') {
      try {
        fs.writeFileSync(this.jsonFilePath, JSON.stringify(this.inMemoryData, null, 2), 'utf8');
      } catch (e) {
        console.error('Error saving JSON DB file:', e);
      }
    }
  }

  // --- SALES OPERATIONS ---
  getAllSales() {
    if (this.dbType === 'sqlite') {
      const rows = this.sqliteDb.prepare("SELECT * FROM sales ORDER BY date DESC").all();
      return rows.map(r => ({
        ...r,
        items: r.items ? JSON.parse(r.items) : []
      }));
    }
    return [...this.inMemoryData.sales].sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  getSaleById(id) {
    if (this.dbType === 'sqlite') {
      const row = this.sqliteDb.prepare("SELECT * FROM sales WHERE id = ?").get(id);
      if (!row) return null;
      return { ...row, items: row.items ? JSON.parse(row.items) : [] };
    }
    return this.inMemoryData.sales.find(s => s.id === id) || null;
  }

  createSale(sale) {
    if (!sale.id) {
      sale.id = 'sale_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }
    if (!sale.createdAt) {
      sale.createdAt = new Date().toISOString();
    }

    if (this.dbType === 'sqlite') {
      const stmt = this.sqliteDb.prepare(`
        INSERT INTO sales (id, invoiceNo, date, customerName, customerPhone, items, subtotal, discount, tax, total, paymentMethod, paymentStatus, alterationNotes, salesperson, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        sale.id,
        sale.invoiceNo,
        sale.date,
        sale.customerName,
        sale.customerPhone,
        JSON.stringify(sale.items || []),
        sale.subtotal || 0,
        sale.discount || 0,
        sale.tax || 0,
        sale.total || 0,
        sale.paymentMethod || 'Cash',
        sale.paymentStatus || 'Paid',
        sale.alterationNotes || '',
        sale.salesperson || '',
        sale.createdAt
      );
    } else {
      this.inMemoryData.sales.unshift(sale);
      this.saveJsonDb();
    }

    // Auto-update customer
    this.updateCustomerStats(sale.customerPhone, sale.customerName, sale.total);
    return sale;
  }

  deleteSale(id) {
    if (this.dbType === 'sqlite') {
      this.sqliteDb.prepare("DELETE FROM sales WHERE id = ?").run(id);
      return true;
    }
    this.inMemoryData.sales = this.inMemoryData.sales.filter(s => s.id !== id);
    this.saveJsonDb();
    return true;
  }

  // --- CUSTOMER OPERATIONS ---
  getAllCustomers() {
    if (this.dbType === 'sqlite') {
      return this.sqliteDb.prepare("SELECT * FROM customers ORDER BY totalSpent DESC").all();
    }
    return [...this.inMemoryData.customers].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
  }

  updateCustomerStats(phone, name, amount) {
    if (!phone) return;
    const now = new Date().toISOString();
    const spent = parseFloat(amount) || 0;

    if (this.dbType === 'sqlite') {
      const existing = this.sqliteDb.prepare("SELECT * FROM customers WHERE phone = ?").get(phone);
      if (existing) {
        this.sqliteDb.prepare(`
          UPDATE customers 
          SET ordersCount = ordersCount + 1, totalSpent = totalSpent + ?, lastVisit = ?, name = COALESCE(?, name)
          WHERE phone = ?
        `).run(spent, now, name, phone);
      } else {
        this.sqliteDb.prepare(`
          INSERT INTO customers (id, name, phone, email, ordersCount, totalSpent, firstVisit, lastVisit)
          VALUES (?, ?, ?, ?, 1, ?, ?, ?)
        `).run('cust_' + Date.now(), name || 'Walk-in Guest', phone, '', spent, now, now);
      }
      return;
    }

    let cust = this.inMemoryData.customers.find(c => c.phone === phone);
    if (cust) {
      cust.ordersCount = (cust.ordersCount || 0) + 1;
      cust.totalSpent = (cust.totalSpent || 0) + spent;
      cust.lastVisit = now;
      if (name && (!cust.name || cust.name === 'Walk-in Guest')) cust.name = name;
    } else {
      this.inMemoryData.customers.push({
        id: 'cust_' + Date.now(),
        name: name || 'Walk-in Guest',
        phone,
        email: '',
        ordersCount: 1,
        totalSpent: spent,
        firstVisit: now,
        lastVisit: now
      });
    }
    this.saveJsonDb();
  }

  // --- PRODUCT OPERATIONS ---
  getAllProducts() {
    if (this.dbType === 'sqlite') {
      const rows = this.sqliteDb.prepare("SELECT * FROM products").all();
      return rows.map(r => ({
        ...r,
        sizes: r.sizes ? JSON.parse(r.sizes) : []
      }));
    }
    return this.inMemoryData.products;
  }

  saveProduct(prod) {
    if (!prod.id) prod.id = 'prod_' + Date.now();
    if (this.dbType === 'sqlite') {
      const stmt = this.sqliteDb.prepare(`
        INSERT OR REPLACE INTO products (id, name, category, sku, price, stock, sizes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        prod.id,
        prod.name,
        prod.category,
        prod.sku || '',
        prod.price || 0,
        prod.stock || 0,
        JSON.stringify(prod.sizes || [])
      );
    } else {
      const idx = this.inMemoryData.products.findIndex(p => p.id === prod.id);
      if (idx >= 0) {
        this.inMemoryData.products[idx] = prod;
      } else {
        this.inMemoryData.products.push(prod);
      }
      this.saveJsonDb();
    }
    return prod;
  }

  deleteProduct(id) {
    if (this.dbType === 'sqlite') {
      this.sqliteDb.prepare("DELETE FROM products WHERE id = ?").run(id);
    } else {
      this.inMemoryData.products = this.inMemoryData.products.filter(p => p.id !== id);
      this.saveJsonDb();
    }
    return true;
  }

  deleteProductsByCategory(category) {
    if (this.dbType === 'sqlite') {
      this.sqliteDb.prepare("DELETE FROM products WHERE category = ?").run(category);
    } else {
      this.inMemoryData.products = this.inMemoryData.products.filter(p => p.category !== category);
      this.saveJsonDb();
    }
    return true;
  }
}

module.exports = new ManfitDatabase();
