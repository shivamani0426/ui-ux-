import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDesignHandoff,designHandoffMarkdown,designHandoffFilename}
  from '../design-handoff.mjs';

const project={
  id:'private-project-123',title:'Learning dashboard',brief:'Create a student dashboard without chat.',
  messages:[{role:'user',content:'PRIVATE CHAT MUST NEVER EXPORT'}],
  visitor_id:'PRIVATE_OWNER_ID',
  recommendations:{
    category:'Education',refinement:'Use readable mobile navigation.',
    _workspace:{secret:'UNRELATED WORKSPACE DATA'},
    designs:[
      {id:'minimal',name:'Minimal SaaS',description:'Calm information hierarchy',
        layout:'Two columns',fonts:'Inter',motion:'Quiet',tradeoff:'Less visual drama',
        colors:['#fafafa','#4859da']},
      {id:'glass',name:'Glass UI',description:'Ambient cards',colors:['#123456']}
    ]
  }
};
const workspace={
  revision:4,selectedStyles:['minimal'],items:[
    {id:'p',type:'page',stage:'approved',title:'Student overview',notes:'Keyboard navigable'},
    {id:'d',type:'decision',stage:'approved',title:'Mobile-first tabs',notes:'Include focus states'},
    {id:'i',type:'inspiration',stage:'approved',title:'Reference style',sourceId:'casa',notes:'Motion only'},
    {id:'x',type:'decision',stage:'ideas',title:'UNAPPROVED PRIVATE IDEA',notes:'DO NOT EXPORT'},
    {id:'y',type:'page',stage:'explore',title:'UNAPPROVED EXPLORATION',notes:'DO NOT EXPORT'}
  ],
  versions:[{title:'PRIVATE CHECKPOINT',snapshot:{secret:'DO NOT EXPORT'}}]
};
const references=[{id:'casa',name:'Casa di Solare',site:'https://casadisolare.com'}];
const create=()=>buildDesignHandoff({project,workspace,references},'2026-11-18T14:00:00Z');

test('14A: handoff exports only approved board content, never chat/profile/checkpoint data',()=>{
  const before=JSON.stringify({project,workspace,references});
  const handoff=create();
  assert.equal(handoff.format,'frontline-design-handoff');
  assert.equal(handoff.boardRevision,4);
  assert.deepEqual(handoff.selectedStyles,['minimal']);
  assert.equal(handoff.approved.pages.length,1);
  assert.equal(handoff.approved.decisions.length,1);
  assert.equal(handoff.approved.inspirations[0].reference.url,'https://casadisolare.com/');
  assert.equal(handoff.directions.length,1);
  assert.equal(handoff.directions[0].name,'Minimal SaaS');
  const json=JSON.stringify(handoff);
  for(const forbidden of ['PRIVATE CHAT','PRIVATE_OWNER','PRIVATE CHECKPOINT',
    'UNAPPROVED PRIVATE','UNAPPROVED EXPLORATION','UNRELATED WORKSPACE'])
    assert.ok(!json.includes(forbidden),forbidden+' was leaked');
  assert.equal(JSON.stringify({project,workspace,references}),before,'export is read-only');
});

test('14A: Markdown is a readable spec, not a promise of executable application code',()=>{
  const markdown=designHandoffMarkdown(create());
  for(const included of ['Approved pages','Approved decisions','Approved inspiration',
    'Student overview','Mobile-first tabs','casadisolare.com','Implementation review checklist'])
    assert.match(markdown,new RegExp(included));
  assert.doesNotMatch(markdown,/PRIVATE CHAT|UNAPPROVED PRIVATE|PRIVATE CHECKPOINT/);
  assert.match(markdown,/not generated production code or an audited design/i);
});

test('14A: malformed drafts and absent approvals never produce a supposedly approved export',()=>{
  assert.throws(()=>buildDesignHandoff({project,workspace:{revision:0,items:[]}}),/Approved/);
  assert.throws(()=>buildDesignHandoff({project,workspace:{...workspace,revision:-1}}),/Save/);
  assert.throws(()=>buildDesignHandoff({project:null,workspace}),/saved project/);
  assert.throws(()=>buildDesignHandoff({project,workspace},'not-a-date'),/date/);
});

test('14A: refs are allowlisted to source IDs and safe HTTP(S) links',()=>{
  const handoff=buildDesignHandoff({
    project,workspace,references:[{id:'casa',name:'Suspicious',site:'javascript:alert(1)'}]
  });
  assert.equal(handoff.approved.inspirations[0].reference.url,null);
  assert.ok(!designHandoffMarkdown(handoff).includes('javascript:'));
  const unknown=buildDesignHandoff({project,workspace,references:[]});
  assert.equal(unknown.approved.inspirations[0].reference.url,null);
});

test('14A: one-line Markdown data cannot inject headings, and filenames are filesystem-safe',()=>{
  const malicious={
    ...project,title:'../../../../ PROJECT',brief:'Great brief\n# Injected section\nNext line'
  };
  const text=designHandoffMarkdown(buildDesignHandoff({project:malicious,workspace,references}));
  assert.ok(!text.includes('\n# Injected section'));
  assert.ok(text.includes('Great brief # Injected section Next line'));
  assert.equal(designHandoffFilename('../../My <> Project','md'),'my-project-design-handoff.md');
  assert.equal(designHandoffFilename('','json'),'frontline-project-design-handoff.json');
  assert.throws(()=>designHandoffFilename('Test','html'),/Unsupported/);
});

test('14A: export handles zero styles without inventing a recommendation',()=>{
  const emptyStyles=buildDesignHandoff({project,workspace:{...workspace,selectedStyles:[]},references});
  assert.deepEqual(emptyStyles.directions,[]);
  assert.match(designHandoffMarkdown(emptyStyles),/No styles selected/);
});
