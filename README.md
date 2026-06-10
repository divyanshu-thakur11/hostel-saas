# 🏠 Hostel SaaS Platform

A **multi-tenant** hostel management SaaS where you are the platform super admin who assigns credentials to hostel owners. Each owner manages only their own data in complete isolation.

---

## 🔐 Roles

| Role | Description |
|------|-------------|
| **Super Admin** | Platform owner (you). Creates/manages organizations. Full system access. |
| **Hostel Owner** | Manages their own hostels, rooms, members, staff. Cannot see other owners' data. |
| **Manager** | Staff created by an owner. Scoped to their assigned hostel. |

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js 20.x
- MongoDB running locally (or a MongoDB Atlas URI)

### Step 1 — Install dependencies
```bash
npm run install-all
```

### Step 2 — Configure environment
```bash
# The server/.env is already created with defaults.
# Edit server/.env to set your MongoDB URI and JWT_SECRET for production.
```

### Step 3 — Start development servers

**Terminal 1 — Backend (port 5000):**
```bash
npm run dev-server
```

**Terminal 2 — Frontend (port 3000):**
```bash
npm run dev-client
```

Open: **http://localhost:3000**

---

## 🔑 First Login

On first boot, a Super Admin account is auto-created:

| Field | Value |
|-------|-------|
| Login tab | **Platform** (⚡) |
| Username | `superadmin` (or `SUPERADMIN_USERNAME` env var) |
| Password | `superadmin123` (or `SUPERADMIN_PASSWORD` env var) |

**⚠️ You will be forced to change the password on first login.**

---

## 📋 Super Admin — Creating Hostel Owners

1. Log in as Super Admin
2. Click **"+ New Organization"**
3. Fill in:
   - Organization name (hostel business name)
   - Owner's full name
   - Login username & password (you set these — owner cannot self-register)
   - Plan (basic / pro / enterprise)
   - Plan duration in days
4. Share the credentials with the hostel owner
5. They log in via the **Owner** tab and are forced to change their password

---

## 🏗️ Multi-Tenant Architecture

### Tenant Isolation
- Every data record (`Member`, `Room`, `Receipt`, `Electric`, `Salary`, etc.) is tagged with `organizationId`
- **All queries automatically filter by `organizationId`** — no cross-tenant data leakage possible
- The `tenantGuard` middleware validates org status (active, not expired) on every request
- Hostel switching for owners is validated server-side (hostel must belong to their org)

### Data Models
```
Organization (created by superadmin)
  └── User (owner, managers — belong to org)
  └── Hostel (one or more per org)
       └── Room
       └── Member
       └── Receipt
       └── Electric
       └── Salary
       └── Notification
       └── AuditLog
```

---

## 🌐 Deploy to Render

1. Push to GitHub
2. Create a new **Web Service** on Render
3. Set environment variables:
   ```
   MONGODB_URI=<your Atlas URI>
   JWT_SECRET=<random 64-char string>
   NODE_ENV=production
   SUPERADMIN_USERNAME=your_admin_username
   SUPERADMIN_PASSWORD=your_secure_password
   ```
4. Build command: `npm install --prefix server && npm install --prefix client && npm run build --prefix client`
5. Start command: `node server/index.js`

---

## 🔧 Super Admin Actions

- ✅ Create organizations with owner credentials
- ⛔ Suspend / reactivate organizations
- ⏱ Extend subscription plans
- 🔑 Reset owner passwords
- 🗑 Delete organizations (cascades users)
- 📊 View platform-wide analytics

---

## 📦 Tech Stack
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **Frontend**: React + Axios
- **Auth**: JWT (HttpOnly cookies) + bcrypt
- **Deployment**: Render (single service, React served from Express)

---

## ✨ New Features (v2)

### 📱 Member Self-Service Portal
- Members access `/member-portal` with mobile + PIN
- View monthly rent, dues, full receipt history
- Pay online via Razorpay directly
- Change their own PIN
- **Setup**: Owner → Settings → Member Portal → Search member → Set PIN → Share with resident

### 💳 Razorpay Payment Integration
- Each hostel owner connects their own Razorpay account
- Owner: Settings → Razorpay → Paste Key ID + Secret → Enable
- Members pay from portal → Razorpay checkout opens → Payment verified server-side → Receipt auto-generated
- All payments logged in PaymentOrder collection with full audit trail
- Supports: Rent, Advance, Electric, Other payment types

### 🧙 Owner Onboarding Wizard
- Triggers automatically for new owners with no hostels
- Step 1: Add hostel name, address, city, contact
- Step 2: Set up room range (e.g. Room 1 to 20) with default rent
- Step 3: Add first resident (skippable)
- Dismissable at any step — can access via Settings page progress bar

---

## 🔗 Portal URL

Share this link with residents:
```
https://your-site.com/member-portal
```
They log in with: **mobile number + PIN** (set by owner from Settings page)
