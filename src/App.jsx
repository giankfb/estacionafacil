import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CarFront, Gauge, Users, History, ChartNoAxesCombined, Settings, LockKeyhole, Search, Plus, LogOut, Clock3, CircleDollarSign, CheckCircle2, X, ParkingCircle, CreditCard, Banknote, Smartphone, Trash2, Camera, ScanLine, LoaderCircle, Mic, MicOff } from 'lucide-react';

const DEFAULTS = { hourly: 6, daily: 40, garage: 400, commercial: 200, open: '08:00', close: '18:00', adminPassword: '1234' };
const API_DEFAULTS = { url: '', token: '' };
const apiRead = () => read('ef_api', API_DEFAULTS);
const apiRequest = async (url, options={}) => {
 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(), 12000);
 try {
  const res = await fetch(url, { ...options, signal: controller.signal });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { throw new Error('Resposta inválida do servidor.'); }
  if (!res.ok || data.ok === false) throw new Error(data.error || `Erro HTTP ${res.status}`);
  return data;
 } finally { clearTimeout(timer); }
};
const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const plateFormat = s => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
const normalizeSpokenPlate = transcript => {
 const text=String(transcript||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\b(placa|matricula|letras|numeros|numero)\b/g,' ').trim();
 const compact=text.toUpperCase().replace(/[^A-Z0-9]/g,'');
 const direct=compact.match(/[A-Z]{3}[0-9][A-Z0-9][0-9]{2}|[A-Z]{3}[0-9]{4}/);
 if(direct) return direct[0];
 const words={a:'A',be:'B',b:'B',ce:'C',c:'C',de:'D',d:'D',efe:'F',f:'F',ge:'G',g:'G',aga:'H',h:'H',i:'I',jota:'J',j:'J',ka:'K',k:'K',ele:'L',l:'L',eme:'M',m:'M',ene:'N',n:'N',o:'O',pe:'P',p:'P',que:'Q',q:'Q',erre:'R',r:'R',esse:'S',s:'S',te:'T',t:'T',u:'U',ve:'V',v:'V',dablio:'W',w:'W',xis:'X',x:'X',ipsilon:'Y',y:'Y',ze:'Z',z:'Z',zero:'0',um:'1',uma:'1',uns:'1',dois:'2',duas:'2',tres:'3',quatro:'4',cinco:'5',seis:'6',sete:'7',oito:'8',nove:'9'};
 const chars=[];
 text.split(/\s+/).filter(Boolean).forEach(word=>{
  if(/^[a-z]$/.test(word)){chars.push(words[word]||word.toUpperCase());return;}
  if(words[word]){chars.push(words[word]);return;}
  if(/^[a-z]{3}$/.test(word) && !words[word]){word.split('').forEach(ch=>chars.push(ch.toUpperCase()));return;}
  if(/^\d+$/.test(word)){word.split('').forEach(ch=>chars.push(ch));}
 });
 return chars.join('').slice(0,7);
};
const minutesBetween = (a,b) => Math.max(0, Math.floor((new Date(b).getTime()-new Date(a).getTime())/60000));
const duration = mins => `${Math.floor(mins/60)}h ${String(mins%60).padStart(2,'0')}min`;
const fmtTime = iso => new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const fmtDate = iso => new Date(iso).toLocaleDateString('pt-BR');
const fmtDateOnly = value => value ? String(value).split('-').reverse().join('/') : '—';
const normalizeTime = value => {
 if (!value) return '';
 const s=String(value);
 const m=s.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?/);
 if(m) return `${String(m[1]).padStart(2,'0')}:${m[2]}`;
 const d=new Date(value);
 if(!Number.isNaN(d.getTime())) return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
 return s;
};
const normalizeSettings = s => s ? ({...DEFAULTS,...s,open:normalizeTime(s.open)||DEFAULTS.open,close:normalizeTime(s.close)||DEFAULTS.close}) : DEFAULTS;

export default function App(){
 const [tab,setTab]=useState('pdv');
 const [settings,setSettings]=useState(()=>read('ef_settings',DEFAULTS));
 const [active,setActive]=useState(()=>read('ef_active',[]));
 const [clients,setClients]=useState(()=>read('ef_clients',[]));
 const [history,setHistory]=useState(()=>read('ef_history',[]));
 const [monthlyBills,setMonthlyBills]=useState(()=>read('ef_monthly_bills',[]));
 const [billMonth,setBillMonth]=useState(()=>new Date().toISOString().slice(0,7));
 const [billDueDay,setBillDueDay]=useState('10');
 const [reportType,setReportType]=useState('receber');
 const [paymentBill,setPaymentBill]=useState(null);
 const [billPayAmount,setBillPayAmount]=useState('');
 const [billPayMethod,setBillPayMethod]=useState('Pix');
 const [billPayDate,setBillPayDate]=useState(()=>new Date().toISOString().slice(0,10));
 const [api,setApi]=useState(()=>apiRead());
 const [syncing,setSyncing]=useState(false);
 const [syncStatus,setSyncStatus]=useState('local');
 const [syncError,setSyncError]=useState('');
 const [remoteLoaded,setRemoteLoaded]=useState(false);
 const [plate,setPlate]=useState(''); const [clientName,setClientName]=useState(''); const [clientPhone,setClientPhone]=useState('');
 const [kind,setKind]=useState('hourly'); const [search,setSearch]=useState(''); const [checkout,setCheckout]=useState(null); const [discount,setDiscount]=useState('0'); const [payment,setPayment]=useState('Pix');
 const [modal,setModal]=useState(''); const [password,setPassword]=useState(''); const [unlocked,setUnlocked]=useState(false); const [notice,setNotice]=useState('');
 const [ocrBusy,setOcrBusy]=useState(false); const [ocrPreview,setOcrPreview]=useState('');
 const [cameraOpen,setCameraOpen]=useState(false);
 const [voiceListening,setVoiceListening]=useState(false);
 const platePhotoRef=useRef(null); const cameraVideoRef=useRef(null); const cameraStreamRef=useRef(null); const speechRecognitionRef=useRef(null);
 useEffect(()=>localStorage.setItem('ef_settings',JSON.stringify(settings)),[settings]);
 useEffect(()=>localStorage.setItem('ef_active',JSON.stringify(active)),[active]);
 useEffect(()=>localStorage.setItem('ef_clients',JSON.stringify(clients)),[clients]);
 useEffect(()=>localStorage.setItem('ef_history',JSON.stringify(history)),[history]);
 useEffect(()=>localStorage.setItem('ef_monthly_bills',JSON.stringify(monthlyBills)),[monthlyBills]);
 useEffect(()=>localStorage.setItem('ef_api',JSON.stringify(api)),[api]);

 // Carrega a planilha uma vez ao iniciar. Se a integração não estiver configurada,
 // o sistema continua funcionando normalmente com os dados locais.
 useEffect(()=>{
  let cancelled=false;
  const loadRemote=async()=>{
   if(!api.url){setRemoteLoaded(true);return;}
   setSyncing(true); setSyncStatus('loading'); setSyncError('');
   try{
    const data=await apiRequest(`${api.url}${api.url.includes('?')?'&':'?'}action=read`);
    if(cancelled)return;
    const s=data.state||{};
    if(s.settings)setSettings(normalizeSettings(s.settings));
    if(Array.isArray(s.clients))setClients(s.clients);
    if(Array.isArray(s.active))setActive(s.active);
    if(Array.isArray(s.history))setHistory(s.history);
   if(Array.isArray(s.monthlyBills))setMonthlyBills(s.monthlyBills);
    setSyncStatus('online'); setNotice('Dados carregados da planilha.');
    setRemoteLoaded(true);
   }catch(err){
    // Não habilita o salvamento automático se a leitura inicial falhar;
    // isso evita sobrescrever a planilha com dados locais antigos/vazios.
    if(!cancelled){setSyncStatus('error');setSyncError(err.message||'Falha ao carregar a planilha.');}
   }finally{if(!cancelled){setSyncing(false);}}
  };
  loadRemote();
  return()=>{cancelled=true};
 },[api.url]);

 // Depois do carregamento remoto, envia alterações para a planilha com pequeno debounce.
 useEffect(()=>{
  if(!api.url || !api.token || !remoteLoaded)return;
  const timer=setTimeout(async()=>{
   setSyncing(true); setSyncError('');
   try{
    await apiRequest(api.url,{method:'POST',body:JSON.stringify({
      token:api.token, action:'save',
      state:{settings,clients,active,history,monthlyBills}
    })});
    setSyncStatus('online');
   }catch(err){setSyncStatus('error');setSyncError(err.message||'Falha ao salvar na planilha.');}
   finally{setSyncing(false);}
  },900);
  return()=>clearTimeout(timer);
 },[api.url,api.token,remoteLoaded,settings,clients,active,history,monthlyBills]);

 useEffect(()=>{ if(!notice)return; const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t)},[notice]);
 useEffect(()=>()=>{ try{speechRecognitionRef.current?.abort();}catch{} },[]);
 const startVoicePlate=()=>{
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){setNotice('O reconhecimento de voz não está disponível neste navegador. Tente usar o Chrome ou digite a placa.');return;}
  if(voiceListening){try{speechRecognitionRef.current?.stop();}catch{}return;}
  try{
   const recognition=new SpeechRecognition(); speechRecognitionRef.current=recognition;
   recognition.lang='pt-BR'; recognition.continuous=false; recognition.interimResults=false; recognition.maxAlternatives=3;
   recognition.onstart=()=>{setVoiceListening(true);setNotice('Dite a placa caractere por caractere. Exemplo: A, B, C, um, D, dois, três.');};
   recognition.onresult=event=>{
    const alternatives=Array.from(event.results?.[0]||[]).map(x=>x.transcript||'');
    let best='';
    for(const transcript of alternatives){const candidate=normalizeSpokenPlate(transcript);if(candidate.length>best.length)best=candidate;}
    if(best.length===7){setPlate(best);setNotice(`Placa reconhecida: ${best}. Confira os caracteres antes de registrar.`);}
    else if(best.length>0){setPlate(best);setNotice(`Reconheci ${best}. Complete ou corrija a placa antes de registrar.`);}
    else setNotice('Não consegui reconhecer a placa. Tente ditar as letras e os números separadamente.');
   };
   recognition.onerror=event=>{const msg=event.error==='not-allowed'?'Permita o uso do microfone nas configurações do navegador.':event.error==='no-speech'?'Nenhuma fala detectada. Toque no microfone e tente novamente.':'Não foi possível reconhecer a fala. Tente novamente ou digite a placa.';setNotice(msg);};
   recognition.onend=()=>{setVoiceListening(false);speechRecognitionRef.current=null;};
   recognition.start();
  }catch{setVoiceListening(false);setNotice('Não foi possível iniciar o microfone. Verifique a permissão do navegador.');}
 };
 const today = new Date().toLocaleDateString('pt-BR');
 const todayHistory=history.filter(x=>fmtDate(x.exitAt)===today);
 const totalToday=todayHistory.reduce((s,x)=>s+x.total,0);
 const activeMinutes=mins=>duration(mins);
 const getClient = p => clients.find(c=>c.plate===p);
 const findMonthly = p => { const c=getClient(p); return c && ['garage','commercial'].includes(c.plan) ? c : null; };
 const start = () => {
  const p=plateFormat(plate); if(p.length<7){setNotice('Informe uma placa válida com 7 caracteres.');return;}
  if(active.some(v=>v.plate===p)){setNotice('Essa placa já está registrada no pátio.');return;}
  const monthly=findMonthly(p); const now=new Date();
  if(monthly?.plan==='commercial') { const mins=now.getHours()*60+now.getMinutes(); const [oh,om]=settings.open.split(':').map(Number),[ch,cm]=settings.close.split(':').map(Number); if(mins<oh*60+om||mins>=ch*60+cm){setNotice(`Mensalista comercial permitido somente das ${settings.open} às ${settings.close}.`);return;} }
  const v={id:crypto.randomUUID(),plate:p,customerName:clientName.trim()||getClient(p)?.name||'',customerPhone:clientPhone.trim()||getClient(p)?.phone||'',kind:monthly?'monthly':kind,plan:monthly?.plan||null,entryAt:now.toISOString()};
  setActive(a=>[v,...a]); setPlate('');setClientName('');setClientPhone('');setNotice(`Entrada registrada: ${p}`);
 };
 const calc = v => { const mins=minutesBetween(v.entryAt,new Date().toISOString()); if(v.kind==='monthly') return {mins,gross:0,label:'Incluído na mensalidade'}; if(v.kind==='daily') return {mins,gross:settings.daily,label:'Diária (8h às 18h)'}; return {mins,gross:mins/60*settings.hourly,label:'Proporcional por minuto'}; };
 const beginCheckout=v=>{setCheckout(v);setDiscount('0');setPayment('Pix');};
 const finish=()=>{if(!checkout)return; const c=calc(checkout); const d=Math.max(0,Math.min(c.gross,Number(String(discount).replace(',','.'))||0)); const item={...checkout,exitAt:new Date().toISOString(),minutes:c.mins,gross:c.gross,discount:d,total:c.gross-d,payment,chargeType:checkout.kind==='monthly'?'Mensalista':checkout.kind==='daily'?'Diária':'Rotativo'};setHistory(h=>[item,...h]);setActive(a=>a.filter(v=>v.id!==checkout.id));setCheckout(null);setNotice(`Saída finalizada. Total: ${money(item.total)}`);};
 const addClient=()=>{const p=plateFormat(document.getElementById('cplate')?.value||'');const name=document.getElementById('cname')?.value?.trim()||'';const phone=document.getElementById('cphone')?.value?.trim()||'';const plan=document.getElementById('cplan')?.value||'garage';if(p.length!==7||!name){setNotice('Informe uma placa válida e o nome do mensalista.');return;}const existing=clients.find(c=>c.plate===p);setClients(cs=>[{id:existing?.id||crypto.randomUUID(),plate:p,name,phone,plan,createdAt:existing?.createdAt||new Date().toISOString()},...cs.filter(c=>c.plate!==p)]);setModal('');setNotice('Mensalista cadastrado com sucesso.');};
 const billFor=(client,reference)=>monthlyBills.find(b=>b.clientId===client.id&&b.reference===reference);
 const generateBills=()=>{
  const dueDate=`${billMonth}-${String(billDueDay).padStart(2,'0')}`;
  let added=0;
  const newBills=[];
  clients.forEach(c=>{if(!billFor(c,billMonth)){newBills.push({id:crypto.randomUUID(),clientId:c.id,plate:c.plate,name:c.name,phone:c.phone,plan:c.plan,reference:billMonth,dueDate,amount:Number(c.plan==='garage'?settings.garage:settings.commercial)||0,payments:[],createdAt:new Date().toISOString()});added++;}});
  if(added){setMonthlyBills(bs=>[...newBills,...bs]);setNotice(`${added} cobrança(s) gerada(s) para ${billMonth}.`);}else setNotice('As cobranças deste mês já foram geradas.');
 };
 const billPaid=b=>Math.min(Number(b.amount)||0,(b.payments||[]).reduce((sum,p)=>sum+(Number(p.amount)||0),0));
 const billBalance=b=>Math.max(0,(Number(b.amount)||0)-billPaid(b));
 const payBill=async()=>{
  if(!paymentBill)return;
  const amount=Number(String(billPayAmount).replace(',','.'));
  if(!Number.isFinite(amount)||amount<=0){setNotice('Informe um valor de pagamento válido.');return;}
  const currentBill=monthlyBills.find(b=>b.id===paymentBill.id)||paymentBill;
  const balance=billBalance(currentBill);
  if(amount>balance+0.001){setNotice('O pagamento não pode ser maior que o saldo pendente.');return;}
  const paymentRecord={id:crypto.randomUUID(),date:billPayDate||new Date().toISOString().slice(0,10),amount,method:billPayMethod,createdAt:new Date().toISOString()};
  const nextBills=monthlyBills.map(b=>b.id===currentBill.id?{...b,payments:[...(b.payments||[]),paymentRecord]}:b);
  // Persiste a cobrança atualizada antes de confirmar o pagamento na interface.
  if(api.url && api.token){
   setSyncing(true);setSyncError('');
   try{
    await apiRequest(api.url,{method:'POST',body:JSON.stringify({token:api.token,action:'save',state:{settings,clients,active,history,monthlyBills:nextBills}})});
    setSyncStatus('online');
   }catch(err){
    setSyncStatus('error');setSyncError(err.message||'Falha ao salvar pagamento.');
    setSyncing(false);setNotice('Pagamento não confirmado na planilha. Verifique a conexão e tente novamente.');return;
   }finally{setSyncing(false);}
  }
  setMonthlyBills(nextBills);setPaymentBill(null);
  setNotice(api.url&&api.token?(amount<balance?'Pagamento parcial salvo na planilha. O saldo continua pendente.':'Mensalidade quitada e salva na planilha.'):(amount<balance?'Pagamento parcial salvo apenas neste navegador. Configure a planilha para sincronizar.':'Mensalidade quitada neste navegador. Configure a planilha para sincronizar.'));
 };
 const ensureMonthlyBills=()=>generateBills();
 const printReport=()=>window.print();
 const syncNow=async()=>{
  if(!api.url||!api.token){setNotice('Configure a URL do Apps Script e o token antes de sincronizar.');return;}
  setSyncing(true);setSyncError('');
  try{
   await apiRequest(api.url,{method:'POST',body:JSON.stringify({token:api.token,action:'save',state:{settings,clients,active,history,monthlyBills}})});
   setSyncStatus('online');setNotice('Planilha atualizada com sucesso.');
  }catch(err){setSyncStatus('error');setSyncError(err.message||'Falha ao salvar na planilha.');setNotice('Não foi possível atualizar a planilha.');}
  finally{setSyncing(false);}
 };
 const loadNow=async()=>{
  if(!api.url){setNotice('Configure a URL do Apps Script antes de carregar.');return;}
  setSyncing(true);setSyncError('');
  try{
   const data=await apiRequest(`${api.url}${api.url.includes('?')?'&':'?'}action=read`);
   const s=data.state||{};
   if(s.settings)setSettings(normalizeSettings(s.settings));
   if(Array.isArray(s.clients))setClients(s.clients);
   if(Array.isArray(s.active))setActive(s.active);
   if(Array.isArray(s.history))setHistory(s.history);
    if(Array.isArray(s.monthlyBills))setMonthlyBills(s.monthlyBills);
   setRemoteLoaded(true);
   setSyncStatus('online');setNotice('Dados recarregados da planilha.');
  }catch(err){setSyncStatus('error');setSyncError(err.message||'Falha ao carregar.');setNotice('Não foi possível carregar a planilha.');}
  finally{setSyncing(false);}
 };
 const loadTesseract = async () => {
  if(window.Tesseract) return;
  await new Promise((resolve,reject)=>{
   const existing=document.querySelector('script[data-tesseract]');
   if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
   const script=document.createElement('script'); script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; script.dataset.tesseract='1'; script.onload=resolve; script.onerror=reject; document.head.appendChild(script);
  });
 };
 const imageFromSource = async source => {
  const url=typeof source==='string'?source:URL.createObjectURL(source);
  try{
   const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
   const baseW=Math.max(1200,Math.min(2200,img.naturalWidth||1600));
   const scale=baseW/(img.naturalWidth||baseW); const bw=Math.round((img.naturalWidth||baseW)*scale), bh=Math.round((img.naturalHeight||1200)*scale);
   const make=(sx,sy,sw,sh,mode='normal')=>{
    const canvas=document.createElement('canvas'); canvas.width=Math.max(900,Math.round(sw*scale)); canvas.height=Math.max(300,Math.round(sh*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
    if(mode!=='normal'){
     const im=ctx.getImageData(0,0,canvas.width,canvas.height), d=im.data;
     for(let i=0;i<d.length;i+=4){const y=d[i]*.299+d[i+1]*.587+d[i+2]*.114; let v=mode==='bw'?(y>145?255:0):(y-128)*1.65+128; v=Math.max(0,Math.min(255,v)); d[i]=d[i+1]=d[i+2]=v;}
     ctx.putImageData(im,0,0);
    }
    return new Promise(r=>canvas.toBlob(r,'image/jpeg',.94));
   };
   const full=make(0,0,img.naturalWidth,img.naturalHeight,'normal');
   const center=make(img.naturalWidth*.08,img.naturalHeight*.28,img.naturalWidth*.84,img.naturalHeight*.44,'normal');
   const centerWide=make(img.naturalWidth*.03,img.naturalHeight*.18,img.naturalWidth*.94,img.naturalHeight*.64,'normal');
   const centerBw=make(img.naturalWidth*.03,img.naturalHeight*.18,img.naturalWidth*.94,img.naturalHeight*.64,'bw');
   const centerContrast=make(img.naturalWidth*.03,img.naturalHeight*.18,img.naturalWidth*.94,img.naturalHeight*.64,'contrast');
   return [full,center,centerWide,centerBw,centerContrast].filter(Boolean);
  } finally { if(typeof source!=='string') URL.revokeObjectURL(url); }
 };
 const preprocessPlateImages = file => imageFromSource(file);
 const extractPlateCandidates = text => {
   const raw=(text||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
   const compact=raw.replace(/[^A-Z0-9]/g,'');
   const out=[];
   const push=x=>{const y=plateFormat(x);if(y.length===7&&!out.includes(y))out.push(y);};
   [raw,compact].forEach(v=>{
    (v.match(/[A-Z]{3}[0-9][A-Z0-9][0-9]{2}/g)||[]).forEach(push);
    (v.match(/[A-Z]{3}[0-9]{4}/g)||[]).forEach(push);
    for(let i=0;i<=v.length-7;i++){const chunk=v.slice(i,i+7);if(/^[A-Z0-9]{7}$/.test(chunk)&&/[A-Z]{2,}/.test(chunk)&&/[0-9]{2,}/.test(chunk))push(chunk);}
   });
   return out;
 };
 const scoreCandidate = (plate,confidence) => {
   const merc=/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate);
   const old=/^[A-Z]{3}[0-9]{4}$/.test(plate);
   if(!merc&&!old) return -1;
   return Math.min(100,Number(confidence)||0)+(merc?8:0);
 };
 const recognizePlate = async file => {
  if(!file) return;
  setOcrBusy(true); setOcrPreview(URL.createObjectURL(file)); setNotice('Preparando a foto da placa…');
  try {
   await loadTesseract();
   const images=await preprocessPlateImages(file); let best=null;
   for(let i=0;i<images.length;i++){
    setNotice(i<2?'Procurando a placa na imagem…':`Tentativa ${i-1} de 3 com imagem tratada…`);
    const result=await window.Tesseract.recognize(images[i],'eng',{tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',preserve_interword_spaces:'0',psm:7});
    const conf=Number(result?.data?.confidence)||0;
    for(const candidate of extractPlateCandidates(result?.data?.text||'')){const score=scoreCandidate(candidate,conf);if(score>=0&&(!best||score>best.score))best={plate:candidate,score,confidence:conf};}
    if(best&&best.score>=65) break;
   }
   if(best && best.confidence>=45){setPlate(best.plate);setNotice(`Placa sugerida: ${best.plate}. Confira na foto antes de registrar.`);}
   else setNotice('Não consegui identificar a placa com segurança. Confira a foto e digite a placa manualmente.');
  } catch(err) { setNotice('Não foi possível ler a foto. Você ainda pode digitar a placa.'); }
  finally { setOcrBusy(false); setOcrPreview(''); }
 };
 const openCamera = async () => {
  try {
   if(!navigator.mediaDevices?.getUserMedia) throw new Error('camera');
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
   cameraStreamRef.current=stream; setCameraOpen(true);
   setTimeout(()=>{if(cameraVideoRef.current){cameraVideoRef.current.srcObject=stream;cameraVideoRef.current.play().catch(()=>{});}},50);
  } catch { setNotice('Não foi possível abrir a câmera. Verifique a permissão do navegador e tente novamente.'); }
 };
 const closeCamera = () => { cameraStreamRef.current?.getTracks().forEach(t=>t.stop()); cameraStreamRef.current=null; setCameraOpen(false); };
 const captureCamera = async () => {
  const video=cameraVideoRef.current; if(!video||!video.videoWidth) return;
  const canvas=document.createElement('canvas'); canvas.width=video.videoWidth; canvas.height=video.videoHeight; canvas.getContext('2d').drawImage(video,0,0);
  const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.95)); closeCamera(); if(blob) await recognizePlate(blob);
 };
 const onPlatePhoto=e=>{ const file=e.target.files?.[0]; if(file) recognizePlate(file); e.target.value=''; };


 const nav=[['pdv','PDV / Operação',Gauge],['monthly','Mensalistas',Users],['history','Movimentações',History],['reports','Relatórios',ChartNoAxesCombined],['settings','Configurações',Settings]];
 const filteredActive=active.filter(v=>(v.plate+' '+v.customerName).toLowerCase().includes(search.toLowerCase()));
 const totalsByType=useMemo(()=>({hourly:history.filter(x=>x.chargeType==='Rotativo').reduce((s,x)=>s+x.total,0),daily:history.filter(x=>x.chargeType==='Diária').reduce((s,x)=>s+x.total,0)}),[history]);
 const selectedBills=monthlyBills.filter(b=>b.reference===billMonth);
 const receivedInMonth=selectedBills.reduce((sum,b)=>sum+(b.payments||[]).filter(p=>String(p.date||'').slice(0,7)===billMonth).reduce((a,p)=>a+(Number(p.amount)||0),0),0)+history.filter(x=>String(x.exitAt||'').slice(0,7)===billMonth).reduce((a,x)=>a+(Number(x.total)||0),0);
 const openBills=selectedBills.filter(b=>billBalance(b)>0.009);
 const monthPayments=monthlyBills.flatMap(b=>(b.payments||[]).filter(p=>String(p.date||'').slice(0,7)===billMonth).map(p=>({...p,plate:b.plate,name:b.name,reference:b.reference})));  
 return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-icon"><ParkingCircle size={27}/></div><div><strong>ESTACIONA</strong><span>FÁCIL · ROTATIVO</span></div></div><div className="side-caption">MENU PRINCIPAL</div><nav>{nav.map(([id,label,Icon])=><button key={id} className={`nav-item ${tab===id?'active':''}`} onClick={()=>{setTab(id);setSearch('')}}><Icon size={18}/><span>{label}</span>{id==='settings'&&<LockKeyhole size={13} className="lock"/>}</button>)}</nav><div className="sidebar-bottom"><div className="status-dot"/> Sistema operacional <span className="version">v0.2</span></div></aside>
 <main className="main"><header className="topbar"><div><div className="eyebrow">CONTROLE DE ESTACIONAMENTO</div><h1>{nav.find(n=>n[0]===tab)?.[1]||'PDV / Operação'}</h1></div><div className="top-right"><span className="today-label">{new Date().toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}</span><div className="avatar">OP</div></div></header>
 {tab==='pdv'&&<><div className="welcome"><div><h2>Vamos atender o próximo veículo.</h2><p>Registre a entrada pela placa. O sistema cuida do tempo e do cálculo.</p></div><div className="live-pill"><span/> OPERAÇÃO ATIVA</div></div><div className="stats-grid"><Stat icon={CarFront} label="Veículos no pátio" value={active.length} tone="blue"/><Stat icon={CircleDollarSign} label="Faturamento hoje" value={money(totalToday)} tone="green"/><Stat icon={CheckCircle2} label="Saídas hoje" value={todayHistory.length} tone="purple"/></div><div className="work-grid"><section className="panel entry-panel"><div className="panel-heading"><div><h3>Registrar entrada</h3><p>Preencha a placa para iniciar a contagem.</p></div><span className="step-badge">01</span></div><label className="field-label">PLACA DO VEÍCULO</label><div className="plate-input-wrap"><CarFront size={22}/><input value={plate} onChange={e=>setPlate(plateFormat(e.target.value))} onKeyDown={e=>e.key==='Enter'&&start()} placeholder="ABC1D23" maxLength={7}/><span>{plate.length}/7</span><button type="button" className={`camera-btn voice-btn ${voiceListening?'voice-listening':''}`} onClick={startVoicePlate} title={voiceListening?"Parar reconhecimento de voz":"Preencher placa por voz"} aria-label={voiceListening?"Parar reconhecimento de voz":"Preencher placa por voz"}>{voiceListening?<MicOff size={21}/>:<Mic size={21}/>}</button></div><div className="camera-helper"><Mic size={13}/> Toque no microfone e dite as letras e os números da placa, um caractere por vez. Confira antes de registrar.</div><div className="field-row"><div><label className="field-label">NOME DO CLIENTE <em>OPCIONAL</em></label><input className="text-input" value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Nome do cliente"/></div><div><label className="field-label">TELEFONE <em>OPCIONAL</em></label><input className="text-input" value={clientPhone} onChange={e=>setClientPhone(e.target.value)} placeholder="(00) 00000-0000"/></div></div><label className="field-label">MODALIDADE DE COBRANÇA</label><div className="type-options"><button className={kind==='hourly'?'selected':''} onClick={()=>setKind('hourly')}><Clock3 size={18}/><span><b>Rotativo</b><small>R$ {Number(settings.hourly).toFixed(2).replace('.',',')} / hora</small></span></button><button className={kind==='daily'?'selected':''} onClick={()=>setKind('daily')}><ParkingCircle size={18}/><span><b>Diária</b><small>{money(settings.daily)} · 8h–18h</small></span></button></div><button className="primary-btn start-btn" onClick={start}><Plus size={19}/> Registrar entrada <span>→</span></button><p className="helper"><LockKeyhole size={13}/> Mensalistas cadastrados são identificados automaticamente pela placa.</p></section>
 <section className="panel yard-panel"><div className="panel-heading"><div><h3>Veículos no pátio <span className="count-chip">{active.length}</span></h3><p>Tempo atualizado ao consultar ou finalizar.</p></div><div className="searchbox"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar placa..."/></div></div>{filteredActive.length===0?<div className="empty-state"><div className="empty-icon"><CarFront size={29}/></div><b>Nenhum veículo encontrado</b><p>Os veículos registrados aparecerão aqui.</p></div>:<div className="vehicle-list">{filteredActive.map(v=>{const c=calc(v);return <div className="vehicle-row" key={v.id}><div className="vehicle-symbol"><CarFront size={20}/></div><div className="vehicle-info"><strong>{v.plate}</strong><span>{v.customerName||'Cliente avulso'} · {v.kind==='monthly'?'Mensalista':v.kind==='daily'?'Diária':'Rotativo'}</span></div><div className="elapsed"><b>{duration(c.mins)}</b><span>Entrada {fmtTime(v.entryAt)}</span></div><button className="finish-btn" onClick={()=>beginCheckout(v)}>Finalizar <span>→</span></button></div>})}</div>}<div className="yard-footer"><span><span className="mini-dot"/> Contagem iniciada no registro de entrada</span><span>Atualizado em tempo real ao operar</span></div></section></div></>}
 {tab==='monthly'&&<section className="panel full-panel"><div className="panel-heading"><div><h3>Mensalistas</h3><p>Consulte o contrato e registre pagamentos totais ou parciais da mensalidade.</p></div><button className="primary-btn compact" onClick={()=>setModal('vehicle')}><Plus size={16}/> Cadastrar mensalista</button></div><div className="report-filters"><label>Mês de referência<input className="text-input" type="month" value={billMonth} onChange={e=>setBillMonth(e.target.value)}/></label><label>Dia do vencimento<select className="text-input" value={billDueDay} onChange={e=>setBillDueDay(e.target.value)}>{Array.from({length:28},(_,i)=>String(i+1)).map(d=><option key={d} value={d}>{d}</option>)}</select></label><button className="secondary-btn" onClick={generateBills}>Gerar cobranças do mês</button></div><div className="table-wrap"><table><thead><tr><th>PLACA</th><th>NOME</th><th>PLANO</th><th>VALOR DO MÊS</th><th>PAGO</th><th>SALDO</th><th>SITUAÇÃO</th><th>AÇÃO</th></tr></thead><tbody>{clients.map(c=>{const b=billFor(c,billMonth);const paid=b?billPaid(b):0;const balance=b?billBalance(b):Number(c.plan==='garage'?settings.garage:settings.commercial)||0;return <tr key={c.id}><td><b className="plate-chip">{c.plate}</b></td><td>{c.name}</td><td>{c.plan==='garage'?'Garagem':'Horário comercial'}</td><td>{money(b?.amount??(c.plan==='garage'?settings.garage:settings.commercial))}</td><td>{money(paid)}</td><td><b>{money(balance)}</b></td><td><span className={`plan-chip ${balance<=0.009?'paid-chip':'pending-chip'}`}>{!b?'Cobrança não gerada':balance<=0.009?'Pago':paid>0?'Parcial':'Pendente'}</span></td><td>{b&&balance<=0.009?<span>Quitado</span>:<button className="secondary-btn" onClick={()=>{if(!b){setNotice('Clique em “Gerar cobranças do mês” antes de registrar pagamentos.');return;}setPaymentBill(b);setBillPayAmount(String(balance.toFixed(2)));setBillPayMethod('Pix');setBillPayDate(new Date().toISOString().slice(0,10));}}>Registrar pagamento</button>}</td></tr>})}</tbody></table>{clients.length===0&&<div className="empty-inline">Nenhum mensalista cadastrado.</div>}</div><p className="report-note" style={{marginTop:14}}>Para registrar pagamentos parcelados, faça mais de um lançamento na mesma cobrança. Cada lançamento reduz o saldo pendente até a quitação.</p></section>}
 {tab==='history'&&<section className="panel full-panel"><div className="panel-heading"><div><h3>Movimentações</h3><p>Histórico de saídas, cobranças e descontos registrados neste dispositivo.</p></div><span className="count-chip">{history.length} registros</span></div><div className="table-wrap"><table><thead><tr><th>DATA</th><th>PLACA</th><th>MODALIDADE</th><th>TEMPO</th><th>DESCONTO</th><th>TOTAL</th><th>PAGAMENTO</th></tr></thead><tbody>{history.map(x=><tr key={x.id}><td>{fmtDate(x.exitAt)} {fmtTime(x.exitAt)}</td><td><b className="plate-chip">{x.plate}</b></td><td>{x.chargeType}</td><td>{duration(x.minutes||0)}</td><td>{money(x.discount)}</td><td><b>{money(x.total)}</b></td><td>{x.payment}</td></tr>)}</tbody></table>{history.length===0&&<div className="empty-inline">As movimentações aparecerão após finalizar uma saída.</div>}</div></section>}
 {tab==='reports'&&<section className="panel full-panel report-print-area"><div className="panel-heading"><div><h3>Relatórios</h3><p>Escolha um relatório independente para consultar, imprimir ou salvar em PDF.</p></div><button className="primary-btn compact no-print" onClick={printReport}>Imprimir / Salvar PDF</button></div><div className="report-filters no-print"><label>Relatório<select className="text-input" value={reportType} onChange={e=>setReportType(e.target.value)}><option value="mensalistas">Mensalistas</option><option value="receber">Contas a receber</option><option value="saldo">Saldo do mês</option></select></label><label>Mês de referência<input className="text-input" type="month" value={billMonth} onChange={e=>setBillMonth(e.target.value)}/></label><button className="secondary-btn" onClick={()=>{const rows=reportType==='mensalistas'?[['Placa','Nome','Plano','Mês','Valor','Pago','Saldo','Situação'],...clients.map(c=>{const b=billFor(c,billMonth);const amount=Number(b?.amount??(c.plan==='garage'?settings.garage:settings.commercial))||0;const paid=b?billPaid(b):0;return [c.plate,c.name,c.plan,billMonth,amount,paid,Math.max(0,amount-paid),!b?'Cobrança não gerada':amount-paid<=.009?'Pago':paid?'Parcial':'Pendente'];})]:reportType==='receber'?[['Placa','Nome','Mês','Vencimento','Valor','Pago','Saldo'],...openBills.map(b=>[b.plate,b.name,b.reference,b.dueDate,b.amount,billPaid(b),billBalance(b)])]:[['Tipo','Descrição','Data','Forma','Valor'],...history.filter(x=>String(x.exitAt||'').slice(0,7)===billMonth).map(x=>['Estacionamento',x.plate,fmtDate(x.exitAt),x.payment,x.total]),...monthPayments.map(p=>['Mensalidade',`${p.plate} · ${p.name}`,p.date,p.method,p.amount])];const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));a.download=`relatorio-${reportType}-${billMonth}.csv`;a.click();URL.revokeObjectURL(a.href);}}>Exportar CSV</button></div><div className="print-heading"><h2>ESTACIONA FÁCIL</h2><h3>{reportType==='mensalistas'?'Relatório de mensalistas':reportType==='receber'?'Relatório de contas a receber':'Saldo do mês'}</h3><p>Referência: {billMonth}</p></div>{reportType==='mensalistas'&&<div className="table-wrap"><table><thead><tr><th>PLACA</th><th>NOME</th><th>PLANO</th><th>VALOR</th><th>PAGO</th><th>SALDO</th><th>SITUAÇÃO</th></tr></thead><tbody>{clients.map(c=>{const b=billFor(c,billMonth);const amount=Number(b?.amount??(c.plan==='garage'?settings.garage:settings.commercial))||0;const paid=b?billPaid(b):0;return <tr key={c.id}><td>{c.plate}</td><td>{c.name}</td><td>{c.plan==='garage'?'Garagem':'Horário comercial'}</td><td>{money(amount)}</td><td>{money(paid)}</td><td>{money(Math.max(0,amount-paid))}</td><td>{!b?'Não gerada':amount-paid<=.009?'Pago':paid?'Parcial':'Pendente'}</td></tr>})}</tbody></table></div>}{reportType==='receber'&&<div className="table-wrap"><table><thead><tr><th>PLACA</th><th>NOME</th><th>REFERÊNCIA</th><th>VENCIMENTO</th><th>VALOR</th><th>PAGO</th><th>SALDO</th></tr></thead><tbody>{openBills.map(b=><tr key={b.id}><td>{b.plate}</td><td>{b.name}</td><td>{b.reference}</td><td>{fmtDateOnly(b.dueDate)}</td><td>{money(b.amount)}</td><td>{money(billPaid(b))}</td><td>{money(billBalance(b))}</td></tr>)}</tbody></table>{openBills.length===0&&<div className="empty-inline">Nenhuma conta a receber para o mês selecionado.</div>}</div>}{reportType==='saldo'&&<><div className="balance-summary"><div><span>Recebido de rotativos e diárias</span><strong>{money(history.filter(x=>String(x.exitAt||'').slice(0,7)===billMonth).reduce((a,x)=>a+(Number(x.total)||0),0))}</strong></div><div><span>Recebido de mensalidades</span><strong>{money(monthPayments.reduce((a,p)=>a+(Number(p.amount)||0),0))}</strong></div><div><span>Total efetivamente recebido</span><strong>{money(receivedInMonth)}</strong></div><div><span>Contas de mensalistas em aberto</span><strong>{money(openBills.reduce((a,b)=>a+billBalance(b),0))}</strong></div></div><div className="table-wrap"><table><thead><tr><th>TIPO</th><th>DESCRIÇÃO</th><th>DATA</th><th>FORMA DE PAGAMENTO</th><th>VALOR RECEBIDO</th></tr></thead><tbody>{history.filter(x=>String(x.exitAt||'').slice(0,7)===billMonth).map(x=><tr key={x.id}><td>Estacionamento</td><td>{x.plate} · {x.chargeType}</td><td>{fmtDate(x.exitAt)}</td><td>{x.payment}</td><td>{money(x.total)}</td></tr>)}{monthPayments.map(p=><tr key={p.id}><td>Mensalidade</td><td>{p.plate} · {p.name} ({p.reference})</td><td>{p.date}</td><td>{p.method}</td><td>{money(p.amount)}</td></tr>)}</tbody></table></div></>}</section>}
 {tab==='settings'&&<section className="panel full-panel settings-panel"><div className="panel-heading"><div><h3>Configurações do estacionamento</h3><p>Área restrita para alterar tarifas e regras operacionais.</p></div><LockKeyhole size={22} className="muted-icon"/></div>{!unlocked?<div className="unlock-box"><div className="unlock-icon"><LockKeyhole size={25}/></div><h3>Acesso protegido</h3><p>Digite a senha administrativa para editar as configurações.</p><form onSubmit={e=>{e.preventDefault();if(password===settings.adminPassword){setUnlocked(true);setPassword('');setNotice('Configurações desbloqueadas.')}else setNotice('Senha incorreta.')}}><input type="password" className="text-input" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha de acesso"/><button className="primary-btn" type="submit">Desbloquear <span>→</span></button></form><small>Senha inicial de demonstração: 1234. Altere-a após configurar o sistema.</small></div>:<div className="settings-content"><div className="settings-section"><h4>Tarifas</h4><div className="settings-grid"><Setting label="Rotativo por hora (R$)" value={settings.hourly} onChange={v=>setSettings(s=>({...s,hourly:v}))}/><Setting label="Diária (R$)" value={settings.daily} onChange={v=>setSettings(s=>({...s,daily:v}))}/><Setting label="Mensalidade garagem (R$)" value={settings.garage} onChange={v=>setSettings(s=>({...s,garage:v}))}/><Setting label="Mensalidade comercial (R$)" value={settings.commercial} onChange={v=>setSettings(s=>({...s,commercial:v}))}/></div></div><div className="settings-section"><h4>Horário comercial</h4><div className="settings-grid"><Setting label="Abertura" type="time" value={settings.open} onChange={v=>setSettings(s=>({...s,open:v}))}/><Setting label="Fechamento" type="time" value={settings.close} onChange={v=>setSettings(s=>({...s,close:v}))}/></div></div><div className="settings-section"><h4>Segurança</h4><Setting label="Nova senha administrativa" type="password" value={settings.adminPassword} onChange={v=>setSettings(s=>({...s,adminPassword:v}))}/></div><div className="settings-section"><h4>Integração com Google Sheets</h4><div className="settings-grid"><Setting label="URL do Web App (Apps Script)" type="url" value={api.url} onChange={v=>setApi(a=>({...a,url:v}))}/><Setting label="Token de integração" type="password" value={api.token} onChange={v=>setApi(a=>({...a,token:v}))}/></div><div className="settings-actions" style={{marginTop:'12px'}}><button className="secondary-btn" onClick={loadNow} disabled={syncing}>Carregar da planilha</button><button className="primary-btn" onClick={syncNow} disabled={syncing}>Salvar na planilha</button></div><p className="report-note" style={{marginTop:'12px'}}>Status: {syncing?'sincronizando…':syncStatus==='online'?'conectado':syncStatus==='error'?'erro de conexão':'somente local'}{syncError&&<><br/>{syncError}</>}</p></div><div className="settings-actions"><button className="primary-btn"  onClick={()=>{setUnlocked(false);setNotice('Configurações salvas.')}}>Salvar e bloquear configurações</button><button className="secondary-btn" onClick={()=>{if(confirm('Apagar todas as movimentações e veículos ativos deste navegador?')){setActive([]);setHistory([]);setNotice('Movimentações apagadas.')}}}>Limpar movimentações</button></div><p className="report-note">Versão inicial: as configurações ficam salvas neste navegador. Para uso real em vários dispositivos, será necessário conectar o sistema ao Google Sheets/Apps Script.</p></div>}</section>}
 <footer className="footer"><span>ESTACIONA FÁCIL <b>·</b> Controle simples, atendimento rápido.</span><span>Dados locais de demonstração</span></footer></main>
 {checkout&&<div className="overlay" onClick={()=>setCheckout(null)}><div className="checkout-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">FINALIZAÇÃO</span><h2>Fechar estacionamento</h2></div><button className="icon-btn" onClick={()=>setCheckout(null)}><X size={20}/></button></div><div className="checkout-plate"><CarFront size={24}/><div><strong>{checkout.plate}</strong><span>{checkout.customerName||'Cliente avulso'}</span></div><span className="plan-chip">{checkout.kind==='monthly'?'Mensalista':checkout.kind==='daily'?'Diária':'Rotativo'}</span></div><div className="checkout-details"><div><span>Entrada</span><b>{fmtDate(checkout.entryAt)} · {fmtTime(checkout.entryAt)}</b></div><div><span>Tempo estacionado</span><b>{duration(calc(checkout).mins)}</b></div><div><span>Tarifa</span><b>{calc(checkout).label}</b></div><div><span>Valor original</span><b>{money(calc(checkout).gross)}</b></div></div><label className="field-label">DESCONTO EM REAIS (R$)</label><input className="text-input" value={discount} onChange={e=>setDiscount(e.target.value)} inputMode="decimal" placeholder="0,00"/><div className="total-line"><span>Total a cobrar</span><strong>{money(Math.max(0,calc(checkout).gross-Math.max(0,Math.min(calc(checkout).gross,Number(String(discount).replace(',','.'))||0))))}</strong></div><label className="field-label">FORMA DE PAGAMENTO</label><div className="payment-options">{[['Pix',Smartphone],['Dinheiro',Banknote],['Cartão',CreditCard]].map(([p,I])=><button key={p} className={payment===p?'selected':''} onClick={()=>setPayment(p)}><I size={17}/>{p}</button>)}</div><button className="primary-btn confirm-btn" onClick={finish}><CheckCircle2 size={18}/> Confirmar saída e pagamento</button><p className="helper center">O registro será salvo no histórico local deste navegador.</p></div></div>}
 {modal==='vehicle'&&<div className="overlay" onClick={()=>setModal('')}><div className="small-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">CADASTRO</span><h2>Novo mensalista</h2></div><button className="icon-btn" onClick={()=>setModal('')}><X size={20}/></button></div><p className="modal-desc">A placa é o identificador principal. Nome é obrigatório para diferenciar o cliente; telefone é opcional.</p><label className="field-label">PLACA</label><input id="cplate" className="text-input plate-text" placeholder="ABC1D23" maxLength={7} onChange={e=>e.target.value=plateFormat(e.target.value)}/><label className="field-label">NOME</label><input id="cname" className="text-input" placeholder="Nome completo"/><label className="field-label">TELEFONE (OPCIONAL)</label><input id="cphone" className="text-input" placeholder="(00) 00000-0000"/><label className="field-label">PLANO MENSAL</label><select id="cplan" className="text-input"><option value="garage">Garagem — {money(settings.garage)}/mês</option><option value="commercial">Horário comercial ({settings.open}–{settings.close}) — {money(settings.commercial)}/mês</option></select><button className="primary-btn confirm-btn" onClick={addClient}>Salvar mensalista</button></div></div>}
 {paymentBill&&<div className="overlay" onClick={()=>setPaymentBill(null)}><div className="small-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">MENSALIDADE · {paymentBill.reference}</span><h2>Registrar pagamento</h2></div><button className="icon-btn" onClick={()=>setPaymentBill(null)}><X size={20}/></button></div><div className="checkout-plate"><CarFront size={24}/><div><strong>{paymentBill.plate}</strong><span>{paymentBill.name}</span></div></div><div className="checkout-details"><div><span>Valor da mensalidade</span><b>{money(paymentBill.amount)}</b></div><div><span>Já pago</span><b>{money(billPaid(paymentBill))}</b></div><div><span>Saldo pendente</span><b>{money(billBalance(paymentBill))}</b></div></div><label className="field-label">VALOR DESTA PARCELA (R$)</label><input className="text-input" type="number" min="0.01" max={billBalance(paymentBill)} step="0.01" value={billPayAmount} onChange={e=>setBillPayAmount(e.target.value)} /><label className="field-label">DATA DO PAGAMENTO</label><input className="text-input" type="date" value={billPayDate} onChange={e=>setBillPayDate(e.target.value)}/><label className="field-label">FORMA DE PAGAMENTO</label><div className="payment-options">{['Pix','Dinheiro','Cartão'].map(m=><button key={m} className={billPayMethod===m?'selected':''} onClick={()=>setBillPayMethod(m)}>{m}</button>)}</div><button className="primary-btn confirm-btn" onClick={payBill}><CheckCircle2 size={18}/> Confirmar parcela</button><p className="helper center">Para parcelar, registre cada parcela separadamente. O saldo será atualizado automaticamente.</p></div></div>}
 {cameraOpen&&<div className="camera-overlay"><div className="camera-card"><div className="camera-head"><div><strong>Enquadre a placa</strong><span>Deixe a placa inteira dentro do quadro, de frente e bem iluminada.</span></div><button className="icon-btn" onClick={closeCamera}><X size={20}/></button></div><div className="camera-view"><video ref={cameraVideoRef} playsInline muted/><div className="plate-frame"><span/><span/><span/><span/></div><div className="camera-tip">Aproxime até a placa ocupar quase todo o quadro</div></div><div className="camera-actions"><button className="secondary-btn" onClick={closeCamera}>Cancelar</button><button className="primary-btn" onClick={captureCamera}><Camera size={18}/> Capturar placa</button></div></div></div>} {ocrBusy&&<div className="ocr-overlay"><div className="ocr-card">{ocrPreview&&<img src={ocrPreview} alt="Foto da placa"/>}<LoaderCircle className="spin" size={30}/><strong>Lendo a placa…</strong><span>O reconhecimento pode levar alguns segundos.</span></div></div>}
 {notice&&<div className="toast"><CheckCircle2 size={17}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
 </div>
}
function Stat({icon:Icon,label,value,tone}){return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={20}/></div><div><span>{label}</span><strong>{value}</strong></div></div>}
function Setting({label,value,onChange,type='number'}){
 const numeric=type==='number';
 return <label className="setting-field"><span>{label}</span><input type={type} value={value ?? ''} step={numeric?'0.01':undefined} onChange={e=>onChange(numeric?(e.target.value===''?'':Number(e.target.value)):e.target.value)}/></label>
}
