import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Milk, Wallet, Clock, Settings, PlusCircle, CheckCircle2, 
  Truck, Award, ShieldCheck, ArrowUpRight, Search, Download, 
  Building, RefreshCw, AlertCircle, Sparkles, Send 
} from 'lucide-react';

export default function FarmerDashboard() {
  const { user, activeTab } = useAuth();

  const [dashboardData, setDashboardData] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Request Pickup Form State
  const [liters, setLiters] = useState('50');
  const [notes, setNotes] = useState('Fresh morning milk batch ready');
  const [submittingLog, setSubmittingLog] = useState(false);
  const [logSuccessMsg, setLogSuccessMsg] = useState('');

  // Payout Modal State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMsg, setPayoutMsg] = useState('');

  // Settings State
  const [farmName, setFarmName] = useState('');
  const [location, setLocation] = useState('');
  const [cattleCount, setCattleCount] = useState('24');
  const [bankName, setBankName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFarmerData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/farmer/dashboard?farmerId=${user?.id}`);
      const data = await res.json();
      if (data.success) {
        setDashboardData(data);
        if (data.farmer) {
          setFarmName(data.farmer.farmName || '');
          setLocation(data.farmer.location || '');
          setCattleCount(String(data.farmer.cattleCount || 24));
          setBankName(data.farmer.bankDetails?.bankName || '');
          setAccountNo(data.farmer.bankDetails?.accountNo || '');
        }
      }

      const histRes = await fetch(`/api/farmer/history?farmerId=${user?.id}`);
      const histData = await histRes.json();
      if (histData.success) {
        setHistoryLogs(histData.logs || []);
        setTransactions(histData.transactions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarmerData();
  }, [user]);

  // Submit Milk Collection Request to Delivery Agent
  const handleRequestPickup = async (e) => {
    e.preventDefault();
    setSubmittingLog(true);
    setLogSuccessMsg('');
    try {
      const res = await fetch('/api/farmer/request-pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmerId: user?.id,
          liters,
          notes
        })
      });
      const data = await res.json();
      if (data.success) {
        setLogSuccessMsg(data.message);
        fetchFarmerData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingLog(false);
    }
  };

  // Process Payout Request
  const handlePayoutRequest = async (e) => {
    e.preventDefault();
    setPayoutMsg('');
    try {
      const res = await fetch('/api/farmer/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmerId: user?.id,
          amount: payoutAmount
        })
      });
      const data = await res.json();
      if (data.success) {
        setPayoutMsg(data.message);
        setTimeout(() => {
          setShowPayoutModal(false);
          setPayoutMsg('');
          fetchFarmerData();
        }, 1500);
      } else {
        setPayoutMsg(data.message || 'Payout failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsMsg('');
    try {
      const res = await fetch('/api/farmer/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmerId: user?.id,
          farmName,
          location,
          cattleCount,
          bankDetails: { bankName, accountNo }
        })
      });
      const data = await res.json();
      if (data.success) {
        setSettingsMsg('Profile & settings saved successfully!');
        fetchFarmerData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !dashboardData) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="pulse-anim" style={{ margin: '0 auto 1rem' }} />
        <p>Loading Farmer Dashboard...</p>
      </div>
    );
  }

  const currentMilk = dashboardData?.currentMilkStatus;
  const farmerProfile = dashboardData?.farmer;
  const stats = dashboardData?.stats;

  const filteredLogs = historyLogs.filter(log => 
    log.dateStr?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(log.liters).includes(searchTerm)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Top Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
        border: '1px solid var(--accent-emerald)',
        borderRadius: '20px',
        padding: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
            🌾 Verified Farmer Portal
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {farmerProfile?.farmName || user?.farmName || 'Patel Dairy Farm'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Location: {farmerProfile?.location || 'Kaira Valley'} • Cattle Count: {farmerProfile?.cattleCount || 12} Cows & Buffaloes
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Account Balance</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
            ₹{farmerProfile?.balance?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
        </div>
      </div>

      {/* TAB 1: CURRENT MILK STATUS & REQUEST PICKUP */}
      {activeTab === 'status' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          {/* Left: Request Milk Collection Form */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Send size={22} color="var(--accent-emerald)" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Request Milk Collection</h3>
            </div>

            <div style={{
              background: 'var(--accent-blue-light)',
              color: 'var(--accent-blue)',
              padding: '0.75rem',
              borderRadius: '10px',
              marginBottom: '1.25rem',
              fontSize: '0.82rem',
              lineHeight: '1.4'
            }}>
              💡 <strong>Workflow Note:</strong> Submit your available milk volume. Delivery Agent John Doe will visit your farm, inspect the <strong>Fat %</strong> and <strong>SNF %</strong>, and the system will automatically credit the calculated funds to your Account Balance!
            </div>

            {logSuccessMsg && (
              <div style={{
                background: 'var(--accent-emerald-light)',
                color: 'var(--accent-emerald)',
                padding: '0.75rem',
                borderRadius: '10px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <CheckCircle2 size={18} /> {logSuccessMsg}
              </div>
            )}

            <form onSubmit={handleRequestPickup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Milk Volume for Collection (Liters)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  placeholder="e.g. 50"
                  value={liters}
                  onChange={(e) => setLiters(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    marginTop: '4px',
                    fontSize: '1.1rem',
                    fontWeight: 800
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Pickup Notes for Delivery Agent</label>
                <input
                  type="text"
                  placeholder="e.g. Fresh morning milk batch in 2 chilled cans"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    marginTop: '4px',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submittingLog}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }}
              >
                {submittingLog ? 'Sending Request...' : 'Send Pickup Request to Agent'}
              </button>
            </form>
          </div>

          {/* Right: Real-Time Pickup Status & Quality Tracker */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Milk size={22} color="var(--accent-emerald)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Today's Collection & Quality Status</h3>
              </div>
              <span className="badge badge-info">{currentMilk ? currentMilk.dateStr : 'Today'}</span>
            </div>

            {currentMilk ? (
              <div>
                {/* Metric Summary Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Requested Volume</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{currentMilk.liters} L</div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tested Fat / SNF</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: currentMilk.fatPercentage > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                      {currentMilk.fatPercentage > 0 ? `${currentMilk.fatPercentage}% / ${currentMilk.snfPercentage}%` : 'Pending Inspection'}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Earned Payout</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                      {currentMilk.totalPrice > 0 ? `₹${currentMilk.totalPrice}` : 'Awaiting Test'}
                    </div>
                  </div>
                </div>

                {/* Status Timeline */}
                <div style={{ padding: '0.5rem 0' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>
                    LIVE DISPATCH TIMELINE
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Step 1 */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'var(--accent-emerald)',
                        color: '#FFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Pickup Requested by Farmer</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Batch #{currentMilk.id} ({currentMilk.liters} Liters)
                        </div>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: currentMilk.fatPercentage > 0 ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                        color: '#FFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Truck size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Agent On-Site Fat & SNF Inspection</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {currentMilk.fatPercentage > 0 
                            ? `Tested by Agent ${currentMilk.agentName}: Fat ${currentMilk.fatPercentage}%, SNF ${currentMilk.snfPercentage}% @ ₹${currentMilk.ratePerLiter}/L`
                            : 'Delivery Agent John Doe assigned. Arriving for quality testing.'}
                        </div>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: currentMilk.totalPrice > 0 ? 'var(--accent-emerald)' : 'var(--bg-primary)',
                        color: currentMilk.totalPrice > 0 ? '#FFF' : 'var(--text-muted)',
                        border: '2px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Money Credited to Farmer Balance</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {currentMilk.totalPrice > 0 
                            ? `₹${currentMilk.totalPrice} successfully credited to your account!`
                            : 'Pending quality calculation by Delivery Agent.'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No active pickup requests. Submit a pickup request on the left for today's milk batch.
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: ACCOUNT BALANCE & PAYOUTS */}
      {activeTab === 'balance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
            
            <div className="card" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#FFFFFF' }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Current Earnings Balance</div>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, margin: '0.5rem 0' }}>
                ₹{farmerProfile?.balance?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
              </div>
              <button
                onClick={() => { setPayoutAmount(String(farmerProfile?.balance || 0)); setShowPayoutModal(true); }}
                style={{
                  background: '#FFFFFF',
                  color: '#059669',
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
                Withdraw to Bank <ArrowUpRight size={16} />
              </button>
            </div>

            <div className="card">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Volume Collected</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.4rem 0', color: 'var(--text-main)' }}>
                {stats?.totalLitersAllTime || 0} Liters
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                100% Quality Tested by Agent
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Linked Payout Bank Account</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.4rem 0', color: 'var(--text-main)' }}>
                {farmerProfile?.bankDetails?.bankName || 'State Bank of India'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                A/C: {farmerProfile?.bankDetails?.accountNo || 'XXXX-XXXX-8921'}
              </div>
            </div>

          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Transaction & Payout Log</h3>
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
                      <td style={{ padding: '0.75rem', fontWeight: 800, color: tx.type.includes('Credit') ? 'var(--accent-emerald)' : 'var(--accent-blue)' }}>
                        {tx.type.includes('Credit') ? '+' : '-'}₹{tx.amount}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`badge ${tx.status === 'Completed' ? 'badge-success' : 'badge-warning'}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUPPLY HISTORY */}
      {activeTab === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Milk Supply History</h3>
            
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search by date or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.5rem 0.5rem 2.2rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>Date</th>
                  <th style={{ padding: '0.75rem' }}>Volume</th>
                  <th style={{ padding: '0.75rem' }}>Tested Fat %</th>
                  <th style={{ padding: '0.75rem' }}>Tested SNF %</th>
                  <th style={{ padding: '0.75rem' }}>Calculated Rate/L</th>
                  <th style={{ padding: '0.75rem' }}>Money Credited</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>{log.dateStr}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 800 }}>{log.liters} L</td>
                    <td style={{ padding: '0.75rem' }}>{log.fatPercentage > 0 ? `${log.fatPercentage}%` : '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{log.snfPercentage > 0 ? `${log.snfPercentage}%` : '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{log.ratePerLiter > 0 ? `₹${log.ratePerLiter}` : '-'}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                      {log.totalPrice > 0 ? `₹${log.totalPrice}` : 'Awaiting Test'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`badge ${log.status.includes('Collected') || log.status === 'Delivered' ? 'badge-success' : 'badge-warning'}`}>
                        {log.status}
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
        <div className="card" style={{ maxWidth: '650px', margin: '0 auto', width: '100%' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Farmer Profile & Bank Settings</h3>

          {settingsMsg && (
            <div style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
              {settingsMsg}
            </div>
          )}

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Farm Name</label>
              <input
                type="text"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
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
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Farm Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
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
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Cattle Count</label>
              <input
                type="number"
                value={cattleCount}
                onChange={(e) => setCattleCount(e.target.value)}
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

            <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Bank Account for Payouts</h4>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
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
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Account Number</label>
              <input
                type="text"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
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

            <button type="submit" className="btn-primary" style={{ justifyContent: 'center', padding: '0.85rem' }}>
              Save Profile Changes
            </button>
          </form>
        </div>
      )}

      {/* Payout Withdrawal Modal */}
      {showPayoutModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200
        }}>
          <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Initiate Payout Withdrawal</h3>

            {payoutMsg && (
              <div style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', padding: '0.65rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
                {payoutMsg}
              </div>
            )}

            <form onSubmit={handlePayoutRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Withdrawal Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    marginTop: '4px',
                    fontSize: '1.1rem',
                    fontWeight: 800
                  }}
                />
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Target Account: <strong>{farmerProfile?.bankDetails?.bankName} ({farmerProfile?.bankDetails?.accountNo})</strong>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
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
