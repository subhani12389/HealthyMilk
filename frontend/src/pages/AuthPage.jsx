import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { 
  Milk, User, Lock, Mail, MapPin, Building, ArrowRight, 
  Eye, EyeOff, ShieldCheck, CheckCircle2, Truck, Navigation, Sparkles, Zap 
} from 'lucide-react';

export default function AuthPage() {
  const { loginUser } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [role, setRole] = useState('farmer');

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    email: 'farmer@healthymilk.com',
    password: 'password123',
    confirmPassword: '',
    farmName: '',
    address: '',
    phone: '',
    vehicleNo: '',
    assignedArea: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
        body: JSON.stringify({ email: targetEmail, password: 'password123' })
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (isSignup) {
      if (formData.password !== formData.confirmPassword) {
        setLoading(false);
        setErrorMsg('Passwords do not match. Please re-enter passwords.');
        return;
      }
      if (formData.password.length < 6) {
        setLoading(false);
        setErrorMsg('Password must be at least 6 characters long.');
        return;
      }
    }

    const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
    const payload = isSignup 
      ? { ...formData, role }
      : { email: formData.email.trim(), password: formData.password, role };

    try {
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (data.success && data.user) {
        setSuccessMsg(data.message || 'Authentication successful!');
        setTimeout(() => {
          loginUser(data.user, data.token);
        }, 300);
      } else {
        setErrorMsg(data.message || 'Authentication failed. Please check credentials.');
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
        maxWidth: '500px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '24px',
        boxShadow: 'var(--shadow-lg)',
        padding: '2.5rem',
        backdropFilter: 'blur(20px)'
      }}>
        
        {/* Brand Identity Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            marginBottom: '1rem',
            boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)'
          }}>
            <Milk size={32} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Healthy<span style={{ color: 'var(--accent-emerald)' }}>Milk</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            {isSignup ? 'Create your official account to get started' : 'Sign in to access your dairy portal'}
          </p>
        </div>

        {/* Instant 1-Click Quick Access Shortcuts */}
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
                🚚 Delivery Agent
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

        {/* Alerts */}
        {errorMsg && (
          <div style={{
            background: 'var(--accent-rose-light)',
            color: 'var(--accent-rose)',
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            fontWeight: 600,
            lineHeight: '1.4'
          }}>
            {errorMsg}
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
            <CheckCircle2 size={18} /> {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          
          {/* Role Selector Buttons: Farmer, Consumer, Agent */}
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

          {/* Full Name (Signup only) */}
          {isSignup && (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Full Name</label>
              <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. John Doe"
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
          )}

          {/* Email Address */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Email Address</label>
            <div style={{ position: 'relative', marginTop: '0.35rem' }}>
              <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                name="email"
                required
                placeholder={role === 'farmer' ? 'farmer@healthymilk.com' : role === 'consumer' ? 'consumer@healthymilk.com' : 'agent@healthymilk.com'}
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

          {/* Confirm Password (Signup only) */}
          {isSignup && (
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
          )}

          {/* Role-specific fields */}
          {isSignup && role === 'farmer' && (
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

          {isSignup && role === 'consumer' && (
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

          {isSignup && role === 'agent' && (
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
            {loading ? 'Authenticating...' : isSignup ? 'Create Account' : 'Sign In'}
            <ArrowRight size={18} />
          </button>
        </form>

      </div>
    </div>
  );
}
