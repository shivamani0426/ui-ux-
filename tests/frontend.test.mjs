import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {server} from '../server.mjs';

test('Vite frontend, exact React Bits assets and SPA fallback',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const response=await fetch(base+'/');
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-type')||'',/text\/html/);
    const markup=await response.text();
    assert.match(markup,/<div id="root"/);
    const js=markup.match(/src="(\/assets\/[^"]+\.js)"/);
    const css=markup.match(/href="(\/assets\/[^"]+\.css)"/);
    assert.ok(js,'Vite generated JS bundle should be linked');
    assert.ok(css,'Vite generated CSS bundle should be linked');
    for(const asset of [js[1],css[1]]){
      const result=await fetch(base+asset);
      assert.equal(result.status,200,asset+' must load');
      assert.ok((await result.text()).length>100,'Asset must contain code');
    }
    const spa=await fetch(base+'/studio');
    assert.equal(spa.status,200,'SPA URLs should resolve');
    assert.match(await spa.text(),/<div id="root"/);
    const health=await (await fetch(base+'/api/health')).json();
    assert.equal(health.status,'ok');
    const unknown=await fetch(base+'/untrusted.js');
    assert.equal(unknown.status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('chat-first frontend uses upstream React Bits and keeps features accessible',async()=>{
  const app=await fs.readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
  const components=await Promise.all(['TechText.jsx','StarBorder.jsx'].map(x=>fs.readFile(new URL('../src/components/'+x,import.meta.url),'utf8')));
  assert.match(app,/<StarBorder/);
  assert.match(app,/<TechText/);
  assert.match(app,/Select all three/);
  assert.match(app,/Switch to /);
  assert.match(app,/composer-position/);
  assert.match(app,/floating/);
  assert.match(app,/Save feedback/);
  for(const content of components)assert.match(content,/'use client'/);
});
