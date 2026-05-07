import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateMatches(names) {
  const s = shuffle(names);
  const matches = [];
  for (let i = 0; i < s.length; i += 4) {
    if (i + 3 < s.length) {
      matches.push({ court: `Court ${matches.length + 1}`, team1: [s[i], s[i+1]], team2: [s[i+2], s[i+3]] });
    }
  }
  return matches;
}

function buildGroupUpdate(session) {
  const isFull = session.signups.length >= session.spots;
  const inList = session.signups.map((n, i) => `${i+1}. ${n}`).join('\n');
  const outList = session.waitlist?.length > 0 ? session.waitlist.map(n => `• ${n} (waitlist)`).join('\n') : null;
  const link = window.location.origin;
  return `🎾 *Smash — ${session.date} at ${session.time}*\n📍 ${session.location_name}\n\n` +
    `✅ *Confirmed (${session.signups.length}/${session.spots}):*\n${inList || '—'}\n\n` +
    (isFull
      ? `🔴 *Session FULL*${outList ? `\n\n⏳ *Waitlist:*\n${outList}` : ''}`
      : `🟡 *${session.spots - session.signups.length} spot${session.spots - session.signups.length !== 1 ? 's' : ''} left*\n👉 Sign up: ${link}`);
}

function buildAnnounceMsg(session) {
  const link = window.location.origin;
  return `🎾 *Smash — Padel Session!*\n\n📅 ${session.date} at ${session.time}\n⏱ ${session.duration}h\n📍 ${session.location_name}\n📍 ${session.location_address || ''}\n\n✅ ${session.spots - session.signups.length} spots left\n\n👉 Sign up: ${link}\n\n_First come, first served._`;
}

function waLink(phone, text) {
  return `https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`;
}

const S = {
  page: { minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Georgia','Times New Roman',serif", color: '#f0ece0' },
  header: { background: 'linear-gradient(135deg,#1a3a1a 0%,#0d1f0d 50%,#0a0a0a 100%)', borderBottom: '1px solid #2a4a2a', padding: '0 16px' },
  inner: { maxWidth: 600, margin: '0 auto' },
  h1: { margin: 0, fontSize: 38, fontWeight: 400, letterSpacing: 3, color: '#e8f5e8' },
  tab: (active) => ({ background: 'none', border: 'none', borderBottom: active ? '2px solid #7ab87a' : '2px solid transparent', color: active ? '#a8d8a8' : '#5a7a5a', fontFamily: 'inherit', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', padding: '10px 16px 8px', cursor: 'pointer' }),
  card: { background: '#0f1a0f', border: '1px solid #1e3a1e', borderRadius: 6, marginBottom: 16, overflow: 'hidden' },
  cardHead: { background: 'linear-gradient(90deg,#1a3a1a,#0f1a0f)', padding: '14px 16px', borderBottom: '1px solid #1e3a1e' },
  inp: { width: '100%', background: '#111', border: '1px solid #2a4a2a', color: '#f0ece0', fontFamily: 'inherit', fontSize: 14, padding: '10px 12px', borderRadius: 4, boxSizing: 'border-box', outline: 'none' },
  btn: (color='#4a8a4a', bg='#2a5a2a', border='#4a8a4a') => ({ background: bg, border: `1px solid ${border}`, color, fontFamily: 'inherit', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', padding: '9px 16px', cursor: 'pointer', borderRadius: 4 }),
  pill: (active) => ({ background: active ? '#2a5a2a' : '#131f13', border: `1px solid ${active ? '#4a8a4a' : '#1e3a1e'}`, color: active ? '#a8d8a8' : '#6a8a6a', fontSize: 11, padding: '3px 10px', borderRadius: 20, display: 'inline-block' }),
  label: { fontSize: 10, letterSpacing: 2, color: '#5a7a5a', textTransform: 'uppercase', marginBottom: 6, display: 'block' },
};

const TABS = ['Sessions', 'Players', 'About'];

function NameEntry({ onEnter }) {
  const [name, setName] = useState('');
  return (
    <div style={{ ...S.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎾</div>
      <h1 style={{ ...S.h1, marginBottom: 8, textAlign: 'center' }}>Smash</h1>
      <p style={{ color: '#5a7a5a', marginBottom: 32, textAlign: 'center', fontSize: 15 }}>Enter your name to join your padel group</p>
      <div style={{ width: '100%', maxWidth: 320 }}>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && name.trim() && onEnter(name.trim())} placeholder="Your name..." style={{ ...S.inp, fontSize: 18, padding: '14px 16px', marginBottom: 12, textAlign: 'center' }} autoFocus />
        <button onClick={() => name.trim() && onEnter(name.trim())} style={{ ...S.btn('#a8d8a8', '#2a5a2a', '#4a8a4a'), width: '100%', fontSize: 14, padding: '12px' }}>Enter Smash →</button>
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('smash_name') || null);
  const [tab, setTab] = useState('Sessions');
  const [sessions, setSessions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSession, setNewSession] = useState({ date: '', time: '', duration: '', spots: '', location_name: '', location_address: '' });
  const [viewMatches, setViewMatches] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [copied, setCopied] = useState({});
  const [newPlayer, setNewPlayer] = useState({ name: '', phone: '' });
  const [toast, setToast] = useState(null);

  const showToast = (msg, color = '#7ab87a') => { setToast({ msg, color }); setTimeout(() => setToast(null), 2500); };
  const copyText = (key, text) => { navigator.clipboard.writeText(text).then(() => { setCopied(s => ({ ...s, [key]: true })); setTimeout(() => setCopied(s => ({ ...s, [key]: false })), 2000); showToast('Copied!'); }); };

  const loadSessions = useCallback(async () => { const { data, error } = await supabase.from('sessions').select('*').order('created_at', { ascending: true }); if (!error && data) setSessions(data); }, []);
  const loadPlayers = useCallback(async () => { const { data, error } = await supabase.from('players').select('*').order('name', { ascending: true }); if (!error && data) setPlayers(data); }, []);

  useEffect(() => {
    Promise.all([loadSessions(), loadPlayers()]).then(() => setLoading(false));
    const sessionSub = supabase.channel('sessions').on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, loadSessions).subscribe();
    const playerSub = supabase.channel('players').on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, loadPlayers).subscribe();
    return () => { supabase.removeChannel(sessionSub); supabase.removeChannel(playerSub); };
  }, [loadSessions, loadPlayers]);

  const handleEnter = async (name) => { localStorage.setItem('smash_name', name); setCurrentUser(name); const exists = players.find(p => p.name.toLowerCase() === name.toLowerCase()); if (!exists) await supabase.from('players').insert({ name, phone: '' }); };

  const handleSignUp = async (session) => {
    const signups = session.signups || []; const waitlist = session.waitlist || [];
    const isFull = signups.length >= session.spots; const isIn = signups.includes(currentUser); const isWaiting = waitlist.includes(currentUser);
    let us = [...signups]; let uw = [...waitlist];
    if (isIn) { us = signups.filter(n => n !== currentUser); if (uw.length > 0) { const next = uw.shift(); us.push(next); } showToast('Cancelled.'); }
    else if (isWaiting) { uw = waitlist.filter(n => n !== currentUser); showToast('Removed from waitlist.'); }
    else if (isFull) { uw = [...waitlist, currentUser]; showToast("You're on the waitlist! ⏳", '#d8b84a'); }
    else { us = [...signups, currentUser]; showToast("You're in! 🎾"); }
    await supabase.from('sessions').update({ signups: us, waitlist: uw }).eq('id', session.id); loadSessions();
  };

  const handleCreateSession = async () => {
    if (!newSession.date || !newSession.time || !newSession.duration || !newSession.spots || !newSession.location_name) return;
    await supabase.from('sessions').insert({ date: newSession.date, time: newSession.time, duration: parseFloat(newSession.duration), spots: parseInt(newSession.spots), location_name: newSession.location_name, location_address: newSession.location_address, signups: [], waitlist: [], matches: null });
    setNewSession({ date: '', time: '', duration: '', spots: '', location_name: '', location_address: '' }); setShowNewSession(false); showToast('Session created! 🎾');
  };

  const handleGenerateMatches = async (session) => { const matches = generateMatches(session.signups); await supabase.from('sessions').update({ matches }).eq('id', session.id); loadSessions(); setViewMatches(session.id); };
  const handleDeleteSession = async (id) => { await supabase.from('sessions').delete().eq('id', id); loadSessions(); };
  const handleAddPlayer = async () => { if (!newPlayer.name.trim()) return; const exists = players.find(p => p.name.toLowerCase() === newPlayer.name.trim().toLowerCase()); if (exists) { showToast('Player already exists.', '#d87a7a'); return; } await supabase.from('players').insert({ name: newPlayer.name.trim(), phone: newPlayer.phone.trim() }); setNewPlayer({ name: '', phone: '' }); showToast('Player added!'); };
  const handleRemovePlayer = async (id) => { await supabase.from('players').delete().eq('id', id); loadPlayers(); };

  const matchSession = sessions.find(s => s.id === viewMatches);

  if (!currentUser) return <NameEntry onEnter={handleEnter} players={players} />;

  return (
    <div style={S.page}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#1a3a1a', border: `1px solid ${toast.color}`, color: toast.color, padding: '10px 20px', borderRadius: 20, fontSize: 13, zIndex: 200, whiteSpace: 'nowrap' }}>{toast.msg}</div>}
      <div style={S.header}>
        <div style={S.inner}>
          <div style={{ paddingTop: 24, paddingBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div><div style={{ fontSize: 10, letterSpacing: 5, color: '#7ab87a', textTransform: 'uppercase' }}>◆ Padel Hub</div><h1 style={S.h1}>Smash</h1><div style={{ fontSize: 12, color: '#5a7a5a' }}>{players.length} members · {sessions.length} sessions</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: '#5a7a5a' }}>Playing as</div><div style={{ fontSize: 14, color: '#a8d8a8' }}>{currentUser}</div><button onClick={() => { localStorage.removeItem('smash_name'); setCurrentUser(null); }} style={{ background: 'none', border: 'none', color: '#3a5a3a', fontSize: 10, cursor: 'pointer', padding: 0 }}>change</button></div>
          </div>
          <div style={{ display: 'flex' }}>{TABS.map(t => <button key={t} onClick={() => setTab(t)} style={S.tab(tab === t)}>{t}</button>)}</div>
        </div>
      </div>
      <div style={{ ...S.inner, padding: '24px 16px' }}>
        {loading && <div style={{ textAlign: 'center', color: '#3a5a3a', padding: 48 }}>Loading...</div>}
        {!loading && tab === 'Sessions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 400, color: '#c8e6c8' }}>Sessions</h2>
              <button onClick={() => setShowNewSession(!showNewSession)} style={S.btn('#a8d8a8', showNewSession ? '#1a3a1a' : '#2a5a2a', '#4a7a4a')}>{showNewSession ? '✕ Cancel' : '+ New'}</button>
            </div>
            {showNewSession && (
              <div style={{ background: '#111', border: '1px solid #2a4a2a', borderRadius: 6, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: 3, color: '#7ab87a', textTransform: 'uppercase', marginBottom: 14 }}>New Session</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  {[{label:'Date',key:'date',placeholder:'Friday May 23'},{label:'Time',key:'time',type:'time'},{label:'Duration (h)',key:'duration',placeholder:'2',type:'number'},{label:'Spots',key:'spots',placeholder:'20',type:'number'}].map(f => (
                    <div key={f.key}><label style={S.label}>{f.label}</label><input type={f.type||'text'} value={newSession[f.key]} placeholder={f.placeholder||''} onChange={e => setNewSession({...newSession,[f.key]:e.target.value})} style={S.inp}/></div>
                  ))}
                </div>
                <div style={{ marginBottom: 10 }}><label style={S.label}>Venue</label><input value={newSession.location_name} placeholder="e.g. Padel Lisboa Court 1" onChange={e => setNewSession({...newSession,location_name:e.target.value})} style={S.inp}/></div>
                <div style={{ marginBottom: 14 }}><label style={S.label}>Address</label><input value={newSession.location_address} placeholder="e.g. Av. da Liberdade 110" onChange={e => setNewSession({...newSession,location_address:e.target.value})} style={S.inp}/></div>
                <button onClick={handleCreateSession} style={S.btn('#a8d8a8','#2a5a2a','#4a8a4a')}>Create Session</button>
              </div>
            )}
            {sessions.length === 0 && <div style={{ textAlign: 'center', color: '#3a5a3a', padding: 48 }}>No sessions yet. Create one!</div>}
            {sessions.map(session => {
              const signups = session.signups||[]; const waitlist = session.waitlist||[];
              const isFull = signups.length >= session.spots; const isIn = signups.includes(currentUser); const isWaiting = waitlist.includes(currentUser);
              const pct = Math.min(100,(signups.length/session.spots)*100);
              const unsigned = players.filter(p => !signups.includes(p.name) && !waitlist.includes(p.name));
              const panelOpen = openPanel?.id === session.id; const panelType = openPanel?.type;
              const groupUpdate = buildGroupUpdate(session); const announceMsg = buildAnnounceMsg(session);
              return (
                <div key={session.id} style={S.card}>
                  <div style={S.cardHead}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div><div style={{ fontSize: 17, color: '#c8e6c8' }}>{session.date}</div><div style={{ fontSize: 13, color: '#7ab87a', marginTop: 3 }}>{session.time} · {session.duration}h · {session.location_name}</div>{session.location_address && <div style={{ fontSize: 11, color: '#3a5a3a', marginTop: 2 }}>{session.location_address}</div>}</div>
                      <div style={{ background: isFull?'#3a1a1a':'#1a3a1a', border:`1px solid ${isFull?'#5a2a2a':'#3a6a3a'}`, color: isFull?'#d87a7a':'#7ab87a', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 3 }}>{isFull ? 'Full' : `${session.spots-signups.length} left`}</div>
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4a6a4a', marginBottom: 4 }}><span>{signups.length} confirmed</span><span>{session.spots} spots</span></div>
                      <div style={{ height: 3, background: '#1a2a1a', borderRadius: 2 }}><div style={{ height: '100%', width: `${pct}%`, background: isFull?'#d87a7a':'#4a8a4a', borderRadius: 2, transition: 'width 0.4s' }}/></div>
                    </div>
                    {signups.length > 0 && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, letterSpacing: 2, color: '#4a6a4a', textTransform: 'uppercase', marginBottom: 6 }}>✅ In ({signups.length})</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{signups.map(p => <span key={p} style={S.pill(p===currentUser)}>{p}{p===currentUser?' ★':''}</span>)}</div></div>}
                    {waitlist.length > 0 && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, letterSpacing: 2, color: '#6a5a3a', textTransform: 'uppercase', marginBottom: 6 }}>⏳ Waitlist ({waitlist.length})</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{waitlist.map((p,i) => <span key={p} style={{ ...S.pill(p===currentUser), background: '#2a1a0a', border: '1px solid #4a3a1a', color: '#c8a86a' }}>#{i+1} {p}</span>)}</div></div>}
                    {unsigned.length > 0 && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, letterSpacing: 2, color: '#4a3a3a', textTransform: 'uppercase', marginBottom: 6 }}>✗ Not in ({unsigned.length})</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{unsigned.map(p => <span key={p.name} style={{ background: '#1a1010', border: '1px solid #2a1a1a', color: '#5a4a4a', fontSize: 11, padding: '3px 9px', borderRadius: 20 }}>{p.name}</span>)}</div></div>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button onClick={() => handleSignUp(session)} style={{ ...S.btn(isIn?'#d87a7a':isWaiting?'#c8a86a':isFull?'#5a5a5a':'#a8d8a8', isIn?'#3a1a1a':isWaiting?'#2a1a0a':isFull?'#1a1a1a':'#2a5a2a', isIn?'#5a2a2a':isWaiting?'#4a3a1a':isFull?'#2a2a2a':'#4a8a4a'), fontSize: 13 }}>{isIn?'✕ Cancel':isWaiting?'⏳ Leave Waitlist':isFull?'+ Join Waitlist':'✓ Sign Up'}</button>
                      {signups.length >= 4 && <button onClick={() => session.matches ? setViewMatches(session.id) : handleGenerateMatches(session)} style={S.btn('#7ab8d8','#1a2a3a','#2a4a6a')}>{session.matches?'🏆 View Draw':'🏆 Draw'}</button>}
                      <button onClick={() => setOpenPanel(panelOpen && panelType==='share' ? null : {id:session.id,type:'share'})} style={S.btn('#25d366','#0a1a0a','#25d36644')}>🔗 Share</button>
                      <button onClick={() => setOpenPanel(panelOpen && panelType==='wa' ? null : {id:session.id,type:'wa'})} style={S.btn('#25d366','#0a1f0a','#25d36633')}>📲 WA</button>
                    </div>
                    {panelOpen && panelType==='share' && (
                      <div style={{ marginTop: 14, background: '#060f06', border: '1px solid #25d36633', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #0f2a0f', fontSize: 10, letterSpacing: 3, color: '#25d366', textTransform: 'uppercase' }}>🔗 Share & Update</div>
                        <div style={{ padding: '12px 14px', borderBottom: '1px solid #0f2a0f' }}>
                          <div style={{ fontSize: 12, color: '#a8d8a8', marginBottom: 8 }}><b style={{ background: '#1a4a1a', borderRadius: '50%', padding: '1px 6px', marginRight: 6, fontSize: 10 }}>1</b>Post in your WhatsApp group</div>
                          <div style={{ background: '#0a140a', borderRadius: 4, padding: '8px 10px', fontSize: 11, color: '#4a7a4a', whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 8 }}>{announceMsg}</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => copyText(`ann-${session.id}`, announceMsg)} style={S.btn(copied[`ann-${session.id}`]?'#25d366':'#5a9a5a','#0d200d','#25d36655')}>{copied[`ann-${session.id}`]?'✓ Copied!':'📋 Copy'}</button>
                            <a href={`https://wa.me/?text=${encodeURIComponent(announceMsg)}`} target="_blank" rel="noreferrer" style={{ ...S.btn('#25d366','#0d200d','#25d36655'), textDecoration: 'none' }}>📲 Open WA</a>
                          </div>
                        </div>
                        <div style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 12, color: '#a8d8a8', marginBottom: 8 }}><b style={{ background: '#1a4a1a', borderRadius: '50%', padding: '1px 6px', marginRight: 6, fontSize: 10 }}>2</b>Paste update back into group</div>
                          <div style={{ background: '#0a140a', borderRadius: 4, padding: '8px 10px', fontSize: 11, color: '#5a7a5a', whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 8 }}>{groupUpdate}</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => copyText(`upd-${session.id}`, groupUpdate)} style={S.btn(copied[`upd-${session.id}`]?'#25d366':'#5a9a5a','#0d200d','#25d36655')}>{copied[`upd-${session.id}`]?'✓ Copied!':'📋 Copy Update'}</button>
                            <a href={`https://wa.me/?text=${encodeURIComponent(groupUpdate)}`} target="_blank" rel="noreferrer" style={{ ...S.btn('#25d366','#0d200d','#25d36655'), textDecoration: 'none' }}>📲 Share WA</a>
                          </div>
                        </div>
                      </div>
                    )}
                    {panelOpen && panelType==='wa' && (
                      <div style={{ marginTop: 14, background: '#060f06', border: '1px solid #25d36633', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #0f2a0f', fontSize: 10, letterSpacing: 3, color: '#25d366', textTransform: 'uppercase' }}>📲 Message Players</div>
                        {[
                          { icon: '📣', label: 'Announce to All', color: '#7ab87a', people: players, msg: () => buildAnnounceMsg(session), desc: `${players.length} members` },
                          { icon: '⏰', label: 'Chase Unsigned', color: '#d8b84a', people: unsigned, msg: (p) => `🎾 Hey ${p.name}! Still ${session.spots-signups.length} spots left for padel on *${session.date} at ${session.time}*.\n\n📍 ${session.location_name}\n\n👉 Sign up: ${window.location.origin}`, desc: `${unsigned.length} players`, disabled: unsigned.length===0 },
                          { icon: '😔', label: 'Notify Left Out', color: '#d87a7a', people: players.filter(p=>!signups.includes(p.name)&&!waitlist.includes(p.name)), msg: (p) => `🎾 Hey ${p.name}, the session on *${session.date}* is now full. You're on our radar for next time! 🙏`, desc: `${players.filter(p=>!signups.includes(p.name)).length} players`, disabled: !isFull },
                          { icon: '🏆', label: 'Send Draw', color: '#7ab8d8', people: players.filter(p=>signups.includes(p.name)), msg: () => buildGroupUpdate(session), desc: `${signups.length} confirmed`, disabled: !session.matches },
                        ].map(action => (
                          <div key={action.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #0f1f0f', opacity: action.disabled?0.3:1 }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ fontSize: 18 }}>{action.icon}</span><div><div style={{ fontSize: 13, color: action.color }}>{action.label}</div><div style={{ fontSize: 11, color: '#3a5a3a' }}>{action.desc}</div></div></div>
                            <button disabled={action.disabled} onClick={() => { if(action.disabled)return; action.people.forEach((p,i)=>{ if(!p.phone)return; const msg=typeof action.msg==='function'?action.msg(p):action.msg(); setTimeout(()=>window.open(waLink(p.phone,msg),'_blank'),i*350); }); showToast(`Opening WhatsApp...`); }} style={S.btn(action.disabled?'#2a2a2a':action.color,'#0d200d',action.disabled?'#1a1a1a':action.color+'55')}>Send →</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 12, textAlign: 'right' }}><button onClick={() => handleDeleteSession(session.id)} style={{ background: 'none', border: 'none', color: '#3a2a2a', fontSize: 10, cursor: 'pointer' }}>delete session</button></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loading && tab === 'Players' && (
          <div>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 400, color: '#c8e6c8' }}>Members ({players.length})</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {[{label:'Name',key:'name',placeholder:'e.g. João'},{label:'WhatsApp',key:'phone',placeholder:'+351...'}].map(f => (
                <div key={f.key}><label style={S.label}>{f.label}</label><input value={newPlayer[f.key]} onChange={e=>setNewPlayer({...newPlayer,[f.key]:e.target.value})} onKeyDown={e=>e.key==='Enter'&&handleAddPlayer()} placeholder={f.placeholder} style={S.inp}/></div>
              ))}
            </div>
            <button onClick={handleAddPlayer} style={{ ...S.btn('#a8d8a8','#2a5a2a','#4a8a4a'), marginBottom: 20 }}>Add Player</button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {players.map((p,i) => (
                <div key={p.id||p.name} style={{ background: p.name===currentUser?'#1a3a1a':'#0f1a0f', border:`1px solid ${p.name===currentUser?'#3a6a3a':'#1e3a1e'}`, borderRadius: 4, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${(i*47)%360},40%,20%)`, border: `1px solid hsl(${(i*47)%360},40%,36%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: `hsl(${(i*47)%360},60%,65%)`, flexShrink: 0 }}>{p.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, color: p.name===currentUser?'#a8d8a8':'#8aaa8a' }}>{p.name}{p.name===currentUser&&<span style={{ fontSize: 9, color: '#5a8a5a' }}> YOU</span>}</div><div style={{ fontSize: 10, color: '#3a5a3a' }}>{p.phone||'no number'}</div></div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {p.phone && <a href={waLink(p.phone,'Hey! 🎾')} target="_blank" rel="noreferrer" style={{ fontSize: 14, textDecoration: 'none', opacity: 0.5 }}>💬</a>}
                    {p.name !== currentUser && <button onClick={() => handleRemovePlayer(p.id)} style={{ background: 'none', border: 'none', color: '#3a2a2a', cursor: 'pointer', fontSize: 12 }}>✕</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!loading && tab === 'About' && (
          <div style={{ color: '#8aaa8a', lineHeight: 1.8, fontSize: 14 }}>
            <h2 style={{ color: '#c8e6c8', fontWeight: 400, marginBottom: 12 }}>About Smash</h2>
            <p style={{ marginBottom: 16 }}>Your padel group's coordination hub. Real-time sign-ups, waitlists, random draws, and WhatsApp integration.</p>
            <div style={{ padding: 16, background: '#0f1a0f', border: '1px solid #1e3a1e', borderRadius: 6 }}>
              {[['🔴','Live data','Everyone sees the same list in real time.'],['⏳','Waitlist','Auto-fills when someone cancels.'],['🔗','Share link','Post in WhatsApp, players sign up.'],['📋','Group update','Copy formatted list back into WhatsApp.'],['🏆','Random draw','Generate matchups and send to players.']].map(([icon,title,desc]) => (
                <div key={title} style={{ display: 'flex', gap: 10, marginBottom: 12 }}><span style={{ fontSize: 18, minWidth: 24 }}>{icon}</span><div><div style={{ color: '#a8c8a8', fontSize: 13 }}>{title}</div><div style={{ fontSize: 12, color: '#5a7a5a' }}>{desc}</div></div></div>
              ))}
            </div>
          </div>
        )}
      </div>
      {viewMatches && matchSession && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }} onClick={() => setViewMatches(null)}>
          <div style={{ background: '#0f1a0f', border: '1px solid #2a5a2a', borderRadius: 8, padding: 24, maxWidth: 440, width: '100%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 10, letterSpacing: 4, color: '#5a8a5a', textTransform: 'uppercase', marginBottom: 4 }}>First Round Draw</div>
            <div style={{ fontSize: 18, color: '#c8e6c8', marginBottom: 2 }}>{matchSession.date}</div>
            <div style={{ fontSize: 12, color: '#5a7a5a', marginBottom: 20 }}>{matchSession.time} · {matchSession.location_name}</div>
            {matchSession.matches && matchSession.matches.map((m,i) => (
              <div key={i} style={{ background: '#131f13', border: '1px solid #1e3a1e', borderRadius: 6, padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: '#4a6a4a', textTransform: 'uppercase', marginBottom: 8 }}>{m.court}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>{m.team1.map(p => <div key={p} style={{ color: '#a8d8a8', fontSize: 14, padding: '2px 0' }}>{p}</div>)}</div>
                  <div style={{ color: '#3a5a3a', fontSize: 11, letterSpacing: 2 }}>VS</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>{m.team2.map(p => <div key={p} style={{ color: '#d8b8a8', fontSize: 14, padding: '2px 0' }}>{p}</div>)}</div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => handleGenerateMatches(matchSession)} style={S.btn('#7ab8d8','#1a2a3a','#2a4a6a')}>↺ Re-shuffle</button>
              <button onClick={() => setViewMatches(null)} style={S.btn('#5a7a5a','none','#2a4a2a')}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
