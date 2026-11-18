import test from 'node:test';
import assert from 'node:assert/strict';
import {publishApprovedHandoff,validateGitHubPublishInput} from '../github-handoff.mjs';
import {server} from '../server.mjs';
const token='github_pat_TEST_TOKEN_ONLY_12345678901234567890';
const projectId='00000000-0000-4000-8000-000000000001';

test('14B: strict repo name, token, revision and unknown-field rejection',()=>{
  const base={repository:'designers/private-ui',token,revision:2};
  assert.deepEqual(validateGitHubPublishInput(base),base);
  for(const invalid of [
    {...base,repository:'https://github.com/foo/bar'},
    {...base,repository:'../secrets'},
    {...base,repository:'owner/.git'},
    {...base,token:'short'},
    {...base,token:'white space token'.repeat(3)},
    {...base,revision:-1},
    {...base,owner:'someoneElse'}
  ])assert.throws(()=>validateGitHubPublishInput(invalid));
});
test('14B: authorized one-time publish creates NEW branch, NEW markdown and draft PR',async()=>{
  const calls=[];
  const transport=async(url,options)=>{
    calls.push({url,options});
    const path=new URL(url).pathname;
    const body=options.body?JSON.parse(options.body):null;
    let response;
    if(path==='/repos/designers/private-ui'&&options.method==='GET')
      response={default_branch:'main'};
    else if(path.endsWith('/git/ref/heads/main')&&options.method==='GET')
      response={object:{sha:'a'.repeat(40)}};
    else if(path.endsWith('/git/refs')&&options.method==='POST'){
      assert.match(body.ref,/^refs\/heads\/frontline\/handoff-/);
      assert.equal(body.sha,'a'.repeat(40));
      response={ref:body.ref};
    }else if(path.includes('/contents/frontline/handoffs/')&&options.method==='PUT'){
      assert.match(Buffer.from(body.content,'base64').toString(),/APPROVED DESIGN/);
      assert.equal(body.sha,undefined,'Never overwrite a pre-existing file');
      assert.match(body.branch,/^frontline\/handoff-/);
      response={content:{path}};
    }else if(path.endsWith('/pulls')&&options.method==='POST'){
      assert.equal(body.base,'main');
      assert.equal(body.draft,true);
      response={html_url:'https://github.com/designers/private-ui/pull/75',number:75};
    }else throw Error('Unexpected GitHub request '+options.method+' '+path);
    return new Response(JSON.stringify(response),{status:200,headers:{'content-type':'application/json'}});
  };
  const result=await publishApprovedHandoff({
    repository:'designers/private-ui',token,projectId,title:'Student Dashboard',
    markdown:'# FRONTLINE APPROVED DESIGN\n\n'+('APPROVED DESIGN '.repeat(20))
  },transport,()=> '12345678-abcd-4000-9000-123456789abc');
  assert.equal(result.pullRequestUrl,'https://github.com/designers/private-ui/pull/75');
  assert.equal(result.file,'frontline/handoffs/student-dashboard-00000000.md');
  assert.deepEqual(calls.map(x=>x.options.method),['GET','GET','POST','PUT','POST']);
  assert.ok(calls.every(c=>c.url.startsWith('https://api.github.com/')));
  assert.ok(calls.every(c=>c.options.headers.Authorization==='Bearer '+token));
  assert.ok(!JSON.stringify(result).includes(token),'Never leak token to app response');
});
test('14B: upstream failures are sanitized and never expose token or mutate existing branch',async()=>{
  const transport=async()=>new Response('{"message":"bad token '+token+'"}',{status:403});
  await assert.rejects(
    publishApprovedHandoff({repository:'designers/private-ui',token,projectId,
      title:'Student Dashboard',markdown:'APPROVED DESIGN '.repeat(20)},transport),
    e=>e.status===403&&!e.message.includes(token));
});
test('14B: a guest cannot use GitHub publisher even when supplying a token',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const create=await fetch(base+'/api/projects',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({brief:'Design a private student dashboard with lessons and accessible navigation'})
    });
    const id=(await create.json()).project.id;
    const response=await fetch(base+'/api/projects/'+id+'/github-handoff',{
      method:'POST',headers:{'Content-Type':'application/json',Cookie:create.headers.get('set-cookie')?.split(';')[0]||''},
      body:JSON.stringify({repository:'designers/private-ui',token,revision:0})
    });
    assert.equal(response.status,401);
    const text=await response.text();
    assert.ok(!text.includes(token));
  }finally{await new Promise(resolve=>server.close(resolve));}
});
