/**
 * Milestone 13: owner-scoped design board and manually named project snapshots.
 * Data is an extension of the existing uic_projects.recommendation JSONB
 * document. No raw conversation messages or provider-generated prompts are
 * duplicated into these versions. Never trust client-provided owner IDs.
 */
export const WORKSPACE_VERSION=1;
export const BOARD_LIMIT=24;
export const VERSION_LIMIT=12;
export const BOARD_STAGES=Object.freeze(['ideas','explore','approved']);
export const BOARD_TYPES=Object.freeze(['page','inspiration','decision']);
export const STYLE_IDS=Object.freeze(['minimal','glass','creative']);

const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const clean=(value,limit)=>typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,limit):'';
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);
const issue=message=>Object.assign(new Error(message),{status:400});
const unique=items=>[...new Set(items)];

function sanitizeItem(item,{strict=false,referenceIds=null}={}){
  if(!plain(item))throw issue('Each board item must be an object.');
  if(!validId(item.id))throw issue('Invalid board item ID.');
  if(!BOARD_TYPES.includes(item.type))throw issue('Invalid board item type.');
  if(!BOARD_STAGES.includes(item.stage))throw issue('Invalid board column.');
  if(typeof item.title!=='string'||item.title.trim().length<2||item.title.length>100)
    throw issue('Board titles must contain 2–100 characters.');
  if(item.notes!==undefined&&(typeof item.notes!=='string'||item.notes.length>360))
    throw issue('Board notes must be at most 360 characters.');
  if(item.type==='inspiration'){
    if(!validId(item.sourceId)||item.sourceId.length>80)
      throw issue('Choose a valid inspiration reference.');
    if(strict&&referenceIds&&!referenceIds.has(item.sourceId))
      throw issue('Inspiration must come from the verified design library.');
  }else if(item.sourceId!==undefined)throw issue('Only inspiration cards can link to a reference.');
  if(strict&&Object.keys(item).some(k=>!['id','type','stage','title','notes','sourceId'].includes(k)))
    throw issue('Unknown board item field.');
  return {id:item.id,type:item.type,stage:item.stage,
    title:clean(item.title,100),notes:clean(item.notes||'',360),
    ...(item.type==='inspiration'?{sourceId:item.sourceId}:{})};
}

function normalizeStyles(styles){
  return unique((Array.isArray(styles)?styles:[]).filter(s=>STYLE_IDS.includes(s))).slice(0,3);
}
function safeItems(items){
  if(!Array.isArray(items))return [];
  const ids=new Set(),result=[];
  for(const item of items.slice(0,BOARD_LIMIT)){
    try{
      const current=sanitizeItem(item);
      if(ids.has(current.id))continue;
      ids.add(current.id);result.push(current);
    }catch{}
  }
  return result;
}
function safeVersion(entry){
  if(!plain(entry)||!validId(entry.id)||!Number.isFinite(new Date(entry.createdAt).getTime()))return null;
  const snapshot=plain(entry.snapshot)?entry.snapshot:{};
  return {id:entry.id,title:clean(entry.title||'Checkpoint',64)||'Checkpoint',
    createdAt:new Date(entry.createdAt).toISOString(),
    snapshot:{
      items:safeItems(snapshot.items),selectedStyles:normalizeStyles(snapshot.selectedStyles),
      refinement:clean(snapshot.refinement||'',450)
    }};
}
export function normalizeWorkspace(value){
  const raw=plain(value)?value:{};
  const revisions=Array.isArray(raw.versions)?raw.versions.map(safeVersion).filter(Boolean).slice(-VERSION_LIMIT):[];
  const revision=Number.isSafeInteger(raw.revision)&&raw.revision>=0?raw.revision:0;
  return {version:WORKSPACE_VERSION,revision,items:safeItems(raw.items),
    selectedStyles:raw.selectedStyles===undefined?[...STYLE_IDS]:normalizeStyles(raw.selectedStyles),
    versions:revisions,updatedAt:typeof raw.updatedAt==='string'?raw.updatedAt:null};
}

export function validateBoardUpdate(input,{referenceIds=null}={}){
  if(!plain(input))throw issue('Board update must be an object.');
  if(Object.keys(input).some(k=>!['revision','items','selectedStyles'].includes(k)))
    throw issue('Unknown board update field.');
  if(!Number.isSafeInteger(input.revision)||input.revision<0)
    throw issue('A valid board revision is required.');
  if(!Array.isArray(input.items)||input.items.length>BOARD_LIMIT)
    throw issue('Board limit is '+BOARD_LIMIT+' cards.');
  const ids=new Set();
  const items=input.items.map(item=>{
    const value=sanitizeItem(item,{strict:true,referenceIds});
    if(ids.has(value.id))throw issue('Duplicate board item ID.');
    ids.add(value.id);return value;
  });
  if(!Array.isArray(input.selectedStyles)||input.selectedStyles.length>3||
    input.selectedStyles.some(s=>!STYLE_IDS.includes(s))||
    unique(input.selectedStyles).length!==input.selectedStyles.length)
    throw issue('Select up to three unique design directions.');
  return {revision:input.revision,items,selectedStyles:[...input.selectedStyles]};
}

export function requireRevision(workspace,revision){
  if(!Number.isSafeInteger(revision)||revision<0)throw issue('Board revision is required.');
  if(workspace.revision!==revision)throw Object.assign(
    new Error('This board changed on another device. Refresh the workspace before editing.'),{status:409});
}
const copyItems=items=>items.map(item=>({...item}));
export function withUpdatedBoard(workspace,update,now=new Date().toISOString()){
  requireRevision(workspace,update.revision);
  return {...workspace,revision:workspace.revision+1,items:copyItems(update.items),
    selectedStyles:[...update.selectedStyles],updatedAt:now};
}

export function addCheckpoint(workspace,{revision,title,refinement,id,now}){
  requireRevision(workspace,revision);
  if(typeof title!=='string'||title.trim().length<2||title.length>64)
    throw issue('Checkpoint title must contain 2–64 characters.');
  if(!validId(id))throw issue('Invalid checkpoint ID.');
  const record={id,title:clean(title,64),createdAt:now||new Date().toISOString(),
    snapshot:{items:copyItems(workspace.items),
      selectedStyles:[...workspace.selectedStyles],refinement:clean(refinement,450)}};
  return {...workspace,revision:workspace.revision+1,
    versions:[...workspace.versions,record].slice(-VERSION_LIMIT),updatedAt:record.createdAt};
}
export function restoreCheckpoint(workspace,{revision,versionId,now}){
  requireRevision(workspace,revision);
  const checkpoint=workspace.versions.find(v=>v.id===versionId);
  if(!checkpoint)throw Object.assign(new Error('Checkpoint not found for this project.'),{status:404});
  return {workspace:{...workspace,revision:workspace.revision+1,
    items:copyItems(checkpoint.snapshot.items),
    selectedStyles:[...checkpoint.snapshot.selectedStyles],
    updatedAt:now||new Date().toISOString()},
    refinement:checkpoint.snapshot.refinement};
}

export function compareCheckpoint(workspace,versionId,refinement=''){
  const version=workspace.versions.find(v=>v.id===versionId);
  if(!version)throw Object.assign(new Error('Checkpoint not found for this project.'),{status:404});
  const earlier=new Map(version.snapshot.items.map(i=>[i.id,i]));
  const current=new Map(workspace.items.map(i=>[i.id,i]));
  const added=workspace.items.filter(i=>!earlier.has(i.id)).map(i=>i.title);
  const removed=version.snapshot.items.filter(i=>!current.has(i.id)).map(i=>i.title);
  const changed=workspace.items.filter(i=>{
    const previous=earlier.get(i.id);
    return previous&&(previous.stage!==i.stage||previous.title!==i.title||
      previous.notes!==i.notes||previous.sourceId!==i.sourceId);
  }).map(i=>i.title);
  return {versionId,added,removed,changed,
    addedStyles:workspace.selectedStyles.filter(s=>!version.snapshot.selectedStyles.includes(s)),
    removedStyles:version.snapshot.selectedStyles.filter(s=>!workspace.selectedStyles.includes(s)),
    refinementChanged:clean(refinement,450)!==version.snapshot.refinement};
}
