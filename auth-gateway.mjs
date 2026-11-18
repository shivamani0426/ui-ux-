import crypto from 'node:crypto';

// Server-owned OAuth/PKCE and HttpOnly sessions. No Google or Supabase refresh
// token is ever exposed to page JavaScript, a URL query, or a log.
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const b64url=x=>Buffer.from(x).toString('base64url');
const secret=(name,prod)=>prod?'__Host-'+name:name;
function cookieValue(req,name){
  const pair=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
  return pair?pair.slice(name.length+1):'';
}
function appendCookie(res,cookie){
  const prior=res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie',[...(Array.isArray(prior)?prior:prior?[String(prior)]:[]),cookie]);
}
function setCookie(res,name,value,seconds,prod,{strict=false}={}){
  appendCookie(res,name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; SameSite='+(strict?'Strict':'Lax')+'; Max-Age='+seconds+(prod?'; Secure':''));
}
function redirect(res,target){
  res.writeHead(303,{'Location':target,'Cache-Control':'no-store'});
  res.end();
}
const failure=(reason='unavailable')=>Object.assign(new Error('Google authentication is '+reason+'.'),{status:503});
const randomVerifier=()=>b64url(crypto.randomBytes(48));

export function createAuthGateway({url='',key='',siteUrl='',googleEnabled=false,
  adminKey='',signingSecret='',sessionVerifier=null,
  prod=process.env.NODE_ENV==='production',request=fetch}={}){
  const endpoint=String(url).replace(/\/$/,'');
  const site=String(siteUrl).replace(/\/$/,'');
  const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(endpoint)
    &&(site.startsWith('https://')||(!prod&&site.startsWith('http://')))
    &&typeof key==='string'&&key.length>20;
  const ready=configured&&googleEnabled;
  const accessName=secret('fl_access',prod),refreshName=secret('fl_refresh',prod),verifierName=secret('fl_pkce',prod);
  const recentName=secret('fl_recent_login',prod);
  const secureSigning=typeof signingSecret==='string'&&signingSecret.length>=48;
  // Auth admin key is deliberately server-only and opt-in. There must never
  // be an account-deletion UI if the deployment cannot remove Auth users.
  const deletionAvailable=configured&&secureSigning&&typeof adminKey==='string'
    &&adminKey.length>=32&&adminKey!==key;
  const recentTtlSeconds=600;
  const readCookie=(req,name)=>{
    const raw=cookieValue(req,name);
    try{return raw?decodeURIComponent(raw):'';}catch{return '';}
  };
  const hmac=payload=>crypto.createHmac('sha256',signingSecret).update(payload).digest('base64url');
  function markRecent(res,user){
    if(!secureSigning)return;
    const payload=Buffer.from(JSON.stringify({sub:user.id,at:Date.now()})).toString('base64url');
    setCookie(res,recentName,payload+'.'+hmac(payload),recentTtlSeconds,prod,{strict:true});
  }
  function recentlyVerified(req,user){
    if(!secureSigning||!user||typeof user.id!=='string')return false;
    const cookie=readCookie(req,recentName);
    const pieces=cookie.split('.');
    if(pieces.length!==2||pieces[0].length>256||pieces[1].length!==43)return false;
    const expected=hmac(pieces[0]);
    const got=Buffer.from(pieces[1]);const wanted=Buffer.from(expected);
    if(got.length!==wanted.length||!crypto.timingSafeEqual(got,wanted))return false;
    try{
      const obj=JSON.parse(Buffer.from(pieces[0],'base64url').toString());
      return obj.sub===user.id&&Number.isFinite(obj.at)&&obj.at<=Date.now()
        &&Date.now()-obj.at<=recentTtlSeconds*1000;
    }catch{return false;}
  }
  function getActiveAccess(req,res){
    const set=res.getHeader('Set-Cookie');
    const updated=(Array.isArray(set)?set:set?[String(set)]:[]).findLast(v=>v.startsWith(accessName+'='));
    if(updated){try{return decodeURIComponent(updated.slice(accessName.length+1).split(';')[0]);}catch{return '';}}
    return readCookie(req,accessName);
  }
  async function requestAuth(path,opts={}){
    try{
      const headers={apikey:key,'Content-Type':'application/json'};
      if(opts.accessToken)headers.Authorization='Bearer '+opts.accessToken;
      const response=await request(endpoint+'/auth/v1'+path,{
        method:opts.method||'GET',headers,
        body:opts.body===undefined?undefined:JSON.stringify(opts.body),
        signal:AbortSignal.timeout(8000)
      });
      return {ok:response.ok,status:response.status,data:await response.json().catch(()=>({}))};
    }catch{throw failure('temporarily unavailable');}
  }
  function clearSession(res){
    setCookie(res,accessName,'',0,prod);
    setCookie(res,refreshName,'',0,prod);
    setCookie(res,recentName,'',0,prod,{strict:true});
    setCookie(res,verifierName,'',0,prod);
  }
  function storeSession(res,data){
    if(typeof data.access_token!=='string'||typeof data.refresh_token!=='string'||!data.expires_in)throw failure('incomplete');
    const accessAge=Math.max(60,Math.min(86400,Number(data.expires_in)||3600));
    setCookie(res,accessName,data.access_token,accessAge,prod);
    setCookie(res,refreshName,data.refresh_token,2592000,prod);
  }
  async function validate(accessToken){
    const result=await requestAuth('/user',{accessToken});
    if(result.status===401||result.status===403)return null;
    if(!result.ok)throw failure('temporarily unavailable');
    return uuid.test(String(result.data.id||''))?result.data:null;
  }
  const refreshJobs=new Map();
  async function refreshSession(token){
    let job=refreshJobs.get(token);
    if(!job){
      job=requestAuth('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:token}});
      refreshJobs.set(token,job);
      job.finally(()=>refreshJobs.delete(token)).catch(()=>{});
    }
    return job;
  }
  async function getUser(req,res){
    if(!configured)return null;
    const access=readCookie(req,accessName);
    const refresh=readCookie(req,refreshName);
    if(!access&&!refresh)return null;
    let user=access?await validate(access):null;
    if(user){
      if(sessionVerifier&&!(await sessionVerifier(user,access))){clearSession(res);return null;}
      return user;
    }
    if(!refresh){clearSession(res);return null;}
    const result=await refreshSession(refresh);
    if(result.status===401||result.status===400||result.status===403){clearSession(res);return null;}
    if(!result.ok)throw failure('temporarily unavailable');
    storeSession(res,result.data);
    user=await validate(result.data.access_token);
    if(!user){clearSession(res);return null;}
    if(sessionVerifier&&!(await sessionVerifier(user,result.data.access_token))){
      clearSession(res);return null;
    }
    return user;
  }
  async function start(req,res){
    if(!ready)return redirect(res,'/login?auth=not_configured');
    const verifier=randomVerifier();
    const challenge=b64url(crypto.createHash('sha256').update(verifier).digest());
    setCookie(res,verifierName,verifier,600,prod);
    const dest=new URL(endpoint+'/auth/v1/authorize');
    dest.searchParams.set('provider','google');
    dest.searchParams.set('redirect_to',site+'/auth/callback');
    dest.searchParams.set('code_challenge',challenge);
    dest.searchParams.set('code_challenge_method','s256');
    return redirect(res,dest.toString());
  }
  async function callback(req,res,onSuccess){
    const target=new URL(req.url,site);
    const verifier=decodeURIComponent(cookieValue(req,verifierName)||'');
    setCookie(res,verifierName,'',0,prod);
    if(!ready||!verifier||verifier.length<43||verifier.length>128||!target.searchParams.get('code'))
      return redirect(res,'/login?auth=cancelled');
    const code=target.searchParams.get('code');
    if(code.length>2048)return redirect(res,'/login?auth=invalid');
    try{
      const token=await requestAuth('/token?grant_type=pkce',{method:'POST',body:{auth_code:code,code_verifier:verifier}});
      if(!token.ok)return redirect(res,'/login?auth=exchange_failed');
      const user=await validate(token.data.access_token);
      if(!user)return redirect(res,'/login?auth=invalid');
      storeSession(res,token.data);
      try{await onSuccess(user);}
      catch{return redirect(res,'/login?auth=sync_failed');}
      markRecent(res,user);
      return redirect(res,'/studio?auth=connected');
    }catch{return redirect(res,'/login?auth=unavailable');}
  }
  async function logout(req,res,{scope='local'}={}){
    if(!['local','global','others'].includes(scope))
      throw Object.assign(new Error('Invalid sign-out scope.'),{status:400});
    const access=getActiveAccess(req,res);
    if(access&&configured){
      const response=await requestAuth('/logout?scope='+scope,{method:'POST',accessToken:access});
      // Supabase may have already revoked a session. Avoid claiming all-device
      // sign-out succeeded when its API is actually unavailable.
      if(!response.ok&&response.status!==401&&response.status!==403)
        throw failure('temporarily unavailable');
    }else if(scope!=='local'){
      throw Object.assign(new Error('Sign in before changing sessions on other devices.'),{status:401});
    }
    if(scope!=='others')clearSession(res);
    return {scope,success:true};
  }
  // Read-only Admin preflight prevents deleting workspace data due to an
  // incorrect or missing server-side administrator credential.
  async function verifyDeleteAbility(user){
    if(!deletionAvailable)
      throw Object.assign(new Error('Permanent account deletion is not configured.'),{status:503});
    if(!user||!uuid.test(user.id))
      throw Object.assign(new Error('A verified Google account is required.'),{status:401});
    let response;
    try{
      response=await request(endpoint+'/auth/v1/admin/users/'+user.id,{
        method:'GET',
        headers:{apikey:adminKey,Authorization:'Bearer '+adminKey},
        signal:AbortSignal.timeout(10000)
      });
    }catch{throw failure('temporarily unavailable');}
    if(!response.ok)
      throw Object.assign(new Error('Unable to verify deletion permissions. No data was changed.'),{status:503});
    let resolved;
    try{resolved=await response.json();}catch{throw failure('temporarily unavailable');}
    if(resolved.id!==user.id&&resolved.user?.id!==user.id)
      throw Object.assign(new Error('The verified Google account did not match the deletion target.'),{status:403});
    return true;
  }
  async function deleteAuthUser(user){
    if(!deletionAvailable)throw Object.assign(new Error('Permanent account deletion is not configured.'),{status:503});
    if(!user||!uuid.test(user.id))throw Object.assign(new Error('A verified Google account is required.'),{status:401});
    let response;
    try{
      response=await request(endpoint+'/auth/v1/admin/users/'+user.id,{
        method:'DELETE',
        headers:{apikey:adminKey,Authorization:'Bearer '+adminKey},
        signal:AbortSignal.timeout(12000)
      });
    }catch{throw failure('temporarily unavailable');}
    if(!response.ok&&response.status!==404)
      throw Object.assign(new Error('Unable to remove the Google authentication identity. Please retry.'),{status:503});
    return {deleted:true};
  }
  return {ready,configured,deletionAvailable,start,callback,getUser,logout,
    recentlyVerified,verifyDeleteAbility,deleteAuthUser,clearLocalSession:clearSession,
    accountOwner:user=>'acct:'+user.id};
}
