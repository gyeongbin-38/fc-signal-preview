'use strict';
/* Static fallback parses shards off the UI thread. It never reads credentials. */
self.onmessage=async e=>{const {id,index,seasons=[],query='',filters={},position='',grade=1,sort='ovr',offset=0,limit=48,details=[],maps={},aliases={},detailed=false,family=null}=e.data;try{
 const selected=index.seasons.filter(s=>!seasons.length||seasons.includes(s.season));let cards=[];
 for(const s of selected){const r=await fetch(s.file);if(!r.ok)throw Error('shard '+r.status);const raw=await r.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==s.sha256)throw Error('shard integrity');cards.push(...JSON.parse(new TextDecoder().decode(raw)).cards);}
 const norm=s=>String(s).normalize('NFKC').toLowerCase(),cho='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ',initials=s=>[...s].map(c=>c.charCodeAt(0)>=44032&&c.charCodeAt(0)<=55203?cho[Math.floor((c.charCodeAt(0)-44032)/588)]:c).join('');
 const terms=norm(query).split(',').map(s=>s.trim()).filter(Boolean),byId=new Map(details.filter(p=>p&&p.enhancement===grade).map(p=>[String(p.spid),p]));
 const bp=r=>{const v=r.eachPrice?.[grade];return typeof v==='string'&&/^[1-9]\d{0,37}$/.test(v)?BigInt(v):null;},stats=p=>Object.fromEntries((p?.statDetail||[]).map(s=>[s.name,s.value])),pos=p=>p?.positionOvrs||p?.positions||{};
 cards=cards.filter(r=>{const p=byId.get(String(r.spid)),f=filters,m=stats(p);
  if(family!==null&&String(r.pid)!==String(family))return false;
  if(terms.length&&!terms.some(t=>norm(r.name+' '+r.season+' '+r.spid+' '+(aliases[r.spid]||[]).join(' ')).includes(t)||norm(initials(r.name)).includes(t)))return false;
  if(position&&!r.positions?.some(x=>x.toUpperCase()===position)||detailed&&!p?.statDetail?.length||f.onlyPosition&&(!position||pos(p)[position]==null))return false;
  if(f.excludeSeasons?.includes(r.season)||f.excludePlayers?.includes(String(r.pid))||f.excludeSquad&&f.used?.includes(String(r.pid)))return false;
  for(const [key,v] of [['salary',p?.salary??r.pay],['height',r.height],['weak',r.weakfoot]])if((f[key+'Min']||f[key+'Max'])&&(v==null||f[key+'Min']&&v<+f[key+'Min']||f[key+'Max']&&v>+f[key+'Max']))return false;
  const price=bp(r);if((f.bpMin||f.bpMax)&&(price===null||f.bpMin&&price<BigInt(f.bpMin)||f.bpMax&&price>BigInt(f.bpMax)))return false;
  for(const [plural,single,group,key] of [['nations','nation','nations','nation'],['clubs','club','teams','team_card']]){const xs=f[plural]?.length?f[plural]:f[single]?[f[single]]:[],v=maps[group]?.[r[key]];if(xs.length&&!xs.includes(typeof v==='object'?v.name:v)&&!xs.includes(String(r[key])))return false;}
  const ts=f.traits?.length?f.traits:f.trait?[f.trait]:[];if(ts.length&&!(f.traitMode==='OR'?ts.some(t=>p?.baseTraits?.includes(t)):ts.every(t=>p?.baseTraits?.includes(t))))return false;
  if(f.coreMin&&(!f.core?.length||!f.core.every(n=>m[n]!=null&&m[n]>=+f.coreMin)))return false;return true;});
 const score=r=>{const m=stats(byId.get(String(r.spid))),ns=filters.statNames||[];return ns.length&&ns.every(n=>m[n]!=null)?ns.reduce((a,n)=>a+m[n],0):-1;};
 cards.sort((a,b)=>{if(sort==='name')return a.name.localeCompare(b.name,'ko');if(sort==='salary')return (a.pay??999)-(b.pay??999);if(sort==='height')return (b.height??0)-(a.height??0);if(sort==='stats')return score(b)-score(a);if(sort==='position'){const x=pos(byId.get(String(a.spid)))[position],y=pos(byId.get(String(b.spid)))[position];return (y??-1)-(x??-1);}if(sort==='price'){const x=bp(a),y=bp(b);return x===null?y===null?0:1:y===null?-1:x<y?-1:x>y?1:0;}return (b.ovr??0)-(a.ovr??0);});
 self.postMessage({id,cards:cards.slice(offset,offset+limit),count:cards.length});
 }catch(error){self.postMessage({id,error:error.message});}};
