// Probe: what happens around each Ascension's Sacrifice (81076) cast in raw logs
const fs=require('fs'),path=require('path');const {parseEvtc}=require('./evtc');
const dir=path.join(__dirname,'..','logs','raw');const cnt={};let casts=0;
for(const f of fs.readdirSync(dir).slice(0,12)){const {agents,skills,ev}=parseEvtc(path.join(dir,f));const s9=ev.find(e=>e.sc===9);if(!s9)continue;const t0=s9.t;
 const boss=[...agents.values()].find(a=>a.species===28106);if(!boss)continue;const isP=a=>agents.get(a)?.isPlayer;
 for(const c of ev.filter(e=>e.src===boss.addr&&e.sc===67&&e.skill===81076)){casts++;const seen=new Set();
  for(const e of ev){const d=e.t-c.t;if(d<-5000||d>200)continue;
   if(e.sc===62&&isP(e.dst)&&!isP(e.src)){const k='agentFx '+e.skill;if(!seen.has(k)){seen.add(k);(cnt[k]=cnt[k]||[]).push(d);}}
   if(e.sc===69&&isP(e.dst)&&!isP(e.src)&&e.skill>70000){const k='buff '+e.skill+' '+(skills.get(e.skill)||'');if(!seen.has(k)){seen.add(k);(cnt[k]=cnt[k]||[]).push(d);}}
   if(e.sc===0&&e.src===boss.addr&&isP(e.dst)&&!e.buff){const k='hit '+e.skill+' '+(skills.get(e.skill)||'');if(!seen.has(k)){seen.add(k);(cnt[k]=cnt[k]||[]).push(d);}}}}}
console.log('casts',casts);for(const [k,v] of Object.entries(cnt).sort((a,b)=>b[1].length-a[1].length).slice(0,15))console.log(v.length,k,'first offsets ms:',v.slice(0,8).join(','));
