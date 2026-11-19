// Match user intent to components that ACTUALLY exist in first-party publisher
// catalogues. These are name-based relevance hints, not source URLs or prompts.
const CHAT=/\b(chatbot|chatgpt|chat\s+(?:app|interface|workspace)|messaging|conversation|assistant)\b/i;
const wants=(brief,pattern)=>pattern.test(brief);
export function publisherComponentIntentBoost(brief,componentName){
  const q=String(brief||'').slice(0,1500);
  const name=String(componentName||'').trim().toLowerCase();
  if(!CHAT.test(q))return 0;
  let score=0;
  // Users describe "message input" more often than a publisher's "Prompt Bar".
  if(wants(q,/\b(input|message|composer|prompt|chat\s*box|type\s+a\s+message)\b/i)){
    if(name==='prompt bar')score+=35;
    if(name==='gooey input'||name==='input')score+=12;
  }
  if(wants(q,/\b(sidebar|side\s+navigation|collapsible|conversation\s+list)\b/i)){
    if(name==='sidebar')score+=30;
  }
  if(wants(q,/\b(response|responses|reply|replies|typing|animated|streaming|text)\b/i)){
    if(name==='text generate effect')score+=27;
    if(name==='text type')score+=25;
    if(name==='split text'||name==='blur text')score+=7;
  }
  if(wants(q,/\b(navigation|navbar|floating\s+menu|floating|menu)\b/i)){
    if(name==='floating navbar'||name==='navbar menu')score+=25;
    if(name==='floating dock')score+=11;
  }
  if(wants(q,/\b(card|cards|tile|tiles|grid)\b/i)){
    if(name==='card hover effect')score+=23;
    if(name==='3d card'||name==='bento grid')score+=15;
    if(name==='card spotlight'||name==='text reveal card')score+=5;
  }
  return score;
}
