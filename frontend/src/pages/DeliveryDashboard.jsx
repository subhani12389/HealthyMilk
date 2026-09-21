import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { 
  Truck, MapPin, CheckCircle2, Clock, Milk, User, 
  RefreshCw, AlertCircle, ShieldCheck, DollarSign, Calculator,
  Wallet, ArrowUpRight, Search, Settings, AlertTriangle, 
  Camera, Image as ImageIcon, X, Thermometer, Award 
} from 'lucide-react';

export default function DeliveryDashboard() {
  const { user, activeTab, updateUserBalance } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [agentProfile, setAgentProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Selected Pickup for Quality Test Modal
  const [activePickup, setActivePickup] = useState(null);
  const [testedFat, setTestedFat] = useState('4.5');
  const [testedSNF, setTestedSNF] = useState('8.8');
  const [lactometer, setLactometer] = useState('29.5');
  const [temperature, setTemperature] = useState('4.0');
  const [inspectionRemarks, setInspectionRemarks] = useState('Clean chilled morning collection');
  const [submittingTest, setSubmittingTest] = useState(false);

  // Selected Pickup for Rejection Modal
  const [rejectingPickup, setRejectingPickup] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('Abnormal Fat/SNF');
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [evidencePhoto, setEvidencePhoto] = useState('');
  const [submittingRejection, setSubmittingRejection] = useState(false);

  // Agent Payout Modal
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMsg, setPayoutMsg] = useState('');

  const fetchAgentDashboard = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/delivery/dashboard?agentId=${user?.id}`);
      if (data && data.success) {
        setDashboardData(data);
        setAgentProfile(data.agent);
        setTransactions(data.transactions || []);
        setBatches(data.batches || []);

        if (data.agent && data.agent.balance !== undefined) {
          updateUserBalance(data.agent.balance);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentDashboard();
  }, [user?.id]);

  // Live calculation preview
  const fatVal = parseFloat(testedFat) || 0;
  const snfVal = parseFloat(testedSNF) || 0;
  const lactoVal = parseFloat(lactometer) || 0;
  const baseRate = 45;
  const fatDiff = fatVal - 3.5;
  const snfDiff = snfVal - 8.5;
  const calculatedRate = Math.max(35, Math.round(baseRate + (fatDiff * 6) + (snfDiff * 4)));
  const calculatedTotal = activePickup ? Math.round(activePickup.liters * calculatedRate) : 0;
  const calculatedScore = Math.min(100, Math.max(10, Math.round((fatVal / 4.5) * 45 + (snfVal / 8.5) * 45 + (lactoVal >= 28 ? 10 : 0))));

  // Quality Test & Credit Farmer & Agent Money
  const handleTestAndCollect = async (e) => {
    e.preventDefault();
    if (!activePickup) return;
    setSubmittingTest(true);
    setMsg('');
    setErrorMsg('');

    try {
      const data = await apiFetch('/api/delivery/test-and-collect', {
        method: 'POST',
        body: JSON.stringify({
          pickupId: activePickup.id || activePickup.batchId,
          batchId: activePickup.batchId,
          testedFat,
          testedSNF,
          lactometerReading: lactometer,
          temperature,
          liters: activePickup.liters,
          agentName: user?.name || 'Delivery Agent',
          agentId: user?.id,
          remarks: inspectionRemarks
        })
      });

      if (data && data.success) {
        setMsg(data.message);
        setActivePickup(null);
        if (data.updatedAgentBalance !== undefined) {
          updateUserBalance(data.updatedAgentBalance);
        }
        fetchAgentDashboard();
      } else {
        setErrorMsg(data?.message || 'Quality verification failed');
      }
    } catch (err) {
      setErrorMsg('Server error processing quality verification.');
    } finally {
      setSubmittingTest(false);
    }
  };

  // Reject Batch Handler
  const handleRejectBatch = async (e) => {
    e.preventDefault();
    if (!rejectingPickup) return;
    setSubmittingRejection(true);
    setMsg('');
    setErrorMsg('');

    try {
      const data = await apiFetch('/api/delivery/reject-batch', {
        method: 'POST',
        body: JSON.stringify({
          pickupId: rejectingPickup.id || rejectingPickup.batchId,
          batchId: rejectingPickup.batchId,
          reason: rejectionReason,
          remarks: rejectionRemarks,
          evidencePhoto,
          agentName: user?.name || 'Delivery Agent',
          agentId: user?.id
        })
      });

      if (data && data.success) {
        setMsg(data.message);
        setRejectingPickup(null);
        setRejectionRemarks('');
        setEvidencePhoto('');
        fetchAgentDashboard();
      } else {
        setErrorMsg(data?.message || 'Batch rejection failed');
      }
    } catch (err) {
      setErrorMsg('Server error processing batch rejection.');
    } finally {
      setSubmittingRejection(false);
    }
  };

  // Image Upload Handler
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEvidencePhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus, type) => {
    setMsg('');
    try {
      const data = await apiFetch('/api/delivery/update-status', {
        method: 'POST',
        body: JSON.stringify({ taskId, status: newStatus, type, agentId: user?.id })
      });
      if (data && data.success) {
        setMsg(`Status updated to ${newStatus}`);
        fetchAgentDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Agent Bank Payout Request
  const handleAgentPayout = async (e) => {
    e.preventDefault();
    setPayoutMsg('');
    try {
      const data = await apiFetch('/api/delivery/payout', {
        method: 'POST',
        body: JSON.stringify({
          agentId: user?.id,
          amount: payoutAmount
        })
      });
      if (data && data.success) {
        setPayoutMsg(data.message);
        if (data.remainingBalance !== undefined) {
          updateUserBalance(data.remainingBalance);
        }
        setTimeout(() => {
          setShowPayoutModal(false);
          setPayoutMsg('');
          fetchAgentDashboard();
        }, 1200);
      } else {
        setPayoutMsg(data?.message || 'Payout failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !dashboardData) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="pulse-anim" style={{ margin: '0 auto 1rem' }} />
        <p>Loading Delivery Agent Portal...</p>
      </div>
    );
  }

  const currentBalance = user?.balance !== undefined ? user.balance : (agentProfile?.balance || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1150px', margin: '0 auto' }}>
      
      {/* Top Banner with Available Money */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
        border: '1px solid var(--accent-amber)',
        borderRadius: '20px',
        padding: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-amber)', textTransform: 'uppercase' }}>
            🚚 Certified Delivery Agent Portal
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {agentProfile?.name || user?.name || 'Delivery Agent'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Vehicle: {agentProfile?.vehicleNo || 'GJ-07-MK-4421'} • Route: {agentProfile?.assignedArea || 'Sector 14 & Green Valley'}
          </p>
        </div>

        {/* Current Available Money */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '0.85rem 1.25rem',
          textAlign: 'right',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>COMMISSION BALANCE</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '2px' }}>
            ₹{Number(currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            ₹50 earned per verified collection & delivery
          </div>
        </div>
      </div>

      {msg && (
        <div style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', padding: '0.85rem 1rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={18} /> {msg}
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'var(--accent-rose-light)', color: 'var(--accent-rose)', padding: '0.85rem 1rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} /> {errorMsg}
        </div>
      )}

      {/* TAB 1: DISPATCH & PICKUPS QUEUE */}
      {(!activeTab || activeTab === 'status') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
          
          {/* Farmer Milk Pickups with Batch ID & Testing/Rejection Actions */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Milk size={22} color="var(--accent-emerald)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Farmer Milk Batch Collections</h3>
              </div>
              <span className="badge badge-info">{dashboardData?.farmerPickups?.length || 0} Batches</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {dashboardData?.farmerPickups?.map(pickup => {
                const isRejected = pickup.status === 'Rejected' || pickup.status?.includes('Rejected');
                const isAccepted = pickup.status === 'Accepted' || pickup.status?.includes('Tested');
                return (
                  <div key={pickup.id || pickup.batchId} style={{
                    background: 'var(--bg-primary)',
                    border: isRejected ? '1px solid var(--accent-rose)' : '1px solid var(--border-color)',
                    borderRadius: '14px',
                    padding: '1.1rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        {/* Batch ID Tag */}
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'monospace' }}>
                          Batch #{pickup.batchId || pickup.id}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: '2px' }}>{pickup.farmerName}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Collection Volume: <strong style={{ color: 'var(--text-main)' }}>{pickup.liters} Liters</strong>
                        </div>
                        {pickup.notes && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                            "{pickup.notes}"
                          </div>
                        )}
                      </div>
                      <span className={`badge ${isRejected ? 'badge-danger' : isAccepted ? 'badge-success' : 'badge-warning'}`}>
                        {pickup.status}
                      </span>
                    </div>

                    {/* Tested Parameters Snapshot */}
                    {pickup.qualityTest && (
                      <div style={{
                        marginTop: '0.75rem',
                        background: isRejected ? 'var(--accent-rose-light)' : 'var(--accent-emerald-light)',
                        color: isRejected ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span>Fat: {pickup.qualityTest.fatPercentage}% • SNF: {pickup.qualityTest.snfPercentage}% • {pickup.qualityTest.temperature || 4.0}°C</span>
                        <span>{isRejected ? 'Quarantined' : `Farmer Payout: ₹${pickup.qualityTest.totalPrice}`}</span>
                      </div>
                    )}

                    {/* Rejection Cause if Rejected */}
                    {isRejected && pickup.rejection && (
                      <div style={{ marginTop: '0.65rem', background: 'var(--bg-card)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--accent-rose)', fontSize: '0.78rem' }}>
                        <span style={{ fontWeight: 800, color: 'var(--accent-rose)' }}>Rejection Reason: </span>
                        <span>{pickup.rejection.reason}</span>
                        {pickup.rejection.remarks && <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '2px' }}>"{pickup.rejection.remarks}"</div>}
                      </div>
                    )}

                    {/* Action Buttons: Inspect or Reject */}
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {!isAccepted && !isRejected ? (
                        <>
                          <button
                            onClick={() => {
                              setActivePickup(pickup);
                              setTestedFat('4.5');
                              setTestedSNF('8.8');
                              setLactometer('29.5');
                              setTemperature('4.0');
                            }}
                            className="btn-primary"
                            style={{ fontSize: '0.82rem', padding: '0.55rem 0.85rem', flex: 1, justifyContent: 'center' }}
                          >
                            <Calculator size={16} /> Test Quality & Accept
                          </button>

                          <button
                            onClick={() => {
                              setRejectingPickup(pickup);
                              setRejectionReason('Abnormal Fat/SNF');
                              setRejectionRemarks('');
                              setEvidencePhoto('');
                            }}
                            className="btn-secondary"
                            style={{ fontSize: '0.82rem', padding: '0.55rem 0.85rem', color: 'var(--accent-rose)', borderColor: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <AlertTriangle size={15} /> Reject
                          </button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: isRejected ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {isRejected ? <AlertTriangle size={15} /> : <CheckCircle2 size={16} />}
                            {isRejected ? 'Batch Quarantined' : 'Verified & Farmer Credited'}
                          </span>
                          {isAccepted && pickup.status !== 'In Transit' && pickup.status !== 'Delivered' && (
                            <button
                              onClick={() => handleUpdateStatus(pickup.batchId || pickup.id, 'In Transit', 'farmer_pickup')}
                              className="btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                            >
                              Dispatch to Cold-Chain
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Consumer Deliveries */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck size={22} color="var(--accent-blue)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Consumer Deliveries</h3>
              </div>
              <span className="badge badge-info">{dashboardData?.consumerDeliveries?.length || 0} Dropoffs</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {dashboardData?.consumerDeliveries?.map(task => (
                <div key={task.id} style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '1.1rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem' }}>{task.consumerName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{task.address}</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '4px', color: 'var(--accent-blue)' }}>
                        {task.liters} L • {task.milkType}
                      </div>
                    </div>
                    <span className={`badge ${task.status === 'Delivered' ? 'badge-success' : 'badge-warning'}`}>
                      {task.status}
                    </span>
                  </div>

                  <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.5rem' }}>
                    {task.status !== 'Delivered' && (
                      <button
                        onClick={() => handleUpdateStatus(task.id, 'Delivered', 'consumer_delivery')}
                        className="btn-primary"
                        style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem', width: '100%', justifyContent: 'center' }}
                      >
                        Mark Delivered & Earn ₹50 Commission
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: ACCOUNT BALANCE & EARNINGS FOR DELIVERY AGENT */}
      {activeTab === 'balance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
            
            <div className="card" style={{ background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)', color: '#FFFFFF' }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Current Available Earnings</div>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, margin: '0.5rem 0' }}>
                ₹{Number(currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <button
                onClick={() => { setPayoutAmount(String(currentBalance)); setShowPayoutModal(true); }}
                style={{
                  background: '#FFFFFF',
                  color: '#D97706',
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  marginTop: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                Withdraw to HDFC Bank <ArrowUpRight size={16} />
              </button>
            </div>

            <div className="card">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Completed Deliveries</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.4rem 0', color: 'var(--text-main)' }}>
                {agentProfile?.totalDeliveries || 69} Completed
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                ₹50 Commission Credited / Task
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Linked Payout Bank Account</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.4rem 0', color: 'var(--text-main)' }}>
                {agentProfile?.bankDetails?.bankName || 'HDFC Bank'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                A/C: {agentProfile?.bankDetails?.accountNo || 'XXXX-XXXX-3341'}
              </div>
            </div>

          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem' }}>Delivery Fee & Payout History</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem' }}>Transaction ID</th>
                    <th style={{ padding: '0.75rem' }}>Type</th>
                    <th style={{ padding: '0.75rem' }}>Date</th>
                    <th style={{ padding: '0.75rem' }}>Amount</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{tx.reference || tx.id}</td>
                      <td style={{ padding: '0.75rem' }}>{tx.type}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{tx.date}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 800, color: tx.type.includes('Credit') ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                        {tx.type.includes('Credit') ? '+' : '-'}₹{tx.amount}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge badge-success">{tx.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: COMPLETED HISTORY */}
      {activeTab === 'history' && (
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Completed Batch Collections & Tasks</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>Batch ID / Consumer</th>
                  <th style={{ padding: '0.75rem' }}>Type</th>
                  <th style={{ padding: '0.75rem' }}>Volume</th>
                  <th style={{ padding: '0.75rem' }}>Quality Test</th>
                  <th style={{ padding: '0.75rem' }}>Commission Earned</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData?.farmerPickups?.map(pickup => (
                  <tr key={pickup.id || pickup.batchId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>
                      <div style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)' }}>{pickup.batchId || pickup.id}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pickup.farmerName}</div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>Farmer Milk Collection</td>
                    <td style={{ padding: '0.75rem', fontWeight: 800 }}>{pickup.liters} L</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.82rem' }}>
                      {pickup.qualityTest ? `Fat: ${pickup.qualityTest.fatPercentage}% | SNF: ${pickup.qualityTest.snfPercentage}% | ${pickup.qualityTest.temperature}°C` : '-'}
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                      +₹50.00
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`badge ${pickup.status === 'Rejected' ? 'badge-danger' : 'badge-success'}`}>{pickup.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 1: QUALITY TESTING & ACCEPTANCE MODAL */}
      {/* ========================================================== */}
      {activePickup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem'
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
                  ON-SITE MILK QUALITY TEST
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px' }}>
                  Batch #{activePickup.batchId || activePickup.id} ({activePickup.liters} L)
                </h3>
              </div>
              <button onClick={() => setActivePickup(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Live Calculation Preview Banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
              border: '1px solid var(--accent-emerald)',
              borderRadius: '14px',
              padding: '1rem',
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Dynamic Rate & Payout</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                  ₹{calculatedRate}/L ➔ ₹{calculatedTotal}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Quality Score</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: calculatedScore >= 80 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                  {calculatedScore}/100
                </div>
              </div>
            </div>

            <form onSubmit={handleTestAndCollect} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Fat Percentage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="15.0"
                    required
                    value={testedFat}
                    onChange={(e) => setTestedFat(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '1.1rem', fontWeight: 800, marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>SNF Percentage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="4.0"
                    max="15.0"
                    required
                    value={testedSNF}
                    onChange={(e) => setTestedSNF(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '1.1rem', fontWeight: 800, marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Lactometer Reading</label>
                  <input
                    type="number"
                    step="0.5"
                    min="15.0"
                    max="38.0"
                    required
                    value={lactometer}
                    onChange={(e) => setLactometer(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '1.1rem', fontWeight: 800, marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Milk Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="-2.0"
                    max="45.0"
                    required
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '1.1rem', fontWeight: 800, marginTop: '4px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Inspector Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Pure fresh organic morning batch"
                  value={inspectionRemarks}
                  onChange={(e) => setInspectionRemarks(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '0.85rem', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setActivePickup(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submittingTest} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {submittingTest ? 'Saving...' : 'Verify & Credit Farmer (₹50 Fee)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 2: BATCH REJECTION MODAL */}
      {/* ========================================================== */}
      {rejectingPickup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem'
        }}>
          <div className="card" style={{ width: '480px', maxWidth: '95%', borderTop: '4px solid var(--accent-rose)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-rose)', textTransform: 'uppercase' }}>
                  QUALITY REJECTION SYSTEM
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px' }}>
                  Reject Batch #{rejectingPickup.batchId || rejectingPickup.id}
                </h3>
              </div>
              <button onClick={() => setRejectingPickup(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'var(--accent-rose-light)', color: 'var(--accent-rose)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.8rem', marginBottom: '1rem', lineHeight: '1.4' }}>
              ⚠️ <strong>Warning:</strong> Rejecting will quarantine the batch, block farmer payout, and alert the Admin Review board with your inspection findings.
            </div>

            <form onSubmit={handleRejectBatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Primary Rejection Reason</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', fontSize: '0.88rem', fontWeight: 700 }}
                >
                  <option value="Low quality reading">Low quality reading</option>
                  <option value="Abnormal Fat/SNF">Abnormal Fat/SNF</option>
                  <option value="Abnormal Lactometer Reading">Abnormal Lactometer Reading</option>
                  <option value="Temperature issue">Temperature issue (&gt;10°C / spoiled)</option>
                  <option value="Contamination concern">Contamination concern</option>
                  <option value="Damaged/unsafe batch">Damaged/unsafe batch container</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Detailed Remarks & Observations</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this milk batch failed inspection standards..."
                  value={rejectionRemarks}
                  onChange={(e) => setRejectionRemarks(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Optional Evidence Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  style={{ width: '100%', marginTop: '4px', fontSize: '0.82rem' }}
                />
                {evidencePhoto && (
                  <div style={{ marginTop: '0.5rem', borderRadius: '8px', overflow: 'hidden', maxHeight: '120px' }}>
                    <img src={evidencePhoto} alt="Rejection Evidence" style={{ width: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setRejectingPickup(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submittingRejection} className="btn-primary" style={{ flex: 1, justifyContent: 'center', background: 'var(--accent-rose)', borderColor: 'var(--accent-rose)' }}>
                  {submittingRejection ? 'Quarantining...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout Withdrawal Modal */}
      {showPayoutModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
        }}>
          <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Initiate Agent Payout</h3>

            {payoutMsg && (
              <div style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', padding: '0.65rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
                {payoutMsg}
              </div>
            )}

            <form onSubmit={handleAgentPayout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Withdrawal Amount (₹)</label>
                <input type="number" required value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '1.1rem', fontWeight: 800 }} />
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Target Account: <strong>{agentProfile?.bankDetails?.bankName || 'HDFC Bank'} ({agentProfile?.bankDetails?.accountNo || 'XXXX-3341'})</strong>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowPayoutModal(false)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  Confirm Withdrawal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
