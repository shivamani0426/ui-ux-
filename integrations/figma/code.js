/* Figma editable importer. No external requests, tokens, telemetry or chat access. */
figma.showUI(__html__,{width:420,height:380,themeColors:true});
const fontRegular={family:'Inter',style:'Regular'};
const fontBold={family:'Inter',style:'Bold'};
const txt=(value,max)=>String(value||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
function checked(payload){
  if(!payload||JSON.stringify(payload).length>70000||payload.format!=='frontline-design-handoff'||payload.schemaVersion!==1)
    throw new Error('Select a Frontline approved-design JSON file (schema version 1).');
  if(!payload.project||!payload.approved||!Array.isArray(payload.selectedStyles))
    throw new Error('The design handoff is incomplete.');
  const groups=['pages','decisions','inspirations'];
  for(const kind of groups){
    const cards=payload.approved[kind];
    if(!Array.isArray(cards)||cards.length>24)throw new Error('Invalid '+kind+' cards.');
    for(const card of cards){
      if(!card||typeof card.title!=='string'||card.title.length>100||
        typeof card.notes!=='string'||card.notes.length>360)
        throw new Error('Invalid approved card.');
    }
  }
  if(groups.reduce((n,k)=>n+payload.approved[k].length,0)>24)
    throw new Error('Too many approved cards.');
  if(payload.directions&&!Array.isArray(payload.directions))
    throw new Error('Invalid selected directions.');
  return payload;
}
const rgb=hex=>{
  if(typeof hex!=='string'||!/^#[a-f0-9]{6}$/i.test(hex))return null;
  return {r:parseInt(hex.slice(1,3),16)/255,
    g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255};
};
function textNode(parent,text,x,y,{bold=false,size=14,width=800,color={r:.12,g:.19,b:.30}}={}){
  const node=figma.createText();
  parent.appendChild(node);
  node.fontName=bold?fontBold:fontRegular;
  node.fontSize=size;
  node.fills=[{type:'SOLID',color}];
  node.characters=txt(text,3000);
  node.resize(width,Math.max(22,node.height));
  // Ask Figma to measure wrapping and content height rather than guessing by character count.
  node.textAutoResize='HEIGHT';
  node.x=x;node.y=y;
  return node;
}
async function createEditableHandoff(payload){
  const data=checked(payload);
  await Promise.all([figma.loadFontAsync(fontRegular),figma.loadFontAsync(fontBold)]);
  const frame=figma.createFrame();
  try{
    frame.name='Frontline UX/UI • '+txt(data.project.title,80);
    frame.resize(960,760);
    frame.fills=[{type:'SOLID',color:{r:.96,g:.97,b:1}}];
    frame.clipsContent=false;
    frame.x=figma.viewport.center.x-480;
    frame.y=figma.viewport.center.y-380;
    let y=32;
    let node=textNode(frame,'FRONTLINE / APPROVED DESIGN HANDOFF',36,y,{bold:true,size:15});
    y+=Math.max(36,node.height+12);
    node=textNode(frame,txt(data.project.title,100),36,y,{bold:true,size:27});
    y+=Math.max(43,node.height+15);
    // Preserve the full approved brief; HEIGHT auto-layout prevents text overlap.
    node=textNode(frame,'Brief: '+txt(data.project.brief,2500),36,y,{size:13,width:880});
    y+=Math.max(45,node.height+22);
    if(data.project.approvedRefinement){
      node=textNode(frame,'Approved refinement: '+txt(data.project.approvedRefinement,450),36,y,
        {size:13,width:880});
      y+=Math.max(36,node.height+18);
    }
    const directions=(data.directions||[]).slice(0,3);
    if(directions.length){
      node=textNode(frame,'SELECTED VISUAL DIRECTIONS',36,y,{bold:true,size:14});
      y+=Math.max(26,node.height+10);
      for(const direction of directions){
        const summary=[txt(direction.name,100),txt(direction.description,400),
          'Layout: '+txt(direction.layout,250),'Typography: '+txt(direction.typography,200),
          'Motion: '+txt(direction.motion,250),'Tradeoff: '+txt(direction.tradeoff,400)]
          .filter(Boolean).join('  |  ');
        node=textNode(frame,summary,36,y,{size:12,width:880});
        y+=Math.max(26,node.height+9);
        const colors=(Array.isArray(direction.palette)?direction.palette:[]).slice(0,5);
        let x=36;
        for(const color of colors){
          const fill=rgb(color);
          if(!fill)continue;
          const swatch=figma.createRectangle();
          frame.appendChild(swatch);swatch.resize(24,18);swatch.x=x;swatch.y=y;
          swatch.fills=[{type:'SOLID',color:fill}];x+=33;
        }
        if(x>36)y+=25;
        y+=14;
      }
    }
    for(const [key,label] of [
      ['pages','APPROVED PAGES'],
      ['decisions','APPROVED DESIGN DECISIONS'],
      ['inspirations','APPROVED INSPIRATION NOTES']
    ]){
      const cards=data.approved[key];
      if(!cards.length)continue;
      y+=12;node=textNode(frame,label,36,y,{bold:true,size:15});y+=Math.max(29,node.height+9);
      for(const card of cards){
        const row=figma.createFrame();
        frame.appendChild(row);row.resize(888,66);
        row.x=36;row.y=y;row.cornerRadius=12;
        row.fills=[{type:'SOLID',color:{r:1,g:1,b:1}}];
        const heading=textNode(row,txt(card.title,100),16,10,{bold:true,size:13,width:850});
        let contentBottom=heading.y+heading.height+15;
        if(card.notes){
          const notes=textNode(row,txt(card.notes,360),16,contentBottom,{size:11,width:850});
          contentBottom=notes.y+notes.height+15;
        }
        row.resize(888,Math.max(66,contentBottom));
        y+=row.height+12;
      }
    }
    node=textNode(frame,'Review the scope, reference permissions and accessibility before implementation.',
      36,y+15,{size:12,width:850});
    frame.resize(960,Math.max(760,node.y+node.height+40));
    figma.currentPage.selection=[frame];
    figma.viewport.scrollAndZoomIntoView([frame]);
    return frame;
  }catch(error){
    frame.remove();throw error;
  }
}
figma.ui.onmessage=async msg=>{
  if(msg?.type==='cancel'){figma.closePlugin();return;}
  if(msg?.type!=='import')return;
  try{
    await createEditableHandoff(msg.payload);
    figma.notify('Editable Frontline handoff imported.');
    figma.closePlugin('Approved design handoff imported.');
  }catch(error){
    figma.ui.postMessage({type:'error',message:txt(error.message,220)||'Import failed.'});
  }
};
