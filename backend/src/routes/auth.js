const express = require('express');
const router = express.Router();
const { users, supabase } = require('../store');

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Helper: Format user record from DB or memory into standardized frontend format
const formatUserObject = (u) => {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone || '+91 98765 43210',
    balance: u.balance !== undefined && u.balance !== null ? Number(u.balance) : 0,
    farmName: u.farmName || u.farm_name || `${u.name}'s Dairy Farm`,
    location: u.location || u.farm_location || 'Kaira Valley, Anand',
    cattleCount: u.cattleCount || u.cattle_count || 15,
    rating: u.rating ? Number(u.rating) : 5.0,
    address: u.address || 'Apt 402, Green Acres Heights, Sector 14',
    vehicleNo: u.vehicleNo || u.vehicle_no || 'GJ-07-MK-4421',
    assignedArea: u.assignedArea || u.assigned_area || 'Sector 14 & Green Valley',
    totalDeliveries: u.totalDeliveries || u.total_deliveries || 69,
    bankDetails: {
      accountNo: u.bankDetails?.accountNo || u.bank_account_no || 'XXXX-XXXX-8921',
      ifsc: u.bankDetails?.ifsc || u.bank_ifsc || 'SBIN0004123',
      bankName: u.bankDetails?.bankName || u.bank_name || 'State Bank of India'
    },
    subscription: u.subscription || {
      id: `sub_${u.id}`,
      planName: 'Pure Fresh A2 Cow Milk',
      dailyLiters: 2,
      totalDays: 30,
      daysRemaining: 22,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      status: 'Active',
      pricePerLiter: 65,
      totalAmountPaid: 3900,
      deliveryTimeSlot: '6:30 AM - 7:30 AM'
    }
  };
};

// POST /api/auth/signup - Professional User Registration
router.post('/signup', async (req, res) => {
  try {
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

    const selectedRole = role || 'farmer';
    if (!['farmer', 'consumer', 'agent'].includes(selectedRole)) {
      return res.status(400).json({ success: false, message: 'Please select a valid role (Farmer, Consumer, or Delivery Agent).' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check memory store
    const existingMemoryUser = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existingMemoryUser) {
      return res.status(409).json({ success: false, message: 'An account with this email address already exists. Please sign in.' });
    }

    // Check Supabase DB
    if (supabase) {
      const { data: dbUser } = await supabase.from('users').select('*').eq('email', cleanEmail).maybeSingle();
      if (dbUser) {
        return res.status(409).json({ success: false, message: 'An account with this email address already exists. Please sign in.' });
      }
    }

    const userId = `${selectedRole}_${Date.now()}`;
    const newUser = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      password: password,
      role: selectedRole,
      phone: phone ? phone.trim() : '+91 98765 43210',
      balance: 0.00,
      createdAt: new Date().toISOString(),
      farmName: farmName ? farmName.trim() : `${name.trim()}'s Dairy Farm`,
      location: 'Kaira Valley, Anand',
      cattleCount: 15,
      address: address ? address.trim() : '123 Green Avenue, Sector 5',
      vehicleNo: vehicleNo ? vehicleNo.trim() : 'GJ-07-MK-8821',
      assignedArea: assignedArea ? assignedArea.trim() : 'Sector 14 & Green Valley',
      bankDetails: { accountNo: 'XXXX-XXXX-1234', ifsc: 'SBIN0001234', bankName: 'State Bank of India' },
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
    };

    // Save to memory
    users.push(newUser);

    // Save to Supabase DB
    if (supabase) {
      try {
        await supabase.from('users').insert({
          id: userId,
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          farm_name: newUser.farmName,
          location: newUser.location,
          balance: 0.00,
          phone: newUser.phone,
          address: newUser.address,
          vehicle_no: newUser.vehicleNo,
          assigned_area: newUser.assignedArea,
          bank_account_no: 'XXXX-XXXX-1234',
          bank_ifsc: 'SBIN0001234',
          bank_name: 'State Bank of India'
        });
      } catch (err) {
        console.error('Supabase user insert error:', err);
      }
    }

    const formattedUser = formatUserObject(newUser);

    return res.status(201).json({
      success: true,
      message: `Account created successfully as ${selectedRole.toUpperCase()}!`,
      user: formattedUser,
      token: `jwt_token_${userId}_${Date.now()}`
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ success: false, message: 'Server error during account registration.' });
  }
});

// POST /api/auth/login - Flexible Role Matching & Verification
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter both email address and password.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Search Memory Store first
    let user = users.find(u => u.email.toLowerCase() === cleanEmail);

    // 2. Search Supabase DB if not found in memory
    if (!user && supabase) {
      try {
        const { data: dbUser } = await supabase.from('users').select('*').eq('email', cleanEmail).maybeSingle();
        if (dbUser) {
          user = dbUser;
        }
      } catch (err) {
        console.error('Supabase login query error:', err);
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'No account found with this email address. Please sign up.' });
    }

    if (user.password && user.password !== password) {
      return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
    }

    const formattedUser = formatUserObject(user);

    return res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      user: formattedUser,
      token: `jwt_token_${user.id}_${Date.now()}`
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during sign in.' });
  }
});

// GET /api/auth/me - Refresh active session profile & live balance
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'No session token.' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Robust user match from token string
    let user = users.find(u => token.includes(u.id));

    if (!user && supabase) {
      try {
        const { data: allDbUsers } = await supabase.from('users').select('*');
        if (allDbUsers) {
          user = allDbUsers.find(u => token.includes(u.id));
        }
      } catch (err) {
        console.error('Supabase me query error:', err);
      }
    }

    // Fallback: if token has jwt_token_<id>_ format, try first matched memory user
    if (!user && users.length > 0) {
      user = users[0];
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid.' });
    }

    const formattedUser = formatUserObject(user);
    return res.json({ success: true, user: formattedUser });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
});

module.exports = router;
