import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';

test('13: design board checkpoints are private, durable and non-destructive across refinements',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const client=()=>{
    let cookie='';
    return async(path,method='GET',body)=>{
      const headers={};
      if(cookie)headers.Cookie=cookie;
      if(body!==undefined)headers['Content-Type']='application/json';
      const response=await fetch(base+path,{method,headers,
        body:body===undefined?undefined:JSON.stringify(body)});
      cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;
      return {status:response.status,body:await response.json()};
    };
  };
  const alice=client(),bob=client();
  const baseBrief='Design an accessible student learning dashboard with assignments, progress tracking and AI tutor.';
  try{
    const created=await alice('/api/projects','POST',{brief:baseBrief});
    assert.equal(created.status,201);
    const id=created.body.project.id;
    const other=await bob('/api/projects','POST',{brief:baseBrief});
    assert.equal(other.status,201);
    const root='/api/projects/'+id;
    const initial=await alice(root+'/workspace');
    assert.equal(initial.status,200);
    assert.equal(initial.body.workspace.revision,0);
    assert.equal(initial.body.workspace.items.length,0);
    assert.ok(initial.body.comparisons.length===3);
    assert.deepEqual(initial.body.workspace.selectedStyles,['minimal','glass','creative']);

    const selectedRef=await alice(root+'/inspirations','PUT',{sourceId:'casa',selected:true});
    assert.equal(selectedRef.status,200);
    const withInspiration=await alice(root+'/workspace');
    assert.ok(withInspiration.body.savedInspirations.some(ref=>ref.id==='casa'));
    const boardCards=[
      {id:'page_a',type:'page',stage:'ideas',title:'Student dashboard',notes:''},
      {id:'inspiration_a',type:'inspiration',stage:'explore',title:'Casa di Solare',
        sourceId:'casa',notes:'Use only calm transitions'},
    ];
    const setBoard=await alice(root+'/workspace','PUT',{
      revision:0,items:boardCards,selectedStyles:['minimal']
    });
    assert.equal(setBoard.status,200);
    assert.equal(setBoard.body.workspace.revision,1);

    const stale=await alice(root+'/workspace','PUT',{
      revision:0,items:[],selectedStyles:[]
    });
    assert.equal(stale.status,409,'Same-device stale edits must not silently overwrite the saved board');
    const foreignGet=await bob(root+'/workspace');
    assert.equal(foreignGet.status,404);
    assert.equal((await bob(root+'/workspace','PUT',{
      revision:1,items:[],selectedStyles:[]
    })).status,404,'Other accounts/guests cannot edit private project cards');
    const invalid=await alice(root+'/workspace','PUT',{
      revision:1,items:[{id:'bad',type:'inspiration',stage:'ideas',
        title:'Unverified inspiration',sourceId:'not-a-real-reference'}],
      selectedStyles:['minimal']
    });
    assert.equal(invalid.status,400);

    const refined=await alice(root+'/intelligence','POST',{
      refinement:'Keep assignments and tutors; exclude messaging. Prioritize keyboard-friendly mobile.'
    });
    assert.equal(refined.status,200);
    assert.equal(refined.body.project.recommendations._workspace.revision,1,
      'AI recommendation refresh must preserve the saved board atomically');
    const checkpoint=await alice(root+'/workspace/versions','POST',{
      revision:1,title:'Accessible structure approved'
    });
    assert.equal(checkpoint.status,201);
    const snapshot=checkpoint.body.workspace.versions[0];
    assert.equal(snapshot.snapshot.refinement,refined.body.project.recommendations.refinement);
    assert.deepEqual(snapshot.snapshot.items,boardCards);
    assert.deepEqual(snapshot.snapshot.selectedStyles,['minimal']);
    assert.equal(checkpoint.body.workspace.revision,2);
    assert.equal((await bob(root+'/workspace/versions','POST',{
      revision:2,title:'Trying to steal'
    })).status,404);

    const updated=await alice(root+'/workspace','PUT',{
      revision:2,items:[{...boardCards[0],stage:'approved',
        notes:'Keyboard and screen reader accessible'},boardCards[1]],
      selectedStyles:['glass','minimal']
    });
    assert.equal(updated.status,200);
    assert.equal(updated.body.workspace.revision,3);

    const compare=await alice(root+'/workspace/versions/'+snapshot.id+'/compare');
    assert.equal(compare.status,200);
    assert.deepEqual(compare.body.comparison.changed,['Student dashboard']);
    assert.deepEqual(compare.body.comparison.addedStyles,['glass']);
    assert.equal(compare.body.comparison.refinementChanged,false);
    assert.equal((await bob(root+'/workspace/versions/'+snapshot.id+'/compare')).status,404);

    const secondRefinement=await alice(root+'/intelligence','POST',{
      refinement:'Change strategy: prioritize glass panels and fewer animations.'
    });
    assert.equal(secondRefinement.status,200);
    assert.equal(secondRefinement.body.project.recommendations._workspace.revision,3);
    const changedScope=await alice(root+'/workspace/versions/'+snapshot.id+'/compare');
    assert.equal(changedScope.body.comparison.refinementChanged,true);

    const before=await alice(root);
    const beforeMessages=before.body.project.messages;
    const restored=await alice(root+'/workspace/versions/'+snapshot.id+'/restore','POST',{
      revision:3
    });
    assert.equal(restored.status,200);
    assert.equal(restored.body.workspace.revision,4);
    assert.equal(restored.body.workspace.versions.length,1);
    assert.deepEqual(restored.body.workspace.items,boardCards);
    assert.deepEqual(restored.body.workspace.selectedStyles,['minimal']);
    assert.equal(restored.body.recommendations.refinement,snapshot.snapshot.refinement);
    assert.equal(restored.body.recommendations._workspace.revision,4);
    assert.equal((await alice(root+'/workspace/versions/'+snapshot.id+'/restore','POST',{
      revision:3
    })).status,409);

    const after=await alice(root);
    assert.equal(after.body.project.brief,baseBrief);
    assert.deepEqual(after.body.project.messages,beforeMessages);
    assert.equal(after.body.project.recommendations.refinement,snapshot.snapshot.refinement);
    assert.equal(after.body.project.recommendations._workspace.revision,4);
    const originalRef=await alice(root+'/inspirations');
    assert.ok(originalRef.body.selected.includes('casa'),
      'Restoring a design checkpoint must not remove saved inspirations');
    const listing=await alice('/api/projects');
    assert.equal(listing.status,200);
    assert.equal(listing.body.projects.find(p=>p.id===id).recommendations._workspace.revision,4);
    assert.equal((await bob(root)).status,404);
    assert.equal((await alice('/api/projects/'+other.body.project.id+'/workspace')).status,404);

    // A complete 24-card board with maximum notes must remain saveable even
    // when its JSON exceeds the old 12 KB general API body limit.
    const maxProject=await alice('/api/projects','POST',{brief:baseBrief});
    assert.equal(maxProject.status,201);
    const fullBoard={revision:0,
      items:Array.from({length:24},(_,i)=>({
        id:'full_card_'+i,type:'decision',stage:i%2?'explore':'ideas',
        title:'Accessibility decision '+i+' '+('W'.repeat(65)),
        notes:'Review responsive keyboard focus and error states. '+('N'.repeat(300))
      })),
      selectedStyles:['minimal','creative']
    };
    assert.ok(Buffer.byteLength(JSON.stringify(fullBoard),'utf8')>12_000,
      'Full-capacity regression requires a payload larger than the former limit');
    assert.ok(Buffer.byteLength(JSON.stringify(fullBoard),'utf8')<24_000);
    const maxSaved=await alice('/api/projects/'+maxProject.body.project.id+
      '/workspace','PUT',fullBoard);
    assert.equal(maxSaved.status,200,
      '24 valid cards and 360-character notes must fit the scoped board request limit');
    assert.equal(maxSaved.body.workspace.items.length,24);
    // Two concurrent saves using the same revision must produce one winner,
    // not silent last-write-wins data loss (in-memory and PostgreSQL row locks).
    const competing=await Promise.all([
      alice(root+'/workspace','PUT',{revision:4,items:[boardCards[0]],selectedStyles:['minimal']}),
      alice(root+'/workspace','PUT',{revision:4,items:[],selectedStyles:['glass']}),
    ]);
    assert.deepEqual(competing.map(v=>v.status).sort((a,b)=>a-b),[200,409]);
  }finally{
    await Promise.allSettled([alice('/api/profile','DELETE'),bob('/api/profile','DELETE')]);
    await new Promise(resolve=>server.close(resolve));
  }
});
