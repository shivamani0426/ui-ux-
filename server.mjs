import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createAuthGateway} from './auth-gateway.mjs';
import {fileURLToPath} from 'node:url';
import {recommend,STYLES,REFERENCES,exportPrompt} from './design-engine.mjs';
import {rankInspirations,makeSelectionPrompt} from './inspiration-engine.mjs';
import {aiConfig,designAiReply} from './ai-providers.mjs';
import {createDesignPrompt} from './design-intelligence.mjs';
import {analyzeProject,compareDirections} from './project-intelligence.mjs';
import {normalizeProfile,persistableWeights,effectivePreferences,learnStyle,applyPreferenceChanges,
  resetPreferenceLearning,preferenceHints,learnFeedbackTransition,latestFeedbackChoices,visitorCohortBand} from './learning-engine.mjs';

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
const authGateway=createAuthGateway({
  url:process.env.FRONTLINE_SUPABASE_URL||'',
  key:process.env.FRONTLINE_SUPABASE_PUBLISHABLE_KEY||'',
  siteUrl:process.env.FRONTLINE_SITE_URL||'https://ui-compass-studio.onrender.com',
  googleEnabled:process.env.FRONTLINE_GOOGLE_LOGIN_ENABLED==='true',
  adminKey:process.env.FRONTLINE_SUPABASE_ADMIN_KEY||'',
  signingSecret:process.env.FRONTLINE_ACTION_SIGNING_SECRET||'',
  // Strict server session checks can be enabled after verifying the DB role.
  sessionVerifier:process.env.FRONTLINE_STRICT_SESSION_CHECK==='true'?async(user,accessToken)=>{
    if(!pg)return false;
    let payload;
    try{
      const parts=accessToken.split('.');
      if(parts.length!==3)return false;
      payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());
    }catch{return false;}
    if(payload.sub!==user.id||typeof payload.session_id!=='string'||
      !/^[a-f0-9-]{36}$/i.test(payload.session_id))return false;
    const match=await pg.query('SELECT 1 FROM auth.sessions WHERE id=$1 AND user_id=$2 LIMIT 1',
      [payload.session_id,user.id]);
    return match.rowCount===1;
  }:null,
  prod:isProd||Boolean(process.env.RENDER_SERVICE_ID)
});
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
  const [refs,raw,picks,personalTags]=await Promise.all([listReferences(),profile(owner),selectionIds(owner,project.id),personalInspirationTags(owner)]);
  const prefs=effectivePreferences(raw);
  return {
    projectId:project.id,
    matches:rankInspirations(project.brief,refs,{styleWeights:prefs.styleWeights||{},
      favoriteTags:prefs.personalization.enabled?personalTags:[]}),
    selected:picks,
    librarySize:refs.length,
    ranking:'Metadata signals + your private selection history; not live website scraping',
  };
}
async function profile(owner){
  if(!pg)return normalizeProfile(guests.get(owner));
  const r=await pg.query('SELECT style_weights,global_opt_in FROM frontline.uic_profiles WHERE visitor_id=$1',[owner]);
  return normalizeProfile(r.rows[0]?{
    styleWeights:r.rows[0].style_weights,globalOptIn:r.rows[0].global_opt_in,
  }:{});
}
async function saveProfile(owner,input){
  const p=normalizeProfile(input);
  if(!pg){guests.set(owner,p);return;}
  await pg.query(`INSERT INTO frontline.uic_profiles(visitor_id,style_weights,global_opt_in) VALUES($1,$2,$3)
  ON CONFLICT(visitor_id) DO UPDATE SET style_weights=EXCLUDED.style_weights,global_opt_in=EXCLUDED.global_opt_in,updated_at=NOW()`,
    [owner,JSON.stringify(persistableWeights(p)),p.globalOptIn]);
}
async function revokeSharedFeedback(owner){
  if(!pg){for(const vote of votes)if(vote.owner===owner)vote.optIn=false;return;}
  await pg.query('UPDATE frontline.uic_feedback SET eligible_global=false WHERE visitor_id=$1',[owner]);
}
async function clearPreferenceFeedback(owner){
  if(!pg){for(let i=votes.length-1;i>=0;i--)if(votes[i].owner===owner)votes.splice(i,1);return;}
  await pg.query('DELETE FROM frontline.uic_feedback WHERE visitor_id=$1',[owner]);
}
async function feedbackEvidence(owner){
  let rows;
  if(!pg){
    rows=latestFeedbackChoices(votes.filter(v=>v.owner===owner))
      .map(v=>({style:v.style,reaction:v.reaction,total:1}));
  }else{
    const r=await pg.query(`WITH latest AS (
      SELECT DISTINCT ON (project_id,style_id) style_id,reaction
      FROM frontline.uic_feedback WHERE visitor_id=$1
      ORDER BY project_id,style_id,created_at DESC,id DESC
    )
    SELECT style_id AS style,reaction,COUNT(*)::int AS total
    FROM latest GROUP BY style_id,reaction`,[owner]);
    rows=r.rows;
  }
  return ['minimal','glass','creative'].map(style=>({
    style,likes:rows.filter(x=>x.style===style&&x.reaction==='like').reduce((sum,x)=>sum+x.total,0),
    dislikes:rows.filter(x=>x.style===style&&x.reaction==='dislike').reduce((sum,x)=>sum+x.total,0),
    refinements:rows.filter(x=>x.style===style&&x.reaction==='edit').reduce((sum,x)=>sum+x.total,0),
  }));
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
  if(!pg){const p=live.get(id);if(p?.owner===owner){p.messages=messages;p.updatedAt=new Date().toISOString();live.set(id,p);}return;}
  await pg.query('UPDATE frontline.uic_projects SET messages=$1,updated_at=NOW() WHERE id=$2 AND visitor_id=$3',[JSON.stringify(messages),id,owner]);
}
// Paginate owner-scoped history so accounts with more than 50 conversations
// can actually reach their full history without fetching every chat message.
const PROJECT_PAGE_SIZE=50;
async function listProjects(owner,offset=0){
  if(!pg){
    const mine=[...live.values()].filter(x=>x.owner===owner).reverse().map(({owner:_,...p})=>({
      ...p,updatedAt:p.updatedAt||p.createdAt,
      messageCount:p.messages?.length||0,
      inspirationCount:memorySelections.get(owner+':'+p.id)?.size||0,
      promptCount:[...finalizedModes].filter(k=>k.startsWith(owner+':'+p.id+':')).length
    }));
    return {projects:mine.slice(offset,offset+PROJECT_PAGE_SIZE),
      nextOffset:offset+PROJECT_PAGE_SIZE<mine.length?offset+PROJECT_PAGE_SIZE:null};
  }
  const r=await pg.query(`SELECT p.id,p.title,p.brief,p.recommendation AS recommendations,
    p.created_at AS "createdAt",p.updated_at AS "updatedAt",
    jsonb_array_length(p.messages)::int AS "messageCount",
    (SELECT COUNT(*)::int FROM frontline.reference_selections s
      WHERE s.project_id=p.id AND s.visitor_id=$1 AND s.selected=true) AS "inspirationCount",
    (SELECT COUNT(*)::int FROM frontline.generated_prompts g
      WHERE g.project_id=p.id AND g.visitor_id=$1) AS "promptCount"
    FROM frontline.uic_projects p WHERE p.visitor_id=$1
    ORDER BY p.updated_at DESC,p.id DESC LIMIT $2 OFFSET $3`,
    [owner,PROJECT_PAGE_SIZE+1,offset]);
  return {projects:r.rows.slice(0,PROJECT_PAGE_SIZE),
    nextOffset:r.rows.length>PROJECT_PAGE_SIZE?offset+PROJECT_PAGE_SIZE:null};
}
// Only private, owner-scoped counts leave the server; no other users'
 // projects or AI conversation content is exposed in this summary.
async function workspaceOverview(owner){
  if(!pg){
    const mine=[...live.values()].filter(x=>x.owner===owner);
    return {projectCount:mine.length,
      inspirationCount:[...memorySelections].filter(([k])=>k.startsWith(owner+':')).reduce((n,[,v])=>n+v.size,0),
      promptCount:[...finalizedModes].filter(k=>k.startsWith(owner+':')).length,
      feedbackCount:votes.filter(v=>v.owner===owner).length,
      lastUpdatedAt:mine.map(p=>p.updatedAt||p.createdAt).filter(Boolean).sort().at(-1)||null};
  }
  const r=await pg.query(`SELECT
    (SELECT COUNT(*)::int FROM frontline.uic_projects WHERE visitor_id=$1) AS "projectCount",
    (SELECT COUNT(*)::int FROM frontline.reference_selections WHERE visitor_id=$1 AND selected=true) AS "inspirationCount",
    (SELECT COUNT(*)::int FROM frontline.generated_prompts WHERE visitor_id=$1) AS "promptCount",
    (SELECT COUNT(*)::int FROM frontline.uic_feedback WHERE visitor_id=$1) AS "feedbackCount",
    (SELECT MAX(updated_at) FROM frontline.uic_projects WHERE visitor_id=$1) AS "lastUpdatedAt"`,[owner]);
  return r.rows[0];
}
async function workspaceExport(owner,authenticated){
  if(!pg){
    const projects=[...live.values()].filter(p=>p.owner===owner).map(({owner:_,...p})=>p);
    const inspirations=[...memorySelections].filter(([k])=>k.startsWith(owner+':'))
      .flatMap(([key,sources])=>[...sources].map(sourceId=>({projectId:key.slice(owner.length+1),sourceId})));
    const feedback=votes.filter(v=>v.owner===owner).map(({owner:_,...v})=>v);
    return {version:1,exportedAt:new Date().toISOString(),identity:authenticated?'account':'guest',
      profile:await profile(owner),projects,inspirations,prompts:[],feedback,events:[],
      note:'Development memory store: only records held in memory can be exported.'};
  }
  // Read all project details and related personal history, never a global
  // dataset. A downloadable export is accessible only through owner's cookie.
  const queries=[
    `SELECT id,title,brief,recommendation AS recommendations,messages,
      created_at AS "createdAt",updated_at AS "updatedAt"
      FROM frontline.uic_projects WHERE visitor_id=$1 ORDER BY created_at`,
    `SELECT project_id AS "projectId",source_id AS "sourceId",selected,final_choice AS "finalChoice",created_at AS "createdAt"
      FROM frontline.reference_selections WHERE visitor_id=$1 ORDER BY created_at`,
    `SELECT project_id AS "projectId",prompt_type AS "type",prompt_text AS "prompt",styles,created_at AS "createdAt"
      FROM frontline.generated_prompts WHERE visitor_id=$1 ORDER BY created_at`,
    `SELECT project_id AS "projectId",style_id AS "style",reaction,detail,eligible_global AS "sharedInAggregate",created_at AS "createdAt"
      FROM frontline.uic_feedback WHERE visitor_id=$1 ORDER BY created_at`,
    `SELECT project_id AS "projectId",source_id AS "sourceId",event_type AS "eventType",metadata,created_at AS "createdAt"
      FROM frontline.interaction_events WHERE visitor_id=$1 ORDER BY created_at`
  ];
  const client=await pg.connect();
  try{
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const results=[];
    for(const query of queries)results.push((await client.query(query,[owner])).rows);
    const pref=(await client.query('SELECT style_weights,global_opt_in FROM frontline.uic_profiles WHERE visitor_id=$1',[owner])).rows[0];
    await client.query('COMMIT');
    return {version:1,exportedAt:new Date().toISOString(),identity:authenticated?'account':'guest',
      profile:normalizeProfile(pref?{styleWeights:pref.style_weights,globalOptIn:pref.global_opt_in}:{}),
      projects:results[0],inspirations:results[1],prompts:results[2],feedback:results[3],events:results[4]};
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client.release();}
}
// Serialize feedback per visitor so concurrent clicks cannot award duplicate
// learning points. PostgreSQL advisory locks work across Render instances.
const memoryFeedbackGates=new Map();
async function recordFeedback(owner,id,styles,reaction,detail){
  const saveVote=async(client,style,prefs)=>{
    const previous=client
      ?(await client.query(`SELECT reaction,detail FROM frontline.uic_feedback
         WHERE visitor_id=$1 AND project_id=$2 AND style_id=$3
         ORDER BY created_at DESC,id DESC LIMIT 1`,[owner,id,style])).rows[0]
      :[...votes].reverse().find(v=>v.owner===owner&&v.id===id&&v.style===style);
    if(previous?.reaction===reaction&&(previous?.detail||'')===detail)
      return {prefs,changed:false};
    if(client){
      await client.query(`INSERT INTO frontline.uic_feedback
        (id,visitor_id,project_id,style_id,reaction,detail,eligible_global)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [crypto.randomUUID(),owner,id,style,reaction,detail,prefs.globalOptIn]);
    }else votes.push({owner,id,style,reaction,detail,optIn:prefs.globalOptIn});
    return {prefs:learnFeedbackTransition(prefs,style,reaction,previous?.reaction),changed:true};
  };
  if(!pg){
    const earlier=memoryFeedbackGates.get(owner)||Promise.resolve();
    let unlock;
    const next=new Promise(resolve=>{unlock=resolve});
    memoryFeedbackGates.set(owner,next);
    await earlier;
    try{
      let prefs=await profile(owner);
      if(!prefs.personalization.enabled)
        throw Object.assign(new Error('Personal learning is paused. Re-enable it to save design feedback.'),{status:409});
      let changed=0;
      for(const style of styles){
        const outcome=await saveVote(null,style,prefs);
        prefs=outcome.prefs;if(outcome.changed)changed++;
      }
      if(changed)await saveProfile(owner,prefs);
      return {profile:prefs,changed,saved:styles.length};
    }finally{
      unlock();
      if(memoryFeedbackGates.get(owner)===next)memoryFeedbackGates.delete(owner);
    }
  }
  const client=await pg.connect();
  try{
    await client.query('BEGIN');
    // This is a per-visitor lock; hash collisions only serialize unrelated
    // visitors, they do not grant access to another visitor's records.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1),712)',[owner]);
    const state=await client.query(`SELECT style_weights,global_opt_in FROM frontline.uic_profiles
      WHERE visitor_id=$1 FOR UPDATE`,[owner]);
    let prefs=normalizeProfile(state.rows[0]?{
      styleWeights:state.rows[0].style_weights,globalOptIn:state.rows[0].global_opt_in,
    }:{});
    if(!prefs.personalization.enabled)
      throw Object.assign(new Error('Personal learning is paused. Re-enable it to save design feedback.'),{status:409});
    let changed=0;
    for(const style of styles){
      const outcome=await saveVote(client,style,prefs);
      prefs=outcome.prefs;if(outcome.changed)changed++;
    }
    if(changed)await client.query(`INSERT INTO frontline.uic_profiles(visitor_id,style_weights,global_opt_in)
      VALUES($1,$2,$3) ON CONFLICT(visitor_id) DO UPDATE SET
      style_weights=EXCLUDED.style_weights,global_opt_in=EXCLUDED.global_opt_in,updated_at=NOW()`,
      [owner,JSON.stringify(persistableWeights(prefs)),prefs.globalOptIn]);
    await client.query('COMMIT');
    return {profile:prefs,changed,saved:styles.length};
  }catch(error){
    await client.query('ROLLBACK').catch(()=>{});
    throw error;
  }finally{client.release()}
}
async function insights(){
  const counts=pg?(await pg.query(`WITH latest AS (
      SELECT DISTINCT ON (visitor_id,project_id,style_id)
        visitor_id,style_id,reaction,eligible_global
      FROM frontline.uic_feedback
      ORDER BY visitor_id,project_id,style_id,created_at DESC,id DESC
    )
    SELECT f.style_id,COUNT(DISTINCT f.visitor_id)::int AS visitors
    FROM latest f
    JOIN frontline.uic_profiles p ON p.visitor_id=f.visitor_id
    WHERE f.eligible_global=true AND f.reaction='like' AND p.global_opt_in=true
      AND COALESCE(p.style_weights->'_personalization'->>'enabled','true')='true'
    GROUP BY f.style_id`)).rows:latestFeedbackChoices(votes)
    .filter(v=>v.optIn&&v.reaction==='like')
    .reduce((arr,v)=>{
      let x=arr.find(i=>i.style_id===v.style);
      if(!x){x={style_id:v.style,owners:new Set()};arr.push(x)}
      x.owners.add(v.owner);
      return arr;
    },[]).map(x=>({style_id:x.style_id,visitors:x.owners.size}));
  // Avoid exposing exact small-cohort sizes, member IDs or free-form details.
  return counts.filter(x=>x.visitors>=5).map(x=>({
    style:x.style_id,contributorsBand:visitorCohortBand(x.visitors),
  }));
}
async function eraseProfile(owner){
  if(!pg){guests.delete(owner);for(const [id,p] of live){if(p.owner===owner)live.delete(id)}for(const key of memorySelections.keys())if(key.startsWith(owner+':'))memorySelections.delete(key);for(const key of finalizedModes)if(key.startsWith(owner+':'))finalizedModes.delete(key);for(let i=votes.length-1;i>=0;i--)if(votes[i].owner===owner)votes.splice(i,1);return;}
  // Previously this used several independent DELETEs. A failure midway could
  // leave old private data behind, so delete every owner-scoped table in ONE
  // transaction, with no effect on other visitors or the Google identity.
  const client=await pg.connect();
  try{
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1),916)',[owner]);
    await client.query('DELETE FROM frontline.interaction_events WHERE visitor_id=$1',[owner]);
    await client.query('DELETE FROM frontline.uic_feedback WHERE visitor_id=$1',[owner]);
    await client.query('DELETE FROM frontline.reference_selections WHERE visitor_id=$1',[owner]);
    await client.query('DELETE FROM frontline.generated_prompts WHERE visitor_id=$1',[owner]);
    await client.query('DELETE FROM frontline.uic_projects WHERE visitor_id=$1',[owner]);
    await client.query('DELETE FROM frontline.uic_profiles WHERE visitor_id=$1',[owner]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client.release();}
}
// A user may already have a private collection on this browser before Google
// sign-in. Move ALL owner-scoped data atomically into the verified account.
// Never merge opt-in to global learning without new account consent.
async function claimGuestData(guestOwner,accountOwner){
  if(!/^[a-f0-9-]{36}$/i.test(guestOwner)||!/^acct:[a-f0-9-]{36}$/i.test(accountOwner))
    throw new Error('Invalid identity scope');
  if(!pg){
    if(guests.has(guestOwner)&&!guests.has(accountOwner)){
      guests.set(accountOwner,{...guests.get(guestOwner),globalOptIn:false});
    }
    guests.delete(guestOwner);
    for(const project of live.values())if(project.owner===guestOwner)project.owner=accountOwner;
    for(const entry of votes)if(entry.owner===guestOwner){entry.owner=accountOwner;entry.optIn=false;}
    for(const [key,value] of [...memorySelections])if(key.startsWith(guestOwner+':')){
      memorySelections.set(accountOwner+key.slice(guestOwner.length),value);memorySelections.delete(key);
    }
    for(const key of [...finalizedModes])if(key.startsWith(guestOwner+':')){
      finalizedModes.add(accountOwner+key.slice(guestOwner.length));finalizedModes.delete(key);
    }
    return;
  }
  const client=await pg.connect();
  try{
    await client.query('BEGIN');
    // Serialize claims of a guest cookie across simultaneous OAuth callbacks.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1),915)',[guestOwner]);
    await client.query(`INSERT INTO frontline.uic_profiles(visitor_id,style_weights,global_opt_in)
      SELECT $1,style_weights,false FROM frontline.uic_profiles WHERE visitor_id=$2
      ON CONFLICT (visitor_id) DO UPDATE SET
        style_weights=EXCLUDED.style_weights || frontline.uic_profiles.style_weights,
        updated_at=NOW()`,[accountOwner,guestOwner]);
    await client.query('UPDATE frontline.uic_projects SET visitor_id=$1 WHERE visitor_id=$2',[accountOwner,guestOwner]);
    await client.query('UPDATE frontline.reference_selections SET visitor_id=$1 WHERE visitor_id=$2',[accountOwner,guestOwner]);
    await client.query('UPDATE frontline.generated_prompts SET visitor_id=$1 WHERE visitor_id=$2',[accountOwner,guestOwner]);
    await client.query('UPDATE frontline.interaction_events SET visitor_id=$1 WHERE visitor_id=$2',[accountOwner,guestOwner]);
    await client.query('UPDATE frontline.uic_feedback SET visitor_id=$1,eligible_global=false WHERE visitor_id=$2',[accountOwner,guestOwner]);
    await client.query('DELETE FROM frontline.uic_profiles WHERE visitor_id=$1',[guestOwner]);
    await client.query('COMMIT');
  }catch(error){
    await client.query('ROLLBACK').catch(()=>{});
    throw error;
  }finally{client.release();}
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
  // Cookie-authenticated writes must be JSON. Browsers cannot silently submit
  // this content type from a cross-site HTML form.
  if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json')
    throw Object.assign(new Error('Use application/json for API writes.'),{status:415});
  let buff='';for await(const part of req){buff+=part;if(buff.length>MAX_BODY)throw Object.assign(new Error('Request too large'),{status:413});}
  try{return JSON.parse(buff||'{}')}catch{throw Object.assign(new Error('Invalid JSON'),{status:400})}
}
function trustedMutationOrigin(req){
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method)||!req.headers.origin)return true;
  try{
    const origin=new URL(req.headers.origin);
    return ['https:','http:'].includes(origin.protocol)&&origin.host===req.headers.host;
  }catch{return false}
}
function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
// Profile pictures are display-only. Google user_metadata is editable and
// must never influence authorization. Permit only a Google-controlled HTTPS
// image origin to prevent arbitrary third-party tracking URL injection.
function googleProfileImage(value){
  if(typeof value!=='string'||value.length>1800)return null;
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&url.hostname.endsWith('.googleusercontent.com')
      &&!url.username&&!url.password?url.toString():null;
  }catch{return null;}
}
function validateText(text,min,max){return typeof text==='string'&&text.trim().length>=min&&text.trim().length<=max;}
async function chatReply(brief,messages,styleIds,preferences={}){
  const latest=messages.at(-1)?.content||'';
  const chosen=styleIds.map(i=>STYLES.find(s=>s.id===i)).filter(Boolean);
  // Tests never consume real API quotas or send content to model providers.
  let failure={reason:'provider-unavailable',retryAfterSeconds:0};
  const ai=process.env.NODE_ENV==='test'?null:await designAiReply({
    brief,messages,styles:chosen,designPreferences:preferenceHints(preferences),
    onFailure:info=>{failure=info}
  });
  if(ai)return ai;
  const analysis=analyzeProject(brief);
  const audience=analysis.audienceSource==='explicit'
    ?analysis.audience.join(', '):'Primary users not yet confirmed';
  const preferred=compareDirections(analysis,chosen.length?chosen:STYLES,effectivePreferences(preferences));
  const best=preferred[0];
  const mainFeature=analysis.features[0]||null;
  const lower=latest.toLowerCase();
  let focus;
  if(/\b(color|palette|theme|contrast)\b/.test(lower)){
    focus='Define readable surface, text and accent color tokens. Check contrast over every panel and preserve a solid-surface alternative.';
  }else if(/\b(navigation|layout|dashboard|page|sidebar|mobile)\b/.test(lower)){
    focus='Give the primary user task a stable desktop navigation destination and compact, labeled mobile navigation. Keep a clear action, its status and confirmation within reach.';
  }else if(/\b(motion|animation|glass|transition)\b/.test(lower)){
    focus='Use motion to clarify state changes, keep task-critical text opaque, and respect reduced-motion settings on every device.';
  }else if(/\b(improve|refine|change|simplify|keep|preserve)\b/.test(lower)){
    focus='Refine only the requested detail. Preserve approved tasks, API contracts and user decisions unless explicitly replaced.';
  }else{
    focus='Start with entry point → main task → progress/feedback → error recovery. Design real content and empty states before decorative treatments.';
  }
  const unavailableNote=failure.reason==='rate-limited'
    ?'OpenRouter is currently rate-limited. Repeated requests can consume the free allowance; try again after the cooldown (about '+Math.max(1,Math.ceil((failure.retryAfterSeconds||90)/60))+' minute(s)).'
    :failure.reason==='timeout'
      ?'OpenRouter timed out on this request. Free models can be slow or overloaded; the structured guidance below remains available.'
      :failure.reason==='incomplete-output'
        ?'OpenRouter stopped before its answer was complete. An unfinished AI answer was not passed off as a final design.'
        :'OpenRouter did not provide an answer for this request.';
  const lines=[
    '## Project understanding',
    '**Audience:** '+audience,
    '**Requested modules:** '+(analysis.features.length?analysis.features.map(f=>f.label).join('; '):'No modules explicitly identified yet.'),
    '**Constraints:** '+(analysis.constraints.length?analysis.constraints.join('; '):'Responsive, accessible defaults proposed.'),
    '',
    '## Recommended UI/UX direction',
    '**'+(best?.name||'Minimal SaaS')+'** is the strongest starting point for these requirements. '+(best?.strengths||'Favor clear task hierarchy.')+'.',
    '**Trade-off:** '+(best?.tradeoff||'Avoid unnecessary visual complexity')+'.',
    '',
    '## Suggested pages and flow',
    ...analysis.pages.slice(0,9).map(page=>'- '+page),
    mainFeature?'**Primary task:** Open '+mainFeature.page+', '+mainFeature.action+', then confirm success or show a recovery path.':'**Primary task:** Confirm the user’s most important action before finalizing navigation.',
    '',
    '## Practical next step',
    focus,
    '',
    '*'+unavailableNote+' This is brief-based guidance, not a live model answer. Generate UI/UX can still produce a complete copyable specification.*',
    ...(failure.reason==='rate-limited'?['*Do not repeatedly press Retry while the provider is rate-limited.*']:
      ['*You may use Retry with OpenRouter to try again.*'])
  ];
  return {text:lines.join('\n'),source:'guide',
    failureReason:failure.reason,retryAfterSeconds:failure.retryAfterSeconds||0};
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
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.googleusercontent.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
  if(req.method==='GET'&&req.url==='/api/health')return json(res,200,{status:'ok',database:pg?'connected':'demo-memory',ai:aiConfig().aiEnabled,revision:deployedRevision()});
  let owner=cookie(req,res);
  const guestOwner=owner;
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(req.method==='GET'&&pathname==='/auth/google/start')return await authGateway.start(req,res);
    if(req.method==='GET'&&pathname==='/auth/callback')return await authGateway.callback(req,res,
      user=>claimGuestData(guestOwner,authGateway.accountOwner(user)));
    if(req.url?.startsWith('/api/')){
      if(!trustedMutationOrigin(req))return json(res,403,{error:'Cross-origin changes are not permitted.'});
      if(req.method==='GET'&&pathname==='/api/auth/status')
        return json(res,200,{googleEnabled:authGateway.ready});
      const signedIn=await authGateway.getUser(req,res);
      if(signedIn)owner=authGateway.accountOwner(signedIn);
      // Rate-limit by VERIFIED account identity, not an untrusted guest cookie
      // that an authenticated user can rotate to evade an account limit.
      if(rateLimited(owner))return json(res,429,{error:'Too many requests. Try again shortly.'});
      if(req.method==='GET'&&pathname==='/api/auth/me')return json(res,200,{
        authenticated:!!signedIn,googleEnabled:authGateway.ready,
        user:signedIn?{id:signedIn.id,email:signedIn.email||null,
          name:String(signedIn.user_metadata?.full_name||'').slice(0,120),
          picture:googleProfileImage(signedIn.user_metadata?.avatar_url||signedIn.user_metadata?.picture)}:null
      });
      if(req.method==='GET'&&pathname==='/api/auth/security'){
        return json(res,200,{authenticated:!!signedIn,
          accountDeletionAvailable:!!signedIn&&authGateway.deletionAvailable,
          recentGoogleVerification:!!signedIn&&authGateway.recentlyVerified(req,signedIn),
          strictSessionValidation:process.env.FRONTLINE_STRICT_SESSION_CHECK==='true'});
      }
      if(req.method==='POST'&&pathname==='/api/auth/logout'){
        const body=await readBody(req);
        const scope=body.scope===undefined?'local':body.scope;
        if(!['local','global','others'].includes(scope))
          return json(res,400,{error:'Invalid sign-out scope.'});
        if(scope!=='local'&&!signedIn)
          return json(res,401,{error:'Sign in before managing other devices.'});
        if(scope==='global'&&body.confirmation!=='SIGN OUT EVERYWHERE')
          return json(res,400,{error:'Confirm signing out of all devices.'});
        const result=await authGateway.logout(req,res,{scope});
        return json(res,200,{signedOut:scope!=='others',scope:result.scope});
      }
      if(req.method==='DELETE'&&pathname==='/api/auth/account'){
        const body=await readBody(req);
        if(!signedIn)return json(res,401,{error:'Sign in to delete your account.'});
        if(!authGateway.deletionAvailable)
          return json(res,503,{error:'Permanent account deletion requires secure administrator setup. No data was changed.'});
        if(!authGateway.recentlyVerified(req,signedIn))
          return json(res,403,{error:'Verify your identity with Google again before deleting your account.'});
        if(body.confirmation!=='DELETE FRONTLINE ACCOUNT'||body.email!==signedIn.email)
          return json(res,400,{error:'Type the exact confirmation phrase and account email.'});
        // Preflight the server-only Admin API before any destructive operation.
        await authGateway.verifyDeleteAbility(signedIn);
        // Delete every owner-scoped table transactionally. This cannot be
        // atomic with the external Supabase Auth API, so failed auth cleanup
        // returns a retryable, truthful partial failure.
        await eraseProfile(owner);
        try{await authGateway.deleteAuthUser(signedIn);}
        catch{return json(res,503,{error:'Your Frontline workspace was erased, but account sign-in removal could not finish. Please retry account deletion after re-verifying with Google.'});}
        authGateway.clearLocalSession(res);
        return json(res,200,{accountDeleted:true,workspaceDeleted:true});
      }
      if(req.method==='POST'&&pathname==='/api/auth/claim'){
        await readBody(req);
        if(!signedIn)return json(res,401,{error:'Sign in to sync your private workspace.'});
        await claimGuestData(guestOwner,owner);
        return json(res,200,{claimed:true});
      }
      if(req.method==='GET'&&req.url==='/api/config')return json(res,200,{...aiConfig(),persistent:!!pg,version:'0.4.0'});
      if(req.method==='GET'&&req.url==='/api/catalog')return json(res,200,{styles:STYLES,references:await listReferences(),source:'https://www.webdesignawards.io/categories/ui-ux-design'});
      if(req.method==='GET'&&req.url==='/api/profile')return json(res,200,await profile(owner));
      if(req.method==='PUT'&&req.url==='/api/profile'){
        const data=await readBody(req);const old=await profile(owner);
        if(typeof data.globalOptIn!=='boolean')return json(res,400,{error:'Choose whether to opt into aggregated learning.'});
        const p={...old,globalOptIn:data.globalOptIn===true&&old.personalization.enabled};
        if(!p.globalOptIn)await revokeSharedFeedback(owner);
        await saveProfile(owner,p);return json(res,200,p);
      }
      if(req.method==='GET'&&req.url==='/api/preferences'){
        return json(res,200,{profile:await profile(owner),evidence:await feedbackEvidence(owner),
          note:'Only feedback and design choices from this visitor; no private conversations shared.'});
      }
      if(req.method==='PUT'&&req.url==='/api/preferences'){
        const input=await readBody(req);
        let next;
        try{next=applyPreferenceChanges(await profile(owner),input);}
        catch(error){return json(res,400,{error:error.message});}
        if(!next.personalization.enabled)await revokeSharedFeedback(owner);
        await saveProfile(owner,next);
        return json(res,200,{profile:next,evidence:await feedbackEvidence(owner)});
      }
      if(req.method==='DELETE'&&req.url==='/api/preferences'){
        const next=resetPreferenceLearning(await profile(owner));
        await clearPreferenceFeedback(owner);
        await saveProfile(owner,next);
        return json(res,200,{profile:next,evidence:await feedbackEvidence(owner),
          note:'Preferences and private feedback cleared. Projects and chats were preserved.'});
      }
      if(req.method==='DELETE'&&req.url==='/api/profile'){
        await eraseProfile(owner);return json(res,200,{deleted:true});
      }
      if(req.method==='GET'&&req.url==='/api/insights')return json(res,200,{
        publicPatterns:await insights(),minimumContributors:5,
        contributorUnit:'distinct guest visitor IDs, not verified people',
        counts:'privacy bands only; not precise totals or statistical findings',
      });
      if(req.method==='GET'&&pathname==='/api/workspace/overview')
        return json(res,200,{identity:signedIn?'account':'guest',...(await workspaceOverview(owner))});
      if(req.method==='GET'&&pathname==='/api/workspace/export')
        return json(res,200,await workspaceExport(owner,!!signedIn));
      if(req.method==='GET'&&pathname==='/api/projects'){
        const offsetText=new URL(req.url,'http://localhost').searchParams.get('offset');
        if(offsetText!==null&&(!/^(0|[1-9][0-9]{0,4})$/.test(offsetText)||Number(offsetText)>10000))
          return json(res,400,{error:'Invalid project offset'});
        return json(res,200,await listProjects(owner,Number(offsetText||0)));
      }
      if(req.method==='POST'&&pathname==='/api/projects'){
        const b=await readBody(req);if(!validateText(b.brief,15,2500))return json(res,400,{error:'Describe your project in 15–2,500 characters.'});
        const prefs=effectivePreferences(await profile(owner));const recommendations=recommend(b.brief,prefs,await listReferences());const id=crypto.randomUUID();
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
        const [refs,raw]=await Promise.all([savedSourceRows(owner,id),profile(owner)]);
        const prefs=effectivePreferences(raw);
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
        if(!hasFinalized&&prefs.personalization.enabled){
          let next=prefs;
          for(const style of styleIds)next=learnStyle(next,style,'finalized');
          await saveProfile(owner,next);
        }
        return json(res,200,{...result,styles:styleIds,references:refs.map(x=>x.id)});
      }
      const projectMatch=new URL(req.url,'http://localhost').pathname.match(/^\/api\/projects\/([a-f0-9-]{36})(\/messages|\/export)?$/);
      if(projectMatch){
        const id=projectMatch[1],action=projectMatch[2];const p=await getProject(owner,id);
        if(!p)return json(res,404,{error:'Project not found'});
        if(req.method==='GET'&&!action){
          // Older saved projects did not have an intelligence snapshot. Enrich the
          // response without writing to the user's PostgreSQL project history.
          const prefs=effectivePreferences(await profile(owner));
          // Refresh derived intelligence for previously saved projects without mutating
          // stored messages, recommendations, or their PostgreSQL rows.
          const analysis=analyzeProject(p.brief,{category:p.recommendations?.category});
          const comparison=compareDirections(analysis,STYLES,prefs);
          const recommendations={...p.recommendations,analysis,comparison,
            designs:(p.recommendations?.designs||[]).map(d=>{
              const found=comparison.find(c=>c.id===d.id);
              return found?{...d,match:found.match,tradeoff:found.tradeoff,strengths:found.strengths,
                criteria:found.criteria,scoring:found.scoring,reasons:found.reasons,
                personalization:found.personalization}:d;
            })};
          return json(res,200,{project:{...p,recommendations}});
        }
        if(req.method==='POST'&&action==='/messages'){
          const b=await readBody(req);if(!validateText(b.message,2,1200))return json(res,400,{error:'Message must be 2–1,200 characters.'});
          if(!Array.isArray(b.styles)||b.styles.some(s=>!STYLES.some(t=>t.id===s)))return json(res,400,{error:'Invalid styles'});
          const messages=(Array.isArray(p.messages)?p.messages:[]).slice(-24);
          messages.push({role:'user',content:b.message.trim(),time:new Date().toISOString()});
          const response=await chatReply(p.brief,messages,b.styles,await profile(owner));messages.push({role:'assistant',content:response.text,source:response.source,
            ...(response.provider?{provider:response.provider}:{}),
            ...(response.failureReason?{failureReason:response.failureReason}:{}),
            ...(response.retryAfterSeconds?{retryAfterUntil:new Date(Date.now()+response.retryAfterSeconds*1000).toISOString()}:{}),
            time:new Date().toISOString()});
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
        const saved=await recordFeedback(owner,p.id,selected,b.reaction,detail);
        return json(res,200,saved);
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