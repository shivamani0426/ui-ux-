/**
 * Real first-party Screenrove catalog probe: just search results, not guesses.
 * No user data, provider auth, scraping or guessed design URLs.
 * Run in isolated PR CI as a diagnostic of functional publisher coverage.
 */
import {createScreenroveClient,screenroveToolData} from '../screenrove-publisher.mjs';
const client=createScreenroveClient({timeoutMs:12000});
await client.initialize();
for(const [kind,q] of [
  ['product','booking calendar'],
  ['product','inventory management'],
  ['product','dashboard'],
  ['marketing','community service']
]){
  try{
    const raw=screenroveToolData(await client.call('search_screens',{q,kind,limit:6,images:0}));
    const entries=raw?.screens||raw?.data?.screens||raw?.results||raw?.data?.results||[];
    const safe=entries.slice(0,6).map(x=>({
      title:String(x.title||x.name||'').slice(0,80),
      kind:String(x.kind||'').slice(0,25)
    }));
    console.log('PUBLISHER_PROBE kind='+kind+' query='+JSON.stringify(q)+
      ' count='+entries.length+' previews='+JSON.stringify(safe));
  }catch(error){
    console.log('PUBLISHER_PROBE kind='+kind+' query='+JSON.stringify(q)+
      ' unavailable='+String(error?.name||'Error'));
    process.exitCode=1;
  }
}
