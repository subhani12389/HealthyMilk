import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, 
  Search, Filter, RefreshCw, Eye, ThumbsUp, ThumbsDown, 
  HelpCircle, Milk, User, Truck, DollarSign, Award, 
  ChevronRight, Calendar, ArrowUpRight, Flame, Image as ImageIcon 
} from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();

  const [dashboardData, setDashboardData] = useState(null);
  const [batches, setBatches] = useState([]);
  const [rejectedQueue, setRejectedQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('batches'); // 'batches', 'rejections', 'quality'

  // Selected Batch for Audit / Details Modal
  const [selectedBatch, setSelectedBatch] = useState(null);

  // Review Modal State
  const [reviewBatch, setReviewBatch] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('Approved');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
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
    e.preventDefault();
    if (!reviewBatch) return;

    setSubmittingReview(true);
    setMsg('');
    setErrorMsg('');

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
        setMsg(data.message);
        setReviewBatch(null);
        setReviewRemarks('');
        fetchAdminData();
      } else {
        setErrorMsg(data?.message || 'Failed to submit review.');
      }
    } catch (err) {
      setErrorMsg('Server error processing review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const stats = dashboardData?.stats || {
    totalBatches: batches.length,
    acceptedBatches: batches.filter(b => b.status === 'Accepted' || b.status === 'Delivered').length,
    rejectedBatches: batches.filter(b => b.status === 'Rejected').length,
    inTransitBatches: batches.filter(b => b.status === 'In Transit').length,
    deliveredBatches: batches.filter(b => b.status === 'Delivered').length,
    collectedBatches: batches.filter(b => b.status === 'Collected').length,
    totalLitersCollected: batches.reduce((acc, c) => acc + (c.liters || 0), 0)
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Top Banner & Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Admin Operations Hub
            </h1>
            <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ShieldCheck size={13} /> Full Traceability Active
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            Monitor Milk Batch IDs, audit quality testing parameters, and review quarantined milk batches.
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          className="btn-secondary"
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.1rem' }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Dynamic Alerts */}
      {msg && (
        <div style={{
          background: 'var(--accent-emerald-light)',
          color: 'var(--accent-emerald)',
          padding: '0.9rem 1.25rem',
          borderRadius: '14px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem'
        }}>
          <CheckCircle2 size={20} />
          <span>{msg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{
          background: 'var(--accent-rose-light)',
          color: 'var(--accent-rose)',
          padding: '0.9rem 1.25rem',
          borderRadius: '14px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem'
        }}>
          <AlertTriangle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        {/* Stat 1: Total Batches */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Batches
              </span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {stats.totalBatches}
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-blue-light)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Milk size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.65rem' }}>
            {stats.totalLitersCollected} Liters collected total
          </div>
        </div>

        {/* Stat 2: Accepted & Delivered */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Accepted Batches
              </span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '4px' }}>
                {stats.acceptedBatches}
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.65rem' }}>
            Passed quality inspection
          </div>
        </div>

        {/* Stat 3: Rejected / Quarantined */}
        <div className="card" style={{ padding: '1.25rem', border: stats.rejectedBatches > 0 ? '1px solid var(--accent-rose)' : '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Rejected Batches
              </span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-rose)', marginTop: '4px' }}>
                {stats.rejectedBatches}
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-rose-light)', color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: stats.rejectedBatches > 0 ? 'var(--accent-rose)' : 'var(--text-muted)', marginTop: '0.65rem', fontWeight: 600 }}>
            {stats.rejectedBatches > 0 ? 'Requires admin review' : 'Zero quality violations'}
          </div>
        </div>

        {/* Stat 4: In Transit / Dispatch */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                In Cold-Chain
              </span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '4px' }}>
                {stats.inTransitBatches}
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-amber-light)', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.65rem' }}>
            Active route delivery
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('batches')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'batches' ? 'var(--accent-emerald-light)' : 'transparent',
            color: activeTab === 'batches' ? 'var(--accent-emerald)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Milk size={17} /> All Milk Batches ({batches.length})
        </button>

        <button
          onClick={() => setActiveTab('rejections')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'rejections' ? 'var(--accent-rose-light)' : 'transparent',
            color: activeTab === 'rejections' ? 'var(--accent-rose)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <AlertTriangle size={17} /> Rejected Batches Queue ({rejectedQueue.length})
        </button>

        <button
          onClick={() => setActiveTab('quality')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'quality' ? 'var(--accent-blue-light)' : 'transparent',
            color: activeTab === 'quality' ? 'var(--accent-blue)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Award size={17} /> Quality Test History
        </button>
      </div>

      {/* TAB 1: ALL MILK BATCHES (SEARCH & TRACEABILITY) */}
      {activeTab === 'batches' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search by Batch ID (HM-2026...), Farmer, Farm, or Agent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.75rem 0.75rem 2.4rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem'
                }}
              />
            </div>

            {/* Status Filter Buttons */}
            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '4px' }}>
              {['All', 'Collected', 'Accepted', 'Rejected', 'In Transit', 'Delivered'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: statusFilter === status ? 'var(--accent-emerald)' : 'var(--bg-primary)',
                    color: statusFilter === status ? '#FFF' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Batches Table */}
          {filteredBatches.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Milk size={44} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
              <p style={{ fontWeight: 600 }}>No milk batches found matching criteria.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Batch ID</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Farmer & Location</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Volume</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Quality Test</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Agent</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map(batch => {
                    const isRejected = batch.status === 'Rejected';
                    const isAccepted = batch.status === 'Accepted' || batch.status === 'Delivered';
                    return (
                      <tr key={batch.batchId} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s ease' }}>
                        <td style={{ padding: '1rem' }}>
                          <span style={{ fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                            {batch.batchId}
                          </span>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {new Date(batch.collectionDate).toLocaleDateString()} {new Date(batch.collectionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{batch.farmName || batch.farmerName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{batch.farmLocation || 'Anand Valley'}</div>
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{batch.liters} L</div>
                          {batch.qualityTest?.ratePerLiter && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)' }}>
                              ₹{batch.qualityTest.ratePerLiter}/L (₹{batch.qualityTest.totalPrice})
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '1rem' }}>
                          {batch.qualityTest ? (
                            <div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                Fat: {batch.qualityTest.fatPercentage}% | SNF: {batch.qualityTest.snfPercentage}%
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Lacto: {batch.qualityTest.lactometerReading} | Temp: {batch.qualityTest.temperature || 4.0}°C
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending testing</span>
                          )}
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <span className={`badge ${
                            isRejected ? 'badge-danger' : 
                            isAccepted ? 'badge-success' : 
                            batch.status === 'In Transit' ? 'badge-warning' : 'badge-info'
                          }`}>
                            {batch.status}
                          </span>
                        </td>

                        <td style={{ padding: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {batch.agentName || 'Assigned Agent'}
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <button
                            onClick={() => setSelectedBatch(batch)}
                            className="btn-secondary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <Eye size={14} /> Audit Trail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REJECTED BATCHES REVIEW QUEUE */}
      {activeTab === 'rejections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ background: 'var(--accent-rose-light)', border: '1px solid var(--accent-rose)', borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <AlertTriangle color="var(--accent-rose)" size={24} />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-rose)', margin: 0 }}>
                  Quarantined Milk Batches Requiring Admin Review
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Batches rejected during delivery agent inspection. Normal farmer payouts are blocked until resolved.
                </p>
              </div>
            </div>
          </div>

          {rejectedQueue.length === 0 ? (
            <div className="card" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={44} color="var(--accent-emerald)" style={{ margin: '0 auto 0.75rem' }} />
              <h3 style={{ color: 'var(--text-main)' }}>Rejection Queue Clean!</h3>
              <p style={{ fontSize: '0.85rem' }}>All active milk collections meet purity and safety standards.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {rejectedQueue.map(batch => (
                <div key={batch.batchId} className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-rose)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-rose)', fontFamily: 'monospace' }}>
                        {batch.batchId}
                      </span>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                        {batch.farmName || batch.farmerName} ({batch.liters} Liters)
                      </div>
                    </div>

                    <span className={`badge ${
                      batch.rejection?.reviewStatus === 'Approved' ? 'badge-success' :
                      batch.rejection?.reviewStatus === 'Confirmed Rejected' ? 'badge-danger' : 'badge-warning'
                    }`}>
                      {batch.rejection?.reviewStatus || 'Pending Review'}
                    </span>
                  </div>

                  {/* Rejection Cause Box */}
                  <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-rose)', textTransform: 'uppercase' }}>
                      Rejection Cause
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                      {batch.rejection?.reason || 'Failed quality checks'}
                    </div>
                    {batch.rejection?.remarks && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                        "{batch.rejection.remarks}"
                      </p>
                    )}
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Rejected by: <strong>{batch.rejection?.agentName || batch.agentName}</strong> on {new Date(batch.rejection?.rejectedAt || batch.collectionDate).toLocaleString()}
                    </div>
                  </div>

                  {/* Action Review Button */}
                  <button
                    onClick={() => {
                      setReviewBatch(batch);
                      setReviewDecision('Approved');
                      setReviewRemarks('');
                    }}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.88rem' }}
                  >
                    Review & Resolve Batch <ChevronRight size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: QUALITY TEST HISTORY */}
      {activeTab === 'quality' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
            Laboratory & On-Site Quality Test Registry
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Batch ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Fat %</th>
                  <th style={{ padding: '0.75rem 1rem' }}>SNF %</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Lactometer</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Temperature</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Quality Score</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Quality Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Inspector</th>
                </tr>
              </thead>
              <tbody>
                {batches.filter(b => b.qualityTest).map(batch => {
                  const q = batch.qualityTest;
                  return (
                    <tr key={batch.batchId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.9rem 1rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'monospace' }}>
                        {batch.batchId}
                      </td>
                      <td style={{ padding: '0.9rem 1rem', fontWeight: 700 }}>{q.fatPercentage}%</td>
                      <td style={{ padding: '0.9rem 1rem', fontWeight: 700 }}>{q.snfPercentage}%</td>
                      <td style={{ padding: '0.9rem 1rem', fontWeight: 700 }}>{q.lactometerReading}</td>
                      <td style={{ padding: '0.9rem 1rem', fontWeight: 700 }}>{q.temperature || 4.0}°C</td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <span style={{ fontWeight: 800, color: q.qualityScore >= 80 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                          {q.qualityScore}/100
                        </span>
                      </td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <span className={`badge ${q.qualityStatus === 'Passed' ? 'badge-success' : 'badge-danger'}`}>
                          {q.qualityStatus || 'Passed'}
                        </span>
                      </td>
                      <td style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {q.testedBy || batch.agentName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 1: ADMIN REJECTION REVIEW & RESOLUTION MODAL */}
      {/* ========================================================== */}
      {reviewBatch && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '540px',
            padding: '2rem',
            boxShadow: 'var(--shadow-xl)'
          }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              Review Quarantined Batch
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Audit rejection findings and approve farmer release or confirm quarantine.
            </p>

            <div style={{ background: 'var(--bg-primary)', borderRadius: '14px', padding: '1rem', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'monospace' }}>{reviewBatch.batchId}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{reviewBatch.liters} Liters</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px' }}>
                Farmer: {reviewBatch.farmName || reviewBatch.farmerName}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', marginTop: '4px', fontWeight: 700 }}>
                Reported Reason: {reviewBatch.rejection?.reason}
              </div>
              {reviewBatch.rejection?.remarks && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                  "{reviewBatch.rejection.remarks}"
                </div>
              )}
            </div>

            <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                  Admin Review Action
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {[
                    { id: 'Approved', label: 'Approve & Pay', icon: ThumbsUp, color: 'var(--accent-emerald)' },
                    { id: 'Confirmed Rejected', label: 'Confirm Reject', icon: ThumbsDown, color: 'var(--accent-rose)' },
                    { id: 'Under Review', label: 'Keep in Review', icon: HelpCircle, color: 'var(--accent-amber)' }
                  ].map(action => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => setReviewDecision(action.id)}
                      style={{
                        padding: '0.75rem 0.5rem',
                        borderRadius: '12px',
                        border: reviewDecision === action.id ? `2px solid ${action.color}` : '1px solid var(--border-color)',
                        background: reviewDecision === action.id ? 'var(--bg-card)' : 'var(--bg-primary)',
                        color: 'var(--text-main)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <action.icon size={18} color={action.color} />
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                  Admin Remarks & Audit Note
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain resolution rationale for farmer notifications and official audit records..."
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setReviewBatch(null)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '0.8rem', justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="btn-primary"
                  style={{ flex: 1, padding: '0.8rem', justifyContent: 'center' }}
                >
                  {submittingReview ? 'Processing...' : 'Submit Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 2: BATCH AUDIT TRAIL & TRACEABILITY MODAL */}
      {/* ========================================================== */}
      {selectedBatch && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '580px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2rem',
            boxShadow: 'var(--shadow-xl)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'monospace' }}>
                  {selectedBatch.batchId}
                </span>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Full Traceability & Chronological Status History
                </div>
              </div>
              <span className={`badge ${selectedBatch.status === 'Rejected' ? 'badge-danger' : 'badge-success'}`}>
                {selectedBatch.status}
              </span>
            </div>

            {/* Quality Summary Box */}
            {selectedBatch.qualityTest && (
              <div style={{ background: 'var(--bg-primary)', borderRadius: '14px', padding: '1rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-emerald)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Verified Quality Parameters
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  <div style={{ background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fat</div>
                    <div style={{ fontWeight: 800 }}>{selectedBatch.qualityTest.fatPercentage}%</div>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SNF</div>
                    <div style={{ fontWeight: 800 }}>{selectedBatch.qualityTest.snfPercentage}%</div>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Lacto</div>
                    <div style={{ fontWeight: 800 }}>{selectedBatch.qualityTest.lactometerReading}</div>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Temp</div>
                    <div style={{ fontWeight: 800 }}>{selectedBatch.qualityTest.temperature || 4.0}°C</div>
                  </div>
                </div>
              </div>
            )}

            {/* Audit Trail Timeline */}
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.85rem' }}>
              Audit Trail Events
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {(selectedBatch.auditHistory || []).length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No previous state transitions recorded.</p>
              ) : (
                selectedBatch.auditHistory.map((item, idx) => (
                  <div key={idx} style={{
                    padding: '0.85rem',
                    borderRadius: '12px',
                    background: 'var(--bg-primary)',
                    borderLeft: '3px solid var(--accent-emerald)',
                    fontSize: '0.82rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--text-main)' }}>
                      <span>{item.fromStatus} ➔ {item.toStatus}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(item.changedAt).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '3px' }}>
                      By: <strong>{item.changedBy}</strong> {item.reason ? `• Reason: ${item.reason}` : ''}
                    </div>
                    {item.remarks && (
                      <div style={{ color: 'var(--text-main)', marginTop: '3px', fontStyle: 'italic', fontSize: '0.78rem' }}>
                        "{item.remarks}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setSelectedBatch(null)}
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem', padding: '0.8rem' }}
            >
              Close Traceability View
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
