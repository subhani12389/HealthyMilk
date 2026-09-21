import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { renderQRCodeSVG, generateBatchQRData } from '../utils/qrCode';
import { 
  Milk, Wallet, Clock, Settings, CheckCircle2, AlertTriangle, 
  Truck, ShieldCheck, ArrowUpRight, Search, Download, 
  RefreshCw, Send, QrCode, Award, Eye, Thermometer 
} from 'lucide-react';

export default function FarmerDashboard() {
  const { user, activeTab, updateUserBalance } = useAuth();

  const [dashboardData, setDashboardData] = useState(null);
  const [batchesList, setBatchesList] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Request Pickup Form State
  const [liters, setLiters] = useState('50');
  const [notes, setNotes] = useState('Fresh morning milk batch ready');
  const [submittingLog, setSubmittingLog] = useState(false);
  const [logSuccessMsg, setLogSuccessMsg] = useState('');
  const [generatedBatchId, setGeneratedBatchId] = useState('');

  // Payout Modal State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMsg, setPayoutMsg] = useState('');

  // QR Modal State
  const [selectedQRBatch, setSelectedQRBatch] = useState(null);

  // Selected Batch for Details
  const [selectedBatchDetails, setSelectedBatchDetails] = useState(null);

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
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/farmer/dashboard?farmerId=${user.id}`);
      if (data && data.success) {
        setDashboardData(data);
        setBatchesList(data.batches || []);
        if (data.farmer) {
          setFarmName(data.farmer.farmName || '');
          setLocation(data.farmer.location || '');
          setCattleCount(String(data.farmer.cattleCount || 24));
          setBankName(data.farmer.bankDetails?.bankName || '');
          setAccountNo(data.farmer.bankDetails?.accountNo || '');
          
          if (data.farmer.balance !== undefined) {
            updateUserBalance(data.farmer.balance);
          }
        }
      }

      const histData = await apiFetch(`/api/farmer/history?farmerId=${user.id}`);
      if (histData && histData.success) {
        setHistoryLogs(Array.isArray(histData.logs) ? histData.logs : []);
        setTransactions(Array.isArray(histData.transactions) ? histData.transactions : []);
        if (histData.batches && histData.batches.length > 0) {
          setBatchesList(histData.batches);
        }
      }
    } catch (err) {
      console.error("Farmer fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarmerData();
  }, [user?.id]);

  // Submit Milk Collection Request
  const handleRequestPickup = async (e) => {
    e.preventDefault();
    setSubmittingLog(true);
    setLogSuccessMsg('');
    setGeneratedBatchId('');
    try {
      const data = await apiFetch('/api/farmer/request-pickup', {
        method: 'POST',
        body: JSON.stringify({
          farmerId: user?.id,
          liters,
          notes
        })
      });
      if (data && data.success) {
        setLogSuccessMsg(data.message);
        setGeneratedBatchId(data.batchId || data.batch?.batchId || '');
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
      const data = await apiFetch('/api/farmer/payout', {
        method: 'POST',
        body: JSON.stringify({
          farmerId: user?.id,
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
          fetchFarmerData();
        }, 1200);
      } else {
        setPayoutMsg(data?.message || 'Payout failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Export CSV Function
  const exportCSV = () => {
    const list = batchesList.length > 0 ? batchesList : historyLogs;
    const headers = ["Batch ID", "Date", "Volume (L)", "Fat %", "SNF %", "Lactometer", "Temp (C)", "Rate/L", "Total (INR)", "Status"];
    const rows = list.map(b => [
      b.batchId || b.id,
      new Date(b.collectionDate || b.timestamp).toLocaleDateString(),
      b.liters,
      b.qualityTest?.fatPercentage || b.fatPercentage || '-',
      b.qualityTest?.snfPercentage || b.snfPercentage || '-',
      b.qualityTest?.lactometerReading || b.lactometerReading || '-',
      b.qualityTest?.temperature || 4.0,
      b.qualityTest?.ratePerLiter || b.ratePerLiter || '-',
      b.qualityTest?.totalPrice || b.totalPrice || '-',
      b.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `HealthyMilk_Farmer_Batches_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsMsg('');
    try {
      const data = await apiFetch('/api/farmer/settings', {
        method: 'PUT',
        body: JSON.stringify({
          farmerId: user?.id,
          farmName,
          location,
          cattleCount,
          bankDetails: { bankName, accountNo }
        })
      });
      if (data && data.success) {
        setSettingsMsg('Profile & settings saved successfully!');
        fetchFarmerData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const currentMilk = dashboardData?.currentMilkStatus;
  const farmerProfile = dashboardData?.farmer;
  const stats = dashboardData?.stats;
  const currentBalance = user?.balance !== undefined ? user.balance : (farmerProfile?.balance || 0);

  const rejectedBatches = (batchesList || []).filter(b => b.status === 'Rejected');
  const txList = Array.isArray(transactions) ? transactions : [];

  const filteredBatches = (batchesList.length > 0 ? batchesList : historyLogs).filter(batch => {
    const q = searchTerm.toLowerCase();
    const batchIdStr = String(batch.batchId || batch.id || '').toLowerCase();
    const statusStr = String(batch.status || '').toLowerCase();
    const notesStr = String(batch.notes || '').toLowerCase();
    return batchIdStr.includes(q) || statusStr.includes(q) || notesStr.includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Top Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
        border: '1px solid var(--accent-emerald)',
        borderRadius: '20px',
        padding: 'clamp(1rem, 2.5vw, 1.5rem)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ minWidth: '220px', flex: '1 1 240px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
            🌾 Verified Farmer Portal
          </div>
          <h2 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.5rem)', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {farmerProfile?.farmName || user?.farmName || user?.name || 'Patel Dairy Farm'}
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Location: {farmerProfile?.location || 'Kaira Valley'} • Cattle Count: {farmerProfile?.cattleCount || 15} Cows & Buffaloes
          </p>
        </div>
        <div style={{ textAlign: 'left', minWidth: '160px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Available Balance</div>
          <div style={{ fontSize: 'clamp(1.35rem, 4vw, 1.6rem)', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '2px' }}>
            ₹{Number(currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* REJECTED BATCHES ALERT BANNER */}
      {rejectedBatches.length > 0 && (
        <div style={{
          background: 'var(--accent-rose-light)',
          border: '1px solid var(--accent-rose)',
          borderRadius: '16px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <AlertTriangle size={22} color="var(--accent-rose)" />
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-rose)', margin: 0 }}>
              Action Required: {rejectedBatches.length} Milk Batch(es) Rejected During Inspection
            </h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {rejectedBatches.map(b => (
              <div key={b.batchId || b.id} style={{ background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <span style={{ fontWeight: 800, color: 'var(--accent-rose)', fontFamily: 'monospace' }}>{b.batchId}</span>
                  <span className={`badge ${b.rejection?.reviewStatus === 'Approved' ? 'badge-success' : 'badge-danger'}`}>
                    {b.rejection?.reviewStatus || 'Quarantined'}
                  </span>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  Reason: {b.rejection?.reason || 'Failed quality checks'}
                </div>
                {b.rejection?.remarks && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px', fontStyle: 'italic' }}>
                    Agent Remarks: "{b.rejection.remarks}"
                  </div>
                )}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Payout on hold pending Admin review. Contact dairy coordinator for re-testing.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 1: CURRENT MILK STATUS & REQUEST PICKUP */}
      {(!activeTab || activeTab === 'status') && (
        <div className="grid-responsive-2">
          
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
              💡 <strong>Batch Traceability:</strong> Submitting creates a unique <strong>Milk Batch ID (HM-YYYYMMDD-XXXX)</strong>. The delivery agent will test Fat %, SNF %, Lactometer, and Temperature on-site to credit funds.
            </div>

            {logSuccessMsg && (
              <div style={{
                background: 'var(--accent-emerald-light)',
                color: 'var(--accent-emerald)',
                padding: '0.85rem',
                borderRadius: '12px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                fontWeight: 600
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={18} /> {logSuccessMsg}
                </div>
                {generatedBatchId && (
                  <div style={{ marginTop: '6px', fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'monospace' }}>
                    Assigned Batch ID: {generatedBatchId}
                  </div>
                )}
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
                  placeholder="e.g. Morning fresh A2 batch in chilled container"
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
                {submittingLog ? 'Registering Batch...' : 'Generate Batch & Request Pickup'}
              </button>
            </form>
          </div>

          {/* Right: Real-Time Pickup Status & Quality Tracker */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Milk size={22} color="var(--accent-emerald)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Today's Batch & Quality</h3>
              </div>
              <span className="badge badge-info">{currentMilk?.batchId || (currentMilk ? currentMilk.dateStr : 'Today')}</span>
            </div>

            {currentMilk ? (
              <div>
                {/* Batch ID Banner */}
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Milk Batch ID</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'monospace' }}>
                      {currentMilk.batchId || currentMilk.id}
                    </div>
                  </div>
                  <span className={`badge ${currentMilk.status === 'Rejected' ? 'badge-danger' : currentMilk.status === 'Accepted' ? 'badge-success' : 'badge-warning'}`}>
                    {currentMilk.status}
                  </span>
                </div>

                {/* Quality Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', marginBottom: '1.25rem' }}>
                  <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Volume</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{currentMilk.liters} L</div>
                  </div>

                  <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fat / SNF %</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: currentMilk.fatPercentage > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                      {currentMilk.fatPercentage > 0 ? `${currentMilk.fatPercentage}% / ${currentMilk.snfPercentage}%` : 'Pending'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Temperature</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                      {currentMilk.temperature || 4.0}°C
                    </div>
                  </div>
                </div>

                {/* Earned Payout Box */}
                <div style={{ background: 'var(--bg-primary)', padding: '0.85rem 1rem', borderRadius: '12px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Calculated Rate & Payout</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                      {currentMilk.totalPrice > 0 ? `₹${currentMilk.totalPrice} (@ ₹${currentMilk.ratePerLiter}/L)` : 'Pending Inspection'}
                    </div>
                  </div>
                  {currentMilk.qualityScore > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quality Score</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: currentMilk.qualityScore >= 80 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                        {currentMilk.qualityScore}/100
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedQRBatch(currentMilk)}
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', marginBottom: '1.25rem', fontSize: '0.85rem' }}
                >
                  <QrCode size={18} color="var(--accent-emerald)" /> View Batch Traceability QR Code & Certificate
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No active pickup requests. Submit a pickup request on the left to generate your batch ID.
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: ACCOUNT BALANCE & PAYOUTS */}
      {activeTab === 'balance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="grid-responsive-3">
            
            <div className="card" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#FFFFFF' }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Current Earnings Balance</div>
              <div style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.25rem)', fontWeight: 800, margin: '0.4rem 0' }}>
                ₹{Number(currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <button
                onClick={() => { setPayoutAmount(String(currentBalance)); setShowPayoutModal(true); }}
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
                  marginTop: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                Withdraw to Bank <ArrowUpRight size={16} />
              </button>
            </div>

            <div className="card">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Volume Collected</div>
              <div style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, margin: '0.4rem 0', color: 'var(--text-main)' }}>
                {stats?.totalLitersAllTime || 110} Liters
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
            <div className="table-responsive">
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
                  {txList.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{tx.reference || tx.id}</td>
                      <td style={{ padding: '0.75rem' }}>{tx.type}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{tx.date}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 800, color: tx.type?.includes('Credit') ? 'var(--accent-emerald)' : 'var(--accent-blue)' }}>
                        {tx.type?.includes('Credit') ? '+' : '-'}₹{tx.amount}
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

      {/* TAB 3: BATCH SUPPLY HISTORY WITH TRACEABILITY & CSV EXPORT */}
      {activeTab === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Milk Batch Traceability & Supply History</h3>
            
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', width: '100%', maxWidth: '420px' }}>
              <button onClick={exportCSV} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}>
                <Download size={16} /> Export CSV
              </button>

              <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search Batch ID, Status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.5rem 0.45rem 2.2rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem' }}>Batch ID</th>
                  <th style={{ padding: '0.75rem' }}>Collection Date</th>
                  <th style={{ padding: '0.75rem' }}>Volume</th>
                  <th style={{ padding: '0.75rem' }}>Fat % / SNF %</th>
                  <th style={{ padding: '0.75rem' }}>Lactometer & Temp</th>
                  <th style={{ padding: '0.75rem' }}>Payout</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Certificate</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map(b => {
                  const isRej = b.status === 'Rejected';
                  const fat = b.qualityTest?.fatPercentage || b.fatPercentage || 0;
                  const snf = b.qualityTest?.snfPercentage || b.snfPercentage || 0;
                  const lacto = b.qualityTest?.lactometerReading || b.lactometerReading || 0;
                  const temp = b.qualityTest?.temperature || 4.0;
                  const payout = b.qualityTest?.totalPrice || b.totalPrice || 0;
                  return (
                    <tr key={b.batchId || b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'monospace' }}>
                        {b.batchId || b.id}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {new Date(b.collectionDate || b.timestamp).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 800 }}>{b.liters} L</td>
                      <td style={{ padding: '0.75rem' }}>{fat > 0 ? `${fat}% / ${snf}%` : '-'}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.8rem' }}>
                        {lacto > 0 ? `${lacto} • ${temp}°C` : '-'}
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 800, color: isRej ? 'var(--accent-rose)' : payout > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                        {isRej ? 'Withheld (Rejected)' : payout > 0 ? `₹${payout}` : 'Pending Test'}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`badge ${isRej ? 'badge-danger' : b.status === 'Accepted' || b.status === 'Delivered' ? 'badge-success' : 'badge-warning'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <button onClick={() => setSelectedQRBatch(b)} style={{ background: 'none', border: 'none', color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                          QR Certificate
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
              <input type="text" value={farmName} onChange={(e) => setFarmName(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Farm Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Cattle Count</label>
              <input type="number" value={cattleCount} onChange={(e) => setCattleCount(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px' }} />
            </div>

            <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Bank Account for Payouts</h4>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Bank Name</label>
              <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Account Number</label>
              <input type="text" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px' }} />
            </div>

            <button type="submit" className="btn-primary" style={{ justifyContent: 'center', padding: '0.85rem' }}>
              Save Profile Changes
            </button>
          </form>
        </div>
      )}

      {/* QR Code Modal */}
      {selectedQRBatch && (
        <div className="modal-backdrop-custom" onClick={() => setSelectedQRBatch(null)}>
          <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
              HEALTHYMILK DIGITAL CERTIFICATE
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px' }}>
              Batch Traceability QR Code
            </h3>
            
            <div 
              style={{ margin: '1.25rem auto', width: '160px', height: '160px', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '8px', background: '#FFF' }}
              dangerouslySetInnerHTML={{ __html: renderQRCodeSVG(generateBatchQRData(selectedQRBatch), 144) }}
            />

            <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '0.85rem', textAlign: 'left', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              <div>Batch ID: <strong style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)' }}>{selectedQRBatch.batchId || selectedQRBatch.id}</strong></div>
              <div>Farmer: <strong>{selectedQRBatch.farmerName || farmerProfile?.farmName}</strong></div>
              <div>Volume: <strong>{selectedQRBatch.liters} Liters</strong></div>
              <div>Tested Fat / SNF: <strong>{selectedQRBatch.qualityTest ? `${selectedQRBatch.qualityTest.fatPercentage}% / ${selectedQRBatch.qualityTest.snfPercentage}%` : (selectedQRBatch.fatPercentage > 0 ? `${selectedQRBatch.fatPercentage}% / ${selectedQRBatch.snfPercentage}%` : 'Pending Inspection')}</strong></div>
              <div>Temperature: <strong>{selectedQRBatch.qualityTest?.temperature || 4.0}°C</strong></div>
              <div>Quality Status: <strong style={{ color: selectedQRBatch.status === 'Rejected' ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>{selectedQRBatch.status}</strong></div>
            </div>

            <button onClick={() => setSelectedQRBatch(null)} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Close Certificate
            </button>
          </div>
        </div>
      )}

      {/* Payout Withdrawal Modal */}
      {showPayoutModal && (
        <div className="modal-backdrop-custom" onClick={() => setShowPayoutModal(false)}>
          <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Initiate Payout Withdrawal</h3>

            {payoutMsg && (
              <div style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', padding: '0.65rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
                {payoutMsg}
              </div>
            )}

            <form onSubmit={handlePayoutRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Withdrawal Amount (₹)</label>
                <input type="number" required value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: '1.1rem', fontWeight: 800 }} />
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Target Account: <strong>{farmerProfile?.bankDetails?.bankName || 'State Bank of India'} ({farmerProfile?.bankDetails?.accountNo || 'XXXX-8921'})</strong>
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
