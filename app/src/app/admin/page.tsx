'use client';

import { useState, useEffect, useCallback } from 'react';

interface Domain {
  id: string;
  name: string;
  tld: string;
  price: number;
  logo_url: string | null;
  status: string;
  description: string | null;
  created_at: string;
}

interface Order {
  id: string;
  domain_id: string;
  buyer_email: string;
  buyer_name: string | null;
  amount: number;
  status: string;
  transfer_instructions: string | null;
  created_at: string;
  domains: Domain;
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<'domains' | 'orders' | 'add' | 'import'>('domains');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Add domain form
  const [newName, setNewName] = useState('');
  const [newTld, setNewTld] = useState('.com');
  const [newPrice, setNewPrice] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Import
  const [importText, setImportText] = useState('');

  // Transfer modal
  const [transferOrder, setTransferOrder] = useState<Order | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [transferInstructions, setTransferInstructions] = useState('');

  const headers = { Authorization: `Bearer ${password}`, 'Content-Type': 'application/json' };

  const fetchDomains = useCallback(async () => {
    const res = await fetch('/api/admin/domains', { headers: { Authorization: `Bearer ${password}` } });
    if (res.ok) setDomains(await res.json());
  }, [password]);

  const fetchOrders = useCallback(async () => {
    const res = await fetch('/api/admin/orders', { headers: { Authorization: `Bearer ${password}` } });
    if (res.ok) setOrders(await res.json());
  }, [password]);

  useEffect(() => {
    if (authed) {
      fetchDomains();
      fetchOrders();

      // Realtime subscription for live admin updates
      const wsUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', 'wss://') +
        '/realtime/v1/websocket?apikey=' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY + '&vsn=1.0.0';

      let ws: WebSocket;
      let hb: ReturnType<typeof setInterval>;

      function connect() {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws.send(JSON.stringify({
            topic: 'realtime:public:domains',
            event: 'phx_join',
            payload: { config: { postgres_changes: [{ event: '*', schema: 'public', table: 'domains' }] } },
            ref: '1',
          }));
          ws.send(JSON.stringify({
            topic: 'realtime:public:orders',
            event: 'phx_join',
            payload: { config: { postgres_changes: [{ event: '*', schema: 'public', table: 'orders' }] } },
            ref: '2',
          }));
          hb = setInterval(() => {
            ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: 'hb' }));
          }, 30000);
        };
        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (data.event === 'postgres_changes') {
              fetchDomains();
              fetchOrders();
            }
          } catch {}
        };
        ws.onclose = () => { clearInterval(hb); setTimeout(connect, 3000); };
        ws.onerror = () => ws.close();
      }
      connect();

      return () => { clearInterval(hb); ws?.close(); };
    }
  }, [authed, fetchDomains, fetchOrders]);

  const login = async () => {
    const res = await fetch('/api/admin/domains', { headers: { Authorization: `Bearer ${password}` } });
    if (res.ok) {
      setAuthed(true);
    } else {
      setMsg('Wrong password');
    }
  };

  const addDomain = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/domains', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: newName, tld: newTld, price: parseFloat(newPrice), description: newDesc }),
    });
    if (res.ok) {
      setNewName(''); setNewPrice(''); setNewDesc('');
      setMsg('Domain added!');
      fetchDomains();
    } else {
      setMsg('Error adding domain');
    }
    setLoading(false);
  };

  const importDomains = async () => {
    setLoading(true);
    const lines = importText.trim().split('\n').filter(Boolean);
    const domainList = lines.map(line => {
      const parts = line.split(',').map(s => s.trim());
      return {
        name: parts[0],
        price: parseFloat(parts[1]) || 0,
        description: parts[2] || '',
      };
    });

    setMsg(`Uploading ${domainList.length} domains — deduplicating, pricing & generating logos...`);

    const res = await fetch('/api/admin/import', {
      method: 'POST',
      headers,
      body: JSON.stringify({ domains: domainList }),
    });

    if (res.ok) {
      const data = await res.json();
      const parts = [];
      parts.push(`Imported ${data.imported} domains`);
      if (data.duplicates > 0) parts.push(`${data.duplicates} duplicates skipped`);
      if (data.priced > 0) parts.push(`${data.priced} AI-priced`);
      parts.push(`${data.logos} logos generated`);
      setMsg(parts.join(' · '));
      setImportText('');
      fetchDomains();
    } else {
      const err = await res.json().catch(() => null);
      setMsg('Import failed' + (err?.error ? ': ' + err.error : ''));
    }
    setLoading(false);
  };

  const repriceDomain = async (domain: Domain) => {
    setLoading(true);
    setMsg(`AI pricing ${domain.name}${domain.tld}...`);
    const res = await fetch('/api/admin/reprice', {
      method: 'POST',
      headers,
      body: JSON.stringify({ domainId: domain.id, domainName: `${domain.name}${domain.tld}` }),
    });
    if (res.ok) {
      const data = await res.json();
      setMsg(`${domain.name}${domain.tld} → $${data.price.toLocaleString()} — ${data.reasoning}`);
      fetchDomains();
    } else {
      const err = await res.json();
      setMsg(`Pricing error: ${err.error}`);
    }
    setLoading(false);
  };

  // Per-domain custom prompt additions
  const [logoNotes, setLogoNotes] = useState<Record<string, string>>({});

  const generateLogo = async (domain: Domain) => {
    setLoading(true);
    setMsg(`Generating logo for ${domain.name}${domain.tld}...`);
    const extra = logoNotes[domain.id] || '';
    const res = await fetch('/api/admin/generate-logo', {
      method: 'POST',
      headers,
      body: JSON.stringify({ domainId: domain.id, domainName: `${domain.name}${domain.tld}`, customPrompt: extra }),
    });
    if (res.ok) {
      setMsg('Logo generated!');
      fetchDomains();
    } else {
      const err = await res.json();
      setMsg(`Logo error: ${err.error}`);
    }
    setLoading(false);
  };

  const deleteDomain = async (id: string) => {
    if (!confirm('Delete this domain?')) return;
    await fetch('/api/admin/domains', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ id }),
    });
    fetchDomains();
  };

  const initiateTransfer = async () => {
    if (!transferOrder) return;
    setLoading(true);
    await fetch('/api/admin/orders', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        id: transferOrder.id,
        status: 'transfer_initiated',
        auth_code: authCode,
        transfer_instructions: transferInstructions,
      }),
    });
    setMsg('Transfer initiated!');
    setTransferOrder(null);
    setAuthCode('');
    setTransferInstructions('');
    fetchOrders();
    setLoading(false);
  };

  const repriceAll = async () => {
    setLoading(true);
    setMsg('AI pricing all $0 domains...');
    const res = await fetch('/api/admin/reprice-all', { method: 'POST', headers });
    if (res.ok) {
      const data = await res.json();
      setMsg(`Priced ${data.priced} of ${data.total} domains`);
      fetchDomains();
    } else {
      setMsg('Bulk reprice failed');
    }
    setLoading(false);
  };

  const completeOrder = async (id: string) => {
    await fetch('/api/admin/orders', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ id, status: 'completed' }),
    });
    setMsg('Order completed!');
    fetchOrders();
    fetchDomains();
  };

  if (!authed) {
    return (
      <div style={styles.container}>
        <div style={styles.loginBox}>
          <h1 style={styles.title}>🍑 ASSBOY ADMIN</h1>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            style={styles.input}
          />
          <button onClick={login} style={styles.btnPrimary}>LOGIN</button>
          {msg && <p style={styles.msg}>{msg}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🍑 ASSBOY ADMIN</h1>
        <div style={styles.tabs}>
          {(['domains', 'orders', 'add', 'import'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={tab === t ? { ...styles.tab, ...styles.tabActive } : styles.tab}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {msg && <div style={styles.msgBar}>{msg} <button onClick={() => setMsg('')} style={styles.dismiss}>×</button></div>}

      {tab === 'domains' && (
        <div style={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>Domains ({domains.length})</h2>
            {domains.some(d => d.price === 0) && (
              <button onClick={repriceAll} style={{ ...styles.btnSmall, background: '#FFD700', color: '#000' }} disabled={loading}>
                💰 AI Price All $0 ({domains.filter(d => d.price === 0).length})
              </button>
            )}
          </div>
          <div style={styles.grid}>
            {domains.map(d => (
              <div key={d.id} style={styles.card}>
                {d.logo_url && (
                  <div style={styles.logoWrap}>
                    <img src={d.logo_url} alt={`${d.name}${d.tld} logo`} style={styles.logoLarge} />
                  </div>
                )}
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.domainName}>{d.name}<span style={styles.tld}>{d.tld}</span></div>
                    <div style={styles.price}>${(d.price / 100).toLocaleString()}</div>
                  </div>
                </div>
                <div style={styles.status}>
                  <span style={{
                    ...styles.badge,
                    background: d.status === 'available' ? '#7BC74D' : d.status === 'pending' ? '#FF6F00' : '#FF3CAC',
                  }}>
                    {d.status}
                  </span>
                </div>
                {d.description && <p style={styles.desc}>{d.description}</p>}
                <textarea
                  placeholder="Logo notes for AI (e.g. &quot;make it blue&quot;, &quot;add a rocket icon&quot;)"
                  value={logoNotes[d.id] || ''}
                  onChange={e => setLogoNotes(prev => ({ ...prev, [d.id]: e.target.value }))}
                  style={styles.logoNotes}
                  rows={2}
                />
                <div style={styles.cardActions}>
                  <button onClick={() => generateLogo(d)} style={styles.btnSmall} disabled={loading}>
                    {d.logo_url ? '🔄 Regen Logo' : '🎨 Gen Logo'}
                  </button>
                  <button onClick={() => repriceDomain(d)} style={{ ...styles.btnSmall, background: '#FFD700', color: '#000' }} disabled={loading}>
                    💰 AI Price
                  </button>
                  <button onClick={() => deleteDomain(d.id)} style={{ ...styles.btnSmall, background: '#FF3CAC' }}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Orders ({orders.length})</h2>
          {orders.length === 0 && <p style={styles.empty}>No orders yet</p>}
          {orders.map(o => (
            <div key={o.id} style={styles.orderCard}>
              <div style={styles.orderHeader}>
                <div>
                  <strong style={{ color: '#FFD700' }}>{o.domains?.name}{o.domains?.tld}</strong>
                  <span style={styles.orderEmail}> — {o.buyer_email}</span>
                </div>
                <span style={{
                  ...styles.badge,
                  background: o.status === 'paid' ? '#FF6F00' : o.status === 'completed' ? '#7BC74D' : '#9B30FF',
                }}>
                  {o.status}
                </span>
              </div>
              <div style={styles.orderDetails}>
                <span>${(o.amount / 100).toLocaleString()}</span>
                <span>{new Date(o.created_at).toLocaleDateString()}</span>
              </div>
              {o.status === 'paid' && (
                <button onClick={() => setTransferOrder(o)} style={styles.btnPrimary}>
                  Initiate Transfer
                </button>
              )}
              {o.status === 'transfer_initiated' && (
                <button onClick={() => completeOrder(o.id)} style={{ ...styles.btnPrimary, background: '#7BC74D' }}>
                  Mark Completed
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'add' && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Add Domain</h2>
          <div style={styles.form}>
            <div style={styles.row}>
              <input placeholder="Domain name (e.g. coolsite)" value={newName} onChange={e => setNewName(e.target.value)} style={{ ...styles.input, flex: 2 }} />
              <select value={newTld} onChange={e => setNewTld(e.target.value)} style={{ ...styles.input, flex: 1 }}>
                <option>.com</option><option>.net</option><option>.org</option><option>.io</option><option>.co</option><option>.ai</option><option>.dev</option><option>.app</option>
              </select>
            </div>
            <input placeholder="Price (USD)" type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} style={styles.input} />
            <input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={styles.input} />
            <button onClick={addDomain} style={styles.btnPrimary} disabled={loading || !newName || !newPrice}>
              {loading ? 'Adding...' : 'ADD DOMAIN'}
            </button>
          </div>
        </div>
      )}

      {tab === 'import' && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Import Domains</h2>

          {/* CSV file upload */}
          <div style={styles.uploadBox}>
            <input
              type="file"
              accept=".csv,.txt"
              id="csv-upload"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  setImportText(ev.target?.result as string || '');
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
            <label htmlFor="csv-upload" style={styles.uploadLabel}>
              📄 Upload CSV File
            </label>
            <span style={styles.uploadHint}>or paste below</span>
          </div>

          <p style={styles.hint}>One per line: domain.com, price, description</p>
          <textarea
            placeholder={`txte.com, 5000, Short punchy 4-letter .com\nvoicemix.com, 4500, Audio & voice technology`}
            value={importText}
            onChange={e => setImportText(e.target.value)}
            style={styles.textarea}
            rows={10}
          />
          <button onClick={importDomains} style={styles.btnPrimary} disabled={loading || !importText.trim()}>
            {loading ? 'Importing & generating logos...' : 'IMPORT DOMAINS'}
          </button>
        </div>
      )}

      {/* Transfer Modal */}
      {transferOrder && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Transfer: {transferOrder.domains?.name}{transferOrder.domains?.tld}</h3>
            <p style={styles.modalSub}>Buyer: {transferOrder.buyer_email}</p>
            <input
              placeholder="Auth/EPP Code"
              value={authCode}
              onChange={e => setAuthCode(e.target.value)}
              style={styles.input}
            />
            <textarea
              placeholder="Transfer instructions for the buyer..."
              value={transferInstructions}
              onChange={e => setTransferInstructions(e.target.value)}
              style={styles.textarea}
              rows={4}
            />
            <div style={styles.row}>
              <button onClick={initiateTransfer} style={styles.btnPrimary} disabled={loading || !authCode}>
                Send Transfer
              </button>
              <button onClick={() => setTransferOrder(null)} style={{ ...styles.btnSmall, background: '#666' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: '#0a0a1a', color: '#fff', fontFamily: "'Nunito', sans-serif", padding: '20px' },
  loginBox: { maxWidth: '400px', margin: '100px auto', textAlign: 'center' },
  header: { maxWidth: '1200px', margin: '0 auto 30px', textAlign: 'center' },
  title: { fontSize: '2rem', color: '#FF6F00', marginBottom: '20px', fontFamily: "'Bungee', cursive" },
  tabs: { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' },
  tab: { background: '#1a1a2e', borderWidth: '2px', borderStyle: 'solid', borderColor: '#333', color: '#888', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700 },
  tabActive: { borderColor: '#FF6F00', color: '#FF6F00', background: '#1a0533' },
  section: { maxWidth: '1200px', margin: '0 auto' },
  sectionTitle: { fontSize: '1.5rem', color: '#7BC74D', marginBottom: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' },
  card: { background: '#1a1a2e', border: '1px solid #333', borderRadius: '12px', padding: '20px' },
  cardHeader: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px' },
  logoWrap: { width: '100%', height: '160px', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoLarge: { maxWidth: '100%', maxHeight: '160px', objectFit: 'contain' as const },
  domainName: { fontSize: '1.2rem', fontWeight: 700 },
  tld: { color: '#7BC74D' },
  price: { color: '#FFD700', fontWeight: 700 },
  status: { marginBottom: '8px' },
  badge: { padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, color: '#000' },
  desc: { color: '#888', fontSize: '0.85rem', marginBottom: '10px' },
  logoNotes: { background: '#111', border: '1px solid #333', borderRadius: '6px', padding: '8px 10px', color: '#ccc', fontSize: '0.8rem', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', resize: 'vertical' as const, marginBottom: '10px' },
  cardActions: { display: 'flex', gap: '8px' },
  btnSmall: { background: '#9B30FF', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  btnPrimary: { background: '#FF6F00', color: '#fff', border: 'none', padding: '12px 30px', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, width: '100%' },
  input: { background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '1rem', width: '100%', boxSizing: 'border-box' as const },
  textarea: { background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'monospace', resize: 'vertical' as const },
  form: { display: 'flex', flexDirection: 'column' as const, gap: '12px', maxWidth: '500px' },
  row: { display: 'flex', gap: '10px' },
  hint: { color: '#666', fontSize: '0.85rem', marginBottom: '10px' },
  uploadBox: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '20px', border: '2px dashed #333', borderRadius: '12px', background: '#0a0a1a' },
  uploadLabel: { background: '#9B30FF', color: '#fff', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem' },
  uploadHint: { color: '#555', fontSize: '0.85rem' },
  msg: { color: '#FF3CAC', marginTop: '10px' },
  msgBar: { background: '#1a0533', border: '1px solid #9B30FF', borderRadius: '8px', padding: '10px 16px', margin: '0 auto 20px', maxWidth: '1200px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#c0a8e0' },
  dismiss: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' },
  empty: { color: '#666', textAlign: 'center' as const, padding: '40px' },
  orderCard: { background: '#1a1a2e', border: '1px solid #333', borderRadius: '12px', padding: '20px', marginBottom: '12px' },
  orderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  orderEmail: { color: '#888' },
  orderDetails: { display: 'flex', gap: '20px', color: '#666', fontSize: '0.85rem', marginBottom: '10px' },
  modal: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#1a1a2e', border: '2px solid #FF6F00', borderRadius: '16px', padding: '30px', maxWidth: '500px', width: '90%', display: 'flex', flexDirection: 'column' as const, gap: '12px' },
  modalTitle: { color: '#FFD700', fontSize: '1.3rem' },
  modalSub: { color: '#888' },
};
