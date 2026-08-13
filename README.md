# 🥛 HealthyMilk

**HealthyMilk** is a full-stack web application designed to connect **farmers, consumers, and delivery agents** for efficient and reliable fresh milk distribution. The platform streamlines milk ordering, delivery management, and real-time communication between all stakeholders.

---

## ✨ Features

### 👨‍🌾 Farmer Portal
* Manage milk volume & batch requests
* On-site Fat % and SNF % quality tracking
* Real-time balance and instant bank payout withdrawals
* Digital QR code traceability certificates for milk batches

### 🛒 Consumer Portal
* Live doorstep milk delivery status tracking & ETA
* Flexible subscription management (Pause/Resume, daily quantity adjust, renew plan)
* 100% Organic purity verification certificates & farm origin tracking

### 🚚 Delivery Agent Portal
* On-site quality testing (Lactometer, Fat %, SNF %) that auto-credits farmer accounts
* ₹50 commission fee credited per verified pickup and doorstep delivery
* Direct agent bank withdrawal requests

### 🔐 Authentication & Authorization
* Secure user registration and login with JWT session support
* 1-Click Quick Access role login buttons for instant demo evaluation
* Role-based access control (Farmer / Consumer / Delivery Agent)

---

## 🏗️ Project Structure

```text
HealthyMilk/
├── backend/      # Express.js API, store, and Supabase client
├── frontend/     # React + Vite application (Tailwind / Custom CSS)
└── vercel.json   # Monorepo deployment config
```

---

## 🛠️ Tech Stack

| Layer          | Technology                            |
| -------------- | ------------------------------------- |
| Frontend       | React, Vite, JavaScript, Tailwind CSS |
| Backend        | Node.js, Express.js                   |
| Database       | Supabase / In-Memory Store            |
| Authentication | JWT (JSON Web Token)                  |
| Deployment     | Vercel                                |

---


🌐 Verified Live Deployment Links
Resource	Status	URL
Unified Full-Stack App	🟢 READY & LIVE	https://healthymilk.vercel.app
API Health Check	🟢 200 OK	https://healthymilk.vercel.app/api/health
GitHub Repository	🟢 SYNCED	https://github.com/subhani12389/HealthyMilk

---

## 💻 Local Setup & Development

### 1. Clone the Repository
```bash
git clone https://github.com/subhani12389/HealthyMilk.git
cd HealthyMilk
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run dev
```
*API will run at http://localhost:5000*

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*App will run at http://localhost:3000*

---

## 👨‍💻 Author

**Mahaboob Subhani Shaik**  
GitHub: [https://github.com/subhani12389](https://github.com/subhani12389)
