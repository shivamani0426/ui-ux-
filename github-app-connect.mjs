import crypto from 'node:crypto';

// GitHub App OAuth: no token is ever returned to browser JavaScript.
const bad=(message,status=400)=>Object.assign(new Error(message),{status});
const enc=x=>Buffer.from(x).toString('base64url');
const ownerId=/^acct:[0-9a-f-]{36}$/i;
const validTime=x=>Number.isInteger(x)&&x>0&&x<=31536000;

export function createGitHubAppConnection({clientId='',clientSecret='',encryptionKey='',
  stateSecret='',siteUrl='',db=null,prod=true,transport=fetch,now=()=>Date.now()}={}){
  const key=Buffer.from(encryptionKey,'base64url');
  const origin=/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(siteUrl)?siteUrl.replace(/\/$/,''):'';
  const ready=Boolean(db?.query&&/^[a-zA-Z0-9._-]{8,100}$/.test(clientId)&&
    clientSecret.length>=20&&key.length===32&&stateSecret.length>=48&&origin);
  const pendingName=prod?'__Host-fl_gh_pending':'fl_gh_pending';
  const sign=x=>crypto.createHmac('sha256',stateSecret).update(x).digest('base64url');
  function cookie(res,value,age){
    const content=pendingName+'='+encodeURIComponent(value)+
      '; Path=/; HttpOnly; SameSite=Lax; Max-Age='+age+(prod?'; Secure':'');
    const prev=res.getHeader('Set-Cookie');
    res.setHeader('Set-Cookie',[...(Array.isArray(prev)?prev:prev?[prev]:[]),content]);
  }
  function pending(req){
    const part=String(req.headers.cookie||'').split(';').map(x=>x.trim())
      .find(x=>x.startsWith(pendingName+'='));
    if(!part)return '';
    try{return decodeURIComponent(part.slice(pendingName.length+1));}catch{return '';}
  }
  function redirect(res,url){
    res.writeHead(303,{Location:url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    res.end();
  }
  function check(){if(!ready)throw bad('GitHub App connection requires configured OAuth and encrypted private storage.',503);}
  async function upstream(url,options,stage){
    let response;
    try{response=await transport(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});}
    catch{throw bad('GitHub '+stage+' is unavailable. Retry safely.',503);}
    if(!response.ok)throw bad('GitHub '+stage+' was rejected. Please reconnect or retry.',
      response.status===401||response.status===403?401:503);
    try{return await response.json();}catch{throw bad('GitHub returned an invalid response.',502);}
  }
  async function exchange(fields){
    const data=await upstream('https://github.com/login/oauth/access_token',{
      method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,...fields}).toString()
    },'authorization');
    if(data.error)throw bad('GitHub authorization was denied.',401);
    if(typeof data.access_token!=='string'||data.access_token.length<20||
      typeof data.refresh_token!=='string'||data.refresh_token.length<20||
      !validTime(data.expires_in)||!validTime(data.refresh_token_expires_in))
      throw bad('Enable expiring user tokens and refresh support on your GitHub App.',503);
    return {accessToken:data.access_token,refreshToken:data.refresh_token,
      expiresAt:now()+data.expires_in*1000,refreshExpiresAt:now()+data.refresh_token_expires_in*1000};
  }
  function encrypt(owner,value){
    const iv=crypto.randomBytes(12);
    const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
    cipher.setAAD(Buffer.from(owner));
    const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);
    return ['v1',enc(iv),enc(cipher.getAuthTag()),enc(data)].join('.');
  }
  function decrypt(owner,value){
    try{
      const [version,iv,tag,data,...rest]=String(value).split('.');
      if(version!=='v1'||rest.length)throw Error('invalid');
      const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));
      decipher.setAAD(Buffer.from(owner));decipher.setAuthTag(Buffer.from(tag,'base64url'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,'base64url')),
        decipher.final()]).toString());
    }catch{throw bad('Encrypted GitHub authorization cannot be opened. Reconnect GitHub.',503);}
  }
  async function start(req,res,owner){
    check();if(!ownerId.test(owner))throw bad('Sign in with Google first.',401);
    const nonce=enc(crypto.randomBytes(24)),verifier=enc(crypto.randomBytes(48));
    cookie(res,[nonce,verifier,sign(owner+'|'+nonce+'|'+verifier)].join('.'),600);
    const url=new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id',clientId);
    url.searchParams.set('redirect_uri',origin+'/auth/github/callback');
    url.searchParams.set('state',nonce);
    url.searchParams.set('code_challenge',enc(crypto.createHash('sha256').update(verifier).digest()));
    url.searchParams.set('code_challenge_method','S256');
    return redirect(res,url.toString());
  }
  async function callback(req,res,owner){
    const saved=pending(req);cookie(res,'',0);
    if(!ready||!ownerId.test(owner))return redirect(res,'/login?github=login_required');
    const target=new URL(req.url,origin);
    const [nonce,verifier,signature]=saved.split('.');
    const expected=nonce&&verifier?sign(owner+'|'+nonce+'|'+verifier):'';
    const a=Buffer.from(signature||''),b=Buffer.from(expected);
    if(!nonce||nonce.length!==32||verifier?.length<43||!signature||
      a.length!==b.length||!crypto.timingSafeEqual(a,b)||target.searchParams.get('state')!==nonce)
      return redirect(res,'/studio?github=invalid_state');
    const code=target.searchParams.get('code');
    if(!code||code.length>2048||target.searchParams.has('error'))
      return redirect(res,'/studio?github=cancelled');
    try{
      const credentials=await exchange({code,redirect_uri:origin+'/auth/github/callback',
        code_verifier:verifier});
      const who=await upstream('https://api.github.com/user',{
        method:'GET',headers:{Accept:'application/vnd.github+json',
          Authorization:'Bearer '+credentials.accessToken,
          'X-GitHub-Api-Version':'2022-11-28'}},'identity verification');
      if(!Number.isSafeInteger(who.id)||!(/^\w[\w-]{0,38}$/).test(who.login||''))
        throw bad('GitHub returned an invalid verified account.',502);
      await db.query('INSERT INTO frontline.github_app_connections '+
        '(account_owner,github_user_id,github_login,encrypted_credentials) VALUES($1,$2,$3,$4) '+
        'ON CONFLICT(account_owner) DO UPDATE SET github_user_id=EXCLUDED.github_user_id, '+
        'github_login=EXCLUDED.github_login,encrypted_credentials=EXCLUDED.encrypted_credentials,updated_at=NOW()',
        [owner,who.id,who.login,encrypt(owner,credentials)]);
      return redirect(res,'/studio?github=connected');
    }catch{return redirect(res,'/studio?github=connect_failed');}
  }
  async function status(owner){
    if(!ready)return {available:false,connected:false};
    if(!ownerId.test(owner))return {available:true,connected:false};
    const {rows}=await db.query('SELECT github_login FROM frontline.github_app_connections WHERE account_owner=$1 LIMIT 1',[owner]);
    return {available:true,connected:!!rows[0],login:rows[0]?.github_login||null};
  }
  async function disconnect(owner){
    check();if(!ownerId.test(owner))throw bad('Sign in with Google first.',401);
    await db.query('DELETE FROM frontline.github_app_connections WHERE account_owner=$1',[owner]);
    return {connected:false,revocationNotice:'Frontline credentials removed. You can also revoke the app in GitHub settings.'};
  }
  const refreshJobs=new Map();
  async function getToken(owner){
    check();if(!ownerId.test(owner))throw bad('Sign in with Google first.',401);
    const {rows}=await db.query('SELECT encrypted_credentials FROM frontline.github_app_connections WHERE account_owner=$1 LIMIT 1',[owner]);
    if(!rows[0])throw bad('Connect GitHub before publishing.',401);
    const old=rows[0].encrypted_credentials,cred=decrypt(owner,old);
    if(typeof cred.accessToken!=='string')throw bad('Reconnect GitHub before publishing.',401);
    if(cred.expiresAt>now()+90000)return cred.accessToken;
    if(!cred.refreshToken||cred.refreshExpiresAt<=now())throw bad('GitHub authorization expired. Reconnect.',401);
    if(refreshJobs.has(owner))return refreshJobs.get(owner);
    const job=(async()=>{
      const updated=await exchange({grant_type:'refresh_token',refresh_token:cred.refreshToken});
      const r=await db.query('UPDATE frontline.github_app_connections SET encrypted_credentials=$1,updated_at=NOW() '+
        'WHERE account_owner=$2 AND encrypted_credentials=$3',[encrypt(owner,updated),owner,old]);
      if(r.rowCount===1)return updated.accessToken;
      const fresh=await db.query('SELECT encrypted_credentials FROM frontline.github_app_connections WHERE account_owner=$1 LIMIT 1',[owner]);
      if(!fresh.rows[0])throw bad('GitHub was disconnected on another device.',401);
      const next=decrypt(owner,fresh.rows[0].encrypted_credentials);
      if(next.expiresAt<=now()+30000)throw bad('GitHub authorization changed. Retry.',409);
      return next.accessToken;
    })();
    refreshJobs.set(owner,job);
    try{return await job;}finally{if(refreshJobs.get(owner)===job)refreshJobs.delete(owner);}
  }
  return {ready,start,callback,status,disconnect,getToken};
}
