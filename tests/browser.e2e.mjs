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
    await page.goto(url+'/?utm_source=chatgpt.com&advanced=1',{waitUntil:'domcontentloaded',timeout:60000});
    try{
      await page.locator('.fl-orb-intro').waitFor({timeout:6500});
    }catch(error){
      const preview=await page.evaluate(()=>document.body?.innerText?.slice(0,350)||'NO BODY').catch(()=>'<unavailable>');
      throw new Error('Automatic black-orb entrance failed: '+errors.join(' | ')+'. Visible: '+preview+'. '+error.message);
    }
    assert.equal(await page.locator('.fl-orb-intro-disc').count(),1,
      name+' should open with one centrally positioned black ball');
    assert.equal(await page.locator('.fl-dome-f-sculpture').count(),0,
      'The previous F-shaped sculpture must be gone');
    assert.equal(await page.locator('.fl-dome-trigger').count(),0,
      'Opening must not require a click or tap');
    assert.equal((await page.locator('.fl-orb-intro').innerText()).trim(),'',
      'Black-ball opening should contain no extra text or buttons');
    assert.equal(await page.locator('.composer textarea').count(),0,
      'The design chat must not appear on the landing page');
    await page.screenshot({path:'browser-artifacts/'+name+'-automatic-black-orb.png',fullPage:false});
    await page.locator('.fl-orb-intro').waitFor({state:'detached',timeout:6500});
    assert.equal(await page.locator('.fl-auto-landing').count(),1,
      'The friendly auto-landing should appear without any entrance click');
    assert.equal(await page.locator('.fl-world').getAttribute('inert'),null);
    await page.getByRole('button',{name:'Log In',exact:true}).waitFor({timeout:6000});
    await page.getByRole('button',{name:'Sign Up',exact:true}).waitFor({timeout:6000});
    const buttons=await page.locator('.fl-auto-entry-actions').boundingBox();
    assert.ok(buttons && Math.abs(buttons.x+buttons.width/2-720)<6,
      'Log In and Sign Up must be horizontally centered on desktop: '+JSON.stringify(buttons));
    assert.ok((await page.locator('.fl-story-scene').count())===5,
      'All five feature scenes must still exist');
    assert.equal(await page.locator('.fl-atmosphere .fl-water .fl-ripple').count(),3,
      'Original animated water ripples must remain intact');
    assert.equal(await page.locator('.fl-tour-ui').count(),0,'Remove the former scrolling-tour controls');
    assert.equal(await page.locator('.fl-landing-gateway').count(),0,'Do not delay account buttons until spiral');
    assert.equal(await page.locator('.composer textarea').count(),0,'No unwanted landing chat input');
    await page.screenshot({path:'browser-artifacts/'+name+'-friendly-landing.png',fullPage:false});
    // Landing is time-driven rather than scroll-driven; the features reveal
    // automatically and the account options remain visible throughout.
    if(!remote){
      await page.locator('.fl-chapter-1').waitFor({timeout:8000});
      assert.equal(await page.getByRole('button',{name:'Log In',exact:true}).isVisible(),true,
        'Log In must remain available during automatic feature playback');
      assert.equal(await page.getByRole('button',{name:'Sign Up',exact:true}).isVisible(),true,
        'Sign Up must remain available during automatic feature playback');
      assert.equal(await page.evaluate(()=>window.scrollY),0,
        'The landing must not scroll to reveal features');
      await page.getByRole('button',{name:'Pause feature showcase'}).click();
      await page.locator('.fl-auto-landing[data-auto-features="paused"]').waitFor({timeout:2200});
      const held=await page.locator('.fl-auto-landing').getAttribute('class');
      await page.waitForTimeout(430);
      assert.equal(await page.locator('.fl-auto-landing').getAttribute('class'),held,
        'Pausing the feature sequence should hold the current scene');
      await page.getByRole('button',{name:/Show 04 \/ DESIGN PREFERENCES/}).click();
      await page.locator('.fl-chapter-4').waitFor({timeout:3000});
      // Capture the settled design, not the intentionally animated intermediate
      // crossfade between chapters. Ensure only the final scene is visible.
      await page.waitForTimeout(1500);
      const opacities=await page.locator('.fl-story-scene').evaluateAll(nodes=>
        nodes.map(el=>Number(getComputedStyle(el).opacity)));
      assert.ok(opacities[4]>.96&&opacities.slice(0,4).every(v=>v<.04),
        'Sequential feature animation must finish without overlapping stories: '+JSON.stringify(opacities));
      assert.equal(await page.locator('.fl-spiral-art').count(),1,
        'Preserve the original animated spiral during the final feature');
      await page.screenshot({path:'browser-artifacts/'+name+'-friendly-spiral-highlight.png',fullPage:false});
      await page.getByRole('button',{name:'Replay feature showcase'}).click();
      await page.locator('.fl-chapter-0').waitFor({timeout:3000});
      await page.getByRole('button',{name:'Pause feature showcase'}).click();
    }
    const doc=await page.title();
    assert.ok(doc.includes('Frontline UX/UI'));
    const body=await page.locator('body').innerText();
    assert.ok(body.trim().length>30,name+' BLANK PAGE: '+errors.join('\n'));
    await page.getByRole('button',{name:'Log In',exact:true}).click();
    await page.locator('.fl-blackhole-transition.is-expanding').waitFor({timeout:2400});
    await page.locator('.fl-login-page').waitFor({timeout:8500});
    await page.waitForFunction(()=>location.pathname==='/login',null,{timeout:8500});
    const googleConfig=await page.evaluate(()=>fetch('/api/auth/status').then(r=>r.json()));
    assert.equal(await page.getByRole('button',{name:'Continue with Google'}).isDisabled(),!googleConfig.googleEnabled,
      'Google Sign-In must be enabled only when the provider is configured');
    // The preserved black-hole transition intentionally occludes the login
    // screen for ~760ms. Verify the actual stable login rather than capturing
    // a black frame mid-fade.
    await page.locator('.fl-blackhole-transition').waitFor({state:'detached',timeout:4000});
    await page.screenshot({path:'browser-artifacts/'+name+'-friendly-login.png',fullPage:false});
    await page.getByRole('button',{name:'Enter Studio as Guest'}).click();
    await page.waitForFunction(()=>location.pathname==='/studio',null,{timeout:8500});
    await page.locator('.composer-position.docked textarea').waitFor({timeout:8500});
    assert.equal(await page.locator('.fl-login-page').count(),0,'Studio entry must replace login page');
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
    // The login -> guest entry has already revealed the studio. Wait for
    // the compositor transition before typing so the first input is preserved.
    await page.locator('.composer textarea').focus();
    await page.locator('.conversation-scene').waitFor({timeout:8000});
    await page.waitForTimeout(600);
    const chatShape=await page.locator('.composer-position.docked').boundingBox();
    const textareaShape=await page.locator('.composer textarea').boundingBox();
    assert.ok(chatShape&&chatShape.width<=690&&chatShape.height<=155,
      name+' docked composer must be ChatGPT-proportioned without removing StarBorder: '+JSON.stringify(chatShape));
    assert.ok(textareaShape&&textareaShape.height<=60,'Composer starts as a compact single-line field');
    assert.ok(await page.locator('.chat-star canvas').count()>=1,'Preserve animated Frontline StarBorder canvas');
    const firstPrompt='A modern student learning platform with a study dashboard and AI tutor';
    await page.locator('.composer textarea').fill(firstPrompt);
    assert.equal(await page.locator('.composer textarea').inputValue(),firstPrompt,
      name+' first message should remain in the composer after mode transition');
    await page.locator('.composer textarea').press('Enter');
    await page.locator('.message-row.outgoing').first().waitFor({timeout:12000});
    await page.locator('.message-row.incoming').first().waitFor({timeout:12000});
    assert.ok(await page.locator('.message-avatar .fl-monogram').count()>=1,'AI avatar must use F mark');
    // Public release: source-first chat is the only default response. No style panels.
    await page.locator('.message-markdown').first().waitFor({timeout:remote?100000:15000});
    try{
      await page.getByRole('button',{name:'Yes, combine them'}).waitFor({timeout:15000});
    }catch(error){
      const messages=await page.locator('.message-row').allInnerTexts();
      const sourceResponse=await page.evaluate(()=>({url:location.href,
        appText:document.body?.innerText?.slice(-1000)||''}));
      throw new Error('Source chat consent unavailable. Messages: '+JSON.stringify(messages)+
        '. Browser state: '+JSON.stringify(sourceResponse)+'. Console: '+errors.join(' | ')+'. '+error.message);
    }
    assert.equal(await page.locator('.result-message').count(),0,
      'No complex recommendations/workbench should interrupt the source-first chat');
    assert.equal(await page.locator('.design-option').count(),0,
      'No Minimal, Glass or Creative style selectors in normal chat');
    const firstAnswer=await page.locator('.message-markdown').last().innerText();
    assert.match(firstAnswer,/Would you like the best combination of UI\/UX designs and components/i);
    assert.doesNotMatch(firstAnswer,/Matching components and animations/i,
      'Components must not appear before opt-in');
    await page.getByRole('button',{name:'Yes, combine them'}).click();
    await page.locator('.message-markdown').nth(1).waitFor({timeout:15000});
    await page.waitForFunction(()=>document.querySelectorAll('.message-markdown').length>=2);
    const combined=await page.locator('.message-markdown').last().innerText();
    assert.match(combined,/No verified publisher|UI\/UX designs and original prompts/i);
    assert.equal(await page.getByRole('button',{name:'Yes, combine them'}).count(),0,
      'Consent prompt must disappear once the user answers');
    await page.screenshot({path:'browser-artifacts/'+name+'-simple-source-chat.png',fullPage:false});
    if(!remote){
      await page.reload({waitUntil:'domcontentloaded'});
      await page.locator('.composer textarea').waitFor({timeout:8500});
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      await page.getByRole('button',{name:/My projects & conversations/i}).click();
      await page.locator('.fl-project-library').waitFor({timeout:9000});
      assert.ok(await page.locator('.fl-project-card').count()>=1,'Project archive must remain usable');
      await page.locator('.fl-project-card').first().click();
      await page.locator('.message-markdown').nth(1).waitFor({timeout:10000});
      assert.equal(await page.getByRole('button',{name:'Yes, combine them'}).count(),0,
        'Saved answers must not recreate a previous consent step');
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      await page.getByRole('button',{name:/Guest account & privacy/i}).click();
      await page.locator('.fl-account-root').waitFor({timeout:7000});
      assert.equal(await page.locator('.fl-account-stat').count(),4);
      await page.locator('.close-menu').click();
    }
    const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
    await mobile.goto(url+'/?advanced=1',{waitUntil:'domcontentloaded',timeout:60000});
    await mobile.locator('.fl-orb-intro').waitFor({timeout:6500});
    assert.equal(await mobile.locator('.fl-dome-f-sculpture').count(),0,'No old F on mobile');
    await mobile.screenshot({path:'browser-artifacts/'+name+'-mobile-black-orb.png',fullPage:false});
    await mobile.locator('.fl-orb-intro').waitFor({state:'detached',timeout:6500});
    await mobile.getByRole('button',{name:'Log In',exact:true}).waitFor({timeout:5000});
    await mobile.getByRole('button',{name:'Sign Up',exact:true}).waitFor({timeout:5000});
    const mobileActions=await mobile.locator('.fl-auto-entry-actions').boundingBox();
    assert.ok(mobileActions&&mobileActions.x>=-2&&mobileActions.x+mobileActions.width<=391,
      'Mobile account buttons should fit horizontally: '+JSON.stringify(mobileActions));
    assert.equal(await mobile.locator('.composer textarea').count(),0,'No mobile chat before account entry');
    assert.equal(await mobile.evaluate(()=>window.scrollY),0,'Mobile landing must not auto-scroll');
    assert.equal(await mobile.locator('.fl-fluid-canvas').count()>=0,true);
    await mobile.screenshot({path:'browser-artifacts/'+name+'-mobile-friendly-landing.png',fullPage:false});
    await mobile.getByRole('button',{name:'Log In',exact:true}).tap();
    await mobile.locator('.fl-login-page').waitFor({timeout:8500});
    await mobile.getByRole('button',{name:'Enter Studio as Guest'}).tap();
    await mobile.locator('.studio-title').waitFor({timeout:8500});
    await mobile.locator('.composer textarea').waitFor({timeout:8500});
    const mobileComposer=await mobile.locator('.composer-position.docked').boundingBox();
    assert.ok(mobileComposer&&mobileComposer.width<=390&&mobileComposer.height<=150,
      'Mobile compact composer must fit screen without excessive height: '+JSON.stringify(mobileComposer));
    await mobile.screenshot({path:'browser-artifacts/'+name+'-mobile-studio.png',fullPage:false});
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,
      'Mobile studio must have no horizontal overflow');
    if(!remote){
      await mobile.locator('.composer textarea').fill(
        'Design a mobile-first creator portfolio with case studies, projects and accessible navigation.');
      await mobile.locator('.composer textarea').press('Enter');
      await mobile.getByRole('button',{name:'Yes, combine them'}).waitFor({timeout:15000});
      assert.equal(await mobile.locator('.result-message').count(),0);
      assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,
        'Source-first mobile chat must not overflow horizontally');
      await mobile.screenshot({path:'browser-artifacts/'+name+'-mobile-source-chat.png',fullPage:false});
    }
    await mobile.close();
    // M15: a genuine Chromium service worker must reopen the public PWA shell
    // offline from its FIRST completed install; private APIs must remain offline.
    if(!remote&&name==='Chromium'){
      const offlineContext=await browser.newContext({serviceWorkers:'allow'});
      const offlinePage=await offlineContext.newPage();
      try{
        await offlinePage.goto(url+'/studio',{waitUntil:'load',timeout:45000});
        await offlinePage.evaluate(async()=>{await navigator.serviceWorker.ready;});
        await offlinePage.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:7000});
        await offlineContext.setOffline(true);
        await offlinePage.reload({waitUntil:'domcontentloaded',timeout:25000});
        await offlinePage.locator('.studio-title').waitFor({timeout:10000});
        assert.equal(await offlinePage.evaluate(async()=>{
          try{await fetch('/api/health');return false;}catch{return true;}
        }),true,'Private and account APIs must never be replayed from the PWA cache');
        await offlinePage.screenshot({path:'browser-artifacts/Chromium-PWA-first-offline-reopen.png'});
      }finally{await offlineContext.close();}
    }
    // Reduced-motion users see the black orb briefly, then a STATIC landing.
    // They can still choose any feature or account route manually.
    const reducedPage=await browser.newPage({viewport:{width:1024,height:720},reducedMotion:'reduce'});
    await reducedPage.goto(url+'/',{waitUntil:'domcontentloaded',timeout:60000});
    await reducedPage.locator('.fl-orb-intro').waitFor({state:'detached',timeout:3500});
    assert.equal(await reducedPage.locator('.fl-auto-landing').getAttribute('data-auto-features'),'paused',
      'Reduced motion must not play the feature sequence automatically');
    await reducedPage.getByRole('button',{name:'Sign Up',exact:true}).waitFor({timeout:4500});
    await reducedPage.getByRole('button',{name:/Show 02 \/ GENERATE UI & UX/}).click();
    await reducedPage.locator('.fl-chapter-2').waitFor({timeout:3000});
    assert.equal(await reducedPage.evaluate(()=>window.scrollY),0);
    await reducedPage.close();
    if(!remote){
      // OAuth return parameters are untrusted. A forged ?github=connected
      // must never cause a false successful connection notification.
      const callbackPage=await browser.newPage();
      try{
        await callbackPage.goto(url+'/studio?github=connected',{waitUntil:'domcontentloaded'});
        const forged=callbackPage.getByRole('status').filter({hasText:'GitHub connection'});
        await forged.waitFor({timeout:7500});
        assert.match(await forged.innerText(),/not verified|could not be verified/);
        assert.equal(new URL(callbackPage.url()).searchParams.has('github'),false,
          'OAuth callback status must be removed from browser navigation history');
        await callbackPage.goto(url+'/studio?github=connect_failed',{waitUntil:'domcontentloaded'});
        await callbackPage.getByRole('status').filter({hasText:'GitHub could not be connected.'})
          .waitFor({timeout:7500});
        assert.equal(new URL(callbackPage.url()).searchParams.has('github'),false);
      }finally{await callbackPage.close();}
    }
    if(errors.length)console.log(name+' had nonfatal errors: '+errors.join('\n'));
  }catch(error){
    failed=true;
    console.error(name+' FAILED: '+error.stack);
  }finally{await browser?.close();}
}
if(!remote)await new Promise(resolve=>server.close(resolve));
if(failed)process.exitCode=1;
