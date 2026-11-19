// Public-facing, source-first conversation. No invented publisher prompts or URLs.
const HOSTS={
  'Kage':new Set(['kage.design']),
  'React Bits':new Set(['reactbits.dev','www.reactbits.dev']),
  'Aceternity UI':new Set(['ui.aceternity.com'])
};
export function trustedPublisherLink(item){
  const hosts=HOSTS[item?.provider];
  if(!hosts||typeof item?.site!=='string')return null;
  try{
    const url=new URL(item.site);
    if(url.protocol!=='https:'||!hosts.has(url.hostname)||url.username||
      url.password||url.port||url.search||url.hash||url.pathname==='/')return null;
    if(item.provider==='Kage'&&!/^\/designs\/[a-z0-9-]+\/?$/.test(url.pathname))return null;
    if(item.provider==='React Bits'&&!/^\/(components|animations|backgrounds|text-animations|micro)\/[a-z0-9-]+\/?$/.test(url.pathname))return null;
    if(item.provider==='Aceternity UI'&&!/^\/components\/[a-z0-9-]+\/?$/.test(url.pathname))return null;
    return url.href;
  }catch{return null;}
}
const clean=v=>String(v||'').replace(/[\[\]<>\r\n]/g,' ').trim().slice(0,100);
function verifiedOriginal(item){
  return item?.provider==='Kage'&&item.originalPromptStatus==='verified-publisher'&&
    typeof item.originalPrompt==='string'&&item.originalPrompt.trim().length>=70&&item.originalPrompt.length<=9000?
    item.originalPrompt:null;
}
const block=item=>{
  const site=trustedPublisherLink(item);
  if(!site)return null;
  const title=clean(item.name)||item.provider;
  const header='**'+title+'** — '+item.provider+'\n[Open original publisher page]('+site+')';
  const prompt=verifiedOriginal(item);
  const tooLong=item?.provider==='Kage'&&item.originalPromptStatus==='verified-publisher'&&
    typeof item.originalPrompt==='string'&&item.originalPrompt.length>9000;
  return header+(prompt?'\nOriginal publisher prompt (verbatim):\n````text\n'+prompt+'\n````':
    (tooLong?'\nOriginal prompt is available but too long to display faithfully here. Open the original publisher page.':'\nOriginal publisher prompt: not available or not verified.'));
};
// Prefer interior application designs for chatbot and dashboard requests.
// A publisher result explicitly titled "landing page" is not a dashboard screen.
export function matchingPublisherDesigns(brief,matches){
  const items=(Array.isArray(matches)?matches:[]).filter(x=>trustedPublisherLink(x));
  const q=String(brief||'').toLowerCase();
  const wantsWorkspace=/\b(chatbot|chatgpt|dashboard|workspace|editor|management platform|student portal|web app|application|admin panel|chat interface)\b/.test(q);
  const wantsLanding=/\b(landing|homepage|home page|marketing page|hero section)\b/.test(q);
  if(!wantsWorkspace||wantsLanding)return items;
  return items.filter(x=>{
    const name=clean(x.name).toLowerCase();
    if(/\b(landing|homepage|marketing page|splash page)\b/.test(name))return false;
    // Bare brand names have no evidence of being an in-app interface.
    if(!x.originalPrompt&&name.split(/\s+/).length<=2&&
       !/\b(dashboard|workspace|chat|assistant|portal|interface|app|school|student|editor|support)\b/.test(name))
       return false;
    return true;
  });
}
export function formatSourceDiscovery(sources,{brief=''}={}){
  const matches=matchingPublisherDesigns(brief,sources?.matches).slice(0,3);
  // The chat renderer caps messages at 16K characters. Never truncate a
  // publisher's exact prompt while still labeling it verbatim.
  let used=0;
  const chunks=matches.map((item,i)=>{
    const next=(i+1)+'. '+block(item);
    if(used+next.length>14500){
      const link=trustedPublisherLink(item);
      return (i+1)+'. **'+clean(item.name)+'** — '+item.provider+
        '\n[Open original publisher page]('+link+')'+
        '\nOriginal prompt: open the publisher page (too long for this chat response).';
    }
    used+=next.length+2;
    return next;
  });
  const text=chunks.join('\n\n');
  return (text||'No verified original design prompts or exact matching design links were found for this request. I won\'t substitute unrelated landing pages or invent them.')+
    '\n\n**Would you like the best combination of UI/UX designs and components?** Reply **Yes** or **No**.';
}
export function formatSourceCombination(sources,{brief=''}={}){
  const designs=matchingPublisherDesigns(brief,sources?.matches).slice(0,3);
  const components=(sources?.componentMatches||[]).filter(x=>trustedPublisherLink(x)).slice(0,5);
  const designRows=designs.map((item,i)=>
    (i+1)+'. **'+clean(item.name)+'** — '+item.provider+
    '\n[Open original publisher page]('+trustedPublisherLink(item)+')'+
    (verifiedOriginal(item)?'\nOriginal publisher prompt: already displayed above.':
      '\nOriginal publisher prompt: not available or not verified.')).join('\n\n');
  const componentRows=components.map((item,i)=>
    (i+1)+'. **'+clean(item.name)+'** — '+item.provider+
    '\n[Open original component page]('+trustedPublisherLink(item)+')').join('\n\n');
  const reactStatus=(sources?.componentDiscovery?.providers||[])
    .find(x=>x.provider==='React Bits')?.status;
  const reactNote=!components.some(x=>x.provider==='React Bits')&&reactStatus==='unavailable'?
    '\nReact Bits publisher index is temporarily unavailable; no component links were invented.':'';
  return '**UI/UX designs and original prompts**\n\n'+
    (designRows||'No verified matching original application designs were found.')+
    '\n\n**Matching components and animations**\n\n'+
    (componentRows||'No verified matching components were found in the publisher indexes.')+
    reactNote+
    '\n\nComponent publishers supply original documentation links, not publisher-authored design prompts. Original design prompts remain in the preceding chat reply when available.';
}
export function isAffirmative(value){
  return /^(yes|yes please)$/i.test(String(value||'').trim());
}
export function isNegative(value){
  return /^(no|no thanks|no thank you|not now|nah)$/i.test(String(value||'').trim());
}
