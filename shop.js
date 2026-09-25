let campaigns=[],stores=[],current=null;
async function refresh(){
  try{const data=await call('public');setTitle(data.title);campaigns=data.campaigns;stores=data.stores;
    $('store').innerHTML='<option value="">請選擇門市</option>'+stores.map(s=>`<option value="${safe(s)}">${safe(s)}</option>`).join('');
    $('campaigns').innerHTML=campaigns.length?campaigns.map((c,i)=>`<div class="bar"><div><strong>${safe(c.title)}</strong> <span class="tag">${status(c)}</span><div class="muted">${safe(c.starts)} ～ ${safe(c.ends)}</div></div><button type="button" data-open="${i}">查看商品</button></div>`).join(''):'目前沒有集單活動。';
    if(current){const c=campaigns.find(x=>x.id===current.id);if(c)openCampaign(c.id);else $('orderArea').classList.add('hidden');}
  }catch(e){notice(e.message,'error');$('campaigns').textContent='無法載入集單資料';}
}
function openCampaign(id){current=campaigns.find(x=>x.id===id);if(!current)return;
  $('orderArea').classList.remove('hidden');$('shopTitle').textContent=current.title;$('shopDescription').textContent=current.description||'';
  $('shopTime').textContent=`${current.starts} ～ ${current.ends}｜${status(current)}`;
  const active=status(current)==='集單中';
  $('shopProducts').innerHTML=current.products.map(p=>`<div class="card">${p.image?`<img class="thumb" src="${safe(p.image)}" alt="${safe(p.name)}" onerror="this.style.display='none'">`:''}<h3>${safe(p.name)}</h3><p>${safe(p.intro).replace(/\n/g,'<br>')}</p><div class="price">批價 ${money(p.cost)}</div><div class="muted">預計零售價 ${money(p.retail)} · 預計月租金 ${money(p.rent)}</div>${p.url?`<p><a href="${safe(p.url)}" target="_blank" rel="noopener noreferrer">採購參考連結</a></p>`:''}<label>訂購數量</label><input class="qty" data-id="${safe(p.id)}" type="number" min="0" step="1" value="0" ${active?'':'disabled'}></div>`).join('');
  $('submitOrder').disabled=!active;calculate();
}
function calculate(){if(!current)return;const qty=new Map([...document.querySelectorAll('.qty')].map(x=>[x.dataset.id,Number(x.value)||0]));$('orderTotal').textContent='訂單合計 '+money(current.products.reduce((n,p)=>n+(qty.get(p.id)||0)*p.cost,0));}
async function submitOrder(){try{
  if(!current||status(current)!=='集單中')throw Error('集單未開始或已截止');
  const store=$('store').value;if(!store||!stores.includes(store))throw Error('請選擇門市');
  const items=[...document.querySelectorAll('.qty')].map(x=>({productId:x.dataset.id,qty:Number(x.value)}));
  if(items.some(i=>!Number.isSafeInteger(i.qty)||i.qty<0||i.qty>100000)||!items.some(i=>i.qty>0))throw Error('請至少訂購一件，數量須為非負整數');
  const key=`nob02-${current.id}-${store}`;
  const saved=sessionStorage.getItem(key)||'';
  const code=saved||prompt('若本門市曾下單，請輸入原訂單查詢碼；首次下單請留空並按確定')||'';
  const result=await call('placeOrder',{order:{campaignId:current.id,store,items,note:$('orderNote').value.trim(),code}});
  sessionStorage.setItem(key,result.code);
  notice(`送單成功！訂單編號：${result.id}；訂單查詢碼：${result.code}。請記下查詢碼。`,'success');
}catch(e){notice(e.message,'error');}}
async function loadOrder(){try{
  if(!current||!$('store').value)throw Error('請先選擇門市');
  const code=prompt('請輸入本店的訂單查詢碼');if(!code)return;
  const store=$('store').value,o=await call('getOrder',{campaignId:current.id,store,code:code.trim()});
  if(!o)throw Error('查無相符訂單，請確認門市與查詢碼');
  sessionStorage.setItem(`nob02-${current.id}-${store}`,code.trim());
  $('orderNote').value=o.note||'';document.querySelectorAll('.qty').forEach(x=>x.value=o.items.find(i=>i.productId===x.dataset.id)?.qty||0);
  calculate();notice(status(current)==='集單中'?'已載入原訂單；截止前可修改並重新送出。':'已載入原訂單；目前無法修改。','success');
}catch(e){notice(e.message,'error');}}
$('campaigns').addEventListener('click',e=>{const btn=e.target.closest('[data-open]');if(btn)openCampaign(campaigns[Number(btn.dataset.open)]?.id);});
$('shopProducts').addEventListener('input',e=>{if(e.target.classList.contains('qty'))calculate();});
$('submitOrder').addEventListener('click',submitOrder);$('loadOrder').addEventListener('click',loadOrder);refresh();
