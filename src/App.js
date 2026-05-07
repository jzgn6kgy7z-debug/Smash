import{useState,useEffect,useCallback}from'react';
import{supabase}from'./supabase';
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
function generateMatches(n){const s=shuffle(n);const m=[];for(let i=0;i<s.length;i+=4){if(i+3<s.length)m.push({court:'Court '+(m.length+1),team1:[s[i],s[i+1]],team2:[s[i+2],s[i+3]]})}return m}
function buildUpdate(session){const isFull=session.signups.length>=session.spots;const inList=session.signups.map((n,i)=>(i+1)+'. '+n).join('\n');const link=window.location.href;return'🎾 *Smash — '+session.date+' at '+session.time+'*\n📍 '+session.location_name+'\n\n✅ *Confirmed ('+session.signups.length+'/'+session.spots+'):*\n'+(inList||'—')+'\n\n'+(isFull?'🔴 *Session FULL*':'🟡 *'+(session.spots-session.signups.length)+' spots left*\n👉 '+link)}
export default function App(){
const[currentUser,setCurrentUser]=useState(()=>localStorage.getItem('smash_name')||null);
const[nameInput,setNameInput]=useState('');
const[tab,setTab]=useState('Sessions');
const[sessions,setSessions]=useState([]);
const[players,setPlayers]=useState([]);
const[loading,setLoading]=useState(true);
const[showNew,setShowNew]=useState(false);
const[newS,setNewS]=useState({date:'',time:'',duration:'',spots:'',location_name:'',location_address:''});
const[viewMatches,setViewMatches]=useState(null);
const[openPanel,setOpenPanel]=useState(null);
const[copied,setCopied]=useState({});
const[newPlayer,setNewPlayer]=useState({name:'',phone:''});
const[toast,setToast]=useState(null);
const showToast=(msg,color)=>{setToast({msg,color:color||'#7ab87a'});setTimeout(()=>setToast(null),2500)};
const copyText=(key,text)=>{navigator.clipboard.writeText(text).then(()=>{setCopied(s=>({...s,[key]:true}));setTimeout(()=>setCopied(s=>({...s,[key]:false})),2000);showToast('Copied!')})};
const loadSessions=useCallback(async()=>{const{data}=await supabase.from('sessions').select('*').order('created_at');if(data)setSessions(data)},[]);
const loadPlayers=useCallback(async()=>{const{data}=await supabase.from('players').select('*').order('name');if(data)setPlayers(data)},[]);
useEffect(()=>{Promise.all([loadSessions(),loadPlayers()]).then(()=>setLoading(false));const s1=supabase.channel('s1').on('postgres_changes',{event:'*',schema:'public',table:'sessions'},loadSessions).subscribe();const s2=supabase.channel('s2').on('postgres_changes',{event:'*',schema:'public',table:'players'},loadPlayers).subscribe();return()=>{supabase.removeChannel(s1);supabase.removeChannel(s2)}},[loadSessions,loadPlayers]);
const handleEnter=async name=>{localStorage.setItem('smash_name',name);setCurrentUser(name);const exists=players.find(p=>p.name.toLowerCase()===name.toLowerCase());if(!exists)await supabase.from('players').insert({name,phone:''})};
const handleSignUp=async session=>{const signups=session.signups||[];const waitlist=session.waitlist||[];const isFull=signups.length>=session.spots;const isIn=signups.includes(currentUser);const isWaiting=waitlist.includes(currentUser);let us=[...signups];let uw=[...waitlist];if(isIn){us=signups.filter(n=>n!==currentUser);if(uw.length>0){const next=uw.shift();us.push(next)}showToast('Cancelled.')}else if(isWaiting){uw=waitlist.filter(n=>n!==currentUser);showToast('Removed from waitlist.')}else if(isFull){uw=[...waitlist,currentUser];showToast("You're on the waitlist! ⏳",'#d8b84a')}else{us=[...signups,currentUser];showToast("You're in! 🎾")}await supabase.from('sessions').update({signups:us,waitlist:uw}).eq('id',session.id);loadSessions()};
const handleCreate=async()=>{if(!newS.date||!newS.time||!newS.duration||!newS.spots||!newS.location_name)return;await supabase.from('sessions').insert({date:newS.date,time:newS.time,duration:parseFloat(newS.duration),spots:parseInt(newS.spots),location_name:newS.location_name,location_address:newS.location_address,signups:[],waitlist:[],matches:null});setNewS({date:'',time:'',duration:'',spots:'',location_name:'',location_address:''});setShowNew(false);showToast('Session created! 🎾')};
const handleGenMatches=async session=>{const matches=generateMatches(session.signups);await supabase.from('sessions').update({matches}).eq('id',session.id);loadSessions();setViewMatches(session.id)};
const handleDeleteSession=async id=>{await supabase.from('sessions').delete().eq('id',id);loadSessions()};
const handleAddPlayer=async()=>{if(!newPlayer.name.trim())return;await supabase.from('players').insert({name:newPlayer.name.trim(),phone:newPlayer.phone.trim()});setNewPlayer({name:'',phone:''});showToast('Player added!')};
const matchSession=sessions.find(s=>s.id===viewMatches);
const inp={width:'100%',background:'#111',border:'1px solid #2a4a2a',color:'#f0ece0',fontFamily:'inherit',fontSize:14,padding:'10px 12px',borderRadius:4,boxSizing:'border-box',outline:'none'};
const btn=(c,bg,b)=>({background:bg||'#2a5a2a',border:'1px solid '+(b||'#4a8a4a'),color:c||'#a8d8a8',fontFamily:'inherit',fontSize:12,letterSpacing:2,textTransform:'uppercase',padding:'9px 16px',cursor:'pointer',borderRadius:4});
if(!currentUser)return(<div style={{minHeight:'100vh',background:'#0a0a0a',fontFamily:'Georgia,serif',color:'#f0ece0',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32}}><div style={{fontSize:48,marginBottom:16}}>🎾</div><h1 style={{margin:0,fontSize:38,fontWeight:400,letterSpacing:3,color:'#e8f5e8',marginBottom:8}}>Smash</h1><p style={{color:'#5a7a5a',marginBottom:32,textAlign:'center'}}>Enter your name to join</p><div style={{width:'100%',maxWidth:320}}><input value={nameInput} onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&nameInput.trim()&&handleEnter(nameInput.trim())} placeholder="Your name..." style={{width:'100%',background:'#1a1a1a',border:'1px solid #2a4a2a',color:'#f0ece0',fontFamily:'inherit',fontSize:18,padding:'14px 16px',borderRadius:4,boxSizing:'border-box',outline:'none',marginBottom:12,textAlign:'center'}}/><button onClick={()=>nameInput.trim()&&handleEnter(nameInput.trim())} style={{width:'100%',background:'#2a5a2a',border:'1px solid #4a8a4a',color:'#a8d8a8',fontFamily:'inherit',fontSize:14,letterSpacing:2,textTransform:'uppercase',padding:12,cursor:'pointer',borderRadius:4}}>Enter Smash →</button></div></div>);
return(<div style={{minHeight:'100vh',background:'#0a0a0a',fontFamily:'Georgia,serif',color:'#f0ece0'}}>
{toast&&<div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',background:'#1a3a1a',border:'1px solid '+toast.color,color:toast.color,padding:'10px 20px',borderRadius:20,fontSize:13,zIndex:200,whiteSpace:'nowrap'}}>{toast.msg}</div>}
<div style={{background:'linear-gradient(135deg,#1a3a1a,#0d1f0d,#0a0a0a)',borderBottom:'1px solid #2a4a2a',padding:'0 16px'}}>
<div style={{maxWidth:600,margin:'0 auto'}}>
<div style={{paddingTop:24,paddingBottom:8,display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
<div><div style={{fontSize:10,letterSpacing:5,color:'#7ab87a',textTransform:'uppercase'}}>◆ Padel Hub</div><h1 style={{margin:0,fontSize:36,fontWeight:400,letterSpacing:3,color:'#e8f5e8'}}>Smash</h1><div style={{fontSize:12,color:'#5a7a5a'}}>{players.length} members · {sessions.length} sessions</div></div>
<div style={{textAlign:'right'}}><div style={{fontSize:11,color:'#5a7a5a'}}>Playing as</div><div style={{fontSize:14,color:'#a8d8a8'}}>{currentUser}</div><button onClick={()=>{localStorage.removeItem('smash_name');setCurrentUser(null)}} style={{background:'none',border:'none',color:'#3a5a3a',fontSize:10,cursor:'pointer',padding:0}}>change</button></div>
</div>
<div style={{display:'flex'}}>
{['Sessions','Players'].map(t=><button key={t} onClick={()=>setTab(t)} style={{background:'none',border:'none',borderBottom:tab===t?'2px solid #7ab87a':'2px solid transparent',color:tab===t?'#a8d8a8':'#5a7a5a',fontFamily:'inherit',fontSize:13,letterSpacing:2,textTransform:'uppercase',padding:'10px 16px 8px',cursor:'pointer'}}>{t}</button>)}
</div></div></div>
<div style={{maxWidth:600,margin:'0 auto',padding:'24px 16px'}}>
{loading&&<div style={{textAlign:'center',color:'#3a5a3a',padding:48}}>Loading...</div>}
{!loading&&tab==='Sessions'&&<div>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
<h2 style={{margin:0,fontSize:18,fontWeight:400,color:'#c8e6c8'}}>Sessions</h2>
<button onClick={()=>setShowNew(!showNew)} style={btn('#a8d8a8',showNew?'#1a3a1a':'#2a5a2a','#4a7a4a')}>{showNew?'✕ Cancel':'+ New'}</button>
</div>
{showNew&&<div style={{background:'#111',border:'1px solid #2a4a2a',borderRadius:6,padding:20,marginBottom:20}}>
<div style={{fontSize:11,letterSpacing:3,color:'#7ab87a',textTransform:'uppercase',marginBottom:14}}>New Session</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
{[{l:'Date',k:'date',p:'Friday May 23'},{l:'Time',k:'time',t:'time'},{l:'Duration (h)',k:'duration',p:'2',t:'number'},{l:'Spots',k:'spots',p:'20',t:'number'}].map(f=><div key={f.k}><div style={{fontSize:10,letterSpacing:2,color:'#5a7a5a',textTransform:'uppercase',marginBottom:4}}>{f.l}</div><input type={f.t||'text'} value={newS[f.k]} placeholder={f.p||''} onChange={e=>setNewS({...newS,[f.k]:e.target.value})} style={inp}/></div>)}
</div>
<div style={{marginBottom:10}}><div style={{fontSize:10,letterSpacing:2,color:'#5a7a5a',textTransform:'uppercase',marginBottom:4}}>Venue</div><input value={newS.location_name} placeholder="e.g. Padel Lisboa Court 1" onChange={e=>setNewS({...newS,location_name:e.target.value})} style={inp}/></div>
<div style={{marginBottom:14}}><div style={{fontSize:10,letterSpacing:2,color:'#5a7a5a',textTransform:'uppercase',marginBottom:4}}>Address</div><input value={newS.location_address} placeholder="e.g. Av. da Liberdade 110" onChange={e=>setNewS({...newS,location_address:e.target.value})} style={inp}/></div>
<button onClick={handleCreate} style={btn()}>Create Session</button>
</div>}
{sessions.length===0&&<div style={{textAlign:'center',color:'#3a5a3a',padding:48}}>No sessions yet!</div>}
{sessions.map(session=>{
const signups=session.signups||[];const waitlist=session.waitlist||[];const isFull=signups.length>=session.spots;const isIn=signups.includes(currentUser);const isWaiting=waitlist.includes(currentUser);const pct=Math.min(100,(signups.length/session.spots)*100);const unsigned=players.filter(p=>!signups.includes(p.name)&&!waitlist.includes(p.name));const panelOpen=openPanel===session.id;const updateMsg=buildUpdate(session);const announceMsg='🎾 *Smash!*\n\n📅 '+session.date+' at '+session.time+'\n⏱ '+session.duration+'h\n📍 '+session.location_name+'\n\n✅ '+(session.spots-signups.length)+' spots left\n\n👉 '+window.location.href;
return(<div key={session.id} style={{background:'#0f1a0f',border:'1px solid #1e3a1e',borderRadius:6,marginBottom:16,overflow:'hidden'}}>
<div style={{background:'linear-gradient(90deg,#1a3a1a,#0f1a0f)',padding:'14px 16px',borderBottom:'1px solid #1e3a1e',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
<div><div style={{fontSize:17,color:'#c8e6c8'}}>{session.date}</div><div style={{fontSize:13,color:'#7ab87a',marginTop:3}}>{session.time} · {session.duration}h · {session.location_name}</div>{session.location_address&&<div style={{fontSize:11,color:'#3a5a3a',marginTop:2}}>{session.location_address}</div>}</div>
<div style={{background:isFull?'#3a1a1a':'#1a3a1a',border:'1px solid '+(isFull?'#5a2a2a':'#3a6a3a'),color:isFull?'#d87a7a':'#7ab87a',fontSize:10,letterSpacing:2,textTransform:'uppercase',padding:'3px 8px',borderRadius:3}}>{isFull?'Full':(session.spots-signups.length)+' left'}</div>
</div>
<div style={{padding:'14px 16px'}}>
<div style={{marginBottom:14}}><div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#4a6a4a',marginBottom:4}}><span>{signups.length} confirmed</span><span>{session.spots} spots</span></div><div style={{height:3,background:'#1a2a1a',borderRadius:2}}><div style={{height:'100%',width:pct+'%',background:isFull?'#d87a7a':'#4a8a4a',borderRadius:2}}/></div></div>
{signups.length>0&&<div style={{marginBottom:10}}><div style={{fontSize:10,letterSpacing:2,color:'#4a6a4a',textTransform:'uppercase',marginBottom:6}}>✅ In ({signups.length})</div><div style={{display:'flex',flexWrap:'wrap',gap:5}}>{signups.map(p=><span key={p} style={{background:p===currentUser?'#2a5a2a':'#131f13',border:'1px solid '+(p===currentUser?'#4a8a4a':'#1e3a1e'),color:p===currentUser?'#a8d8a8':'#6a8a6a',fontSize:11,padding:'3px 10px',borderRadius:20}}>{p}{p===currentUser?' ★':''}</span>)}</div></div>}
{waitlist.length>0&&<div style={{marginBottom:10}}><div style={{fontSize:10,letterSpacing:2,color:'#6a5a3a',textTransform:'uppercase',marginBottom:6}}>⏳ Waitlist</div><div style={{display:'flex',flexWrap:'wrap',gap:5}}>{waitlist.map((p,i)=><span key={p} style={{background:'#2a1a0a',border:'1px solid #4a3a1a',color:'#c8a86a',fontSize:11,padding:'3px 10px',borderRadius:20}}>{'#'+(i+1)+' '+p}</span>)}</div></div>}
{unsigned.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:10,letterSpacing:2,color:'#4a3a3a',textTransform:'uppercase',marginBottom:6}}>✗ Not in ({unsigned.length})</div><div style={{display:'flex',flexWrap:'wrap',gap:5}}>{unsigned.map(p=><span key={p.name} style={{background:'#1a1010',border:'1px solid #2a1a1a',color:'#5a4a4a',fontSize:11,padding:'3px 9px',borderRadius:20}}>{p.name}</span>)}</div></div>}
<div style={{display:'flex',flexWrap:'wrap',gap:8}}>
<button onClick={()=>handleSignUp(session)} style={btn(isIn?'#d87a7a':isWaiting?'#c8a86a':isFull?'#5a5a5a':'#a8d8a8',isIn?'#3a1a1a':isWaiting?'#2a1a0a':isFull?'#1a1a1a':'#2a5a2a',isIn?'#5a2a2a':isWaiting?'#4a3a1a':isFull?'#2a2a2a':'#4a8a4a')}>{isIn?'✕ Cancel':isWaiting?'⏳ Leave Waitlist':isFull?'+ Join Waitlist':'✓ Sign Up'}</button>
{signups.length>=4&&<button onClick={()=>session.matches?setViewMatches(session.id):handleGenMatches(session)} style={btn('#7ab8d8','#1a2a3a','#2a4a6a')}>{session.matches?'🏆 View Draw':'🏆 Draw'}</button>}
<button onClick={()=>setOpenPanel(panelOpen?null:session.id)} style={btn('#25d366','#0a1a0a',panelOpen?'#25d366':'#25d36633')}>🔗 Share</button>
</div>
{panelOpen&&<div style={{marginTop:14,background:'#060f06',border:'1px solid #25d36633',borderRadius:6,overflow:'hidden'}}>
<div style={{padding:'10px 14px',borderBottom:'1px solid #0f2a0f',fontSize:10,letterSpacing:3,color:'#25d366',textTransform:'uppercase'}}>🔗 Share and Update</div>
<div style={{padding:'12px 14px',borderBottom:'1px solid #0f2a0f'}}>
<div style={{fontSize:12,color:'#a8d8a8',marginBottom:8}}>1. Post in your WhatsApp group</div>
<div style={{background:'#0a140a',borderRadius:4,padding:'8px 10px',fontSize:11,color:'#4a7a4a',whiteSpace:'pre-wrap',lineHeight:1.7,marginBottom:8}}>{announceMsg}</div>
<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
<button onClick={()=>copyText('ann-'+session.id,announceMsg)} style={btn(copied['ann-'+session.id]?'#25d366':'#5a9a5a','#0d200d','#25d36655')}>{copied['ann-'+session.id]?'Copied!':'Copy'}</button>
<a href={'https://wa.me/?text='+encodeURIComponent(announceMsg)} target="_blank" rel="noreferrer" style={{...btn('#25d366','#0d200d','#25d36655'),textDecoration:'none'}}>Open WA</a>
</div></div>
<div style={{padding:'12px 14px'}}>
<div style={{fontSize:12,color:'#a8d8a8',marginBottom:8}}>2. Paste update back into group</div>
<div style={{background:'#0a140a',borderRadius:4,padding:'8px 10px',fontSize:11,color:'#5a7a5a',whiteSpace:'pre-wrap',lineHeight:1.7,marginBottom:8}}>{updateMsg}</div>
<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
<button onClick={()=>copyText('upd-'+session.id,updateMsg)} style={btn(copied['upd-'+session.id]?'#25d366':'#5a9a5a','#0d200d','#25d36655')}>{copied['upd-'+session.id]?'Copied!':'Copy Update'}</button>
<a href={'https://wa.me/?text='+encodeURIComponent(updateMsg)} target="_blank" rel="noreferrer" style={{...btn('#25d366','#0d200d','#25d36655'),textDecoration:'none'}}>Share WA</a>
</div></div>
</div>}
<div style={{marginTop:12,textAlign:'right'}}><button onClick={()=>handleDeleteSession(session.id)} style={{background:'none',border:'none',color:'#3a2a2a',fontSize:10,cursor:'pointer'}}>delete</button></div>
</div></div>)}
</div>}
{!loading&&tab==='Players'&&<div>
<h2 style={{margin:'0 0 20px',fontSize:18,fontWeight:400,color:'#c8e6c8'}}>Members ({players.length})</h2>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
{[{l:'Name',k:'name',p:'e.g. João'},{l:'WhatsApp',k:'phone',p:'+351...'}].map(f=><div key={f.k}><div style={{fontSize:10,letterSpacing:2,color:'#5a7a5a',textTransform:'uppercase',marginBottom:4}}>{f.l}</div><input value={newPlayer[f.k]} onChange={e=>setNewPlayer({...newPlayer,[f.k]:e.target.value})} onKeyDown={e=>e.key==='Enter'&&handleAddPlayer()} placeholder={f.p} style={inp}/></div>)}
</div>
<button onClick={handleAddPlayer} style={{...btn(),marginBottom:20}}>Add Player</button>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
{players.map((p,i)=><div key={p.id||p.name} style={{background:p.name===currentUser?'#1a3a1a':'#0f1a0f',border:'1px solid '+(p.name===currentUser?'#3a6a3a':'#1e3a1e'),borderRadius:4,padding:'10px 12px',display:'flex',alignItems:'center',gap:8}}>
<div style={{width:28,height:28,borderRadius:'50%',background:'hsl('+(i*47%360)+',40%,20%)',border:'1px solid hsl('+(i*47%360)+',40%,36%)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'hsl('+(i*47%360)+',60%,65%)',flexShrink:0}}>{p.name[0]}</div>
<div style={{flex:1,minWidth:0}}><div style={{fontSize:13,color:p.name===currentUser?'#a8d8a8':'#8aaa8a'}}>{p.name}{p.name===currentUser?' ★':''}</div><div style={{fontSize:10,color:'#3a5a3a'}}>{p.phone||'no number'}</div></div>
{p.phone&&<a href={'https://wa.me/'+p.phone.replace(/\D/g,'')+'?text='+encodeURIComponent('Hey! 🎾')} target="_blank" rel="noreferrer" style={{fontSize:14,textDecoration:'none',opacity:0.5}}>💬</a>}
</div>)}
</div></div>}
</div>
{viewMatches&&matchSession&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:16}} onClick={()=>setViewMatches(null)}>
<div style={{background:'#0f1a0f',border:'1px solid #2a5a2a',borderRadius:8,padding:24,maxWidth:440,width:'100%',maxHeight:'85vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
<div style={{fontSize:10,letterSpacing:4,color:'#5a8a5a',textTransform:'uppercase',marginBottom:4}}>First Round Draw</div>
<div style={{fontSize:18,color:'#c8e6c8',marginBottom:2}}>{matchSession.date}</div>
<div style={{fontSize:12,color:'#5a7a5a',marginBottom:20}}>{matchSession.time} · {matchSession.location_name}</div>
{matchSession.matches&&matchSession.matches.map((m,i)=><div key={i} style={{background:'#131f13',border:'1px solid #1e3a1e',borderRadius:6,padding:14,marginBottom:10}}>
<div style={{fontSize:10,letterSpacing:2,color:'#4a6a4a',textTransform:'uppercase',marginBottom:8}}>{m.court}</div>
<div style={{display:'flex',alignItems:'center',gap:10}}>
<div style={{flex:1,textAlign:'center'}}>{m.team1.map(p=><div key={p} style={{color:'#a8d8a8',fontSize:14,padding:'2px 0'}}>{p}</div>)}</div>
<div style={{color:'#3a5a3a',fontSize:11,letterSpacing:2}}>VS</div>
<div style={{flex:1,textAlign:'center'}}>{m.team2.map(p=><div key={p} style={{color:'#d8b8a8',fontSize:14,padding:'2px 0'}}>{p}</div>)}</div>
</div></div>)}
<div style={{display:'flex',gap:8,marginTop:12}}>
<button onClick={()=>handleGenMatches(matchSession)} style={btn('#7ab8d8','#1a2a3a','#2a4a6a')}>Reshuffle</button>
<button onClick={()=>setViewMatches(null)} style={btn('#5a7a5a','none','#2a4a2a')}>Close</button>
</div></div></div>}
</div>);}
