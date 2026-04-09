import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDateTime, formatRelative } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

function setTopbarTitle(t) {
  const el = document.getElementById('topbar-title-slot');
  if (el) el.textContent = t;
}

export default function TicketDetail() {
  const navigate  = useNavigate();
  const toast     = useToast();
  const { id }    = useParams();
  const bottomRef = useRef(null);

  const [ticket,   setTicket]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [reply,    setReply]    = useState('');
  const [sending,  setSending]  = useState(false);
  const [acting,   setActing]   = useState(false);

  useLayoutEffect(() => { setTopbarTitle('Support Ticket'); }, []);

  const load = () => {
    api.tickets.get(id)
      .then(res => setTicket(res.data))
      .catch(err => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages?.length]);

  async function handleReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.tickets.reply(id, reply.trim());
      setReply('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleResolve() {
    setActing(true);
    try {
      await api.tickets.resolve(id);
      toast('Ticket resolved', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
    finally { setActing(false); }
  }

  async function handleReopen() {
    setActing(true);
    try {
      await api.tickets.reopen(id);
      toast('Ticket reopened', 'info');
      load();
    } catch (err) { toast(err.message, 'error'); }
    finally { setActing(false); }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (!ticket) return <div className="empty-state"><div className="empty-text">Ticket not found</div></div>;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="breadcrumb">
        <a href="#" onClick={e => { e.preventDefault(); navigate('/tickets'); }}>Support Tickets</a>
        <span className="breadcrumb-sep">›</span>
        <span>{ticket.subject}</span>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ marginBottom: 0 }}>{ticket.subject}</h1>
            <Badge status={ticket.status} />
          </div>
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            {ticket.user?.username || ticket.user?.email} · opened {formatDateTime(ticket.createdAt)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {ticket.user && (
            <Button variant="secondary" size="sm" onClick={() => navigate(`/users/${ticket.user.id}`)}>
              View User
            </Button>
          )}
          {ticket.event && (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/users/${ticket.user?.id}`)}>
              View Invite
            </Button>
          )}
          {ticket.status === 'open'
            ? <Button variant="success" size="sm" loading={acting} onClick={handleResolve}>Mark Resolved</Button>
            : <Button variant="secondary" size="sm" loading={acting} onClick={handleReopen}>Reopen</Button>
          }
        </div>
      </div>

      {/* Thread */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">Conversation</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{ticket.messages?.length || 0} messages</span>
        </div>
        <div style={{ padding: '0 24px', maxHeight: 480, overflowY: 'auto' }}>
          {ticket.messages?.length === 0 ? (
            <div className="empty-state"><div className="empty-text">No messages yet</div></div>
          ) : (
            ticket.messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Reply box */}
        {ticket.status === 'open' && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 24 }}>
            <form onSubmit={handleReply}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Type your reply…"
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  disabled={sending}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Button variant="primary" type="submit" loading={sending} disabled={!reply.trim()}>
                  Send Reply
                </Button>
              </div>
            </form>
          </div>
        )}
        {ticket.status === 'resolved' && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="alert alert-success" style={{ marginBottom: 0 }}>
              <span>✓</span>
              <span>This ticket is resolved. <button style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }} onClick={handleReopen}>Reopen</button> to send more replies.</span>
            </div>
          </div>
        )}
      </div>

      {/* Context panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">User</span></div>
          <div className="card-body">
            <table className="kv-table">
              <tbody>
                <tr><td>Username</td><td>{ticket.user?.username || '—'}</td></tr>
                <tr><td>Email</td><td>{ticket.user?.email}</td></tr>
                <tr><td>Phone</td><td>{ticket.user?.phone || '—'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        {ticket.event && (
          <div className="card">
            <div className="card-header"><span className="card-title">Invitation</span></div>
            <div className="card-body">
              <table className="kv-table">
                <tbody>
                  <tr><td>Couple</td><td>{[ticket.event.brideName, ticket.event.groomName].filter(Boolean).join(' & ') || '—'}</td></tr>
                  <tr><td>Slug</td><td><span className="mono">/{ticket.event.slug}</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isAdmin = msg.senderRole === 'admin';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isAdmin ? 'flex-end' : 'flex-start',
      margin: '16px 0',
    }}>
      <div style={{
        maxWidth: '72%',
        background: isAdmin ? 'rgba(201,168,76,0.12)' : 'var(--bg-elevated)',
        border: `1px solid ${isAdmin ? 'rgba(201,168,76,0.3)' : 'var(--border-subtle)'}`,
        borderRadius: isAdmin ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        padding: '12px 16px',
      }}>
        <div style={{
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: isAdmin ? 'var(--gold)' : 'var(--text-muted)',
          marginBottom: 6,
        }}>
          {isAdmin ? 'Admin' : 'User'} · {formatDateTime(msg.createdAt)}
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {msg.body}
        </p>
      </div>
    </div>
  );
}
