/**
 * Release gate: a successful browser test against yesterday's Render code is
 * not proof today's GitHub commit is deployed. Poll only the public health API.
 * No credentials, test accounts or user content.
 */
const expected=process.env.EXPECTED_COMMIT_SHA;
if(!/^[a-f0-9]{40}$/i.test(expected||'')){
  console.error('LIVE_RELEASE_GATE invalid expected commit');
  process.exit(1);
}
const short=expected.slice(0,12).toLowerCase();
const url='https://ui-compass-studio.onrender.com/api/health';
const deadline=Date.now()+240000;
let attempt=0;
let seen='unavailable';
while(Date.now()<deadline){
  attempt++;
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'Cache-Control':'no-cache'}});
    if(response.ok){
      const data=await response.json();
      seen=typeof data?.revision==='string'&&/^(?:[a-f0-9]{12}|local)$/.test(data.revision)
        ?data.revision:'missing';
      if(data.status==='ok'&&seen===short){
        console.log('LIVE_RELEASE_GATE passed expected='+short+' attempt='+attempt);
        process.exit(0);
      }
    }
  }catch{seen='unavailable'}
  if(attempt%6===1)console.log('LIVE_RELEASE_GATE pending expected='+short+' observed='+seen);
  await new Promise(resolve=>setTimeout(resolve,6000));
}
console.error('LIVE_RELEASE_GATE FAILED expected='+short+' observed='+seen);
process.exit(1);
