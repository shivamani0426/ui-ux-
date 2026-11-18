import crypto from 'node:crypto';
/**
 * Milestone 14B: deliberately consent-driven GitHub handoff publication.
 * Caller provides ONE-TIME fine-grained GitHub credentials. No persistence,
 * logging, client-side GitHub API calls, overwrites, or arbitrary file paths.
 * The caller must already have checked project ownership and board revision.
 */
const repoPattern=/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})\/[a-zA-Z0-9_.-]{1,100}$/;
const safeRepo=value=>typeof value==='string'&&repoPattern.test(value)&&
  !value.split('/')[1].startsWith('.')&&!value.includes('..');
const safeGitHubLink=value=>{
  if(typeof value!=='string')return null;
  try{
    const u=new URL(value);
    return u.protocol==='https:'&&u.hostname==='github.com'&&!u.username&&!u.password?u.href:null;
  }catch{return null;}
};
const issue=(message,status=400)=>Object.assign(new Error(message),{status});
const clean=(v,max=120)=>String(v||'').replace(/[\r\n\u0000-\u001f]/g,' ').trim().slice(0,max);

export function validateGitHubPublishInput(input){
  if(!input||typeof input!=='object'||Array.isArray(input))
    throw issue('Choose a GitHub repository and supply a one-time token.');
  if(Object.keys(input).some(k=>!['repository','token','revision'].includes(k)))
    throw issue('Unknown GitHub handoff field.');
  if(!safeRepo(input.repository))throw issue('Use an exact owner/repository name.');
  if(input.token!==undefined&&(typeof input.token!=='string'||
    (input.token!==''&&(input.token.length<20||input.token.length>500||/\s/.test(input.token)))))
    throw issue('Use a valid fine-grained GitHub access token.');
  if(!Number.isSafeInteger(input.revision)||input.revision<0)
    throw issue('Save the approved board before publishing.');
  return {repository:input.repository,token:input.token,revision:input.revision};
}

function githubError(stage,status){
  if(status===401)throw issue('GitHub authorization failed. Check your token.',401);
  if(status===403)throw issue('GitHub denied '+stage+'. Grant Contents and Pull requests write access for this repository.',403);
  if(status===404)throw issue('GitHub could not access the requested repository. Check its name and token access.',404);
  if(status===409||status===422)throw issue('GitHub rejected '+stage+' due to a conflict. Review the repository before retrying.',409);
  throw issue('GitHub '+stage+' failed (HTTP '+status+'). No existing branch was overwritten.',502);
}
async function request(transport,token,method,path,body,stage){
  const response=await transport('https://api.github.com'+path,{
    method,redirect:'error',headers:{
      Authorization:'Bearer '+token,
      Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      ...(body===undefined?{}:{'Content-Type':'application/json'})
    },...(body===undefined?{}:{body:JSON.stringify(body)}),
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)githubError(stage,response.status);
  return response.json();
}

/**
 * Publishes a NEW BRANCH + NEW FILE + PR. Never uses an existing content SHA;
 * an already-existing path therefore fails instead of silently overwriting it.
 * No network operation occurs until the user explicitly submits credentials.
 */
export async function publishApprovedHandoff({
  repository,token,projectId,title,markdown
},transport=fetch,id=()=>crypto.randomUUID()){
  if(!safeRepo(repository))throw issue('Invalid repository name.');
  if(typeof token!=='string'||token.length<20||token.length>500||/\s/.test(token))
    throw issue('A valid one-time token is required.');
  if(typeof projectId!=='string'||!/^[a-f0-9-]{36}$/i.test(projectId))
    throw issue('Invalid project identifier.');
  if(typeof markdown!=='string'||markdown.length<150||markdown.length>50000)
    throw issue('The approved design handoff is missing or too large.');
  const slug=clean(title,48).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'project';
  const target=repository.split('/').map(encodeURIComponent).join('/');
  const repoInfo=await request(transport,token,'GET','/repos/'+target,undefined,'repository lookup');
  const base=repoInfo.default_branch;
  if(typeof base!=='string'||!/^[a-zA-Z0-9_.\/-]{1,160}$/.test(base)||base.includes('..'))
    throw issue('GitHub did not return a safe base branch.',502);
  const info=await request(transport,token,'GET',
    '/repos/'+target+'/git/ref/heads/'+base.split('/').map(encodeURIComponent).join('/'),
    undefined,'base branch lookup');
  const sha=info.object?.sha;
  if(!/^[a-f0-9]{40}$/i.test(sha||''))throw issue('GitHub returned an invalid branch revision.',502);
  const suffix=String(id()).replace(/[^a-zA-Z0-9]/g,'').slice(0,12);
  if(suffix.length<8)throw issue('Could not create a safe unique branch.',500);
  const branch='frontline/handoff-'+projectId.slice(0,8)+'-'+suffix.toLowerCase();
  const file='frontline/handoffs/'+slug+'-'+projectId.slice(0,8)+'.md';
  await request(transport,token,'POST','/repos/'+target+'/git/refs',
    {ref:'refs/heads/'+branch,sha},'new branch creation');
  const content=Buffer.from(markdown,'utf8').toString('base64');
  await request(transport,token,'PUT','/repos/'+target+'/contents/'+file,{
    message:'docs(frontline): add approved design handoff for '+clean(title,64),
    content,branch
  },'handoff file creation');
  const pr=await request(transport,token,'POST','/repos/'+target+'/pulls',{
    title:'Frontline design handoff: '+clean(title,75),
    head:branch,base,draft:true,
    body:'User-approved Frontline UX/UI handoff. Contains selected design specifications only. Review scope, accessibility and reference licensing before merging.'
  },'draft pull request');
  const pullRequestUrl=safeGitHubLink(pr.html_url);
  if(!pullRequestUrl)throw issue('GitHub returned an invalid pull-request URL.',502);
  return {repository,pullRequestUrl,branch,file,pullRequestNumber:pr.number};
}
