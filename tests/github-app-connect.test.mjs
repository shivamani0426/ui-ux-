import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createGitHubAppConnection} from '../github-app-connect.mjs';
const key=crypto.randomBytes(32).toString('base64url');
const owner='acct:00000000-0000-4000-8000-000000000001';
const other='acct:00000000-0000-4000-8000-000000000002';
const connections=new Map(),calls=[];
let clock=1700000000000;
const db={async query(q,p){
  if(q.startsWith('INSERT INTO')){connections.set(p[0],{github_login:p[2],encrypted_credentials:p[3]});return {rowCount:1,rows:[]};}
  if(q.startsWith('UPDATE frontline')){const v=connections.get(p[1]);if(!v||v.encrypted_credentials!==p[2])return {rowCount:0,rows:[]};v.encrypted_credentials=p[0];return {rowCount:1,rows:[]};}
  if(q.startsWith('DELETE FROM')){connections.delete(p[0]);return {rowCount:1,rows:[]};}
  const row=connections.get(p[0]);return {rows:row?[row]:[],rowCount:row?1:0};
}};
const transport=async(url,options)=>{
  calls.push({url,options});
  if(url==='https://github.com/login/oauth/access_token'){
    const body=new URLSearchParams(options.body),rotated=body.get('grant_type')==='refresh_token';
    assert.equal(body.get('client_id'),'Iv1.example');
    assert.equal(body.get('client_secret'),'example-secret-long-enough');
    if(!rotated)assert.ok(body.get('code_verifier')?.length>=43);
    return new Response(JSON.stringify({
      access_token:rotated?'ghu_rotated_0123456789012345':'ghu_fake_012345678901234567890',
      refresh_token:rotated?'ghr_rotated_0123456789012345':'ghr_fake_012345678901234567890',
      expires_in:7200,refresh_token_expires_in:500000
    }),{status:200});
  }
  if(url==='https://api.github.com/user')
    return new Response(JSON.stringify({id:123,login:'approved-owner'}),{status:200});
  throw Error('Unknown remote destination');
};
const adapter=createGitHubAppConnection({clientId:'Iv1.example',clientSecret:'example-secret-long-enough',
  encryptionKey:key,stateSecret:'S'.repeat(64),siteUrl:'https://frontline.example',
  db,transport,now:()=>clock});
function res(){return {headers:{},getHeader(k){return this.headers[k]},
  setHeader(k,v){this.headers[k]=v},
  writeHead(code,h){this.code=code;Object.assign(this.headers,h)},end(){this.ended=true}}}
test('14D: GitHub OAuth uses PKCE, owner-bound state and encrypted tokens',async()=>{
  connections.clear();calls.length=0;
  assert.equal(adapter.ready,true);
  const started=res();await adapter.start({headers:{}},started,owner);
  const url=new URL(started.headers.Location);
  assert.equal(url.origin,'https://github.com');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  const cookie=started.headers['Set-Cookie'][0].split(';')[0];
  assert.match(started.headers['Set-Cookie'][0],/HttpOnly; SameSite=Lax/);
  const callback='/auth/github/callback?code=good&state='+url.searchParams.get('state');
  const denied=res();await adapter.callback({headers:{cookie},url:callback},denied,other);
  assert.equal(denied.headers.Location,'/studio?github=invalid_state');
  assert.equal(connections.size,0);
  const accepted=res();await adapter.callback({headers:{cookie},url:callback},accepted,owner);
  assert.equal(accepted.headers.Location,'/studio?github=connected');
  assert.ok(!connections.get(owner).encrypted_credentials.includes('ghu_fake'));
  assert.ok(!connections.get(owner).encrypted_credentials.includes('ghr_fake'));
  assert.deepEqual(await adapter.status(owner),{available:true,connected:true,login:'approved-owner'});
  assert.equal(await adapter.getToken(owner),'ghu_fake_012345678901234567890');
  assert.equal(calls.length,2);
});
test('14D: refresh, isolation, disconnect and failure mode',async()=>{
  clock+=7200*1000-85000;
  assert.equal(await adapter.getToken(owner),'ghu_rotated_0123456789012345');
  assert.equal(await adapter.getToken(owner),'ghu_rotated_0123456789012345');
  await assert.rejects(adapter.getToken(other),e=>e.status===401);
  assert.equal((await adapter.disconnect(owner)).connected,false);
  assert.equal((await adapter.status(owner)).connected,false);
  await assert.rejects(adapter.getToken(owner),e=>e.status===401);
  const disabled=createGitHubAppConnection({db});
  assert.deepEqual(await disabled.status(owner),{available:false,connected:false});
  await assert.rejects(disabled.start({headers:{}},res(),owner),e=>e.status===503);
  await assert.rejects(adapter.start({headers:{}},res(),'guest'),e=>e.status===401);
  const failed=res();await adapter.callback({headers:{cookie:''},url:'/auth/github/callback?state=wrong&code=x'},failed,owner);
  assert.equal(failed.headers.Location,'/studio?github=invalid_state');
});
