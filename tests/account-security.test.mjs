import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createAuthGateway} from '../auth-gateway.mjs';

const ID='11111111-1111-4111-8111-111111111111';
const pub='sb_publishable_frontline_test_key_1234567890';
const admin='sb_secret_frontline_server_only_key_1234567890';
const signing='frontline-production-test-signing-material-64-chars-not-a-real-secret-abcdefgh';
const ok=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
const response=()=>({
  headers:{},status:0,location:'',
  getHeader(name){return this.headers[name];},
  setHeader(name,value){this.headers[name]=value;},
  writeHead(status,headers){this.status=status;this.location=headers?.Location||'';},
  end(){}
});
const cookies=r=>(r.getHeader('Set-Cookie')||[]).map(value=>value.split(';')[0]).join('; ');
const create=(request,options={})=>createAuthGateway({
  url:'https://example.supabase.co',key:pub,siteUrl:'https://ui-compass-studio.onrender.com',
  googleEnabled:true,prod:true,request,...options
});

test('10D sign-out scopes only revoke what the user requested',async()=>{
  const hits=[];
  const auth=create(async(url,options)=>{
    hits.push({url,auth:options.headers?.Authorization});
    if(url.includes('/logout'))return ok(204,{});
    if(url.endsWith('/user'))return ok(200,{id:ID,email:'designer@example.test'});
    throw Error('Unexpected URL '+url);
  });
  const req={headers:{cookie:'__Host-fl_access=test-access; __Host-fl_refresh=test-refresh'}};
  const local=response();
  assert.deepEqual(await auth.logout(req,local),{scope:'local',success:true});
  assert.ok(hits.some(x=>x.url.endsWith('/auth/v1/logout?scope=local')));
  assert.equal(local.getHeader('Set-Cookie').some(x=>x.startsWith('__Host-fl_access=')&&x.includes('Max-Age=0')),true);
  const others=response();
  assert.deepEqual(await auth.logout(req,others,{scope:'others'}),{scope:'others',success:true});
  assert.ok(hits.some(x=>x.url.endsWith('/auth/v1/logout?scope=others')));
  assert.equal(others.getHeader('Set-Cookie'),undefined,'Other-device sign-out must retain this device cookies');
  const global=response();
  await auth.logout(req,global,{scope:'global'});
  assert.ok(hits.some(x=>x.url.endsWith('/auth/v1/logout?scope=global')));
  assert.ok(global.getHeader('Set-Cookie').some(x=>x.startsWith('__Host-fl_refresh=')&&x.includes('Max-Age=0')));
  await assert.rejects(()=>auth.logout(req,response(),{scope:'bogus'}),/Invalid sign-out scope/);
});

test('10D failed provider revocation does not claim that other sessions ended',async()=>{
  const auth=create(async()=>ok(502,{error:'temporarily unavailable'}));
  const res=response();
  await assert.rejects(()=>auth.logout({headers:{cookie:'__Host-fl_access=valid'}},res,{scope:'global'}),
    /temporarily unavailable/);
  assert.equal(res.getHeader('Set-Cookie'),undefined,'Do not erase local cookies after unsuccessful global sign-out');
});

test('10D permanent account deletion stays gated without server-side privileges',async()=>{
  const auth=create(async()=>{throw Error('Admin should never be contacted');},{signingSecret:signing});
  assert.equal(auth.deletionAvailable,false);
  await assert.rejects(()=>auth.verifyDeleteAbility({id:ID}),/not configured/);
  await assert.rejects(()=>auth.deleteAuthUser({id:ID}),/not configured/);
});

test('10D recently verified Google identity is HMAC-signed, short-lived and subject-bound',async()=>{
  const hits=[];
  const auth=create(async(url,options)=>{
    hits.push({url,options});
    if(url.includes('/token?'))return ok(200,{access_token:'fresh-access',refresh_token:'fresh-refresh',expires_in:3600});
    if(url.endsWith('/user'))return ok(200,{id:ID,email:'designer@example.test'});
    if(url.includes('/admin/users/')){
      if(options.method==='GET')return ok(200,{id:ID});
      if(options.method==='DELETE')return ok(204,{});
    }
    throw Error('Unexpected '+url);
  },{adminKey:admin,signingSecret:signing});
  const reverify=response();
  await auth.start({url:'/auth/google/start?reauth=1',headers:{cookie:''}},reverify);
  assert.equal(new URL(reverify.location).searchParams.get('prompt'),'select_account',
    'Sensitive actions must ask Google to select the identity again');
  const start=response();await auth.start({url:'/auth/google/start',headers:{cookie:''}},start);
  assert.equal(new URL(start.location).searchParams.get('prompt'),null,
    'Normal login should preserve the existing frictionless Google experience');
  const callback=response();
  await auth.callback({url:'/auth/callback?code=valid',headers:{cookie:cookies(start)}},callback,async()=>{});
  assert.equal(callback.location,'/studio?auth=connected');
  assert.equal(auth.deletionAvailable,true);
  const cookie=cookies(callback);
  assert.match(cookie,/__Host-fl_recent_login=/);
  assert.ok(callback.getHeader('Set-Cookie').some(x=>x.includes('SameSite=Strict')&&x.includes('Max-Age=600')));
  const user={id:ID,email:'designer@example.test'};
  assert.equal(auth.recentlyVerified({headers:{cookie}},user),true);
  assert.equal(auth.recentlyVerified({headers:{cookie}}, {id:'22222222-2222-4222-8222-222222222222'}),false);
  const match=cookie.match(/__Host-fl_recent_login=([^;]+)/)[1];
  const [payload,mac]=decodeURIComponent(match).split('.');
  const data=JSON.parse(Buffer.from(payload,'base64url'));
  data.at-=11*60*1000;
  const tampered=Buffer.from(JSON.stringify(data)).toString('base64url')+'.'+mac;
  assert.equal(auth.recentlyVerified({headers:{cookie:'__Host-fl_recent_login='+tampered}},user),false);
  assert.equal(auth.recentlyVerified({headers:{cookie:'__Host-fl_recent_login='+'x'.repeat(600)}},user),false);
  assert.equal(await auth.verifyDeleteAbility(user),true);
  assert.deepEqual(await auth.deleteAuthUser(user),{deleted:true});
  assert.ok(hits.some(x=>x.url.endsWith('/auth/v1/admin/users/'+ID)&&x.options.method==='DELETE'));
  assert.ok(!JSON.stringify(hits).includes('another-account-secret'));
});

test('10D account deletion must not erase workspace if Admin preflight returns another identity',async()=>{
  const auth=create(async()=>ok(200,{id:'22222222-2222-4222-8222-222222222222'}),
    {adminKey:admin,signingSecret:signing});
  await assert.rejects(()=>auth.verifyDeleteAbility({id:ID}),/did not match/);
});

test('10D optional strict session validation refuses a verified but revoked token',async()=>{
  let calls=0;
  const auth=create(async url=>{
    if(url.endsWith('/user'))return ok(200,{id:ID});
    throw Error('Unexpected');
  },{sessionVerifier:async(user,token)=>{calls++;assert.equal(user.id,ID);assert.equal(token,'revoked-jwt');return false;}});
  const res=response();
  const user=await auth.getUser({headers:{cookie:'__Host-fl_access=revoked-jwt'}},res);
  assert.equal(user,null);
  assert.equal(calls,1);
  assert.ok(res.getHeader('Set-Cookie').some(x=>x.startsWith('__Host-fl_access=')&&x.includes('Max-Age=0')));
});
