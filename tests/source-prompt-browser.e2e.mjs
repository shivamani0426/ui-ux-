import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright';
import {server} from '../server.mjs';
import {installKageMock,originalPrompt} from './kage-mcp-fixture.mjs';

// Browser-level proof of the full verified Kage prompt viewer.
// The official MCP fixture supplies exact publisher text. No model generates it.
const restore=installKageMock();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let failed=false;
try{
  for(const [label,browserType] of [['Chromium',chromium],['Firefox',firefox]]){
    let browser;
    try{
      browser=await browserType.launch({headless:true});
      const page=await browser.newPage({viewport:{width:1280,height:800}});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/studio',{waitUntil:'domcontentloaded',timeout:20000});
      await page.locator('.composer textarea').waitFor({timeout:13000});
      await page.locator('.composer textarea').fill(
        'Build a student learning dashboard with courses, assignments and progress');
      await page.locator('.composer textarea').press('Enter');
      const viewer=page.locator('.inspiration-prompt-verbatim').first();
      await viewer.waitFor({timeout:20000});
      await viewer.locator('summary').click();
      assert.equal(await viewer.locator('pre').textContent(),originalPrompt,
        'Browser must render the exact unchanged publisher prompt');
      const link=page.locator('.inspiration-card').first()
        .getByRole('link',{name:/Open original Kage source/i});
      assert.equal(await link.getAttribute('href'),
        'https://kage.design/designs/student-dashboard-original',
        'Prompt must link to its original Kage page');
      const button=viewer.getByRole('button',{name:/Copy exact original publisher prompt/i});
      assert.ok(await button.isVisible(),'Copy exact prompt must be actionable');
      await button.click();
      assert.ok(errors.length===0,label+' JavaScript errors: '+errors.join('; '));
      console.log(label+' verified original link, verbatim prompt and copy control');
    }catch(e){
      failed=true;
      console.error(label+' original prompt viewer FAILED: '+e.stack);
    }finally{await browser?.close();}
  }
}finally{
  restore();
  await new Promise(resolve=>server.close(resolve));
}
if(failed)process.exitCode=1;
