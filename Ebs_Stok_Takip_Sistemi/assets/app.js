const DB_KEY = "ebs_stok_json_v1";
const DB_VERSION = 1;

const emptyDB = () => ({
  version: DB_VERSION,
  settings: { businessName: "İşletmem", currency: "₺", lowStock: 5 },
  users: [{ id: crypto.randomUUID(), name: "Yönetici", role: "admin", createdAt: new Date().toISOString() }],
  products: [],
  sales: [],
  creditCustomers: [],
  creditPayments: [],
  suspendedCarts: [],
  updatedAt: new Date().toISOString()
});

let DB = loadDB();
let saveTimer;

function loadDB(){
  try{
    const raw = localStorage.getItem(DB_KEY);
    return raw ? { ...emptyDB(), ...JSON.parse(raw) } : emptyDB();
  }catch(e){
    console.error(e); return emptyDB();
  }
}
function saveDB(message="Otomatik kaydedildi"){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    DB.updatedAt = new Date().toISOString();
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
    updateSaveBadge();
    if(message) toast(message);
  }, 180);
}
function saveNow(message="Kaydedildi"){
  DB.updatedAt = new Date().toISOString();
  localStorage.setItem(DB_KEY, JSON.stringify(DB));
  updateSaveBadge(); if(message) toast(message);
}
function updateSaveBadge(){
  const el=document.querySelector("#saveBadge");
  if(el) el.textContent = "Yerel kayıt: " + new Date(DB.updatedAt).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
}
function toast(msg){
  const el=document.querySelector("#toast"); if(!el) return;
  el.textContent=msg; el.classList.add("show");
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove("show"),2200);
}
function money(v){ return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(Number(v||0)); }
function dt(v){ return new Date(v).toLocaleString("tr-TR"); }
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function today(){return new Date().toISOString().slice(0,10)}
function byId(id){return document.getElementById(id)}
function navInit(){
  const page=document.body.dataset.page;
  document.querySelectorAll(".nav a").forEach(a=>a.classList.toggle("active",a.dataset.page===page));
  byId("mobileMenu")?.addEventListener("click",()=>document.querySelector(".sidebar").classList.toggle("open"));
  document.querySelectorAll(".nav a").forEach(a=>a.addEventListener("click",()=>document.querySelector(".sidebar").classList.remove("open")));
  document.querySelectorAll("[data-business]").forEach(el=>el.textContent=DB.settings.businessName);
  updateSaveBadge();
}
function downloadJSON(){
  saveNow("");
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=`stok-yedek-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
}
function importJSON(file){
  if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const data=JSON.parse(r.result);
      if(!Array.isArray(data.products)||!Array.isArray(data.sales)) throw new Error("Geçersiz dosya");
      DB={...emptyDB(),...data,updatedAt:new Date().toISOString()};
      saveNow("JSON yedeği yüklendi");
      setTimeout(()=>location.reload(),450);
    }catch(e){alert("JSON dosyası okunamadı: "+e.message)}
  }; r.readAsText(file);
}
function resetDB(){
  if(confirm("Tüm yerel veriler silinecek. Devam edilsin mi?")){
    DB=emptyDB(); saveNow("Veriler sıfırlandı"); setTimeout(()=>location.reload(),400);
  }
}
function commonBindings(){
  byId("exportBtn")?.addEventListener("click",downloadJSON);
  byId("importInput")?.addEventListener("change",e=>importJSON(e.target.files[0]));
}
async function compressImage(file,max=420,quality=.78){
  return new Promise((resolve,reject)=>{
    const img=new Image(), reader=new FileReader();
    reader.onload=()=>img.src=reader.result; reader.onerror=reject;
    img.onload=()=>{
      let {width,height}=img; const scale=Math.min(1,max/Math.max(width,height));
      const c=document.createElement("canvas"); c.width=Math.round(width*scale); c.height=Math.round(height*scale);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height); resolve(c.toDataURL("image/jpeg",quality));
    }; reader.readAsDataURL(file);
  });
}
async function startScanner(targetInput,onDetected){
  if(!("BarcodeDetector" in window)){alert("Bu tarayıcı kamera ile barkod okumayı desteklemiyor. Barkodu elle girebilirsiniz.");return;}
  const box=byId("scannerBox"), video=byId("scannerVideo"); box?.classList.add("open");
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});
    video.srcObject=stream; await video.play();
    const detector=new BarcodeDetector({formats:["ean_13","ean_8","code_128","upc_a","upc_e","qr_code"]});
    let active=true;
    const stop=()=>{active=false;stream.getTracks().forEach(t=>t.stop());box.classList.remove("open")};
    byId("stopScanner").onclick=stop;
    const loop=async()=>{
      if(!active)return;
      try{
        const codes=await detector.detect(video);
        if(codes.length){targetInput.value=codes[0].rawValue; stop(); onDetected?.(codes[0].rawValue); return;}
      }catch{}
      requestAnimationFrame(loop);
    }; loop();
  }catch(e){box?.classList.remove("open");alert("Kamera açılamadı: "+e.message)}
}
function productByBarcode(code){return DB.products.find(p=>p.barcode===String(code).trim())}
function stockClass(q){return q<=0?"status-out":q<=DB.settings.lowStock?"status-low":"status-ok"}

function initDashboard(){
  const salesToday=DB.sales.filter(s=>s.createdAt.slice(0,10)===today());
  byId("metricProducts").textContent=DB.products.length;
  byId("metricStock").textContent=DB.products.reduce((a,p)=>a+Number(p.stock||0),0);
  byId("metricToday").textContent=money(salesToday.reduce((a,s)=>a+Number(s.total||0),0));
  byId("metricLow").textContent=DB.products.filter(p=>Number(p.stock)<=DB.settings.lowStock).length;
  const latest=[...DB.sales].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,7);
  byId("latestSales").innerHTML=latest.length?latest.map(s=>`<tr><td>${dt(s.createdAt)}</td><td>${s.items.length}</td><td>${esc(s.paymentType)}</td><td>${money(s.total)}</td></tr>`).join(""):`<tr><td colspan="4" class="empty">Henüz satış kaydı yok.</td></tr>`;
  const lows=DB.products.filter(p=>Number(p.stock)<=DB.settings.lowStock).sort((a,b)=>a.stock-b.stock).slice(0,8);
  byId("lowStocks").innerHTML=lows.length?lows.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.barcode)}</td><td class="${stockClass(p.stock)}">${p.stock}</td></tr>`).join(""):`<tr><td colspan="3" class="empty">Kritik stok bulunmuyor.</td></tr>`;
}

let editingProductId=null;
function initProducts(){
  renderProducts();
  byId("openProductModal").onclick=()=>openProductModal();
  byId("productSearch").oninput=renderProducts;
  byId("productForm").onsubmit=saveProductFromForm;
  byId("productImage").onchange=async e=>{if(e.target.files[0]) byId("imagePreview").src=await compressImage(e.target.files[0])};
  byId("scanProduct").onclick=()=>startScanner(byId("barcode"));
  byId("closeProductModal").onclick=closeProductModal;
}
function openProductModal(p=null){
  editingProductId=p?.id||null; byId("productForm").reset();
  byId("imagePreview").src=p?.image||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='100%25' height='100%25' fill='%23eef2f7'/%3E%3C/svg%3E";
  const map=["barcode","name","purchasePrice","salePrice","stock","productDate","brand","category","vat"];
  map.forEach(k=>{if(byId(k))byId(k).value=p?.[k]??""});
  byId("productModalTitle").textContent=p?"Ürünü Düzenle":"Yeni Ürün";
  byId("productModal").classList.add("open");
}
function closeProductModal(){byId("productModal").classList.remove("open")}
function saveProductFromForm(e){
  e.preventDefault();
  const barcode=byId("barcode").value.trim();
  if(DB.products.some(p=>p.barcode===barcode&&p.id!==editingProductId)){alert("Bu barkod zaten kayıtlı.");return}
  const old=DB.products.find(p=>p.id===editingProductId);
  const p={
    id:editingProductId||crypto.randomUUID(),barcode,name:byId("name").value.trim(),
    purchasePrice:+byId("purchasePrice").value,salePrice:+byId("salePrice").value,stock:+byId("stock").value,
    productDate:byId("productDate").value,image:byId("imagePreview").src,brand:byId("brand").value.trim(),
    category:byId("category").value.trim(),vat:+byId("vat").value,createdAt:old?.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  if(editingProductId) DB.products=DB.products.map(x=>x.id===editingProductId?p:x); else DB.products.push(p);
  saveNow(editingProductId?"Ürün güncellendi":"Ürün eklendi"); closeProductModal(); renderProducts();
}
function renderProducts(){
  const q=(byId("productSearch")?.value||"").toLocaleLowerCase("tr");
  const rows=DB.products.filter(p=>[p.name,p.barcode,p.brand,p.category].join(" ").toLocaleLowerCase("tr").includes(q));
  byId("productsBody").innerHTML=rows.length?rows.map(p=>`<tr>
   <td><img class="product-thumb" src="${p.image||""}" alt=""></td><td><strong>${esc(p.name)}</strong><br><small>${esc(p.barcode)}</small></td>
   <td>${esc(p.brand||"-")}</td><td>${esc(p.category||"-")}</td><td>${money(p.purchasePrice)}</td><td>${money(p.salePrice)}</td>
   <td class="${stockClass(p.stock)}">${p.stock}</td><td>${p.vat}%</td><td>${new Date(p.createdAt).toLocaleDateString("tr-TR")}</td>
   <td><button class="btn btn-secondary" onclick="editProduct('${p.id}')">Düzenle</button> <button class="btn btn-danger" onclick="deleteProduct('${p.id}')">Sil</button></td></tr>`).join(""):`<tr><td colspan="10" class="empty">Ürün bulunamadı.</td></tr>`;
}
window.editProduct=id=>openProductModal(DB.products.find(p=>p.id===id));
window.deleteProduct=id=>{if(confirm("Ürün silinsin mi?")){DB.products=DB.products.filter(p=>p.id!==id);saveNow("Ürün silindi");renderProducts()}};

let carts=[{id:crypto.randomUUID(),name:"Müşteri 1",items:[]}],activeCart=0,paymentType="Nakit";
function initSales(){
  renderCartTabs(); renderCart(); renderTouchProducts();
  byId("addBarcode").onclick=()=>addBarcode(byId("saleBarcode").value);
  byId("saleBarcode").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();addBarcode(e.target.value)}});
  byId("scanSale").onclick=()=>startScanner(byId("saleBarcode"),addBarcode);
  byId("priceCheck").onclick=()=>priceCheck(byId("saleBarcode").value);
  byId("newCustomer").onclick=()=>{carts.push({id:crypto.randomUUID(),name:`Müşteri ${carts.length+1}`,items:[]});activeCart=carts.length-1;renderCartTabs();renderCart()};
  document.querySelectorAll(".pay-tabs button").forEach(b=>b.onclick=()=>{paymentType=b.dataset.pay;document.querySelectorAll(".pay-tabs button").forEach(x=>x.classList.toggle("active",x===b));toggleCredit()});
  byId("completeSale").onclick=completeSale;
  byId("givenMoney").oninput=renderTotals;
  refreshCreditCustomerSelect();
  byId("creditCustomerSelect")?.addEventListener("change", e=>{
    const customer=DB.creditCustomers.find(c=>c.id===e.target.value);
    if(customer){
      byId("creditName").value=customer.name||"";
      byId("creditPhone").value=customer.phone||"";
    }
  });
}
function currentCart(){return carts[activeCart]}
function addBarcode(code){
  const p=productByBarcode(code); if(!p){toast("Ürün bulunamadı");return}
  if(p.stock<=0){alert("Bu ürün stokta yok.");return}
  const item=currentCart().items.find(i=>i.productId===p.id);
  if(item){if(item.qty>=p.stock){toast("Stok sınırına ulaşıldı");return}item.qty++}
  else currentCart().items.push({productId:p.id,barcode:p.barcode,name:p.name,price:+p.salePrice,qty:1,brand:p.brand,category:p.category,vat:p.vat});
  byId("saleBarcode").value="";renderCart();renderCartTabs();
}
function priceCheck(code){
  const p=productByBarcode(code);
  alert(p?`${p.name}\nSatış fiyatı: ${money(p.salePrice)}\nStok: ${p.stock}`:"Ürün bulunamadı.");
}
function renderTouchProducts(){
  byId("touchProducts").innerHTML=DB.products.slice(0,16).map(p=>`<button class="touch-product" onclick="addBarcode('${p.barcode}')"><strong>${esc(p.name)}</strong><span>${money(p.salePrice)}</span><br><small>Stok: ${p.stock}</small></button>`).join("");
}
window.addBarcode=addBarcode;
function renderCartTabs(){
  byId("customerTabs").innerHTML=carts.map((c,i)=>`<button class="${i===activeCart?"active":""}" onclick="switchCart(${i})">${c.name} (${c.items.reduce((a,x)=>a+x.qty,0)})</button>`).join("");
}
window.switchCart=i=>{activeCart=i;renderCartTabs();renderCart()};
window.changeQty=(idx,d)=>{
  const it=currentCart().items[idx],p=DB.products.find(x=>x.id===it.productId);
  if(d>0&&it.qty>=p.stock){toast("Yeterli stok yok");return}
  it.qty+=d;if(it.qty<=0)currentCart().items.splice(idx,1);renderCart();renderCartTabs();
};
window.removeCartItem=i=>{currentCart().items.splice(i,1);renderCart();renderCartTabs()};
function renderCart(){
  const c=currentCart();
  byId("cartList").innerHTML=c.items.length?c.items.map((it,i)=>`<div class="cart-item">
   <div><strong>${esc(it.name)}</strong><br><small>${esc(it.barcode)} · ${money(it.price)}</small></div>
   <div class="qty"><button onclick="changeQty(${i},-1)">−</button><b>${it.qty}</b><button onclick="changeQty(${i},1)">+</button></div>
   <strong>${money(it.price*it.qty)}</strong><button class="icon-btn remove" onclick="removeCartItem(${i})">×</button></div>`).join(""):`<div class="empty">Barkod okutarak veya ürün kartına dokunarak satışa başlayın.</div>`;
  renderTotals();
}
function totals(){
  const subtotal=currentCart().items.reduce((a,i)=>a+i.price*i.qty,0);
  const vat=currentCart().items.reduce((a,i)=>a+(i.price*i.qty)*(i.vat/(100+i.vat||1)),0);
  return{subtotal,vat,total:subtotal};
}
function renderTotals(){
  const t=totals();byId("subtotal").textContent=money(t.subtotal);byId("vatTotal").textContent=money(t.vat);byId("grandTotal").textContent=money(t.total);
  const given=+byId("givenMoney").value||0;byId("changeMoney").textContent=money(Math.max(0,given-t.total));
}
function refreshCreditCustomerSelect(){
  const select=byId("creditCustomerSelect"); if(!select) return;
  select.innerHTML='<option value="">Yeni / kayıtlı olmayan müşteri</option>'+
    DB.creditCustomers.map(c=>`<option value="${c.id}">${esc(c.name)}${c.phone?" · "+esc(c.phone):""}</option>`).join("");
}
function toggleCredit(){
  byId("creditFields").style.display=paymentType==="Veresiye"?"grid":"none";
  if(paymentType==="Veresiye") refreshCreditCustomerSelect();
}
function completeSale(){
  const c=currentCart(),t=totals();if(!c.items.length){alert("Sepet boş.");return}
  if(paymentType==="Nakit"&&(+byId("givenMoney").value||0)<t.total){alert("Verilen para toplam tutardan düşük.");return}
  let creditCustomerId="";
  let customerName=byId("creditName").value.trim(), customerPhone=byId("creditPhone").value.trim();
  if(paymentType==="Veresiye"){
    creditCustomerId=byId("creditCustomerSelect")?.value||"";
    if(!customerName){alert("Veresiye satış için müşteri adı zorunludur.");return}
    if(!creditCustomerId){
      const existing=DB.creditCustomers.find(x=>x.phone&&customerPhone&&x.phone===customerPhone);
      if(existing) creditCustomerId=existing.id;
      else{
        const customer={id:crypto.randomUUID(),name:customerName,phone:customerPhone,address:"",note:"Satış ekranından otomatik oluşturuldu",createdAt:new Date().toISOString()};
        DB.creditCustomers.push(customer); creditCustomerId=customer.id;
      }
    }
  }
  const sale={id:crypto.randomUUID(),items:structuredClone(c.items),paymentType,total:t.total,subtotal:t.subtotal,vat:t.vat,
   givenMoney:+byId("givenMoney").value||0,change:Math.max(0,(+byId("givenMoney").value||0)-t.total),
   customerName,customerPhone,creditCustomerId,createdAt:new Date().toISOString()};
  sale.items.forEach(it=>{const p=DB.products.find(x=>x.id===it.productId);if(p)p.stock-=it.qty});
  DB.sales.push(sale);saveNow("Satış tamamlandı");
  carts.splice(activeCart,1);if(!carts.length)carts=[{id:crypto.randomUUID(),name:"Müşteri 1",items:[]}];
  activeCart=Math.max(0,activeCart-1);byId("givenMoney").value="";byId("creditName").value="";byId("creditPhone").value="";
  renderCartTabs();renderCart();renderTouchProducts();
}

function initReports(){
  byId("reportStart").value=today();byId("reportEnd").value=today();
  ["reportStart","reportEnd","reportBrand","reportCategory","reportPayment"].forEach(id=>byId(id).onchange=renderReports);
  const brands=[...new Set(DB.products.map(p=>p.brand).filter(Boolean))];byId("reportBrand").innerHTML='<option value="">Tüm markalar</option>'+brands.map(x=>`<option>${esc(x)}</option>`).join("");
  const cats=[...new Set(DB.products.map(p=>p.category).filter(Boolean))];byId("reportCategory").innerHTML='<option value="">Tüm cinsler</option>'+cats.map(x=>`<option>${esc(x)}</option>`).join("");
  byId("allDates").onclick=()=>{byId("reportStart").value="";byId("reportEnd").value="";renderReports()};
  renderReports();
}
function filteredSales(){
  const s=byId("reportStart").value,e=byId("reportEnd").value,brand=byId("reportBrand").value,cat=byId("reportCategory").value,pay=byId("reportPayment").value;
  return DB.sales.filter(x=>(!s||x.createdAt.slice(0,10)>=s)&&(!e||x.createdAt.slice(0,10)<=e)&&(!pay||x.paymentType===pay))
   .map(x=>({...x,items:x.items.filter(i=>(!brand||i.brand===brand)&&(!cat||i.category===cat))})).filter(x=>x.items.length);
}
function renderReports(){
  const sales=filteredSales(),revenue=sales.reduce((a,s)=>a+s.items.reduce((x,i)=>x+i.price*i.qty,0),0),count=sales.reduce((a,s)=>a+s.items.reduce((x,i)=>x+i.qty,0),0);
  byId("rRevenue").textContent=money(revenue);byId("rCount").textContent=count;byId("rTickets").textContent=sales.length;byId("rAverage").textContent=money(sales.length?revenue/sales.length:0);
  byId("reportRows").innerHTML=sales.length?sales.flatMap(s=>s.items.map(i=>`<tr><td>${dt(s.createdAt)}</td><td>${esc(i.name)}</td><td>${esc(i.brand||"-")}</td><td>${esc(i.category||"-")}</td><td>${i.qty}</td><td>${money(i.price*i.qty)}</td><td>${esc(s.paymentType)}</td></tr>`)).join(""):`<tr><td colspan="7" class="empty">Seçilen filtrelerde kayıt bulunamadı.</td></tr>`;
  const hours=Array.from({length:24},(_,h)=>({h,value:0}));
  sales.forEach(s=>hours[new Date(s.createdAt).getHours()].value+=s.items.reduce((a,i)=>a+i.price*i.qty,0));
  const max=Math.max(1,...hours.map(x=>x.value));
  byId("hourChart").innerHTML=hours.map(x=>`<div class="chart-bar" style="height:${Math.max(2,x.value/max*100)}%"><b>${x.value?Math.round(x.value):""}</b><span>${String(x.h).padStart(2,"0")}</span></div>`).join("");
}

function initSettings(){
  byId("businessName").value=DB.settings.businessName;byId("lowStock").value=DB.settings.lowStock;
  byId("settingsForm").onsubmit=e=>{e.preventDefault();DB.settings.businessName=byId("businessName").value.trim()||"İşletmem";DB.settings.lowStock=+byId("lowStock").value||5;saveNow("Ayarlar kaydedildi");location.reload()};
  byId("userForm").onsubmit=e=>{e.preventDefault();DB.users.push({id:crypto.randomUUID(),name:byId("userName").value.trim(),role:byId("userRole").value,createdAt:new Date().toISOString()});saveNow("Kullanıcı eklendi");e.target.reset();renderUsers()};
  byId("resetBtn").onclick=resetDB;renderUsers();
}
function renderUsers(){
  byId("usersBody").innerHTML=DB.users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.role)}</td><td>${dt(u.createdAt)}</td><td><button class="btn btn-danger" onclick="deleteUser('${u.id}')">Sil</button></td></tr>`).join("");
}
window.deleteUser=id=>{if(DB.users.length<=1){alert("En az bir kullanıcı kalmalıdır.");return}DB.users=DB.users.filter(u=>u.id!==id);saveNow("Kullanıcı silindi");renderUsers()};


function customerDebt(customerId){
  const sales=DB.sales.filter(s=>s.paymentType==="Veresiye"&&s.creditCustomerId===customerId)
    .reduce((a,s)=>a+Number(s.total||0),0);
  const payments=DB.creditPayments.filter(p=>p.customerId===customerId)
    .reduce((a,p)=>a+Number(p.amount||0),0);
  return {sales,payments,balance:sales-payments};
}
function initCredits(){
  renderCreditCustomers();
  renderCreditSummary();
  renderCreditMovements();
  byId("creditSearch").oninput=renderCreditCustomers;
  byId("creditCustomerForm").onsubmit=saveCreditCustomer;
  byId("creditPaymentForm").onsubmit=saveCreditPayment;
  byId("openCreditCustomerModal").onclick=()=>openCreditCustomerModal();
  byId("closeCreditCustomerModal").onclick=()=>byId("creditCustomerModal").classList.remove("open");
  byId("closeCreditDetailModal").onclick=()=>byId("creditDetailModal").classList.remove("open");
  byId("closeCreditPaymentModal").onclick=()=>byId("creditPaymentModal").classList.remove("open");
}
let editingCreditCustomerId=null;
function openCreditCustomerModal(customer=null){
  editingCreditCustomerId=customer?.id||null;
  byId("creditCustomerForm").reset();
  byId("creditCustomerModalTitle").textContent=customer?"Müşteriyi Düzenle":"Yeni Veresiye Müşterisi";
  byId("creditCustomerName").value=customer?.name||"";
  byId("creditCustomerPhone").value=customer?.phone||"";
  byId("creditCustomerAddress").value=customer?.address||"";
  byId("creditCustomerNote").value=customer?.note||"";
  byId("creditCustomerModal").classList.add("open");
}
function saveCreditCustomer(e){
  e.preventDefault();
  const customer={
    id:editingCreditCustomerId||crypto.randomUUID(),
    name:byId("creditCustomerName").value.trim(),
    phone:byId("creditCustomerPhone").value.trim(),
    address:byId("creditCustomerAddress").value.trim(),
    note:byId("creditCustomerNote").value.trim(),
    createdAt:DB.creditCustomers.find(x=>x.id===editingCreditCustomerId)?.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  if(!customer.name){alert("Müşteri adı zorunludur.");return}
  if(editingCreditCustomerId) DB.creditCustomers=DB.creditCustomers.map(x=>x.id===editingCreditCustomerId?customer:x);
  else DB.creditCustomers.push(customer);
  saveNow(editingCreditCustomerId?"Müşteri güncellendi":"Veresiye müşterisi eklendi");
  byId("creditCustomerModal").classList.remove("open");
  renderCreditCustomers();renderCreditSummary();renderCreditMovements();
}
function renderCreditSummary(){
  const totalDebt=DB.creditCustomers.reduce((a,c)=>a+Math.max(0,customerDebt(c.id).balance),0);
  const totalPaid=DB.creditPayments.reduce((a,p)=>a+Number(p.amount||0),0);
  const debtors=DB.creditCustomers.filter(c=>customerDebt(c.id).balance>0).length;
  byId("creditMetricCustomers").textContent=DB.creditCustomers.length;
  byId("creditMetricDebtors").textContent=debtors;
  byId("creditMetricDebt").textContent=money(totalDebt);
  byId("creditMetricPaid").textContent=money(totalPaid);
}
function renderCreditCustomers(){
  const q=(byId("creditSearch")?.value||"").toLocaleLowerCase("tr");
  const rows=DB.creditCustomers.filter(c=>[c.name,c.phone,c.address,c.note].join(" ").toLocaleLowerCase("tr").includes(q));
  byId("creditCustomersBody").innerHTML=rows.length?rows.map(c=>{
    const d=customerDebt(c.id);
    return `<tr>
      <td><strong>${esc(c.name)}</strong><br><small>${esc(c.phone||"-")}</small></td>
      <td>${esc(c.address||"-")}</td>
      <td>${money(d.sales)}</td><td>${money(d.payments)}</td>
      <td class="${d.balance>0?"status-out":"status-ok"}">${money(d.balance)}</td>
      <td>${new Date(c.createdAt).toLocaleDateString("tr-TR")}</td>
      <td><button class="btn btn-secondary" onclick="openCreditDetail('${c.id}')">Detay</button>
          <button class="btn btn-success" onclick="openCreditPayment('${c.id}')">Tahsilat</button>
          <button class="btn btn-secondary" onclick="editCreditCustomer('${c.id}')">Düzenle</button>
          <button class="btn btn-danger" onclick="deleteCreditCustomer('${c.id}')">Sil</button></td>
    </tr>`;
  }).join(""):`<tr><td colspan="7" class="empty">Veresiye müşterisi bulunamadı.</td></tr>`;
}
window.editCreditCustomer=id=>openCreditCustomerModal(DB.creditCustomers.find(c=>c.id===id));
window.deleteCreditCustomer=id=>{
  const debt=customerDebt(id);
  if(debt.balance>0){alert("Borcu bulunan müşteri silinemez. Önce tahsilat veya düzeltme yapın.");return}
  if(confirm("Müşteri kaydı silinsin mi?")){
    DB.creditCustomers=DB.creditCustomers.filter(c=>c.id!==id);
    DB.creditPayments=DB.creditPayments.filter(p=>p.customerId!==id);
    saveNow("Müşteri silindi");renderCreditCustomers();renderCreditSummary();renderCreditMovements();
  }
};
window.openCreditDetail=id=>{
  const c=DB.creditCustomers.find(x=>x.id===id),d=customerDebt(id);
  byId("creditDetailTitle").textContent=c.name+" · Hesap Detayı";
  byId("creditDetailInfo").innerHTML=`<div class="grid grid-3">
    <div class="card"><span class="muted">Toplam Veresiye</span><div class="value">${money(d.sales)}</div></div>
    <div class="card"><span class="muted">Toplam Tahsilat</span><div class="value">${money(d.payments)}</div></div>
    <div class="card"><span class="muted">Kalan Borç</span><div class="value">${money(d.balance)}</div></div>
  </div><p><strong>Telefon:</strong> ${esc(c.phone||"-")} &nbsp; <strong>Adres:</strong> ${esc(c.address||"-")}</p>`;
  const sales=DB.sales.filter(s=>s.paymentType==="Veresiye"&&s.creditCustomerId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  byId("creditDetailSales").innerHTML=sales.length?sales.flatMap(s=>s.items.map(i=>`<tr>
    <td>${dt(s.createdAt)}</td><td>${esc(i.name)}</td><td>${esc(i.barcode||"-")}</td>
    <td>${esc(i.brand||"-")}</td><td>${esc(i.category||"-")}</td><td>${i.qty}</td>
    <td>${money(i.price)}</td><td>${money(i.price*i.qty)}</td></tr>`)).join(""):`<tr><td colspan="8" class="empty">Veresiye alışveriş kaydı yok.</td></tr>`;
  const payments=DB.creditPayments.filter(p=>p.customerId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  byId("creditDetailPayments").innerHTML=payments.length?payments.map(p=>`<tr><td>${dt(p.createdAt)}</td><td>${money(p.amount)}</td><td>${esc(p.method)}</td><td>${esc(p.note||"-")}</td><td><button class="btn btn-danger" onclick="deleteCreditPayment('${p.id}','${id}')">Sil</button></td></tr>`).join(""):`<tr><td colspan="5" class="empty">Tahsilat kaydı yok.</td></tr>`;
  byId("creditDetailModal").classList.add("open");
};
window.openCreditPayment=id=>{
  const c=DB.creditCustomers.find(x=>x.id===id),d=customerDebt(id);
  byId("paymentCustomerId").value=id;
  byId("paymentCustomerName").textContent=c.name;
  byId("paymentCurrentDebt").textContent=money(d.balance);
  byId("creditPaymentForm").reset();
  byId("paymentCustomerId").value=id;
  byId("creditPaymentModal").classList.add("open");
};
function saveCreditPayment(e){
  e.preventDefault();
  const customerId=byId("paymentCustomerId").value, amount=+byId("paymentAmount").value;
  const debt=customerDebt(customerId).balance;
  if(amount<=0){alert("Tahsilat tutarı sıfırdan büyük olmalıdır.");return}
  if(amount>debt){alert("Tahsilat kalan borçtan fazla olamaz.");return}
  DB.creditPayments.push({id:crypto.randomUUID(),customerId,amount,method:byId("paymentMethod").value,note:byId("paymentNote").value.trim(),createdAt:new Date().toISOString()});
  saveNow("Tahsilat kaydedildi");byId("creditPaymentModal").classList.remove("open");
  renderCreditCustomers();renderCreditSummary();renderCreditMovements();
}
window.deleteCreditPayment=(paymentId,customerId)=>{
  if(confirm("Tahsilat kaydı silinsin mi?")){
    DB.creditPayments=DB.creditPayments.filter(p=>p.id!==paymentId);saveNow("Tahsilat silindi");
    openCreditDetail(customerId);renderCreditCustomers();renderCreditSummary();renderCreditMovements();
  }
};
function renderCreditMovements(){
  const movements=[
    ...DB.sales.filter(s=>s.paymentType==="Veresiye").map(s=>({type:"Borç",customerId:s.creditCustomerId,amount:s.total,date:s.createdAt,note:s.items.map(i=>`${i.name} x${i.qty}`).join(", ")})),
    ...DB.creditPayments.map(p=>({type:"Tahsilat",customerId:p.customerId,amount:p.amount,date:p.createdAt,note:p.note||p.method}))
  ].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
  byId("creditMovementsBody").innerHTML=movements.length?movements.map(m=>{
    const c=DB.creditCustomers.find(x=>x.id===m.customerId);
    return `<tr><td>${dt(m.date)}</td><td>${esc(c?.name||"Silinmiş müşteri")}</td><td>${esc(m.type)}</td><td>${money(m.amount)}</td><td>${esc(m.note||"-")}</td></tr>`;
  }).join(""):`<tr><td colspan="5" class="empty">Henüz veresiye hareketi yok.</td></tr>`;
}


document.addEventListener("DOMContentLoaded",()=>{
  navInit();commonBindings();
  ({dashboard:initDashboard,products:initProducts,sales:initSales,reports:initReports,credits:initCredits,settings:initSettings}[document.body.dataset.page]||(()=>{}))();
});
window.addEventListener("beforeunload",()=>localStorage.setItem(DB_KEY,JSON.stringify(DB)));
