import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { 
  Truck, MapPin, CheckCircle2, Clock, Milk, User, 
  RefreshCw, AlertCircle, ShieldCheck, DollarSign, Calculator,
  Wallet, ArrowUpRight, Search, Settings 
} from 'lucide-react';

export default function DeliveryDashboard() {
  const { user, activeTab, updateUserBalance } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [agentProfile, setAgentProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Selected Pickup for Quality Test Modal
  const [activePickup, setActivePickup] = useState(null);
  const [testedFat, setTestedFat] = useState('4.5');
  const [testedSNF, setTestedSNF] = useState('8.8');
  const [lactometer, setLactometer] = useState('29.5');
  const [submittingTest, setSubmittingTest] = useState(false);

  // Agent Payout Modal
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMsg, setPayoutMsg] = useState('');

  const fetchAgentDashboard = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/delivery/dashboard?agentId=${user?.id}`);
      if (data.success) {
        setDashboardData(data);
        setAgentProfile(data.agent);
        setTransactions(data.transactions || []);

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
  const baseRate = 45;
  const fatDiff = fatVal - 3.5;
  const snfDiff = snfVal - 8.5;
  const calculatedRate = Math.max(35, Math.round(baseRate + (fatDiff * 6) + (snfDiff * 4)));
  const calculatedTotal = activePickup ? Math.round(activePickup.liters * calculatedRate) : 0;

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
          pickupId: activePickup.id,
          testedFat,
          testedSNF,
          lactometerReading: lactometer,
          agentName: user?.name || 'John Doe (Delivery Agent)',
          agentId: user?.id
        })
      });

      if (data.success) {
        setMsg(data.message);
        setActivePickup(null);
        if (data.updatedAgentBalance !== undefined) {
          updateUserBalance(data.updatedAgentBalance);
        }
        fetchAgentDashboard();
      } else {
        setErrorMsg(data.message || 'Quality verification failed');
      }
    } catch (err) {
      setErrorMsg('Server error processing quality verification.');
    } finally {
      setSubmittingTest(false);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus, type) => {
    setMsg('');
    try {
      const data = await apiFetch('/api/delivery/update-status', {
        method: 'POST',
        body: JSON.stringify({ taskId, status: newStatus, type, agentId: user?.id })
      });
      if (data.success) {
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
      if (data.success) {
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
        setPayoutMsg(data.message || 'Payout failed');
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
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-amber)', textTransform: 'uppercase' }}>
            🚚 Delivery Agent Portal
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {agentProfile?.name || user?.name || 'John Doe'}
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
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CURRENT AVAILABLE MONEY</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '2px' }}>
            ₹{Number(currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Commission Earned: ₹50 / delivery
          </div>
        </div>
      </div>

      {msg && (
        <div style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', padding: '0.85rem 1rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={18} /> {msg}
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'var(--accent-rose-light)', color: 'var(--accent-rose)', padding: '0.85rem 1rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem' }}>
          {errorMsg}
        </div>
      )}

      {/* TAB 1: DISPATCH & PICKUPS QUEUE */}
      {(!activeTab || activeTab === 'status') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
          
          {/* Farmer Milk Pickups */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Milk size={22} color="var(--accent-emerald)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Farmer Collection Queue</h3>
              </div>
              <span className="badge badge-info">{dashboardData?.farmerPickups?.length || 0} Batches</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {dashboardData?.farmerPickups?.map(pickup => (
                <div key={pickup.id} style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '1.1rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{pickup.farmerName}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Requested Volume: <strong style={{ color: 'var(--text-main)' }}>{pickup.liters} Liters</strong>
                      </div>
                      {pickup.notes && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                          "{pickup.notes}"
                        </div>
                      )}
                    </div>
                    <span className={`badge ${pickup.status.includes('Collected') || pickup.status === 'Delivered' ? 'badge-success' : 'badge-warning'}`}>
                      {pickup.status}
                    </span>
                  </div>

                  {pickup.fatPercentage > 0 && (
                    <div style={{
                      marginTop: '0.75rem',
                      background: 'var(--accent-emerald-light)',
                      color: 'var(--accent-emerald)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span>Fat: {pickup.fatPercentage}% • SNF: {pickup.snfPercentage}%</span>
                      <span>Farmer Paid: ₹{pickup.totalPrice}</span>
                    </div>
                  )}

                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                    {pickup.fatPercentage === 0 ? (
                      <button
                        onClick={() => { setActivePickup(pickup); setTestedFat('4.5'); setTestedSNF('8.8'); }}
                        className="btn-primary"
                        style={{ fontSize: '0.82rem', padding: '0.55rem 0.85rem' }}
                      >
                        <Calculator size={16} /> Test Fat/SNF (Credit Farmer & Earn ₹50 Fee)
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <CheckCircle2 size={16} /> Verified & Farmer Balance Credited
                      </span>
                    )}
                  </div>
                </div>
              ))}
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
                        style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem' }}
                      >
                        Mark Delivered & Earn ₹50 Fee
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
                  marginTop: '0.5rem'
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
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Completed Delivery Logs</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>Batch / Consumer</th>
                  <th style={{ padding: '0.75rem' }}>Type</th>
                  <th style={{ padding: '0.75rem' }}>Volume</th>
                  <th style={{ padding: '0.75rem' }}>Date</th>
                  <th style={{ padding: '0.75rem' }}>Commission Earned</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData?.farmerPickups?.map(pickup => (
                  <tr key={pickup.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>{pickup.farmerName}</td>
                    <td style={{ padding: '0.75rem' }}>Farmer Pickup & Testing</td>
                    <td style={{ padding: '0.75rem', fontWeight: 800 }}>{pickup.liters} L</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{pickup.dateStr}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>+₹50.00</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className="badge badge-success">{pickup.status}</span>
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
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Delivery Agent Vehicle & Route Settings</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Agent Name</label>
              <input type="text" readOnly value={agentProfile?.name || 'John Doe'} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Assigned Route Area</label>
              <input type="text" readOnly value={agentProfile?.assignedArea || 'Sector 14 & Green Valley'} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Vehicle Registration No.</label>
              <input type="text" readOnly value={agentProfile?.vehicleNo || 'GJ-07-MK-4421'} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Quality Testing Modal */}
      {activePickup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '1rem'
        }}>
          <div className="card" style={{ width: '450px', maxWidth: '95%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ShieldCheck size={24} color="var(--accent-emerald)" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>On-Site Quality Inspection</h3>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Testing batch for <strong>{activePickup.farmerName}</strong> ({activePickup.liters} Liters).
            </p>

            <form onSubmit={handleTestAndCollect} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Tested Fat %</label>
                  <input
                    type="number" step="0.1" required
                    value={testedFat} onChange={(e) => setTestedFat(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '1rem', fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Tested SNF %</label>
                  <input
                    type="number" step="0.1" required
                    value={testedSNF} onChange={(e) => setTestedSNF(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '1rem', fontWeight: 800 }}
                  />
                </div>
              </div>

              <div style={{ background: 'var(--accent-emerald-light)', border: '1px solid var(--accent-emerald)', borderRadius: '14px', padding: '1rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
                  PAYOUT & COMMISSION PREVIEW
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Farmer Payout Rate</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>₹{calculatedRate}/L (₹{calculatedTotal})</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Agent Fee Earned</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-amber)' }}>+₹50.00</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setActivePickup(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submittingTest} className="btn-primary" style={{ flex: 1.5, justifyContent: 'center' }}>
                  {submittingTest ? 'Processing...' : 'Verify Quality & Credit Balances'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent Payout Modal */}
      {showPayoutModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
        }}>
          <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Withdraw Agent Earnings</h3>
            
            {payoutMsg && (
              <div style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', padding: '0.65rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
                {payoutMsg}
              </div>
            )}

            <form onSubmit={handleAgentPayout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Withdrawal Amount (₹)</label>
                <input
                  type="number" required value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '1.1rem', fontWeight: 800 }}
                />
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Target Account: <strong>{agentProfile?.bankDetails?.bankName || 'HDFC Bank'} ({agentProfile?.bankDetails?.accountNo || 'XXXX-3341'})</strong>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowPayoutModal(false)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  Confirm Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
