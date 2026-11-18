/**
 * Frontline 12: deterministic, private, category-sensitive learning.
 *
 * This is NOT model fine-tuning or statistical proof of user intent. It is
 * bounded evidence aggregation over the visitor's final choices per project,
 * with Bayesian-style smoothing and a minimum support threshold.
 *
 * No chat transcripts, free-form feedback text, identity or source IDs are
 * returned by this module. It never relies on guest IDs as verified people.
 */
import {STYLE_IDS} from './learning-engine.mjs';

const CATEGORIES=Object.freeze([
  'AI Product','Education','Healthcare','Finance','SaaS','Commerce',
  'Portfolio','Digital product'
]);
const MAX_EXAMPLES=600;
const MIN_EXAMPLES=2;
export const CONTEXTUAL_LEARNING_VERSION=1;

const validCategory=value=>CATEGORIES.includes(value)?value:'Digital product';
const safeStyle=value=>STYLE_IDS.includes(value)?value:null;
const capped=(value,low,high)=>Math.max(low,Math.min(high,value));

/**
 * Rows come from ONE owner and contain no text:
 * {projectId, style, reaction, category, createdAt?}.
 * Latest vote per project+style counts once. This is resistant to repeat likes,
 * changes of mind, and adding many duplicate reactions to one project.
 */
export function derivePrivateLearning(rows){
  const items=Array.isArray(rows)?rows.slice(0,MAX_EXAMPLES):[];
  const choices=new Map();
  for(let i=0;i<items.length;i++){
    const row=items[i],style=safeStyle(row?.style),projectId=row?.projectId;
    if(!style||typeof projectId!=='string'||projectId.length>100)continue;
    if(!['like','dislike','edit'].includes(row.reaction))continue;
    const key=JSON.stringify([projectId,style]);
    const stamp=Number(new Date(row.createdAt||0))||0;
    const prior=choices.get(key);
    if(prior&&(prior.stamp>stamp||(prior.stamp===stamp&&prior.order>i)))continue;
    choices.set(key,{style,category:validCategory(row.category),reaction:row.reaction,
      stamp,order:i,projectId});
  }
  const groups=new Map();
  for(const choice of choices.values()){
    const key=choice.category+':'+choice.style;
    const previous=groups.get(key)||{likes:0,dislikes:0,refinements:0};
    if(choice.reaction==='like')previous.likes++;
    else if(choice.reaction==='dislike')previous.dislikes++;
    else previous.refinements++;
    groups.set(key,previous);
  }
  const categories={};
  for(const category of CATEGORIES){
    const styles={};
    for(const style of STYLE_IDS){
      const count=groups.get(category+':'+style)||{likes:0,dislikes:0,refinements:0};
      const support=count.likes+count.dislikes;
      const directional=count.likes-count.dislikes;
      const agreement=support?Math.abs(directional)/support:0;
      // Shrink toward zero rather than assuming that one Like means an
      // enduring taste. At most 3 heuristic points in either direction.
      const adjustment=support>=MIN_EXAMPLES?
        capped(Math.round(4*directional/(support+3)),-3,3):0;
      const confidence=support>=8&&agreement>=.7?'high':
        support>=4&&agreement>=.5?'medium':support>=2?'low':'insufficient';
      styles[style]={adjustment,support,confidence,likes:count.likes,
        dislikes:count.dislikes,refinements:count.refinements};
    }
    if(Object.values(styles).some(item=>item.support>0||item.refinements>0))
      categories[category]={styles};
  }
  return {version:CONTEXTUAL_LEARNING_VERSION,method:'project-specific, smoothed votes',
    categories,projectChoices:choices.size,
    caution:'Private heuristic preferences, not measured design quality or AI model training'};
}

export function contextForCategory(model,category,personalizationEnabled=true){
  const empty={category:validCategory(category),version:CONTEXTUAL_LEARNING_VERSION,
    adjustments:{minimal:0,glass:0,creative:0},evidence:{},active:false};
  if(!personalizationEnabled||!model||typeof model!=='object')return empty;
  const key=validCategory(category),styles=model.categories?.[key]?.styles||{};
  const adjustments={...empty.adjustments},evidence={};
  for(const style of STYLE_IDS){
    const signal=styles[style];
    if(!signal||!Number.isInteger(signal.support))continue;
    adjustments[style]=capped(Number(signal.adjustment)||0,-3,3);
    evidence[style]={support:signal.support,confidence:signal.confidence,
      likes:signal.likes,dislikes:signal.dislikes,refinements:signal.refinements};
  }
  return {...empty,adjustments,evidence,active:
    Object.values(adjustments).some(n=>n!==0)};
}

export function publicLearningSummary(model){
  const result=[];
  for(const [category,entry] of Object.entries(model?.categories||{})){
    const styles=Object.entries(entry.styles||{}).filter(([id,v])=>
      STYLE_IDS.includes(id)&&v.support>=MIN_EXAMPLES);
    if(!styles.length)continue;
    result.push({category,styles:Object.fromEntries(styles.map(([id,v])=>
      [id,{signal:v.adjustment,support:v.support,confidence:v.confidence,
        likes:v.likes,dislikes:v.dislikes}]))});
  }
  return result;
}

/**
 * This gate applies to public aggregate cohort descriptions.
 * No exact counts, IDs, timelines, free-form comments or visitor lists.
 * Never treat cookie identities as independent people.
 */
export const VERIFIED_COHORT_MIN=10;
export function verifiedCohortBand(count){
  const n=Number(count)||0;
  return n>=50?'50+':n>=25?'25–49':n>=VERIFIED_COHORT_MIN?'10–24':null;
}

/**
 * Pure in-memory counterpart of the production account-cohort SQL query.
 * Profiles are a Map<owner, {globalOptIn,personalization:{enabled}}>.
 * Each account contributes at most one net-positive vote per style; adding
 * more projects or pressing Like repeatedly cannot increase cohort size.
 */
export function summarizeVerifiedPatterns(rows,profiles){
  const eligibleProfiles=profiles instanceof Map?profiles:new Map();
  const latest=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    if(!row||typeof row.owner!=='string'||!/^acct:[a-f0-9-]{36}$/i.test(row.owner)
      ||!safeStyle(row.style)||typeof row.id!=='string')continue;
    const key=JSON.stringify([row.owner,row.id,row.style]);
    latest.set(key,row);
  }
  const byAccount=new Map();
  for(const row of latest.values()){
    const owner=eligibleProfiles.get(row.owner);
    if(!owner?.globalOptIn||owner?.personalization?.enabled===false||!row.optIn)continue;
    const key=JSON.stringify([row.owner,row.style]);
    byAccount.set(key,(byAccount.get(key)||0)+
      (row.reaction==='like'?1:row.reaction==='dislike'?-1:0));
  }
  const counts=new Map(STYLE_IDS.map(style=>[style,0]));
  for(const [key,net] of byAccount){
    if(net<=0)continue;
    const style=JSON.parse(key)[1];
    counts.set(style,counts.get(style)+1);
  }
  return [...counts].filter(([,count])=>count>=VERIFIED_COHORT_MIN)
    .map(([style,count])=>({style,contributorsBand:verifiedCohortBand(count)}));
}
