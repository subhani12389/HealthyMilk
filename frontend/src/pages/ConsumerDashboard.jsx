import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { renderQRCodeSVG } from '../utils/qrCode';
import { 
  Milk, Calendar, Clock, Settings, Truck, CheckCircle2, 
  Pause, Play, RefreshCw, Plus, Minus, MapPin, ShieldCheck, 
  Flame, Award, AlertCircle, Sparkles, ArrowRight, QrCode, 
  Thermometer, Check 
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

  // Certificate Modal State
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  // Settings State
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState('6:30 AM - 7:30 AM');
  const [settingsMsg, setSettingsMsg] = useState('');

  const fetchConsumerData = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/consumer/dashboard?consumerId=${user?.id}`);
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
  }, [user?.id]);

  // Toggle Pause / Resume
  const handleTogglePause = async () => {
    setActionLoading(true);
    setActionMsg('');
    try {
      const data = await apiFetch('/api/consumer/pause-subscription', {
        method: 'POST',
        body: JSON.stringify({ consumerId: user?.id })
      });
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
      const data = await apiFetch('/api/consumer/update-quantity', {
        method: 'POST',
        body: JSON.stringify({ consumerId: user?.id, dailyLiters: newQty })
      });
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
      const data = await apiFetch('/api/consumer/simulate-delivery-day', {
        method: 'POST',
        body: JSON.stringify({ consumerId: user?.id })
      });
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
      const data = await apiFetch('/api/consumer/renew-subscription', {
        method: 'POST',
        body: JSON.stringify({ consumerId: user?.id, planDays: 30 })
      });
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
      const data = await apiFetch('/api/consumer/settings', {
        method: 'PUT',
        body: JSON.stringify({
          consumerId: user?.id,
          address,
          phone,
          deliveryTimeSlot
        })
      });
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

  const qrString = JSON.stringify({
    batchId: currentMilk?.batchId || "HM-20260921-0001",
    milk: currentMilk?.milkType || "Pure A2 Cow Milk",
    farm: currentMilk?.farmerName || "Patel Organic Dairy Farm",
    fat: currentMilk?.qualityDetails?.fat || "4.8%",
    snf: currentMilk?.qualityDetails?.snf || "8.9%",
    temperature: currentMilk?.qualityDetails?.temperature || "4°C",
    qualityScore: currentMilk?.qualityDetails?.qualityScore || 96,
    qualityStatus: currentMilk?.qualityDetails?.qualityStatus || "Passed",
    purity: "100% Certified Organic Lab Tested",
    agent: currentMilk?.agentName || "John Doe"
  });

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
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
            🥛 Consumer Subscription Active
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {user?.name || 'Consumer User'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <MapPin size={14} color="var(--accent-blue)" /> {address || '123 Green Avenue, Sector 14'}
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
          
          {/* Left: Today's Delivery Status Card with Batch ID */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck size={22} color="var(--accent-blue)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Today's Milk Delivery</h3>
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
              {/* Batch ID Traceability Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', paddingBottom: '0.65rem', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Traceable Batch ID</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-emerald)', fontFamily: 'monospace' }}>
                    {currentMilk?.batchId || 'HM-20260921-0001'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Estimated Delivery</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-blue)' }}>
                    {currentMilk?.eta || '07:15 AM'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Product Type</div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{currentMilk?.milkType}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Volume</div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    {currentMilk?.liters || 2} Liters
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingTop: '0.5rem' }}>
                Assigned Delivery Partner: <strong style={{ color: 'var(--text-main)' }}>{currentMilk?.agentName || 'Assigned Agent'}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-emerald)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={15} />
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Batch tested and collected from {currentMilk?.farmerName || 'Local Dairy Farm'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-blue)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={14} />
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>In cold-chain transit to {address.split(',')[0] || 'your doorstep'}</div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={22} color="var(--accent-emerald)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Verified Batch Quality</h3>
              </div>
              <span className="badge badge-success">
                {currentMilk?.qualityDetails?.qualityStatus || 'Passed'} ({currentMilk?.qualityDetails?.qualityScore || 96}/100)
              </span>
            </div>

            {/* 4-Box Quality Parameter Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'var(--accent-emerald-light)', padding: '0.9rem', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>FAT CONTENT</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '2px' }}>
                  {currentMilk?.qualityDetails?.fat || '4.8%'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', marginTop: '2px' }}>Rich Cream Texture</div>
              </div>

              <div style={{ background: 'var(--accent-blue-light)', padding: '0.9rem', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 700 }}>SNF CONTENT</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '2px' }}>
                  {currentMilk?.qualityDetails?.snf || '8.9%'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', marginTop: '2px' }}>Solid Not Fat (Protein)</div>
              </div>

              <div style={{ background: 'var(--accent-amber-light)', padding: '0.9rem', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', fontWeight: 700 }}>LACTOMETER</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '2px' }}>
                  {currentMilk?.qualityDetails?.lactometer || 30.0}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', marginTop: '2px' }}>Zero Water Dilution</div>
              </div>

              <div style={{ background: 'var(--accent-emerald-light)', padding: '0.9rem', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>CHILLED TEMP</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '2px' }}>
                  {currentMilk?.qualityDetails?.temperature || '4°C'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', marginTop: '2px' }}>Cold-Chain Preserved</div>
              </div>
            </div>

            <button
              onClick={() => setShowCertificateModal(true)}
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginBottom: '1.25rem', fontSize: '0.85rem' }}
            >
              <QrCode size={18} color="var(--accent-blue)" /> View Batch Quality Certificate & QR Code
            </button>

            <div style={{ background: 'var(--bg-primary)', borderRadius: '14px', padding: '1rem', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>SOURCED DIRECTLY FROM:</div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{currentMilk?.farmerName || 'Patel Organic Dairy Farm'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Location: {currentMilk?.farmLocation || 'Kaira Valley, Anand'}</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Free-range cows, non-GMO feed, tested on-site before doorstep dispatch.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: SUBSCRIPTION DETAILS & DAYS REDUCTION */}
      {activeTab === 'subscription' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {actionMsg && (
            <div style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', padding: '0.85rem 1.25rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={20} /> {actionMsg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <span className={`badge ${subscription?.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                    ● {subscription?.status || 'Active'} Plan
                  </span>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.5rem' }}>{subscription?.planName || 'Pure A2 Cow Milk'}</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Delivered daily between {subscription?.deliveryTimeSlot || '6:30 AM - 7:30 AM'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Plan Cost</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>₹{subscription?.totalAmountPaid || 3900} / 30 Days</div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={20} color="var(--accent-emerald)" />
                    <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{subscription?.daysRemaining || 22} Days Remaining</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{subscription?.daysRemaining || 22} of {subscription?.totalDays || 30} Days Total</span>
                </div>

                <div style={{ width: '100%', height: '12px', background: 'var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${daysPct}%`, height: '100%', background: 'linear-gradient(90deg, #059669 0%, #10B981 100%)', borderRadius: '6px', transition: 'width 0.5s ease' }}></div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Flame size={14} color="var(--accent-amber)" /> Auto-Deduction: 1 day automatically decremented upon daily morning delivery receipt.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={handleTogglePause} disabled={actionLoading} className="btn-secondary" style={{ color: subscription?.status === 'Active' ? 'var(--accent-amber)' : 'var(--accent-emerald)', borderColor: subscription?.status === 'Active' ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                  {subscription?.status === 'Active' ? <Pause size={18} /> : <Play size={18} />}
                  {subscription?.status === 'Active' ? 'Pause Delivery' : 'Resume Delivery'}
                </button>
                <button onClick={handleSimulateDeduction} disabled={actionLoading} className="btn-secondary">
                  <RefreshCw size={18} /> Simulate 1 Day Delivery Reduction
                </button>
                <button onClick={handleRenewSubscription} disabled={actionLoading} className="btn-primary">
                  Renew Plan (Reset 30 Days)
                </button>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Modify Daily Quantity</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Adjust how many liters of milk you receive every morning.</p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                  <button onClick={() => handleUpdateQuantity(-0.5)} style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, cursor: 'pointer' }}>
                    <Minus size={18} />
                  </button>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-blue)' }}>{subscription?.dailyLiters || 2} L</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PER DAY</div>
                  </div>

                  <button onClick={() => handleUpdateQuantity(0.5)} style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, cursor: 'pointer' }}>
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: '0.85rem', borderRadius: '12px', fontSize: '0.78rem', color: 'var(--text-muted)', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
                💡 Quantity changes apply automatically to the next day's morning delivery dispatch.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DELIVERY HISTORY */}
      {activeTab === 'history' && (
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Delivery History & Digital Invoices</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem' }}>Delivery ID / Date</th>
                  <th style={{ padding: '0.75rem' }}>Item</th>
                  <th style={{ padding: '0.75rem' }}>Volume</th>
                  <th style={{ padding: '0.75rem' }}>Delivery Agent</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>
                      <div>{item.id}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.date || 'Today'}</div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{item.milkType}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 800 }}>{item.liters} L</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{item.agentName || 'John Doe'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`badge ${item.status === 'Delivered' ? 'badge-success' : 'badge-info'}`}>
                        {item.status}
                      </span>
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
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Delivery Address & Preferences</h3>

          {settingsMsg && (
            <div style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
              {settingsMsg}
            </div>
          )}

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Delivery Address</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Contact Mobile Number</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Preferred Delivery Window</label>
              <select value={deliveryTimeSlot} onChange={(e) => setDeliveryTimeSlot(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', fontWeight: 600 }}>
                <option value="6:00 AM - 7:00 AM">Early Morning (6:00 AM - 7:00 AM)</option>
                <option value="6:30 AM - 7:30 AM">Standard (6:30 AM - 7:30 AM)</option>
                <option value="7:30 AM - 8:30 AM">Late Morning (7:30 AM - 8:30 AM)</option>
              </select>
            </div>

            <button type="submit" className="btn-primary" style={{ justifyContent: 'center', padding: '0.85rem' }}>
              Save Delivery Preferences
            </button>
          </form>
        </div>
      )}

      {/* Purity & Origin Certificate Modal */}
      {showCertificateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem'
        }}>
          <div className="card" style={{ width: '440px', maxWidth: '95%', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
              HEALTHYMILK PURITY ASSURANCE
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px' }}>
              Organic Milk Purity Certificate
            </h3>

            <div 
              style={{ margin: '1.25rem auto', width: '150px', height: '150px', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '8px', background: '#FFF' }}
              dangerouslySetInnerHTML={{ __html: renderQRCodeSVG(qrString, 134) }}
            />

            <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '0.85rem', textAlign: 'left', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              <div>Batch ID: <strong style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)' }}>{currentMilk?.batchId || 'HM-20260921-0001'}</strong></div>
              <div>Source Farm: <strong>{currentMilk?.farmerName || 'Patel Organic Dairy Farm'}</strong></div>
              <div>Fat % / SNF %: <strong>{currentMilk?.qualityDetails?.fat || '4.8%'} / {currentMilk?.qualityDetails?.snf || '8.9%'}</strong></div>
              <div>Lactometer Reading: <strong>{currentMilk?.qualityDetails?.lactometer || 30.0}</strong></div>
              <div>Chilled Temp: <strong>{currentMilk?.qualityDetails?.temperature || '4°C'}</strong></div>
              <div>Safety Certification: <strong style={{ color: 'var(--accent-emerald)' }}>100% Certified Organic & Non-Adulterated</strong></div>
            </div>

            <button onClick={() => setShowCertificateModal(false)} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Close Certificate
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
