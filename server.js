/**
 * MANFIT Luxury CRM - REST API Backend Server
 * Compatible with Express OR built-in Node.js HTTP (Zero-dependency capability)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const db = require('./database');

const PORT = process.env.PORT || 5000;
const FRONTEND_DIR = path.join(__dirname, '..');

// Initialize database
db.init();

// MIME Types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// CORS Headers helper
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// JSON Response helper
function sendJson(res, statusCode, data) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Read body helper
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Create Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // --- REST API ROUTES ---
  if (pathname.startsWith('/api/')) {
    try {
      // Health check
      if (pathname === '/api/health') {
        return sendJson(res, 200, { status: 'online', shop: 'MANFIT', dbType: db.dbType });
      }

      // Sales API
      if (pathname === '/api/sales') {
        if (method === 'GET') {
          let sales = db.getAllSales();
          const q = parsedUrl.query;
          if (q.search) {
            const term = q.search.toLowerCase();
            sales = sales.filter(s =>
              (s.invoiceNo && s.invoiceNo.toLowerCase().includes(term)) ||
              (s.customerName && s.customerName.toLowerCase().includes(term)) ||
              (s.customerPhone && s.customerPhone.includes(term))
            );
          }
          return sendJson(res, 200, sales);
        }

        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const newSale = db.createSale(body);
          return sendJson(res, 201, newSale);
        }
      }

      if (pathname.startsWith('/api/sales/') && method === 'GET') {
        const id = pathname.replace('/api/sales/', '');
        const sale = db.getSaleById(id);
        if (sale) return sendJson(res, 200, sale);
        return sendJson(res, 404, { error: 'Sale not found' });
      }

      if (pathname.startsWith('/api/sales/') && method === 'DELETE') {
        const id = pathname.replace('/api/sales/', '');
        db.deleteSale(id);
        return sendJson(res, 200, { success: true, message: 'Sale deleted' });
      }

      if (pathname === '/api/sales/clear-all' && method === 'POST') {
        db.clearAllSalesAndCustomers();
        return sendJson(res, 200, { success: true, message: 'All sales and customers cleared' });
      }

      // Customers API
      if (pathname === '/api/customers' && method === 'GET') {
        const customers = db.getAllCustomers();
        return sendJson(res, 200, customers);
      }

      // Products API
      if (pathname === '/api/products') {
        if (method === 'GET') {
          const products = db.getAllProducts();
          return sendJson(res, 200, products);
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const saved = db.saveProduct(body);
          return sendJson(res, 201, saved);
        }
      }

      if (pathname.startsWith('/api/products/category/') && method === 'DELETE') {
        const cat = decodeURIComponent(pathname.replace('/api/products/category/', ''));
        db.deleteProductsByCategory(cat);
        return sendJson(res, 200, { success: true, message: `Garments in category ${cat} deleted` });
      }

      if (pathname.startsWith('/api/products/') && method === 'DELETE') {
        const id = pathname.replace('/api/products/', '');
        db.deleteProduct(id);
        return sendJson(res, 200, { success: true, message: 'Garment deleted' });
      }

      return sendJson(res, 404, { error: 'Endpoint not found' });
    } catch (err) {
      console.error('API Error:', err);
      return sendJson(res, 500, { error: 'Internal server error', details: err.message });
    }
  }

  // --- STATIC FRONTEND ASSETS ---
  let filePath = pathname === '/' ? path.join(FRONTEND_DIR, 'index.html') : path.join(FRONTEND_DIR, pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA
        fs.readFile(path.join(FRONTEND_DIR, 'index.html'), (spaErr, spaContent) => {
          if (spaErr) {
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(spaContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`  ★ MANFIT HAUTE COUTURE CRM IS LIVE ★`);
  console.log(`  Local Computer: http://localhost:${PORT}`);
  console.log(`  Mobile / Wi-Fi: http://10.13.128.147:${PORT}`);
  console.log(`  REST API:       http://localhost:${PORT}/api/sales`);
  console.log('====================================================');
});
