/* Figma editable importer. No external requests, tokens, telemetry or chat access. */
figma.showUI(__html__,{width:420,height:380,themeColors:true});
const fontRegular={family:'Inter',style:'Regular'};
const fontBold={family:'Inter',style:'Bold'};
const txt=(value,max)=>String(value||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
function checked(payload){
  if(!payload||payload.format!=='frontline-design-handoff'||payload.schemaVersion!==1)
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
  node.characters=txt(text,1200);
  node.resize(width,Math.max(22,Math.ceil(node.characters.length/65)*size*1.75));
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
    textNode(frame,'FRONTLINE / APPROVED DESIGN HANDOFF',36,y,{bold:true,size:15});
    y+=40;
    textNode(frame,txt(data.project.title,100),36,y,{bold:true,size:27});
    y+=47;
    textNode(frame,'Brief: '+txt(data.project.brief,250),36,y,{size:13,width:880});
    y+=74;
    if(data.project.approvedRefinement){
      textNode(frame,'Approved refinement: '+txt(data.project.approvedRefinement,240),36,y,{size:13,width:880});
      y+=54;
    }
    const directions=(data.directions||[]).slice(0,3);
    if(directions.length){
      textNode(frame,'SELECTED VISUAL DIRECTIONS',36,y,{bold:true,size:14});y+=28;
      for(const direction of directions){
        textNode(frame,txt(direction.name,60)+' — '+txt(direction.layout,90),36,y,{size:12,width:880});
        const colors=(Array.isArray(direction.palette)?direction.palette:[]).slice(0,5);
        let x=620;
        for(const color of colors){
          const fill=rgb(color);
          if(!fill)continue;
          const swatch=figma.createRectangle();
          frame.appendChild(swatch);swatch.resize(24,18);swatch.x=x;swatch.y=y;
          swatch.fills=[{type:'SOLID',color:fill}];x+=31;
        }
        y+=34;
      }
    }
    for(const [key,label] of [
      ['pages','APPROVED PAGES'],
      ['decisions','APPROVED DESIGN DECISIONS'],
      ['inspirations','APPROVED INSPIRATION NOTES']
    ]){
      const cards=data.approved[key];
      if(!cards.length)continue;
      y+=12;textNode(frame,label,36,y,{bold:true,size:15});y+=31;
      for(const card of cards){
        const row=figma.createFrame();
        frame.appendChild(row);row.resize(888,Math.max(66,card.notes?85:66));
        row.x=36;row.y=y;row.cornerRadius=12;
        row.fills=[{type:'SOLID',color:{r:1,g:1,b:1}}];
        textNode(row,txt(card.title,100),16,10,{bold:true,size:13,width:850});
        if(card.notes)textNode(row,txt(card.notes,290),16,37,{size:11,width:850});
        y+=row.height+12;
      }
    }
    textNode(frame,'Review the scope, reference permissions and accessibility before implementation.',
      36,y+15,{size:12,width:850});
    frame.resize(960,Math.max(760,y+95));
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
