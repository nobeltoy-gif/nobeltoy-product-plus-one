const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'NT$'+Number(n||0).toLocaleString('zh-TW');
const nowTW=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,16);
const status=c=>!c.enabled?'已提前關閉':nowTW()<c.starts?'尚未開始':nowTW()>=c.ends?'已截止':'集單中';
function notice(message,type=''){$('message').textContent=message;$('message').className='notice '+type;$('message').scrollIntoView({behavior:'smooth',block:'center'});}
let bridgeSource=null,bridgeOrigin='',bridgeReady=null,bridgeChannel=crypto.randomUUID();
const requests=new Map();
window.addEventListener('message',e=>{
  let host;try{host=new URL(e.origin).hostname;}catch(_){return;}
  if(host!=='script.google.com'&&!host.endsWith('.googleusercontent.com'))return;
  if(e.data?.channel!==bridgeChannel)return;
  if(e.data.type==='NOB_READY'&&!bridgeSource){bridgeSource=e.source;bridgeOrigin=e.origin;bridgeReady?.resolve();return;}
  if(e.data.type==='NOB_RESULT'&&bridgeSource===e.source&&bridgeOrigin===e.origin){
    const pending=requests.get(e.data.id);if(!pending)return;requests.delete(e.data.id);
    if(e.data.ok)pending.resolve(e.data.data);else pending.reject(Error(e.data.error||'資料服務回應失敗'));
  }
});
function ready(){
  if(bridgeReady)return bridgeReady.promise;
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(window.NOB_BRIDGE_URL||'')||window.NOB_BRIDGE_URL.includes('REPLACE-ME'))return Promise.reject(Error('資料服務網址尚未設定'));
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});bridgeReady={promise,resolve,reject};
  const frame=document.createElement('iframe');frame.title='集單資料連線';frame.hidden=true;frame.style.display='none';
  frame.src=window.NOB_BRIDGE_URL+'?bridge=1&channel='+encodeURIComponent(bridgeChannel);
  document.body.append(frame);
  setTimeout(()=>{if(!bridgeSource)reject(Error('無法連上資料服務，請檢查 Apps Script 部署權限'))},20000);
  return promise;
}
async function call(action,payload={}){
  await ready();const id=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
    requests.set(id,{resolve,reject});
    bridgeSource.postMessage({type:'NOB_CALL',channel:bridgeChannel,id,action,payload},bridgeOrigin);
    setTimeout(()=>{if(requests.has(id)){requests.delete(id);reject(Error('資料服務逾時，請稍後重試'))}},25000);
  });
}
function setTitle(title){$('siteTitle').textContent=title;document.title=title;}
