// Diagnostic: one real Kage publisher request. No original prompt text is logged.
import {findKageOriginals} from '../kage-publisher.mjs';
try{
  const result=await findKageOriginals('tiun backend landing page',{limit:1});
  const originals=result.matches.filter(x=>x.originalPromptStatus==='verified-publisher');
  console.log(JSON.stringify({provider:'kage.design/mcp',status:result.status,
    count:result.matches.length,verifiedOriginals:originals.length,
    references:originals.map(x=>({url:x.url,promptSha256:x.originalPromptHash}))},null,2));
  if(!originals.length)process.exitCode=1;
}catch(err){
  console.error('Kage official MCP diagnostic failed:',String(err?.message||err).slice(0,260));
  process.exitCode=1;
}
