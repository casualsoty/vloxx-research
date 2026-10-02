// picks 2/3: rank by distance to previous target and to fixated player
const fs=require('fs'),path=require('path');const {parseEvtc}=require('./evtc');const dir=path.join(__dirname,'..','logs','raw');
const interp=(L,t)=>{if(!L)return null;let i=L.findIndex(p=>p[0]>t);if(i===-1)return L[L.length-1].slice(1);if(i===0)return L[0].slice(1);const[p,q]=[L[i-1],L[i]];const k=(t-p[0])/(q[0]-p[0]);return[p[1]+k*(q[1]-p[1]),p[2]+k*(q[2]-p[2])];};
const D=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);const H={prev:{},fix:{},prevFar:{}};let n=0,expSum=0;
for(const f of fs.readdirSync(dir)){const {agents,ev}=parseEvtc(path.join(dir,f));const boss=[...agents.values()].find(a=>a.species===28106);if(!boss)continue;
 if(Math.max(0,...ev.filter(e=>e.sc===12&&e.src===boss.addr).map(e=>Number(e.dst)))<70e6)continue;
 const players=[...agents.values()].filter(a=>a.isPlayer&&a.elite!==0xffffffff).map(a=>a.addr);
 const tl=new Map();const b=Buffer.alloc(8);for(const e of ev)if(e.sc===19){b.writeBigUInt64LE(e.dst);(tl.get(e.src)||tl.set(e.src,[]).get(e.src)).push([e.t,b.readFloatLE(0),b.readFloatLE(4)]);}
 const marks=ev.filter(e=>e.sc===62&&e.skill===37976);
 for(const c of ev.filter(e=>e.src===boss.addr&&e.sc===67&&e.skill===81076)){const ms=marks.filter(m=>m.t-c.t>=0&&m.t-c.t<4000);
  for(let i=1;i<ms.length;i++){const T=ms[i].t;const chosen=ms.slice(0,i).map(m=>m.dst);const cand=players.filter(p=>!chosen.includes(p));
   const prevP=interp(tl.get(ms[i-1].dst),T),fixP=interp(tl.get(ms[0].dst),T);
   const rk=(ref)=>cand.map(p=>[p,D(interp(tl.get(p),T),ref)]).sort((a,b)=>a[1]-b[1]).findIndex(x=>x[0]===ms[i].dst)+1;
   const r1=rk(prevP),r2=rk(fixP);H.prev[r1]=(H.prev[r1]||0)+1;H.fix[r2]=(H.fix[r2]||0)+1;n++;expSum+=(cand.length+1)/2;}}}
console.log('picks 2-3 analysed',n,'(random mean rank',(expSum/n).toFixed(2)+')');
const mean=h=>Object.entries(h).reduce((a,[k,v])=>a+k*v,0)/n;
console.log('rank by distance to PREVIOUS shackle target:',JSON.stringify(H.prev),'mean',mean(H.prev).toFixed(2));
console.log('rank by distance to FIRST (fixated) target :',JSON.stringify(H.fix),'mean',mean(H.fix).toFixed(2));
