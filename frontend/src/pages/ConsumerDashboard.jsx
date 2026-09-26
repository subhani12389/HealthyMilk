import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../utils/api';
import { renderQRCodeSVG } from '../utils/qrCode';
import { SkeletonBanner, SkeletonStatGrid, SkeletonCard } from '../components/Skeleton';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { 
  Milk, Calendar, Clock, Settings, Truck, CheckCircle2, 
  Pause, Play, RefreshCw, Plus, Minus, MapPin, ShieldCheck, 
  Flame, Award, AlertCircle, Sparkles, ArrowRight, QrCode, 
  Thermometer, Check, Loader2 
} from 'lucide-react';

export default function ConsumerDashboard() {
  const { user, activeTab } = useAuth();
  const { showToast } = useToast();

  const [dashboardData, setDashboardData] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination for Delivery History
  const [historyPage, setHistoryPage] = useState(1);
  const PAGE_SIZE = 6;

  // Subscription Actions state
  const [actionLoading, setActionLoading] = useState(false);

  // Certificate Modal State
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  // Settings State
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState('6:30 AM - 7:30 AM');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  const fetchConsumerData = async () => {
    try {
      const data = await apiFetch(`/api/consumer/dashboard?consumerId=${user?.id}`);
      if (data && data.success) {
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
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const data = await apiFetch('/api/consumer/pause-subscription', {
        method: 'POST',
        body: JSON.stringify({ consumerId: user?.id })
      });
      if (data && data.success) {
        setSubscription(data.subscription);
        showToast(data.message || (data.subscription?.status === 'Paused' ? 'Subscription paused.' : 'Subscription resumed.'), 'success');
      } else {
        showToast(data?.message || 'Failed to toggle subscription status.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating subscription status.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Modify Daily Quantity
  const handleUpdateQuantity = async (delta) => {
    if (!subscription || actionLoading) return;
    const newQty = Math.max(0.5, subscription.dailyLiters + delta);
    setActionLoading(true);
    try {
      const data = await apiFetch('/api/consumer/update-quantity', {
        method: 'POST',
        body: JSON.stringify({ consumerId: user?.id, dailyLiters: newQty })
      });
      if (data && data.success) {
        setSubscription(data.subscription);
        showToast(`Daily quantity updated to ${newQty}L`, 'success');
      } else {
        showToast(data?.message || 'Failed to update quantity.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error modifying daily quantity.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Simulate 1 Day Delivery Reduction
  const handleSimulateDeduction = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const data = await apiFetch('/api/consumer/simulate-delivery-day', {
        method: 'POST',
        body: JSON.stringify({ consumerId: user?.id })
      });
      if (data && data.success) {
        showToast('Milk delivered! 1 day deducted from subscription balance.', 'success');
        setSubscription(prev => ({
          ...prev,
          daysRemaining: data.daysRemaining,
          status: data.status
        }));
      } else {
        showToast(data?.message || 'Failed to record delivery deduction.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating delivery count.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Renew Subscription to 30 Days
  const handleRenewSubscription = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const data = await apiFetch('/api/consumer/renew-subscription', {
        method: 'POST',
        body: JSON.stringify({ consumerId: user?.id, planDays: 30 })
      });
      if (data && data.success) {
        showToast('Subscription renewed for 30 days!', 'success');
        setSubscription(data.subscription);
      } else {
        showToast(data?.message || 'Failed to renew subscription.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error renewing subscription.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    if (savingSettings) return;
    setSavingSettings(true);
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
      if (data && data.success) {
        setSettingsMsg('Delivery address & time slot updated!');
        showToast('Delivery address & schedule saved!', 'success');
        fetchConsumerData();
      } else {
        showToast(data?.message || 'Failed to save settings.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error saving settings.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading && !dashboardData) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <SkeletonBanner />
        <SkeletonStatGrid count={4} />
        <div className="grid-responsive-2">
          <SkeletonCard height="340px" />
          <SkeletonCard height="340px" />
        </div>
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
    agent: currentMilk?.agentName || "Assigned Delivery Agent"
  });

  // Paginated Slices
  const paginatedHistory = historyList.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
        border: '1px solid var(--accent-blue)',
        borderRadius: '20px',
        padding: 'clamp(1rem, 2.5vw, 1.5rem)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ minWidth: '220px', flex: '1 1 240px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
            🥛 Consumer Subscription Active
          </div>
          <h2 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.5rem)', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {user?.name || 'Consumer User'}
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <MapPin size={14} color="var(--accent-blue)" /> {address || '123 Green Avenue, Sector 14'}
          </p>
        </div>
        <div style={{ textAlign: 'left', minWidth: '160px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Daily Quantity</div>
          <div style={{ fontSize: 'clamp(1.2rem, 3.5vw, 1.4rem)', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '2px' }}>
            {subscription?.dailyLiters || 2} Liters / Day
          </div>
        </div>
      </div>

      {/* TAB 1: CURRENT MILK STATUS */}
      {(!activeTab || activeTab === 'status') && (
        <div className="grid-responsive-2">
          
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
                  <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{currentMilk?.milkType || 'Pure A2 Cow Milk'}</div>
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
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>In cold-chain transit to your doorstep</div>
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
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }}
            >
              <Award size={18} /> View Verified Batch Certificate
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: SUBSCRIPTION MANAGEMENT */}
      {activeTab === 'subscription' && (
        <div className="grid-responsive-2">
          {/* Subscription Status Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={22} color="var(--accent-blue)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Active Milk Plan</h3>
              </div>
              <span className={`badge ${subscription?.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                {subscription?.status || 'Active'}
              </span>
            </div>

            <div style={{
              background: 'var(--bg-primary)',
              borderRadius: '16px',
              padding: '1.25rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{subscription?.planName || 'Pure Fresh A2 Cow Milk'}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Delivery Time: <strong>{deliveryTimeSlot}</strong>
              </div>

              {/* Progress Bar for Days */}
              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subscription Balance</span>
                  <strong>{subscription?.daysRemaining || 30} of {subscription?.totalDays || 30} Days Left</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${daysPct}%`, height: '100%', background: 'var(--accent-emerald)', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleTogglePause}
                disabled={actionLoading}
                className={subscription?.status === 'Active' ? 'btn-secondary' : 'btn-primary'}
                style={{ flex: 1, justifyContent: 'center', minWidth: '140px' }}
              >
                {subscription?.status === 'Active' ? (
                  <><Pause size={16} /> Pause Deliveries</>
                ) : (
                  <><Play size={16} /> Resume Deliveries</>
                )}
              </button>

              <button
                onClick={handleRenewSubscription}
                disabled={actionLoading}
                className="btn-secondary"
                style={{ flex: 1, justifyContent: 'center', minWidth: '140px' }}
              >
                <RefreshCw size={16} /> Renew (30 Days)
              </button>
            </div>
          </div>

          {/* Adjust Daily Quantity Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Adjust Daily Volume</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Increase or decrease your daily morning milk delivery with 1 click. Changes take effect next morning.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1.5rem',
              background: 'var(--bg-primary)',
              borderRadius: '16px',
              padding: '1.5rem',
              border: '1px solid var(--border-color)',
              marginBottom: '1.25rem'
            }}>
              <button
                onClick={() => handleUpdateQuantity(-0.5)}
                disabled={actionLoading || (subscription?.dailyLiters || 2) <= 0.5}
                className="btn-secondary"
                style={{ width: '44px', height: '44px', borderRadius: '50%', padding: 0, justifyContent: 'center' }}
                aria-label="Decrease volume"
              >
                <Minus size={20} />
              </button>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                  {subscription?.dailyLiters || 2} <span style={{ fontSize: '1.1rem' }}>L</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Daily Quantity</div>
              </div>

              <button
                onClick={() => handleUpdateQuantity(0.5)}
                disabled={actionLoading || (subscription?.dailyLiters || 2) >= 10}
                className="btn-secondary"
                style={{ width: '44px', height: '44px', borderRadius: '50%', padding: 0, justifyContent: 'center' }}
                aria-label="Increase volume"
              >
                <Plus size={20} />
              </button>
            </div>

            <button
              onClick={handleSimulateDeduction}
              disabled={actionLoading || subscription?.daysRemaining <= 0}
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem' }}
            >
              Simulate 1 Day Delivery Received (Reduce -1 Day)
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: DELIVERY HISTORY */}
      {activeTab === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Daily Milk Delivery History</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Verified log of milk batches delivered to your door</p>
            </div>
          </div>

          {historyList.length === 0 ? (
            <EmptyState
              title="No delivery history records"
              description="Your daily deliveries will appear here as they are fulfilled."
            />
          ) : (
            <>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Batch ID</th>
                      <th>Quantity</th>
                      <th>Quality Score</th>
                      <th>Delivery Agent</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td>{new Date(item.date || item.timestamp || Date.now()).toLocaleDateString()}</td>
                        <td><strong style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)' }}>{item.batchId || 'HM-BATCH-001'}</strong></td>
                        <td><strong>{item.liters || 2} L</strong></td>
                        <td><span className="badge badge-success">{item.qualityScore || 96}/100</span></td>
                        <td>{item.agentName || 'Assigned Agent'}</td>
                        <td><span className="badge badge-success">Delivered</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={historyPage}
                totalItems={historyList.length}
                pageSize={PAGE_SIZE}
                onPageChange={setHistoryPage}
              />
            </>
          )}
        </div>
      )}

      {/* TAB 4: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="card" style={{ maxWidth: '640px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>Delivery Address & Schedule</h3>

          {settingsMsg && (
            <div style={{ background: 'var(--accent-emerald-light)', border: '1px solid var(--accent-emerald)', padding: '0.85rem', borderRadius: '10px', color: 'var(--accent-emerald)', fontWeight: 600, marginBottom: '1rem', fontSize: '0.85rem' }}>
              {settingsMsg}
            </div>
          )}

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Delivery Address</label>
              <textarea
                rows={3}
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Contact Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Morning Delivery Time Slot</label>
              <select
                value={deliveryTimeSlot}
                onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
              >
                <option value="6:00 AM - 7:00 AM">6:00 AM - 7:00 AM (Early Bird)</option>
                <option value="6:30 AM - 7:30 AM">6:30 AM - 7:30 AM (Standard)</option>
                <option value="7:00 AM - 8:00 AM">7:00 AM - 8:00 AM</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', marginTop: '0.5rem' }}
            >
              {savingSettings ? (
                <>
                  <Loader2 size={18} className="pulse-anim" /> Saving...
                </>
              ) : (
                <>
                  <Settings size={18} /> Save Delivery Preferences
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* MODAL: Verified Batch Quality Certificate */}
      {showCertificateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', marginBottom: '0.75rem' }}>
              <ShieldCheck size={32} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Certified Quality Pass</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Batch: <strong style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)' }}>{currentMilk?.batchId || 'HM-20260921-0001'}</strong>
            </p>

            <div
              style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}
              dangerouslySetInnerHTML={{
                __html: renderQRCodeSVG(qrString, 180)
              }}
            />

            <div style={{ background: 'var(--bg-primary)', padding: '0.85rem', borderRadius: '12px', fontSize: '0.8rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1.25rem' }}>
              <div>Origin: <strong>{currentMilk?.farmerName || 'Patel Dairy Farm'}</strong></div>
              <div>Fat: <strong>{currentMilk?.qualityDetails?.fat || '4.8%'}</strong> • SNF: <strong>{currentMilk?.qualityDetails?.snf || '8.9%'}</strong></div>
              <div>Chilled Temp: <strong>{currentMilk?.qualityDetails?.temperature || '4°C'}</strong></div>
              <div>Lactometer: <strong>{currentMilk?.qualityDetails?.lactometer || 30.0}</strong> (Zero Dilution)</div>
            </div>

            <button
              onClick={() => setShowCertificateModal(false)}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Close Certificate
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
