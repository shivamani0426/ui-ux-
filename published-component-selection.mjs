// Rank only publisher-returned components. Roles are relevance heuristics,
// never a catalogue of invented/guessed component URLs.
const roleNames={
  composer:/\b(prompt bar|chat input|message input|chat composer|gooey input|input)\b/i,
  sidebar:/\b(sidebar|side bar|branched menu|side navigation)\b/i,
  responses:/\b(text generate effect|text type|typing|split text|blur text|text reveal|typewriter|text loop|text animation)\b/i,
  navigation:/\b(floating navbar|navbar menu|floating dock|navigation menu|navbar|dock)\b/i,
  cards:/\b(card hover|3d card|card stack|interactive card|bento grid|card)\b/i
};
function requestedRoles(brief){
  const q=String(brief||'').toLowerCase();
  const chat=/\b(chatbot|chatgpt|chat app|chat interface|assistant|messaging|conversation)\b/.test(q);
  if(!chat)return null; // Other projects keep their existing relevance ranking.
  return [
    ['composer',/\b(prompt|input|composer|message box|chat box|type a message|chatbot|chatgpt)\b/.test(q)],
    ['sidebar',/\b(sidebar|side bar|collapsib\w*|side navigation)\b/.test(q)],
    ['responses',/\b(text|reply|replies|responses?|typing|streaming|animated)\b/.test(q)],
    ['navigation',/\b(floating|navbar|navigation|menu|dock)\b/.test(q)],
    ['cards',/\b(cards?|tiles?|grid)\b/.test(q)]
  ].filter(([,needed])=>needed).map(([role])=>role);
}
const safeScore=x=>Math.max(0,Math.min(18,Number(x)||0));
function roleFor(item,role){
  const name=String(item?.name||'')+' '+String(item?.componentName||'');
  return roleNames[role]?.test(name)||false;
}
export function selectPublisherComponents(brief,reactBits=[],aceternity=[],{limit=5}={}){
  const pool=[...reactBits,...aceternity].filter(item=>
    item&&typeof item.site==='string'&&item.originalPrompt==null&&
    (item.provider==='React Bits'||item.provider==='Aceternity UI'));
  const dedup=[...new Map(pool.map(item=>[item.site,item])).values()];
  const roles=requestedRoles(brief);
  const cap=Math.max(1,Math.min(6,limit));
  if(!roles){
    return dedup.sort((a,b)=>safeScore(b.relevanceScore)-safeScore(a.relevanceScore)||
      String(a.name||'').localeCompare(String(b.name||''))).slice(0,cap);
  }
  const selected=[];
  for(const role of roles){
    const candidates=dedup.filter(item=>!selected.some(x=>x.site===item.site)&&roleFor(item,role));
    // Functional role fit wins over generic "text" and "animated" matches.
    candidates.sort((a,b)=>{
      const sa=safeScore(a.relevanceScore)+(role==='composer'&&/prompt bar/i.test(a.name)?8:0)+
        (role==='sidebar'&&/^sidebar$/i.test(a.name)?8:0)+
        (role==='responses'&&/text generate effect|text type/i.test(a.name)?7:0)+
        (role==='navigation'&&/floating navbar|navbar menu/i.test(a.name)?5:0)+
        (role==='cards'&&/card hover effect/i.test(a.name)?5:0);
      const sb=safeScore(b.relevanceScore)+(role==='composer'&&/prompt bar/i.test(b.name)?8:0)+
        (role==='sidebar'&&/^sidebar$/i.test(b.name)?8:0)+
        (role==='responses'&&/text generate effect|text type/i.test(b.name)?7:0)+
        (role==='navigation'&&/floating navbar|navbar menu/i.test(b.name)?5:0)+
        (role==='cards'&&/card hover effect/i.test(b.name)?5:0);
      return sb-sa||a.name.localeCompare(b.name);
    });
    if(candidates.length)selected.push(candidates[0]);
    if(selected.length>=cap)break;
  }
  // If no functional match exists, report none rather than decorative fillers.
  return selected;
}
