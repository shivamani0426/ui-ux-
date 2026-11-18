import test from 'node:test';
import assert from 'node:assert/strict';

test('Verified OAuth account claims guest data, retains it on refresh, and isolates other guests',async()=>{
  const originalFetch=globalThis.fetch;
  const prior={
    FRONTLINE_SUPABASE_URL:process.env.FRONTLINE_SUPABASE_URL,
    FRONTLINE_SUPABASE_PUBLISHABLE_KEY:process.env.FRONTLINE_SUPABASE_PUBLISHABLE_KEY,
    FRONTLINE_SITE_URL:process.env.FRONTLINE_SITE_URL,
    FRONTLINE_GOOGLE_LOGIN_ENABLED:process.env.FRONTLINE_GOOGLE_LOGIN_ENABLED,
    RENDER_SERVICE_ID:process.env.RENDER_SERVICE_ID,
    FRONTLINE_SUPABASE_ADMIN_KEY:process.env.FRONTLINE_SUPABASE_ADMIN_KEY,
    FRONTLINE_ACTION_SIGNING_SECRET:process.env.FRONTLINE_ACTION_SIGNING_SECRET,
    FRONTLINE_STRICT_SESSION_CHECK:process.env.FRONTLINE_STRICT_SESSION_CHECK
  };
  process.env.FRONTLINE_SUPABASE_URL='https://example.supabase.co';
  process.env.FRONTLINE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_test_frontline_signin_123456';
  process.env.FRONTLINE_SITE_URL='http://127.0.0.1:3000';
  process.env.FRONTLINE_GOOGLE_LOGIN_ENABLED='true';
  // This mock server uses local HTTP; do not let Render's production-host flag
  // activate Secure-only cookies inside an isolated Node integration test.
  process.env.RENDER_SERVICE_ID='';
  process.env.FRONTLINE_SUPABASE_ADMIN_KEY='';
  process.env.FRONTLINE_ACTION_SIGNING_SECRET='frontline-test-auth-mac-value-of-at-least-sixty-four-characters-abcdefghijklmnop';
  process.env.FRONTLINE_STRICT_SESSION_CHECK='false';
  const account='11111111-1111-4111-8111-111111111111';
  const calls=[];
  globalThis.fetch=async(url,options={})=>{
    if(String(url).startsWith('https://example.supabase.co/auth/v1/')){
      calls.push({url:String(url),method:options.method||'GET'});
      if(String(url).includes('/token?grant_type=pkce'))
        return new Response(JSON.stringify({access_token:'valid-account-access',refresh_token:'valid-account-refresh',expires_in:3600}),{status:200});
      if(String(url).endsWith('/user')){
        assert.equal(options.headers.Authorization,'Bearer valid-account-access');
        return new Response(JSON.stringify({id:account,email:'designer@example.test',user_metadata:{full_name:'Test designer'}}),{status:200});
      }
      if(String(url).includes('/logout?scope='))return new Response('',{status:200});
      throw Error('Unexpected token request');
    }
    return originalFetch(url,options);
  };
  const {server}=await import('../server.mjs?oauth-account-integration');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const call=(path,opts={})=>originalFetch(base+path,{redirect:'manual',...opts});
  const setCookie=r=>r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
  try{
    const status=await call('/api/auth/status');
    assert.equal((await status.json()).googleEnabled,true);
    const guest=await call('/api/auth/me');
    const guestCookie=setCookie(guest);
    assert.match(guestCookie,/uic_guest=[a-f0-9-]{36}/);
    const create=await call('/api/projects',{method:'POST',headers:{
      'Content-Type':'application/json',Cookie:guestCookie
    },body:JSON.stringify({brief:'Plan a healthcare dashboard with patient records, caregiver navigation and accessible typography.'})});
    assert.equal(create.status,201);
    const project=(await create.json()).project;
    const start=await call('/auth/google/start',{headers:{Cookie:guestCookie}});
    assert.equal(start.status,303);
    assert.match(start.headers.get('location'),/auth\/v1\/authorize/);
    const pkceCookie=setCookie(start);
    assert.match(pkceCookie,/fl_pkce=/);
    const completed=await call('/auth/callback?code=testing-code',{headers:{
      Cookie:guestCookie+'; '+pkceCookie
    }});
    assert.equal(completed.status,303);
    assert.equal(completed.headers.get('location'),'/studio?auth=connected');
    const accountCookies=setCookie(completed);
    const allCookies=guestCookie+'; '+accountCookies;
    const me=await call('/api/auth/me',{headers:{Cookie:allCookies}});
    const signed=await me.json();
    assert.equal(signed.authenticated,true);
    assert.equal(signed.user.id,account);
    const security=await call('/api/auth/security',{headers:{Cookie:allCookies}});
    const securityData=await security.json();
    assert.equal(securityData.authenticated,true);
    assert.equal(securityData.recentGoogleVerification,true,
      'Only the recently completed real OAuth callback may enable sensitive operations');
    assert.equal(securityData.accountDeletionAvailable,false,
      'Mock server has no administrator credentials: deletion must fail closed');
    const protectedDelete=await call('/api/auth/account',{method:'DELETE',headers:{
      Cookie:allCookies,'Content-Type':'application/json'
    },body:JSON.stringify({email:'designer@example.test',confirmation:'DELETE FRONTLINE ACCOUNT'})});
    assert.equal(protectedDelete.status,503,
      'Unavailable Admin credentials must not delete real account data');
    const noConfirmation=await call('/api/auth/logout',{method:'POST',headers:{
      Cookie:allCookies,'Content-Type':'application/json'
    },body:JSON.stringify({scope:'global'})});
    assert.equal(noConfirmation.status,400,'All-device logout requires a deliberate confirmation phrase');
    const others=await call('/api/auth/logout',{method:'POST',headers:{
      Cookie:allCookies,'Content-Type':'application/json'
    },body:JSON.stringify({scope:'others'})});
    assert.equal(others.status,200);
    assert.equal((await others.json()).scope,'others');
    const consent=await call('/api/profile',{method:'PUT',headers:{
      Cookie:allCookies,'Content-Type':'application/json'
    },body:JSON.stringify({globalOptIn:true})});
    assert.equal(consent.status,200,'Verified Google account may opt in voluntarily');
    assert.equal((await consent.json()).globalOptIn,true);
    const optInVote=await call('/api/feedback',{method:'POST',headers:{
      Cookie:allCookies,'Content-Type':'application/json'
    },body:JSON.stringify({projectId:project.id,styles:['minimal'],reaction:'like'})});
    assert.equal(optInVote.status,200);
    const cohort=await call('/api/insights',{headers:{Cookie:allCookies}});
    assert.deepEqual((await cohort.json()).publicPatterns,[],
      'One authenticated account cannot meet ten-account aggregate privacy threshold');
    const revoked=await call('/api/profile',{method:'PUT',headers:{
      Cookie:allCookies,'Content-Type':'application/json'
    },body:JSON.stringify({globalOptIn:false})});
    assert.equal(revoked.status,200);
    assert.equal((await revoked.json()).globalOptIn,false);
    const exportAfterRevocation=await call('/api/workspace/export',{headers:{Cookie:allCookies}});
    assert.equal((await exportAfterRevocation.json()).feedback.every(x=>x.optIn===false),true,
      'Opt-out must revoke previously eligible feedback, not just future choices');
    const listed=await call('/api/projects',{headers:{Cookie:allCookies}});
    assert.ok((await listed.json()).projects.some(p=>p.id===project.id));
    // A second device has a different guest cookie but the same verified
    // account token, so its project history must resolve to the same owner.
    const secondDevice=await call('/api/projects',{headers:{Cookie:accountCookies}});
    assert.ok((await secondDevice.json()).projects.some(p=>p.id===project.id),
      'Verified account history must be accessible across guest cookies/devices');
    const elsewhere=await call('/api/projects/'+project.id);
    assert.equal(elsewhere.status,404,'A different guest must not read migrated projects');
    const logout=await call('/api/auth/logout',{method:'POST',headers:{
      Cookie:allCookies,'Content-Type':'application/json'
    },body:'{}'});
    assert.equal(logout.status,200);
    const guestAfter=await call('/api/projects',{headers:{Cookie:guestCookie}});
    assert.equal((await guestAfter.json()).projects.length,0,'Migrated project no longer belongs to the old guest');
    assert.ok(calls.some(c=>c.url.endsWith('/user')),'The server must validate the actual account with Supabase');
    assert.ok(calls.some(c=>c.url.includes('/logout?scope=others')),
      'Other-device revocation must explicitly use the others scope');
    assert.ok(calls.some(c=>c.url.includes('/logout?scope=local')),
      'Normal signout must use local scope and spare the other devices');
  }finally{
    await new Promise(resolve=>server.close(resolve));
    globalThis.fetch=originalFetch;
    for(const [name,value] of Object.entries(prior)){
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  }
});
