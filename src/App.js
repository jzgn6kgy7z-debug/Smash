import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

// ── Helpers ──────────────────────────────────────────────────────────────────

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function generateBalancedMatches(signups, playerMap) {
  const sorted = [...signups].sort((a, b) => (playerMap[a]?.level || 3) - (playerMap[b]?.level || 3));
  const half = Math.floor(sorted.length / 2);
  const top = shuffle(sorted.slice(0, half));
  const bottom = shuffle(sorted.slice(half));
  const matches = [];
  for (let i = 0; i < Math.floor(sorted.length / 4); i++) {
    matches.push({ court: `Court ${i + 1}`, team1: [top[i*2], top[i*2+1]], team2: [bottom[i*2], bottom[i*2+1]] });
  }
  return matches;
}

function buildGroupUpdate(session, playerMap) {
  const isFull = session.signups.length >= session.spots;
  const inList = session.signups.map((n, i) => `${i+1}. ${n}${playerMap[n]?.level ? ` (L${playerMap[n].level})` : ''}`).join('\n');
  const link = window.location.origin;
  return `🎾 *Smash — ${formatDate(session.date)} at ${session.time}*\n📍 ${session.location_name}\n\n✅ *Confirmed (${session.signups.length}/${session.spots}):*\n${inList||'—'}\n\n`+(isFull?`🔴 *Session FULL*`:`🟡 *${session.spots-session.signups.length} spots left*\n👉 ${link}`);
}

function buildAnnounceMsg(session) {
  return `🎾 *Smash Padel!*\n\n📅 ${formatDate(session.date)} at ${session.time}\n⏱ ${session.duration}h\n📍 ${session.location_name}\n${session.location_address||''}\n\n✅ ${session.spots-session.signups.length} spots left!\n\n👉 Sign up: ${window.location.origin}\n\n_First come, first served!_ 🏆`;
}

function waLink(phone, text) {
  return `https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const QUOTES = [
  { text: "Suffer what there is to suffer, enjoy what there is to enjoy — but always play padel.", emoji: "🎾" },
  { text: "Winter always turns to spring.", emoji: "🌱" },
  { text: "The greater the hardship, the greater the benefit.", emoji: "💎" },
  { text: "I came. I chanted. I smashed.", emoji: "🏆" },
  { text: "Difficulties are not obstacles — they are the path. Especially the wall shot.", emoji: "⛰️" },
  { text: "Iron, when heated in the flames, becomes a fine sword. My backhand is still in the flames.", emoji: "⚔️" },
  { text: "Rise up and fight. That is what it means to be alive.", emoji: "🔥" },
  { text: "The treasure tower exists in each of us. Mine is hidden behind a terrible lob.", emoji: "🏯" },
  { text: "Nam-myoho-renge-kyo is like the roar of a lion. My serve sounds more like a kitten.", emoji: "🦁" },
  { text: "Each moment is the only moment — give it everything.", emoji: "💙" },
  { text: "The heart of the Lotus Sutra is the dignity of life. The heart of padel is not double faulting.", emoji: "🌺" },
  { text: "Kosen-rufu begins with a single courageous step. Or a well-placed smash.", emoji: "👣" },
  { text: "Your voice resonates throughout the universe. Especially when you blame your partner.", emoji: "✨" },
  { text: "Happiness never decreases by being shared — unless it's sharing a court with a bandalero.", emoji: "🙏" },
  { text: "A single word can save or destroy a life. That word is 'yours'.", emoji: "📿" },
  { text: "Do not dwell in the past. That ball was out. Move on.", emoji: "🌊" },
];

const LEVELS = [1,2,3,4,5,6];
const LEVEL_LABELS = { 1:'Pro 🏆', 2:'Advanced ⭐⭐', 3:'Intermediate ⭐', 4:'Beginner+', 5:'Beginner', 6:'Newcomer 🌱' };
const LEVEL_COLORS = { 1:'#ffd700', 2:'#ff9f40', 3:'#7ab8d8', 4:'#4a7aff', 5:'#a88ad8', 6:'#d87a7a' };
const TABS = ['Sessions','Players','About'];

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif !important; background: #050a05; }
  @keyframes bounce { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-12px) rotate(5deg)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes pulse { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(74,122,255,0.4)} 50%{transform:scale(1.02);box-shadow:0 0 0 8px rgba(74,122,255,0)} }
  @keyframes shimmer { from{background-position:-200% 0} to{background-position:200% 0} }
  @keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
  @keyframes glow { 0%,100%{box-shadow:0 0 5px rgba(74,122,255,0.3)} 50%{box-shadow:0 0 20px rgba(74,122,255,0.6)} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes quoteSlide { 0%{opacity:0;transform:translateY(6px)} 10%{opacity:1;transform:translateY(0)} 85%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-6px)} }
  .ball-bounce { animation: bounce 1.5s ease-in-out infinite; display:inline-block; }
  .fade-up { animation: fadeUp 0.5s ease forwards; }
  .fade-in { animation: fadeIn 0.3s ease forwards; }
  .pulse-btn { animation: pulse 2s ease infinite; }
  .card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(74,122,255,0.15); }
  .btn-hover { transition: all 0.2s ease; }
  .btn-hover:hover { filter: brightness(1.15); transform: translateY(-1px); }
  .level-btn { transition: all 0.15s ease; }
  .level-btn:hover { transform: scale(1.1); }
  .level-btn.active { transform: scale(1.15); }
  .tab-btn { transition: all 0.2s ease; position: relative; }
  .tab-btn::after { content:''; position:absolute; bottom:0; left:50%; right:50%; height:2px; background:#4a7aff; transition: all 0.2s ease; border-radius:2px 2px 0 0; }
  .tab-btn.active::after { left:0; right:0; }
  input, select { transition: border-color 0.2s, box-shadow 0.2s; }
  input:focus, select:focus { border-color: #4a7aff !important; box-shadow: 0 0 0 3px rgba(74,122,255,0.15) !important; outline: none; }
  input[type=date]::-webkit-calendar-picker-indicator, input[type=time]::-webkit-calendar-picker-indicator { filter: invert(0.6) sepia(1) hue-rotate(80deg); cursor: pointer; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: #0a0a0a; }
  ::-webkit-scrollbar-thumb { background: #1a2a70; border-radius: 3px; }
  .quote-anim { animation: quoteSlide 5s ease-in-out infinite; }
  .glow-green { animation: glow 2s ease infinite; }
  .shimmer { background: linear-gradient(90deg, transparent 0%, rgba(74,122,255,0.08) 50%, transparent 100%); background-size: 200% 100%; animation: shimmer 2s infinite; }
  .progress-bar { transition: width 0.6s cubic-bezier(0.4,0,0.2,1); }
  .slide-in { animation: slideIn 0.3s ease forwards; }
`;

// ── Components ────────────────────────────────────────────────────────────────

function LevelBadge({ level }) {
  if (!level) return null;
  return (
    <span style={{ background: LEVEL_COLORS[level]+'22', border:`1px solid ${LEVEL_COLORS[level]}55`, color: LEVEL_COLORS[level], fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700, letterSpacing:0.5, whiteSpace:'nowrap', fontFamily:'Inter,sans-serif' }}>
      L{level}
    </span>
  );
}

function QuoteBanner() {
  const [qi, setQi] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setQi(i => (i+1)%QUOTES.length); setVisible(true); }, 400);
    }, 5000);
    return () => clearInterval(t);
  }, []);
  const q = QUOTES[qi];
  return (
    <div style={{ background:'linear-gradient(135deg,#091530,#0a1f0a)', border:'1px solid #1e4a1e', borderRadius:12, padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:14, overflow:'hidden', position:'relative' }}>
      <div className="shimmer" style={{ position:'absolute', inset:0, pointerEvents:'none' }} />
      <div style={{ fontSize:32, flexShrink:0 }}>{q.emoji}</div>
      <div style={{ opacity: visible?1:0, transform: visible?'translateY(0)':'translateY(6px)', transition:'all 0.4s ease' }}>
        <div style={{ fontSize:13, color:'#a8c8ff', fontStyle:'italic', lineHeight:1.5, fontFamily:'Inter,sans-serif' }}>"{q.text}"</div>
        <div style={{ fontSize:10, color:'#2a50d8', marginTop:4, letterSpacing:1, textTransform:'uppercase' }}>Padel Wisdom</div>
      </div>
    </div>
  );
}

function LevelPicker({ value, onChange, size=44 }) {
  return (
    <div>
      <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:10 }}>
        {LEVELS.map(l => (
          <button key={l} className={`level-btn${value===l?' active':''}`} onClick={() => onChange(l)} style={{ width:size, height:size, borderRadius:'50%', border:`2px solid ${value===l?LEVEL_COLORS[l]:'#2a3a2a'}`, background:value===l?LEVEL_COLORS[l]+'33':'#080e30', color:value===l?LEVEL_COLORS[l]:'#203888', fontFamily:'Inter,sans-serif', fontSize:size>40?17:14, fontWeight:800, cursor:'pointer' }}>{l}</button>
        ))}
      </div>
      <div style={{ textAlign:'center', fontSize:12, color:LEVEL_COLORS[value]||'#284898', fontWeight:600, fontFamily:'Inter,sans-serif', minHeight:20 }}>{LEVEL_LABELS[value]||''}</div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fade-up" style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', background:'#0a1540', border:`1px solid ${toast.color}`, color:toast.color, padding:'12px 24px', borderRadius:24, fontSize:14, zIndex:999, whiteSpace:'nowrap', boxShadow:`0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${toast.color}33`, display:'flex', alignItems:'center', gap:10, fontFamily:'Inter,sans-serif', fontWeight:600 }}>
      <span style={{ fontSize:20 }}>{toast.emoji}</span>
      {toast.msg}
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ background:'#080e30', border:'1px solid #121e60', borderRadius:10, padding:'10px 16px', textAlign:'center', flex:1 }}>
      <div style={{ fontSize:22, fontWeight:800, color:color||'#4a7aff', fontFamily:'Inter,sans-serif' }}>{value}</div>
      <div style={{ fontSize:10, color:'#1e3880', letterSpacing:1, textTransform:'uppercase', marginTop:2, fontFamily:'Inter,sans-serif' }}>{label}</div>
    </div>
  );
}

// ── Name Entry ────────────────────────────────────────────────────────────────

function NameEntry({ onEnter }) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState(3);
  const [qi] = useState(() => Math.floor(Math.random()*QUOTES.length));
  return (
    <div style={{ minHeight:'100vh', background:'radial-gradient(ellipse at top, #0a1628 0%, #040810 60%)', fontFamily:'Inter,sans-serif', color:'#f0ece0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32 }}>
      <style>{CSS}</style>

      {/* Decorative balls */}
      <div style={{ position:'fixed', top:40, left:40, fontSize:24, opacity:0.15, animation:'spin 20s linear infinite' }}>🎾</div>
      <div style={{ position:'fixed', top:80, right:60, fontSize:18, opacity:0.1, animation:'spin 15s linear infinite reverse' }}>🎾</div>
      <div style={{ position:'fixed', bottom:60, left:60, fontSize:20, opacity:0.1, animation:'spin 25s linear infinite' }}>🎾</div>
      <div style={{ position:'fixed', bottom:40, right:40, fontSize:28, opacity:0.12, animation:'spin 18s linear infinite reverse' }}>🎾</div>

      <div className="ball-bounce" style={{ fontSize:72, marginBottom:12 }}>🎾</div>
      <h1 style={{ margin:'0 0 6px', fontSize:56, fontWeight:900, letterSpacing:-1, color:'#e0eeff', textShadow:'0 0 40px rgba(74,122,255,0.4)' }}>Smash</h1>
      <p style={{ color:'#204090', marginBottom:8, fontSize:15, fontWeight:500 }}>Your padel group hub</p>

      <div style={{ background:'#091530', border:'1px solid #1e4a1e', borderRadius:10, padding:'8px 20px', marginBottom:32, fontSize:13, color:'#4a7aff', fontStyle:'italic', textAlign:'center', maxWidth:320, lineHeight:1.5 }}>
        "{QUOTES[qi].text}" {QUOTES[qi].emoji}
      </div>

      <div className="fade-up" style={{ width:'100%', maxWidth:360, background:'#070c22', border:'1px solid #121e60', borderRadius:20, padding:28, boxShadow:'0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:11, letterSpacing:2, color:'#203888', textTransform:'uppercase', display:'block', marginBottom:8, fontWeight:600 }}>Your Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&name.trim()&&onEnter(name.trim(),level)}
            placeholder="e.g. Massimo"
            style={{ width:'100%', background:'#080e30', border:'2px solid #121e60', color:'#f0ece0', fontFamily:'Inter,sans-serif', fontSize:18, fontWeight:600, padding:'12px 16px', borderRadius:10, boxSizing:'border-box' }} autoFocus />
        </div>
        <div style={{ marginBottom:24 }}>
          <label style={{ fontSize:11, letterSpacing:2, color:'#203888', textTransform:'uppercase', display:'block', marginBottom:14, fontWeight:600, textAlign:'center' }}>Your Level (1=Pro · 6=Newcomer)</label>
          <LevelPicker value={level} onChange={setLevel} />
        </div>
        <button className="btn-hover pulse-btn glow-green" onClick={()=>name.trim()&&onEnter(name.trim(),level)}
          style={{ width:'100%', background:'linear-gradient(135deg,#1a4a8a,#0f2a6a)', border:'none', color:'#c8deff', fontFamily:'Inter,sans-serif', fontSize:15, fontWeight:700, letterSpacing:1, padding:'14px 20px', cursor:'pointer', borderRadius:12, boxShadow:'0 4px 16px rgba(26,74,160,0.5)' }}>
          Enter Smash 🎾
        </button>
      </div>
    </div>
  );
}

// ── Input style ───────────────────────────────────────────────────────────────

const INP = { width:'100%', background:'#070c22', border:'1px solid #121e60', color:'#f0ece0', fontFamily:'Inter,sans-serif', fontSize:14, fontWeight:500, padding:'10px 12px', borderRadius:8, boxSizing:'border-box' };
const BTN = (c='#a8c8ff',bg='#101e58',b='#1a40d0') => ({ background:bg, border:`1px solid ${b}`, color:c, fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', padding:'9px 16px', cursor:'pointer', borderRadius:8, transition:'all 0.2s' });

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [currentUser, setCurrentUser] = useState(()=>localStorage.getItem('smash_name')||null);
  const [tab, setTab] = useState('Sessions');
  const [sessions, setSessions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newS, setNewS] = useState({ date:'',time:'',duration:'',spots:'',location_name:'',location_address:'' });
  const [viewMatches, setViewMatches] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [copied, setCopied] = useState({});
  const [newPlayer, setNewPlayer] = useState({ name:'',phone:'',level:3 });
  const [toast, setToast] = useState(null);

  const playerMap = {};
  players.forEach(p => { playerMap[p.name] = p; });

  const showToast = (msg, color='#4a7aff', emoji='🎾') => { setToast({msg,color,emoji}); setTimeout(()=>setToast(null),2500); };
  const copyText = (key,text) => { navigator.clipboard.writeText(text).then(()=>{ setCopied(s=>({...s,[key]:true})); setTimeout(()=>setCopied(s=>({...s,[key]:false})),2000); showToast('Copied!','#25d366','📋'); }); };

  const loadSessions = useCallback(async()=>{ const{data}=await supabase.from('sessions').select('*').order('created_at'); if(data)setSessions(data); },[]);
  const loadPlayers = useCallback(async()=>{ const{data}=await supabase.from('players').select('*').order('level'); if(data)setPlayers(data); },[]);

  useEffect(()=>{
    Promise.all([loadSessions(),loadPlayers()]).then(()=>setLoading(false));
    const s1=supabase.channel('sessions').on('postgres_changes',{event:'*',schema:'public',table:'sessions'},loadSessions).subscribe();
    const s2=supabase.channel('players').on('postgres_changes',{event:'*',schema:'public',table:'players'},loadPlayers).subscribe();
    return()=>{ supabase.removeChannel(s1); supabase.removeChannel(s2); };
  },[loadSessions,loadPlayers]);

  const handleEnter = async(name,level)=>{
    localStorage.setItem('smash_name',name); setCurrentUser(name);
    const exists=players.find(p=>p.name.toLowerCase()===name.toLowerCase());
    if(!exists) await supabase.from('players').insert({name,phone:'',level});
    else if(exists.level!==level) await supabase.from('players').update({level}).eq('id',exists.id);
  };

  const handleSignUp = async(session)=>{
    const signups=session.signups||[]; const waitlist=session.waitlist||[];
    const isFull=signups.length>=session.spots; const isIn=signups.includes(currentUser); const isWaiting=waitlist.includes(currentUser);
    let us=[...signups]; let uw=[...waitlist];
    if(isIn){ us=signups.filter(n=>n!==currentUser); if(uw.length>0){const next=uw.shift();us.push(next);showToast(`${next} moved from waitlist!`,'#ffd700','🎉');} showToast('Spot cancelled','#d87a7a','😢'); }
    else if(isWaiting){ uw=waitlist.filter(n=>n!==currentUser); showToast('Off the waitlist','#d8b84a','👋'); }
    else if(isFull){ uw=[...waitlist,currentUser]; showToast("You're on the waitlist! 🤞",'#d8b84a','⏳'); }
    else{ us=[...signups,currentUser]; showToast("You're in! Let's smash!",'#4a7aff','🔥'); }
    await supabase.from('sessions').update({signups:us,waitlist:uw}).eq('id',session.id);
    loadSessions();
  };

  const handleCreate = async()=>{
    if(!newS.date||!newS.time||!newS.duration||!newS.spots||!newS.location_name) return;
    await supabase.from('sessions').insert({date:newS.date,time:newS.time,duration:parseFloat(newS.duration),spots:parseInt(newS.spots),location_name:newS.location_name,location_address:newS.location_address,signups:[],waitlist:[],matches:null});
    setNewS({date:'',time:'',duration:'',spots:'',location_name:'',location_address:''}); setShowNew(false);
    showToast("Session created! Who's ready?",'#4a7aff','🏟️');
  };

  const handleGenMatches = async(session)=>{
    const matches=generateBalancedMatches(session.signups,playerMap);
    await supabase.from('sessions').update({matches}).eq('id',session.id);
    loadSessions(); setViewMatches(session.id);
    showToast('Balanced draw ready! 🏆','#ffd700','🏆');
  };

  const handleDeleteSession = async(id)=>{ await supabase.from('sessions').delete().eq('id',id); loadSessions(); };
  const handleAddPlayer = async()=>{
    if(!newPlayer.name.trim()) return;
    if(players.find(p=>p.name.toLowerCase()===newPlayer.name.trim().toLowerCase())){ showToast('Player already exists!','#d87a7a','⚠️'); return; }
    await supabase.from('players').insert({name:newPlayer.name.trim(),phone:newPlayer.phone.trim(),level:newPlayer.level||3});
    setNewPlayer({name:'',phone:'',level:3}); showToast('Player added!','#4a7aff','👋');
  };
  const handleRemovePlayer = async(id)=>{ await supabase.from('players').delete().eq('id',id); loadPlayers(); };
  const handleUpdateLevel = async(player,newLevel)=>{ await supabase.from('players').update({level:newLevel}).eq('id',player.id); loadPlayers(); showToast(`Level updated to ${LEVEL_LABELS[newLevel]}`,'#4a7aff','⭐'); };

  const matchSession = sessions.find(s=>s.id===viewMatches);
  if(!currentUser) return <NameEntry onEnter={handleEnter} players={players} />;

  const totalConfirmed = sessions.reduce((a,s)=>(s.signups||[]).includes(currentUser)?a+1:a,0);

  return (
    <div style={{ minHeight:'100vh', background:'radial-gradient(ellipse at top, #0a1628 0%, #040810 70%)', fontFamily:'Inter,sans-serif', color:'#f0ece0' }}>
      <style>{CSS}</style>
      <Toast toast={toast} />

      {/* Header */}
      <div style={{ background:'rgba(6,12,24,0.97)', borderBottom:'1px solid #101e58', backdropFilter:'blur(10px)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ maxWidth:600, margin:'0 auto', padding:'0 16px' }}>
          <div style={{ paddingTop:20, paddingBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:28 }}>🎾</span>
                <h1 style={{ fontSize:28, fontWeight:900, letterSpacing:-0.5, color:'#e0eeff', margin:0 }}>Smash</h1>
              </div>
              <div style={{ fontSize:11, color:'#1e3880', marginTop:2, letterSpacing:1 }}>{players.length} MEMBERS · {sessions.length} SESSIONS</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                <div style={{ background:'#0a1540', border:'1px solid #1a40d0', borderRadius:10, padding:'6px 12px' }}>
                  <div style={{ fontSize:11, color:'#204090', fontWeight:600 }}>Playing as</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:14, fontWeight:700, color:'#a8c8ff' }}>{currentUser}</span>
                    <LevelBadge level={playerMap[currentUser]?.level} />
                  </div>
                </div>
              </div>
              <button onClick={()=>{localStorage.removeItem('smash_name');setCurrentUser(null);}} style={{ background:'none',border:'none',color:'#1a2a70',fontSize:10,cursor:'pointer',marginTop:4,fontFamily:'Inter,sans-serif' }}>change →</button>
            </div>
          </div>
          <div style={{ display:'flex', gap:4 }}>
            {TABS.map(t=>(
              <button key={t} className={`tab-btn${tab===t?' active':''}`} onClick={()=>setTab(t)} style={{ background:'none', border:'none', color:tab===t?'#a8c8ff':'#1e3880', fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:tab===t?700:500, letterSpacing:1.5, textTransform:'uppercase', padding:'10px 16px 12px', cursor:'pointer' }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:600, margin:'0 auto', padding:'24px 16px' }}>
        {loading && (
          <div style={{ textAlign:'center', padding:64 }}>
            <div style={{ fontSize:40, animation:'spin 1s linear infinite', display:'inline-block' }}>🎾</div>
            <div style={{ color:'#1e3880', marginTop:12, fontSize:13, fontWeight:500 }}>Loading your courts...</div>
          </div>
        )}

        {/* ── SESSIONS TAB ── */}
        {!loading && tab==='Sessions' && (
          <div className="fade-up">
            <QuoteBanner />

            {/* Stats row */}
            <div style={{ display:'flex', gap:10, marginBottom:20 }}>
              <StatPill label="Sessions" value={sessions.length} color="#4a7aff" />
              <StatPill label="You've played" value={totalConfirmed} color="#7ab8d8" />
              <StatPill label="Members" value={players.length} color="#d8b84a" />
            </div>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ fontSize:18, fontWeight:800, color:'#c8deff', margin:0 }}>Upcoming Sessions</h2>
              <button className="btn-hover" onClick={()=>setShowNew(!showNew)}
                style={{ background:showNew?'#2a1a1a':'linear-gradient(135deg,#0f2a5a,#0a1a48)', border:`1px solid ${showNew?'#5a2a2a':'#1a4ad8'}`, color:showNew?'#d87a7a':'#a8c8ff', fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', padding:'9px 18px', cursor:'pointer', borderRadius:10 }}>
                {showNew?'✕ Cancel':'+ New Session'}
              </button>
            </div>

            {/* New session form */}
            {showNew && (
              <div className="slide-in" style={{ background:'#070c22', border:'1px solid #1e4a1e', borderRadius:16, padding:20, marginBottom:20, boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
                <div style={{ fontSize:12, fontWeight:700, letterSpacing:2, color:'#4a7aff', textTransform:'uppercase', marginBottom:16 }}>🏟️ New Session</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  {[{label:'Date',key:'date',type:'date'},{label:'Time',key:'time',type:'time'},{label:'Duration (h)',key:'duration',placeholder:'2',type:'number'},{label:'Spots',key:'spots',placeholder:'20',type:'number'}].map(f=>(
                    <div key={f.key}>
                      <label style={{ fontSize:10,letterSpacing:2,color:'#203888',textTransform:'uppercase',display:'block',marginBottom:6,fontWeight:600 }}>{f.label}</label>
                      <input type={f.type||'text'} value={newS[f.key]} placeholder={f.placeholder||''} onChange={e=>setNewS({...newS,[f.key]:e.target.value})} style={INP} />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:10,letterSpacing:2,color:'#203888',textTransform:'uppercase',display:'block',marginBottom:6,fontWeight:600 }}>Venue</label>
                  <input value={newS.location_name} placeholder="e.g. Padel Lisboa Court 1" onChange={e=>setNewS({...newS,location_name:e.target.value})} style={INP} />
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:10,letterSpacing:2,color:'#203888',textTransform:'uppercase',display:'block',marginBottom:6,fontWeight:600 }}>Address</label>
                  <input value={newS.location_address} placeholder="e.g. Av. da Liberdade 110" onChange={e=>setNewS({...newS,location_address:e.target.value})} style={INP} />
                </div>
                <button className="btn-hover" onClick={handleCreate}
                  style={{ background:'linear-gradient(135deg,#1a4a8a,#0f2a6a)', border:'none', color:'#c8deff', fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', padding:'12px 24px', cursor:'pointer', borderRadius:10, boxShadow:'0 4px 12px rgba(26,74,160,0.3)' }}>
                  Create Session 🎾
                </button>
              </div>
            )}

            {sessions.length===0 && (
              <div style={{ textAlign:'center', padding:'48px 24px', color:'#1e3880' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🏟️</div>
                <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>No sessions yet</div>
                <div style={{ fontSize:13 }}>Create your first session and get the squad together!</div>
              </div>
            )}

            {sessions.map((session,si) => {
              const signups=session.signups||[]; const waitlist=session.waitlist||[];
              const isFull=signups.length>=session.spots; const isIn=signups.includes(currentUser); const isWaiting=waitlist.includes(currentUser);
              const pct=Math.min(100,(signups.length/session.spots)*100);
              const unsigned=players.filter(p=>!signups.includes(p.name)&&!waitlist.includes(p.name));
              const panelOpen=openPanel?.id===session.id; const panelType=openPanel?.type;
              const groupUpdate=buildGroupUpdate(session,playerMap);
              const announceMsg=buildAnnounceMsg(session);

              return (
                <div key={session.id} className="card fade-up" style={{ background:'#070c22', border:'1px solid #101e58', borderRadius:16, marginBottom:16, overflow:'hidden', animationDelay:`${si*0.05}s` }}>
                  {/* Card header */}
                  <div style={{ background:'linear-gradient(135deg,#0d1e38,#080e1e)', padding:'16px 18px', borderBottom:'1px solid #101e58', position:'relative', overflow:'hidden' }}>
                    <div className="shimmer" style={{ position:'absolute', inset:0, pointerEvents:'none' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontSize:18, fontWeight:800, color:'#c8deff', letterSpacing:-0.3 }}>{formatDate(session.date)}</div>
                        <div style={{ fontSize:13, color:'#4a7ad8', marginTop:4, fontWeight:500 }}>{session.time} · {session.duration}h · {session.location_name}</div>
                        {session.location_address && <div style={{ fontSize:11, color:'#1a40d0', marginTop:2 }}>{session.location_address}</div>}
                      </div>
                      <div style={{ background:isFull?'#3a1a1a':'#0a2a80', border:`1px solid ${isFull?'#6a2a2a':'#2a7a2a'}`, color:isFull?'#ff7a7a':'#7ab8ff', fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', padding:'4px 10px', borderRadius:8, flexShrink:0 }}>
                        {isFull?'FULL':`${session.spots-signups.length} LEFT`}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding:'16px 18px' }}>
                    {/* Progress bar */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#1e3880', marginBottom:6, fontWeight:600 }}>
                        <span>{signups.length} confirmed</span><span>{session.spots} spots</span>
                      </div>
                      <div style={{ height:6, background:'#080e30', borderRadius:3, overflow:'hidden' }}>
                        <div className="progress-bar" style={{ height:'100%', width:`${pct}%`, background:isFull?'linear-gradient(90deg,#d87a7a,#ff5a5a)':'linear-gradient(90deg,#4a7aff,#7ab8ff)', borderRadius:3, boxShadow:isFull?'0 0 8px rgba(255,90,90,0.4)':'0 0 8px rgba(74,122,255,0.4)' }} />
                      </div>
                    </div>

                    {/* Confirmed players */}
                    {signups.length>0 && (
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:10,fontWeight:700,letterSpacing:2,color:'#2a50d8',textTransform:'uppercase',marginBottom:8 }}>✅ Confirmed ({signups.length})</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {signups.map((p,i)=>{
                            const pl=playerMap[p];
                            return (
                              <div key={p} className={p===currentUser?'glow-green':''} style={{ display:'flex', alignItems:'center', gap:8, background:p===currentUser?'#0a1540':'#06091e', border:`1px solid ${p===currentUser?'#1a40d0':'#0e1848'}`, borderRadius:8, padding:'8px 12px', transition:'all 0.2s' }}>
                                <span style={{ color:'#1a2a70', fontSize:11, fontWeight:700, minWidth:22 }}>{i+1}.</span>
                                <span style={{ flex:1, fontSize:13, fontWeight:p===currentUser?700:500, color:p===currentUser?'#a8c8ff':'#7a9a7a' }}>{p}{p===currentUser?' ★':''}</span>
                                <LevelBadge level={pl?.level} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Waitlist */}
                    {waitlist.length>0 && (
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:10,fontWeight:700,letterSpacing:2,color:'#6a5a2a',textTransform:'uppercase',marginBottom:6 }}>⏳ Waitlist ({waitlist.length})</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          {waitlist.map((p,i)=>{
                            const pl=playerMap[p];
                            return <span key={p} style={{ display:'flex',alignItems:'center',gap:5,background:'#1a150a',border:'1px solid #3a2a0a',color:'#c8a86a',fontSize:11,fontWeight:600,padding:'4px 10px',borderRadius:16 }}>#{i+1} {p} <LevelBadge level={pl?.level}/></span>;
                          })}
                        </div>
                      </div>
                    )}

                    {/* Not in */}
                    {unsigned.length>0 && (
                      <div style={{ marginBottom:16 }}>
                        <div style={{ fontSize:10,fontWeight:700,letterSpacing:2,color:'#3a2a2a',textTransform:'uppercase',marginBottom:6 }}>✗ Not in ({unsigned.length})</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                          {unsigned.map(p=>(
                            <span key={p.name} style={{ display:'flex',alignItems:'center',gap:4,background:'#130a0a',border:'1px solid #2a1a1a',color:'#5a3a3a',fontSize:11,padding:'3px 8px',borderRadius:14 }}>
                              {p.name} {p.level&&<LevelBadge level={p.level}/>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:panelOpen?12:0 }}>
                      <button className="btn-hover" onClick={()=>handleSignUp(session)} style={{ background:isIn?'#2a1a1a':isWaiting?'#1a150a':isFull?'#121212':'linear-gradient(135deg,#0f2a5a,#0a1a48)', border:`1px solid ${isIn?'#5a2a2a':isWaiting?'#4a3a0a':isFull?'#2a2a2a':'#1a4ad8'}`, color:isIn?'#ff7a7a':isWaiting?'#c8a86a':isFull?'#3a3a3a':'#a8c8ff', fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:700, letterSpacing:1, textTransform:'uppercase', padding:'10px 16px', cursor:isFull&&!isIn&&!isWaiting?'default':'pointer', borderRadius:10 }}>
                        {isIn?'✕ Cancel':isWaiting?'⏳ Leave Waitlist':isFull?'+ Join Waitlist':'✓ Sign Up'}
                      </button>
                      {signups.length>=4 && (
                        <button className="btn-hover" onClick={()=>session.matches?setViewMatches(session.id):handleGenMatches(session)}
                          style={{ background:'linear-gradient(135deg,#0f2060,#0a1050)', border:'1px solid #2a4a7a', color:'#7ab8d8', fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:700, letterSpacing:1, textTransform:'uppercase', padding:'10px 16px', cursor:'pointer', borderRadius:10 }}>
                          {session.matches?'🏆 View Draw':'🏆 Balance Teams'}
                        </button>
                      )}
                      <button className="btn-hover" onClick={()=>setOpenPanel(panelOpen&&panelType==='share'?null:{id:session.id,type:'share'})}
                        style={{ background:'#0a180a', border:`1px solid ${panelOpen&&panelType==='share'?'#25d366':'#101e58'}`, color:'#25d366', fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:700, letterSpacing:1, textTransform:'uppercase', padding:'10px 14px', cursor:'pointer', borderRadius:10 }}>
                        🔗 Share
                      </button>
                      <button className="btn-hover" onClick={()=>setOpenPanel(panelOpen&&panelType==='wa'?null:{id:session.id,type:'wa'})}
                        style={{ background:'#0a180a', border:`1px solid ${panelOpen&&panelType==='wa'?'#25d366':'#101e58'}`, color:'#25d366', fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:700, letterSpacing:1, textTransform:'uppercase', padding:'10px 14px', cursor:'pointer', borderRadius:10 }}>
                        📲 WA
                      </button>
                    </div>

                    {/* Share panel */}
                    {panelOpen && panelType==='share' && (
                      <div className="slide-in" style={{ background:'#05081a', border:'1px solid #25d36622', borderRadius:12, overflow:'hidden' }}>
                        <div style={{ padding:'10px 16px', borderBottom:'1px solid #0a1540', fontSize:10, fontWeight:700, letterSpacing:2, color:'#25d366', textTransform:'uppercase' }}>🔗 Share & Update</div>
                        <div style={{ padding:'14px 16px', borderBottom:'1px solid #080e28' }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'#a8c8ff', marginBottom:10 }}>
                            <span style={{ background:'#0a2a80', borderRadius:'50%', padding:'1px 7px', marginRight:8, fontSize:11, fontWeight:800 }}>1</span>
                            Post in your WhatsApp group
                          </div>
                          <div style={{ background:'#070c22', borderRadius:8, padding:'10px 12px', fontSize:11, color:'#204090', whiteSpace:'pre-wrap', lineHeight:1.8, marginBottom:10 }}>{announceMsg}</div>
                          <div style={{ display:'flex', gap:8 }}>
                            <button className="btn-hover" onClick={()=>copyText(`ann-${session.id}`,announceMsg)} style={{ background:'#0d1f0d', border:`1px solid ${copied[`ann-${session.id}`]?'#25d366':'#101e58'}`, color:copied[`ann-${session.id}`]?'#25d366':'#4a7ad8', fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', padding:'8px 14px', cursor:'pointer', borderRadius:8 }}>{copied[`ann-${session.id}`]?'✓ Copied!':'📋 Copy'}</button>
                            <a href={`https://wa.me/?text=${encodeURIComponent(announceMsg)}`} target="_blank" rel="noreferrer" style={{ background:'#0d1f0d', border:'1px solid #25d36644', color:'#25d366', fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', padding:'8px 14px', cursor:'pointer', borderRadius:8, textDecoration:'none', display:'inline-block' }}>📲 Open WA</a>
                          </div>
                        </div>
                        <div style={{ padding:'14px 16px' }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'#a8c8ff', marginBottom:10 }}>
                            <span style={{ background:'#0a2a80', borderRadius:'50%', padding:'1px 7px', marginRight:8, fontSize:11, fontWeight:800 }}>2</span>
                            Paste update back into the group
                          </div>
                          <div style={{ background:'#070c22', borderRadius:8, padding:'10px 12px', fontSize:11, color:'#203888', whiteSpace:'pre-wrap', lineHeight:1.8, marginBottom:10 }}>{groupUpdate}</div>
                          <div style={{ display:'flex', gap:8 }}>
                            <button className="btn-hover" onClick={()=>copyText(`upd-${session.id}`,groupUpdate)} style={{ background:'#0d1f0d', border:`1px solid ${copied[`upd-${session.id}`]?'#25d366':'#101e58'}`, color:copied[`upd-${session.id}`]?'#25d366':'#4a7ad8', fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', padding:'8px 14px', cursor:'pointer', borderRadius:8 }}>{copied[`upd-${session.id}`]?'✓ Copied!':'📋 Copy Update'}</button>
                            <a href={`https://wa.me/?text=${encodeURIComponent(groupUpdate)}`} target="_blank" rel="noreferrer" style={{ background:'#0d1f0d', border:'1px solid #25d36644', color:'#25d366', fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', padding:'8px 14px', cursor:'pointer', borderRadius:8, textDecoration:'none', display:'inline-block' }}>📲 Share WA</a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* WA panel */}
                    {panelOpen && panelType==='wa' && (
                      <div className="slide-in" style={{ background:'#05081a', border:'1px solid #25d36622', borderRadius:12, overflow:'hidden' }}>
                        <div style={{ padding:'10px 16px', borderBottom:'1px solid #0a1540', fontSize:10, fontWeight:700, letterSpacing:2, color:'#25d366', textTransform:'uppercase' }}>📲 Message Players</div>
                        {[
                          {icon:'📣',label:'Announce to All',color:'#4a7aff',people:players,msg:()=>buildAnnounceMsg(session),desc:`${players.length} members`},
                          {icon:'⏰',label:'Chase Unsigned',color:'#d8b84a',people:unsigned,msg:(p)=>`🎾 Hey ${p.name}! Still ${session.spots-signups.length} spots left for padel on *${formatDate(session.date)} at ${session.time}*.\n\n📍 ${session.location_name}\n\n👉 Sign up: ${window.location.origin}`,desc:`${unsigned.length} players`,disabled:unsigned.length===0},
                          {icon:'😔',label:'Notify Left Out',color:'#d87a7a',people:players.filter(p=>!signups.includes(p.name)&&!waitlist.includes(p.name)),msg:(p)=>`🎾 Hey ${p.name}, the session on *${formatDate(session.date)}* is now full. We'll get you next time! 🙏`,desc:`${players.filter(p=>!signups.includes(p.name)).length} players`,disabled:!isFull},
                          {icon:'🏆',label:'Send Draw',color:'#7ab8d8',people:players.filter(p=>signups.includes(p.name)),msg:()=>buildGroupUpdate(session,playerMap),desc:`${signups.length} confirmed`,disabled:!session.matches},
                        ].map(action=>(
                          <div key={action.label} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid #070c22',opacity:action.disabled?0.3:1 }}>
                            <div style={{ display:'flex',gap:12,alignItems:'center' }}>
                              <span style={{ fontSize:20 }}>{action.icon}</span>
                              <div><div style={{ fontSize:13,fontWeight:600,color:action.color }}>{action.label}</div><div style={{ fontSize:11,color:'#3a4a3a' }}>{action.desc}</div></div>
                            </div>
                            <button disabled={action.disabled} className="btn-hover" onClick={()=>{ if(action.disabled)return; action.people.forEach((p,i)=>{ if(!p.phone)return; const msg=typeof action.msg==='function'?action.msg(p):action.msg(); setTimeout(()=>window.open(waLink(p.phone,msg),'_blank'),i*350); }); showToast('Opening WhatsApp...','#25d366','📲'); }} style={{ background:'#0d1f0d',border:`1px solid ${action.disabled?'#1a1a1a':action.color+'44'}`,color:action.disabled?'#2a2a2a':action.color,fontFamily:'Inter,sans-serif',fontSize:11,fontWeight:700,letterSpacing:1,textTransform:'uppercase',padding:'8px 14px',cursor:action.disabled?'default':'pointer',borderRadius:8 }}>Send →</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop:12, textAlign:'right' }}>
                      <button onClick={()=>handleDeleteSession(session.id)} style={{ background:'none',border:'none',color:'#2a1a1a',fontSize:10,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500 }}>delete session</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PLAYERS TAB ── */}
        {!loading && tab==='Players' && (
          <div className="fade-up">
            <div style={{ background:'#070c22', border:'1px solid #101e58', borderRadius:16, padding:20, marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:700, letterSpacing:1.5, color:'#4a7aff', textTransform:'uppercase', marginBottom:16 }}>👋 Add Player</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                {[{label:'Name',key:'name',placeholder:'e.g. João'},{label:'WhatsApp',key:'phone',placeholder:'+351...'}].map(f=>(
                  <div key={f.key}>
                    <label style={{ fontSize:10,letterSpacing:2,color:'#203888',textTransform:'uppercase',display:'block',marginBottom:6,fontWeight:600 }}>{f.label}</label>
                    <input value={newPlayer[f.key]} onChange={e=>setNewPlayer({...newPlayer,[f.key]:e.target.value})} onKeyDown={e=>e.key==='Enter'&&handleAddPlayer()} placeholder={f.placeholder} style={INP} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:10,letterSpacing:2,color:'#203888',textTransform:'uppercase',display:'block',marginBottom:10,fontWeight:600 }}>Level (1=Pro · 6=Newcomer)</label>
                <LevelPicker value={newPlayer.level} onChange={l=>setNewPlayer({...newPlayer,level:l})} size={38} />
              </div>
              <button className="btn-hover" onClick={handleAddPlayer}
                style={{ background:'linear-gradient(135deg,#0f2a5a,#0a1a48)', border:'none', color:'#c8deff', fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', padding:'10px 20px', cursor:'pointer', borderRadius:10, boxShadow:'0 4px 12px rgba(26,74,160,0.3)' }}>
                Add Player 👋
              </button>
            </div>

            <div style={{ fontSize:14, fontWeight:700, color:'#c8deff', marginBottom:12 }}>Members ({players.length})</div>

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {players.map((p,i)=>(
                <div key={p.id||p.name} className="card" style={{ background:p.name===currentUser?'#0a1f0a':'#06091e', border:`1px solid ${p.name===currentUser?'#1a40d0':'#0e1848'}`, borderRadius:12, padding:'14px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg,hsl(${(i*67)%360},50%,25%),hsl(${(i*67+40)%360},50%,18%))`, border:`2px solid hsl(${(i*67)%360},50%,35%)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:`hsl(${(i*67)%360},70%,70%)`, flexShrink:0 }}>{p.name[0]}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:14, fontWeight:p.name===currentUser?700:500, color:p.name===currentUser?'#a8c8ff':'#7a9a7a' }}>{p.name}</span>
                        {p.name===currentUser && <span style={{ fontSize:9, fontWeight:700, letterSpacing:1, color:'#2a50d8', background:'#0a1540', border:'1px solid #1a40d0', padding:'1px 6px', borderRadius:6 }}>YOU</span>}
                        <LevelBadge level={p.level} />
                      </div>
                      <div style={{ fontSize:11, color:'#1a2a70', marginTop:2 }}>{p.phone||'no number'}{p.level?` · ${LEVEL_LABELS[p.level]}`:''}</div>
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      {p.phone && <a href={waLink(p.phone,'Hey! 🎾')} target="_blank" rel="noreferrer" style={{ fontSize:16, textDecoration:'none', opacity:0.5 }}>💬</a>}
                      {p.name!==currentUser && <button onClick={()=>handleRemovePlayer(p.id)} style={{ background:'none',border:'none',color:'#2a1a1a',cursor:'pointer',fontSize:14,fontWeight:700 }}>✕</button>}
                    </div>
                  </div>
                  {p.name===currentUser && (
                    <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #101e58' }}>
                      <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, color:'#1e3880', textTransform:'uppercase', marginBottom:10 }}>Update Your Level</div>
                      <div style={{ display:'flex', gap:6 }}>
                        {LEVELS.map(l=>(
                          <button key={l} className="level-btn btn-hover" onClick={()=>handleUpdateLevel(p,l)} style={{ width:36, height:36, borderRadius:'50%', border:`2px solid ${p.level===l?LEVEL_COLORS[l]:'#0e1848'}`, background:p.level===l?LEVEL_COLORS[l]+'33':'#06091e', color:p.level===l?LEVEL_COLORS[l]:'#3a4a3a', fontFamily:'Inter,sans-serif', fontSize:13, fontWeight:800, cursor:'pointer' }}>{l}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ABOUT TAB ── */}
        {!loading && tab==='About' && (
          <div className="fade-up">
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div className="ball-bounce" style={{ fontSize:56, marginBottom:8 }}>🎾</div>
              <h2 style={{ fontSize:28, fontWeight:900, color:'#c8deff', margin:'0 0 8px', letterSpacing:-0.5 }}>Smash</h2>
              <p style={{ color:'#204090', fontSize:14 }}>Your padel group's coordination hub</p>
            </div>

            <QuoteBanner />

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                ['🎯','Player Levels','Rate yourself 1-6 (1=Pro, 6=Newcomer). Teams are balanced by level so every court is competitive and fun.'],
                ['⚡','Live Data','Everyone sees the same sign-up list in real time. No more "am I in?" messages.'],
                ['⏳','Smart Waitlist','Session full? Join the waitlist. Cancel a spot and the next person moves in automatically.'],
                ['🏆','Balanced Draw','Teams are matched by skill level. Better players against better players, beginners together.'],
                ['🔗','WhatsApp First','Share the link in your group, copy the player list back. Built for how you already communicate.'],
              ].map(([icon,title,desc])=>(
                <div key={title} className="card" style={{ background:'#070c22', border:'1px solid #101e58', borderRadius:14, padding:16, display:'flex', gap:14, alignItems:'flex-start' }}>
                  <div style={{ fontSize:28, flexShrink:0 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#a8c8ff', marginBottom:4 }}>{title}</div>
                    <div style={{ fontSize:13, color:'#203888', lineHeight:1.6 }}>{desc}</div>
                  </div>
                </div>
              ))}

              <div style={{ background:'linear-gradient(135deg,#0d1e38,#080e1e)', border:'1px solid #1a40d0', borderRadius:14, padding:16, marginTop:4 }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:'#2850a8', textTransform:'uppercase', marginBottom:12 }}>Level Guide</div>
                {LEVELS.map(l=>(
                  <div key={l} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <LevelBadge level={l} />
                    <span style={{ fontSize:13, color:LEVEL_COLORS[l], fontWeight:600 }}>{LEVEL_LABELS[l]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Matches Modal ── */}
      {viewMatches && matchSession && (
        <div className="fade-in" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16, backdropFilter:'blur(4px)' }} onClick={()=>setViewMatches(null)}>
          <div className="fade-up" style={{ background:'#070c22', border:'1px solid #1a40d0', borderRadius:20, padding:24, maxWidth:440, width:'100%', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(0,0,0,0.8)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:3, color:'#2a50d8', textTransform:'uppercase', marginBottom:6 }}>Balanced Draw 🏆</div>
              <div style={{ fontSize:20, fontWeight:800, color:'#c8deff' }}>{formatDate(matchSession.date)}</div>
              <div style={{ fontSize:13, color:'#204090', marginTop:4 }}>{matchSession.time} · {matchSession.location_name}</div>
            </div>
            {matchSession.matches && matchSession.matches.map((m,i)=>(
              <div key={i} style={{ background:'#0f1f0f', border:'1px solid #1e3e1e', borderRadius:14, padding:16, marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:'#2a50d8', textTransform:'uppercase', marginBottom:12, textAlign:'center' }}>{m.court}</div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ flex:1 }}>
                    {m.team1.map(p=>(
                      <div key={p} style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6, marginBottom:6 }}>
                        <span style={{ color:'#a8c8ff', fontSize:14, fontWeight:600 }}>{p}</span>
                        <LevelBadge level={playerMap[p]?.level} />
                      </div>
                    ))}
                  </div>
                  <div style={{ background:'#101e58', color:'#4a7ad8', fontSize:11, fontWeight:800, letterSpacing:2, padding:'6px 10px', borderRadius:8, flexShrink:0 }}>VS</div>
                  <div style={{ flex:1 }}>
                    {m.team2.map(p=>(
                      <div key={p} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                        <LevelBadge level={playerMap[p]?.level} />
                        <span style={{ color:'#d8b8a8', fontSize:14, fontWeight:600 }}>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button className="btn-hover" onClick={()=>handleGenMatches(matchSession)} style={{ flex:1, background:'linear-gradient(135deg,#0f2060,#0a1050)', border:'1px solid #2a4a7a', color:'#7ab8d8', fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:700, letterSpacing:1, textTransform:'uppercase', padding:'12px', cursor:'pointer', borderRadius:10 }}>↺ Re-balance</button>
              <button className="btn-hover" onClick={()=>setViewMatches(null)} style={{ flex:1, background:'#080e30', border:'1px solid #2a3a2a', color:'#284898', fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:700, letterSpacing:1, textTransform:'uppercase', padding:'12px', cursor:'pointer', borderRadius:10 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
