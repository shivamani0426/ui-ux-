// Relevance is a separate quality criterion from authenticity. Exact publisher
// URLs alone do not establish that a design is suitable for an unseen brief.
// This gate matches distinctive task/evidence terms, never named test prompts.
const STOP=new Set((
  'a an the and or but to for from with without in on of at by as into '+
  'your our their we you i is are be was were will would should can could may '+
  'create build make design develop produce help helps helping want need needs '+
  'application app website webpage web digital ai genai agent agents assistant '+
  'powered platform product products software system service services solution '+
  'user users experience experiences interface interfaces ui ux original '+
  'publisher source reference screen screens landing page pages homepage home '+
  'dashboard dashboards workspace workspaces board boards layout layouts '+
  'component components section sections feature features modern attractive '+
  'professional responsive friendly effective comprehensive advanced '+
  'overview management manage managing workflow workflows project projects '+
  'tool tools new more best using use used designed provide include includes '+
  'allows allow should through able every all clearly various different '+
  'content information access based real realtime time today person people '+
  'large small important public private powered create get started other severe instead purchasing purchase '+
  'digital online page marketing hero pricing price now discover explore '+
  'first next customer customers their these those about this that which '+
  'how why where when what out also some items item data common'
).split(/\s+/));
const clean=v=>String(v??'').toLowerCase().replace(/https?:\/\/[^\s]+/g,' ')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const root=w=>{
  // Conservative plural/inflection normalization, not dictionary/domain rules.
  if(w.length>6&&w.endsWith('ies'))return w.slice(0,-3)+'y';
  if(w.length>6&&w.endsWith('ing'))return w.slice(0,-3);
  if(w.length>6&&w.endsWith('ed'))return w.slice(0,-2);
  if(w.length>5&&w.endsWith('es')&&!w.endsWith('ses'))return w.slice(0,-2);
  if(w.length>4&&w.endsWith('s')&&!w.endsWith('ss'))return w.slice(0,-1);
  return w;
};
export function distinctiveTerms(value){
  return [...new Set(clean(value).split(/\s+/).map(root)
    .filter(w=>w.length>=3&&!STOP.has(w)))];
}
export function isUnusablePublisherPage(item,brief=''){
  const title=String(item?.name||item?.title||'');
  let path='';try{path=new URL(item?.site||item?.url).pathname;}catch{}
  const error=/(?:^|[^a-z0-9])(404|403|500|not found|page not found|error page|access denied|forbidden|broken page|site unavailable)(?:[^a-z0-9]|$)/i;
  if(error.test(title+' '+path)&&!/\b(404|403|500|error page|not found page|empty state design)\b/i.test(brief))
    return true;
  const pricing=/(?:^|[\s—-])(pricing|plans|subscription tiers?|billing)(?:$|[\s—-])/i;
  if(pricing.test(title+' '+path)&&!/\b(pricing|subscriptions?|plans?|billing|fees?|paid tiers?|membership costs?|checkout)\b/i.test(brief))
    return true;
  return false;
}
const publisherTitle=item=>{
  // Product brand and generic page labels must not create false relevance.
  const title=String(item?.name||item?.title||'');
  return title.split(/\s[—–]\s/).slice(-1)[0];
};
export function publisherEvidenceScore(brief,item){
  if(!item||isUnusablePublisherPage(item,brief))return 0;
  const topic=(String(brief||'').split(/[.!?\n]/)[0]||'').slice(0,480);
  const core=new Set(distinctiveTerms(topic));
  const all=new Set(distinctiveTerms(brief));
  const heading=new Set(distinctiveTerms(publisherTitle(item)));
  const description=new Set(distinctiveTerms(item.summary||item.notes||item.description||''));
  const matched=[...new Set([...heading,...description].filter(x=>all.has(x)))];
  if(matched.length<2)return 0;
  const coreHits=matched.filter(x=>core.has(x)).length;
  // Do not sell a generic unrelated homepage merely because it shares two
  // normal UI words. Three independent workflow matches are also sufficient.
  if(coreHits===0&&matched.length<3)return 0;
  const titleHits=matched.filter(x=>heading.has(x)).length;
  return matched.length*2+coreHits*3+titleHits*3;
}
export function rankPublisherEvidence(brief,items,{limit=4}={}){
  return (Array.isArray(items)?items:[]).map((item,index)=>({
    item,index,score:publisherEvidenceScore(brief,item)
  })).filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score||a.index-b.index)
    .slice(0,limit).map(x=>({...x.item,relevanceScore:x.score}));
}
export function fallbackSubjectTerms(brief){
  const first=(String(brief||'').split(/[.!?\n]/)[0]||'').slice(0,500);
  const terms=distinctiveTerms(first);
  // End of the first sentence usually describes the subject rather than
  // boilerplate such as "Build a platform that..." or "Create an AI assistant".
  return [...new Set([...terms.slice(0,2),...terms.slice(-4)])].slice(0,6);
}
