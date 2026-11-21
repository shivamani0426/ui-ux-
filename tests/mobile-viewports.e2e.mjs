/**
 * Responsive behavior in actual Chromium and Firefox engines.
 * Touch-mode emulation and reduced-motion; never represented as physical Android QA.
 */
import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright';
import {server} from '../server.mjs';
const host=process.env.TARGET_URL;
if(!host)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=host||'http://127.0.0.1:'+server.address().port;
let failures=[];
const checks=async(page,step,name,w)=>{
  const measure=await page.evaluate(()=>{
    const doc=document.documentElement;
    return {viewport:window.innerWidth,docWidth:doc.scrollWidth,
      bodyWidth:document.body?.scrollWidth||0,scrollX:window.scrollX};
  });
  assert.ok(measure.docWidth<=measure.viewport+1&&measure.bodyWidth<=measure.viewport+1,
    name+' '+w+' '+step+' must not scroll horizontally: '+JSON.stringify(measure));
};
for(const [name,engine] of [['Chromium',chromium],['Firefox',firefox]]){
  const browser=await engine.launch({headless:true});
  try{
    for(const width of [360,390,430]){
      const page=await browser.newPage({viewport:{width,height:820},deviceScaleFactor:1,
        hasTouch:true,reducedMotion:'reduce'});
      try{
        await page.goto(url+'/',{waitUntil:'domcontentloaded',timeout:50000});
        await page.locator('.fl-orb-intro').waitFor({state:'detached',timeout:7500});
        const login=page.getByRole('button',{name:'Log In',exact:true});
        const signup=page.getByRole('button',{name:'Sign Up',exact:true});
        await login.waitFor({timeout:7500});await signup.waitFor({timeout:7500});
        await checks(page,'landing',name,width);
        for(const button of [login,signup]){
          const rect=await button.boundingBox();
          assert.ok(rect&&rect.width>=36&&rect.height>=32&&rect.x>=-1&&
            rect.x+rect.width<=width+1,name+' '+width+' account target clipped: '+JSON.stringify(rect));
        }
        await login.tap();
        await page.locator('.fl-login-page').waitFor({timeout:8500});
        await checks(page,'login',name,width);
        await page.getByRole('button',{name:'Enter Studio as Guest'}).tap();
        await page.locator('.studio-title').waitFor({timeout:8500});
        const composer=page.locator('.composer-position.docked');
        await composer.waitFor({timeout:8000});
        const rect=await composer.boundingBox();
        assert.ok(rect&&rect.width<=width+1&&rect.x>=-2&&rect.x+rect.width<=width+2,
          name+' '+width+' composer clipped: '+JSON.stringify(rect));
        await checks(page,'studio',name,width);
        const input=page.locator('.composer textarea');
        assert.equal(await input.count(),1);
        assert.ok(await input.isVisible(),name+' '+width+' message input hidden');
        console.log('MOBILE_QA '+name+' width='+width+' landing=pass login=pass studio=pass');
      }catch(error){failures.push(error.message);console.error('MOBILE_QA FAILED '+name+' width='+width+' '+error.message);}
      finally{await page.close()}
    }
  }finally{await browser.close()}
}
if(!host)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
if(failures.length)throw Error(failures.length+' responsive checks failed: '+failures.join(' | ').slice(0,1000));
console.log('MOBILE_QA PASSED 360/390/430 Chromium+Firefox viewport regression; physical-device QA not claimed');
