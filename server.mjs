import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createAuthGateway} from './auth-gateway.mjs';
import {createGitHubAppConnection} from './github-app-connect.mjs';
import {fileURLToPath} from 'node:url';
import {recommend,STYLES,exportPrompt} from './design-engine.mjs';
import {discoverLiveSources} from './live-source-discovery.mjs';
import {rankInspirations} from './inspiration-engine.mjs';
import {aiConfig,designAiReply} from './ai-providers.mjs';
import {createDesignPrompt} from './design-intelligence.mjs';
import {analyzeProject,compareDirections,inspectAdvisorScope} from './project-intelligence.mjs';
import {derivePrivateLearning,contextForCategory,publicLearningSummary,
  verifiedCohortBand,VERIFIED_COHORT_MIN,summarizeVerifiedPatterns} from './contextual-learning.mjs';
import {buildDesignHandoff,designHandoffMarkdown} from './design-handoff.mjs';
import {validateGitHubPublishInput,publishApprovedHandoff} from './github-handoff.mjs';
import {normalizeWorkspace,validateBoardUpdate,requireRevision,withUpdatedBoard,
  addCheckpoint,restoreCheckpoint,compareCheckpoint} from './project-workspace.mjs';
import {normalizeProfile,persistableWeights,effectivePreferences,learnStyle,applyPreferenceChanges,
  resetPreferenceLearning,preferenceHints,learnFeedbackTransition,latestFeedbackChoices,visitorCohortBand} from './learning-engine.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||3000);
const MAX_BODY=12_000;
const live=new Map();
const guests=new Map();
const votes=[];
const memorySelections=new Map();
const memoryLiveReferences=new Map();
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
const githubApp=()=>createGitHubAppConnection({
  clientId:process.env.FRONTLINE_GITHUB_APP_CLIENT_ID||'',
  clientSecret:process.env.FRONTLINE_GITHUB_APP_CLIENT_SECRET||'',
  encryptionKey:process.env.FRONTLINE_GITHUB_ENCRYPTION_KEY||'',
  stateSecret:process.env.FRONTLINE_ACTION_SIGNING_SECRET||'',
  siteUrl:process.env.FRONTLINE_SITE_URL||'https://ui-compass-studio.onrender.com',
  db:pg,prod:isProd||Boolean(process.env.RENDER_SERVICE_ID)
});

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
  if(!pg)return [...memoryLiveReferences.values()];
  const result=await pg.query(`SELECT id,name,site,award,category,styles,tags,summary,
    rank,score,source_provider AS provider,source_kind AS "sourceKind"
    FROM frontline.design_sources WHERE active=true AND is_live_discovered=true
    ORDER BY source_indexed_at DESC LIMIT 250`);
  return result.rows;
}
// Store original URLs returned by an authorized search index for use in
// private saved boards. Cached records are NEVER served as default suggestions.
async function storeDiscoveredReferences(rows){
  if(!Array.isArray(rows)||!rows.length)return;
  if(!pg){for(const row of rows)memoryLiveReferences.set(row.id,row);return;}
  const safe=rows.map(r=>({
    id:r.id,name:r.name,site:r.site,category:r.category,
    tags:r.tags||[],styles:r.styles||[],provider:r.provider||'',kind:r.sourceKind||''
  }));
  await pg.query(`INSERT INTO frontline.design_sources
    (id,name,site,category,tags,styles,summary,active,is_live_discovered,source_provider,source_kind,source_indexed_at)
    SELECT x.id,x.name,x.site,x.category,x.tags,x.styles,'',true,true,x.provider,x.kind,NOW()
    FROM jsonb_to_recordset($1::jsonb) AS x(
      id text,name text,site text,category text,tags text[],styles text[],
      provider text,kind text
    )
    ON CONFLICT (id) DO UPDATE SET
      name=EXCLUDED.name,site=EXCLUDED.site,category=EXCLUDED.category,
      tags=EXCLUDED.tags,styles=EXCLUDED.styles,active=true,
      is_live_discovered=true,source_provider=EXCLUDED.source_provider,
      source_kind=EXCLUDED.source_kind,source_indexed_at=NOW()`,
    [JSON.stringify(safe)]);
}
async function selectionIds(owner,projectId){
  if(!pg)return [...(memorySelections.get(owner+':'+projectId)||new Set())];
  const r=await pg.query(`SELECT r.source_id FROM frontline.reference_selections r
    JOIN frontline.design_sources s ON s.id=r.source_id
    WHERE r.visitor_id=$1 AND r.project_id=$2 AND r.selected=true AND s.is_live_discovered=true
    ORDER BY r.created_at ASC`,[owner,projectId]);
  return r.rows.map(x=>x.source_id);
}
async function personalInspirationTags(owner){
  if(!pg){
    const ids=new Set();
    for(const [key,values] of memorySelections){if(key.startsWith(owner+':'))for(const value of values)ids.add(value);}
    return [...memoryLiveReferences.values()].filter(x=>ids.has(x.id)).flatMap(x=>x.tags||[]).slice(0,60);
  }
  const r=await pg.query(`SELECT s.tags FROM frontline.reference_selections r
    JOIN frontline.design_sources s ON s.id=r.source_id
    WHERE r.visitor_id=$1 AND r.selected=true AND s.is_live_discovered=true ORDER BY r.created_at DESC LIMIT 60`,[owner]);
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
  if(!pg)return ids.map(id=>memoryLiveReferences.get(id)).filter(Boolean).slice(0,8);
  // Query the owner's selected rows directly; a global top-250 source index
  // would silently lose old private selections as other users discover links.
  const result=await pg.query(`SELECT s.id,s.name,s.site,s.award,s.category,
    s.styles,s.tags,s.summary,s.rank,s.score,s.source_provider AS provider,
    s.source_kind AS "sourceKind"
    FROM frontline.reference_selections r JOIN frontline.design_sources s ON s.id=r.source_id
    WHERE r.visitor_id=$1 AND r.project_id=$2 AND r.selected=true
      AND s.is_live_discovered=true
    ORDER BY r.created_at ASC LIMIT 8`,[owner,projectId]);
  return result.rows;
}
async function makeInspirationResponse(owner,project){
  const [discovery,raw,picks,personalTags]=await Promise.all([
    discoverLiveSources(project.brief),profile(owner),selectionIds(owner,project.id),personalInspirationTags(owner)
  ]);
  if(discovery.matches.length)await storeDiscoveredReferences(discovery.matches);
  // Saved historical LIVE results may be retained for continuity, but are
  // never substituted for a current search when discovery fails.
  const saved=await savedSourceRows(owner,project.id);
  const seen=new Set(discovery.matches.map(x=>x.id));
  const refs=[...discovery.matches,...saved.filter(x=>!seen.has(x.id))];
  const index=new Map(refs.map(r=>[r.id,r]));
  const prefs=effectivePreferences(raw);
  const matches=rankInspirations(project.brief,refs,{
    styleWeights:prefs.personalization.enabled?prefs.styleWeights||{}:{},
    favoriteTags:prefs.personalization.enabled?personalTags:[]
  }).map(item=>{
    const source=index.get(item.id);
    return {...item,provider:source.provider||'',sourceKind:source.sourceKind||'',
      originalPromptStatus:'not-verified',originalPromptUrl:null,
      provenance:'Indexed URL from original publisher; no publisher prompt has been licensed or verified.'};
  });
  return {projectId:project.id,matches,selected:picks.filter(id=>index.has(id)),
    librarySize:discovery.matches.length,rankingVersion:3,
    discovery:{status:discovery.status,note:discovery.note,query:discovery.query,
      providers:discovery.providerStatus||[]},sources:discovery.sources,
    ranking:'Live search-index metadata only. No fake prompts, stored website leaderboard, or third-party screenshots.'};
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
// Read only final feedback per owned project+style. This is NOT a transcript
// mining job and never accepts an account/visitor ID from the browser.
async function privateLearning(owner,excludedProjectId=null){
  if(!pg){
    const rows=latestFeedbackChoices(votes.filter(v=>v.owner===owner))
      .filter(v=>v.id!==excludedProjectId)
      .map(v=>({projectId:v.id,style:v.style,reaction:v.reaction,
        category:live.get(v.id)?.recommendations?.category||'Digital product'}));
    return derivePrivateLearning(rows);
  }
  const result=await pg.query(`WITH latest AS (
    SELECT DISTINCT ON (f.project_id,f.style_id)
      f.project_id::text AS "projectId",f.style_id AS style,f.reaction,
      COALESCE(p.recommendation->>'category','Digital product') AS category,
      f.created_at AS "createdAt"
    FROM frontline.uic_feedback f
    JOIN frontline.uic_projects p ON p.id=f.project_id AND p.visitor_id=$1
    WHERE f.visitor_id=$1 AND ($2::uuid IS NULL OR f.project_id<>$2::uuid)
    ORDER BY f.project_id,f.style_id,f.created_at DESC,f.id DESC
  ) SELECT * FROM latest ORDER BY "createdAt" DESC LIMIT 600`,
    [owner,excludedProjectId]);
  return derivePrivateLearning(result.rows);
}
async function recommendationPreferences(owner,brief,excludedProjectId=null,raw=null){
  const current=effectivePreferences(raw||await profile(owner));
  if(!current.personalization.enabled)return current;
  const category=analyzeProject(brief).category;
  const learning=await privateLearning(owner,excludedProjectId);
  return {...current,contextLearning:contextForCategory(learning,category,true)};
}
async function learningOverview(owner){
  const raw=await profile(owner);
  const model=await privateLearning(owner);
  return {version:model.version,enabled:raw.personalization.enabled,
    categories:publicLearningSummary(model),
    projectChoices:model.projectChoices,
    note:'Only your last explicit reaction per project/style. Signals require multiple projects and are not trained AI or measured usability.'};
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
async function updateRecommendations(owner,id,recommendations){
  // Intelligence refresh must preserve the independent user's design board.
  // This is done atomically even when two devices save at the same time.
  if(!pg){
    const entry=live.get(id);
    if(!entry||entry.owner!==owner)return null;
    entry.recommendations={...recommendations,
      _workspace:entry.recommendations?._workspace||{}};
    entry.updatedAt=new Date().toISOString();
    live.set(id,entry);
    return entry.recommendations;
  }
  const result=await pg.query(`UPDATE frontline.uic_projects SET
    recommendation=jsonb_set($1::jsonb,'{_workspace}',
      COALESCE(recommendation->'_workspace','{}'::jsonb),true),
    updated_at=NOW()
    WHERE id=$2 AND visitor_id=$3 RETURNING recommendation AS recommendations`,
    [JSON.stringify(recommendations),id,owner]);
  return result.rows[0]?.recommendations||null;
}
// One owner-scoped row-lock/revision gate for every board and checkpoint
// mutation. No extra public tables, privileged database keys or chat rewrites.
const inMemoryWorkspaceLocks=new Map();
async function modifyProjectWorkspace(owner,id,revision,build){
  const readAndBuild=async project=>{
    if(!project)return null;
    const old=normalizeWorkspace(project.recommendations?._workspace);
    requireRevision(old,revision);
    const proposal=await build(project,old);
    if(!proposal?.workspace)throw Object.assign(new Error('Invalid workspace edit.'),{status:400});
    const updated=proposal.recommendation||project.recommendations||{};
    return {...project,recommendations:{...updated,_workspace:proposal.workspace},
      workspace:proposal.workspace};
  };
  if(!pg){
    const key=owner+':'+id;
    const previous=inMemoryWorkspaceLocks.get(key)||Promise.resolve();
    let release;
    const pending=new Promise(resolve=>{release=resolve});
    inMemoryWorkspaceLocks.set(key,pending);
    await previous;
    try{
      const project=live.get(id);
      const next=await readAndBuild(project?.owner===owner?project:null);
      if(!next)return null;
      next.updatedAt=new Date().toISOString();
      const {workspace:responseOnly,...stored}=next;
      live.set(id,stored);
      return next;
    }finally{
      release();
      if(inMemoryWorkspaceLocks.get(key)===pending)inMemoryWorkspaceLocks.delete(key);
    }
  }
  const client=await pg.connect();
  try{
    await client.query('BEGIN');
    const row=await client.query(`SELECT id,title,brief,recommendation AS recommendations
      FROM frontline.uic_projects WHERE id=$1 AND visitor_id=$2 FOR UPDATE`,[id,owner]);
    const next=await readAndBuild(row.rows[0]);
    if(!next){await client.query('ROLLBACK');return null;}
    await client.query(`UPDATE frontline.uic_projects SET recommendation=$1,updated_at=NOW()
      WHERE id=$2 AND visitor_id=$3`,[JSON.stringify(next.recommendations),id,owner]);
    await client.query('COMMIT');
    return next;
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client.release();}
}
async function updateMessages(owner,id,messages){
  if(!pg){const p=live.get(id);if(p?.owner===owner){p.messages=messages;p.updatedAt=new Date().toISOString();live.set(id,p);}return;}
  await pg.query('UPDATE frontline.uic_projects SET messages=$1,updated_at=NOW() WHERE id=$2 AND visitor_id=$3',[JSON.stringify(messages),id,owner]);
}
// Paginate owner-scoped history so accounts with more than 50 conversations
// can actually reach their full history without fetching every chat message.
const PROJECT_PAGE_SIZE=50;
function compactRecommendationForList(value){
  const rec=value&&typeof value==='object'?value:{};
  const board=normalizeWorkspace(rec._workspace);
  // A dashboard only needs counts; never send 12 stored full board snapshots
  // for every item in a 50-project page.
  return {...rec,_workspace:{itemCount:board.items.length,
    versionCount:board.versions.length}};
}
async function listProjects(owner,offset=0){
  if(!pg){
    const mine=[...live.values()].filter(x=>x.owner===owner).reverse().map(({owner:_,messages,...p})=>({
      ...p,recommendations:compactRecommendationForList(p.recommendations),
      updatedAt:p.updatedAt||p.createdAt,
      messageCount:messages?.length||0,
      inspirationCount:memorySelections.get(owner+':'+p.id)?.size||0,
      promptCount:[...finalizedModes].filter(k=>k.startsWith(owner+':'+p.id+':')).length
    }));
    return {projects:mine.slice(offset,offset+PROJECT_PAGE_SIZE),
      nextOffset:offset+PROJECT_PAGE_SIZE<mine.length?offset+PROJECT_PAGE_SIZE:null};
  }
  const r=await pg.query(`SELECT p.id,p.title,p.brief,
    (COALESCE(p.recommendation,'{}'::jsonb)-'_workspace') ||
      jsonb_build_object('_workspace',jsonb_build_object(
        'itemCount',CASE WHEN jsonb_typeof(p.recommendation #> '{_workspace,items}')='array'
          THEN jsonb_array_length(p.recommendation #> '{_workspace,items}') ELSE 0 END,
        'versionCount',CASE WHEN jsonb_typeof(p.recommendation #> '{_workspace,versions}')='array'
          THEN jsonb_array_length(p.recommendation #> '{_workspace,versions}') ELSE 0 END
      )) AS recommendations,
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
// Consent, pause, and erase must use the SAME visitor lock as feedback
// writes. In PostgreSQL the operation is one transaction; neither a stale
// opt-in nor a half-cleared profile should survive a concurrent request.
async function updateLearningSettings(owner,{kind,value}){
  const change=current=>{
    if(kind==='consent')return {...current,
      globalOptIn:value===true&&current.personalization.enabled};
    if(kind==='settings')return applyPreferenceChanges(current,value);
    if(kind==='reset')return resetPreferenceLearning(current);
    throw new Error('Unknown learning operation');
  };
  if(!pg){
    const previous=memoryFeedbackGates.get(owner)||Promise.resolve();
    let release;
    const pending=new Promise(resolve=>{release=resolve;});
    memoryFeedbackGates.set(owner,pending);
    await previous;
    try{
      const next=change(await profile(owner));
      if(kind==='reset'){
        for(let i=votes.length-1;i>=0;i--)
          if(votes[i].owner===owner)votes.splice(i,1);
      }
      if(!next.globalOptIn||!next.personalization.enabled)
        for(const vote of votes)if(vote.owner===owner)vote.optIn=false;
      await saveProfile(owner,next);
      return next;
    }finally{
      release();
      if(memoryFeedbackGates.get(owner)===pending)memoryFeedbackGates.delete(owner);
    }
  }
  const client=await pg.connect();
  try{
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1),712)',[owner]);
    const state=await client.query(`SELECT style_weights,global_opt_in FROM frontline.uic_profiles
      WHERE visitor_id=$1 FOR UPDATE`,[owner]);
    const current=normalizeProfile(state.rows[0]?{
      styleWeights:state.rows[0].style_weights,globalOptIn:state.rows[0].global_opt_in
    }:{});
    const next=change(current);
    if(kind==='reset')await client.query(
      'DELETE FROM frontline.uic_feedback WHERE visitor_id=$1',[owner]);
    if(!next.globalOptIn||!next.personalization.enabled)
      await client.query('UPDATE frontline.uic_feedback SET eligible_global=false WHERE visitor_id=$1',[owner]);
    await client.query(`INSERT INTO frontline.uic_profiles(visitor_id,style_weights,global_opt_in)
      VALUES($1,$2,$3) ON CONFLICT(visitor_id) DO UPDATE
      SET style_weights=EXCLUDED.style_weights,global_opt_in=EXCLUDED.global_opt_in,updated_at=NOW()`,
      [owner,JSON.stringify(persistableWeights(next)),next.globalOptIn]);
    await client.query('COMMIT');
    return next;
  }catch(error){
    await client.query('ROLLBACK').catch(()=>{});
    throw error;
  }finally{client.release();}
}
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
// Shared trends are deliberately display-only: NEVER feed them into the
// personalized recommendation ranking. A browser cookie is not a person.
// Ten distinct verified account identities must independently have positive
// net feedback for one style, with currently active opt-in and consent on each
// counted historical event. No names, project IDs or precise counts leave.
async function insights(){
  let counts;
  if(pg){
    const result=await pg.query(`WITH latest AS (
      SELECT DISTINCT ON (visitor_id,project_id,style_id)
        visitor_id,style_id,reaction,eligible_global
      FROM frontline.uic_feedback
      WHERE visitor_id LIKE 'acct:%'
      ORDER BY visitor_id,project_id,style_id,created_at DESC,id DESC
    ), eligible AS (
      SELECT f.visitor_id,f.style_id,
        SUM(CASE WHEN f.reaction='like' THEN 1
                 WHEN f.reaction='dislike' THEN -1 ELSE 0 END)::int AS net
      FROM latest f
      JOIN frontline.uic_profiles p ON p.visitor_id=f.visitor_id
      WHERE f.eligible_global=true AND p.global_opt_in=true
        AND COALESCE(p.style_weights->'_personalization'->>'enabled','true')='true'
      GROUP BY f.visitor_id,f.style_id
    )
    SELECT style_id,COUNT(*)::int AS contributors
    FROM eligible WHERE net>0 GROUP BY style_id`);
    counts=result.rows;
  }else{
    const acceptedOwners=[...new Set(votes.map(v=>v.owner))]
      .filter(owner=>owner.startsWith('acct:'));
    const eligibleProfiles=new Map();
    for(const owner of acceptedOwners)eligibleProfiles.set(owner,await profile(owner));
    return summarizeVerifiedPatterns(latestFeedbackChoices(votes),eligibleProfiles);
  }
  return counts.filter(x=>x.contributors>=VERIFIED_COHORT_MIN).map(x=>({
    style:x.style_id,contributorsBand:verifiedCohortBand(x.contributors),
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
    // Account erasure also removes the encrypted GitHub authorization.
    if((await client.query("SELECT to_regclass('frontline.github_app_connections') IS NOT NULL AS available")).rows[0]?.available)
      await client.query('DELETE FROM frontline.github_app_connections WHERE account_owner=$1',[owner]);
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
async function readBody(req,limit=MAX_BODY){
  // Cookie-authenticated writes must be JSON. Browsers cannot silently submit
  // this content type from a cross-site HTML form.
  if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json')
    throw Object.assign(new Error('Use application/json for API writes.'),{status:415});
  let buff='';for await(const part of req){
    buff+=part;
    if(Buffer.byteLength(buff,'utf8')>limit)
      throw Object.assign(new Error('Request too large'),{status:413});
  }
  try{return JSON.parse(buff||'{}')}catch{throw Object.assign(new Error('Invalid JSON'),{status:400})}
}
function trustedMutationOrigin(req){
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return true;
  const fetchSite=req.headers['sec-fetch-site'];
  // Browsers mark requests from another origin even if their Origin header
  // is omitted; reject those cookie-authenticated state changes.
  if(fetchSite&&fetchSite!=='same-origin'&&fetchSite!=='none')return false;
  if(!req.headers.origin)return true;
  try{
    const origin=new URL(req.headers.origin).origin;
    // Render runs npm test during a production build, where the host flag
    // exists but NODE_ENV=test and the isolated test server is localhost.
    // Use the exact test Origin locally; LIVE requests still require HTTPS
    // and the configured production FRONTLINE_SITE_URL.
    const production=process.env.NODE_ENV==='test'?false:
      Boolean(process.env.RENDER_SERVICE_ID)||isProd;
    const expected=production?
      new URL(process.env.FRONTLINE_SITE_URL||'https://ui-compass-studio.onrender.com').origin:
      'http://'+req.headers.host;
    return origin===expected;
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
  const analysis=analyzeProject(brief);
  const excluded=analysis.excludedFeatures?.map(f=>f.label)||[];
  const scopedBrief=brief+(excluded.length?'\nExplicitly out of scope: '+excluded.join('; '):'');
  // Tests never consume real API quotas or send content to model providers.
  let failure={reason:'provider-unavailable',retryAfterSeconds:0};
  const ai=process.env.NODE_ENV==='test'?null:await designAiReply({
    brief:scopedBrief,messages,styles:chosen,designPreferences:preferenceHints(preferences),
    onFailure:info=>{failure=info}
  });
  if(ai){
    if(inspectAdvisorScope(ai.text,analysis).passed)return ai;
    failure={reason:'scope-conflict',retryAfterSeconds:0};
  }
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
        :failure.reason==='scope-conflict'
          ?'The AI suggestion contradicted an explicitly excluded capability, so Frontline used a scoped design guide instead.'
          :'OpenRouter did not provide an answer for this request.';
  const lines=[
    '## Project understanding',
    '**Audience:** '+audience,
    '**Requested modules:** '+(analysis.features.length?analysis.features.map(f=>f.label).join('; '):'No modules explicitly identified yet.'),
    '**Constraints:** '+(analysis.constraints.length?analysis.constraints.join('; '):'Responsive, accessible defaults proposed.'),
    '**Explicitly out of scope:** '+(excluded.length?excluded.join('; '):'No exclusions stated.'),
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
  const allowed=/^\/(?:index\.html|favicon\.svg|robots\.txt|manifest\.webmanifest|service-worker\.js|pwa-icon(?:-maskable)?\.svg|assets\/[a-zA-Z0-9_.-]+\.(?:js|css|png|svg|woff|woff2))$/;
  if(!allowed.test(name))return json(res,404,{error:'Not found'});
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json','.woff':'font/woff','.woff2':'font/woff2'};
  try{
    const data=await fs.readFile(path.join(root,'dist',name));
    const cacheControl=name==='/index.html'?'no-store':
      ['/service-worker.js','/manifest.webmanifest'].includes(name)?'no-cache':
      name.startsWith('/assets/')?'public, max-age=31536000, immutable':'public, max-age=86400';
    res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream',
      'Cache-Control':cacheControl,
      ...(name==='/service-worker.js'?{'Service-Worker-Allowed':'/'}:{})});
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
    if(req.method==='GET'&&pathname==='/auth/google/start'){
      res.setHeader('Referrer-Policy','no-referrer');
      return await authGateway.start(req,res);
    }
    if(req.method==='GET'&&pathname==='/auth/callback'){
      // OAuth codes are one-time secrets. Prevent the callback URL from
      // appearing as the Referer on the final same-origin studio navigation.
      res.setHeader('Referrer-Policy','no-referrer');
      return await authGateway.callback(req,res,
        user=>claimGuestData(guestOwner,authGateway.accountOwner(user)));
    }
    if(req.method==='GET'&&(pathname==='/auth/github/start'||pathname==='/auth/github/callback')){
      res.setHeader('Referrer-Policy','no-referrer');
      const user=await authGateway.getUser(req,res);
      const github=githubApp();
      if(pathname==='/auth/github/start')
        return await github.start(req,res,user?authGateway.accountOwner(user):'');
      return await github.callback(req,res,user?authGateway.accountOwner(user):'');
    }
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
      if(pathname==='/api/integrations/github'){
         if(req.method==='GET')return json(res,200,await githubApp().status(signedIn?owner:''));
         if(req.method==='DELETE'){
           await readBody(req);
           if(!signedIn)return json(res,401,{error:'Sign in before disconnecting GitHub.'});
           return json(res,200,await githubApp().disconnect(owner));
         }
         return json(res,405,{error:'Method not allowed'});
       }
       if(req.method==='GET'&&req.url==='/api/config')return json(res,200,{...aiConfig(),persistent:!!pg,version:'0.4.0'});
      if(req.method==='GET'&&req.url==='/api/catalog')return json(res,200,{styles:STYLES,references:[],source:'live-original-source-discovery'});
      if(req.method==='GET'&&req.url==='/api/profile')return json(res,200,await profile(owner));
      if(req.method==='PUT'&&req.url==='/api/profile'){
        const data=await readBody(req);
        if(typeof data.globalOptIn!=='boolean')return json(res,400,{error:'Choose whether to opt into aggregated learning.'});
        if(data.globalOptIn===true&&!signedIn)return json(res,403,{
          error:'Sign in with Google before opting into shared trends. Guest identities are not verified contributors.'});
        const next=await updateLearningSettings(owner,{kind:'consent',value:data.globalOptIn});
        return json(res,200,next);
      }
      if(req.method==='GET'&&req.url==='/api/preferences'){
        const [current,evidence,learning]=await Promise.all([
          profile(owner),feedbackEvidence(owner),learningOverview(owner)]);
        return json(res,200,{profile:current,evidence,learning,
          note:'Contextual learning is private to this visitor. Explicit project requirements override learned style preferences.'});
      }
      if(req.method==='PUT'&&req.url==='/api/preferences'){
        const input=await readBody(req);
        let next;
        try{next=await updateLearningSettings(owner,{kind:'settings',value:input});}
        catch(error){if(/preference|learning|style/i.test(error.message))return json(res,400,{error:error.message});throw error;}
        return json(res,200,{profile:next,evidence:await feedbackEvidence(owner),
          learning:await learningOverview(owner)});
      }
      if(req.method==='DELETE'&&req.url==='/api/preferences'){
        const next=await updateLearningSettings(owner,{kind:'reset'});
        return json(res,200,{profile:next,evidence:await feedbackEvidence(owner),
          learning:await learningOverview(owner),
          note:'Preferences and private feedback cleared. Projects and chats were preserved.'});
      }
      if(req.method==='DELETE'&&req.url==='/api/profile'){
        await eraseProfile(owner);return json(res,200,{deleted:true});
      }
      if(req.method==='GET'&&req.url==='/api/insights')return json(res,200,{
        publicPatterns:await insights(),minimumContributors:VERIFIED_COHORT_MIN,
        contributorUnit:'distinct authenticated Google-linked Frontline accounts; not proven unique humans',
        counts:'coarse size bands only; no individual votes, account identifiers or chat data',
        personalizationUsage:'Shared trends are informational and do not automatically steer any user recommendations',
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
        const prefs=await recommendationPreferences(owner,b.brief);
        const recommendations=recommend(b.brief,prefs,[]);const id=crypto.randomUUID();
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
          const alreadySaved=(await selectionIds(owner,id)).includes(b.sourceId);
          const searched=b.selected?await makeInspirationResponse(owner,p):null;
          const found=b.selected?searched.matches.find(x=>x.id===b.sourceId):
            (await savedSourceRows(owner,id)).find(x=>x.id===b.sourceId&&alreadySaved);
          if(!found)return json(res,404,{error:'Source not found in this project live search.'});
          await updateInspirationSelection(owner,id,found.id,b.selected);
          return json(res,200,await makeInspirationResponse(owner,p));
        }
        if(req.method==='POST'&&action==='/prompt'){
          await readBody(req);
          // Never return a Frontline-created prompt under a publisher's name.
          const chosen=await savedSourceRows(owner,id);
          return json(res,409,{error:'Original prompts cannot be reproduced without authorized publisher access. Open original source pages instead.',
            sources:chosen.map(x=>({name:x.name,url:x.site,originalPromptStatus:'not-verified'}))});
        }
        return json(res,405,{error:'Method not allowed'});
      }
      // M14B: explicit one-time GitHub authorization, account-scoped, approved-only.
      const githubHandoffRoute=pathname.match(/^\/api\/projects\/([a-f0-9-]{36})\/github-handoff$/);
      if(githubHandoffRoute){
        if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
        if(!signedIn)return json(res,401,{error:'Sign in with Google before publishing to GitHub.'});
        const body=validateGitHubPublishInput(await readBody(req,1600));
        const project=await getProject(owner,githubHandoffRoute[1]);
        if(!project)return json(res,404,{error:'Project not found'});
        const workspace=normalizeWorkspace(project.recommendations?._workspace);
        requireRevision(workspace,body.revision);
        const handoff=buildDesignHandoff({
          project,workspace,references:await savedSourceRows(owner,project.id)
        });
        // The GitHub App token stays encrypted at rest and never reaches the browser.
         const publishToken=body.token||await githubApp().getToken(owner);
         const result=await publishApprovedHandoff({
          repository:body.repository,token:publishToken,projectId:project.id,
          title:project.title,markdown:designHandoffMarkdown(handoff)
        });
        return json(res,201,{...result,content:'Approved design handoff only; no chat, private feedback or tokens were stored.'});
      }
      // M13: private visual board and bounded, manually named checkpoints.
      const boardRoute=pathname.match(/^\/api\/projects\/([a-f0-9-]{36})\/workspace$/);
      if(boardRoute){
        const id=boardRoute[1];
        if(req.method==='GET'){
          const p=await getProject(owner,id);
          if(!p)return json(res,404,{error:'Project not found'});
          const selectedSources=await savedSourceRows(owner,id);
          return json(res,200,{projectId:id,workspace:normalizeWorkspace(p.recommendations?._workspace),
            refinement:p.recommendations?.refinement||'',
            comparisons:p.recommendations?.comparison||[],
            savedInspirations:selectedSources.map(ref=>({id:ref.id,name:ref.name,site:ref.site,styles:ref.styles}))});
        }
        if(req.method!=='PUT')return json(res,405,{error:'Method not allowed'});
        // Only the bounded board route needs more room for 24 cards with
        // short notes. Every other write retains the original 12 KB limit.
        const body=await readBody(req,24_000);
        const catalogue=new Set((await savedSourceRows(owner,id)).map(ref=>ref.id));
        const update=validateBoardUpdate(body,{referenceIds:catalogue});
        const next=await modifyProjectWorkspace(owner,id,update.revision,
          async(project,workspace)=>({workspace:withUpdatedBoard(workspace,update)}));
        if(!next)return json(res,404,{error:'Project not found'});
        return json(res,200,{projectId:id,workspace:next.workspace});
      }
      const versionsCreate=pathname.match(/^\/api\/projects\/([a-f0-9-]{36})\/workspace\/versions$/);
      if(versionsCreate){
        if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
        const id=versionsCreate[1],body=await readBody(req);
        const next=await modifyProjectWorkspace(owner,id,body.revision,
          async(project,workspace)=>({workspace:addCheckpoint(workspace,{
            revision:body.revision,title:body.title,
            refinement:project.recommendations?.refinement||'',
            id:crypto.randomUUID(),now:new Date().toISOString()
          })}));
        if(!next)return json(res,404,{error:'Project not found'});
        return json(res,201,{projectId:id,workspace:next.workspace});
      }
      const versionAction=pathname.match(
        /^\/api\/projects\/([a-f0-9-]{36})\/workspace\/versions\/([a-zA-Z0-9_-]{1,80})\/(compare|restore)$/);
      if(versionAction){
        const [,id,versionId,action]=versionAction;
        if(action==='compare'){
          if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
          const p=await getProject(owner,id);
          if(!p)return json(res,404,{error:'Project not found'});
          return json(res,200,{comparison:compareCheckpoint(
            normalizeWorkspace(p.recommendations?._workspace),
            versionId,p.recommendations?.refinement||'')});
        }
        if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
        const body=await readBody(req);
        const project=await getProject(owner,id);
        if(!project)return json(res,404,{error:'Project not found'});
        // Prefetch static catalogue and current private preferences outside the
        // row lock. A revision conflict still rejects a stale restoration.
        const prefs=await recommendationPreferences(owner,project.brief,id);
        const next=await modifyProjectWorkspace(owner,id,body.revision,
          async(current,workspace)=>{
            const restored=restoreCheckpoint(workspace,{
              revision:body.revision,versionId,now:new Date().toISOString()});
            return {workspace:restored.workspace,
              recommendation:recommend(current.brief,prefs,[],
                {refinement:restored.refinement})};
          });
        if(!next)return json(res,404,{error:'Project not found'});
        return json(res,200,{projectId:id,workspace:next.workspace,
          recommendations:next.recommendations,
          note:'Board and design refinement restored. Original brief, chat, prior prompts and all checkpoints were kept.'});
      }
      const intelligenceMatch=pathname.match(/^\/api\/projects\/([a-f0-9-]{36})\/intelligence$/);
      if(intelligenceMatch){
        const id=intelligenceMatch[1],project=await getProject(owner,id);
        if(!project)return json(res,404,{error:'Project not found'});
        if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
        const body=await readBody(req);
        if(typeof body.refinement!=='string'||body.refinement.length>450)
          return json(res,400,{error:'Refinement must be a string of 450 characters or fewer.'});
        const refinement=body.refinement.trim();
        if(refinement.length>0&&refinement.length<5)
          return json(res,400,{error:'Describe your change in at least five characters, or leave it empty to reset.'});
        const prefs=await recommendationPreferences(owner,project.brief,id);
        const next=recommend(project.brief,prefs,[],{refinement});
        const stored=await updateRecommendations(owner,id,next);
        if(!stored)return json(res,404,{error:'Project not found'});
        return json(res,200,{project:{...project,recommendations:stored},decision:next.decision});
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
          const prefs=await recommendationPreferences(owner,p.brief,id);
          // Recompute only derived heuristic/evidence fields using the
          // original brief plus the saved explicit refinement. Project text,
          // private history and approved selections are never overwritten.
          const recommendations=recommend(p.brief,prefs,[],
            {refinement:p.recommendations?.refinement||''});
          return json(res,200,{project:{...p,recommendations:{
            ...recommendations,_workspace:p.recommendations?._workspace||{}
          }}});
        }
        if(req.method==='POST'&&action==='/messages'){
          const b=await readBody(req);if(!validateText(b.message,2,1200))return json(res,400,{error:'Message must be 2–1,200 characters.'});
          if(!Array.isArray(b.styles)||b.styles.some(s=>!STYLES.some(t=>t.id===s)))return json(res,400,{error:'Invalid styles'});
          const messages=(Array.isArray(p.messages)?p.messages:[]).slice(-24);
          messages.push({role:'user',content:b.message.trim(),time:new Date().toISOString()});
          const activeBrief=p.brief+(p.recommendations?.refinement?
            '\nLatest refinement: '+p.recommendations.refinement:'');
          const response=await chatReply(activeBrief,messages,b.styles,await profile(owner));messages.push({role:'assistant',content:response.text,source:response.source,
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