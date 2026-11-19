import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright';
import {server} from '../server.mjs';
import {clearReactBitsCacheForTests} from '../reactbits-official.mjs';

// Controlled fake response uses the official catalogue FORMAT only.
// No synthetic result is allowed to claim that it came from the live service.
const bt=String.fromCharCode(96);
const entries=[
 '# React Bits','## Components',
 '- [Drift Wall](https://www.reactbits.dev/components/drift-wall): An endless perspective wall of image tiles drifting past, lifting on hover. CLI: '+bt+'DriftWall'+bt+'.',
 '- [Dome Gallery](https://www.reactbits.dev/components/dome-gallery): Immersive 3D dome image gallery for portfolios. CLI: '+bt+'DomeGallery'+bt+'.',
 '## Animations',
 ...Array.from({length:24},(_,i)=>
  '- [Effect '+i+'](https://www.reactbits.dev/animations/effect-'+i+
  '): Abstract smooth moving micro-interaction animation. CLI: '+bt+'Effect'+i+bt+'.')
].join('\n');
const previousFetch=globalThis.fetch;
const oldFlag=process.env.FRONTLINE_REACTBITS_TEST_MOCK;
process.env.FRONTLINE_REACTBITS_TEST_MOCK='1';
globalThis.fetch=(url,options)=>{
  if(String(url)==='https://reactbits.dev/llms.txt')
    return Promise.resolve(new Response(entries,{status:200,headers:{'Content-Type':'text/plain'}}));
  return previousFetch(url,options);
};
clearReactBitsCacheForTests();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let failed=false;
try{
  for(const [name,browserType] of [['Chromium',chromium],['Firefox',firefox]]){
    let browser;
    try{
      browser=await browserType.launch({headless:true});
      const page=await browser.newPage({viewport:{width:1280,height:800}});
      const pageErrors=[];
      page.on('pageerror',error=>pageErrors.push(error.message));
      await page.goto(base+'/studio',{waitUntil:'domcontentloaded',timeout:25000});
      await page.locator('.composer textarea').fill(
        'Create an interactive drifting image gallery using a perspective drift wall');
      await page.locator('.composer textarea').press('Enter');
      const component=page.locator('.inspiration-component-card')
        .filter({hasText:'Drift Wall'}).first();
      await component.waitFor({timeout:18000});
      assert.equal(await component.getByRole('link',
        {name:'Open original React Bits Drift Wall'}).getAttribute('href'),
        'https://www.reactbits.dev/components/drift-wall');
      assert.match(await component.innerText(),/no publisher-authored design prompt/i,
        'Component description must never be misrepresented as an original prompt');
      await component.getByRole('button',{name:'Save component link'}).click();
      await component.getByRole('button',{name:'Saved component'}).waitFor({timeout:8000});
      assert.deepEqual(pageErrors,[],name+' should not throw any UI runtime error');
      console.log(name+' original React Bits link, truthful provenance and private saving passed.');
    }catch(e){failed=true;console.error(name+' React Bits UI failed:',e.stack)}
    finally{await browser?.close()}
  }
}finally{
  clearReactBitsCacheForTests();
  globalThis.fetch=previousFetch;
  if(oldFlag===undefined)delete process.env.FRONTLINE_REACTBITS_TEST_MOCK;
  else process.env.FRONTLINE_REACTBITS_TEST_MOCK=oldFlag;
  await new Promise(resolve=>server.close(resolve));
}
if(failed)process.exitCode=1;
