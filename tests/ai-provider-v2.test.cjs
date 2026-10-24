const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chat}=require('../server/integrations.cjs');
function withMockEnv(env,fetchStub,fn){
 const names=Object.keys(env);const before=Object.fromEntries(names.map(n=>[n,process.env[n]]));
 const original=global.fetch;
 Object.entries(env).forEach(([k,v])=>v===undefined?delete process.env[k]:process.env[k]=v);
 global.fetch=fetchStub;
 return Promise.resolve().then(fn).finally(()=>{global.fetch=original;for(const name of names){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}});
}
test('Local Ollama mode calls local /api/chat and succeeds without a key',async()=>{
 let called='';
 await withMockEnv({AI_PROVIDER:'ollama',OLLAMA_BASE_URL:'http://127.0.0.1:11434',OLLAMA_MODEL:'llama3.2:3b'},async (url,opts)=>{
  called=url;assert.equal(opts.headers.Authorization,undefined);
  assert.equal(JSON.parse(opts.body).model,'llama3.2:3b');
  return {ok:true,json:async()=>({message:{content:'4'}})};
 },async()=>assert.equal(await chat([{role:'user',content:'2+2?'}]),'4'));
 assert.equal(called,'http://127.0.0.1:11434/api/chat');
});
test('Auto mode tries local then configured cloud model with server-side key',async()=>{
 const calls=[];
 await withMockEnv({AI_PROVIDER:'auto',OLLAMA_BASE_URL:'http://localhost:11434',OLLAMA_MODEL:'llama3.2:3b',CLOUD_AI_BASE_URL:'https://ollama.com',CLOUD_AI_API_KEY:'test-private-key',CLOUD_AI_MODEL:'cloud-model'},async (url,opts)=>{
  calls.push({url,opts});
  if(String(url).startsWith('http:'))throw Error('Local unreachable');
  assert.equal(opts.headers.Authorization,'Bearer test-private-key');
  assert.equal(JSON.parse(opts.body).model,'cloud-model');
  return {ok:true,json:async()=>({message:{content:'Cloud response'}})};
 },async()=>assert.equal(await chat([{role:'user',content:'Hello'}]),'Cloud response'));
 assert.equal(calls.length,2);
});
test('AI off mode does not make any request',async()=>{
 await withMockEnv({AI_PROVIDER:'off'},()=>{throw Error('Unexpected request');},async()=>assert.rejects(()=>chat([{role:'user',content:'Hello'}]),/disabled/));
});
