// Universal discovery planner: no matching of memorized project titles.
// Convert arbitrary problem statements into SEARCHABLE user tasks and screen
// patterns. Publisher searches determine whether real references exist.
import {fallbackSubjectTerms} from './publisher-evidence-relevance.mjs';
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
  // No fixed application domains. Extract the actual subject from the first
  // sentence so model outages don't search generic dashboards for every brief.
  const terms=fallbackSubjectTerms(brief);
  const topic=terms.join(' ')||'task management';
  return {appQuery:(topic+' workflow interface').slice(0,110),
    landingQuery:(topic+' service landing page').slice(0,110),
    status:'subject-query-fallback'};
}
export async function planSourceQueries(brief,{model=null}={}){
  if(typeof model==='function'){
    try{
      const answer=await model(String(brief||'').slice(0,7000));
      const parsed=parseSourceQueries(typeof answer==='string'?answer:answer?.text);
      if(parsed)return parsed;
    }catch{/* A failed planning model never becomes an invented link. */}
  }
  return fallbackSourceQueries(brief);
}
