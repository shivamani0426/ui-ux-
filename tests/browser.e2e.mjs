import assert from 'node:assert/strict';
import {chromium, firefox} from 'playwright';
import {server} from '../server.mjs';
import fs from 'node:fs/promises';

await fs.mkdir('browser-artifacts',{recursive:true});
const remote=process.env.TARGET_URL;
if(!remote)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=remote||'http://127.0.0.1:'+server.address().port;
console.log('Testing Frontline UX/UI at '+url);

let failed=false;
for(const [name,browserType] of [['Chromium',chromium],['Firefox',firefox]]){
  let browser;
  try {
    browser=await browserType.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:850}});
    const errors=[];
    page.on('pageerror',error=>errors.push('PAGEERROR '+error.stack));
    page.on('console',message=>{if(message.type()==='error')errors.push('CONSOLE '+message.text())});
    page.on('response',res=>{if(res.status()>=400)errors.push('HTTP '+res.status()+' '+res.url())});
    await page.goto(url+'/?utm_source=chatgpt.com',{waitUntil:'networkidle',timeout:60000});
    await page.waitForTimeout(1500);
    await page.screenshot({path:'browser-artifacts/'+name+'-landing.png',fullPage:false});
    if(await page.locator('.fl-world').count()){
      assert.ok((await page.title()).includes('Frontline UX/UI'));
      assert.equal(await page.locator('.fl-chapter-0').count(),1);
      await page.evaluate(() => window.scrollTo({top:(document.documentElement.scrollHeight-window.innerHeight)*.53,behavior:'instant'}));
      await page.waitForFunction(() => document.querySelector('.fl-chapter-2'),null,{timeout:8000});
      await page.waitForTimeout(1400);
      await page.screenshot({path:'browser-artifacts/'+name+'-generate-story.png',fullPage:false});
      await page.evaluate(() => window.scrollTo({top:(document.documentElement.scrollHeight-window.innerHeight)*.73,behavior:'instant'}));
      await page.waitForFunction(() => document.querySelector('.fl-chapter-3'),null,{timeout:8000});
      await page.waitForTimeout(1400);
      await page.screenshot({path:'browser-artifacts/'+name+'-fusion-story.png',fullPage:false});
      await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
      await page.waitForFunction(() => document.querySelector('.fl-chapter-0'),null,{timeout:8000});
      console.log(name+' Frontline landing story passed');
    }
    const doc=await page.title();
    const body=await page.locator('body').innerText();
    console.log(name+' title: '+doc);
    console.log(name+' body preview: '+body.slice(0,400));
    console.log(name+' errors:\n'+errors.join('\n'));
    assert.ok(body.trim().length>30,name+' BLANK PAGE: content missing. '+errors.join('\n'));
    await page.locator('.composer textarea').waitFor({timeout:7000});
    if(!remote && await page.locator('.fl-world').count()){
      await page.locator('.composer textarea').focus();
      await page.locator('.studio-title').waitFor({timeout:7000});
      assert.match(await page.locator('.studio-title').innerText(),/Design beyond/);
      assert.equal(await page.locator('.studio-starters button').count(),3);
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
      await page.screenshot({path:'browser-artifacts/'+name+'-studio-dark.png',fullPage:false});
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      await page.locator('.menu-panel').waitFor();
      assert.equal(await page.locator('.menu-panel .tool-mode').count(),0);
      await page.getByRole('button',{name:/Switch to light theme/i}).click();
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
      await page.locator('.close-menu').click();
      await page.screenshot({path:'browser-artifacts/'+name+'-studio-light.png',fullPage:false});
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      await page.getByRole('button',{name:/Switch to dark theme/i}).click();
      await page.locator('.close-menu').click();
    }
    await page.locator('.composer textarea').fill('A modern student learning platform with a study dashboard and AI tutor');
    await page.locator('.composer textarea').press('Enter');
    await page.locator('.message-row.outgoing').first().waitFor({timeout:12000});
    await page.locator('.message-row.incoming').first().waitFor({timeout:12000});
    await page.locator('.result-message').first().waitFor({timeout:12000});
    const selectAll=page.getByRole('button',{name:/Select all three/i});
    await selectAll.click();
    const count=await page.locator('.design-option.picked').count();
    assert.equal(count,3);
    console.log(name+' workflow passed, selected='+count);
    await page.screenshot({path:'browser-artifacts/'+name+'-chat.png',fullPage:false});
    if(!remote){
      await page.getByRole('button',{name:/Preview selected design/i}).click();
      await page.locator('.preview-app.fusion').waitFor();
      await page.screenshot({path:'browser-artifacts/'+name+'-fusion-workbench.png',fullPage:false});
      await page.locator('.feedback-details > summary').click();
      assert.equal(await page.locator('.reaction-set button').count(),3);
      await page.locator('.feedback-details > summary').click();
    }
    const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    await mobile.goto(url+'/',{waitUntil:'networkidle',timeout:60000});
    await mobile.locator('.composer textarea').waitFor();
    if(await mobile.locator('.fl-world').count()){
      await mobile.waitForTimeout(1500);
      await mobile.screenshot({path:'browser-artifacts/'+name+'-mobile-landing.png',fullPage:false});
      assert.equal(await mobile.locator('.fl-chapter-0').count(),1);
      if(!remote){
        await mobile.locator('.composer textarea').focus();
        await mobile.locator('.studio-title').waitFor({timeout:7000});
        await mobile.screenshot({path:'browser-artifacts/'+name+'-mobile-studio.png',fullPage:false});
        const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        assert.equal(overflow,false,'Frontline mobile studio must have no horizontal overflow');
      }
    }
    await mobile.close();
    if(errors.length)console.log(name+' had nonfatal errors: '+errors.join('\n'));
  }catch(error){
    failed=true;
    console.error(name+' FAILED: '+error.stack);
  }finally{await browser?.close();}
}
if(!remote)await new Promise(resolve=>server.close(resolve));
if(failed)process.exitCode=1;
