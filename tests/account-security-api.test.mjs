import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';

test('10D security routes fail closed for guests and cross-site mutations',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const status=await fetch(base+'/api/auth/security');
    assert.equal(status.status,200);
    assert.deepEqual(await status.json(),{
      authenticated:false,accountDeletionAvailable:false,recentGoogleVerification:false,
      strictSessionValidation:process.env.FRONTLINE_STRICT_SESSION_CHECK==='true'
    });
    const cookie=status.headers.get('set-cookie')?.split(';')[0]||'';
    const req=(method,path,body,origin)=>fetch(base+path,{
      method,headers:{Cookie:cookie,'Content-Type':'application/json',...(origin?{Origin:origin}:{})},
      body:JSON.stringify(body)
    });
    const blockedOther=await req('POST','/api/auth/logout',{scope:'others'});
    assert.equal(blockedOther.status,401,'Guests cannot revoke account sessions');
    const blockedGlobal=await req('POST','/api/auth/logout',{scope:'global',confirmation:'SIGN OUT EVERYWHERE'});
    assert.equal(blockedGlobal.status,401,'Guests cannot sign out nonexistent Google accounts');
    const blockedDelete=await req('DELETE','/api/auth/account',{
      email:'victim@example.test',confirmation:'DELETE FRONTLINE ACCOUNT'
    });
    assert.equal(blockedDelete.status,401,'Guests cannot delete Google Auth users');
    const noScope=await req('POST','/api/auth/logout',{scope:'abusive'});
    assert.equal(noScope.status,400);
    const crossSite=await fetch(base+'/api/auth/account',{method:'DELETE',
      headers:{Cookie:cookie,'Content-Type':'application/json',Origin:'https://attacker.invalid'},
      body:JSON.stringify({email:'victim@example.test',confirmation:'DELETE FRONTLINE ACCOUNT'})});
    assert.equal(crossSite.status,403,'Never allow cross-origin destructive requests');
    const guest=await fetch(base+'/api/workspace/overview',{headers:{Cookie:cookie}});
    assert.equal(guest.status,200,'Guest studio remains working after denied operations');
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
});
