# 🥛 HealthyMilk

**HealthyMilk** is a full-stack web application designed to connect **farmers, consumers, and delivery agents** for efficient and reliable fresh milk distribution. The platform streamlines milk ordering, delivery management, and communication between all stakeholders.

---

## ✨ Features

### 👨‍🌾 Farmer Portal

* Manage milk availability
* Update product details
* Track incoming orders

### 🛒 Consumer Portal

* Browse available milk products
* Place and track orders
* Receive delivery notifications

### 🚚 Delivery Agent Portal

* View assigned deliveries
* Update delivery status
* Manage delivery schedules

### 🔐 Authentication & Authorization

* Secure user registration and login
* Role-based access control (Farmer / Consumer / Delivery Agent)

### 📊 Dashboard

* Personalized dashboard for each role
* Order and delivery insights

---

## 🏗️ Project Structure

```text
HealthyMilk/
├── backend/      # Express.js API and server
├── frontend/     # React + Vite client application
└── README.md
```

---

## 🛠️ Tech Stack

| Layer          | Technology                            |
| -------------- | ------------------------------------- |
| Frontend       | React, Vite, JavaScript, Tailwind CSS |
| Backend        | Node.js, Express.js                   |
| Database       | MongoDB                               |
| Authentication | JWT (JSON Web Token)                  |
| Deployment     | Vercel                                |

---

## 📋 Prerequisites

Make sure the following are installed on your system:

* **Node.js 16+**
* **npm** or **yarn**
* **MongoDB** (local or cloud instance such as MongoDB Atlas)

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/subhani12389/HealthyMilk.git
cd HealthyMilk
```

---

## ⚙️ Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` directory:

```env
PORT=5000
DATABASE_URL=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

Start the backend server:

```bash
npm run dev
```

The API will run at **http://localhost:5000**

---

## 💻 Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Create a `.env` file inside the `frontend` directory:

```env
VITE_API_URL=http://localhost:5000
```

Start the frontend development server:

```bash
npm run dev
```

The frontend will run at **http://localhost:5173**

---

## 🧪 Available Scripts

### Backend

```bash
npm run dev      # Start development server
npm start        # Start production server
npm run build    # Build (if configured)
```

### Frontend

```bash
npm run dev      # Start development server
npm run build    # Create production build
npm run preview  # Preview production build
```

---

## 🌐 API Configuration

Set the frontend API URL:

```env
VITE_API_URL=http://localhost:5000
```

Ensure the backend server is running before using the frontend.

---

## 🚀 Production Deployment

### Frontend

```bash
cd frontend
npm run build
```

Deploy the generated `dist/` folder to **Vercel**, **Netlify**, or any static hosting provider.

### Backend

Deploy the `backend/` directory to **Vercel**, **Render**, **Railway**, or another Node.js hosting platform.

---

## ☁️ Vercel Deployment

This repository includes `vercel.json` configuration files for both frontend and backend.

### Deploy Steps

1. Import the repository into **Vercel**
2. Create separate projects for:

   * `frontend/`
   * `backend/`
3. Add environment variables in the Vercel dashboard
4. Deploy both projects

---

## 🔒 Environment Variables

### Backend

| Variable       | Description               |
| -------------- | ------------------------- |
| `PORT`         | Server port               |
| `DATABASE_URL` | MongoDB connection string |
| `JWT_SECRET`   | Secret key for JWT        |

### Frontend

| Variable       | Description          |
| -------------- | -------------------- |
| `VITE_API_URL` | Backend API base URL |

---

## 📸 Screenshots

Add application screenshots here:

* Login Page
* Consumer Dashboard
* Farmer Dashboard
* Delivery Dashboard

Example:

```md
![Login](screenshots/login.png)
```

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/your-feature-name
```

3. Commit your changes

```bash
git commit -m "Add new feature"
```

4. Push to your branch

```bash
git push origin feature/your-feature-name
```

5. Open a Pull Request

---

## 🐛 Issue Reporting

If you find a bug or have a feature request, please open an issue in the GitHub repository.

---

## 📄 License

This project currently does not include a license. If you plan to open-source it, consider adding an MIT, Apache 2.0, or GPL license.

---

## 👨‍💻 Author

**Mahaboob Subhani Shaik**

* GitHub: https://github.com/subhani12389

---

⭐ If you found this project useful, please consider **starring the repository** on GitHub.
