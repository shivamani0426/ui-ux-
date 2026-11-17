import React from 'react';
import {parseInlineMarkdown,parseMessageMarkdown} from '../utils/message-markdown.mjs';
import './MessageMarkdown.css';

function Inline({text}){
  return parseInlineMarkdown(text).map((node,i)=>{
    if(node.type==='strong')return <strong key={i}>{node.text}</strong>;
    if(node.type==='em')return <em key={i}>{node.text}</em>;
    if(node.type==='code')return <code key={i}>{node.text}</code>;
    if(node.type==='link')return <a key={i} href={node.url} rel="noopener noreferrer" target="_blank">{node.text}</a>;
    return <React.Fragment key={i}>{node.text}</React.Fragment>;
  });
}
export default function MessageMarkdown({content}){
  const blocks=parseMessageMarkdown(content);
  return <div className="message-markdown">{blocks.map((b,i)=>{
    if(b.type==='heading'){
      const Tag=b.level===2?'h2':b.level===3?'h3':'h4';
      return <Tag key={i}><Inline text={b.text}/></Tag>;
    }
    if(b.type==='code')return <pre key={i} className="md-code" aria-label="Code example"><code>{b.text}</code></pre>;
    if(b.type==='table')return <div className="md-table-scroll" role="region" aria-label="Design comparison table" tabIndex={0} key={i}>
      <table><thead><tr>{b.headers.map((text,j)=><th scope="col" key={j}><Inline text={text}/></th>)}</tr></thead>
      <tbody>{b.rows.map((row,r)=><tr key={r}>{b.headers.map((_,j)=><td key={j}><Inline text={row[j]||''}/></td>)}</tr>)}</tbody></table>
    </div>;
    if(b.type==='list'||b.type==='ordered'){
      const Tag=b.type==='list'?'ul':'ol';
      return <Tag key={i}>{b.items.map((item,j)=><li key={j}><Inline text={item}/></li>)}</Tag>;
    }
    if(b.type==='quote')return <blockquote key={i}><Inline text={b.text}/></blockquote>;
    return <p key={i}><Inline text={b.text}/></p>;
  })}</div>;
}
