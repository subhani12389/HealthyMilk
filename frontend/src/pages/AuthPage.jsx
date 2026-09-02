import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { 
  Milk, User, Lock, Mail, MapPin, Building, ArrowRight, 
  Eye, EyeOff, ShieldCheck, CheckCircle2, Truck, Navigation, 
  Sparkles, Zap, Phone, AlertCircle, X, HelpCircle, Check
} from 'lucide-react';

export default function AuthPage() {
  const { loginUser } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [role, setRole] = useState('farmer');

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    farmName: '',
    address: '',
    vehicleNo: '',
    assignedArea: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotTarget, setForgotTarget] = useState('');
  const [forgotStatus, setForgotStatus] = useState({ loading: false, msg: '', error: false });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Password Strength Validation State
  const pwdValidation = {
    minLength: (formData.password || '').length >= 8,
    hasUpper: /[A-Z]/.test(formData.password || ''),
    hasLower: /[a-z]/.test(formData.password || ''),
    hasNumber: /[0-9]/.test(formData.password || ''),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password || '')
  };

  const isPasswordStrong = Object.values(pwdValidation).every(Boolean);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((formData.email || '').trim().toLowerCase());
  const isMobileValid = /^[0-9]{10}$/.test((formData.mobile || '').replace(/[^\d]/g, ''));
  const isNameValid = (formData.name || '').trim().length >= 2;
  const isConfirmMatch = formData.password && formData.password === formData.confirmPassword;

  const isSignupFormValid = isNameValid && isEmailValid && isMobileValid && isPasswordStrong && isConfirmMatch;

  // Role Selection Helper
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setErrorMsg('');
    setSuccessMsg('');
  };

  // Instant 1-Click Demo Login
  const handleQuickLogin = async (targetRole, targetEmail) => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setRole(targetRole);

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: targetEmail, password: 'password123', role: targetRole })
      });

      if (data.success && data.user) {
        setSuccessMsg(`Welcome back, ${data.user.name}!`);
        setTimeout(() => {
          loginUser(data.user, data.token);
        }, 300);
      } else {
        setErrorMsg(data.message || 'Quick sign in failed.');
      }
    } catch (err) {
      setErrorMsg('Server connection error. Please verify backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'mobile') {
      // Restrict mobile input to numeric digits only, max 10 characters
      const cleanDigits = value.replace(/[^\d]/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, mobile: cleanDigits }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    if (errorMsg) setErrorMsg('');
  };

  // Signup Submit
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isSignupFormValid) {
      if (!isNameValid) setErrorMsg('Please enter a valid full name (minimum 2 characters).');
      else if (!isEmailValid) setErrorMsg('Please enter a valid email address.');
      else if (!isMobileValid) setErrorMsg('Mobile number must be exactly 10 numeric digits.');
      else if (!isPasswordStrong) setErrorMsg('Password does not meet strong password security criteria.');
      else if (!isConfirmMatch) setErrorMsg('Confirm Password must exactly match Password.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          email: formData.email.trim().toLowerCase(),
          mobile: formData.mobile.trim(),
          role
        })
      });

      if (data.success && data.user) {
        setSuccessMsg(data.message || 'Account created successfully!');
        setTimeout(() => {
          loginUser(data.user, data.token);
        }, 400);
      } else {
        setErrorMsg(data.message || 'Registration failed. Please check details.');
      }
    } catch (err) {
      setErrorMsg('Server error during registration. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  // Sign In Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.email || !formData.password) {
      setLoading(false);
      setErrorMsg('Please enter both your registered email/mobile number and password.');
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
        setErrorMsg(data.message || 'Invalid email/mobile number or password.');
      }
    } catch (err) {
      setErrorMsg('Server connection error. Please verify backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Submit
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!forgotTarget.trim()) return;
    setForgotStatus({ loading: true, msg: '', error: false });

    try {
      const data = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier: forgotTarget.trim() })
      });

      setForgotStatus({
        loading: false,
        msg: data.message || 'Reset instructions have been sent if account exists.',
        error: false
      });
    } catch (err) {
      setForgotStatus({
        loading: false,
        msg: 'Server error processing request. Please try again.',
        error: true
      });
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
              ? 'Create a secure production account for HealthyMilk' 
              : 'Sign in to access your dairy management portal'}
          </p>
        </div>

        {/* 1-Click Quick Access Shortcuts (Sign In Mode Only) */}
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
              <Zap size={15} color="var(--accent-amber)" /> 1-Click Instant Demo Role Sign In
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

        {/* Tab Switcher: Sign In / Create Account */}
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
            onClick={() => { setIsSignup(false); setErrorMsg(''); setSuccessMsg(''); }}
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
            onClick={() => { setIsSignup(true); setErrorMsg(''); setSuccessMsg(''); }}
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

        {/* SIGNUP FORM */}
        {isSignup && (
          <form onSubmit={handleSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            
            {/* Role Selection Buttons */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                Select User Role <span style={{ color: 'var(--accent-rose)' }}>*</span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Full Name</label>
                {formData.name && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isNameValid ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    {isNameValid ? '✓ Valid Name' : 'Min 2 characters'}
                  </span>
                )}
              </div>
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
                    border: formData.name ? (isNameValid ? '1px solid var(--accent-emerald)' : '1px solid var(--accent-rose)') : '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Email Address</label>
                {formData.email && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isEmailValid ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    {isEmailValid ? '✓ Valid Email' : 'Invalid Email Format'}
                  </span>
                )}
              </div>
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
                    border: formData.email ? (isEmailValid ? '1px solid var(--accent-emerald)' : '1px solid var(--accent-rose)') : '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            {/* Mobile Number (Strict 10 Digits Numeric) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Mobile Number (10 Digits)</label>
                {formData.mobile && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isMobileValid ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    {isMobileValid ? '✓ 10 Digits Valid' : `${formData.mobile.length}/10 Digits`}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                <Phone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="tel"
                  name="mobile"
                  required
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={formData.mobile}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    borderRadius: '10px',
                    border: formData.mobile ? (isMobileValid ? '1px solid var(--accent-emerald)' : '1px solid var(--accent-rose)') : '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    letterSpacing: '1px'
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
                    border: formData.password ? (isPasswordStrong ? '1px solid var(--accent-emerald)' : '1px solid var(--accent-amber)') : '1px solid var(--border-color)',
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
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password Security Criteria Checklist */}
              {formData.password && (
                <div style={{
                  marginTop: '0.6rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.35rem',
                  fontSize: '0.72rem'
                }}>
                  <div style={{ color: pwdValidation.minLength ? 'var(--accent-emerald)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {pwdValidation.minLength ? <Check size={13} /> : '•'} 8+ Characters
                  </div>
                  <div style={{ color: pwdValidation.hasUpper ? 'var(--accent-emerald)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {pwdValidation.hasUpper ? <Check size={13} /> : '•'} Uppercase (A-Z)
                  </div>
                  <div style={{ color: pwdValidation.hasLower ? 'var(--accent-emerald)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {pwdValidation.hasLower ? <Check size={13} /> : '•'} Lowercase (a-z)
                  </div>
                  <div style={{ color: pwdValidation.hasNumber ? 'var(--accent-emerald)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {pwdValidation.hasNumber ? <Check size={13} /> : '•'} Number (0-9)
                  </div>
                  <div style={{ color: pwdValidation.hasSpecial ? 'var(--accent-emerald)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', gridColumn: 'span 2' }}>
                    {pwdValidation.hasSpecial ? <Check size={13} /> : '•'} Special Symbol (!@#$%^&*)
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Confirm Password</label>
                {formData.confirmPassword && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isConfirmMatch ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    {isConfirmMatch ? '✓ Passwords Match' : 'Passwords Do Not Match'}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  required
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.5rem 0.75rem 2.5rem',
                    borderRadius: '10px',
                    border: formData.confirmPassword ? (isConfirmMatch ? '1px solid var(--accent-emerald)' : '1px solid var(--accent-rose)') : '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Role-specific optional fields */}
            {role === 'farmer' && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Farm Name (Optional)</label>
                <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                  <Building size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    name="farmName"
                    placeholder="e.g. Patel Dairy Farm"
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
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Delivery Address (Optional)</label>
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
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Vehicle Number (Optional)</label>
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
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Assigned Area (Optional)</label>
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
              disabled={loading || !isSignupFormValid}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                marginTop: '0.5rem',
                padding: '0.85rem',
                opacity: (loading || !isSignupFormValid) ? 0.6 : 1,
                cursor: (loading || !isSignupFormValid) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Processing Signup...' : 'Create Account'}
              <ShieldCheck size={18} />
            </button>
          </form>
        )}

        {/* SIGN IN FORM */}
        {!isSignup && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            
            {/* Email or Mobile Number Input */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Email Address or 10-Digit Mobile Number
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-emerald)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Forgot Password?
                </button>
              </div>
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
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
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
              {loading ? 'Authenticating Credentials...' : 'Sign In'}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showForgotPassword && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 1000
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '2rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HelpCircle color="var(--accent-emerald)" size={22} /> Password Recovery
              </h3>
              <button
                type="button"
                onClick={() => { setShowForgotPassword(false); setForgotStatus({ loading: false, msg: '', error: false }); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              Enter your registered Email Address or 10-Digit Mobile Number to receive password reset instructions.
            </p>

            {forgotStatus.msg && (
              <div style={{
                background: forgotStatus.error ? 'var(--accent-rose-light)' : 'var(--accent-emerald-light)',
                color: forgotStatus.error ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: '1rem'
              }}>
                {forgotStatus.msg}
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Email or Mobile Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. farmer@healthymilk.com or 9876543210"
                  value={forgotTarget}
                  onChange={(e) => setForgotTarget(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    marginTop: '0.35rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(false); setForgotStatus({ loading: false, msg: '', error: false }); }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotStatus.loading}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center', padding: '0.75rem' }}
                >
                  {forgotStatus.loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
