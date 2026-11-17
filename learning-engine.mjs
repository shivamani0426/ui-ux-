/**
 * Frontline Milestone 07: private, transparent design preferences.
 *
 * Uses a namespaced object in the existing per-visitor JSONB style_weights
 * column. No new table, migration, chat transcript analysis, or shared storage.
 * Explicit requirements always override these optional recommendations.
 */
export const STYLE_IDS=Object.freeze(['minimal','glass','creative']);
export const DEFAULT_PERSONALIZATION=Object.freeze({
  enabled:true,
  motion:'balanced',
  density:'comfortable',
  contrast:'standard',
  colorMood:'neutral',
});
const OPTIONS={
  motion:['minimal','balanced','expressive'],
  density:['compact','comfortable'],
  contrast:['standard','high'],
  colorMood:['neutral','warm','cool'],
};
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
export function normalizePersonalization(value){
  const raw=object(value),out={...DEFAULT_PERSONALIZATION};
  if(typeof raw.enabled==='boolean')out.enabled=raw.enabled;
  for(const [key,allowed] of Object.entries(OPTIONS))
    if(allowed.includes(raw[key]))out[key]=raw[key];
  return out;
}
export function normalizeStyleWeights(value){
  const source=object(value),out={};
  for(const id of STYLE_IDS){
    const n=Number(source[id]);
    if(source[id]!==undefined&&Number.isInteger(n))out[id]=Math.max(-5,Math.min(5,n));
  }
  return out;
}
export function normalizeProfile(raw={}){
  const obj=object(raw),weights=object(obj.styleWeights);
  return {
    styleWeights:normalizeStyleWeights(weights),
    globalOptIn:obj.globalOptIn===true,
    personalization:normalizePersonalization(obj.personalization??weights._personalization),
  };
}
export function persistableWeights(profile){
  const value=normalizeProfile(profile);
  return {...value.styleWeights,_personalization:value.personalization};
}
export function effectivePreferences(profile){
  const value=normalizeProfile(profile);
  return value.personalization.enabled?value:{
    ...value,styleWeights:{},personalization:{...value.personalization,enabled:false},
  };
}
export function learnStyle(profile,id,signal){
  const p=normalizeProfile(profile);
  if(!p.personalization.enabled||!STYLE_IDS.includes(id))return p;
  const delta=signal==='like'||signal==='finalized'?1:signal==='dislike'?-1:0;
  if(delta)p.styleWeights[id]=Math.max(-5,Math.min(5,(p.styleWeights[id]||0)+delta));
  return p;
}
export function validatePreferenceChanges(input){
  const raw=object(input);
  if(!input||typeof input!=='object'||Array.isArray(input))
    throw new Error('Preference changes must be an object.');
  const allowed=['enabled','motion','density','contrast','colorMood','styleWeights'];
  for(const key of Object.keys(raw))if(!allowed.includes(key))
    throw new Error('Unknown design preference.');
  const changes={};
  if(own(raw,'enabled')){
    if(typeof raw.enabled!=='boolean')throw new Error('Learning enabled must be true or false.');
    changes.enabled=raw.enabled;
  }
  for(const [key,values] of Object.entries(OPTIONS)){
    if(own(raw,key)){
      if(!values.includes(raw[key]))throw new Error('Invalid '+key+' preference.');
      changes[key]=raw[key];
    }
  }
  if(own(raw,'styleWeights')){
    const weights=object(raw.styleWeights);
    if(!raw.styleWeights||typeof raw.styleWeights!=='object'||Array.isArray(raw.styleWeights))
      throw new Error('Style corrections must be an object.');
    const updates={};
    for(const [key,value] of Object.entries(weights)){
      if(!STYLE_IDS.includes(key)||typeof value!=='number'||!Number.isInteger(value)||value< -5||value>5)
        throw new Error('Style weights must be integers between -5 and 5.');
      updates[key]=value;
    }
    changes.styleWeights=updates;
  }
  return changes;
}
export function applyPreferenceChanges(profile,raw){
  const p=normalizeProfile(profile),changes=validatePreferenceChanges(raw);
  p.personalization=normalizePersonalization({...p.personalization,...changes});
  if(changes.styleWeights)p.styleWeights={...p.styleWeights,...changes.styleWeights};
  if(!p.personalization.enabled)p.globalOptIn=false;
  return p;
}
export function resetPreferenceLearning(profile){
  const p=normalizeProfile(profile);
  return {...p,styleWeights:{},globalOptIn:false,
    personalization:{...DEFAULT_PERSONALIZATION,enabled:p.personalization.enabled}};
}
export function preferenceHints(profile){
  const p=effectivePreferences(profile);
  if(!p.personalization.enabled)return [];
  const s=p.personalization;
  const hints=[
    'Motion preference: '+s.motion+' (honor explicit reduced-motion requirements)',
    'Information density preference: '+s.density,
    'Contrast preference: '+s.contrast+' (validate real color contrast independently)',
    'Color atmosphere preference: '+s.colorMood,
  ];
  const ranked=STYLE_IDS.filter(id=>(p.styleWeights[id]||0)!==0)
    .sort((a,b)=>Math.abs(p.styleWeights[b])-Math.abs(p.styleWeights[a]));
  for(const id of ranked)hints.push('Personal '+id+' preference signal: '+p.styleWeights[id]+'/5 (prior feedback; not a measured match score)');
  return hints;
}
