# MANFIT - Luxury Apparel Daily Sales CRM Studio

An enterprise-grade, luxury-styled Customer Relationship Management (CRM) and Daily Sales Recording web application specifically designed for **MANFIT** menswear, bespoke tailoring, and garment retail.

Built with **HTML5**, **Tailwind CSS**, and **Vanilla JavaScript**, featuring a bespoke **Obsidian Black & Light Brown / Warm Camel** aesthetic, micro-animations, interactive **Chart.js** analytics, invoice generation, customer lifetime tracking, and a **dual DBMS architecture** (In-browser IndexedDB + Node.js/SQLite REST API).

---

## ✨ Key Features & Capabilities

### 1. 🎨 Luxury Black & Light Brown Visual Identity
- **Bold Branding**: Prominent, stylish, large-sized brand title **"MANFIT"** with luxury serif typography (`Cinzel` & `Outfit`).
- **Color Palette**:
  - Obsidian Black & Dark Charcoal: `#0a0a0a`, `#121110`, `#181614`
  - Warm Caramel & Light Brown Accents: `#c59b6d`, `#d4aa7d`, `#e6c5a0`
  - Subtle borders and glassmorphism cards with smooth hover glows and slide-in micro-animations.

### 2. 📊 Daily Sales & KPI Analytics Dashboard
- **Real-Time KPI Counters**:
  - Today's Revenue (with animated count-up)
  - Today's Transactions Count
  - Total Garments Sold
  - Average Ticket Size / Order Value (AOV)
  - All-Time Store Sales
- **Visual Analytics**:
  - **7-Day Sales Revenue Trend**: Smooth area line chart comparing daily performance.
  - **Category Share Doughnut**: Breakdown across Suits, Blazers, Shirts, Trousers, Ethnic, and Accessories.
  - **Payment Modes Distribution**: Split between Cash, UPI / QR, and Credit/Debit cards.
  - **Recent Transactions Stream**: Instant access to today's newest sales receipts.

### 3. 🛍️ Fast POS / Daily Sale Entry
- **Line Items Builder**: Add multiple garments with custom names or pick from preloaded catalog.
- **Garment Attributes**: Category selector, sizing (`38`, `40`, `42`, `S`, `M`, `L`, `XL`, `Custom Fit`), quantity steppers, unit price, and auto-calculating totals.
- **Client Auto-Lookup**: Type an existing customer's mobile number to auto-fill their profile and view past order history.
- **Discounts & Tax**: Flat discount deduction and optional 5% / 12% apparel GST calculation.
- **Tailoring & Alterations Instructions**: Dedicated notes section for trouser hemming, sleeve shortening, trial date, and fitter notes.
- **Instant Printable Invoice**: Automatically generates an invoice preview on submit with a print/save-as-PDF trigger.

### 4. 📋 Sales History & Daily Register
- **Date Presets**: Filter by *Today*, *Yesterday*, *Past 7 Days*, *This Month*, or *All Time*.
- **Search & Multi-Filters**: Filter by payment mode (Cash, UPI, Card), payment status (Paid, Credit), or search by customer name, phone, invoice number, or product.
- **Accounting Exports**:
  - **Export to CSV**: Download complete sales records compatible with Microsoft Excel and Google Sheets.
  - **Print Daily Report**: Clean, printer-friendly summary layout.

### 5. 👥 Customer Relationship Directory (CRM)
- Tracks each client's phone number, email, total order count, **Lifetime Value (LTV)**, and last visit date.
- Helps identify VIP clients and repeat shoppers.

### 6. 👔 Garments Catalog & Inventory
- Ready-to-use catalog of suits, shirts, blazers, chinos, and ethnic wear.
- Add new garments with custom SKUs, sizes, prices, and track stock levels.

### 7. 💾 Dual Database Management (DBMS)
- **Engine 1: In-Browser IndexedDB (Zero Installation)**:
  - Standard transactional browser DBMS.
  - Works straight away just by opening `index.html` in Chrome, Edge, Safari, or Firefox.
  - 100% offline-ready with persistent local storage.
- **Engine 2: Node.js + SQLite REST API Server**:
  - Standalone Node.js server (`backend/server.js`) with SQLite/JSON persistence.
  - Supports multi-counter / multi-computer access over local network.
- **Data Backup & Restore**: One-click **JSON Backup Export** and **JSON Restore** buttons.
- **Sample Data Seeder**: One-click button to reload realistic demo sales and items.

---

## 🚀 How to Run the Application

### Option A: Instant Browser Launch (Zero Setup Required)
1. Simply navigate to the project folder:
   ```
   c:\Users\smart\Downloads\Mobile Devices\MANFIT CRM\
   ```
2. Double-click **`index.html`** to open it directly in your web browser (Google Chrome, Microsoft Edge, Brave, Firefox, etc.).
3. The application will initialize the IndexedDB database automatically with sample sales and inventory!

---

### Option B: Run with Node.js / SQLite REST API Server
If you want to run the application with a dedicated backend REST API server:

1. Open your terminal / command prompt in the project root:
   ```bash
   cd "c:\Users\smart\Downloads\Mobile Devices\MANFIT CRM"
   ```
2. Start the server using Node (or `agy-node`):
   ```bash
   node backend/server.js
   ```
   *(The server has zero external dependencies and starts instantly on port 5000)*
3. Open your browser and visit:
   ```
   http://localhost:5000
   ```
4. In the MANFIT navigation, go to **DBMS & Settings** and switch the database mode to **"Node.js & SQLite REST API Server"**.

---

## 📁 Project Structure

```
MANFIT CRM/
├── index.html                 # Master Single-Page Web Application
├── README.md                  # Comprehensive Documentation & Guide
├── css/
│   └── styles.css             # Luxury Black & Light Brown Theme, Animations & Print Styles
├── js/
│   ├── db.js                  # IndexedDB Local DBMS Engine (NoSQL transactional)
│   ├── api.js                 # Unified API Service (IndexedDB & REST API Switcher)
│   └── app.js                 # UI Controller, Chart.js Analytics, Sales POS, Receipt Generator
└── backend/
    ├── server.js              # Node.js REST API & Static File Server (Port 5000)
    ├── database.js            # SQLite / JSON DBMS Driver with Table Schemas
    └── package.json           # Node.js Package Configuration
```

---

## 🧾 Sample Receipt Preview

The built-in receipt generator produces an invoice with:
- Store Header: **MANFIT - Haute Menswear & Tailoring Studio**
- Store address, phone number, and GSTIN
- Sequential invoice number (`MF-2026-001`) and date
- Itemized garments table with sizes and unit prices
- Alteration / Tailor trial notes box
- Clean print styles formatted for 80mm thermal receipt printers or standard A4/Letter paper.

---

## 🛠️ Technology Stack
- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript (ES6+), FontAwesome 6, Chart.js 4.4
- **Fonts**: Cinzel (Luxury Display Serif), Outfit (Modern sans-serif)
- **Local Storage Engine**: IndexedDB (Native Web API)
- **Backend**: Node.js, `node:sqlite` / JSON persistent storage, HTTP/Express REST endpoints
- **Export Format**: Standard CSV (RFC 4180) & JSON Backup
