import { useCallback, useEffect, useRef, useState } from 'react';
import FileUpload from '../components/FileUpload.jsx';
import StatsCards from '../components/StatsCards.jsx';
import Filters from '../components/Filters.jsx';
import TransactionTable from '../components/TransactionTable.jsx';
import RunHistory from '../components/RunHistory.jsx';
import AuditLog from '../components/AuditLog.jsx';
import JobStatus from '../components/JobStatus.jsx';
import {
  clearAll, getJob, getStats, getTransactions, runReconcile,
  linkTransactions, unlinkTransactions,
} from '../services/api.js';

const POLL_MS = 800;

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ status: '', source: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [toast, setToast] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);
  const pollAbort = useRef(false);

  const showToast = (message, kind = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([getStats(), getTransactions(filters)]);
      setStats(s.data.stats);
      setRows(t.data.rows);
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    }
  }, [filters]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { setSelectedIds([]); }, [filters]); // selection doesn't survive filter changes

  const pollJob = useCallback(async (jobId) => {
    pollAbort.current = false;
    while (!pollAbort.current) {
      try {
        const { data } = await getJob(jobId);
        setActiveJob(data.job);
        if (['succeeded', 'failed', 'dead'].includes(data.job.status)) {
          return data.job;
        }
      } catch (err) {
        showToast(`Job poll failed: ${err.message}`, 'error');
        return null;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    return null;
  }, []);

  const onReconcile = async () => {
    try {
      const { data } = await runReconcile();
      showToast(`Job enqueued: ${data.jobId.slice(0, 8)}…`);
      const final = await pollJob(data.jobId);
      if (final?.status === 'succeeded') {
        const r = final.result || {};
        showToast(`Reconciled ${r.total ?? '?'}: ${r.matched ?? 0} matched, ${r.mismatch ?? 0} mismatch, ${r.unmatched ?? 0} unmatched`);
      } else if (final?.status === 'failed') {
        showToast(`Job failed (will retry): ${final.last_error}`, 'error');
      } else if (final?.status === 'dead') {
        showToast(`Job exhausted retries: ${final.last_error}`, 'error');
      }
      await refresh();
      setHistoryKey((k) => k + 1);
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setActiveJob(null);
    }
  };

  const onClear = async () => {
    if (!window.confirm('Delete ALL transactions? (Audit log and run history are preserved.)')) return;
    try {
      await clearAll();
      showToast('All transactions cleared');
      setSelectedIds([]);
      await refresh();
      setHistoryKey((k) => k + 1);
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const onLink = async () => {
    if (selectedIds.length < 2) return;
    const note = window.prompt(
      `Link ${selectedIds.length} unmatched transactions as one match group?\n\nOptional note (e.g. "REF1009 ↔ REF2007 same logical txn"):`,
      ''
    );
    if (note === null) return; // user cancelled
    try {
      const { data } = await linkTransactions(selectedIds, note);
      showToast(`Linked ${data.linkedCount} rows → match group ${data.matchGroupId.slice(0, 8)}…`);
      setSelectedIds([]);
      await refresh();
      setHistoryKey((k) => k + 1);
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    }
  };

  const onUnlink = async (matchGroupId) => {
    if (!window.confirm('Break this manual link? Affected rows return to unmatched.')) return;
    try {
      const { data } = await unlinkTransactions(matchGroupId);
      showToast(`Unlinked ${data.unlinkedCount} rows`);
      await refresh();
      setHistoryKey((k) => k + 1);
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Financial Reconciliation</h1>
          <div className="sub">Bank ⇄ Payment Gateway ⇄ Internal Ledger · enterprise edition</div>
        </div>
      </header>

      <FileUpload
        onUploaded={(summary) => {
          showToast(`Uploaded: ${Object.entries(summary).map(([s, v]) => `${s}=${v.inserted}`).join(', ')}`);
          refresh();
          setHistoryKey((k) => k + 1);
        }}
        onError={(msg) => showToast(msg, 'error')}
      />

      <div className="panel">
        <h2>2 · Run reconciliation</h2>
        <div className="row">
          <button className="btn" onClick={onReconcile} disabled={!!activeJob}>
            {activeJob ? 'Reconciling…' : 'Run reconciliation'}
          </button>
          <button className="btn danger" onClick={onClear}>Clear all data</button>
          {activeJob && <JobStatus job={activeJob} />}
        </div>
      </div>

      <div className="panel">
        <h2>3 · Overview</h2>
        <StatsCards stats={stats} />
      </div>

      <div className="panel">
        <h2>4 · Transactions</h2>
        <Filters status={filters.status} source={filters.source} onChange={setFilters} />
        {selectedIds.length >= 2 && (
          <div className="link-bar">
            <strong>{selectedIds.length} unmatched rows selected</strong>
            <button className="btn" onClick={onLink}>
              Link as one transaction
            </button>
            <button className="btn ghost" onClick={() => setSelectedIds([])}>
              Clear selection
            </button>
          </div>
        )}
        {selectedIds.length === 1 && (
          <div className="link-bar muted">
            Pick at least one more unmatched row to link them together.
            <button className="btn ghost" onClick={() => setSelectedIds([])}>Clear</button>
          </div>
        )}
        <TransactionTable
          rows={rows}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onUnlink={onUnlink}
        />
      </div>

      <div className="panel">
        <h2>5 · Reconciliation reports</h2>
        <RunHistory refreshKey={historyKey} />
      </div>

      <div className="panel">
        <h2>6 · Audit log</h2>
        <AuditLog refreshKey={historyKey} />
      </div>

      {toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}
    </div>
  );
}
