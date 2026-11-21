// Search reusable USER TASKS, not names of previously seen projects.
// These are generic interaction affordances (booking, inventory, records, etc),
// not stored recommended websites or a catalogue of industry prompt examples.
// Semantic AI reviews actual publisher candidates after retrieval.
import {fallbackSourceQueries} from './publisher-source-query-plan.mjs';
const patterns=[
  {query:'booking calendar',need:/\b(book(?:ing|ings)?|reserv(?:e|ation|ations)?|schedule[ds]?|schedul(?:ing|es)?|appointments?|time[ -]?slots?|calendar)\b/i},
  {query:'inventory management',need:/\b(inventory|stock|equipment|assets?|catalog(?:ue)?|maintenance|repairs?|supplies|tools?)\b/i},
  {query:'case management',need:/\b(cases?|claims?|intake|records?|submissions?|approvals?|applications?|patient records|incident reports?)\b/i},
  {query:'task board workflow',need:/\b(tasks?|assignments?|workflows?|work orders|kanban|queues?|triage|staff dashboard|progress tracking)\b/i},
  {query:'analytics dashboard',need:/\b(analytics|metrics?|charts?|graphs?|statistics|trends?|insights?|monitoring|sensor data)\b/i},
  {query:'location map',need:/\b(maps?|locations?|geospatial|routes?|geographic|tracking map|directions)\b/i},
  {query:'messaging notifications',need:/\b(chats?|messages?|messaging|inbox|conversations?|notifi(?:es|cation|cations)|alerts?)\b/i},
  {query:'file upload form',need:/\b(uploads?|photos?|documents?|forms?|attachments?|image submissions?)\b/i}
];
const safe=v=>String(v||'').slice(0,7000).toLowerCase();
export function reusableWorkflowQueries(brief,{limit=2}={}){
  const raw=safe(brief);
  const hits=patterns.flatMap(({query,need})=>{
    const match=need.exec(raw);
    return match?[{query,pos:match.index}]:[];
  }).sort((a,b)=>a.pos-b.pos).map(x=>x.query);
  return [...new Set(hits)].slice(0,Math.max(1,Math.min(4,limit)));
}
export function planResilientPublisherQueries(brief){
  const original=fallbackSourceQueries(brief);
  const tasks=reusableWorkflowQueries(brief,{limit:2});
  // Keep two distinct product searches even when a free language model times
  // out or returns no visible tokens. This does not guess publisher URLs.
  const app=[...new Set([...tasks,original.appQuery])].slice(0,2);
  // Marketing results are categorized separately by the official publisher.
  // The second query looks for benefits-focused page structure, not brands.
  const landing=[...new Set([original.landingQuery,'service benefits landing page'])].slice(0,2);
  return {
    appQuery:app[0]||original.appQuery,
    appQueries:app.slice(1),
    landingQuery:landing[0],
    landingQueries:landing.slice(1),
    status:tasks.length?'reusable-task-queries':'subject-query-fallback'
  };
}
