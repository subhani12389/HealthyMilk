import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Milk, Calendar, Clock, Settings, Truck, CheckCircle2, 
  Pause, Play, RefreshCw, Plus, Minus, MapPin, ShieldCheck, 
  Flame, Award, AlertCircle, Sparkles, ArrowRight 
} from 'lucide-react';

export default function ConsumerDashboard() {
  const { user, activeTab } = useAuth();

  const [dashboardData, setDashboardData] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Subscription Actions state
  const [actionMsg, setActionMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Settings State
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState('6:30 AM - 7:30 AM');
  const [settingsMsg, setSettingsMsg] = useState('');

  const fetchConsumerData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/consumer/dashboard?consumerId=${user?.id}`);
      const data = await res.json();
      if (data.success) {
        setDashboardData(data);
        if (data.consumer) {
          setSubscription(data.consumer.subscription);
          setAddress(data.consumer.address || '');
          setPhone(data.consumer.phone || '');
          if (data.consumer.subscription?.deliveryTimeSlot) {
            setDeliveryTimeSlot(data.consumer.subscription.deliveryTimeSlot);
          }
        }
        setHistoryList(data.history || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsumerData();
  }, [user]);

  // Toggle Pause / Resume
  const handleTogglePause = async () => {
    setActionLoading(true);
    setActionMsg('');
    try {
      const res = await fetch('/api/consumer/pause-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId: user?.id })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(data.message);
        setSubscription(data.subscription);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Modify Daily Quantity
  const handleUpdateQuantity = async (delta) => {
    if (!subscription) return;
    const newQty = Math.max(0.5, subscription.dailyLiters + delta);
    setActionLoading(true);
    try {
      const res = await fetch('/api/consumer/update-quantity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId: user?.id, dailyLiters: newQty })
      });
      const data = await res.json();
      if (data.success) {
        setSubscription(data.subscription);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Simulate 1 Day Delivery Reduction
  const handleSimulateDeduction = async () => {
    setActionLoading(true);
    setActionMsg('');
    try {
      const res = await fetch('/api/consumer/simulate-delivery-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId: user?.id })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg('1 Day milk delivered! Subscription days reduced by 1.');
        setSubscription(prev => ({
          ...prev,
          daysRemaining: data.daysRemaining,
          status: data.status
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Renew Subscription to 30 Days
  const handleRenewSubscription = async () => {
    setActionLoading(true);
    setActionMsg('');
    try {
      const res = await fetch('/api/consumer/renew-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId: user?.id, planDays: 30 })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(data.message);
        setSubscription(data.subscription);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsMsg('');
    try {
      const res = await fetch('/api/consumer/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consumerId: user?.id,
          address,
          phone,
          deliveryTimeSlot
        })
      });
      const data = await res.json();
      if (data.success) {
        setSettingsMsg('Delivery address & time slot updated!');
        fetchConsumerData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !dashboardData) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="pulse-anim" style={{ margin: '0 auto 1rem' }} />
        <p>Loading Consumer Portal...</p>
      </div>
    );
  }

  const currentMilk = dashboardData?.currentMilkStatus;
  const daysPct = subscription ? Math.round((subscription.daysRemaining / subscription.totalDays) * 100) : 70;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
        border: '1px solid var(--accent-blue)',
        borderRadius: '20px',
        padding: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
            🥛 Consumer Subscription Active
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {user?.name || 'Priya Sharma'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <MapPin size={14} color="var(--accent-blue)" /> {address || 'Apt 402, Green Acres Heights'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Daily Quantity</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
            {subscription?.dailyLiters || 2} Liters / Day
          </div>
        </div>
      </div>

      {/* TAB 1: CURRENT MILK STATUS */}
      {activeTab === 'status' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          {/* Left: Today's Delivery Status Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck size={22} color="var(--accent-blue)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Today's Delivery Status</h3>
              </div>
              <span className="badge badge-info">{currentMilk?.status || 'Out for Delivery'}</span>
            </div>

            <div style={{
              background: 'var(--bg-primary)',
              borderRadius: '16px',
              padding: '1.25rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Item & Volume</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{currentMilk?.milkType}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Delivery Time</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent-blue)' }}>
                    {currentMilk?.eta || '07:15 AM'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                Assigned Delivery Partner: <strong style={{ color: 'var(--text-main)' }}>{currentMilk?.agentName || 'John Doe'}</strong>
              </div>
            </div>

            {/* Delivery Progress Bar Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-emerald)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={15} />
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Picked up fresh from {currentMilk?.farmerName || 'Patel Farm'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-blue)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={14} />
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Agent in transit to {address.split(',')[0] || 'your doorstep'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', opacity: 0.6 }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-primary)', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={14} />
                </div>
                <div style={{ fontSize: '0.85rem' }}>Handed over to Consumer</div>
              </div>
            </div>
          </div>

          {/* Right: Quality & Farm Source Verification Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <ShieldCheck size={22} color="var(--accent-emerald)" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Milk Purity & Origin Metrics</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'var(--accent-emerald-light)', padding: '1rem', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>FAT CONTENT</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '2px' }}>
                  {currentMilk?.qualityDetails?.fat || '4.5%'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', marginTop: '2px' }}>Rich Cream Texture</div>
              </div>

              <div style={{ background: 'var(--accent-blue-light)', padding: '1rem', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 700 }}>CHILLED TEMP</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '2px' }}>
                  {currentMilk?.qualityDetails?.temperature || '4°C'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', marginTop: '2px' }}>Cold-Chain Preserved</div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-primary)', borderRadius: '14px', padding: '1rem', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                SOURCED DIRECTLY FROM:
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{currentMilk?.farmerName || 'Patel Organic Dairy Farm'}</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Free-range grass fed cows, non-GMO feed, zero preservatives or adulterants added.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: SUBSCRIPTION DETAILS & DAYS REDUCTION */}
      {activeTab === 'subscription' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {actionMsg && (
            <div style={{
              background: 'var(--accent-emerald-light)',
              color: 'var(--accent-emerald)',
              padding: '0.85rem 1.25rem',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <CheckCircle2 size={20} /> {actionMsg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem' }}>
            
            {/* Main Subscription Card with Days Reduction Gauge */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <span className={`badge ${subscription?.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                    ● {subscription?.status || 'Active'} Plan
                  </span>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.5rem' }}>
                    {subscription?.planName || 'Pure A2 Cow Milk'}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Delivered daily between {subscription?.deliveryTimeSlot || '6:30 AM - 7:30 AM'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Plan Cost</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                    ₹{subscription?.totalAmountPaid || 3900} / 30 Days
                  </div>
                </div>
              </div>

              {/* Days Countdown & Progress Indicator */}
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '1.25rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={20} color="var(--accent-emerald)" />
                    <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                      {subscription?.daysRemaining || 22} Days Remaining
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {subscription?.daysRemaining || 22} of {subscription?.totalDays || 30} Days Total
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{
                  width: '100%',
                  height: '12px',
                  background: 'var(--border-color)',
                  borderRadius: '6px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${daysPct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #059669 0%, #10B981 100%)',
                    borderRadius: '6px',
                    transition: 'width 0.5s ease'
                  }}></div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Flame size={14} color="var(--accent-amber)" /> Auto-Deduction: 1 day automatically decremented upon daily morning delivery receipt.
                </div>
              </div>

              {/* Action Buttons: Pause/Resume, Modify Liters, Renew */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handleTogglePause}
                  disabled={actionLoading}
                  className="btn-secondary"
                  style={{
                    color: subscription?.status === 'Active' ? 'var(--accent-amber)' : 'var(--accent-emerald)',
                    borderColor: subscription?.status === 'Active' ? 'var(--accent-amber)' : 'var(--accent-emerald)'
                  }}
                >
                  {subscription?.status === 'Active' ? <Pause size={18} /> : <Play size={18} />}
                  {subscription?.status === 'Active' ? 'Pause Delivery' : 'Resume Delivery'}
                </button>

                <button
                  onClick={handleSimulateDeduction}
                  disabled={actionLoading}
                  className="btn-secondary"
                  title="Simulate 1 daily delivery deduction for demonstration"
                >
                  <RefreshCw size={18} /> Simulate 1 Day Delivery Reduction
                </button>

                <button
                  onClick={handleRenewSubscription}
                  disabled={actionLoading}
                  className="btn-primary"
                >
                  Renew Plan (Reset 30 Days)
                </button>
              </div>
            </div>

            {/* Daily Quantity Modifier Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Modify Daily Quantity</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Adjust how many liters of milk you receive every morning.
                </p>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1.5rem',
                  background: 'var(--bg-primary)',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)'
                }}>
                  <button
                    onClick={() => handleUpdateQuantity(-0.5)}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800
                    }}
                  >
                    <Minus size={18} />
                  </button>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                      {subscription?.dailyLiters || 2} L
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PER DAY</div>
                  </div>

                  <button
                    onClick={() => handleUpdateQuantity(0.5)}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800
                    }}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-glass)', padding: '0.75rem', borderRadius: '10px' }}>
                Note: Quantity modifications take effect starting next morning delivery slot.
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: DELIVERY HISTORY */}
      {activeTab === 'history' && (
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Delivery Log History</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>Date</th>
                  <th style={{ padding: '0.75rem' }}>Milk Type</th>
                  <th style={{ padding: '0.75rem' }}>Volume</th>
                  <th style={{ padding: '0.75rem' }}>Delivery Agent</th>
                  <th style={{ padding: '0.75rem' }}>Time Delivered</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((item, idx) => (
                  <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>{item.dateStr || '11 Aug 2026'}</td>
                    <td style={{ padding: '0.75rem' }}>{item.milkType || 'Pure A2 Cow Milk'}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 800 }}>{item.liters || 2} Liters</td>
                    <td style={{ padding: '0.75rem' }}>{item.agentName || 'John Doe'}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{item.deliveredAt || item.timeSlot}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className="badge badge-success">● {item.status || 'Delivered'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="card" style={{ maxWidth: '650px', margin: '0 auto', width: '100%' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Delivery Address & Slot Preferences</h3>

          {settingsMsg && (
            <div style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
              {settingsMsg}
            </div>
          )}

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Delivery Address</label>
              <textarea
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  marginTop: '4px'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  marginTop: '4px'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Preferred Delivery Time Slot</label>
              <select
                value={deliveryTimeSlot}
                onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  marginTop: '4px',
                  fontWeight: 600
                }}
              >
                <option value="6:00 AM - 7:00 AM">Early Morning (6:00 AM - 7:00 AM)</option>
                <option value="6:30 AM - 7:30 AM">Morning Slot (6:30 AM - 7:30 AM)</option>
                <option value="7:30 AM - 8:30 AM">Late Morning (7:30 AM - 8:30 AM)</option>
                <option value="5:00 PM - 6:00 PM">Evening Slot (5:00 PM - 6:00 PM)</option>
              </select>
            </div>

            <button type="submit" className="btn-primary" style={{ justifyContent: 'center', padding: '0.85rem' }}>
              Update Preferences
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
