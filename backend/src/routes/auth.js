const express = require('express');
const router = express.Router();
const { users } = require('../store');

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// POST /api/auth/signup - Supports Farmer, Consumer, and Delivery Agent
router.post('/signup', (req, res) => {
  const { name, email, password, role, farmName, address, phone, vehicleNo, assignedArea } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Full name is required.' });
  }

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
  }

  if (!role || !['farmer', 'consumer', 'agent'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Please select a valid role (Farmer, Consumer, or Delivery Agent).' });
  }

  const existingUser = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existingUser) {
    return res.status(409).json({ success: false, message: 'An account with this email address already exists. Please sign in.' });
  }

  const userId = `${role}_${Date.now()}`;
  const newUser = {
    id: userId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: password,
    role,
    phone: phone ? phone.trim() : '+91 98765 43210',
    createdAt: new Date().toISOString(),
    ...(role === 'farmer' ? {
      farmName: farmName ? farmName.trim() : `${name.trim()}'s Dairy Farm`,
      location: 'Kaira Valley, Anand',
      cattleCount: 12,
      balance: 0.00,
      rating: 5.0,
      bankDetails: { accountNo: 'XXXX-XXXX-1234', ifsc: 'SBIN0001234', bankName: 'State Bank of India' }
    } : {}),
    ...(role === 'consumer' ? {
      address: address ? address.trim() : '123 Green Avenue, Sector 5',
      subscription: {
        id: `sub_${Date.now()}`,
        planName: 'Pure Fresh A2 Cow Milk',
        dailyLiters: 2,
        totalDays: 30,
        daysRemaining: 30,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status: 'Active',
        pricePerLiter: 65,
        totalAmountPaid: 3900,
        deliveryTimeSlot: '6:30 AM - 7:30 AM'
      }
    } : {}),
    ...(role === 'agent' ? {
      assignedArea: assignedArea ? assignedArea.trim() : 'Sector 14 & Green Valley',
      vehicleNo: vehicleNo ? vehicleNo.trim() : 'GJ-07-MK-8821',
      status: 'Active'
    } : {})
  };

  users.push(newUser);

  const { password: _, ...userWithoutPassword } = newUser;

  return res.status(201).json({
    success: true,
    message: 'Registration successful! Welcome to HealthyMilk.',
    user: userWithoutPassword,
    token: `jwt_token_${userId}_${Date.now()}`
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide both email address and password.' });
  }

  const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials. No user found with this email.' });
  }

  if (user.password && user.password !== password) {
    return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
  }

  if (role && user.role !== role) {
    return res.status(403).json({ success: false, message: `Access denied. Your account is registered as a ${user.role.toUpperCase()}.` });
  }

  const { password: _, ...userWithoutPassword } = user;

  return res.json({
    success: true,
    message: 'Login successful!',
    user: userWithoutPassword,
    token: `jwt_token_${user.id}_${Date.now()}`
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'No session token.' });
  }

  const token = authHeader.replace('Bearer ', '');
  const match = token.match(/^jwt_token_([^_]+_[^_]+)_/);
  const userId = match ? match[1] : null;

  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Session invalid or expired.' });
  }

  const { password: _, ...userWithoutPassword } = user;
  return res.json({ success: true, user: userWithoutPassword });
});

module.exports = router;
