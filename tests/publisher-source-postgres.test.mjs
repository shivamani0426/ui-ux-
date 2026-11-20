import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from 'pg';
import {
  sourceCategory,normalizedPublisherSourceRows,
  snapshotPublisherReferences,persistDiscoveredPublisherSources
} from '../publisher-source-persistence.mjs';

const app={
  id:'live_publisher_screen_1',name:'Railway passenger claim dashboard',
  site:'https://screenrove.com/railway/product/claims-dashboard',
  provider:'Screenrove',publisherVerified:true,
  designType:'application-ui',sourceKind:'inspiration'
};
const landing={
  id:'live_publisher_screen_2',name:'Lost and found public homepage',
  site:'https://screenrove.com/railway/marketing/recovery-home',
  provider:'Screenrove',publisherVerified:true,
  designType:'landing-page',sourceKind:'inspiration'
};
const comp={
  id:'live_official_component_3',name:'Animated List',
  site:'https://reactbits.dev/components/animated-list',
  provider:'React Bits',sourceKind:'animation',originalPrompt:null
};
test('publisher snapshots preserve required category and old persisted messages gain a safe derived category',()=>{
  const snapshot=snapshotPublisherReferences({
    applicationMatches:[app],
    landingMatches:[landing]
  });
  assert.ok(snapshot);
  assert.equal(snapshot.applicationMatches[0].category,'Original application UI');
  assert.equal(snapshot.landingMatches[0].category,'Original landing page');
  assert.equal(sourceCategory({...app,category:'  '}),'Original application UI');
  assert.equal(sourceCategory({...app,category:'Source from publisher'}),'Source from publisher');
  assert.equal(sourceCategory(comp),'Original component / animation');
  const oldMessageReferences=[{...app,category:undefined},{...landing,category:null},comp];
  const normalized=normalizedPublisherSourceRows(oldMessageReferences);
  assert.deepEqual(normalized.map(x=>x.category),[
    'Original application UI','Original landing page','Original component / animation'
  ]);
  assert.ok(normalized.every(x=>x.category&&typeof x.category==='string'));
});
test('publisher database write uses normalized non-null categories, never null from old Yes reply',async()=>{
  const captures=[];
  const db={query:async(sql,args)=>{
    assert.match(sql,/INSERT INTO frontline\.design_sources/);
    assert.match(sql,/ON CONFLICT/);
    const rows=JSON.parse(args[0]);
    if(rows.some(x=>!x.category))throw Error('null value in column "category" violates not-null constraint');
    captures.push(...rows);
    return {rowCount:rows.length};
  }};
  const inserted=await persistDiscoveredPublisherSources(db,[{...app,category:undefined},{...landing,category:null},comp]);
  assert.equal(inserted,3);
  assert.deepEqual(captures.map(x=>x.category),[
    'Original application UI','Original landing page','Original component / animation'
  ]);
  assert.equal(await persistDiscoveredPublisherSources(db,[{id:'',name:'invalid',site:'invalid'}]),0);
});
test('real PostgreSQL enforces NOT NULL and accepts previous missing-category publisher records', {
  skip:!process.env.FRONTLINE_TEST_POSTGRES_URL
},async()=>{
  const client=new Client({connectionString:process.env.FRONTLINE_TEST_POSTGRES_URL});
  await client.connect();
  try{
    // This test may only run on its disposable CI database. Never create or
    // drop a table in the user's live Render PostgreSQL.
    const current=(await client.query('SELECT current_database() AS db')).rows[0].db;
    assert.equal(current,'frontline_qa','Refuse to touch any non-test database');
    await client.query('CREATE SCHEMA frontline');
    await client.query(\`CREATE TABLE frontline.design_sources (
      id text PRIMARY KEY,name text NOT NULL,site text NOT NULL,
      category text NOT NULL,tags text[] NOT NULL DEFAULT ARRAY[]::text[],
      styles text[] NOT NULL DEFAULT ARRAY[]::text[],summary text,
      active boolean NOT NULL DEFAULT true,
      is_live_discovered boolean NOT NULL DEFAULT true,
      source_provider text,source_kind text,source_indexed_at timestamp with time zone
    )\`);
    // Exact old production failure is reproduced by a direct un-normalized
    // record, then fixed by the same writer the production server calls.
    await assert.rejects(client.query(
      'INSERT INTO frontline.design_sources(id,name,site,category) VALUES($1,$2,$3,$4)',
      ['bad_old_record','Old snapshot','https://screenrove.com/a/product/example',null]
    ),/null value in column "category"/);
    assert.equal(await persistDiscoveredPublisherSources(client,[{...app,category:undefined},{...landing,category:null},comp]),3);
    const check=(await client.query(
      'SELECT id, category FROM frontline.design_sources ORDER BY id'
    )).rows;
    assert.equal(check.length,3);
    assert.ok(check.every(row=>row.category));
    // Old messages remain safe across repeated Yes/index upserts.
    assert.equal(await persistDiscoveredPublisherSources(client,[{...app,category:''}]),1);
    assert.equal((await client.query('SELECT category FROM frontline.design_sources WHERE id=$1',
      [app.id])).rows[0].category,'Original application UI');
  }finally{
    await client.end();
  }
});
