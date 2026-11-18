/**
 * Milestone 14A: a user-initiated, local-only export of APPROVED workbench items.
 * No chats, guest IDs, provider outputs, raw profile, tokens or private history.
 * This module performs no network requests and requires no third-party accounts.
 */
const STYLE_IDS=new Set(['minimal','glass','creative']);
const clean=(value,limit=500)=>typeof value==='string'
  ?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,limit):'';
const safeUrl=value=>{
  if(typeof value!=='string')return null;
  try{
    const url=new URL(value);
    if(!['https:','http:'].includes(url.protocol)||!url.hostname||url.username||url.password)return null;
    return url.href;
  }catch{return null;}
};
const unique=values=>[...new Set(values)];
const md=value=>clean(value,2800).replace(/([\\\x60*_{}\[\]<>|])/g,'\\$1');
const section=(title,items,render)=>[
  '## '+title,'',
  ...(items.length?items.map(render):['_None approved._']),''
];

export function buildDesignHandoff({project,workspace,references=[]},now=new Date().toISOString()){
  if(!project||typeof project!=='object'||!workspace||!Array.isArray(workspace.items))
    throw new Error('Open a saved project design board before exporting.');
  if(!Number.isSafeInteger(workspace.revision)||workspace.revision<0)
    throw new Error('Save your design board before exporting.');
  if(!Number.isFinite(Date.parse(now)))throw new Error('Invalid export date.');
  const approved=workspace.items.filter(item=>item?.stage==='approved');
  if(!approved.length)throw new Error('Move at least one board card to Approved and save the board first.');
  const selected=unique((Array.isArray(workspace.selectedStyles)?workspace.selectedStyles:[])
    .filter(id=>STYLE_IDS.has(id)));
  const directions=(Array.isArray(project.recommendations?.designs)?
    project.recommendations.designs:[]).filter(d=>selected.includes(d?.id))
    .map(d=>({
      id:d.id,name:clean(d.name,100),description:clean(d.description,400),
      layout:clean(d.layout,250),typography:clean(d.fonts,200),
      motion:clean(d.motion,250),tradeoff:clean(d.tradeoff,400),
      palette:Array.isArray(d.colors)?d.colors.filter(c=>typeof c==='string'&&/^#[0-9a-f]{3,8}$/i.test(c)).slice(0,5):[]
    }));
  const library=new Map((Array.isArray(references)?references:[])
    .filter(ref=>ref&&typeof ref.id==='string').map(ref=>[ref.id,ref]));
  const mapped=approved.map(item=>{
    const base={type:item.type,title:clean(item.title,100),notes:clean(item.notes,360)};
    if(item.type!=='inspiration')return base;
    const source=library.get(item.sourceId);
    return {...base,reference:{
      id:clean(item.sourceId,80),name:clean(source?.name||item.title,120),
      url:safeUrl(source?.site)
    }};
  });
  return {
    format:'frontline-design-handoff',schemaVersion:1,exportedAt:new Date(now).toISOString(),
    project:{
      title:clean(project.title,120)||'Untitled project',
      category:clean(project.recommendations?.category,100),
      brief:clean(project.brief,2500),
      approvedRefinement:clean(project.recommendations?.refinement,450)
    },
    boardRevision:workspace.revision,
    selectedStyles:selected,
    directions,
    approved:{
      pages:mapped.filter(item=>item.type==='page'),
      decisions:mapped.filter(item=>item.type==='decision'),
      inspirations:mapped.filter(item=>item.type==='inspiration')
    },
    handoffNotes:[
      'Only cards explicitly moved to Approved are included; ideas and explorations are excluded.',
      'A design brief/specification, not executable code, an editable Figma file, or verified user testing.',
      'Verify accessibility, requirements, image rights and external references before implementation.'
    ]
  };
}

export function designHandoffMarkdown(handoff){
  if(handoff?.format!=='frontline-design-handoff'||handoff.schemaVersion!==1)
    throw new Error('Unsupported design handoff format.');
  const p=handoff.project;
  const lines=[
    '# Frontline UX/UI — Approved Design Handoff','',
    '**Project:** '+md(p.title),'**Category:** '+(md(p.category)||'Unspecified'),
    '**Exported:** '+md(handoff.exportedAt),
    '**Saved board revision:** '+handoff.boardRevision,'',
    '## Approved project brief','',md(p.brief)||'_No brief supplied._','',
    '## Latest approved refinement','',md(p.approvedRefinement)||'_None._','',
    '## Selected design directions','',
    ...(handoff.directions.length?handoff.directions.map(d=>
      '- **'+md(d.name)+'** — '+md(d.description)+
      (d.layout?' Layout: '+md(d.layout)+'.':'')+
      (d.typography?' Typography: '+md(d.typography)+'.':'')+
      (d.motion?' Motion: '+md(d.motion)+'.':'')+
      (d.palette.length?' Palette: '+d.palette.join(', ')+'.':'')+
      (d.tradeoff?' Tradeoff: '+md(d.tradeoff)+'.':'')
    ):['_No styles selected; confirm the visual direction before implementation._']),'',
    ...section('Approved pages',handoff.approved.pages,item=>
      '- **'+md(item.title)+'**'+(item.notes?' — '+md(item.notes):'')),
    ...section('Approved decisions',handoff.approved.decisions,item=>
      '- **'+md(item.title)+'**'+(item.notes?' — '+md(item.notes):'')),
    ...section('Approved inspiration references',handoff.approved.inspirations,item=>
      '- **'+md(item.title)+'**'+(item.notes?' — '+md(item.notes):'')+
      (item.reference?.url?' — '+md(item.reference.url):' (reference link unavailable)')),
    '## Implementation review checklist','',
    '- [ ] Confirm each approved page and user flow with the project owner.',
    '- [ ] Respect the latest brief and explicitly excluded features.',
    '- [ ] Review keyboard access, focus, contrast, semantics and reduced motion.',
    '- [ ] Validate mobile, desktop, loading, empty and error states.',
    '- [ ] Check the rights and licensing of any external inspiration assets.','',
    '> This is a user-selected design handoff, not generated production code or an audited design.',''
  ];
  return lines.join('\n');
}

export function designHandoffFilename(title,extension){
  if(!['md','json'].includes(extension))throw new Error('Unsupported export type.');
  const slug=clean(title,100).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55);
  return (slug||'frontline-project')+'-design-handoff.'+extension;
}
