# 🥚 EggTrade Hub — Wholesale Egg Distribution System

A modern, full-stack web application designed specifically for egg traders, wholesale distributors, and commercial customers (bakeries, supermarkets, restaurants, and hotels).

---

## 🚀 Live Demo Quick Reference

- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:5000](http://localhost:5000)
- **API Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

### 🔑 Pre-Seeded Demo Credentials (With 1-Click Login in UI)

| Role | Name / Business | Phone / Identifier | Password | Description |
|---|---|---|---|---|
| **Owner (Admin)** | Rajesh Sharma | `9999999999` | `owner123` | Full owner access: set daily tray price, fast order dispatch, customer ledger, daily analysis |
| **Customer 1** | Sri Krishna Bakery | `9876543211` | `user123` | High volume buyer with active pending order & credit balance |
| **Customer 2** | Anand Supermarket | `9876543212` | `user123` | Retail supermarket customer with credit orders |
| **Customer 3** | Hotel Annapurna | `9876543213` | `user123` | Daily hospitality buyer with an order in transit |
| **Customer 4** | Ramesh Dhabha | `9876543214` | `user123` | Highway food counter customer with fulfilled orders |

> 💡 **Tip:** Both the Login screen and the top Navigation bar feature a **"1-Click Role Switcher"** to instantly test Owner and Customer experiences without typing credentials.

---

## ☁️ Vercel Deployment Guide

This project is configured as a multi-service monorepo using the official Vercel `services` specification in `vercel.json`:
- `frontend`: Vite React Single Page App (Root: `frontend`)
- `backend`: Express Serverless API (Root: `backend`, Entrypoint: `index.js`)

### 1. Framework & Root Directory Settings in Vercel
When importing the repository into Vercel:
- **Framework Preset:** Leave as **Other** (or **Vite**). Vercel reads `vercel.json` `services` automatically.
- **Root Directory:** `./` (repository root, do **NOT** change to `/frontend` or `/backend`).

### 2. Required Environment Variables
In your Vercel Dashboard, go to **Project Settings > Environment Variables** and add:

| Variable | Environment | Description | Example / Instructions |
|---|---|---|---|
| `TURSO_DATABASE_URL` | Production & Preview | Remote libSQL/SQLite database URL | `libsql://egg-trade-myorg.turso.io` |
| `TURSO_AUTH_TOKEN` | Production & Preview | Auth token for your Turso database | `<turso_auth_token>` |
| `JWT_SECRET` | Production & Preview | Strong secret for signing tokens | e.g. `egg-trade-super-secure-jwt-2026-production` |
| `NODE_ENV` | Production & Preview | Runtime environment | `production` |

> 🔒 **Security Notice:** In production, `JWT_SECRET` is strictly enforced from environment variables; the backend refuses to start if it is missing.

### 3. Setting Up Turso (Free Hosted Persistent Database)
To keep data persistent across Vercel serverless cold starts:
1. Install Turso CLI or log in at [turso.tech](https://turso.tech).
2. Create your database:
   ```bash
   turso db create egg-trade
   ```
3. Copy your database URL:
   ```bash
   turso db show egg-trade --url
   # Output: libsql://egg-trade-myorg.turso.io
   ```
4. Create an authentication token:
   ```bash
   turso db tokens create egg-trade
   ```
5. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to your Vercel Project Environment Variables.

> ✨ **Idempotent Auto-Seeding:** On first boot against Turso, the backend automatically creates all tables and seeds the demo accounts (`Rajesh Sharma (Owner)` + 4 customers, prices, orders, and ledger). Subsequent cold starts detect the existing users and skip re-seeding automatically.

### 4. Critical: Vercel Deployment Protection Setting
If you are deploying under a Vercel Team account, Vercel enables **Deployment Protection (Vercel Authentication)** by default. This intercepts unauthenticated API calls with an HTML login page, causing API requests to fail with non-JSON responses.

**To resolve:**
1. In Vercel, open your project dashboard.
2. Go to **Settings > Deployment Protection**.
3. Under **Vercel Authentication**, toggle it **OFF** (or set to "Only preview deployments" if you only want production public).
4. Save changes.

### 5. Verifying Your Deployment
After deployment completes:
1. **Check Backend API Health:**
   Visit: `https://<your-project>.vercel.app/api/health`
   Expected response:
   ```json
   {
     "status": "ok",
     "service": "Egg Trade API",
     "timestamp": "2026-09-29T12:00:00.000Z"
   }
   ```
2. **Check 1-Click Demo Login:**
   Visit `https://<your-project>.vercel.app/` and click **"👑 Owner / Admin"** or **"🍞 Sri Krishna Bakery"**.
   The app will log in instantly and open the corresponding dashboard with live seed data.

---

## 🛠 Tech Stack

- **Frontend:**
  - **React 19** with **Vite 8**
  - **Tailwind CSS v4** (mobile-first responsive design, modern cards & badges)
  - **Lucide React** (icons for delivery statuses, ledger flows, and payments)
  - Responsive charts for daily egg tray sales and revenue trends
- **Backend:**
  - **Node.js** with **Express**
  - **@libsql/client** (Turso remote database client over HTTPS with local SQLite file fallback)
  - **JSON Web Tokens (JWT)** with strict production secret enforcement
  - **bcryptjs** password hashing
- **Database Schema:**
  - `users`: ID, name, phone, email, address, password hash, role (`owner` / `user`), timestamps
  - `daily_prices`: Date (`YYYY-MM-DD`), price per tray, update timestamps
  - `orders`: User ID, order date, delivery date, trays, price per tray, total amount, payment mode (`cash`/`credit`), payment status (`paid`/`pending`), order status (`pending`/`confirmed`/`out_for_delivery`/`delivered`/`cancelled`), notes, created by
  - `credit_ledger`: User ID, order ID, amount, type (`credit_added`/`credit_settled`), notes, date, timestamps

---

## 📦 Setup & Local Installation

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### 1. Clone or Open Project
```bash
git clone https://github.com/kritishreddy72-jpg/egg-trade-hub.git
cd egg-trade-hub
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run seed     # Seeds owner, 4 customers, past orders, daily rates, and credit ledger locally
npm start        # Starts server on http://localhost:5000
```

### 3. Frontend Setup (New Terminal)
```bash
cd frontend
npm install
npm run dev      # Starts Vite dev server on http://localhost:3000
```

---

## ✨ Features & Architecture

### 1. Authentication & Security
- **Role-Based Login Flow:**
  - Owner login with pre-configured admin credentials. Owner registration is strictly locked from public signup.
  - Customer self-registration with Store Name, Phone Number, Delivery Address, and Password.
  - Role-protected routes: token payload defines role; server rejects unauthorized requests with `403 Forbidden`.
  - Automatic redirect: Owner is routed to `/owner/dashboard` and Customers to `/user/dashboard`.

---

### 2. User (Customer) Panel
- **a) Order Placement & Live Status:**
  - Customers can place orders specifying tray quantity and required delivery date.
  - Estimated amount is calculated dynamically using today's wholesale rate.
  - **Live Delivery Progress Tracker:** Visual 4-step progress tracker:
    `[Order Placed] ➔ [Confirmed] ➔ [Out for Delivery] ➔ [Delivered]`
- **b) Order History:**
  - Full tabular log of past orders: Date, Order ID, Trays, Rate per Tray, Total Amount, Payment Mode (`Cash` / `Credit`), Payment Status (`Paid` / `Pending`), and Order Status.
- **c) Outstanding Credit Balance & Breakdown:**
  - Prominent **Outstanding Credit Balance** card displaying current unpaid balance.
  - Modal breakdown displaying exactly which credit orders contribute to the balance with dates and amounts.

---

### 3. Owner (Admin) Panel
- **a) Orders Received Today:**
  - Live listing of all orders received for the current day.
  - Displays customer name, phone (clickable call), address, trays ordered, total amount, and payment mode.
  - **Quick Status Dropdown:** Easily change order status between `Pending`, `Confirmed`, `Out for Delivery`, and `Delivered`.
- **b) Total Trays Required Today:**
  - Real-time auto-calculated tally of total egg trays required to fulfill all orders placed today across all customers.
- **c) Daily Egg Tray Price Entry:**
  - Persistent prompt / banner if today's tray rate has not been recorded.
  - Clickable price widget in the top navigation and dashboard to set or revise the tray price for any date.
  - Price History Log tracking wholesale price movements over time.
- **d) Per-User Customer & Credit Management:**
  - Searchable list of all registered customers with their total orders, tray volume, and outstanding balance.
  - **Customer Profile Drawer:**
    - View active pending deliveries.
    - View itemized unpaid credit orders.
    - View complete order history and credit audit ledger.
    - **Receive Credit Settlement:** Record cash/UPI payment directly against a customer's credit balance with automatic ledger logging and order settlement.
- **e) Rapid Order Entry & Payment Flow (Core Workflow):**
  - Designed for high-speed counter orders and phone calls:
    1. Select customer from dropdown (shows current credit balance next to name).
    2. Enter trays needed (with `+10`, `+25`, `+50`, `+100` quick pills).
    3. System calculates `Trays × Today's Rate = Total ₹`.
    4. Two prominent 1-click confirmation buttons:
       - 💵 **Cash on Delivery:** Marks order as Paid, adds to today's cash receipts, and does not alter credit balance.
       - 📋 **Credit Account:** Marks order as Unpaid/Credit and automatically adds amount to customer's outstanding balance in the credit ledger.
    5. Order is saved and confirmed instantly with toast feedback.
- **f) Daily Analysis & Audit Summary:**
  - Filterable by date (defaults to today):
    - **Total Trays Sold Today**
    - **Total Cash Received Today** (COD orders + credit settlements)
    - **Total New Credit Added Today**
    - **All-Time Outstanding Credit Balance** (system-wide running total)
  - **7-Day Trend Chart:** Responsive bar visualization tracking trays sold and revenue over time.
  - **User Breakdown Table:** Per-user breakdown for that date showing trays ordered, cash paid, credit added, and current running credit balance.

---

## 🗄 API Endpoints Summary

### Authentication (`/api/auth`)
- `POST /login` — Login by phone/email and password
- `POST /register` — Self-register new customer account
- `GET /me` — Current authenticated session profile
- `GET /demo-accounts` — Helper returning demo credentials

### Daily Prices (`/api/prices`)
- `GET /today` — Get today's egg tray price
- `POST /today` — Set or update today's tray price (Owner only)
- `GET /history` — Log of historical prices sorted by date DESC

### Orders (`/api/orders`)
- `POST /` — Place order (Customer or Owner)
- `POST /fast-entry` — Rapid counter order entry with instant Cash vs Credit selection (Owner only)
- `GET /today` — Orders received today with total trays required summary (Owner only)
- `GET /my-orders` — Past orders for the logged-in customer
- `GET /active` — Current active delivery status for logged-in customer
- `PATCH /:id/status` — Update order delivery status (Owner only)
- `PATCH /:id/payment` — Update payment mode or settlement (Owner only)

### Customers & Credit (`/api/customers`)
- `GET /` — List all customers with balances and order metrics (Owner only)
- `GET /:id` — Detailed customer profile, orders, credit balance, and ledger (Owner only)
- `POST /:id/settle-credit` — Record payment settlement against outstanding balance (Owner only)
- `GET /my/balance` — Current customer's credit balance and unpaid order breakdown

### Analytics & Reports (`/api/analytics`)
- `GET /daily-summary?date=YYYY-MM-DD` — Metrics, all-time running credit, and user breakdown (Owner only)
- `GET /trends?days=7` — Multi-day trend data for visual charts (Owner only)

---

## 🧪 Verification & Testing
The application has been verified end-to-end:
- Database schema and migrations pass integrity checks with `@libsql/client` (Turso) and local SQLite fallback.
- Password encryption and JWT tokens verified with role guard middleware.
- Full E2E testing covers Owner login, setting prices, fast order entry (both cash and credit paths), customer registration, customer self-ordering, credit ledger tracking, and partial payment settlements.
- React frontend builds cleanly with zero errors via Vite and Tailwind CSS.
