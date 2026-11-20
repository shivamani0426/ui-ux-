// Universal discovery planner: no matching of memorized project titles.
// Convert arbitrary problem statements into SEARCHABLE user tasks and screen
// patterns. Publisher searches determine whether real references exist.
import {analyzeProject} from './project-intelligence.mjs';
const trim=v=>String(v??'').replace(/[\u0000-\u001f\u007f<>]/g,' ')
  .replace(/https?:\/\/\S+/gi,' ').replace(/\s+/g,' ').trim();
const safeQuery=v=>{
  if(typeof v!=='string')return null;
  const s=trim(v).slice(0,110);
  return s.length>=5&&/[a-z]{3}/i.test(s)?s:null;
};
export function parseSourceQueries(output){
  if(typeof output!=='string'||output.length>3000)return null;
  const raw=output.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{
    const parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return null;
    const appQuery=safeQuery(parsed.application),landingQuery=safeQuery(parsed.landing);
    if(!appQuery||!landingQuery)return null;
    return {appQuery,landingQuery,status:'ai-queries'};
  }catch{return null;}
}
export function fallbackSourceQueries(brief){
  // Existing requirements engine extracts general workflows; it is not used
  // as a hardcoded catalogue of matching site links.
  const analysis=analyzeProject(String(brief||'').slice(0,7000));
  const feature=analysis.features.slice(0,2).map(x=>x.page).filter(Boolean).join(' ');
  const generic=trim(feature||'overview dashboard primary workflow');
  return {appQuery:(generic+' interface dashboard').slice(0,110),
    landingQuery:'product landing page features benefits',status:'generic-query-fallback'};
}
export async function planSourceQueries(brief,{model=null}={}){
  if(typeof model==='function'){
    try{
      const answer=await model(String(brief||'').slice(0,2400));
      const parsed=parseSourceQueries(typeof answer==='string'?answer:answer?.text);
      if(parsed)return parsed;
    }catch{/* A failed planning model never becomes an invented link. */}
  }
  return fallbackSourceQueries(brief);
}
