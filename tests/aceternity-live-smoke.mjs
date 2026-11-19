// Live first-party source authenticity check. Never copy third-party assets/code.
import {findAceternityOriginalComponents} from '../aceternity-official.mjs';
try{
  const x=await findAceternityOriginalComponents('glowing hero spotlight effect',{limit:4});
  const found=x.matches.find(m=>m.site==='https://ui.aceternity.com/components/spotlight');
  console.log(JSON.stringify({publisher:'ui.aceternity.com/api/components',status:x.status,
    matches:x.matches.length,original:found?{name:found.name,url:found.site,
      originalPromptStatus:found.originalPromptStatus}:null}));
  if(!found||found.originalPrompt!==null)process.exitCode=1;
}catch(e){
  console.error('Official Aceternity JSON catalogue diagnostic failed:',String(e?.message||e).slice(0,180));
  process.exitCode=1;
}
