const DEFAULT_WILAYAS = [
"أدرار","الشلف","الأغواط","أم البواقي","باتنة","بجاية","بسكرة","بشار","البليدة","البويرة","تمنراست","تبسة","تلمسان","تيارت","تيزي وزو","الجزائر","الجلفة","جيجل","سطيف","سعيدة","سكيكدة","سيدي بلعباس","عنابة","قالمة","قسنطينة","المدية","مستغانم","المسيلة","معسكر","ورقلة","وهران","البيض","إليزي","برج بوعريريج","بومرداس","الطارف","تندوف","تيسمسيلت","الوادي","خنشلة","سوق أهراس","تيبازة","ميلة","عين الدفلى","النعامة","عين تموشنت","غرداية","غليزان","تيميمون","برج باجي مختار","أولاد جلال","بني عباس","عين صالح","عين قزام","تقرت","جانت","المغير","المنيعة"
];
const ROOMS=["ثنائية","ثلاثية","رباعية","خماسية","جماعية"];
const ROLES=["معتمر","مسافر","معلن","مرشد"];
const STATUSES=["غير مؤكد","مؤكد"];
const DEFAULT_TRIPS=["عمرة 10 أكتوبر","عمرة 26 سبتمبر","عمرة 03 أوت"];

const KEY="cm_pwa_state_v1";
let state={customers:[],trips:[],lastSync:null,settings:{url:"",token:""}};

function uid(prefix="CM"){return `${prefix}-${crypto.randomUUID()}`}
function now(){return new Date().toISOString()}
function load(){
  try{const s=JSON.parse(localStorage.getItem(KEY)||"null");if(s)state=s}catch{}
  state.customers ||= []; state.trips ||= DEFAULT_TRIPS.map(name=>({sync_id:uid("TRIP"),name,active:1,deleted:0,updated_at:now()}));
  state.settings ||= {url:"",token:""};
}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function toast(t){const x=document.getElementById("toast");x.textContent=t;x.style.display="block";clearTimeout(window._toast);window._toast=setTimeout(()=>x.style.display="none",2600)}
function fillSelect(id,arr,placeholder="اختر"){const s=document.getElementById(id);s.innerHTML="";if(placeholder)s.innerHTML=`<option value="">${placeholder}</option>`;arr.forEach(x=>s.insertAdjacentHTML("beforeend",`<option>${esc(x)}</option>`))}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

function init(){
 load();
 fillSelect("wilaya",DEFAULT_WILAYAS); fillSelect("filterWilaya",DEFAULT_WILAYAS,"كل الولايات");
 fillSelect("request",state.trips.filter(t=>!t.deleted&&t.active).map(t=>t.name),"اختر الرحلة");
 document.getElementById("syncUrl").value=state.settings.url||"";
 document.getElementById("syncToken").value=state.settings.token||"";
 render();
 document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab,.tabpage").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.getElementById(b.dataset.tab).classList.add("active")});
 document.getElementById("search").oninput=renderCustomers;
 document.getElementById("clearSearch").onclick=()=>{document.getElementById("search").value="";renderCustomers()};
 ["filterStatus","filterRole","filterRoom","filterWilaya"].forEach(id=>document.getElementById(id).onchange=renderCustomers);
 document.getElementById("customerForm").onsubmit=saveCustomer;
 document.getElementById("clearForm").onclick=clearForm;
 document.getElementById("useManual").onclick=()=>{document.getElementById("request").value="";document.getElementById("request").dataset.manual=document.getElementById("manualRequest").value.trim();toast("تم اختيار الطلب اليدوي")};
 document.getElementById("tripForm").onsubmit=addTrip;
 document.getElementById("syncBtn").onclick=sync;
 document.getElementById("saveSettings").onclick=saveSettings;
 document.getElementById("exportBtn").onclick=exportData;
 document.getElementById("importFile").onchange=importData;
 if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
}
function render(){renderCustomers();renderTrips()}
function renderCustomers(){
 const q=document.getElementById("search").value.trim().toLowerCase();
 const fs=document.getElementById("filterStatus").value,fr=document.getElementById("filterRole").value,frm=document.getElementById("filterRoom").value,fw=document.getElementById("filterWilaya").value;
 let a=state.customers.filter(c=>!c.deleted).filter(c=>{
   const blob=[c.phone,c.wilaya,c.name,c.request,c.role,c.status,c.room].join(" ").toLowerCase();
   return (!q||blob.includes(q))&&(!fs||c.status===fs)&&(!fr||c.role===fr)&&(!frm||c.room===frm)&&(!fw||c.wilaya===fw);
 }).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
 document.getElementById("count").textContent=`عدد السجلات: ${a.length}`;
 document.getElementById("customerList").innerHTML=a.map(c=>`<article class="customer">
 <h3>${esc(c.name)}</h3>
 <div class="meta">
 <div>📞 ${esc(c.phone)}</div><div>📍 ${esc(c.wilaya)}</div>
 <div>✈️ ${esc(c.request)}</div><div>👤 ${esc(c.role)}</div>
 <div>👥 العدد: ${esc(c.people_count)}</div><div>🛏️ ${esc(c.room)}</div>
 <div>الحالة: ${esc(c.status)}</div><div>التاريخ: ${esc(c.entry_date)}</div>
 </div><div class="actions"><button onclick="editCustomer('${c.sync_id}')">تعديل</button><button class="danger" onclick="deleteCustomer('${c.sync_id}')">حذف</button></div>
 </article>`).join("")||'<div class="card muted">لا توجد سجلات.</div>';
}
function saveCustomer(e){
 e.preventDefault();
 const edit=document.getElementById("editId").value;
 const manual=document.getElementById("manualRequest").value.trim();
 const selected=document.getElementById("request").value;
 const request=manual || selected;
 if(!request){toast("اختر الرحلة أو أدخل طلبًا يدويًا");return}
 const old=state.customers.find(c=>c.sync_id===edit);
 const c={sync_id:edit||uid(),phone:phone.value.trim(),wilaya:wilaya.value,name:name.value.trim(),request,entry_date:old?.entry_date||new Date().toISOString().slice(0,10),role:role.value,status:status.value,people_count:Number(peopleCount.value)||1,room:room.value,created_at:old?.created_at||now(),updated_at:now(),deleted:0};
 if(edit){const i=state.customers.findIndex(x=>x.sync_id===edit);state.customers[i]=c;toast("تم تعديل السجل")}
 else {state.customers.push(c);toast("تمت إضافة السجل")}
 save();clearForm();render();
}
function editCustomer(id){
 const c=state.customers.find(x=>x.sync_id===id);if(!c)return;
 document.getElementById("editId").value=c.sync_id;phone.value=c.phone;wilaya.value=c.wilaya;name.value=c.name;role.value=c.role;status.value=c.status;peopleCount.value=c.people_count;room.value=c.room;manualRequest.value="";
 document.getElementById("request").value=state.trips.some(t=>t.name===c.request&&!t.deleted)?c.request:"";
 if(!document.getElementById("request").value)manualRequest.value=c.request;
 document.querySelector('[data-tab="add"]').click();window.scrollTo({top:0,behavior:"smooth"});
}
function deleteCustomer(id){if(!confirm("حذف هذا السجل؟"))return;const c=state.customers.find(x=>x.sync_id===id);if(c){c.deleted=1;c.updated_at=now();save();render();toast("تم حذف السجل، وسيتم حذفه من الأجهزة الأخرى بعد المزامنة")}}
function clearForm(){document.getElementById("customerForm").reset();document.getElementById("editId").value="";document.getElementById("peopleCount").value=1}
function renderTrips(){document.getElementById("tripList").innerHTML=state.trips.filter(t=>!t.deleted).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))).map(t=>`<div class="trip"><b>${esc(t.name)}</b><button class="danger" style="margin-top:8px" onclick="deleteTrip('${t.sync_id}')">حذف</button></div>`).join("")}
function addTrip(e){e.preventDefault();const n=tripName.value.trim();if(!n)return;if(state.trips.some(t=>t.name===n&&!t.deleted)){toast("الرحلة موجودة");return}state.trips.push({sync_id:uid("TRIP"),name:n,active:1,deleted:0,updated_at:now()});save();tripName.value="";fillSelect("request",state.trips.filter(t=>!t.deleted&&t.active).map(t=>t.name),"اختر الرحلة");renderTrips();toast("تمت إضافة الرحلة")}
function deleteTrip(id){if(!confirm("حذف الرحلة؟"))return;const t=state.trips.find(x=>x.sync_id===id);if(t){t.deleted=1;t.active=0;t.updated_at=now();save();fillSelect("request",state.trips.filter(t=>!t.deleted&&t.active).map(t=>t.name),"اختر الرحلة");renderTrips()}}
function saveSettings(){state.settings.url=document.getElementById("syncUrl").value.trim();state.settings.token=document.getElementById("syncToken").value.trim();save();toast("تم حفظ إعدادات المزامنة")}
function buildPayload(){return {customers:state.customers.map(c=>({...c})),trips:state.trips.map(t=>({...t}))}}
async function sync(){
 saveSettings(); const url=state.settings.url, token=state.settings.token;
 if(!url||!token){toast("أدخل رابط الخادم وSYNC TOKEN أولًا");return}
 const b=document.getElementById("syncBtn");b.disabled=true;b.textContent="جاري المزامنة...";
 document.getElementById("syncStatus").textContent="جاري المزامنة...";
 try{
   const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,api_key:token,action:"sync",device_id:"android-pwa-"+getDeviceId(),...buildPayload()})});
   const data=await res.json();
   if(!data.success)throw new Error(data.error||"فشلت المزامنة");
   mergeServer(data);
   state.lastSync=data.server_time||now();save();render();
   document.getElementById("syncStatus").textContent="آخر مزامنة: "+new Date(state.lastSync).toLocaleString("ar-DZ");
   toast(`تمت المزامنة بنجاح — الزبائن: ${state.customers.filter(x=>!x.deleted).length} — الرحلات: ${state.trips.filter(x=>!x.deleted).length}`);
 }catch(e){document.getElementById("syncStatus").textContent="فشلت المزامنة";toast("خطأ في المزامنة: "+e.message)}
 finally{b.disabled=false;b.textContent="↻ مزامنة"}
}
function getDeviceId(){let x=localStorage.getItem("cm_device_id");if(!x){x=uid("PHONE");localStorage.setItem("cm_device_id",x)}return x}
function mergeServer(data){
 const sc=data.customers||[], st=data.trips||[];
 for(const s of sc)mergeOne(state.customers,s);
 for(const s of st)mergeOne(state.trips,s);
}
function mergeOne(arr,s){
 if(!s.sync_id)return;
 const i=arr.findIndex(x=>x.sync_id===s.sync_id);
 if(i<0){arr.push({...s});return}
 const local=arr[i];
 if(String(s.updated_at||"")>String(local.updated_at||"")) arr[i]={...local,...s};
}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="customer_manager_backup.json";a.click()}
function importData(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);save();init();toast("تم استيراد النسخة")}catch{toast("ملف غير صالح")}};r.readAsText(f)}
window.editCustomer=editCustomer;window.deleteCustomer=deleteCustomer;window.deleteTrip=deleteTrip;
init();
