import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { 
  Milk, ArrowRight, ShieldCheck, CheckCircle2, Phone, 
  AlertCircle, ArrowLeft, KeyRound, RotateCcw, Sparkles, User, Truck
} from 'lucide-react';

export default function AuthPage() {
  const { loginUser } = useAuth();
  
  // Auth Steps: 1 = Phone Input, 2 = OTP Verification, 3 = Account Type Selection (New Users)
  const [step, setStep] = useState(1);
  const [mobileNumber, setMobileNumber] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(false);

  // Step 2: OTP State (Array of 6 digits)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [sentOtpPreview, setSentOtpPreview] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const otpInputRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  // Step 3: Account Type Selection State
  const [selectedRole, setSelectedRole] = useState('consumer');
  const [verificationToken, setVerificationToken] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Countdown timer effect for Resend OTP
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

  // Handle Phone Input (Only 10 Digits Allowed)
  const handlePhoneChange = (e) => {
    const cleanDigits = e.target.value.replace(/[^\d]/g, '').slice(0, 10);
    setMobileNumber(cleanDigits);
    if (errorMsg) setErrorMsg('');
  };

  // Step 1: Send OTP Submit
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const clean = mobileNumber.replace(/[^\d]/g, '');
    if (!clean || clean.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone: clean,
          mobile: clean,
          phoneNumber: clean
        })
      });

      if (data.success) {
        setMaskedPhone(data.maskedPhone || `+91 XXXXXXX${clean.slice(7)}`);
        setIsExistingUser(Boolean(data.isExistingUser));
        setSentOtpPreview(data.otp || '');
        setSuccessMsg(data.message || `We've sent a verification code to +91 XXXXXXX${clean.slice(7)}`);
        setStep(2);
        setResendTimer(30);
        
        // Auto-fill OTP in demo mode for instant testing convenience
        if (data.otp) {
          const digits = data.otp.toString().split('').slice(0, 6);
          setOtpDigits(digits);
        }

        // Focus first OTP box
        setTimeout(() => {
          if (otpInputRefs[0]?.current) {
            otpInputRefs[0].current.focus();
          }
        }, 100);
      } else {
        setErrorMsg(data.message || 'Failed to send OTP. Please check your phone number.');
      }
    } catch (err) {
      setErrorMsg('Server connection error. Please verify backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  // OTP Box Inputs & Auto-Focusing
  const handleOtpBoxChange = (index, value) => {
    const cleanDigit = value.replace(/[^\d]/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleanDigit;
    setOtpDigits(newDigits);
    if (errorMsg) setErrorMsg('');

    // Auto-focus next input box
    if (cleanDigit && index < 5 && otpInputRefs[index + 1]?.current) {
      otpInputRefs[index + 1].current.focus();
    }
  };

  // Support OTP Paste into boxes
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

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0 && otpInputRefs[index - 1]?.current) {
      otpInputRefs[index - 1].current.focus();
    }
  };

  // Resend OTP Handler
  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone: mobileNumber,
          mobile: mobileNumber,
          phoneNumber: mobileNumber
        })
      });

      if (data.success) {
        setSentOtpPreview(data.otp || '');
        if (data.otp) {
          setOtpDigits(data.otp.toString().split('').slice(0, 6));
        }
        setSuccessMsg(`New OTP sent to ${maskedPhone}`);
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

  // Step 2: Verify OTP Submit
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const enteredOtp = otpDigits.join('');
    if (enteredOtp.length !== 6) {
      setErrorMsg('Please enter the full 6-digit OTP verification code.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: mobileNumber,
          mobile: mobileNumber,
          otp: enteredOtp
        })
      });

      if (data.success) {
        // EXISTING USER FLOW: Auto-login & redirect to role dashboard
        if (data.isExistingUser && data.user && data.token) {
          setSuccessMsg(`Welcome back, ${data.user.name}!`);
          setTimeout(() => {
            loginUser(data.user, data.token);
          }, 300);
        } else {
          // NEW USER FLOW: Phone verified -> Advance to Step 3 Account Type selection
          setVerificationToken(data.verificationToken || '');
          setSuccessMsg('Phone number verified! Please choose your account type.');
          setStep(3);
        }
      } else {
        setErrorMsg(data.message || 'Invalid OTP. Please try again.');
      }
    } catch (err) {
      setErrorMsg('Server connection error verifying OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Account Creation Submit (New Users)
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/create-account', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: mobileNumber,
          countryCode: '+91',
          role: selectedRole,
          verificationToken
        })
      });

      if (data.success && data.user && data.token) {
        setSuccessMsg(`Account created successfully! Welcome to HealthyMilk.`);
        setTimeout(() => {
          loginUser(data.user, data.token);
        }, 300);
      } else {
        setErrorMsg(data.message || 'Failed to create account. Please try again.');
      }
    } catch (err) {
      setErrorMsg('Server error creating account.');
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
        maxWidth: '480px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '24px',
        boxShadow: 'var(--shadow-lg)',
        padding: '2.5rem',
        backdropFilter: 'blur(20px)'
      }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            marginBottom: '0.85rem',
            boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)'
          }}>
            <Milk size={34} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Healthy<span style={{ color: 'var(--accent-emerald)' }}>Milk</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            {step === 1 && 'Welcome to HealthyMilk – Enter your phone number'}
            {step === 2 && 'Verify Phone Number'}
            {step === 3 && 'Choose Your Account Type'}
          </p>
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

        {/* ==================================================== */}
        {/* STEP 1: Enter Phone Number Screen */}
        {/* ==================================================== */}
        {step === 1 && (
          <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Mobile Phone Number
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                {/* Country Code Badge */}
                <div style={{
                  padding: '0.85rem 0.9rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  <span>🇮🇳</span> +91
                </div>

                {/* 10-Digit Mobile Input */}
                <div style={{ position: 'relative', flex: 1 }}>
                  <Phone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={mobileNumber}
                    onChange={handlePhoneChange}
                    style={{
                      width: '100%',
                      padding: '0.85rem 0.75rem 0.85rem 2.5rem',
                      borderRadius: '12px',
                      border: mobileNumber.length === 10 ? '2px solid var(--accent-emerald)' : '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-main)',
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      letterSpacing: '1px'
                    }}
                  />
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.4rem' }}>
                Enter your 10-digit Indian mobile number to receive verification OTP.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || mobileNumber.length !== 10}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.9rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '12px',
                opacity: (loading || mobileNumber.length !== 10) ? 0.6 : 1,
                cursor: (loading || mobileNumber.length !== 10) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Sending Verification OTP...' : 'Continue'}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        {/* ==================================================== */}
        {/* STEP 2: Verify Phone Number (6-Digit OTP Screen) */}
        {/* ==================================================== */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'var(--accent-emerald-light)',
              border: '1px solid var(--accent-emerald)',
              borderRadius: '16px',
              padding: '1.1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
                📱 Mobile OTP Verification Code
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {maskedPhone}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                We've sent a 6-digit verification code to your phone.
              </p>

              {sentOtpPreview && (
                <div style={{
                  marginTop: '0.75rem',
                  background: 'var(--bg-card)',
                  border: '1px dashed var(--accent-emerald)',
                  borderRadius: '10px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--accent-emerald)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  <Sparkles size={15} /> Demo OTP Code: <strong style={{ letterSpacing: '2px', fontSize: '0.95rem' }}>{sentOtpPreview}</strong>
                </div>
              )}
            </div>

            {/* 6 Individual Auto-Focusing OTP Boxes */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', textAlign: 'center' }}>
                Enter 6-Digit Verification Code
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.45rem' }}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={otpInputRefs[idx]}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpBoxChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    style={{
                      width: '100%',
                      height: '52px',
                      borderRadius: '12px',
                      border: digit ? '2px solid var(--accent-emerald)' : '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-main)',
                      fontSize: '1.35rem',
                      fontWeight: 800,
                      textAlign: 'center',
                      boxShadow: digit ? '0 0 0 3px rgba(16, 185, 129, 0.15)' : 'none'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Action buttons & Timer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <button
                type="button"
                onClick={() => { setStep(1); setErrorMsg(''); setSuccessMsg(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
              >
                <ArrowLeft size={15} /> Back
              </button>

              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resendTimer > 0 || loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendTimer > 0 ? 'var(--text-muted)' : 'var(--accent-emerald)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: resendTimer > 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <RotateCcw size={14} /> {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
              </button>
            </div>

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
                borderRadius: '12px',
                opacity: (loading || otpDigits.join('').length !== 6) ? 0.6 : 1,
                cursor: (loading || otpDigits.join('').length !== 6) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Verifying OTP...' : 'Verify OTP'}
              <ShieldCheck size={18} />
            </button>
          </form>
        )}

        {/* ==================================================== */}
        {/* STEP 3: Choose Account Type (New User Flow Only) */}
        {/* ==================================================== */}
        {step === 3 && (
          <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Choose Your Account Type
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Select how you will use HealthyMilk. This can't be changed later.
              </p>
            </div>

            {/* 3 Account Type Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Card 1: Farmer */}
              <div
                onClick={() => setSelectedRole('farmer')}
                style={{
                  padding: '1.1rem',
                  borderRadius: '16px',
                  border: selectedRole === 'farmer' ? '2px solid var(--accent-emerald)' : '1px solid var(--border-color)',
                  background: selectedRole === 'farmer' ? 'var(--accent-emerald-light)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: selectedRole === 'farmer' ? 'var(--accent-emerald)' : 'var(--bg-card)',
                  color: selectedRole === 'farmer' ? '#FFF' : 'var(--accent-emerald)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem'
                }}>
                  🧑‍🌾
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Farmer
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Sell and manage your milk supply.
                  </div>
                </div>
                {selectedRole === 'farmer' && <CheckCircle2 color="var(--accent-emerald)" size={20} />}
              </div>

              {/* Card 2: Consumer */}
              <div
                onClick={() => setSelectedRole('consumer')}
                style={{
                  padding: '1.1rem',
                  borderRadius: '16px',
                  border: selectedRole === 'consumer' ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                  background: selectedRole === 'consumer' ? 'var(--accent-blue-light)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: selectedRole === 'consumer' ? 'var(--accent-blue)' : 'var(--bg-card)',
                  color: selectedRole === 'consumer' ? '#FFF' : 'var(--accent-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem'
                }}>
                  🥛
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Consumer
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Order fresh milk and manage deliveries.
                  </div>
                </div>
                {selectedRole === 'consumer' && <CheckCircle2 color="var(--accent-blue)" size={20} />}
              </div>

              {/* Card 3: Delivery Agent */}
              <div
                onClick={() => setSelectedRole('delivery_agent')}
                style={{
                  padding: '1.1rem',
                  borderRadius: '16px',
                  border: selectedRole === 'delivery_agent' ? '2px solid var(--accent-amber)' : '1px solid var(--border-color)',
                  background: selectedRole === 'delivery_agent' ? 'var(--accent-amber-light)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: selectedRole === 'delivery_agent' ? 'var(--accent-amber)' : 'var(--bg-card)',
                  color: selectedRole === 'delivery_agent' ? '#FFF' : 'var(--accent-amber)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem'
                }}>
                  🚚
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Delivery Agent
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Manage assigned deliveries and orders.
                  </div>
                </div>
                {selectedRole === 'delivery_agent' && <CheckCircle2 color="var(--accent-amber)" size={20} />}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.9rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '12px',
                marginTop: '0.5rem'
              }}
            >
              {loading ? 'Creating Account...' : 'Create Account & Continue'}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
