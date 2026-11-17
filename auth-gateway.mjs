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
function setCookie(res,name,value,seconds,prod){
  appendCookie(res,name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+seconds+(prod?'; Secure':''));
}
function redirect(res,target){
  res.writeHead(303,{'Location':target,'Cache-Control':'no-store'});
  res.end();
}
const failure=(reason='unavailable')=>Object.assign(new Error('Google authentication is '+reason+'.'),{status:503});
const randomVerifier=()=>b64url(crypto.randomBytes(48));

export function createAuthGateway({url='',key='',siteUrl='',googleEnabled=false,prod=process.env.NODE_ENV==='production',request=fetch}={}){
  const endpoint=String(url).replace(/\/$/,'');
  const site=String(siteUrl).replace(/\/$/,'');
  const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(endpoint)
    &&(site.startsWith('https://')||(!prod&&site.startsWith('http://')))
    &&typeof key==='string'&&key.length>20;
  const ready=configured&&googleEnabled;
  const accessName=secret('fl_access',prod),refreshName=secret('fl_refresh',prod),verifierName=secret('fl_pkce',prod);
  async function authRequest(path,{method='GET',accessToken,body}={}){
    const response=await request(endpoint+'/auth/v1'+path,{
      method,headers:{apikey:key,'Content-Type':'application/json',...(accessToken?Authorization:'Bearer '+accessToken?{}:{})},
      // @ts-ignore
      body:body===undefined?undefined:JSON.stringify(body),
      signal:AbortSignal.timeout(8000)
    });
    const data=await response.json().catch(()=>({}));
    return {status:response.status,ok:response.ok,data};
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
    const access=decodeURIComponent(cookieValue(req,accessName)||'');
    const refresh=decodeURIComponent(cookieValue(req,refreshName)||'');
    if(!access&&!refresh)return null;
    let user=access?await validate(access):null;
    if(user)return user;
    if(!refresh){clearSession(res);return null;}
    const result=await refreshSession(refresh);
    if(result.status===401||result.status===400||result.status===403){clearSession(res);return null;}
    if(!result.ok)throw failure('temporarily unavailable');
    storeSession(res,result.data);
    user=await validate(result.data.access_token);
    if(!user){clearSession(res);return null;}
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
      return redirect(res,'/studio?auth=connected');
    }catch{return redirect(res,'/login?auth=unavailable');}
  }
  async function logout(req,res){
    const access=decodeURIComponent(cookieValue(req,accessName)||'');
    clearSession(res);
    if(access&&configured){
      try{await requestAuth('/logout',{method:'POST',accessToken:access});}catch{/* local sign-out remains safe */}
    }
  }
  return {ready,configured,start,callback,getUser,logout,accountOwner:user=>'acct:'+user.id};
}
