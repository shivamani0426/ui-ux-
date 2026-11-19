import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReactBitsPublisherSitemap,rankReactBitsOriginalComponents} from '../reactbits-official.mjs';

test('actual sitemap structure gives exact publisher component links',()=>{
  const xml='<?xml version="1.0"?><urlset>'+
    '<url><loc>https://reactbits.dev/micro/prompt-bar</loc></url>'+
    '<url><loc>https://reactbits.dev/text-animations/tech-text</loc></url>'+
    '<url><loc>https://reactbits.dev/get-started/mcp</loc></url>'+
    '<url><loc>https://evil.reactbits.dev/micro/prompt-bar</loc></url>'+
    '</urlset>';
  const entries=parseReactBitsPublisherSitemap(xml);
  assert.equal(entries.length,2);
  const hits=rankReactBitsOriginalComponents('interactive prompt bar',entries);
  assert.equal(hits[0].site,'https://reactbits.dev/micro/prompt-bar');
  assert.equal(hits[0].originalPrompt,null);
});
test('official sitemap validation fails closed on missing entries',()=>{
  assert.throws(()=>parseReactBitsPublisherSitemap('<urlset><url/></urlset>'),/no original URLs/);
  assert.deepEqual(parseReactBitsPublisherSitemap(
    '<urlset><url><loc>https://reactbits.dev/sign-in</loc></url></urlset>'),[]);
});
