// Normalize publisher-verified references before database writes or chat
// snapshots. A source with missing metadata must never send NULL into the
// NOT NULL design_sources.category column.
export function sourceCategory(row){
  const explicit=typeof row?.category==='string'?row.category.trim():'';
  if(explicit)return explicit.slice(0,120);
  if(row?.sourceKind==='animation'||['React Bits','Aceternity UI'].includes(row?.provider))
    return 'Original component / animation';
  if(row?.designType==='application-ui')return 'Original application UI';
  if(row?.designType==='landing-page')return 'Original landing page';
  return 'Original design reference';
}
export function normalizedPublisherSourceRows(rows){
  if(!Array.isArray(rows))return [];
  return rows.filter(row=>row&&typeof row.id==='string'&&row.id&&
    typeof row.name==='string'&&row.name&&typeof row.site==='string'&&row.site)
    .map(row=>({
      id:row.id,name:row.name,site:row.site,
      category:sourceCategory(row),
      tags:Array.isArray(row.tags)?row.tags.filter(x=>typeof x==='string').slice(0,30):[],
      styles:Array.isArray(row.styles)?row.styles.filter(x=>typeof x==='string').slice(0,30):[],
      provider:row.provider||'',
      kind:row.sourceKind||'inspiration'
    }));
}
export function snapshotPublisherReferences(groups){
  if(!groups||typeof groups!=='object')return null;
  const snapshot={};
  for(const group of ['applicationMatches','landingMatches']){
    const items=groups[group];
    if(!Array.isArray(items))return null;
    snapshot[group]=items.slice(0,5).filter(x=>x&&x.publisherVerified===true||
      x?.provider==='Kage'&&typeof x.site==='string').map(x=>({
      id:x.id,name:x.name,site:x.site,provider:x.provider,
      category:sourceCategory(x),
      sourceKind:x.sourceKind||'inspiration',designType:x.designType,
      publisherVerified:x.publisherVerified===true,
      originalPromptStatus:x.originalPromptStatus,
      summary:String(x.summary||'').slice(0,230)
    }));
  }
  return snapshot;
}
