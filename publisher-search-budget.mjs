import crypto from 'node:crypto';

// Small, bounded process-local protection for the official Kage MCP.
// Per-visitor fairness prevents one visitor from exhausting every other
// visitor's shared publisher searches. Repeated queries still hit the cache.
const WINDOW_MS=60*60*1000;
const PER_VISITOR=30;
const GLOBAL=240; // Backstop for publisher protection, not 12 shared requests.
const buckets=new Map();
let globalBucket={start:null,count:0};
const hash=visitor=>crypto.createHash('sha256')
  .update(String(visitor||'guest').slice(0,200)).digest('hex').slice(0,24);
export function claimPublisherSearch(visitor,{now=Date.now()}={}){
  if(globalBucket.start===null||now-globalBucket.start>=WINDOW_MS||now<globalBucket.start)
    globalBucket={start:now,count:0};
  // Only retain active visitor windows. Never persist raw visitor identifiers.
  for(const [key,value] of buckets){
    if(now-value.start>=WINDOW_MS||now<value.start)buckets.delete(key);
  }
  const key=hash(visitor);
  const current=buckets.get(key)||{start:now,count:0};
  const denied=current.count>=PER_VISITOR||globalBucket.count>=GLOBAL;
  if(denied){
    const resetAt=(current.count>=PER_VISITOR?current.start:globalBucket.start)+WINDOW_MS;
    const until=Math.max(1,Math.ceil((resetAt-now)/1000));
    return {allowed:false,retryAfterSeconds:until,scope:
      current.count>=PER_VISITOR?'visitor':'publisher'};
  }
  current.count++;globalBucket.count++;buckets.set(key,current);
  return {allowed:true};
}
export function clearPublisherSearchBudgetForTests(){
  buckets.clear();globalBucket={start:null,count:0};
}
