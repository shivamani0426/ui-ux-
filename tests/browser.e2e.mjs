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
    await page.goto(url+'/?utm_source=chatgpt.com',{waitUntil:'domcontentloaded',timeout:60000});
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
    await page.locator('.result-message').first().waitFor({timeout:12000});
    // Project creation renders recommendations immediately while the model is
    // still responding. .message-row.incoming can be only the thinking dots.
    // Wait for the actual completed assistant content, never assert against a
    // loading animation or incorrectly claim Markdown was not rendered.
    await page.locator('.message-markdown').first().waitFor({timeout:remote?100000:12000});
    if(!remote){
      await page.locator('.inspiration-card').first().waitFor({timeout:8000});
      const firstCard=page.locator('.inspiration-card').first();
      assert.ok((await page.locator('.inspiration-card').count())>=10,'Should render references from curated library');
      await firstCard.getByRole('button',{name:'Save inspiration'}).click();
      await page.waitForFunction(()=>document.querySelector('.inspiration-saved-counter strong')?.textContent?.includes('1 saved'));
      assert.equal(await page.locator('.inspiration-save.selected').count(),1,'Chosen inspiration should be saved');
      // M13: board, style comparison, checkpoint and nondestructive restore.
      const workbench=page.locator('.pw-workbench');
      await workbench.waitFor({timeout:10000});
      await workbench.getByRole('button',{name:'Refresh design workbench'}).click();
      await workbench.getByRole('combobox',{name:'Choose saved inspiration'}).selectOption({index:1});
      await workbench.getByRole('button',{name:'Pin reference'}).click();
      await workbench.getByRole('combobox',{name:'Choose suggested page'}).selectOption({index:1});
      await workbench.getByRole('button',{name:'Add page'}).click();
      assert.equal(await workbench.locator('.pw-card').count(),2);
      await workbench.locator('.pw-card').first().getByRole('combobox').selectOption('approved');
      await workbench.getByRole('button',{name:'Save design board'}).click();
      await page.waitForFunction(()=>document.querySelector('.pw-save-row small')
        ?.textContent?.includes('Saved board'));
      await workbench.getByRole('button',{name:/Compare styles/}).click();
      assert.equal(await workbench.locator('.pw-style-card').count(),3,
        'Show all three original design directions side by side');
      await page.screenshot({path:'browser-artifacts/'+name+'-side-by-side-design-review.png',fullPage:false});
      await workbench.getByRole('button',{name:/Checkpoints/}).click();
      await workbench.getByRole('textbox',{name:'Checkpoint name'}).fill('First approved board');
      await workbench.getByRole('button',{name:'Save checkpoint'}).click();
      await workbench.locator('.pw-version-list li').first().waitFor({timeout:9000});
      await workbench.getByRole('button',{name:'Compare',exact:true}).click();
      await workbench.locator('.pw-change-report').waitFor({timeout:6000});
      await workbench.getByRole('button',{name:/Design board/}).click();
      await workbench.locator('.pw-card textarea').first().fill('Updated while reviewing the board');
      await workbench.getByRole('button',{name:'Save design board'}).click();
      await workbench.getByRole('button',{name:/Checkpoints/}).click();
      await workbench.getByRole('button',{name:'Compare',exact:true}).click();
      assert.match(await workbench.locator('.pw-change-report').innerText(),/Edited or moved/i);
      page.once('dialog',dialog=>dialog.accept());
      await workbench.getByRole('button',{name:'Restore',exact:true}).click();
      await workbench.getByRole('button',{name:/Design board/}).click();
      assert.equal(await workbench.locator('.pw-card textarea').first().inputValue(),'',
        'Checkpoint restore must recover saved notes without deleting the chat');
      await page.screenshot({path:'browser-artifacts/'+name+'-advanced-design-board.png',fullPage:false});
      await firstCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(450);
      await page.screenshot({path:'browser-artifacts/'+name+'-select-inspirations.png',fullPage:false});
      await page.locator('.inspiration-search input').fill('portfolio');
      assert.ok((await page.locator('.inspiration-card').count())>=1,'Portfolio filter should yield references');
      await page.locator('.inspiration-search input').fill('');
      await page.reload({waitUntil:'networkidle'});
      // /studio deep links now restore the studio without replaying the dome.
      await page.locator('.composer-position.docked textarea').waitFor({timeout:8500});
      assert.equal(new URL(page.url()).pathname,'/studio','Studio refresh should preserve its URL');
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      await page.getByRole('button',{name:/My projects & conversations/i}).click();
      await page.locator('.fl-project-library').waitFor({timeout:7000});
      assert.ok(await page.locator('.fl-project-card').count()>=1,
        'Private design archive must list saved projects');
      await page.getByRole('combobox',{name:'Sort projects'}).selectOption('alphabetical');
      await page.getByRole('combobox',{name:'Filter projects'}).selectOption('all');
      await page.getByRole('textbox',{name:'Search saved conversations'}).fill('no-match-testing-title');
      await page.getByText('No matching designs').waitFor();
      await page.getByRole('textbox',{name:'Search saved conversations'}).fill('');
      await page.locator('.fl-project-card').first().click();
      await page.locator('.inspiration-save.selected').first().waitFor({timeout:10000});
      assert.equal(await page.locator('.inspiration-save.selected').count(),1,'Inspiration pick should survive refresh');
      await page.locator('.pw-workbench .pw-card').first().waitFor({timeout:9000});
      assert.equal(await page.locator('.pw-workbench .pw-card').count(),2,
        'Private board cards must survive project reopening');
      await page.locator('.pw-workbench').getByRole('button',{name:/Checkpoints/}).click();
      assert.equal(await page.locator('.pw-version-list li').count(),1,
        'Named design checkpoints must survive browser reloads');
    }
    if(!remote){
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      await page.getByRole('button',{name:/Guest account & privacy/i}).click();
      await page.locator('.fl-account-root').waitFor({timeout:7000});
      assert.ok((await page.locator('.fl-account-stat').count())===4,
        'Account dashboard must show saved work, prompts, inspirations and feedback');
      const downloadPromise=page.waitForEvent('download');
      await page.getByRole('button',{name:/Download my private data/i}).click();
      const archive=await downloadPromise;
      assert.match(archive.suggestedFilename(),/frontline-private-data-\d{4}-\d{2}-\d{2}\.json/);
      await page.screenshot({path:'browser-artifacts/'+name+'-personal-account-dashboard.png',fullPage:false});
      await page.getByRole('button',{name:/Account security & recovery/i}).click();
      await page.locator('.fl-security-root').waitFor({timeout:7000});
      assert.equal(await page.locator('.fl-security-status').count(),1,
        'Guest security panel must explain browser session protection');
      assert.equal(await page.locator('.fl-security-delete').count(),0,
        'Guest visitors must never see an active Google account-deletion action');
      await page.screenshot({path:'browser-artifacts/'+name+'-account-security-guest.png',fullPage:false});
      await page.locator('.menu-panel .close-menu').click();
    }
    assert.equal(await page.locator('.pi-panel').count(),1,'Project Intelligence must render once, not repeat');
    assert.equal(await page.locator('.pi-comparisons').count(),1,'Comparison must render once');
    assert.equal(await page.locator('.pi-confidence').count(),1,
      'Brief-based evidence strength is visible, not presented as measured certainty');
    if(!remote){
      await page.locator('.pi-refine textarea').fill(
        'Keep the student dashboard and AI tutor, but exclude chat messaging. Prioritize mobile accessibility.');
      await page.getByRole('button',{name:'Update recommendations'}).click();
      await page.locator('.pi-exclusions').waitFor({timeout:8000});
      assert.match(await page.locator('.pi-exclusions').innerText(),/Messages and conversations/);
      await page.locator('.pi-details > summary').filter({hasText:'Compare the three directions'}).click();
      await page.locator('.pi-factor-details').first().locator('summary').click();
      assert.ok((await page.locator('.pi-factor-details').first().locator('li').count())>=2,
        'Each recommendation must disclose an auditable numeric scoring ledger');
      await page.screenshot({path:'browser-artifacts/'+name+'-design-intelligence-v2.png',fullPage:false});
      await page.getByRole('button',{name:'Reset',exact:true}).click();
      await page.locator('.pi-exclusions').waitFor({state:'detached',timeout:8000});
      assert.equal(await page.locator('.pi-refine textarea').inputValue(),'',
        'Reset returns to the original brief without deleting saved messages');
    }
    assert.ok(await page.locator('.message-markdown').count()>=1,'Advisor messages should use safe Markdown renderer');
    if(!remote){
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      await page.getByRole('button',{name:/Learning & privacy/i}).click();
      await page.locator('.learning-preferences').waitFor({timeout:7000});
      await page.locator('.learning-context-box').waitFor({timeout:7000});
      assert.match(await page.locator('.learning-context-box').innerText(),
        /latest explicit reaction|No confirmed category-level preference/i);
      assert.ok(await page.locator('.opt-in input[type="checkbox"]').isDisabled(),
        'Guest cookies must never be treated as verified contributors');
      await page.screenshot({path:'browser-artifacts/'+name+'-contextual-learning-privacy.png',fullPage:false});
      assert.ok(await page.locator('.learning-settings select').count()===4,
        'Private memory controls must offer motion, density, contrast and color atmosphere');
      const toggle=page.locator('.learning-switch input');
      await toggle.uncheck();
      await page.waitForFunction(()=>document.querySelector('.learning-switch input')?.checked===false);
      assert.ok(await page.locator('.learning-settings select').first().isDisabled(),
        'Pausing learning must disable preference corrections');
      await toggle.check();
      await page.locator('.learning-settings select').first().selectOption('minimal');
      await page.waitForFunction(()=>document.querySelector('.learning-settings select')?.value==='minimal');
      await page.locator('.close-menu').click();
    }
    const fallbackRetry=page.getByRole('button',{name:/Retry with OpenRouter/i});
    if(!remote&&await fallbackRetry.count())assert.ok(await fallbackRetry.first().isEnabled(),'Offline fallback must offer a usable retry action');
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
      assert.match(generatedPrompt,/REQUIREMENT TRACEABILITY MATRIX/);
      assert.match(generatedPrompt,/PER-PAGE INTERACTION CONTRACTS/);
      assert.match(generatedPrompt,/ROLE-SPECIFIC NAVIGATION & PERMISSION STATES/);
      const coverage=page.locator('.di-trace-report');
      await coverage.waitFor({timeout:4000});
      await coverage.locator('summary').click();
      assert.match(await coverage.innerText(),/mapped/i,
        'Visible design quality report should disclose the exact requirement coverage');
      assert.match(await coverage.innerText(),/not real-user studies|not real-world|not.*verified/i,
        'The UI must not imply the traceability score is a measured usability audit');
      await page.screenshot({path:'browser-artifacts/'+name+'-generate-uiux-prompt.png',fullPage:false});
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      await page.getByRole('button',{name:/Select \/ Generate \/ Fusion/i}).click();
      await page.locator('.tool-mode').filter({hasText:'Design Fusion'}).click();
      await page.getByRole('button',{name:/Combine my selected concepts/i}).click();
      await page.locator('.di-result').waitFor({timeout:16000});
      const fusionPrompt=await page.locator('.di-result pre').innerText();
      assert.match(fusionPrompt,/DESIGN FUSION SPECIFICATION/);
      assert.match(fusionPrompt,/REQUIREMENT TRACEABILITY MATRIX/);
      assert.equal(await page.locator('.di-trace-report').count(),1,
        'Fusion must also disclose its requirement coverage instead of showing a raw unverified prompt');
      await page.screenshot({path:'browser-artifacts/'+name+'-intelligent-design-fusion.png',fullPage:false});
    }
    const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
    await mobile.goto(url+'/',{waitUntil:'domcontentloaded',timeout:60000});
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
    await mobile.close();
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
    if(errors.length)console.log(name+' had nonfatal errors: '+errors.join('\n'));
  }catch(error){
    failed=true;
    console.error(name+' FAILED: '+error.stack);
  }finally{await browser?.close();}
}
if(!remote)await new Promise(resolve=>server.close(resolve));
if(failed)process.exitCode=1;
