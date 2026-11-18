import test from 'node:test';
import assert from 'node:assert/strict';
import {WORKSPACE_VERSION,BOARD_LIMIT,VERSION_LIMIT,normalizeWorkspace,
  validateBoardUpdate,withUpdatedBoard,addCheckpoint,restoreCheckpoint,
  compareCheckpoint,requireRevision} from '../project-workspace.mjs';

const card=(id,stage='ideas')=>({id,type:'page',stage,title:'Student dashboard',notes:''});
const update=(revision,items=[],selectedStyles=['minimal','glass'])=>({
  revision,items,selectedStyles
});

test('13A: old projects begin with a safe, private empty board without a data migration',()=>{
 const initial=normalizeWorkspace(null);
 assert.equal(initial.version,WORKSPACE_VERSION);
 assert.equal(initial.revision,0);
 assert.deepEqual(initial.items,[]);
 assert.deepEqual(initial.versions,[]);
 assert.deepEqual(initial.selectedStyles,['minimal','glass','creative']);
 assert.equal(normalizeWorkspace({revision:-1}).revision,0);
 assert.equal(normalizeWorkspace({items:[{id:'../bad'}]}).items.length,0);
});

test('13A: type-safe board updates cannot inject arbitrary fields, duplicates or unverified references',()=>{
 const good=validateBoardUpdate(update(0,[
   card('dashboard'),
   {id:'card-two',type:'inspiration',stage:'explore',title:'Casa di Solare',
     sourceId:'casa',notes:'Ambient motion'}
 ]),{referenceIds:new Set(['casa'])});
 assert.equal(good.items.length,2);
 assert.equal(good.items[1].sourceId,'casa');
 const invalid=[
   {...update(0),revision:-1},
   {...update(0),revision:'0'},
   {...update(0),selectedStyles:['minimal','minimal']},
   {...update(0),selectedStyles:['nonexistent']},
   {...update(0),items:[card('repeat'),card('repeat')]},
   {...update(0),items:[{...card('a'),stage:'deleted'}]},
   {...update(0),items:[{...card('a'),notes:'x'.repeat(361)}]},
   {...update(0),items:[{...card('a'),owner:'someone-else'}]},
   {...update(0),items:[{id:'evil',type:'inspiration',stage:'ideas',title:'Unknown',sourceId:'unknown'}]},
   {...update(0),items:Array.from({length:BOARD_LIMIT+1},(_,i)=>card('card'+i))},
   {...update(0),newField:{secret:'cannot save arbitrary JSON'}}
 ];
 for(const candidate of invalid){
   assert.throws(()=>validateBoardUpdate(candidate,{referenceIds:new Set(['casa'])}));
 }
});

test('13B: checkpoint captures board + selected styles + approved refinement, not chat or raw prompts',()=>{
 let board=normalizeWorkspace(null);
 board=withUpdatedBoard(board,validateBoardUpdate(update(0,[card('a')],['minimal'])),
   '2026-11-18T00:00:00.000Z');
 assert.equal(board.revision,1);
 board=addCheckpoint(board,{revision:1,title:'Mobile direction approved',
   refinement:'No messaging. Focus on mobile navigation.',id:'checkpoint123',
   now:'2026-11-18T01:00:00.000Z'});
 assert.equal(board.revision,2);
 assert.equal(board.versions.length,1);
 const checkpoint=board.versions[0];
 assert.equal(checkpoint.title,'Mobile direction approved');
 assert.deepEqual(checkpoint.snapshot.selectedStyles,['minimal']);
 assert.equal(checkpoint.snapshot.items[0].title,'Student dashboard');
 assert.match(checkpoint.snapshot.refinement,/No messaging/);
 assert.ok(!JSON.stringify(checkpoint).includes('messages'));
 assert.ok(!JSON.stringify(checkpoint).includes('generated_prompts'));
 const edited=withUpdatedBoard(board,validateBoardUpdate(
   update(2,[{...card('a','approved'),notes:'Keyboard access'}],['glass'])));
 const diff=compareCheckpoint(edited,'checkpoint123','New look');
 assert.deepEqual(diff.changed,['Student dashboard']);
 assert.deepEqual(diff.addedStyles,['glass']);
 assert.deepEqual(diff.removedStyles,['minimal']);
 assert.equal(diff.refinementChanged,true);
 const restored=restoreCheckpoint(edited,{revision:3,versionId:'checkpoint123'});
 assert.equal(restored.workspace.revision,4);
 assert.deepEqual(restored.workspace.items,checkpoint.snapshot.items);
 assert.deepEqual(restored.workspace.selectedStyles,['minimal']);
 assert.equal(restored.refinement,'No messaging. Focus on mobile navigation.');
 assert.equal(restored.workspace.versions.length,1);
 assert.throws(()=>requireRevision(restored.workspace,3),e=>e.status===409);
});

test('13B: version retention limits history and invalid restores fail closed',()=>{
 let board=normalizeWorkspace({});
 for(let i=0;i<VERSION_LIMIT+5;i++){
   board=addCheckpoint(board,{revision:board.revision,title:'Checkpoint '+i,
     refinement:'Keep accessibility',id:'version_'+i,now:new Date(2026,0,i+1).toISOString()});
 }
 assert.equal(board.versions.length,VERSION_LIMIT);
 assert.equal(board.versions[0].id,'version_5');
 assert.throws(()=>restoreCheckpoint(board,{revision:board.revision,versionId:'version_0'}),
   e=>e.status===404);
 assert.throws(()=>addCheckpoint(board,{revision:board.revision,title:'A',id:'new_version'}),
   e=>e.status===400);
 assert.throws(()=>compareCheckpoint(board,'another-visitor-version'),
   e=>e.status===404);
});

test('13C: version comparisons detect added, deleted, edited and unchanged cards without modification',()=>{
 let board=normalizeWorkspace({});
 board=withUpdatedBoard(board,validateBoardUpdate(update(0,[card('one'),{
   id:'two',type:'decision',stage:'explore',title:'Mobile hierarchy',notes:'Try tabs'}],['creative'])));
 board=addCheckpoint(board,{revision:1,title:'Initial draft',refinement:'',id:'snap_a'});
 const edited=withUpdatedBoard(board,validateBoardUpdate(update(2,[
   {...card('one'),stage:'approved'},
   {id:'three',type:'decision',stage:'ideas',title:'Offline states',notes:''}
 ],['creative','minimal'])));
 const before=JSON.stringify(edited);
 const diff=compareCheckpoint(edited,'snap_a');
 assert.deepEqual(diff.added,['Offline states']);
 assert.deepEqual(diff.removed,['Mobile hierarchy']);
 assert.deepEqual(diff.changed,['Student dashboard']);
 assert.deepEqual(diff.addedStyles,['minimal']);
 assert.deepEqual(diff.removedStyles,[]);
 assert.equal(diff.refinementChanged,false);
 assert.equal(JSON.stringify(edited),before,'Comparison must not mutate the saved board');
});
