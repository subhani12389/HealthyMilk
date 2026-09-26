import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../utils/api';
import { SkeletonBanner, SkeletonStatGrid, SkeletonCard } from '../components/Skeleton';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { 
  Truck, MapPin, CheckCircle2, Clock, Milk, User, 
  RefreshCw, AlertCircle, ShieldCheck, DollarSign, Calculator,
  Wallet, ArrowUpRight, Search, Settings, AlertTriangle, 
  Camera, Image as ImageIcon, X, Thermometer, Award, Loader2 
} from 'lucide-react';

export default function DeliveryDashboard() {
  const { user, activeTab, updateUserBalance } = useAuth();
  const { showToast } = useToast();

  const [dashboardData, setDashboardData] = useState(null);
  const [agentProfile, setAgentProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination States
  const [pickupPage, setPickupPage] = useState(1);
  const [batchPage, setBatchPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const PAGE_SIZE = 6;

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
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState('');

  const fetchAgentDashboard = async () => {
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
    if (e) e.preventDefault();
    if (!activePickup || submittingTest) return;

    setSubmittingTest(true);

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
        showToast(`Batch ${activePickup.batchId} accepted & ₹${data.creditedAmount || 0} credited to farmer!`, 'success');
        setActivePickup(null);
        if (data.updatedAgentBalance !== undefined) {
          updateUserBalance(data.updatedAgentBalance);
        }
        fetchAgentDashboard();
      } else {
        showToast(data?.message || 'Quality verification failed.', 'error');
      }
    } catch (err) {
      showToast('Server error processing quality verification.', 'error');
    } finally {
      setSubmittingTest(false);
    }
  };

  // Reject Batch Handler
  const handleRejectBatch = async (e) => {
    if (e) e.preventDefault();
    if (!rejectingPickup || submittingRejection) return;

    setSubmittingRejection(true);

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
        showToast(`Batch ${rejectingPickup.batchId} rejected & flagged for admin review.`, 'warning');
        setRejectingPickup(null);
        setRejectionRemarks('');
        setEvidencePhoto('');
        fetchAgentDashboard();
      } else {
        showToast(data?.message || 'Batch rejection failed.', 'error');
      }
    } catch (err) {
      showToast('Server error processing batch rejection.', 'error');
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

  // Payout Request Handler
  const handlePayoutRequest = async (e) => {
    if (e) e.preventDefault();
    if (submittingPayout) return;

    setSubmittingPayout(true);
    setPayoutMsg('');

    try {
      const data = await apiFetch('/api/delivery/payout', {
        method: 'POST',
        body: JSON.stringify({
          agentId: user?.id,
          amount: Number(payoutAmount)
        })
      });

      if (data && data.success) {
        setPayoutMsg(data.message);
        showToast('Commission withdrawal processed successfully!', 'success');
        if (data.remainingBalance !== undefined) {
          updateUserBalance(data.remainingBalance);
        }
        setTimeout(() => {
          setShowPayoutModal(false);
          setPayoutAmount('');
          setPayoutMsg('');
          fetchAgentDashboard();
        }, 1000);
      } else {
        const err = data?.message || 'Payout failed.';
        setPayoutMsg(err);
        showToast(err, 'error');
      }
    } catch (err) {
      showToast('Error requesting payout.', 'error');
    } finally {
      setSubmittingPayout(false);
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

  const assignedPickups = dashboardData?.assignedPickups || [];
  const assignedDeliveries = dashboardData?.assignedDeliveries || [];
  const agentBal = agentProfile?.balance !== undefined ? agentProfile.balance : (user?.balance || 0);

  // Paginated Slices
  const paginatedPickups = assignedPickups.slice((pickupPage - 1) * PAGE_SIZE, pickupPage * PAGE_SIZE);
  const paginatedBatches = batches.slice((batchPage - 1) * PAGE_SIZE, batchPage * PAGE_SIZE);
  const paginatedTx = transactions.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
        border: '1px solid var(--accent-amber)',
        borderRadius: '20px',
        padding: 'clamp(1rem, 2.5vw, 1.5rem)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ minWidth: '220px', flex: '1 1 240px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-amber)', textTransform: 'uppercase' }}>
            🚚 Logistics & Field Testing Agent
          </div>
          <h2 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.5rem)', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {agentProfile?.name || user?.name || 'Delivery Partner'}
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Vehicle: {agentProfile?.vehicleNo || 'GJ-07-MK-4421'} • Route: {agentProfile?.assignedArea || 'Sector 14 & Green Valley'}
          </p>
        </div>
        <div style={{ textAlign: 'left', minWidth: '160px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Commission Balance</div>
          <div style={{ fontSize: 'clamp(1.35rem, 4vw, 1.6rem)', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '2px' }}>
            ₹{Number(agentBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Quick Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Pickups</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {assignedPickups.length}
          </div>
        </div>
        <div className="card" style={{ padding: '1.1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Doorstep Deliveries</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '4px' }}>
            {assignedDeliveries.length}
          </div>
        </div>
        <div className="card" style={{ padding: '1.1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Tested Batches</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '4px' }}>
            {batches.length}
          </div>
        </div>
      </div>

      {/* TAB 1: PICKUPS & DELIVERIES */}
      {(!activeTab || activeTab === 'status' || activeTab === 'pickups') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Pending Farmer Collections Section */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Pending Milk Pickup Collections</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Inspect quality, test Fat/SNF %, and credit farmer payout</p>
              </div>
              <button onClick={fetchAgentDashboard} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {assignedPickups.length === 0 ? (
              <EmptyState
                title="No pending pickups"
                description="All farmer milk collections have been completed."
              />
            ) : (
              <>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Batch ID</th>
                        <th>Farmer / Dairy</th>
                        <th>Volume</th>
                        <th>Collection Time</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPickups.map((pickup) => (
                        <tr key={pickup.id || pickup.batchId}>
                          <td><strong style={{ fontFamily: 'monospace', color: 'var(--accent-amber)' }}>{pickup.batchId}</strong></td>
                          <td>
                            <strong>{pickup.farmerName}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pickup.farmName} • {pickup.farmLocation}</div>
                          </td>
                          <td><strong>{pickup.liters} Liters</strong></td>
                          <td>{new Date(pickup.collectionDate || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <span className={`badge ${pickup.status === 'Accepted' ? 'badge-success' : pickup.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                              {pickup.status}
                            </span>
                          </td>
                          <td>
                            {pickup.status === 'Collected' || pickup.status === 'Quality Checked' ? (
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  onClick={() => {
                                    setActivePickup(pickup);
                                    setTestedFat('4.5');
                                    setTestedSNF('8.8');
                                    setLactometer('29.5');
                                  }}
                                  className="btn-primary"
                                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                >
                                  <ShieldCheck size={14} /> Test & Accept
                                </button>
                                <button
                                  onClick={() => setRejectingPickup(pickup)}
                                  className="btn-secondary"
                                  style={{ padding: '6px 10px', fontSize: '0.8rem', color: 'var(--accent-rose)', borderColor: 'var(--accent-rose)' }}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Completed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={pickupPage}
                  totalItems={assignedPickups.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPickupPage}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BATCH HISTORY */}
      {activeTab === 'batches' && (
        <div className="card">
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>All Collected & Tested Batches</h3>
          {batches.length === 0 ? (
            <EmptyState
              title="No batches recorded yet"
              description="Tested batches will appear here in chronological order."
            />
          ) : (
            <>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Batch ID</th>
                      <th>Date</th>
                      <th>Farmer</th>
                      <th>Volume</th>
                      <th>Quality Score</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBatches.map((b) => (
                      <tr key={b.batchId || b.id}>
                        <td><strong style={{ fontFamily: 'monospace', color: 'var(--accent-amber)' }}>{b.batchId}</strong></td>
                        <td>{new Date(b.collectionDate || Date.now()).toLocaleDateString()}</td>
                        <td>{b.farmerName}</td>
                        <td><strong>{b.liters} L</strong></td>
                        <td>
                          {b.qualityTest ? (
                            <span className="badge badge-success">{b.qualityTest.qualityScore}/100</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${b.status === 'Accepted' || b.status === 'Delivered' ? 'badge-success' : b.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={batchPage}
                totalItems={batches.length}
                pageSize={PAGE_SIZE}
                onPageChange={setBatchPage}
              />
            </>
          )}
        </div>
      )}

      {/* TAB 3: COMMISSION WALLET */}
      {activeTab === 'wallet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="grid-responsive-2">
            <div className="card">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Available Commission</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-amber)', margin: '0.4rem 0 1rem' }}>
                ₹{Number(agentBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <button
                onClick={() => setShowPayoutModal(true)}
                disabled={agentBal <= 0}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <ArrowUpRight size={18} /> Withdraw Commission
              </button>
            </div>

            <div className="card">
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>Vehicle & Area Assignment</h4>
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div>Vehicle: <strong>{agentProfile?.vehicleNo || 'GJ-07-MK-4421'}</strong></div>
                <div>Assigned Route: <strong>{agentProfile?.assignedArea || 'Sector 14 & Green Valley'}</strong></div>
                <div>Commission Rate: <strong>₹2.50 per Liter collected & delivered</strong></div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Commission History</h3>
            {transactions.length === 0 ? (
              <EmptyState
                title="No commission records yet"
                description="Earnings from verified collections will appear here."
              />
            ) : (
              <>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTx.map((tx, i) => (
                        <tr key={i}>
                          <td>{new Date(tx.timestamp || Date.now()).toLocaleDateString()}</td>
                          <td>{tx.description}</td>
                          <td><strong style={{ color: 'var(--accent-emerald)' }}>+₹{tx.amount}</strong></td>
                          <td><span className="badge badge-success">Credited</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={txPage}
                  totalItems={transactions.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setTxPage}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Quality Testing & Field Acceptance */}
      {activePickup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '540px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={22} color="var(--accent-emerald)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Field Quality Inspection</h3>
              </div>
              <button onClick={() => setActivePickup(null)} className="btn-secondary" style={{ padding: '4px 8px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: '0.85rem', borderRadius: '12px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <div>Batch ID: <strong style={{ fontFamily: 'monospace', color: 'var(--accent-amber)' }}>{activePickup.batchId}</strong></div>
              <div>Farmer: <strong>{activePickup.farmerName}</strong> ({activePickup.farmName})</div>
              <div>Quantity: <strong>{activePickup.liters} Liters</strong></div>
            </div>

            <form onSubmit={handleTestAndCollect} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
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
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
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
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
                  />
                </div>
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
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Chilled Temp (°C)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="-2.0"
                    max="45.0"
                    required
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Live Rate Preview */}
              <div style={{ background: 'var(--accent-emerald-light)', padding: '0.85rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>CALCULATED RATE</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>₹{calculatedRate}/L</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>FARMER PAYOUT</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>₹{calculatedTotal}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActivePickup(null)}
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTest}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {submittingTest ? (
                    <>
                      <Loader2 size={16} className="pulse-anim" /> Processing...
                    </>
                  ) : (
                    'Accept & Credit Payout'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Rejection Quarantine */}
      {rejectingPickup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={22} color="var(--accent-rose)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-rose)' }}>Reject Milk Batch</h3>
              </div>
              <button onClick={() => setRejectingPickup(null)} className="btn-secondary" style={{ padding: '4px 8px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRejectBatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Rejection Reason (Enum Standard)</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
                >
                  <option value="Low quality reading">Low quality reading</option>
                  <option value="Abnormal Fat/SNF">Abnormal Fat/SNF</option>
                  <option value="Abnormal Lactometer Reading">Abnormal Lactometer Reading</option>
                  <option value="Temperature issue">Temperature issue</option>
                  <option value="Contamination concern">Contamination concern</option>
                  <option value="Damaged/unsafe batch">Damaged/unsafe batch</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Agent Remarks / Test Details</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this batch failed inspection..."
                  value={rejectionRemarks}
                  onChange={(e) => setRejectionRemarks(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setRejectingPickup(null)}
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRejection}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center', background: 'var(--accent-rose)', borderColor: 'var(--accent-rose)' }}
                >
                  {submittingRejection ? 'Quarantining...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Agent Commission Payout */}
      {showPayoutModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Withdraw Commission</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Available Balance: <strong>₹{agentBal}</strong>
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
                  min="50"
                  max={agentBal}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder={`Max ₹${agentBal}`}
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
                  disabled={submittingPayout || Number(payoutAmount) <= 0 || Number(payoutAmount) > agentBal}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {submittingPayout ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
