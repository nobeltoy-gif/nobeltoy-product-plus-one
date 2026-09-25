let campaigns=[],stores=[],current=null;
async function refresh(){
  try{const data=await call('public');setTitle(data.title);campaigns=data.campaigns;stores=data.stores;
    $('store').innerHTML='<option value="">請選擇門市</option>'+stores.map(s=>`<option value="${safe(s)}">${safe(s)}</option>`).join('');
    $('campaigns').innerHTML=campaigns.length?campaigns.map((c,i)=>`<div class="bar"><div><strong>${safe(c.title)}</strong> <span class="tag">${status(c)}</span><div class="muted">${safe(showTime(c.starts))} ～ ${safe(showTime(c.ends))}</div></div><button type="button" data-open="${i}">查看商品</button></div>`).join(''):'目前沒有集單活動。';
    if(current){const c=campaigns.find(x=>x.id===current.id);if(c)openCampaign(c.id);else $('orderArea').classList.add('hidden');}
  }catch(e){notice(e.message,'error');$('campaigns').textContent='無法載入集單資料';}
}
function openCampaign(id){current=campaigns.find(x=>x.id===id);if(!current)return;
  $('orderArea').classList.remove('hidden');$('shopTitle').textContent=current.title;$('shopDescription').textContent=current.description||'';
  $('shopTime').textContent=`${showTime(current.starts)} ～ ${showTime(current.ends)}｜${status(current)}`;
  const active=status(current)==='集單中';
  $('shopProducts').innerHTML=current.products.map(p=>`<div class="card">${p.image?`<img class="thumb" src="${safe(p.image)}" alt="${safe(p.name)}" onerror="this.style.display='none'">`:''}<h3>${safe(p.name)}</h3><p>${safe(p.intro).replace(/\n/g,'<br>')}</p><div class="price">批價 ${money(p.cost)}</div><div class="muted">預計零售價 ${money(p.retail)} · 預計月租金 ${money(p.rent)}</div>${p.url?`<p><a href="${safe(p.url)}" target="_blank" rel="noopener noreferrer">採購參考連結</a></p>`:''}<label>訂購數量</label><input class="qty" data-id="${safe(p.id)}" type="number" min="0" step="1" value="0" ${active?'':'disabled'}></div>`).join('');
  $('submitOrder').disabled=!active;$('receiptPanel').classList.add('hidden');syncCode();calculate();
}
function calculate(){if(!current)return;const qty=new Map([...document.querySelectorAll('.qty')].map(x=>[x.dataset.id,Number(x.value)||0]));$('orderTotal').textContent='訂單合計 '+money(current.products.reduce((n,p)=>n+(qty.get(p.id)||0)*p.cost,0));}
function orderKey(){return current&&$('store').value?`nob02-${current.id}-${$('store').value}`:'';}
function syncCode(){$('lookupCode').value=orderKey()?sessionStorage.getItem(orderKey())||'':'';$('receiptPanel').classList.add('hidden');}
function showReceipt(order,code){
  $('receiptPanel').innerHTML=receiptMarkup(current,order,code)+'<div class="actions"><button id="downloadOrder" type="button">下載訂單明細</button></div>';
  $('receiptPanel').classList.remove('hidden');$('downloadOrder').addEventListener('click',()=>downloadReceipt(current,order,code));
  $('receiptPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
async function submitOrder(){try{
  if(!current||status(current)!=='集單中')throw Error('集單未開始或已截止');
  const store=$('store').value;if(!store||!stores.includes(store))throw Error('請選擇門市');
  const items=[...document.querySelectorAll('.qty')].map(x=>({productId:x.dataset.id,qty:Number(x.value)}));
  if(items.some(i=>!Number.isSafeInteger(i.qty)||i.qty<0||i.qty>100000)||!items.some(i=>i.qty>0))throw Error('請至少訂購一件，數量須為非負整數');
  const key=orderKey(),code=$('lookupCode').value.trim();
  const result=await call('placeOrder',{order:{campaignId:current.id,store,items,note:$('orderNote').value.trim(),code}});
  $('lookupCode').value=result.code;sessionStorage.setItem(key,result.code);
  const order=await call('getOrder',{campaignId:current.id,store,code:result.code});
  if(!order)throw Error(`送單已成功，訂單編號 ${result.id}、查詢碼 ${result.code}。明細讀取失敗，請先保存查詢碼後重試查詢。`);
  showReceipt(order,result.code);notice('送單成功，明細已與總部同步。請下載並保存訂單明細。','success');
}catch(e){notice(e.message,'error');}}
async function loadOrder(){try{
  if(!current||!$('store').value)throw Error('請先選擇門市');
  const code=$('lookupCode').value.trim();if(!code)throw Error('請輸入訂單明細上的查詢碼');
  const store=$('store').value,o=await call('getOrder',{campaignId:current.id,store,code:code.trim()});
  if(!o)throw Error('查無相符訂單，請確認門市與查詢碼');
  sessionStorage.setItem(orderKey(),code);
  $('orderNote').value=o.note||'';document.querySelectorAll('.qty').forEach(x=>x.value=o.items.find(i=>i.productId===x.dataset.id)?.qty||0);
  calculate();showReceipt(o,code);notice(status(current)==='集單中'?'已載入原訂單；截止前可修改並重新送出。':'已載入原訂單；目前無法修改。','success');
}catch(e){notice(e.message,'error');}}
$('campaigns').addEventListener('click',e=>{const btn=e.target.closest('[data-open]');if(btn)openCampaign(campaigns[Number(btn.dataset.open)]?.id);});
$('shopProducts').addEventListener('input',e=>{if(e.target.classList.contains('qty'))calculate();});
$('store').addEventListener('change',syncCode);
$('submitOrder').addEventListener('click',submitOrder);$('loadOrder').addEventListener('click',loadOrder);refresh();
