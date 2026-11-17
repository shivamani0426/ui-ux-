import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {recommend,STYLES,REFERENCES,exportPrompt} from './design-engine.mjs';
import {rankInspirations,makeSelectionPrompt} from './inspiration-engine.mjs';
import {aiConfig,designAiReply} from './ai-providers.mjs';
import {createDesignPrompt} from './design-intelligence.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||3000);
const MAX_BODY=12_000;
const live=new Map();
const guests=new Map();
const votes=[];
const memorySelections=new Map();
const finalizedModes=new Set();
const isProd=process.env.NODE_ENV==='production';
const cookieName=isProd?'__Host-uic_guest':'uic_guest';
let pg=null;

async function setupDb(){
  if(!process.env.DATABASE_URL){console.log('Database not configured. Using development-only memory store.');return;}
  const {Pool}=await import('pg');
  pg=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DB_SSL==='require'?{rejectUnauthorized:true}:undefined,max:5,connectionTimeoutMillis:5000});
  const schema=await pg.query(`SELECT
    to_regclass('frontline.uic_projects') IS NOT NULL AS projects,
    to_regclass('frontline.uic_profiles') IS NOT NULL AS profiles,
    to_regclass('frontline.uic_feedback') IS NOT NULL AS feedback,
    to_regclass('frontline.design_sources') IS NOT NULL AS library`);
  if(Object.values(schema.rows[0]||{}).some(v=>v!==true)){
    throw new Error('Frontline schema is incomplete. Apply frontline_private_foundation migration first.');
  }
  console.log('PostgreSQL persistence is active.');
}
async function listReferences(){
  if(!pg) return REFERENCES;
  const result=await pg.query(`SELECT id,name,site,award,category,styles,tags,rank,score
    FROM frontline.design_sources WHERE active = true ORDER BY rank ASC NULLS LAST, name ASC LIMIT 250`);
  return result.rows;
}
async function selectionIds(owner,projectId){
  if(!pg)return [...(memorySelections.get(owner+':'+projectId)||new Set())];
  const r=await pg.query('SELECT source_id FROM frontline.reference_selections WHERE visitor_id=$1 AND project_id=$2 AND selected=true ORDER BY created_at ASC',[owner,projectId]);
  return r.rows.map(x=>x.source_id);
}
async function personalInspirationTags(owner){
  if(!pg){
    const ids=new Set();
    for(const [key,values] of memorySelections){if(key.startsWith(owner+':'))for(const value of values)ids.add(value);}
    return REFERENCES.filter(x=>ids.has(x.id)).flatMap(x=>x.tags).slice(0,60);
  }
  const r=await pg.query(`SELECT s.tags FROM frontline.reference_selections r
    JOIN frontline.design_sources s ON s.id=r.source_id
    WHERE r.visitor_id=$1 AND r.selected=true ORDER BY r.created_at DESC LIMIT 60`,[owner]);
  return r.rows.flatMap(x=>x.tags||[]);
}
async function updateInspirationSelection(owner,projectId,sourceId,selected){
  if(!pg){
    const key=owner+':'+projectId, picks=memorySelections.get(key)||new Set();
    if(selected)picks.add(sourceId);else picks.delete(sourceId);
    memorySelections.set(key,picks);return;
  }
  if(selected){
    await pg.query(`INSERT INTO frontline.reference_selections(project_id,visitor_id,source_id,selected)
      VALUES($1,$2,$3,true) ON CONFLICT(project_id,source_id)
      DO UPDATE SET selected=true`,[projectId,owner,sourceId]);
  }else{
    await pg.query('DELETE FROM frontline.reference_selections WHERE project_id=$1 AND visitor_id=$2 AND source_id=$3',[projectId,owner,sourceId]);
  }
}
async function savedSourceRows(owner,projectId){
  const ids=await selectionIds(owner,projectId);
  if(!ids.length)return [];
  const refs=await listReferences();
  return ids.map(id=>refs.find(r=>r.id===id)).filter(Boolean).slice(0,8);
}
async function makeInspirationResponse(owner,project){
  const [refs,prefs,picks,personalTags]=await Promise.all([listReferences(),profile(owner),selectionIds(owner,project.id),personalInspirationTags(owner)]);
  return {
    projectId:project.id,
    matches:rankInspirations(project.brief,refs,{styleWeights:prefs.styleWeights||{},favoriteTags:personalTags}),
    selected:picks,
    librarySize:refs.length,
    ranking:'Metadata signals + your private selection history; not live website scraping',
  };
}
async function profile(owner){
  if(!pg)return guests.get(owner)||{styleWeights:{},globalOptIn:false};
  const r=await pg.query('SELECT style_weights,global_opt_in FROM frontline.uic_profiles WHERE visitor_id=$1',[owner]);
  return r.rows[0]?{styleWeights:r.rows[0].style_weights,globalOptIn:r.rows[0].global_opt_in}:{styleWeights:{},globalOptIn:false};
}
async function saveProfile(owner,p){
  if(!pg){guests.set(owner,p);return;}
  await pg.query(`INSERT INTO frontline.uic_profiles(visitor_id,style_weights,global_opt_in) VALUES($1,$2,$3)
  ON CONFLICT(visitor_id) DO UPDATE SET style_weights=EXCLUDED.style_weights,global_opt_in=EXCLUDED.global_opt_in,updated_at=NOW()`,[owner,JSON.stringify(p.styleWeights),p.globalOptIn]);
}
async function saveProject(owner,p){
  if(!pg){live.set(p.id,{...p,owner});return;}
  await pg.query(`INSERT INTO frontline.uic_projects(id,visitor_id,title,brief,recommendation,messages) VALUES($1,$2,$3,$4,$5,$6)`,[p.id,owner,p.title,p.brief,JSON.stringify(p.recommendations),JSON.stringify(p.messages)]);
}
async function getProject(owner,id){
  if(!pg){const p=live.get(id);return p?.owner===owner?p:null;}
  const r=await pg.query(`SELECT id,title,brief,recommendation AS recommendations,messages,created_at AS "createdAt" FROM frontline.uic_projects WHERE id=$1 AND visitor_id=$2`,[id,owner]);
  return r.rows[0]||null;
}
async function updateMessages(owner,id,messages){
  if(!pg){const p=live.get(id);if(p?.owner===owner){p.messages=messages;live.set(id,p);}return;}
  await pg.query('UPDATE frontline.uic_projects SET messages=$1,updated_at=NOW() WHERE id=$2 AND visitor_id=$3',[JSON.stringify(messages),id,owner]);
}
async function listProjects(owner){
  if(!pg)return [...live.values()].filter(x=>x.owner===owner).reverse().slice(0,50).map(({owner:_,...p})=>p);
  const r=await pg.query('SELECT id,title,brief,recommendation AS recommendations,created_at AS "createdAt" FROM frontline.uic_projects WHERE visitor_id=$1 ORDER BY updated_at DESC LIMIT 50',[owner]);
  return r.rows;
}
async function addVote(owner,id,style,reaction,detail,p){
  if(!pg){votes.push({owner,id,style,reaction,detail,optIn:p.globalOptIn});return;}
  await pg.query('INSERT INTO frontline.uic_feedback(id,visitor_id,project_id,style_id,reaction,detail,eligible_global) VALUES($1,$2,$3,$4,$5,$6,$7)',[crypto.randomUUID(),owner,id,style,reaction,detail,p.globalOptIn]);
}
async function insights(){
  const counts=pg?(await pg.query(`SELECT style_id,COUNT(DISTINCT visitor_id)::int AS people FROM frontline.uic_feedback WHERE eligible_global=true AND reaction='like' GROUP BY style_id`)).rows:votes.filter(v=>v.optIn&&v.reaction==='like').reduce((arr,v)=>{let x=arr.find(i=>i.style_id===v.style);if(!x){x={style_id:v.style,owners:new Set()};arr.push(x)}x.owners.add(v.owner);return arr},[]).map(x=>({style_id:x.style_id,people:x.owners.size}));
  return counts.filter(x=>x.people>=5).map(x=>({style:x.style_id,people:x.people}));
}
async function eraseProfile(owner){
  if(!pg){guests.delete(owner);for(const [id,p] of live){if(p.owner===owner)live.delete(id)}for(const key of memorySelections.keys())if(key.startsWith(owner+':'))memorySelections.delete(key);for(const key of finalizedModes)if(key.startsWith(owner+':'))finalizedModes.delete(key);for(let i=votes.length-1;i>=0;i--)if(votes[i].owner===owner)votes.splice(i,1);return;}
  await pg.query('DELETE FROM frontline.interaction_events WHERE visitor_id=$1',[owner]);
  await pg.query('DELETE FROM frontline.uic_feedback WHERE visitor_id=$1',[owner]);await pg.query('DELETE FROM frontline.uic_projects WHERE visitor_id=$1',[owner]);await pg.query('DELETE FROM frontline.uic_profiles WHERE visitor_id=$1',[owner]);
}
function cookie(req,res){
  const pairs=Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split('=').map(decodeURIComponent)).filter(a=>a.length===2));
  let id=pairs[cookieName];
  if(!id||!/^[a-f0-9-]{36}$/.test(id)){
    id=crypto.randomUUID();res.setHeader('Set-Cookie',`${cookieName}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${isProd?'; Secure':''}`);
  }
  return id;
}
async function readBody(req){
  let buff='';for await(const part of req){buff+=part;if(buff.length>MAX_BODY)throw Object.assign(new Error('Request too large'),{status:413});}
  try{return JSON.parse(buff||'{}')}catch{throw Object.assign(new Error('Invalid JSON'),{status:400})}
}
function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
function validateText(text,min,max){return typeof text==='string'&&text.trim().length>=min&&text.trim().length<=max;}
async function chatReply(brief,messages,styleIds){
  const latest=messages.at(-1)?.content||'';
  const chosen=styleIds.map(i=>STYLES.find(s=>s.id===i)).filter(Boolean);
  // CI/build tests must never consume real API quotas or transmit test data.
  const ai=process.env.NODE_ENV==='test'?null:await designAiReply({brief,messages,styles:chosen});
  if(ai)return ai;
  const s=latest.toLowerCase();
  if(/color|palette|theme/.test(s))return {text:`For this project, begin with ${chosen[0]?.name||'Minimal SaaS'} and establish a four-color system: one neutral background, one surface, one readable text color, and one primary accent. Keep text contrast high and validate accessible combinations. If you select all three styles, use one as the base and borrow selective details from the others.`,source:'guide'};
  if(/page|navigation|layout|dashboard/.test(s))return {text:'Start with an overview page and one primary user workflow. Create a clear left navigation for large screens and a compact bottom or drawer navigation for mobile. Prioritize content hierarchy before decoration: page title, primary action, key information, and supporting details.',source:'guide'};
  if(/motion|animation|glass|transition/.test(s))return {text:'Use animation as feedback, not decoration. Keep hover and press reactions quick, page transitions subtle, and honor reduced-motion preferences. For glass effects, keep opaque surfaces behind important text to preserve readability.',source:'guide'};
  return {text:`I would approach “${latest.slice(0,130)}” by clarifying the user's most important task, then improving the hierarchy, components and responsive behavior around it. ${chosen.length?`Your selected directions are ${chosen.map(x=>x.name).join(', ')}. `:''}Which page or user journey should we design first?`,source:'guide'};
}
async function serveFile(req,res){
  const pathname=new URL(req.url,'http://localhost').pathname;
  let name;
  try{name=decodeURIComponent(pathname);}catch{return json(res,400,{error:'Invalid path'});}
  if(name==='/'||(!path.posix.extname(name)&&!name.startsWith('/assets/')))name='/index.html';
  const allowed=/^\/(?:index\.html|favicon\.svg|robots\.txt|assets\/[a-zA-Z0-9_.-]+\.(?:js|css|png|svg|woff|woff2))$/;
  if(!allowed.test(name))return json(res,404,{error:'Not found'});
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2'};
  try{
    const data=await fs.readFile(path.join(root,'dist',name));
    res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream','Cache-Control':name==='/index.html'?'no-store':'public, max-age=31536000, immutable'});
    if(req.method==='HEAD')return res.end();
    res.end(data);
  }catch(e){if(e.code==='ENOENT')return json(res,404,{error:'Asset unavailable'});throw e;}
}

const RATE_WINDOW=60_000,MAX_CALLS=75;const rateMap=new Map();
function rateLimited(id){const now=Date.now();const rec=rateMap.get(id)||{start:now,count:0};if(now-rec.start>RATE_WINDOW){rec.start=now;rec.count=0;}rec.count++;rateMap.set(id,rec);return rec.count>MAX_CALLS;}
// Render supplies the deployed Git commit SHA automatically. Expose only a
// short public revision so release checks can detect a stale deployment.
const deployedRevision=()=>{
  const sha=process.env.RENDER_GIT_COMMIT;
  return typeof sha==='string'&&/^[a-f0-9]{40}$/i.test(sha)?sha.slice(0,12).toLowerCase():'local';
};
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
  if(req.method==='GET'&&req.url==='/api/health')return json(res,200,{status:'ok',database:pg?'connected':'demo-memory',ai:aiConfig().aiEnabled,revision:deployedRevision()});
  let owner=cookie(req,res);
  try{
    if(req.url?.startsWith('/api/')){
      if(rateLimited(owner))return json(res,429,{error:'Too many requests. Try again shortly.'});
      if(req.method==='GET'&&req.url==='/api/config')return json(res,200,{...aiConfig(),persistent:!!pg,version:'0.4.0'});
      if(req.method==='GET'&&req.url==='/api/catalog')return json(res,200,{styles:STYLES,references:await listReferences(),source:'https://www.webdesignawards.io/categories/ui-ux-design'});
      if(req.method==='GET'&&req.url==='/api/profile')return json(res,200,await profile(owner));
      if(req.method==='PUT'&&req.url==='/api/profile'){
        const data=await readBody(req);const old=await profile(owner);
        const p={...old,globalOptIn:data.globalOptIn===true};
        await saveProfile(owner,p);return json(res,200,p);
      }
      if(req.method==='DELETE'&&req.url==='/api/profile'){
        await eraseProfile(owner);return json(res,200,{deleted:true});
      }
      if(req.method==='GET'&&req.url==='/api/insights')return json(res,200,{publicPatterns:await insights(),minimumContributors:5});
      if(req.method==='GET'&&req.url==='/api/projects')return json(res,200,{projects:await listProjects(owner)});
      if(req.method==='POST'&&req.url==='/api/projects'){
        const b=await readBody(req);if(!validateText(b.brief,15,2500))return json(res,400,{error:'Describe your project in 15–2,500 characters.'});
        const prefs=await profile(owner);const recommendations=recommend(b.brief,prefs,await listReferences());const id=crypto.randomUUID();
        const p={id,title:b.brief.trim().slice(0,64),brief:b.brief.trim(),recommendations,messages:[],createdAt:new Date().toISOString()};
        await saveProject(owner,p);return json(res,201,{project:p});
      }
      const inspireMatch=new URL(req.url,'http://localhost').pathname.match(/^\/api\/projects\/([a-f0-9-]{36})\/inspirations(\/prompt)?$/);
      if(inspireMatch){
        const id=inspireMatch[1],action=inspireMatch[2],p=await getProject(owner,id);
        if(!p)return json(res,404,{error:'Project not found'});
        if(req.method==='GET'&&!action)return json(res,200,await makeInspirationResponse(owner,p));
        if(req.method==='PUT'&&!action){
          const b=await readBody(req);
          if(typeof b.sourceId!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(b.sourceId)||typeof b.selected!=='boolean')
            return json(res,400,{error:'Choose a valid reference and selection state'});
          const found=(await listReferences()).find(x=>x.id===b.sourceId);
          if(!found)return json(res,404,{error:'Inspiration not found'});
          await updateInspirationSelection(owner,id,found.id,b.selected);
          return json(res,200,await makeInspirationResponse(owner,p));
        }
        if(req.method==='POST'&&action==='/prompt'){
          const chosen=await savedSourceRows(owner,id);
          if(!chosen.length)return json(res,400,{error:'Save at least one inspiration first'});
          const prompt=makeSelectionPrompt(p,chosen);
          if(pg)await pg.query(`INSERT INTO frontline.generated_prompts(project_id,visitor_id,prompt_type,prompt_text,styles)
            VALUES($1,$2,'select',$3,$4)`,[id,owner,prompt,chosen.flatMap(x=>x.styles).filter((x,i,a)=>a.indexOf(x)===i)]);
          return json(res,200,{prompt,references:chosen.map(x=>x.id)});
        }
        return json(res,405,{error:'Method not allowed'});
      }
      const designMatch=new URL(req.url,'http://localhost').pathname.match(/^\/api\/projects\/([a-f0-9-]{36})\/design-prompt$/);
      if(designMatch){
        const id=designMatch[1],p=await getProject(owner,id);
        if(!p)return json(res,404,{error:'Project not found'});
        if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
        const b=await readBody(req);
        if(!['generate','fusion'].includes(b.mode))return json(res,400,{error:'Choose Generate UI/UX or Design Fusion'});
        if(!Array.isArray(b.styles)||b.styles.length<1||b.styles.length>3||
            b.styles.some(style=>!STYLES.some(s=>s.id===style)))
          return json(res,400,{error:'Choose one to three valid design styles'});
        if(b.refinement!==undefined&&(typeof b.refinement!=='string'||b.refinement.length>600))
          return json(res,400,{error:'Refinement must be 600 characters or fewer'});
        const styleIds=[...new Set(b.styles)];
        const [refs,prefs]=await Promise.all([savedSourceRows(owner,id),profile(owner)]);
        const result=await createDesignPrompt({
          project:p,mode:b.mode,styles:styleIds,references:refs,preferences:prefs,
          refinement:b.refinement||'',
          env:process.env.NODE_ENV==='test'?{}:process.env
        });
        // Learn privately from the first intentional finalization in each mode.
        // Repeated clicks on Copy do not inflate the user's learned preferences.
        let hasFinalized=false;
        if(pg){
          const prior=await pg.query('SELECT 1 FROM frontline.generated_prompts WHERE project_id=$1 AND visitor_id=$2 AND prompt_type=$3 LIMIT 1',
            [id,owner,b.mode]);
          hasFinalized=prior.rowCount>0;
          await pg.query('INSERT INTO frontline.generated_prompts(project_id,visitor_id,prompt_type,prompt_text,styles) VALUES($1,$2,$3,$4,$5)',
            [id,owner,b.mode,result.prompt,styleIds]);
        }else{
          const key=owner+':'+id+':'+b.mode;
          hasFinalized=finalizedModes.has(key);
          finalizedModes.add(key);
        }
        if(!hasFinalized){
          const next={...prefs,styleWeights:{...(prefs.styleWeights||{})}};
          for(const style of styleIds)next.styleWeights[style]=Math.max(-5,Math.min(5,(next.styleWeights[style]||0)+1));
          await saveProfile(owner,next);
        }
        return json(res,200,{...result,styles:styleIds,references:refs.map(x=>x.id)});
      }
      const projectMatch=new URL(req.url,'http://localhost').pathname.match(/^\/api\/projects\/([a-f0-9-]{36})(\/messages|\/export)?$/);
      if(projectMatch){
        const id=projectMatch[1],action=projectMatch[2];const p=await getProject(owner,id);
        if(!p)return json(res,404,{error:'Project not found'});
        if(req.method==='GET'&&!action)return json(res,200,{project:p});
        if(req.method==='POST'&&action==='/messages'){
          const b=await readBody(req);if(!validateText(b.message,2,1200))return json(res,400,{error:'Message must be 2–1,200 characters.'});
          if(!Array.isArray(b.styles)||b.styles.some(s=>!STYLES.some(t=>t.id===s)))return json(res,400,{error:'Invalid styles'});
          const messages=(Array.isArray(p.messages)?p.messages:[]).slice(-24);
          messages.push({role:'user',content:b.message.trim(),time:new Date().toISOString()});
          const response=await chatReply(p.brief,messages,b.styles);messages.push({role:'assistant',content:response.text,source:response.source,...(response.provider?{provider:response.provider}:{}),time:new Date().toISOString()});
          await updateMessages(owner,id,messages);return json(res,200,{messages,answer:response});
        }
        if(req.method==='POST'&&action==='/export'){
          const b=await readBody(req);if(!Array.isArray(b.styles)||!b.styles.length||b.styles.some(s=>!STYLES.some(t=>t.id===s)))return json(res,400,{error:'Choose at least one design.'});
          const prompt=exportPrompt(p,b.styles);
          if(pg)await pg.query('INSERT INTO frontline.generated_prompts(project_id,visitor_id,prompt_type,prompt_text,styles) VALUES($1,$2,$3,$4,$5)',[id,owner,b.styles.length>1?'fusion':'select',prompt,b.styles]);
          return json(res,200,{prompt});
        }
      }
      if(req.method==='POST'&&req.url==='/api/feedback'){
        const b=await readBody(req),p=await getProject(owner,b.projectId||'');if(!p)return json(res,404,{error:'Project not found'});
        const selected=Array.isArray(b.styles)?[...new Set(b.styles)]:[];
        if(!selected.length||selected.some(s=>!STYLES.some(t=>t.id===s))||!['like','dislike','edit'].includes(b.reaction))return json(res,400,{error:'Invalid feedback'});
        const detail=typeof b.detail==='string'?b.detail.slice(0,500):'';
        const prefs=await profile(owner);
        for(const style of selected){
          await addVote(owner,p.id,style,b.reaction,detail,prefs);
          const d=b.reaction==='like'?1:b.reaction==='dislike'?-1:0;
          prefs.styleWeights[style]=Math.max(-5,Math.min(5,(prefs.styleWeights[style]||0)+d));
        }
        await saveProfile(owner,prefs);return json(res,200,{saved:selected.length,profile:prefs});
      }
      return json(res,404,{error:'API route not found'});
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
    return await serveFile(req,res);
  }catch(e){console.error('Request failed:',e.message);return json(res,e.status||500,{error:e.status?e.message:'Something went wrong.'});}
});
if(process.env.NODE_ENV!=='test'){
  setupDb().then(()=>server.listen(PORT,'0.0.0.0',()=>console.log(`UI Compass listening on ${PORT}`))).catch(e=>{console.error('Database setup failed:',e.message);process.exit(1)});
}
export {server};