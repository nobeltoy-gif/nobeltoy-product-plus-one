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
const showTime=s=>{const value=String(s||'');return /Z$|[+-]\d\d:\d\d$/.test(value)?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):value.replace('T',' ');};
function receiptMarkup(c,o,code=''){
  const rows=(o.items||[]).filter(item=>Number(item.qty)>0).map(item=>{
    const p=c.products.find(p=>p.id===item.productId),name=item.name||p?.name||'已移除商品';
    const cost=Number(item.cost??p?.cost??0),qty=Number(item.qty);
    return `<tr><td>${safe(name)}</td><td class="num">${qty}</td><td class="num">${money(cost)}</td><td class="num">${money(cost*qty)}</td></tr>`;
  });
  const total=(o.items||[]).reduce((sum,item)=>{const p=c.products.find(p=>p.id===item.productId);return sum+Number(item.qty||0)*Number(item.cost??p?.cost??0)},0);
  return `<h2>訂單明細</h2><p><strong>活動：</strong>${safe(c.title)}<br><strong>門市：</strong>${safe(o.store)}<br><strong>訂單編號：</strong>${safe(o.id)}<br><strong>更新時間：</strong>${safe(showTime(o.updated))}</p>${code?`<p><strong>訂單查詢碼：</strong><span class="receipt-code">${safe(code)}</span><br><small>請保存此碼，日後查詢或修改訂單時使用。</small></p>`:''}<div class="scroll"><table><thead><tr><th>商品</th><th class="num">數量</th><th class="num">批價</th><th class="num">小計</th></tr></thead><tbody>${rows.join('')}</tbody></table></div><p class="receipt-total"><strong>合計 ${money(total)}</strong></p><p><strong>備註：</strong><span class="receipt-note">${safe(o.note||'無')}</span></p><p class="muted">此明細為 ${safe(showTime(o.updated))} 的訂單紀錄；修改訂單後請重新下載。</p>`;
}
function downloadReceipt(c,o,code=''){
  const body=receiptMarkup(c,o,code);
  const html=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>訂單明細 ${safe(o.store)}</title><style>body{font:16px system-ui,'Noto Sans TC',sans-serif;color:#243447;max-width:850px;margin:32px auto;padding:0 18px}h2{color:#16577a}.receipt-code{font-size:20px;font-weight:bold;overflow-wrap:anywhere}.receipt-total{text-align:right;font-size:20px}.receipt-note{white-space:pre-wrap}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left}.num{text-align:right}.muted{color:#66798a;font-size:13px}</style></head><body>${body}</body></html>`;
  const link=document.createElement('a'),url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
  link.href=url;link.download=`${String(c.title+'_'+o.store).replace(/[\\/:*?"<>|]/g,'_')}_訂單明細.html`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
