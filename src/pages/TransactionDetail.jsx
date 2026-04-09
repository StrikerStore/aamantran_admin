import { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

function setTopbarTitle(t) {
  const el = document.getElementById('topbar-title-slot');
  if (el) el.textContent = t;
}

export default function TransactionDetail() {
  const navigate = useNavigate();
  const toast    = useToast();
  const { id }   = useParams();

  const [tx,       setTx]       = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [confirm,  setConfirm]  = useState(false);
  const [refunding, setRefunding] = useState(false);

  useLayoutEffect(() => { setTopbarTitle('Transaction Detail'); }, []);

  useEffect(() => {
    api.transactions.get(id)
      .then(res => setTx(res.data))
      .catch(err => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line

  async function handleRefund() {
    setRefunding(true);
    try {
      await api.transactions.refund(id);
      toast('Refund initiated', 'success');
      setConfirm(false);
      // Reload
      const res = await api.transactions.get(id);
      setTx(res.data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRefunding(false);
    }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (!tx)     return <div className="empty-state"><div className="empty-text">Transaction not found</div></div>;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="breadcrumb">
        <a href="#" onClick={e => { e.preventDefault(); navigate('/transactions'); }}>Transactions</a>
        <span className="breadcrumb-sep">›</span>
        <span className="mono">{id.slice(0, 8)}…</span>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{formatCurrency(tx.amount)}</h1>
          <p className="page-subtitle">{formatDateTime(tx.createdAt)}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tx.user && (
            <Button variant="secondary" onClick={() => navigate(`/users/${tx.user.id}`)}>
              View User
            </Button>
          )}
          {tx.status === 'paid' && (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Issue Refund
            </Button>
          )}
        </div>
      </div>

      <div className="detail-layout">
        {/* Left — main details */}
        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header"><span className="card-title">Transaction Details</span></div>
            <div className="card-body">
              <table className="kv-table">
                <tbody>
                  <tr><td>Status</td><td><Badge status={tx.status} /></td></tr>
                  <tr><td>Amount</td><td className="td-primary">{formatCurrency(tx.amount)}</td></tr>
                  <tr><td>Currency</td><td>{tx.currency}</td></tr>
                  <tr><td>Template</td><td>{tx.template?.name || '—'}</td></tr>
                  <tr><td>Date</td><td>{formatDateTime(tx.createdAt)}</td></tr>
                  <tr><td>Razorpay Order ID</td><td><span className="mono">{tx.razorpayOrderId || '—'}</span></td></tr>
                  <tr><td>Razorpay Payment ID</td><td><span className="mono">{tx.razorpayPaymentId || '—'}</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Razorpay live data */}
          {tx.razorpayData && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header"><span className="card-title">Razorpay Data</span></div>
              <div className="card-body">
                {tx.razorpayData.error
                  ? <div className="alert alert-warning"><span>⚠</span>{tx.razorpayData.error}</div>
                  : <div className="json-viewer">{JSON.stringify(tx.razorpayData, null, 2)}</div>
                }
              </div>
            </div>
          )}
        </div>

        {/* Right — user & event */}
        <div>
          {tx.user && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><span className="card-title">User</span></div>
              <div className="card-body">
                <table className="kv-table">
                  <tbody>
                    <tr><td>Username</td><td>{tx.user.username || '—'}</td></tr>
                    <tr><td>Email</td><td>{tx.user.email}</td></tr>
                    <tr><td>Phone</td><td>{tx.user.phone || '—'}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tx.event && (
            <div className="card">
              <div className="card-header"><span className="card-title">Invitation</span></div>
              <div className="card-body">
                <table className="kv-table">
                  <tbody>
                    <tr><td>Couple</td><td>{[tx.event.brideName, tx.event.groomName].filter(Boolean).join(' & ') || '—'}</td></tr>
                    <tr><td>Slug</td><td><span className="mono">/{tx.event.slug}</span></td></tr>
                    <tr><td>Published</td><td><Badge status={tx.event.isPublished ? 'active' : 'draft'} /></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          title="Issue Refund"
          message={`Refund ${formatCurrency(tx.amount)} for this transaction? This action cannot be undone.`}
          confirmText="Issue Refund"
          icon="💸"
          onConfirm={handleRefund}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
