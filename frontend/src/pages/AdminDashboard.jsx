import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../utils/api';
import { SkeletonBanner, SkeletonStatGrid, SkeletonCard } from '../components/Skeleton';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, 
  Search, Filter, RefreshCw, Eye, ThumbsUp, ThumbsDown, 
  HelpCircle, Milk, User, Truck, DollarSign, Award, 
  ChevronRight, Calendar, ArrowUpRight, Flame, Image as ImageIcon, X, Loader2 
} from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [dashboardData, setDashboardData] = useState(null);
  const [batches, setBatches] = useState([]);
  const [rejectedQueue, setRejectedQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('batches'); // 'batches', 'rejections', 'quality'

  // Pagination States
  const [batchPage, setBatchPage] = useState(1);
  const [rejectionPage, setRejectionPage] = useState(1);
  const [qualityPage, setQualityPage] = useState(1);
  const PAGE_SIZE = 6;

  // Selected Batch for Audit / Details Modal
  const [selectedBatch, setSelectedBatch] = useState(null);

  // Review Modal State
  const [reviewBatch, setReviewBatch] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('Approved');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchAdminData = async () => {
    try {
      const data = await apiFetch('/api/admin/dashboard');
      if (data && data.success) {
        setDashboardData(data);
        setBatches(data.batches || []);
        setRejectedQueue(data.rejectedQueue || []);
      }
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Filtered Batches List
  const filteredBatches = batches.filter(batch => {
    const matchesStatus = statusFilter === 'All' || batch.status?.toLowerCase() === statusFilter.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      (batch.batchId && batch.batchId.toLowerCase().includes(q)) ||
      (batch.farmerName && batch.farmerName.toLowerCase().includes(q)) ||
      (batch.farmName && batch.farmName.toLowerCase().includes(q)) ||
      (batch.agentName && batch.agentName.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  // Handle Admin Review Submission
  const handleReviewSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!reviewBatch || submittingReview) return;

    setSubmittingReview(true);

    try {
      const data = await apiFetch('/api/admin/review-rejection', {
        method: 'POST',
        body: JSON.stringify({
          batchId: reviewBatch.batchId,
          decision: reviewDecision,
          adminRemarks: reviewRemarks,
          adminName: user?.name || 'Admin Officer'
        })
      });

      if (data && data.success) {
        showToast(data.message || `Decision saved: ${reviewDecision}`, 'success');
        setReviewBatch(null);
        setReviewRemarks('');
        fetchAdminData();
      } else {
        showToast(data?.message || 'Failed to submit review.', 'error');
      }
    } catch (err) {
      showToast('Server error processing review.', 'error');
    } finally {
      setSubmittingReview(false);
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

  const stats = dashboardData?.stats || {
    totalBatches: batches.length,
    acceptedBatches: batches.filter(b => b.status === 'Accepted' || b.status === 'Delivered').length,
    rejectedBatches: batches.filter(b => b.status === 'Rejected').length,
    inTransitBatches: batches.filter(b => b.status === 'In Transit').length,
    deliveredBatches: batches.filter(b => b.status === 'Delivered').length,
    collectedBatches: batches.filter(b => b.status === 'Collected').length,
    totalLitersCollected: batches.reduce((acc, c) => acc + (c.liters || 0), 0)
  };

  // Paginated Slices
  const paginatedBatches = filteredBatches.slice((batchPage - 1) * PAGE_SIZE, batchPage * PAGE_SIZE);
  const paginatedRejections = rejectedQueue.slice((rejectionPage - 1) * PAGE_SIZE, rejectionPage * PAGE_SIZE);
  const qualityList = batches.filter(b => b.qualityTest);
  const paginatedQuality = qualityList.slice((qualityPage - 1) * PAGE_SIZE, qualityPage * PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      
      {/* Top Banner & Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 'clamp(1.35rem, 3.5vw, 1.75rem)', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Admin Command & Operations Hub
            </h1>
            <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ShieldCheck size={13} /> Real-Time Traceability
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Monitor Milk Batch IDs, audit quality testing parameters, and review quarantined milk batches.
          </p>
        </div>

        <button
          onClick={() => { fetchAdminData(); showToast('Dashboard data refreshed.', 'info'); }}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem' }}
        >
          <RefreshCw size={16} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Metric Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1rem'
      }}>
        {/* Metric 1 */}
        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Liters</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-emerald-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-emerald)' }}>
              <Milk size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.5rem' }}>
            {stats.totalLitersCollected?.toLocaleString('en-IN') || 0} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>L</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', marginTop: '4px', fontWeight: 600 }}>
            Across {stats.totalBatches} total collection batches
          </div>
        </div>

        {/* Metric 2 */}
        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Accepted Batches</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '0.5rem' }}>
            {stats.acceptedBatches || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            In Transit: {stats.inTransitBatches || 0} • Delivered: {stats.deliveredBatches || 0}
          </div>
        </div>

        {/* Metric 3 */}
        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quarantined Batches</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-rose-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-rose)' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stats.rejectedBatches > 0 ? 'var(--accent-rose)' : 'var(--text-main)', marginTop: '0.5rem' }}>
            {stats.rejectedBatches || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: stats.rejectedBatches > 0 ? 'var(--accent-rose)' : 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
            {rejectedQueue.length} pending administrative reviews
          </div>
        </div>

        {/* Metric 4 */}
        <div className="card" style={{ padding: '1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dairy Community</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-amber)' }}>
              <User size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '0.5rem' }}>
            {stats.usersCount?.farmers || 12} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Farmers</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {stats.usersCount?.consumers || 148} Consumers • {stats.usersCount?.agents || 8} Agents
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <div className="card" style={{ padding: '1.25rem' }}>
        
        {/* Navigation Tab Bar */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.75rem',
          marginBottom: '1.25rem',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => { setActiveTab('batches'); setBatchPage(1); }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.85rem',
              background: activeTab === 'batches' ? 'var(--accent-emerald)' : 'transparent',
              color: activeTab === 'batches' ? '#FFFFFF' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              whiteSpace: 'nowrap'
            }}
          >
            <Milk size={16} /> All Batches ({batches.length})
          </button>

          <button
            onClick={() => { setActiveTab('rejections'); setRejectionPage(1); }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.85rem',
              background: activeTab === 'rejections' ? 'var(--accent-rose)' : 'transparent',
              color: activeTab === 'rejections' ? '#FFFFFF' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              whiteSpace: 'nowrap'
            }}
          >
            <AlertTriangle size={16} /> Quarantined Rejections ({rejectedQueue.length})
          </button>

          <button
            onClick={() => { setActiveTab('quality'); setQualityPage(1); }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.85rem',
              background: activeTab === 'quality' ? 'var(--accent-blue)' : 'transparent',
              color: activeTab === 'quality' ? '#FFFFFF' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              whiteSpace: 'nowrap'
            }}
          >
            <ShieldCheck size={16} /> Quality Logs ({qualityList.length})
          </button>
        </div>

        {/* TAB 1: ALL BATCHES */}
        {activeTab === 'batches' && (
          <div>
            {/* Filter & Search Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              marginBottom: '1rem'
            }}>
              <div style={{ position: 'relative', flex: '1 1 240px' }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search by Batch ID, Farmer, Farm Name, Agent..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setBatchPage(1); }}
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={16} color="var(--text-muted)" />
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setBatchPage(1); }}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="All">All Statuses</option>
                  <option value="Collected">Collected</option>
                  <option value="Accepted">Accepted</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            {filteredBatches.length === 0 ? (
              <EmptyState
                title="No matching milk batches"
                description="Try clearing your search query or adjusting the status filter."
              />
            ) : (
              <>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Batch ID</th>
                        <th>Collection Date</th>
                        <th>Farmer & Farm</th>
                        <th>Delivery Agent</th>
                        <th>Volume</th>
                        <th>Quality Status</th>
                        <th>Batch Status</th>
                        <th>Action</th>
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
                          <td>
                            <strong>{batch.farmerName}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{batch.farmName}</div>
                          </td>
                          <td>{batch.agentName || 'Assigned Agent'}</td>
                          <td><strong>{batch.liters} L</strong></td>
                          <td>
                            {batch.qualityTest ? (
                              <span className="badge badge-success">{batch.qualityTest.qualityScore}/100</span>
                            ) : batch.status === 'Rejected' ? (
                              <span className="badge badge-danger">Failed</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Pending</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${batch.status === 'Accepted' || batch.status === 'Delivered' ? 'badge-success' : batch.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                              {batch.status}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => setSelectedBatch(batch)}
                              className="btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={13} /> Audit
                            </button>
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

        {/* TAB 2: QUARANTINED REJECTIONS */}
        {activeTab === 'rejections' && (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
                Quarantined Milk Batches Requiring Review
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Batches rejected by field agents due to adulteration, high temp, or substandard Fat/SNF metrics.
              </p>
            </div>

            {rejectedQueue.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Zero Quarantined Batches"
                description="All milk collections have met quality standards. No pending rejection appeals."
              />
            ) : (
              <>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Batch ID</th>
                        <th>Farmer</th>
                        <th>Rejection Reason</th>
                        <th>Agent Remarks</th>
                        <th>Quarantine Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRejections.map((batch) => (
                        <tr key={batch.batchId || batch.id}>
                          <td><strong style={{ fontFamily: 'monospace', color: 'var(--accent-rose)' }}>{batch.batchId}</strong></td>
                          <td>
                            <strong>{batch.farmerName}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{batch.liters} Liters</div>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--accent-rose)' }}>
                              {batch.rejection?.reason || 'Failed quality threshold'}
                            </strong>
                          </td>
                          <td style={{ maxWidth: '200px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            "{batch.rejection?.remarks || 'Substandard field test readings'}"
                          </td>
                          <td>
                            <span className={`badge ${batch.rejection?.reviewStatus === 'Approved' ? 'badge-success' : 'badge-danger'}`}>
                              {batch.rejection?.reviewStatus || 'Quarantined'}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => {
                                setReviewBatch(batch);
                                setReviewDecision('Approved');
                                setReviewRemarks('');
                              }}
                              className="btn-primary"
                              style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                            >
                              Review & Resolve
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={rejectionPage}
                  totalItems={rejectedQueue.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setRejectionPage}
                />
              </>
            )}
          </div>
        )}

        {/* TAB 3: QUALITY LOGS */}
        {activeTab === 'quality' && (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Quality Testing Master Registry</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Field inspection parameters (Fat, SNF, Lactometer, Temp) recorded across all delivery agents.
              </p>
            </div>

            {qualityList.length === 0 ? (
              <EmptyState
                title="No quality test logs recorded"
                description="Quality inspection metrics will appear here as field agents test batches."
              />
            ) : (
              <>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Batch ID</th>
                        <th>Farmer</th>
                        <th>Fat %</th>
                        <th>SNF %</th>
                        <th>Lactometer</th>
                        <th>Temp</th>
                        <th>Score</th>
                        <th>Tested By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedQuality.map((b) => (
                        <tr key={b.batchId || b.id}>
                          <td><strong style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)' }}>{b.batchId}</strong></td>
                          <td>{b.farmerName}</td>
                          <td><strong style={{ color: 'var(--accent-blue)' }}>{b.qualityTest?.fatPercentage}%</strong></td>
                          <td><strong style={{ color: 'var(--accent-emerald)' }}>{b.qualityTest?.snfPercentage}%</strong></td>
                          <td>{b.qualityTest?.lactometerReading || 30.0}</td>
                          <td>{b.qualityTest?.temperature || 4.0}°C</td>
                          <td><span className="badge badge-success">{b.qualityTest?.qualityScore}/100</span></td>
                          <td>{b.qualityTest?.testedBy || b.agentName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={qualityPage}
                  totalItems={qualityList.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setQualityPage}
                />
              </>
            )}
          </div>
        )}

      </div>

      {/* MODAL: Full Batch Audit Details */}
      {selectedBatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '600px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Milk Batch Audit Dossier</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  ID: <strong style={{ fontFamily: 'monospace', color: 'var(--accent-emerald)' }}>{selectedBatch.batchId}</strong>
                </div>
              </div>
              <button onClick={() => setSelectedBatch(null)} className="btn-secondary" style={{ padding: '4px 8px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              <div>Origin Farm: <strong>{selectedBatch.farmName}</strong> • {selectedBatch.farmerName} ({selectedBatch.farmLocation})</div>
              <div>Collection Date: <strong>{new Date(selectedBatch.collectionDate || Date.now()).toLocaleString()}</strong></div>
              <div>Volume: <strong>{selectedBatch.liters} Liters</strong></div>
              <div>Assigned Logistics Agent: <strong>{selectedBatch.agentName || 'Agent'}</strong></div>
              <div>Status: <span className="badge badge-info">{selectedBatch.status}</span></div>
            </div>

            {selectedBatch.qualityTest && (
              <div style={{ background: 'var(--accent-emerald-light)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '0.5rem' }}>Field Lab Quality Parameters</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center', fontSize: '0.8rem' }}>
                  <div>Fat: <strong>{selectedBatch.qualityTest.fatPercentage}%</strong></div>
                  <div>SNF: <strong>{selectedBatch.qualityTest.snfPercentage}%</strong></div>
                  <div>Lacto: <strong>{selectedBatch.qualityTest.lactometerReading}</strong></div>
                  <div>Temp: <strong>{selectedBatch.qualityTest.temperature}°C</strong></div>
                </div>
              </div>
            )}

            {/* Audit History Timeline */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>Chronological Status Transitions</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(selectedBatch.auditHistory || []).map((log, idx) => (
                  <div key={idx} style={{ padding: '0.65rem 0.85rem', borderRadius: '8px', background: 'var(--bg-primary)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>{log.fromStatus} &rarr; {log.toStatus}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{new Date(log.changedAt).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>By: {log.changedBy}</div>
                    {log.reason && <div style={{ fontStyle: 'italic', marginTop: '2px' }}>Reason: {log.reason}</div>}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSelectedBatch(null)}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '1.25rem' }}
            >
              Close Dossier
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Rejection Administrative Review */}
      {reviewBatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={22} color="var(--accent-rose)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Administrative Rejection Review</h3>
              </div>
              <button onClick={() => setReviewBatch(null)} className="btn-secondary" style={{ padding: '4px 8px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: '0.85rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <div>Batch ID: <strong style={{ fontFamily: 'monospace', color: 'var(--accent-rose)' }}>{reviewBatch.batchId}</strong></div>
              <div>Farmer: <strong>{reviewBatch.farmerName}</strong> ({reviewBatch.liters} Liters)</div>
              <div>Flagged Reason: <strong style={{ color: 'var(--accent-rose)' }}>{reviewBatch.rejection?.reason || 'Adulteration concern'}</strong></div>
              <div style={{ color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>Agent Remarks: "{reviewBatch.rejection?.remarks || 'Substandard metrics'}"</div>
            </div>

            <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Administrative Decision</label>
                <select
                  value={reviewDecision}
                  onChange={(e) => setReviewDecision(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
                >
                  <option value="Approved">Release & Approve (Clear for Distribution & Payout)</option>
                  <option value="Under Review">Secondary Lab Re-Test (Keep in Quarantine)</option>
                  <option value="Confirmed Rejected">Confirm Disposal / Permanent Rejection</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Admin Justification & Notes</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Record justification for decision..."
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-main)', marginTop: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setReviewBatch(null)}
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {submittingReview ? (
                    <>
                      <Loader2 size={16} className="pulse-anim" /> Saving...
                    </>
                  ) : (
                    'Submit Decision'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
