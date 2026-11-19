import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright';
import {server} from '../server.mjs';

await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port;
try{
  for(const [name,type] of [['Chromium',chromium],['Firefox',firefox]]){
    const browser=await type.launch({headless:true});
    try{
      const page=await browser.newPage({viewport:{width:390,height:844}});
      const pageErrors=[];
      page.on('pageerror',e=>pageErrors.push(e.message));
      await page.goto(url+'/studio',{waitUntil:'domcontentloaded'});
      await page.locator('.composer textarea').waitFor({timeout:10000});
      assert.equal(await page.locator('.result-message').count(),0);
      assert.equal(await page.getByRole('button',{name:/Select \/ Generate \/ Fusion/}).count(),0);
      await page.locator('.composer textarea').fill(
        'Build a school dashboard for students and teachers with attendance and homework');
      await page.locator('.composer textarea').press('Enter');
      await page.getByRole('button',{name:'Yes, combine them'}).waitFor({timeout:15000});
      assert.equal(await page.locator('.result-message').count(),0);
      assert.match(await page.locator('.message-markdown').first().innerText(),
        /Would you like the best combination of UI\/UX designs and components/);
      assert.ok(!pageErrors.length,name+': '+pageErrors.join(' | '));
      // Never reveal components or invented prompts until explicit user approval.
      await page.getByRole('button',{name:'Yes, combine them'}).click();
      await page.locator('.message-markdown').nth(1).waitFor({timeout:15000});
      assert.match(await page.locator('.message-markdown').nth(1).innerText(),
        /No verified publisher designs or components were available/);
      assert.equal(await page.getByRole('button',{name:'Yes, combine them'}).count(),0);
      await page.locator('.composer textarea').fill(
        'Create a separate school attendance portal with student and teacher accounts');
      await page.locator('.composer textarea').press('Enter');
      await page.getByRole('button',{name:'No, thanks'}).waitFor({timeout:15000});
      await page.getByRole('button',{name:'No, thanks'}).click();
      await page.locator('.message-markdown').last().getByText(
        'Okay. You can enter a new design idea whenever you like.').waitFor({timeout:15000});
      assert.equal(await page.locator('.result-message').count(),0);
      assert.ok(!pageErrors.length,name+': '+pageErrors.join(' | '));
      console.log(name+' simple source-first chat and consent checks passed');
    }finally{await browser.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
