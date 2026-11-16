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
    await page.locator('.fl-dome-portal').waitFor({timeout:7000});
    assert.equal(await page.locator('.fl-dome-trigger').count(),1,name+' should start at the central black dome');
    assert.equal((await page.locator('.fl-dome-portal').innerText()).trim(),'',
      name+' black entrance must contain ZERO visible text');
    assert.equal(await page.locator('.fl-dome-f-sculpture').count(),1,
      name+' entrance must show one original sculpted F');
    const sculpture=await page.locator('.fl-dome-f-sculpture').boundingBox();
    const viewport=page.viewportSize();
    assert.ok(sculpture&&Math.abs(sculpture.x+sculpture.width/2-viewport.width/2)<6
      && Math.abs(sculpture.y+sculpture.height/2-viewport.height/2)<6,
      name+' F sculpture must be precisely centered: '+JSON.stringify(sculpture));
    assert.equal(await page.locator('.composer textarea').count(),0,name+' chat must be absent while the portal is locked');
    assert.equal(await page.locator('.fl-world').getAttribute('inert'),'',
      name+' pre-landing story must be inert until the portal opens');
    await page.mouse.move(24,Math.round(page.viewportSize().height/2));
    await page.mouse.wheel(0,420);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>window.scrollY),0,'Dome gate should lock user-initiated wheel scrolling');
    await page.screenshot({path:'browser-artifacts/'+name+'-black-dome-entry.png',fullPage:false});
    await page.locator('.fl-dome-trigger').hover();
    await page.waitForTimeout(450);
    assert.equal(await page.locator('.fl-dome-portal').getAttribute('data-phase'),'idle',
      name+' hovering must NOT trigger the cinematic portal');
    await page.locator('.fl-dome-trigger').click();
    await page.locator('.fl-dome-portal.is-charging').waitFor({timeout:2500});
    assert.equal(await page.locator('.fl-world').getAttribute('inert'),'',
      name+' landing must remain locked while bright white energy gathers');
    await page.waitForTimeout(1400);
    const whiteCharge=await page.evaluate(()=>{
      const dome=document.querySelector('.fl-dome-portal-orb');
      const aura=document.querySelector('.fl-dome-white-aura');
      return {background:getComputedStyle(document.querySelector('.fl-dome-portal')).backgroundColor,
        aura:Number(getComputedStyle(aura).opacity),shadow:getComputedStyle(dome).boxShadow,
        clip:getComputedStyle(document.querySelector('.fl-world')).clipPath};
    });
    assert.equal(whiteCharge.background,'rgb(3, 3, 3)',name+' charging background must stay black');
    assert.ok(whiteCharge.aura>.1,name+' white halo must visibly build for seconds: '+JSON.stringify(whiteCharge));
    assert.ok(whiteCharge.clip.includes('0%'),name+' landing must not appear before charge completes');
    await page.screenshot({path:'browser-artifacts/'+name+'-white-dome-charge.png',fullPage:false});
    await page.locator('.fl-dome-portal.is-opening').waitFor({timeout:3500});
    await page.waitForTimeout(500);
    const clipEarly=await page.locator('.fl-world').evaluate(el=>getComputedStyle(el).clipPath);
    await page.waitForTimeout(1350);
    const clipMiddle=await page.locator('.fl-world').evaluate(el=>getComputedStyle(el).clipPath);
    assert.ok(clipEarly.includes('circle(')&&clipMiddle.includes('circle(')&&clipEarly!==clipMiddle,
      name+' inside-out aperture should expand progressively over multiple seconds: '+JSON.stringify({clipEarly,clipMiddle}));
    const aperture=await page.locator('.fl-world').evaluate(el=>{
      const clip=getComputedStyle(el).clipPath;
      const shape=clip.split(' at ')[0];
      const parts=/([+-]?(?:\d+\.?\d*|\.\d+))(px|vmax|vmin|vw|vh|%)/g;
      let radius=0, count=0;
      for(const [,v,u] of shape.matchAll(parts)){
        const n=Number(v);
        radius+=u==='px'?n:u==='vmax'?n*Math.max(innerWidth,innerHeight)/100:
          u==='vmin'?n*Math.min(innerWidth,innerHeight)/100:
          u==='vw'?n*innerWidth/100:u==='vh'?n*innerHeight/100:
          n*Math.hypot(innerWidth,innerHeight)/100;
        count++;
      }
      return {radius:count?radius:NaN,needed:Math.hypot(innerWidth/2,innerHeight/2),clip};
    });
    assert.ok(Number.isFinite(aperture.radius)&&aperture.radius<aperture.needed,
      name+' the circular aperture must still be growing halfway through the reveal: '+JSON.stringify(aperture));
    assert.equal(await page.locator('.app').evaluate(el=>getComputedStyle(el).backgroundColor),
      'rgb(0, 0, 0)',name+' outside the growing aperture must remain pure black');
    await page.screenshot({path:'browser-artifacts/'+name+'-dome-inside-out-reveal.png',fullPage:false});
    await page.locator('.fl-dome-portal').waitFor({state:'detached',timeout:7000});
    assert.equal(await page.locator('.fl-world').getAttribute('inert'),null,
      name+' landing must become keyboard and pointer accessible after reveal');
    assert.notEqual(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow),'hidden',
      name+' scroll should unlock after dome reveal');
    await page.waitForTimeout(650);
    assert.equal(await page.locator('.brand-mark .fl-monogram').count(),1,'Header must show branded F');
    await page.screenshot({path:'browser-artifacts/'+name+'-landing.png',fullPage:false});
    if(await page.locator('.fl-world').count()){
      assert.ok((await page.title()).includes('Frontline UX/UI'));
      assert.equal(await page.locator('.fl-chapter-0').count(),1);
      const introTitle=await page.locator('.fl-chapter-0 .fl-headline-main').boundingBox();
      const titleViewport=page.viewportSize();
      assert.ok(introTitle && introTitle.x>=-6 && introTitle.x+introTitle.width<=titleViewport.width+6,
        name+' INTRO TITLE OVERFLOW: '+JSON.stringify(introTitle));
      if(!remote){
        const timeline=await page.evaluate(()=>({
          screens:document.documentElement.scrollHeight/window.innerHeight,
          composerCount:document.querySelectorAll('.composer textarea').length,
        }));
        assert.ok(timeline.screens>=9,name+' should offer an extended, deliberate scroll journey: '+JSON.stringify(timeline));
        assert.equal(timeline.composerCount,0,'Opening should remain free of the composer');
        await page.evaluate(()=>window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*.296,behavior:'instant'}));
        await page.waitForFunction(()=>document.querySelector('.fl-chapter-1'),null,{timeout:9000});
        const separate=await page.evaluate(()=>{
          const a=[...document.querySelectorAll('.fl-story-scene')].map(x=>Number(getComputedStyle(x).opacity));
          return {select:a[1],generate:a[2],intro:a[0]};
        });
        assert.ok(separate.select>.92 && separate.generate<.04 && separate.intro<.04,
          name+' feature chapters must have an independent reading hold: '+JSON.stringify(separate));
        await page.evaluate(()=>window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*.787,behavior:'instant'}));
        await page.waitForFunction(()=>document.querySelector('.fl-chapter-4'),null,{timeout:9000});
        const seed=await page.evaluate(()=>{
          const m=new DOMMatrix(getComputedStyle(document.querySelector('.fl-spiral-stage')).transform);
          return {scale:Math.hypot(m.a,m.b),composer:Number(getComputedStyle(document.documentElement).getPropertyValue('--fl-compose-reveal'))};
        });
        assert.ok(seed.scale<.15 && seed.composer===0,name+' spiral must begin as a tiny seed, with no chat: '+JSON.stringify(seed));
        await page.evaluate(()=>window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*.952,behavior:'instant'}));
        await page.waitForTimeout(250);
        const mature=await page.evaluate(()=>{
          const m=new DOMMatrix(getComputedStyle(document.querySelector('.fl-spiral-stage')).transform);
          return {scale:Math.hypot(m.a,m.b),composer:Number(getComputedStyle(document.documentElement).getPropertyValue('--fl-compose-reveal'))};
        });
        assert.ok(mature.scale>.98 && mature.scale>seed.scale*8,
          name+' spiral should mature progressively across a long scroll distance: '+JSON.stringify({seed,mature}));
        assert.ok(mature.composer>0 && mature.composer<.75,
          name+' chat reveal should lag spiral maturation rather than pop fully into view: '+JSON.stringify(mature));
        await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      }
      if(!remote){
        await page.evaluate(()=>window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*.385,behavior:'instant'}));
        await page.waitForTimeout(270);
        const letterBefore=await page.locator('.fl-story-scene-2 .fl-kinetic-glyph').first()
          .evaluate(el=>getComputedStyle(el).transform);
        await page.evaluate(()=>window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*.455,behavior:'instant'}));
        await page.waitForTimeout(270);
        const letterAfter=await page.locator('.fl-story-scene-2 .fl-kinetic-glyph').first()
          .evaluate(el=>getComputedStyle(el).transform);
        assert.notEqual(letterBefore,letterAfter,
          name+' scroll-responsive kinetic letters must animate through position, not pop');
      }
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
    if(await page.locator('.fl-world').count()){
      assert.equal(await page.locator('.composer textarea').count(),0,
        name+' composer MUST be absent on the first screen');
      await page.evaluate(()=>window.scrollTo({top:Math.max(0,document.documentElement.scrollHeight-innerHeight)*.87,behavior:'instant'}));
      await page.waitForFunction(()=>document.querySelector('.fl-chapter-4'),null,{timeout:8000});
      await page.waitForTimeout(350);
      assert.equal(await page.locator('.fl-spiral-art').count(),1,
        name+' golden typographic spiral should be present at the final chapter');
      await page.screenshot({path:'browser-artifacts/'+name+'-spiral-before-chat.png',fullPage:false});
      await page.evaluate(()=>window.scrollTo({top:Math.max(0,document.documentElement.scrollHeight-innerHeight),behavior:'instant'}));
      await page.locator('.composer-position.spiral-emerging.is-ready textarea').waitFor({timeout:8500});
      const reveal=await page.evaluate(()=>Number(getComputedStyle(document.documentElement).getPropertyValue('--fl-compose-reveal')));
      assert.ok(reveal>.95,name+' composer must emerge progressively from the spiral');
      await page.waitForTimeout(450);
      await page.screenshot({path:'browser-artifacts/'+name+'-spiral-chat-reveal.png',fullPage:false});
    }
    await page.locator('.composer textarea').waitFor({timeout:7000});
    if(!remote && await page.locator('.fl-world').count()){
      await page.locator('.composer textarea').focus();
      await page.locator('.studio-title').waitFor({timeout:7000});
      assert.match(await page.locator('.studio-title').innerText(),/Design beyond/);
      assert.equal(await page.locator('.studio-starters button').count(),3);
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
      await page.waitForTimeout(1150); // wait for the chat transition and welcome entrance motion
      await page.screenshot({path:'browser-artifacts/'+name+'-studio-dark.png',fullPage:false});
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      await page.locator('.menu-panel').waitFor();
      assert.equal(await page.locator('.menu-panel .tool-mode').count(),0);
      await page.getByRole('button',{name:/Switch to light theme/i}).click();
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
      await page.locator('.close-menu').click();
      await page.waitForTimeout(450);
      await page.screenshot({path:'browser-artifacts/'+name+'-studio-light.png',fullPage:false});
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      await page.getByRole('button',{name:/Switch to dark theme/i}).click();
      await page.locator('.close-menu').click();
    }
    await page.locator('.composer textarea').fill('A modern student learning platform with a study dashboard and AI tutor');
    await page.locator('.composer textarea').press('Enter');
    await page.locator('.message-row.outgoing').first().waitFor({timeout:12000});
    await page.locator('.message-row.incoming').first().waitFor({timeout:12000});
    assert.ok(await page.locator('.message-avatar .fl-monogram').count()>=1,'AI avatar must use F mark');
    await page.locator('.result-message').first().waitFor({timeout:12000});
    if(!remote){
      await page.locator('.inspiration-card').first().waitFor({timeout:8000});
      const firstCard=page.locator('.inspiration-card').first();
      assert.ok((await page.locator('.inspiration-card').count())>=10,'Should render references from curated library');
      await firstCard.getByRole('button',{name:'Save inspiration'}).click();
      await page.waitForFunction(()=>document.querySelector('.inspiration-saved-counter strong')?.textContent?.includes('1 saved'));
      assert.equal(await page.locator('.inspiration-save.selected').count(),1,'Chosen inspiration should be saved');
      await firstCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(450);
      await page.screenshot({path:'browser-artifacts/'+name+'-select-inspirations.png',fullPage:false});
      await page.locator('.inspiration-search input').fill('portfolio');
      assert.ok((await page.locator('.inspiration-card').count())>=1,'Portfolio filter should yield references');
      await page.locator('.inspiration-search input').fill('');
      await page.reload({waitUntil:'networkidle'});
      // A refresh starts a fresh site entry. Open the golden dome before navigating history.
      await page.locator('.fl-dome-trigger').click();
      await page.locator('.fl-dome-portal').waitFor({state:'detached',timeout:8500});
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      await page.getByRole('button',{name:/My conversations/i}).click();
      await page.locator('.history-item').first().click();
      await page.locator('.inspiration-save.selected').first().waitFor({timeout:10000});
      assert.equal(await page.locator('.inspiration-save.selected').count(),1,'Inspiration pick should survive refresh');
    }
    const selectAll=page.getByRole('button',{name:/Select all three/i});
    await selectAll.click();
    const count=await page.locator('.design-option.picked').count();
    assert.equal(count,3);
    console.log(name+' workflow passed, selected='+count);
    await page.waitForTimeout(950);
    await page.screenshot({path:'browser-artifacts/'+name+'-chat.png',fullPage:false});
    if(!remote){
      await page.getByRole('button',{name:/Preview selected design/i}).click();
      await page.locator('.preview-app.fusion').waitFor();
      await page.waitForTimeout(650);
      await page.screenshot({path:'browser-artifacts/'+name+'-fusion-workbench.png',fullPage:false});
      await page.locator('.feedback-details > summary').click();
      assert.equal(await page.locator('.reaction-set button').count(),3);
      await page.locator('.feedback-details > summary').click();
      // Milestone 0.4: actual Generate UI/UX and Design Fusion prompt journeys.
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      await page.getByRole('button',{name:/Select \/ Generate \/ Fusion/i}).click();
      await page.locator('.tool-mode').filter({hasText:'Generate UI/UX'}).click();
      await page.getByRole('button',{name:/Generate three directions/i}).click();
      await page.locator('.di-result').waitFor({timeout:16000});
      const generatedPrompt=await page.locator('.di-result pre').innerText();
      assert.match(generatedPrompt,/THREE ORIGINAL DESIGN DIRECTIONS/);
      assert.match(generatedPrompt,/DIRECTION 3/);
      assert.ok(generatedPrompt.length>1800,name+' generated UI/UX prompt should be substantial');
      await page.screenshot({path:'browser-artifacts/'+name+'-generate-uiux-prompt.png',fullPage:false});
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      await page.getByRole('button',{name:/Select \/ Generate \/ Fusion/i}).click();
      await page.locator('.tool-mode').filter({hasText:'Design Fusion'}).click();
      await page.getByRole('button',{name:/Combine my selected concepts/i}).click();
      await page.locator('.di-result').waitFor({timeout:16000});
      assert.match(await page.locator('.di-result pre').innerText(),/DESIGN FUSION SPECIFICATION/);
      await page.screenshot({path:'browser-artifacts/'+name+'-intelligent-design-fusion.png',fullPage:false});
    }
    const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
    await mobile.goto(url+'/',{waitUntil:'networkidle',timeout:60000});
    await mobile.locator('.fl-dome-portal').waitFor({timeout:7000});
    assert.equal((await mobile.locator('.fl-dome-portal').innerText()).trim(),'',
      name+' mobile entrance must contain ZERO visible text');
    const mobileF=await mobile.locator('.fl-dome-f-sculpture').boundingBox();
    assert.ok(mobileF&&mobileF.x>=0&&mobileF.x+mobileF.width<=390,
      name+' F sculpture must fit the mobile viewport');

    assert.equal(await mobile.locator('.composer textarea').count(),0,'Mobile portal should hide the chat');
    await mobile.screenshot({path:'browser-artifacts/'+name+'-mobile-dome.png',fullPage:false});
    await mobile.locator('.fl-dome-trigger').dispatchEvent('pointerdown',{pointerType:'touch'});
    await mobile.waitForTimeout(120);
    assert.equal(await mobile.locator('.fl-dome-portal').getAttribute('data-phase'),'idle',
      'Touching without tapping/clicking must not start the portal');
    await mobile.locator('.fl-dome-trigger').tap();
    await mobile.locator('.fl-dome-portal.is-charging').waitFor({timeout:2500});
    await mobile.locator('.fl-dome-portal.is-opening').waitFor({timeout:3500});
    await mobile.locator('.fl-dome-portal').waitFor({state:'detached',timeout:8500});
    if(await mobile.locator('.fl-world').count())
      assert.equal(await mobile.locator('.composer textarea').count(),0,'Mobile composer must start absent');
    if(await mobile.locator('.fl-world').count()){
      await mobile.waitForTimeout(1500);
      await mobile.screenshot({path:'browser-artifacts/'+name+'-mobile-landing.png',fullPage:false});
      assert.equal(await mobile.locator('.fl-chapter-0').count(),1);
      const mobileTitle=await mobile.locator('.fl-chapter-0 .fl-headline-main').boundingBox();
      assert.ok(mobileTitle && mobileTitle.x>=-6 && mobileTitle.x+mobileTitle.width<=391,
        name+' MOBILE INTRO TITLE OVERFLOW: '+JSON.stringify(mobileTitle));
      assert.equal(await mobile.evaluate(()=>[...document.querySelectorAll('.fl-fluid-canvas')].every(c=>c.width===300)),true,'Mobile should use lightweight CSS solar fallback');
      if(!remote){
        await mobile.evaluate(()=>window.scrollTo({top:Math.max(0,document.documentElement.scrollHeight-innerHeight),behavior:'instant'}));
        await mobile.locator('.composer-position.spiral-emerging.is-ready textarea').waitFor({timeout:10000});
        await mobile.waitForTimeout(450);
        await mobile.screenshot({path:'browser-artifacts/'+name+'-mobile-spiral-chat.png',fullPage:false});
        await mobile.locator('.composer textarea').focus();
        await mobile.locator('.studio-title').waitFor({timeout:7000});
        await mobile.waitForTimeout(1300);
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
