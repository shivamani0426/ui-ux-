import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createAuthGateway} from '../auth-gateway.mjs';

const UID='11111111-1111-4111-8111-111111111111';
const response=(status,data)=>({status,ok:status>=200&&status<300,json:async()=>data});
const res=()=>({
  headers:{},status:0,location:'',getHeader(n){return this.headers[n];},
  setHeader(n,v){this.headers[n]=v;},
  writeHead(code,h){this.status=code;this.location=h?.Location||'';},
  end(){}
});
const cookies=r=>(r.getHeader('Set-Cookie')||[]).map(s=>s.split(';')[0]).join('; ');
const gateway=(request,googleEnabled=true)=>createAuthGateway({
  url:'https://example.supabase.co',key:'sb_publishable_test_browser_frontline_12345678',
  siteUrl:'https://ui-compass-studio.onrender.com',googleEnabled,prod:true,request
});

test('Google flow is PKCE S256, HttpOnly, secure, callback-bound and private',async()=>{
  const requests=[];
  const auth=gateway(async(url,options)=>{
    requests.push({url,options});
    if(url.includes('/token?grant_type=pkce')){
      assert.equal(options.method,'POST');
      assert.ok(options.body.includes('code_verifier'));
      return response(200,{access_token:'test-access',refresh_token:'test-refresh',expires_in:3600});
    }
    if(url.endsWith('/user'))return response(200,{id:UID,email:'user@example.test',
      user_metadata:{full_name:'Designer',role:'admin'}});
    if(url.endsWith('/logout'))return response(204,{});
    throw Error('Unexpected auth request '+url);
  });
  const first=res();
  await auth.start({headers:{cookie:''}},first);
  assert.equal(first.status,303);
  const target=new URL(first.location);
  assert.equal(target.hostname,'example.supabase.co');
  assert.equal(target.pathname,'/auth/v1/authorize');
  assert.equal(target.searchParams.get('provider'),'google');
  assert.equal(target.searchParams.get('redirect_to'),'https://ui-compass-studio.onrender.com/auth/callback');
  assert.equal(target.searchParams.get('code_challenge_method'),'s256');
  assert.ok(target.searchParams.get('code_challenge').length>40);
  const set=first.getHeader('Set-Cookie');
  assert.equal(set.length,1);
  assert.match(set[0],/HttpOnly; SameSite=Lax; Max-Age=600; Secure/);
  const raw=set[0].split(';')[0].split('=')[1];
  const verifier=decodeURIComponent(raw);
  assert.equal(target.searchParams.get('code_challenge'),
    crypto.createHash('sha256').update(verifier).digest('base64url'));
  let migrated=null;
  const final=res();
  await auth.callback({url:'/auth/callback?code=from-supabase',headers:{cookie:cookies(first)}},final,
    async user=>{migrated=user.id;});
  assert.equal(migrated,UID);
  assert.equal(final.status,303);
  assert.equal(final.location,'/studio?auth=connected');
  assert.equal(final.getHeader('Set-Cookie').length,3);
  const session=cookies(final);
  assert.match(session,/__Host-fl_access=test-access/);
  assert.match(session,/__Host-fl_refresh=test-refresh/);
  const current=await auth.getUser({headers:{cookie:session}},res());
  assert.equal(current.id,UID);
  assert.equal(auth.accountOwner(current),'acct:'+UID);
  assert.ok(!requests.some(x=>x.url.includes('www.googleapis.com')),
    'Google credentials and identity must go through Supabase, not the app');
  const signedOut=res();
  await auth.logout({headers:{cookie:session}},signedOut);
  assert.ok(signedOut.getHeader('Set-Cookie').some(x=>x.startsWith('__Host-fl_access=')&&x.includes('Max-Age=0')));
});

test('An unfinished or unconfigured login never creates an authenticated identity',async()=>{
  const auth=gateway(async()=>{throw Error('Disabled flow sent a network request');},false);
  const result=res();
  await auth.start({headers:{cookie:''}},result);
  assert.equal(result.location,'/login?auth=not_configured');
  assert.equal(await auth.getUser({headers:{cookie:''}},res()),null);
  const callback=res();
  await auth.callback({url:'/auth/callback?code=forged',headers:{cookie:''}},callback,async()=>{throw Error('Not called');});
  assert.equal(callback.location,'/login?auth=cancelled');
});

test('A failed guest transfer cannot silently claim success or delete existing guest data',async()=>{
  const auth=gateway(async(url)=>{
    if(url.includes('/token?'))return response(200,{access_token:'new-token',refresh_token:'refresh-token',expires_in:3600});
    return response(200,{id:UID});
  });
  const first=res();await auth.start({headers:{cookie:''}},first);
  const result=res();
  await auth.callback({url:'/auth/callback?code=valid',headers:{cookie:cookies(first)}},result,async()=>{throw Error('DB unavailable');});
  assert.equal(result.location,'/login?auth=sync_failed');
  assert.ok(result.getHeader('Set-Cookie').some(x=>x.startsWith('__Host-fl_access=new-token')));
});
