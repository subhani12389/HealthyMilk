import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { 
  Milk, User, Lock, Mail, MapPin, Building, ArrowRight, 
  Eye, EyeOff, ShieldCheck, CheckCircle2, Truck, Navigation, 
  Sparkles, Zap, Phone, KeyRound, RotateCcw, ArrowLeft, AlertCircle 
} from 'lucide-react';

export default function AuthPage() {
  const { loginUser } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [signupStep, setSignupStep] = useState(1); // 1: Personal Details, 2: Phone OTP Verification
  const [role, setRole] = useState('farmer');

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    email: 'farmer@healthymilk.com',
    phone: '9876543210',
    password: 'password123',
    confirmPassword: '',
    farmName: '',
    address: '',
    vehicleNo: '',
    assignedArea: ''
  });

  // OTP Verification States
  const [otpCode, setOtpCode] = useState('');
  const [sentOtp, setSentOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Resend Countdown Timer effect
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Handle Role Switch with Auto-filled Demo Email for instant convenience
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setErrorMsg('');
    setSuccessMsg('');
    const demoEmail = newRole === 'farmer' 
      ? 'farmer@healthymilk.com' 
      : newRole === 'agent' 
      ? 'agent@healthymilk.com' 
      : 'consumer@healthymilk.com';

    setFormData(prev => ({
      ...prev,
      email: demoEmail,
      password: 'password123'
    }));
  };

  // Instant Quick Sign In Helper
  const handleQuickLogin = async (targetRole, targetEmail) => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setRole(targetRole);

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: targetEmail, password: 'password123' })
      });

      if (data.success && data.user) {
        setSuccessMsg(`Welcome back, ${data.user.name}!`);
        setTimeout(() => {
          loginUser(data.user, data.token);
        }, 300);
      } else {
        setErrorMsg(data.message || 'Quick login failed.');
      }
    } catch (err) {
      setErrorMsg('Server connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errorMsg) setErrorMsg('');
  };

  // Frontend Validation Helpers
  const validateStep1 = () => {
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setErrorMsg('Please enter your full name (minimum 2 characters).');
      return false;
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return false;
    }
    const cleanPhone = formData.phone.replace(/[^\d+]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return false;
    }
    if (!formData.password || formData.password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter matching passwords.');
      return false;
    }
    return true;
  };

  // Step 1: Send OTP to Phone Number
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!validateStep1()) return;

    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone: formData.phone,
          email: formData.email,
          isSignup: true
        })
      });

      if (data.success) {
        setSentOtp(data.otp || '123456');
        setOtpCode(data.otp || ''); // Pre-fills for instant 1-click test convenience
        setSuccessMsg(data.message || `Verification OTP sent to +91 ${formData.phone}`);
        setSignupStep(2);
        setResendTimer(30);
      } else {
        setErrorMsg(data.message || 'Failed to send OTP code.');
      }
    } catch (err) {
      setErrorMsg('Server error sending OTP. Please verify backend server is online.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone: formData.phone,
          email: formData.email,
          isSignup: true
        })
      });

      if (data.success) {
        setSentOtp(data.otp || '123456');
        setOtpCode(data.otp || '');
        setSuccessMsg(`New OTP sent to +91 ${formData.phone}`);
        setResendTimer(30);
      } else {
        setErrorMsg(data.message || 'Failed to resend OTP.');
      }
    } catch (err) {
      setErrorMsg('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP & Complete Signup
  const handleVerifyOTPAndSignup = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!otpCode || otpCode.trim().length < 6) {
      setErrorMsg('Please enter the 6-digit OTP code sent to your mobile number.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          role,
          otp: otpCode.trim()
        })
      });

      if (data.success && data.user) {
        setSuccessMsg(data.message || 'Phone number verified! Account created successfully.');
        setTimeout(() => {
          loginUser(data.user, data.token);
        }, 300);
      } else {
        setErrorMsg(data.message || 'OTP verification failed. Please try again.');
      }
    } catch (err) {
      setErrorMsg('Server connection error verifying OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Sign In Handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.email || !formData.password) {
      setLoading(false);
      setErrorMsg('Please enter both your email/phone and password.');
      return;
    }

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: formData.email.trim(),
          password: formData.password,
          role
        })
      });

      if (data.success && data.user) {
        setSuccessMsg(data.message || 'Authentication successful!');
        setTimeout(() => {
          loginUser(data.user, data.token);
        }, 300);
      } else {
        setErrorMsg(data.message || 'Sign in failed. Invalid credentials or user not registered.');
      }
    } catch (err) {
      setErrorMsg('Server connection error. Please verify backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.12), transparent 45%), radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.12), transparent 45%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2.5rem 1rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '24px',
        boxShadow: 'var(--shadow-lg)',
        padding: '2.5rem',
        backdropFilter: 'blur(20px)'
      }}>
        
        {/* Brand Identity Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            marginBottom: '0.85rem',
            boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)'
          }}>
            <Milk size={32} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Healthy<span style={{ color: 'var(--accent-emerald)' }}>Milk</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            {isSignup 
              ? (signupStep === 1 ? 'Step 1: Account Registration Details' : 'Step 2: Verify Mobile OTP') 
              : 'Sign in to access your dairy portal'}
          </p>
        </div>

        {/* Instant 1-Click Quick Access Shortcuts (Login Mode Only) */}
        {!isSignup && (
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1rem',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-emerald)', textTransform: 'uppercase', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
              <Zap size={15} color="var(--accent-amber)" /> 1-Click Instant Role Sign In
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => handleQuickLogin('farmer', 'farmer@healthymilk.com')}
                disabled={loading}
                style={{
                  padding: '0.55rem 0.35rem',
                  borderRadius: '10px',
                  background: 'var(--accent-emerald-light)',
                  color: 'var(--accent-emerald)',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}
              >
                🌾 Farmer
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('agent', 'agent@healthymilk.com')}
                disabled={loading}
                style={{
                  padding: '0.55rem 0.35rem',
                  borderRadius: '10px',
                  background: 'var(--accent-amber-light)',
                  color: 'var(--accent-amber)',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  border: '1px solid rgba(245, 158, 11, 0.3)'
                }}
              >
                🚚 Agent
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('consumer', 'consumer@healthymilk.com')}
                disabled={loading}
                style={{
                  padding: '0.55rem 0.35rem',
                  borderRadius: '10px',
                  background: 'var(--accent-blue-light)',
                  color: 'var(--accent-blue)',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  border: '1px solid rgba(37, 99, 235, 0.3)'
                }}
              >
                🥛 Consumer
              </button>
            </div>
          </div>
        )}

        {/* Tab Switcher: Login / Signup */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-primary)',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-color)'
        }}>
          <button
            type="button"
            onClick={() => { setIsSignup(false); setSignupStep(1); setErrorMsg(''); setSuccessMsg(''); }}
            style={{
              flex: 1,
              padding: '0.65rem',
              borderRadius: '8px',
              background: !isSignup ? 'var(--bg-card)' : 'transparent',
              color: !isSignup ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.88rem',
              boxShadow: !isSignup ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignup(true); setSignupStep(1); setErrorMsg(''); setSuccessMsg(''); }}
            style={{
              flex: 1,
              padding: '0.65rem',
              borderRadius: '8px',
              background: isSignup ? 'var(--bg-card)' : 'transparent',
              color: isSignup ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.88rem',
              boxShadow: isSignup ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            Create Account
          </button>
        </div>

        {/* Dynamic Alerts */}
        {errorMsg && (
          <div style={{
            background: 'var(--accent-rose-light)',
            color: 'var(--accent-rose)',
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            fontWeight: 600,
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} /> {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'var(--accent-emerald-light)',
            color: 'var(--accent-emerald)',
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} /> {successMsg}
          </div>
        )}

        {/* SIGNUP STEP 1: Registration Form */}
        {isSignup && signupStep === 1 && (
          <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            
            {/* Role Selector Buttons */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                Select Account Role
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleRoleChange('farmer')}
                  style={{
                    padding: '0.65rem 0.4rem',
                    borderRadius: '12px',
                    border: role === 'farmer' ? '2px solid var(--accent-emerald)' : '1px solid var(--border-color)',
                    background: role === 'farmer' ? 'var(--accent-emerald-light)' : 'var(--bg-primary)',
                    color: role === 'farmer' ? 'var(--accent-emerald)' : 'var(--text-main)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textAlign: 'center'
                  }}
                >
                  🌾 Farmer
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('consumer')}
                  style={{
                    padding: '0.65rem 0.4rem',
                    borderRadius: '12px',
                    border: role === 'consumer' ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                    background: role === 'consumer' ? 'var(--accent-blue-light)' : 'var(--bg-primary)',
                    color: role === 'consumer' ? 'var(--accent-blue)' : 'var(--text-main)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textAlign: 'center'
                  }}
                >
                  🥛 Consumer
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('agent')}
                  style={{
                    padding: '0.65rem 0.4rem',
                    borderRadius: '12px',
                    border: role === 'agent' ? '2px solid var(--accent-amber)' : '1px solid var(--border-color)',
                    background: role === 'agent' ? 'var(--accent-amber-light)' : 'var(--bg-primary)',
                    color: role === 'agent' ? 'var(--accent-amber)' : 'var(--text-main)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textAlign: 'center'
                  }}
                >
                  🚚 Agent
                </button>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Full Name</label>
              <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={formData.name}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Email Address</label>
              <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="e.g. ramesh@healthymilk.com"
                  value={formData.email}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            {/* Mobile Number for OTP Verification */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Mobile Number (for SMS OTP Verification)
              </label>
              <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                <Phone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="tel"
                  name="phone"
                  required
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    fontWeight: 700
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Password (minimum 6 characters)</label>
              <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.5rem 0.75rem 2.5rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    color: 'var(--text-muted)'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Confirm Password</label>
              <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  required
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            {/* Role-specific fields */}
            {role === 'farmer' && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Farm Name</label>
                <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                  <Building size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    name="farmName"
                    placeholder="e.g. Patel Organic Dairy Farm"
                    value={formData.farmName}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-main)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>
            )}

            {role === 'consumer' && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Delivery Address</label>
                <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                  <MapPin size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    name="address"
                    placeholder="e.g. Apt 402, Green Acres"
                    value={formData.address}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-main)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>
            )}

            {role === 'agent' && (
              <>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Vehicle Number</label>
                  <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                    <Truck size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      name="vehicleNo"
                      placeholder="e.g. GJ-07-MK-4421"
                      value={formData.vehicleNo}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-main)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Assigned Area</label>
                  <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                    <Navigation size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      name="assignedArea"
                      placeholder="e.g. Sector 14 & Green Valley"
                      value={formData.assignedArea}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-main)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.85rem' }}
            >
              {loading ? 'Validating Details...' : 'Send Verification OTP to Phone'}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        {/* SIGNUP STEP 2: Phone OTP Verification Card */}
        {isSignup && signupStep === 2 && (
          <form onSubmit={handleVerifyOTPAndSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'var(--accent-emerald-light)',
              border: '1px solid var(--accent-emerald)',
              borderRadius: '16px',
              padding: '1.1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
                📱 Mobile OTP Sent
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                +91 {formData.phone}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Please enter the 6-digit verification code sent to your phone.
              </p>

              {sentOtp && (
                <div style={{
                  marginTop: '0.75rem',
                  background: 'var(--bg-card)',
                  border: '1px dashed var(--accent-emerald)',
                  borderRadius: '10px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--accent-emerald)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  <Sparkles size={15} /> Demo OTP Code: <strong style={{ letterSpacing: '2px', fontSize: '0.95rem' }}>{sentOtp}</strong>
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Enter 6-Digit OTP Code
              </label>
              <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                <KeyRound size={20} color="var(--accent-emerald)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="e.g. 123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^\d]/g, ''))}
                  style={{
                    width: '100%',
                    padding: '0.85rem 0.75rem 0.85rem 2.75rem',
                    borderRadius: '12px',
                    border: '2px solid var(--accent-emerald)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    letterSpacing: '4px',
                    textAlign: 'left'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <button
                type="button"
                onClick={() => setSignupStep(1)}
                style={{ background: 'none', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <ArrowLeft size={15} /> Edit Phone & Details
              </button>

              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resendTimer > 0 || loading}
                style={{
                  background: 'none',
                  color: resendTimer > 0 ? 'var(--text-muted)' : 'var(--accent-emerald)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <RotateCcw size={14} /> {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.85rem' }}
            >
              {loading ? 'Verifying OTP & Creating Account...' : 'Verify OTP & Create Account'}
              <ShieldCheck size={18} />
            </button>
          </form>
        )}

        {/* SIGN IN FORM */}
        {!isSignup && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            
            {/* Role Selector */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                Select Account Role
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleRoleChange('farmer')}
                  style={{
                    padding: '0.65rem 0.4rem',
                    borderRadius: '12px',
                    border: role === 'farmer' ? '2px solid var(--accent-emerald)' : '1px solid var(--border-color)',
                    background: role === 'farmer' ? 'var(--accent-emerald-light)' : 'var(--bg-primary)',
                    color: role === 'farmer' ? 'var(--accent-emerald)' : 'var(--text-main)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textAlign: 'center'
                  }}
                >
                  🌾 Farmer
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('consumer')}
                  style={{
                    padding: '0.65rem 0.4rem',
                    borderRadius: '12px',
                    border: role === 'consumer' ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                    background: role === 'consumer' ? 'var(--accent-blue-light)' : 'var(--bg-primary)',
                    color: role === 'consumer' ? 'var(--accent-blue)' : 'var(--text-main)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textAlign: 'center'
                  }}
                >
                  🥛 Consumer
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('agent')}
                  style={{
                    padding: '0.65rem 0.4rem',
                    borderRadius: '12px',
                    border: role === 'agent' ? '2px solid var(--accent-amber)' : '1px solid var(--border-color)',
                    background: role === 'agent' ? 'var(--accent-amber-light)' : 'var(--bg-primary)',
                    color: role === 'agent' ? 'var(--accent-amber)' : 'var(--text-main)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textAlign: 'center'
                  }}
                >
                  🚚 Agent
                </button>
              </div>
            </div>

            {/* Email or Mobile Number */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Email Address or Registered Mobile Number
              </label>
              <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  name="email"
                  required
                  placeholder="e.g. farmer@healthymilk.com or 9876543210"
                  value={formData.email}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Password</label>
              <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.5rem 0.75rem 2.5rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    color: 'var(--text-muted)'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.85rem' }}
            >
              {loading ? 'Validating Credentials...' : 'Sign In to Dairy Portal'}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
