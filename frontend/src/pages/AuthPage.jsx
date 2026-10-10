import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../utils/api';
import { 
  Milk, ArrowRight, ShieldCheck, CheckCircle2, 
  AlertCircle, ArrowLeft, Lock, Mail, User, 
  Eye, EyeOff, KeyRound, Loader2, RotateCcw
} from 'lucide-react';

export default function AuthPage() {
  const { loginUser } = useAuth();
  const { showToast } = useToast();
  
  // Auth Modes: 'signin' | 'register' | 'verify_email' | 'forgot' | 'reset'
  const [mode, setMode] = useState('signin');

  // Registration & Sign In Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState('farmer');

  // OTP Verification State
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(0);
  const otpInputRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  // Password Reset State
  const [resetToken, setResetToken] = useState('');

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Countdown timer for Resend OTP
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

  // Focus first OTP box when entering verify_email mode
  useEffect(() => {
    if (mode === 'verify_email') {
      setTimeout(() => {
        otpInputRefs[0]?.current?.focus();
      }, 100);
    }
  }, [mode]);

  // Password Strength Calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: 'None', color: 'var(--text-muted)' };
    let score = 0;
    const hasLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (hasLength) score += 1;
    if (hasUpper && hasLower) score += 1;
    if (hasNumber) score += 1;
    if (hasSpecial || password.length >= 12) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', color: '#EF4444', percent: 25, hasLength, hasUpper, hasLower, hasNumber };
      case 2:
        return { score: 2, label: 'Fair', color: '#F59E0B', percent: 50, hasLength, hasUpper, hasLower, hasNumber };
      case 3:
        return { score: 3, label: 'Good', color: '#3B82F6', percent: 75, hasLength, hasUpper, hasLower, hasNumber };
      case 4:
        return { score: 4, label: 'Strong', color: '#10B981', percent: 100, hasLength, hasUpper, hasLower, hasNumber };
      default:
        return { score: 0, label: 'Weak', color: '#EF4444', percent: 10, hasLength, hasUpper, hasLower, hasNumber };
    }
  }, [password]);

  // Mode Switch Helper
  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
    setSuccessMsg('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // 1. Sign In Handler
  const handleSignIn = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email and password.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password
        })
      });

      if (data && data.success && data.user && data.token) {
        showToast(data.message || `Welcome back, ${data.user.name}!`, 'success');
        loginUser(data.user, data.token);
      } else if (data && data.unverified) {
        // Account exists but email is not verified -> prompt OTP verification
        setMaskedEmail(data.maskedEmail || email.trim());
        setResendTimer(60);
        showToast('Please verify your email address to continue.', 'warning');
        setMode('verify_email');
      } else {
        const msg = data?.message || 'Invalid email or password. Please try again.';
        setErrorMsg(msg);
        showToast(msg, 'error');
      }
    } catch (err) {
      setErrorMsg('Unable to connect to authentication server. Please check your network.');
      showToast('Connection error.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2. Register Handler -> Sends Email OTP
  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    setErrorMsg('');
    setSuccessMsg('');

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMsg('Password must be at least 8 characters and include uppercase, lowercase, and numbers.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter your password.');
      return;
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: cleanEmail,
          password,
          role: selectedRole
        })
      });

      if (data && data.success) {
        setMaskedEmail(data.maskedEmail || cleanEmail);
        setResendTimer(data.resendCooldownSeconds || 60);
        setOtpDigits(['', '', '', '', '', '']);
        setSuccessMsg(data.message || `We sent a verification code to ${data.maskedEmail || cleanEmail}`);
        showToast('Verification code sent to your email!', 'success');
        setMode('verify_email');
      } else {
        const msg = data?.message || 'Registration failed. Please check your details.';
        setErrorMsg(msg);
        showToast(msg, 'error');
      }
    } catch (err) {
      setErrorMsg('Server connection error during registration.');
      showToast('Registration connection error.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 3. Segmented OTP Handlers
  const handleOtpBoxChange = (index, value) => {
    const cleanDigit = value.replace(/[^\d]/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleanDigit;
    setOtpDigits(newDigits);
    if (errorMsg) setErrorMsg('');

    // Auto-advance focus to next input box
    if (cleanDigit && index < 5 && otpInputRefs[index + 1]?.current) {
      otpInputRefs[index + 1].current.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0 && otpInputRefs[index - 1]?.current) {
      otpInputRefs[index - 1].current.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^\d]/g, '').slice(0, 6);
    if (pastedData.length > 0) {
      const digits = pastedData.split('');
      const newDigits = ['', '', '', '', '', ''];
      digits.forEach((d, idx) => { if (idx < 6) newDigits[idx] = d; });
      setOtpDigits(newDigits);
      
      const nextFocusIdx = Math.min(pastedData.length, 5);
      if (otpInputRefs[nextFocusIdx]?.current) {
        otpInputRefs[nextFocusIdx].current.focus();
      }
    }
  };

  // 4. Verify Email OTP Handler
  const handleVerifyEmail = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    setErrorMsg('');
    setSuccessMsg('');

    const enteredOtp = otpDigits.join('');
    if (enteredOtp.length !== 6) {
      setErrorMsg('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: enteredOtp
        })
      });

      if (data && data.success && data.user && data.token) {
        showToast(data.message || 'Email verified successfully! Welcome to HealthyMilk.', 'success');
        loginUser(data.user, data.token);
      } else {
        const msg = data?.message || 'Invalid or expired verification code.';
        setErrorMsg(msg);
        showToast(msg, 'error');
      }
    } catch (err) {
      setErrorMsg('Server connection error verifying email.');
      showToast('Error verifying code.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 5. Resend Verification Code Handler
  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase()
        })
      });

      if (data && data.success) {
        setOtpDigits(['', '', '', '', '', '']);
        setResendTimer(data.resendCooldownSeconds || 60);
        setSuccessMsg(data.message || 'A new verification code has been sent to your email.');
        showToast('New verification code sent!', 'success');
        otpInputRefs[0]?.current?.focus();
      } else {
        const msg = data?.message || 'Failed to resend verification code.';
        setErrorMsg(msg);
        showToast(msg, 'error');
      }
    } catch (err) {
      setErrorMsg('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  // 6. Forgot Password Handler
  const handleForgotPassword = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase()
        })
      });

      if (data && data.success) {
        setSuccessMsg(data.message || 'Password reset instructions have been generated.');
        showToast('Password reset instructions generated.', 'success');
        if (data.resetToken) {
          setResetToken(data.resetToken);
          setTimeout(() => {
            setMode('reset');
          }, 1200);
        }
      } else {
        const msg = data?.message || 'Error processing request.';
        setErrorMsg(msg);
      }
    } catch (err) {
      setErrorMsg('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  // 7. Reset Password Handler
  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    setErrorMsg('');
    setSuccessMsg('');

    if (!resetToken.trim()) {
      setErrorMsg('Please enter the password reset token.');
      return;
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMsg('Password must be at least 8 characters and include uppercase, lowercase, and numbers.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          resetToken: resetToken.trim(),
          newPassword: password
        })
      });

      if (data && data.success) {
        showToast('Password updated successfully! Please sign in.', 'success');
        setSuccessMsg('Password updated successfully! Please sign in with your new password.');
        setPassword('');
        setConfirmPassword('');
        setResetToken('');
        setTimeout(() => {
          switchMode('signin');
        }, 1500);
      } else {
        const msg = data?.message || 'Invalid or expired reset token.';
        setErrorMsg(msg);
        showToast(msg, 'error');
      }
    } catch (err) {
      setErrorMsg('Server connection error resetting password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100%',
      overflowX: 'hidden',
      background: 'radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.12), transparent 45%), radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.12), transparent 45%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'clamp(1rem, 3vw, 2.5rem) clamp(0.75rem, 2vw, 1.25rem)',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%',
        maxWidth: mode === 'register' ? '540px' : '460px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'clamp(16px, 4vw, 24px)',
        boxShadow: 'var(--shadow-lg)',
        padding: 'clamp(1.25rem, 4vw, 2.25rem)',
        backdropFilter: 'blur(20px)',
        boxSizing: 'border-box',
        transition: 'max-width 0.25s ease'
      }}>
        
        {/* Brand Header */}
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
            marginBottom: '0.75rem',
            boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)'
          }}>
            <Milk size={30} />
          </div>
          <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.75rem)', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            Healthy<span style={{ color: 'var(--accent-emerald)' }}>Milk</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            {mode === 'signin' && 'Sign in to access your pure dairy dashboard'}
            {mode === 'register' && 'Create your account in the HealthyMilk network'}
            {mode === 'verify_email' && 'Verify your email address to activate your account'}
            {mode === 'forgot' && 'Reset your account password securely'}
            {mode === 'reset' && 'Set a new secure password'}
          </p>
        </div>

        {/* Tab Switcher for Sign In / Register */}
        {(mode === 'signin' || mode === 'register') && (
          <div style={{
            display: 'flex',
            background: 'var(--bg-primary)',
            padding: '4px',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            marginBottom: '1.25rem'
          }}>
            <button
              type="button"
              onClick={() => switchMode('signin')}
              style={{
                flex: 1,
                padding: '0.65rem',
                borderRadius: '10px',
                border: 'none',
                background: mode === 'signin' ? 'var(--bg-card)' : 'transparent',
                color: mode === 'signin' ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: mode === 'signin' ? 700 : 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: mode === 'signin' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              style={{
                flex: 1,
                padding: '0.65rem',
                borderRadius: '10px',
                border: 'none',
                background: mode === 'register' ? 'var(--bg-card)' : 'transparent',
                color: mode === 'register' ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: mode === 'register' ? 700 : 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: mode === 'register' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Register
            </button>
          </div>
        )}

        {/* Inline Feedback Alerts */}
        {errorMsg && (
          <div role="alert" style={{
            background: 'var(--accent-rose-light)',
            color: 'var(--accent-rose)',
            padding: '0.75rem 0.9rem',
            borderRadius: '12px',
            fontSize: '0.82rem',
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
          <div role="status" aria-live="polite" style={{
            background: 'var(--accent-emerald-light)',
            color: 'var(--accent-emerald)',
            padding: '0.75rem 0.9rem',
            borderRadius: '12px',
            fontSize: '0.82rem',
            marginBottom: '1.25rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} /> {successMsg}
          </div>
        )}

        {/* ==================================================== */}
        {/* VIEW 1: SIGN IN FORM */}
        {/* ==================================================== */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Email Field */}
            <div>
              <label htmlFor="signin-email" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errorMsg) setErrorMsg(''); }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem 0.75rem 2.4rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label htmlFor="signin-password" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-emerald)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errorMsg) setErrorMsg(''); }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.5rem 0.75rem 2.4rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '12px',
                marginTop: '0.5rem'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="pulse-anim" /> Signing in...
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={18} />
                </>
              )}
            </button>

            {/* Switch to Register */}
            <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-emerald)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                Create Account
              </button>
            </div>
          </form>
        )}

        {/* ==================================================== */}
        {/* VIEW 2: REGISTER FORM */}
        {/* ==================================================== */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Full Name */}
            <div>
              <label htmlFor="reg-name" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); if (errorMsg) setErrorMsg(''); }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem 0.75rem 2.4rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errorMsg) setErrorMsg(''); }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem 0.75rem 2.4rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Role Selection Cards */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                I am registering as:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {/* Farmer */}
                <div
                  onClick={() => setSelectedRole('farmer')}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: '12px',
                    border: selectedRole === 'farmer' ? '2px solid var(--accent-emerald)' : '1px solid var(--border-color)',
                    background: selectedRole === 'farmer' ? 'var(--accent-emerald-light)' : 'var(--bg-primary)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontSize: '1.25rem', marginBottom: '2px' }}>🧑‍🌾</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)' }}>Farmer</div>
                </div>

                {/* Consumer */}
                <div
                  onClick={() => setSelectedRole('consumer')}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: '12px',
                    border: selectedRole === 'consumer' ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                    background: selectedRole === 'consumer' ? 'var(--accent-blue-light)' : 'var(--bg-primary)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontSize: '1.25rem', marginBottom: '2px' }}>🥛</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)' }}>Consumer</div>
                </div>

                {/* Delivery Agent */}
                <div
                  onClick={() => setSelectedRole('delivery_agent')}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: '12px',
                    border: selectedRole === 'delivery_agent' ? '2px solid var(--accent-amber)' : '1px solid var(--border-color)',
                    background: selectedRole === 'delivery_agent' ? 'var(--accent-amber-light)' : 'var(--bg-primary)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontSize: '1.25rem', marginBottom: '2px' }}>🚚</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)' }}>Agent</div>
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label htmlFor="reg-password" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Password
                </label>
                {password && (
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errorMsg) setErrorMsg(''); }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.5rem 0.75rem 2.4rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {/* Password Strength Meter Bar */}
              {password && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ height: '4px', width: '100%', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${passwordStrength.percent}%`,
                      background: passwordStrength.color,
                      transition: 'all 0.3s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span style={{ color: password.length >= 8 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                      {password.length >= 8 ? '✓' : '•'} 8+ chars
                    </span>
                    <span style={{ color: /[A-Z]/.test(password) ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                      {/[A-Z]/.test(password) ? '✓' : '•'} Uppercase
                    </span>
                    <span style={{ color: /[a-z]/.test(password) ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                      {/[a-z]/.test(password) ? '✓' : '•'} Lowercase
                    </span>
                    <span style={{ color: /[0-9]/.test(password) ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                      {/[0-9]/.test(password) ? '✓' : '•'} Number
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="reg-confirm-password" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); if (errorMsg) setErrorMsg(''); }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.5rem 0.75rem 2.4rem',
                    borderRadius: '12px',
                    border: confirmPassword && confirmPassword === password ? '2px solid var(--accent-emerald)' : '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !fullName || !email || !password || password !== confirmPassword}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '12px',
                marginTop: '0.5rem'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="pulse-anim" /> Sending Code...
                </>
              ) : (
                <>
                  Create Account & Send Code <ArrowRight size={18} />
                </>
              )}
            </button>

            {/* Switch to Sign In */}
            <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signin')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-emerald)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* ==================================================== */}
        {/* VIEW 3: VERIFY EMAIL OTP */}
        {/* ==================================================== */}
        {mode === 'verify_email' && (
          <form onSubmit={handleVerifyEmail} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'var(--accent-emerald-light)',
              border: '1px solid var(--accent-emerald)',
              borderRadius: '16px',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--accent-emerald)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ✉️ Email Verification Required
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {maskedEmail || email}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                We sent a 6-digit verification code to your email address. Enter the code below to verify and activate your HealthyMilk account.
              </p>
            </div>

            {/* 6 Auto-Advancing Segmented OTP Boxes */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', textAlign: 'center' }}>
                Enter 6-Digit Verification Code
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'clamp(4px, 1.5vw, 8px)' }}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={otpInputRefs[idx]}
                    aria-label={`Digit ${idx + 1}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpBoxChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    style={{
                      width: '100%',
                      height: 'clamp(44px, 11vw, 54px)',
                      borderRadius: 'clamp(8px, 2vw, 12px)',
                      border: digit ? '2px solid var(--accent-emerald)' : '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-main)',
                      fontSize: 'clamp(1.1rem, 4.5vw, 1.35rem)',
                      fontWeight: 800,
                      textAlign: 'center',
                      padding: 0,
                      boxShadow: digit ? '0 0 0 3px rgba(16, 185, 129, 0.15)' : 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Actions: Change Email & Resend Code */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <button
                type="button"
                onClick={() => switchMode('register')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <ArrowLeft size={15} /> Change Details
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendTimer > 0 || loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendTimer > 0 ? 'var(--text-muted)' : 'var(--accent-emerald)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: resendTimer > 0 ? 'not-allowed' : 'pointer',
                  padding: 0
                }}
              >
                <RotateCcw size={14} /> {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
              </button>
            </div>

            {/* Verify Email Submit */}
            <button
              type="submit"
              disabled={loading || otpDigits.join('').length !== 6}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.9rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '12px'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="pulse-anim" /> Verifying Code...
                </>
              ) : (
                <>
                  Verify Email & Open Dashboard <ShieldCheck size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ==================================================== */}
        {/* VIEW 4: FORGOT PASSWORD */}
        {/* ==================================================== */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div style={{
              background: 'var(--accent-blue-light)',
              borderRadius: '14px',
              padding: '0.9rem',
              fontSize: '0.82rem',
              color: 'var(--accent-blue)',
              fontWeight: 600,
              lineHeight: '1.4'
            }}>
              Enter your registered email address and we'll send you a single-use token to securely reset your password.
            </div>

            <div>
              <label htmlFor="forgot-email" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Registered Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errorMsg) setErrorMsg(''); }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem 0.75rem 2.4rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '12px'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="pulse-anim" /> Generating Token...
                </>
              ) : (
                <>
                  Generate Reset Token <KeyRound size={18} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => switchMode('signin')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
                marginTop: '0.25rem'
              }}
            >
              <ArrowLeft size={16} /> Back to Sign In
            </button>
          </form>
        )}

        {/* ==================================================== */}
        {/* VIEW 5: RESET PASSWORD */}
        {/* ==================================================== */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Reset Token Field */}
            <div>
              <label htmlFor="reset-token" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Reset Security Token
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="reset-token"
                  type="text"
                  required
                  placeholder="Paste your reset token here"
                  value={resetToken}
                  onChange={(e) => { setResetToken(e.target.value); if (errorMsg) setErrorMsg(''); }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem 0.75rem 2.4rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* New Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label htmlFor="reset-new-password" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  New Password
                </label>
                {password && (
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="reset-new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  placeholder="Min. 8 chars (Upper, lower, number)"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errorMsg) setErrorMsg(''); }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.5rem 0.75rem 2.4rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {/* Strength meter */}
              {password && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ height: '4px', width: '100%', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${passwordStrength.percent}%`,
                      background: passwordStrength.color,
                      transition: 'all 0.3s ease'
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="reset-confirm-password" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); if (errorMsg) setErrorMsg(''); }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.5rem 0.75rem 2.4rem',
                    borderRadius: '12px',
                    border: confirmPassword && confirmPassword === password ? '2px solid var(--accent-emerald)' : '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !resetToken || !password || password !== confirmPassword}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '12px'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="pulse-anim" /> Updating Password...
                </>
              ) : (
                <>
                  Update Password & Sign In <ShieldCheck size={18} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => switchMode('signin')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
                marginTop: '0.25rem'
              }}
            >
              <ArrowLeft size={16} /> Back to Sign In
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
