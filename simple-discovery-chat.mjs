// Public-facing, source-first conversation. No invented publisher prompts or URLs.
import {validScreenrovePage} from './screenrove-publisher.mjs';
import {rankPublisherEvidence} from './publisher-evidence-relevance.mjs';
const HOSTS={
  'Kage':new Set(['kage.design']),
  'React Bits':new Set(['reactbits.dev','www.reactbits.dev']),
  'Aceternity UI':new Set(['ui.aceternity.com'])
};
export function trustedPublisherLink(item){
  if(item?.provider==='Screenrove')return item.publisherVerified===true?validScreenrovePage(item.site):null;
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
const textReason=v=>String(v||'').replace(/[\[\]<>\r\n]/g,' ').replace(/\s+/g,' ').slice(0,210);
function verifiedOriginal(item){
  return item?.provider==='Kage'&&item.originalPromptStatus==='verified-publisher'&&
    typeof item.originalPrompt==='string'&&item.originalPrompt.trim().length>=70&&item.originalPrompt.length<=9000?
    item.originalPrompt:null;
}
const block=item=>{
  const site=trustedPublisherLink(item);
  if(!site)return null;
  const title=clean(item.name)||item.provider;
  if(item.provider==='Screenrove'){
    const notes=String(item.summary||'').replace(/[<>\[\]\r\n]/g,' ').replace(/\s+/g,' ').trim().slice(0,225);
    return '**'+title+'** — Screenrove\n[Open original screen reference]('+site+')'+
      (notes?'\nPublisher notes: '+notes:'')+
      (item.matchReason?'\nWhy it may fit: '+textReason(item.matchReason):'')+
      '\nObserved interface reference; not a publisher-authored design prompt.';
  }
  const header='**'+title+'** — '+item.provider+'\n[Open original publisher page]('+site+')';
  const prompt=verifiedOriginal(item);
  const tooLong=item?.provider==='Kage'&&item.originalPromptStatus==='verified-publisher'&&
    typeof item.originalPrompt==='string'&&item.originalPrompt.length>9000;
  return header+(item.matchReason?'\nWhy it may fit: '+textReason(item.matchReason):'')+(prompt?'\nOriginal publisher prompt (verbatim):\n````text\n'+prompt+'\n````':
    (tooLong?'\nOriginal prompt is available but too long to display faithfully here. Open the original publisher page.':'\nOriginal publisher prompt: not available or not verified.'));
};
// Prefer interior application designs for chatbot and dashboard requests.
// A publisher result explicitly titled "landing page" is not a dashboard screen.
export function matchingPublisherDesigns(brief,matches){
  const items=(Array.isArray(matches)?matches:[]).filter(x=>trustedPublisherLink(x));
  const screenrove=items.filter(x=>x.provider==='Screenrove'&&x.publisherVerified===true);
  const kage=items.filter(x=>x.provider!=='Screenrove');
  const q=String(brief||'').toLowerCase();
  const wantsWorkspace=/\b(chatbot|chatgpt|dashboard|workspace|editor|management platform|student portal|web app|application|admin panel|chat interface)\b/.test(q);
  const wantsLanding=/\b(landing|homepage|home page|marketing page|hero section)\b/.test(q);
  if(!wantsWorkspace||wantsLanding)return items;
  // Exact first-party URLs establish provenance, not relevance. A real
  // "App Store Screenshots" result must not be sold as a chatbot workspace.
  const wantsStoreAssets=/\b(app store|play store|store listing|screenshots|promotional mockups)\b/.test(q);
  const domains=[
    {requested:/\b(chatbot|chatgpt|chat interface|chat workspace|conversation|messaging|ai assistant)\b/,
      evidence:/\b(chat|chatbot|chatgpt|assistant|messaging|conversation|helpdesk|support chat)\b/},
    {requested:/\b(school|student|teacher|education|learning|classroom)\b/,
      evidence:/\b(school|student|teacher|educational?|learning|classroom|academy)\b/},
    {requested:/\b(patient|healthcare|hospital|clinic|medical)\b/,
      evidence:/\b(patient|healthcare|hospital|clinic|medical)\b/},
    {requested:/\b(finance|financial|banking|budget|expenses)\b/,
      evidence:/\b(finance|financial|banking|budget|expenses)\b/},
    {requested:/\b(e-commerce|ecommerce|shopping|online store|shopping cart)\b/,
      evidence:/\b(e-commerce|ecommerce|shopping|storefront|marketplace|retail)\b/},
    {requested:/\b(analytics|analytics dashboard)\b/,
      evidence:/\b(analytics|dashboard|metrics|reporting)\b/}
  ];
  const relevantDomains=domains.filter(d=>d.requested.test(q));
  const selected=kage.filter(x=>{
    const name=clean(x.name).toLowerCase();
    const verbatim=verifiedOriginal(x)||'';
    const evidence=name+' '+verbatim.toLowerCase();
    if(/\b(landing|homepage|marketing page|splash page)\b/.test(name))return false;
    if(!wantsStoreAssets&&/\b(app store screenshots?|play store screenshots?|store listing|promotional screenshots?|marketing mockups?)\b/.test(name))return false;
    // Require a real publisher title or its verified prompt to match the
    // brief's domain. Unverified descriptions or guessed tags are not evidence.
    if(relevantDomains.length&&!relevantDomains.some(d=>d.evidence.test(evidence)))return false;
    if(!/\b(dashboard|workspace|chat|chatbot|chatgpt|assistant|messaging|conversation|helpdesk|portal|interface|app|school|student|teacher|editor|support|analytics|platform|admin|management)\b/.test(evidence))
      return false;
    return true;
  });
  return [...screenrove,...selected];
}
// Authenticity and relevance are distinct checks. Preserve only real
// publisher links with evidence tying the screen to this user's tasks.
export function shownSourceReferences(sources,{brief=''}={}){
  if(!Array.isArray(sources?.applicationMatches)||!Array.isArray(sources?.landingMatches))
    return null;
  const applications=sources.applicationMatches.filter(x=>
    x.provider==='Screenrove'&&x.designType==='application-ui'&&trustedPublisherLink(x));
  const landings=sources.landingMatches.filter(x=>trustedPublisherLink(x)&&(
    x.provider==='Screenrove'&&x.designType==='landing-page'||
    x.provider==='Kage'&&matchingPublisherDesigns(brief,[x]).length>0
  ));
  const hasEvaluatedSources=sources.sourceQualityStatus==='semantic-evaluated'||
    sources.sourceQualityStatus==='metadata-fallback'||sources.sourceQualityStatus==='no-verified-candidates'||
    applications.some(x=>x.relevanceAccepted===true)||
    landings.some(x=>x.relevanceAccepted===true);
  // A structured AI review already rejected irrelevant genuine pages.
  // NEVER reintroduce them through a second lexical sort (including after Yes).
  return hasEvaluatedSources?{
    applicationMatches:applications.filter(x=>x.relevanceAccepted===true).slice(0,2),
    landingMatches:landings.filter(x=>x.relevanceAccepted===true).slice(0,3)
  }:{
    applicationMatches:rankPublisherEvidence(brief,applications,{limit:2}),
    landingMatches:rankPublisherEvidence(brief,landings,{limit:3})
  };
}
export function formatSourceDiscovery(sources,{brief=''}={}){
  // Screenrove reports real in-app and marketing screen captures separately.
  // No components are shown until the visitor explicitly opts in.
  const shown=shownSourceReferences(sources,{brief});
  if(shown){
    const app=shown.applicationMatches,landing=shown.landingMatches;
    const sections=[];
    const take=(label,items)=>{
      let used=0;
      const rows=items.map((item,i)=>{
        const full=(i+1)+'. '+block(item);
        if(used+full.length>11000)return (i+1)+'. **'+clean(item.name)+'** — '+item.provider+
          '\n[Open original publisher page]('+trustedPublisherLink(item)+')'+
          '\nOpen the publisher page to read its full prompt.';
        used+=full.length+2;
        return full;
      });
      if(rows.length)sections.push('**'+label+'**\n\n'+rows.join('\n\n'));
    };
    take('Application UI references',app);
    take('Landing-page references',landing);
    if(!sections.length){
      const unavailable=sources.screenroveStatus==='unavailable'||sources?.discovery?.status==='unavailable';
      sections.push(unavailable?'Original screen publishers are temporarily unavailable. I could not verify live application or landing-page references.':
        'No sufficiently relevant original application or landing-page references were verified for this request. I will not invent links or prompts.');
    }
    return sections.join('\n\n')+
      '\n\n**Would you like matching original UI components with publisher links as well?** Reply **Yes** or **No**.';
  }
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
  if(!matches.length){
    const status=sources?.discovery?.status;
    const why=status==='rate-limited'?
      'Kage original-design lookup is temporarily rate-limited. You can retry later; no source was invented.':
      status==='unavailable'?
      'Kage original-design publisher is currently unavailable. This is not confirmation that no matching design exists.':
      status==='not-configured'?
      'Live Kage lookup is not enabled in this environment. No original design was verified.':
      'No matching original application-design page was found in the connected publisher results. I won\'t substitute unrelated landing pages or invent design prompts.';
    return why+'\n\n**Would you like matching original UI components with their publisher links instead?** Reply **Yes** or **No**.';
  }
  return text+'\n\n**Would you like the best combination of UI/UX designs and components?** Reply **Yes** or **No**.';
}
export function formatSourceCombination(sources,{brief=''}={}){
  const shown=shownSourceReferences(sources,{brief});
  const designs=(shown?[...shown.applicationMatches,...shown.landingMatches]:
    matchingPublisherDesigns(brief,sources?.matches).slice(0,3))
    .filter(x=>trustedPublisherLink(x)).slice(0,5);
  const components=(sources?.componentMatches||[]).filter(x=>trustedPublisherLink(x)).slice(0,5);
  const designRows=designs.map((item,i)=>
    (i+1)+'. **'+clean(item.name)+'** — '+item.provider+
    '\n[Open original publisher page]('+trustedPublisherLink(item)+')'+
    (item.matchReason?'\nWhy it may fit: '+textReason(item.matchReason):'')+
    (verifiedOriginal(item)||item.originalPromptStatus==='verified-publisher'?'\nOriginal publisher prompt: already displayed above.':
      item.provider==='Screenrove'?'\nReal screen reference (no publisher design prompt).':
      '\nOriginal publisher prompt: not available or not verified.')).join('\n\n');
  const componentRows=components.map(item=>
    '- **'+clean(item.name)+'** — '+item.provider+
    '\n[Open original component page]('+trustedPublisherLink(item)+')'+
    (item.matchReason?'\nSuggested purpose: '+textReason(item.matchReason):'')).join('\n\n');
  const overview=String(brief||'').replace(/[\r\n<>\[\]`]/g,' ').replace(/\s+/g,' ').trim().slice(0,7000).replace(/[.?!\s]+$/,'');
  const designSummary=designs.map(x=>clean(x.name)+' ('+x.provider+')').join('; ');
  const componentSummary=components.map(x=>clean(x.name)+' ('+x.provider+')').join('; ');
  // Generated connective instructions are explicitly Frontline-authored.
  // Never label this text as an original publisher prompt.
  const combinationPrompt=designs.length&&components.length?
    '\n\n**Frontline combined implementation prompt (Frontline-authored, NOT an original publisher prompt)**\n\n'+
    'Design a cohesive interface for: '+(overview||'the application described above')+
    '. Base the visual direction on these linked original design references: '+designSummary+
    '. Integrate relevant functional elements using these linked original component references: '+componentSummary+
    '. Preserve accessible navigation, responsive layouts and clear interaction states. The exact publisher links above identify the selected sources; do not attribute this combined text to a publisher.':'';
  const reactStatus=(sources?.componentDiscovery?.providers||[])
    .find(x=>x.provider==='React Bits')?.status;
  const reactNote=!components.some(x=>x.provider==='React Bits')&&reactStatus==='unavailable'?
    '\nReact Bits publisher index is temporarily unavailable; no component links were invented.':'';
  // The first assistant reply already explained an empty design search.
  // After explicit Yes, show just the useful original component sources.
  const designSection=designs.length?'**UI/UX designs and original prompts**\n\n'+designRows+'\n\n':'';
  return designSection+'**Matching components and animations**\n\n'+
    (componentRows||'No verified matching components were found in the publisher indexes.')+
    reactNote+combinationPrompt+
    (designs.length?
      '\n\nOriginal publisher prompts, when available, were shown in the preceding reply. Screenrove links are screen references, not original design prompts.':
      '\n\nOriginal component documentation links only; no publisher design prompt was verified.');
}
// Shared by server and browser: punctuation is harmless; ambiguous assent
// still never authorizes fetching or combining publisher components.
export function normalizeConsent(value){
  return String(value||'').trim().toLowerCase()
    .replace(/[!.]+$/g,'').replace(/,/g,' ')
    .replace(/\s+/g,' ').trim();
}
export function isAffirmative(value){
  return /^(yes|yes please)$/.test(normalizeConsent(value));
}
export function isNegative(value){
  return /^(no|no thanks|no thank you|not now|nah)$/.test(normalizeConsent(value));
}
export function isAmbiguousConsent(value){
  return /^(ok|okay|sure|yep|maybe)$/.test(normalizeConsent(value));
}
export function isConsentReply(value){
  return isAffirmative(value)||isNegative(value)||isAmbiguousConsent(value);
}
