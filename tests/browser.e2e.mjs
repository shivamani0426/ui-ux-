import assert from 'node:assert/strict';
import {chromium, firefox} from 'playwright';
import {server} from '../server.mjs';
import fs from 'node:fs/promises';

await fs.mkdir('browser-artifacts',{recursive:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port;
console.log('Testing UI Compass at '+url);

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
    await page.goto(url+'/?utm_source=chatgpt.com',{waitUntil:'networkidle',timeout:30000});
    await page.screenshot({path:'browser-artifacts/'+name+'-landing.png',fullPage:false});
    const doc=await page.title();
    const body=await page.locator('body').innerText();
    console.log(name+' title: '+doc);
    console.log(name+' body preview: '+body.slice(0,400));
    console.log(name+' errors:\n'+errors.join('\n'));
    assert.ok(body.trim().length>30,name+' BLANK PAGE: content missing. '+errors.join('\n'));
    await page.locator('.composer textarea').waitFor({timeout:7000});
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
    if(errors.length)console.log(name+' had nonfatal errors: '+errors.join('\n'));
  }catch(error){
    failed=true;
    console.error(name+' FAILED: '+error.stack);
  }finally{await browser?.close();}
}
await new Promise(resolve=>server.close(resolve));
if(failed)process.exitCode=1;
