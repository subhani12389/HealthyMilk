import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../utils/api';
import { renderQRCodeSVG, generateBatchQRData } from '../utils/qrCode';
import { SkeletonBanner, SkeletonStatGrid, SkeletonCard, SkeletonTable } from '../components/Skeleton';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { 
  Milk, Wallet, Clock, Settings, CheckCircle2, AlertTriangle, 
  Truck, ShieldCheck, ArrowUpRight, Search, Download, 
  RefreshCw, Send, QrCode, Award, Eye, Thermometer, Loader2, Sparkles
} from 'lucide-react';

export default function FarmerDashboard() {
  const { user, activeTab, updateUserBalance } = useAuth();
  const { showToast } = useToast();

  const [dashboardData, setDashboardData] = useState(null);
  const [batchesList, setBatchesList] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination States
  const [batchPage, setBatchPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const PAGE_SIZE = 6;

  // Request Pickup Form State
  const [liters, setLiters] = useState('50');
  const [notes, setNotes] = useState('Fresh morning milk batch ready');
  const [submittingLog, setSubmittingLog] = useState(false);
  const [logSuccessMsg, setLogSuccessMsg] = useState('');
  const [generatedBatchId, setGeneratedBatchId] = useState('');

  // Payout Modal State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
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
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFarmerData = async () => {
    if (!user?.id) return;
    try {
      const [dashRes, histRes] = await Promise.all([
        apiFetch(`/api/farmer/dashboard?farmerId=${user.id}`),
        apiFetch(`/api/farmer/history?farmerId=${user.id}`)
      ]);

      if (dashRes && dashRes.success) {
        setDashboardData(dashRes);
        setBatchesList(dashRes.batches || []);
        if (dashRes.farmer) {
          setFarmName(dashRes.farmer.farmName || '');
          setLocation(dashRes.farmer.location || '');
          setCattleCount(String(dashRes.farmer.cattleCount || 24));
          setBankName(dashRes.farmer.bankDetails?.bankName || '');
          setAccountNo(dashRes.farmer.bankDetails?.accountNo || '');
          
          if (dashRes.farmer.balance !== undefined) {
            updateUserBalance(dashRes.farmer.balance);
          }
        }
      }

      if (histRes && histRes.success) {
        setHistoryLogs(Array.isArray(histRes.logs) ? histRes.logs : []);
        setTransactions(Array.isArray(histRes.transactions) ? histRes.transactions : []);
        if (histRes.batches && histRes.batches.length > 0) {
          setBatchesList(histRes.batches);
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
    if (e) e.preventDefault();
    if (submittingLog) return;

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
        showToast(`Batch ${data.batchId} created successfully!`, 'success');
        fetchFarmerData();
      } else {
        showToast(data?.message || 'Failed to request pickup.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error requesting pickup.', 'error');
    } finally {
      setSubmittingLog(false);
    }
  };

  // Process Payout Request
  const handlePayoutRequest = async (e) => {
    if (e) e.preventDefault();
    if (submittingPayout) return;

    setSubmittingPayout(true);
    setPayoutMsg('');
    try {
      const data = await apiFetch('/api/farmer/payout', {
        method: 'POST',
        body: JSON.stringify({
          farmerId: user?.id,
          amount: Number(payoutAmount)
        })
      });
      if (data && data.success) {
        setPayoutMsg(data.message);
        showToast('Payout withdrawal request submitted successfully.', 'success');
        if (data.remainingBalance !== undefined) {
          updateUserBalance(data.remainingBalance);
        }
        setTimeout(() => {
          setShowPayoutModal(false);
          setPayoutMsg('');
          setPayoutAmount('');
          fetchFarmerData();
        }, 1000);
      } else {
        const msg = data?.message || 'Payout failed.';
        setPayoutMsg(msg);
        showToast(msg, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error submitting payout request.', 'error');
    } finally {
      setSubmittingPayout(false);
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
    showToast('Batch ledger exported to CSV.', 'info');
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    if (savingSettings) return;

    setSavingSettings(true);
    setSettingsMsg('');
    try {
      const data = await apiFetch('/api/farmer/settings', {
        method: 'PUT',
        body: JSON.stringify({
          farmerId: user?.id,
          farmName,
          location,
          cattleCount: Number(cattleCount),
          bankDetails: {
            bankName,
            accountNo,
            ifsc: 'SBIN0004123'
          }
        })
      });
      if (data && data.success) {
        setSettingsMsg('Profile updated successfully!');
        showToast('Farm profile & bank settings saved!', 'success');
        fetchFarmerData();
      } else {
        setSettingsMsg(data?.message || 'Failed to update settings');
        showToast(data?.message || 'Failed to update profile.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating profile settings.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const farmerProfile = dashboardData?.farmer || user;
  const currentBalance = farmerProfile?.balance !== undefined ? farmerProfile.balance : (user?.balance || 0);
  const stats = dashboardData?.stats || {
    totalLitersAllTime: 0,
    totalEarningsAllTime: 0,
    logsCount: 0,
    acceptedCount: 0,
    rejectedCount: 0
  };

  const rejectedBatches = (batchesList || []).filter(b => b.status === 'Rejected');
  const txList = Array.isArray(transactions) ? transactions : [];

  const filteredBatches = (batchesList.length > 0 ? batchesList : historyLogs).filter(batch => {
    const q = searchTerm.toLowerCase();
    const batchIdStr = String(batch.batchId || batch.id || '').toLowerCase();
    const statusStr = String(batch.status || '').toLowerCase();
    const notesStr = String(batch.notes || '').toLowerCase();
    return batchIdStr.includes(q) || statusStr.includes(q) || notesStr.includes(q);
  });

  // Paginated Slices
  const paginatedBatches = filteredBatches.slice((batchPage - 1) * PAGE_SIZE, batchPage * PAGE_SIZE);
  const paginatedHistory = historyLogs.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE);
  const paginatedTx = txList.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE);

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

            {logSuccessMsg && (
              <div style={{ background: 'var(--accent-emerald-light)', border: '1px solid var(--accent-emerald)', padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                  <CheckCircle2 size={18} /> {logSuccessMsg}
                </div>
                {generatedBatchId && (
                  <div style={{ marginTop: '0.6rem', fontSize: '0.85rem' }}>
                    Your Unique Milk Batch ID is: <strong style={{ color: 'var(--accent-emerald)', fontFamily: 'monospace' }}>{generatedBatchId}</strong>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleRequestPickup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Milk Quantity (Liters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  min="1"
                  max="1000"
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
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Batch Notes / Morning or Evening
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Morning organic milking, chilled at 4°C"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    marginTop: '4px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submittingLog}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', marginTop: '0.5rem' }}
              >
                {submittingLog ? (
                  <>
                    <Loader2 size={18} className="pulse-anim" /> Generating Batch ID...
                  </>
                ) : (
                  <>
                    <Send size={18} /> Request Pickup & Generate Batch ID
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right: Quick Stats & Recent Batches */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.85rem'
            }}>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Volume Sold</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                  {stats.totalLitersAllTime} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>L</span>
                </div>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Earnings</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '4px' }}>
                  ₹{Number(stats.totalEarningsAllTime || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Accepted Batches</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '4px' }}>
                  {stats.acceptedCount}
                </div>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rejected Batches</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: stats.rejectedCount > 0 ? 'var(--accent-rose)' : 'var(--text-muted)', marginTop: '4px' }}>
                  {stats.rejectedCount}
                </div>
              </div>
            </div>

            {/* Recent Batches Mini Card */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Recent Milk Batches</h4>
                <button
                  onClick={fetchFarmerData}
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                >
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>

              {batchesList.length === 0 ? (
                <EmptyState
                  title="No batches recorded yet"
                  description="Submit your first milk collection request on the left."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {batchesList.slice(0, 3).map((b) => (
                    <div key={b.batchId || b.id} style={{
                      padding: '0.75rem',
                      borderRadius: '10px',
                      background: 'var(--bg-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.82rem'
                    }}>
                      <div>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)' }}>{b.batchId}</strong>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {b.liters}L • {new Date(b.collectionDate || Date.now()).toLocaleDateString()}
                        </div>
                      </div>
                      <span className={`badge ${b.status === 'Accepted' || b.status === 'Delivered' ? 'badge-success' : b.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MILK BATCHES & TRACEABILITY */}
      {activeTab === 'batches' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Milk Batch Traceability Ledger</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Complete audit history of all milk pickup batches</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={exportCSV} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                <Download size={15} /> Export CSV
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by Batch ID, status, or remarks..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setBatchPage(1); }}
              style={{
                width: '100%',
                padding: '0.65rem 0.75rem 0.65rem 2.2rem',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {filteredBatches.length === 0 ? (
            <EmptyState
              title="No batches match your filter"
              description="Try adjusting your search query or clear the filter."
            />
          ) : (
            <>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Batch ID</th>
                      <th>Date</th>
                      <th>Volume</th>
                      <th>Quality Metrics</th>
                      <th>Payout</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBatches.map((batch) => (
                      <tr key={batch.batchId || batch.id}>
                        <td>
                          <strong style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)' }}>
                            {batch.batchId || batch.id}
                          </strong>
                        </td>
                        <td>{new Date(batch.collectionDate || batch.timestamp || Date.now()).toLocaleDateString()}</td>
                        <td><strong>{batch.liters} L</strong></td>
                        <td>
                          {batch.qualityTest ? (
                            <span style={{ fontSize: '0.8rem' }}>
                              Fat: <strong>{batch.qualityTest.fatPercentage}%</strong> • SNF: <strong>{batch.qualityTest.snfPercentage}%</strong>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Pending Field Test</span>
                          )}
                        </td>
                        <td>
                          {batch.qualityTest?.totalPrice ? (
                            <strong style={{ color: 'var(--accent-emerald)' }}>₹{batch.qualityTest.totalPrice}</strong>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${batch.status === 'Accepted' || batch.status === 'Delivered' ? 'badge-success' : batch.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                            {batch.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              onClick={() => setSelectedQRBatch(batch)}
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              title="View QR Code"
                            >
                              <QrCode size={14} />
                            </button>
                            <button
                              onClick={() => setSelectedBatchDetails(batch)}
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              title="View Timeline"
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={batchPage}
                totalItems={filteredBatches.length}
                pageSize={PAGE_SIZE}
                onPageChange={setBatchPage}
              />
            </>
          )}
        </div>
      )}

      {/* TAB 3: QUALITY HISTORY */}
      {activeTab === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Quality Inspection History</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lab test metrics, Fat %, SNF %, and Lactometer results</p>
            </div>
          </div>

          {historyLogs.length === 0 ? (
            <EmptyState
              title="No quality test logs recorded"
              description="When delivery agents test your milk batches, readings will appear here."
            />
          ) : (
            <>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Batch ID</th>
                      <th>Tested Date</th>
                      <th>Fat %</th>
                      <th>SNF %</th>
                      <th>Lactometer</th>
                      <th>Temp</th>
                      <th>Score</th>
                      <th>Rate / L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.map((log, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{log.batchId || log.id}</td>
                        <td>{new Date(log.testedAt || log.timestamp || Date.now()).toLocaleDateString()}</td>
                        <td><strong style={{ color: 'var(--accent-blue)' }}>{log.fatPercentage}%</strong></td>
                        <td><strong style={{ color: 'var(--accent-emerald)' }}>{log.snfPercentage}%</strong></td>
                        <td>{log.lactometerReading || 30.0}</td>
                        <td>{log.temperature || 4.0}°C</td>
                        <td>
                          <span className="badge badge-success">
                            {log.qualityScore || 85}/100
                          </span>
                        </td>
                        <td><strong>₹{log.ratePerLiter || 45}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={historyPage}
                totalItems={historyLogs.length}
                pageSize={PAGE_SIZE}
                onPageChange={setHistoryPage}
              />
            </>
          )}
        </div>
      )}

      {/* TAB 4: WALLET & PAYOUTS */}
      {activeTab === 'wallet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="grid-responsive-2">
            <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-card-hover) 100%)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Wallet Balance Available</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-emerald)', margin: '0.4rem 0 1rem' }}>
                ₹{Number(currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <button
                onClick={() => setShowPayoutModal(true)}
                disabled={currentBalance <= 0}
                className="btn-primary"
                style={{ padding: '0.75rem 1.5rem', width: '100%', justifyContent: 'center' }}
              >
                <ArrowUpRight size={18} /> Request Bank Withdrawal
              </button>
            </div>

            <div className="card">
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>Bank Account on File</h4>
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div>Bank Name: <strong>{farmerProfile?.bankDetails?.bankName || 'State Bank of India'}</strong></div>
                <div>Account No: <strong style={{ fontFamily: 'monospace' }}>{farmerProfile?.bankDetails?.accountNo || 'XXXX-XXXX-8921'}</strong></div>
                <div>IFSC: <strong style={{ fontFamily: 'monospace' }}>{farmerProfile?.bankDetails?.ifsc || 'SBIN0004123'}</strong></div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Financial Transaction Ledger</h3>
            {txList.length === 0 ? (
              <EmptyState
                title="No financial transactions yet"
                description="Earnings from accepted milk batches will appear in this ledger."
              />
            ) : (
              <>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTx.map((tx, i) => (
                        <tr key={tx.id || i}>
                          <td>{new Date(tx.timestamp || tx.date || Date.now()).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge ${tx.type === 'credit' ? 'badge-success' : 'badge-warning'}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td>{tx.description}</td>
                          <td>
                            <strong style={{ color: tx.type === 'credit' ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                              {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                            </strong>
                          </td>
                          <td><span className="badge badge-success">Completed</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={txPage}
                  totalItems={txList.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setTxPage}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: FARM & BANK SETTINGS */}
      {activeTab === 'settings' && (
        <div className="card" style={{ maxWidth: '680px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>Farm & Bank Account Settings</h3>

          {settingsMsg && (
            <div style={{ background: 'var(--accent-emerald-light)', border: '1px solid var(--accent-emerald)', padding: '0.85rem', borderRadius: '10px', color: 'var(--accent-emerald)', fontWeight: 600, marginBottom: '1rem', fontSize: '0.85rem' }}>
              {settingsMsg}
            </div>
          )}

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Farm Name</label>
              <input
                type="text"
                required
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Farm Location</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Cattle Count</label>
              <input
                type="number"
                min="1"
                value={cattleCount}
                onChange={(e) => setCattleCount(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>Direct Bank Transfer Details</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Account Number</label>
                  <input
                    type="text"
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', marginTop: '0.5rem' }}
            >
              {savingSettings ? (
                <>
                  <Loader2 size={18} className="pulse-anim" /> Saving Settings...
                </>
              ) : (
                <>
                  <Settings size={18} /> Save Settings & Bank Profile
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* MODAL: Payout Request */}
      {showPayoutModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Request Bank Withdrawal</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Available Balance: <strong>₹{currentBalance}</strong>
            </p>

            {payoutMsg && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
                {payoutMsg}
              </div>
            )}

            <form onSubmit={handlePayoutRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="100"
                  max={currentBalance}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder={`Max ₹${currentBalance}`}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
                />
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
                  disabled={submittingPayout || Number(payoutAmount) <= 0 || Number(payoutAmount) > currentBalance}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {submittingPayout ? 'Processing...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QR Code View */}
      {selectedQRBatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Milk Batch QR Code</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Batch: <strong style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)' }}>{selectedQRBatch.batchId || selectedQRBatch.id}</strong>
            </p>

            <div
              style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}
              dangerouslySetInnerHTML={{
                __html: renderQRCodeSVG(generateBatchQRData(selectedQRBatch), 200)
              }}
            />

            <button
              onClick={() => setSelectedQRBatch(null)}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
            >
              Close QR Code
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Batch Timeline Details */}
      {selectedBatchDetails && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Batch Audit Timeline</h3>
              <button
                onClick={() => setSelectedBatchDetails(null)}
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
              >
                Close
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Batch ID: <strong style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)' }}>{selectedBatchDetails.batchId}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {(selectedBatchDetails.auditHistory || []).length > 0 ? (
                selectedBatchDetails.auditHistory.map((item, idx) => (
                  <div key={idx} style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--bg-primary)', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>{item.fromStatus} &rarr; {item.toStatus}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(item.changedAt).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>Changed by: {item.changedBy}</div>
                    {item.reason && <div style={{ marginTop: '2px', fontStyle: 'italic' }}>Reason: {item.reason}</div>}
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                  Initial collection status: <strong>{selectedBatchDetails.status}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
