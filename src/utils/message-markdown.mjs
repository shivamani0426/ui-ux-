/**
 * Strict, dependency-free Markdown subset for saved chat messages.
 * All source text stays data: never use HTML injection or arbitrary URLs.
 */
const capped=value=>String(value??'').replace(/\r\n?/g,'\n').slice(0,16000);
const isHeading=line=>/^\\?#{1,5} +\S/.test(line);
const isBullet=line=>/^ {0,3}[-*+] +\S/.test(line);
const isNumbered=line=>/^ {0,3}\d{1,3}\. +\S/.test(line);
const isQuote=line=>/^ {0,3}> +\S/.test(line);
const isFence=line=>/^ {0,3}\x60{3}/.test(line);
const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'')
  .replace(/\\\|/g,'\u0001').split('|').map(s=>s.replace(/\u0001/g,'|').trim());
const isRule=line=>/^\s*:?-{3,}:?\s*$/.test(line);
const isTable=(lines,index)=>{
  if(index+1>=lines.length||!lines[index].includes('|')||!lines[index+1].includes('|'))return false;
  const a=cells(lines[index]),b=cells(lines[index+1]);
  return a.length>1&&a.length===b.length&&b.every(isRule);
};
const isBlockStart=(lines,i)=>isHeading(lines[i])||isFence(lines[i])||
  isBullet(lines[i])||isNumbered(lines[i])||isQuote(lines[i])||isTable(lines,i);

export function parseInlineMarkdown(value){
  const input=String(value??'').slice(0,16000),parts=[];
  const pattern=/(\*\*[^*\n]+\*\*|__[^_\n]+__|\x60[^\x60\n]+\x60|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|\*[^*\n]+\*)/g;
  let last=0,match;
  while((match=pattern.exec(input))){
    if(match.index>last)parts.push({type:'text',text:input.slice(last,match.index)});
    const token=match[0];
    if(token.startsWith('**')||token.startsWith('__'))parts.push({type:'strong',text:token.slice(2,-2)});
    else if(token.startsWith('\x60'))parts.push({type:'code',text:token.slice(1,-1)});
    else if(token.startsWith('*'))parts.push({type:'em',text:token.slice(1,-1)});
    else if(token.startsWith('[')){
      const pivot=token.lastIndexOf(']('),url=token.slice(pivot+2,-1);
      if(/^https?:\/\/[^\s<>]*$/i.test(url))parts.push({type:'link',text:token.slice(1,pivot),url});
      else parts.push({type:'text',text:token});
    }else parts.push({type:'text',text:token});
    last=pattern.lastIndex;
  }
  if(last<input.length)parts.push({type:'text',text:input.slice(last)});
  return parts;
}
export function parseMessageMarkdown(value){
  const lines=capped(value).split('\n').slice(0,450),blocks=[];
  let i=0;
  while(i<lines.length){
    if(!lines[i].trim()){i++;continue}
    const line=lines[i];
    if(isFence(line)){
      const language=line.replace(/^ {0,3}\x60{3}/,'').trim().slice(0,25);
      const code=[];i++;
      while(i<lines.length&&!isFence(lines[i]))code.push(lines[i++]);
      if(i<lines.length)i++;
      blocks.push({type:'code',language,text:code.join('\n')});
      continue;
    }
    if(isTable(lines,i)){
      const headers=cells(lines[i]);i+=2;const rows=[];
      while(i<lines.length&&lines[i].trim()&&lines[i].includes('|')&&rows.length<35){
        rows.push(cells(lines[i]).slice(0,headers.length));i++;
      }
      blocks.push({type:'table',headers,rows});continue;
    }
    if(isHeading(line)){
      const normalized=line.replace(/^\\/,'');
      const match=normalized.match(/^(#{1,5}) +(.+)$/);
      blocks.push({type:'heading',level:Math.min(4,Math.max(2,match[1].length)),text:match[2]});i++;continue;
    }
    if(isBullet(line)||isNumbered(line)){
      const numbered=isNumbered(line),items=[];
      const pattern=numbered?/^ {0,3}\d{1,3}\. +/:/^ {0,3}[-*+] +/;
      while(i<lines.length&&(numbered?isNumbered(lines[i]):isBullet(lines[i]))&&items.length<70){
        items.push(lines[i].replace(pattern,''));i++;
      }
      blocks.push({type:numbered?'ordered':'list',items});continue;
    }
    if(isQuote(line)){
      const chunks=[];
      while(i<lines.length&&isQuote(lines[i]))chunks.push(lines[i++].replace(/^ {0,3}> +/,''));
      blocks.push({type:'quote',text:chunks.join(' ')});continue;
    }
    const para=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!isBlockStart(lines,i)){para.push(lines[i++]);}
    blocks.push({type:'paragraph',text:para.join('\n')});
  }
  return blocks;
}
