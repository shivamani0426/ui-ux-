// Genuine public React Bits index diagnostic. No third-party code is copied.
import {findReactBitsOriginalComponents} from '../reactbits-official.mjs';
try{
  const found=await findReactBitsOriginalComponents('drift wall interactive perspective image gallery',{limit:3});
  const exact=found.matches.find(x=>x.site==='https://www.reactbits.dev/components/drift-wall');
  console.log(JSON.stringify({publisher:'reactbits.dev/llms.txt',status:found.status,
    indexedMatches:found.matches.length,
    exactOriginal:exact?{name:exact.name,site:exact.site,originalPromptStatus:exact.originalPromptStatus}:null}));
  if(!exact||exact.originalPrompt!==null)process.exitCode=1;
}catch(e){
  console.error('React Bits official catalogue diagnostic failed:',String(e.message||e).slice(0,220));
  process.exitCode=1;
}
