# 🚀 Deployment Guide — Render + MongoDB Atlas

This guide deploys your Hostel SaaS Platform publicly in ~15 minutes for **free**.

---

## Step 1 — MongoDB Atlas (Free Database)

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) → **Sign up free**
2. Create a free **M0 cluster** (choose Singapore or Mumbai for India)
3. **Database Access** → Add user → username + password → Save
4. **Network Access** → Add IP Address → `0.0.0.0/0` (allow all — Render IPs change)
5. **Connect** → Drivers → Copy the connection string:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/hostel_saas?retryWrites=true&w=majority
   ```
   Replace `<password>` with your actual password.

---

## Step 2 — Push to GitHub

```bash
cd hostel-saas
git init
git add .
git commit -m "Initial deploy"
```

Go to [github.com](https://github.com) → New repository → name it `hostel-saas` → copy the remote URL, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/hostel-saas.git
git push -u origin main
```

---

## Step 3 — Deploy on Render

1. Go to [render.com](https://render.com) → **Sign up free** (use GitHub login)
2. New → **Web Service** → Connect your `hostel-saas` repo
3. Configure:
   | Field | Value |
   |-------|-------|
   | Name | `hostel-saas` |
   | Region | Singapore |
   | Branch | `main` |
   | Build Command | `npm install --prefix server && npm install --prefix client && npm run build --prefix client` |
   | Start Command | `node server/index.js` |
   | Plan | **Free** |

4. Click **Environment** → Add these variables one by one:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `CI` | `false` |
   | `PORT` | `10000` |
   | `MONGODB_URI` | Your Atlas connection string from Step 1 |
   | `JWT_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` and paste the output |
   | `SUPERADMIN_USERNAME` | Your chosen admin username |
   | `SUPERADMIN_PASSWORD` | Your chosen admin password (min 8 chars) |
   | `RESET_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste |
   | `APP_URL` | Leave blank for now — fill in after first deploy |

5. Click **Create Web Service** → wait ~5 minutes for first build

---

## Step 4 — After First Deploy

1. Render gives you a URL like: `https://hostel-saas-xxxx.onrender.com`
2. Go back to **Environment** → Add:
   | Key | Value |
   |-----|-------|
   | `APP_URL` | `https://hostel-saas-xxxx.onrender.com` |
3. Render auto-redeploys.

---

## Your Live URLs

| URL | Who uses it |
|-----|-------------|
| `https://hostel-saas-xxxx.onrender.com` | Staff login (owners, managers) |
| `https://hostel-saas-xxxx.onrender.com/member-portal` | Residents only |
| `https://hostel-saas-xxxx.onrender.com/api/health` | Health check |

---

## Route Security Model

| User | Can access | Cannot access |
|------|-----------|---------------|
| **Not logged in** | Staff login page, Member portal login | Everything else |
| **Super Admin** | Super admin dashboard only | Staff/member pages |
| **Owner** | All staff pages | Super admin panel, Member portal data |
| **Manager** | Assigned hostel pages | Owner-only pages, super admin, member portal data |
| **Member** | Their own portal only | Staff login, any staff page, other members' data |

**Cookie isolation:** Staff auth uses `hm_token` cookie. Member auth uses `hm_member_token` cookie. They never overlap — a staff member at `/member-portal` sees the member login form, not their own dashboard.

---

## ⚠️ Free Tier Notes

- Render free tier **spins down after 15 min of inactivity** — first request after idle takes ~30 seconds
- MongoDB Atlas M0 is **512 MB storage** — fine for hundreds of members
- Upgrade Render to $7/month Starter plan to eliminate spin-down

---

## Re-deploying After Code Changes

```bash
git add .
git commit -m "your change"
git push
```
Render auto-detects the push and redeploys in ~3 minutes.

---

## Emergency Password Reset (Production)

```bash
curl -X POST https://hostel-saas-xxxx.onrender.com/api/auth/emergency-reset \
  -H "Content-Type: application/json" \
  -d '{"secret":"YOUR_RESET_SECRET","username":"superadmin","newPassword":"newpass123"}'
```
