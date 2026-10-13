import React, { useEffect, useMemo, useState } from 'react';
import { CarFront, Gauge, Users, History, ChartNoAxesCombined, Settings, LockKeyhole, Search, Plus, LogOut, Clock3, CircleDollarSign, CheckCircle2, X, ParkingCircle, CreditCard, Banknote, Smartphone, Trash2 } from 'lucide-react';

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
const minutesBetween = (a,b) => Math.max(0, Math.floor((new Date(b).getTime()-new Date(a).getTime())/60000));
const duration = mins => `${Math.floor(mins/60)}h ${String(mins%60).padStart(2,'0')}min`;
const fmtTime = iso => new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const fmtDate = iso => new Date(iso).toLocaleDateString('pt-BR');

export default function App(){
 const [tab,setTab]=useState('pdv');
 const [settings,setSettings]=useState(()=>read('ef_settings',DEFAULTS));
 const [active,setActive]=useState(()=>read('ef_active',[]));
 const [clients,setClients]=useState(()=>read('ef_clients',[]));
 const [history,setHistory]=useState(()=>read('ef_history',[]));
 const [api,setApi]=useState(()=>apiRead());
 const [syncing,setSyncing]=useState(false);
 const [syncStatus,setSyncStatus]=useState('local');
 const [syncError,setSyncError]=useState('');
 const [remoteLoaded,setRemoteLoaded]=useState(false);
 const [plate,setPlate]=useState(''); const [clientName,setClientName]=useState(''); const [clientPhone,setClientPhone]=useState('');
 const [kind,setKind]=useState('hourly'); const [search,setSearch]=useState(''); const [checkout,setCheckout]=useState(null); const [discount,setDiscount]=useState('0'); const [payment,setPayment]=useState('Pix');
 const [modal,setModal]=useState(''); const [password,setPassword]=useState(''); const [unlocked,setUnlocked]=useState(false); const [notice,setNotice]=useState('');
 useEffect(()=>localStorage.setItem('ef_settings',JSON.stringify(settings)),[settings]);
 useEffect(()=>localStorage.setItem('ef_active',JSON.stringify(active)),[active]);
 useEffect(()=>localStorage.setItem('ef_clients',JSON.stringify(clients)),[clients]);
 useEffect(()=>localStorage.setItem('ef_history',JSON.stringify(history)),[history]);
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
    if(s.settings)setSettings(s.settings);
    if(Array.isArray(s.clients))setClients(s.clients);
    if(Array.isArray(s.active))setActive(s.active);
    if(Array.isArray(s.history))setHistory(s.history);
    setSyncStatus('online'); setNotice('Dados carregados da planilha.');
   }catch(err){
    if(!cancelled){setSyncStatus('error');setSyncError(err.message||'Falha ao carregar a planilha.');}
   }finally{if(!cancelled){setSyncing(false);setRemoteLoaded(true);}}
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
      state:{settings,clients,active,history}
    })});
    setSyncStatus('online');
   }catch(err){setSyncStatus('error');setSyncError(err.message||'Falha ao salvar na planilha.');}
   finally{setSyncing(false);}
  },900);
  return()=>clearTimeout(timer);
 },[api.url,api.token,remoteLoaded,settings,clients,active,history]);

 useEffect(()=>{ if(!notice)return; const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t)},[notice]);
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
 const addClient=()=>{const p=plateFormat(document.getElementById('cplate')?.value||'');const name=document.getElementById('cname')?.value?.trim()||'';const phone=document.getElementById('cphone')?.value?.trim()||'';const plan=document.getElementById('cplan')?.value||'garage';if(p.length!==7||!name){setNotice('Informe uma placa válida e o nome do mensalista.');return;}setClients(cs=>[{id:crypto.randomUUID(),plate:p,name,phone,plan,createdAt:new Date().toISOString()},...cs.filter(c=>c.plate!==p)]);setModal('');setNotice('Mensalista cadastrado com sucesso.');};
 const syncNow=async()=>{
  if(!api.url||!api.token){setNotice('Configure a URL do Apps Script e o token antes de sincronizar.');return;}
  setSyncing(true);setSyncError('');
  try{
   await apiRequest(api.url,{method:'POST',body:JSON.stringify({token:api.token,action:'save',state:{settings,clients,active,history}})});
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
   if(s.settings)setSettings(s.settings);
   if(Array.isArray(s.clients))setClients(s.clients);
   if(Array.isArray(s.active))setActive(s.active);
   if(Array.isArray(s.history))setHistory(s.history);
   setSyncStatus('online');setNotice('Dados recarregados da planilha.');
  }catch(err){setSyncStatus('error');setSyncError(err.message||'Falha ao carregar.');setNotice('Não foi possível carregar a planilha.');}
  finally{setSyncing(false);}
 };
 const nav=[['pdv','PDV / Operação',Gauge],['vehicles','Veículos',CarFront],['monthly','Mensalistas',Users],['history','Movimentações',History],['reports','Relatórios',ChartNoAxesCombined],['settings','Configurações',Settings]];
 const filteredActive=active.filter(v=>(v.plate+' '+v.customerName).toLowerCase().includes(search.toLowerCase()));
 const totalsByType=useMemo(()=>({hourly:history.filter(x=>x.chargeType==='Rotativo').reduce((s,x)=>s+x.total,0),daily:history.filter(x=>x.chargeType==='Diária').reduce((s,x)=>s+x.total,0)}),[history]);
 return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-icon"><ParkingCircle size={27}/></div><div><strong>ESTACIONA</strong><span>FÁCIL · ROTATIVO</span></div></div><div className="side-caption">MENU PRINCIPAL</div><nav>{nav.map(([id,label,Icon])=><button key={id} className={`nav-item ${tab===id?'active':''}`} onClick={()=>{setTab(id);setSearch('')}}><Icon size={18}/><span>{label}</span>{id==='settings'&&<LockKeyhole size={13} className="lock"/>}</button>)}</nav><div className="sidebar-bottom"><div className="status-dot"/> Sistema operacional <span className="version">v0.2</span></div></aside>
 <main className="main"><header className="topbar"><div><div className="eyebrow">CONTROLE DE ESTACIONAMENTO</div><h1>{nav.find(n=>n[0]===tab)?.[1]||'PDV / Operação'}</h1></div><div className="top-right"><span className="today-label">{new Date().toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}</span><div className="avatar">OP</div></div></header>
 {tab==='pdv'&&<><div className="welcome"><div><h2>Vamos atender o próximo veículo.</h2><p>Registre a entrada pela placa. O sistema cuida do tempo e do cálculo.</p></div><div className="live-pill"><span/> OPERAÇÃO ATIVA</div></div><div className="stats-grid"><Stat icon={CarFront} label="Veículos no pátio" value={active.length} tone="blue"/><Stat icon={CircleDollarSign} label="Faturamento hoje" value={money(totalToday)} tone="green"/><Stat icon={CheckCircle2} label="Saídas hoje" value={todayHistory.length} tone="purple"/></div><div className="work-grid"><section className="panel entry-panel"><div className="panel-heading"><div><h3>Registrar entrada</h3><p>Preencha a placa para iniciar a contagem.</p></div><span className="step-badge">01</span></div><label className="field-label">PLACA DO VEÍCULO</label><div className="plate-input-wrap"><CarFront size={22}/><input value={plate} onChange={e=>setPlate(plateFormat(e.target.value))} onKeyDown={e=>e.key==='Enter'&&start()} placeholder="ABC1D23" maxLength={7}/><span>{plate.length}/7</span></div><div className="field-row"><div><label className="field-label">NOME DO CLIENTE <em>OPCIONAL</em></label><input className="text-input" value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Nome do cliente"/></div><div><label className="field-label">TELEFONE <em>OPCIONAL</em></label><input className="text-input" value={clientPhone} onChange={e=>setClientPhone(e.target.value)} placeholder="(00) 00000-0000"/></div></div><label className="field-label">MODALIDADE DE COBRANÇA</label><div className="type-options"><button className={kind==='hourly'?'selected':''} onClick={()=>setKind('hourly')}><Clock3 size={18}/><span><b>Rotativo</b><small>R$ {Number(settings.hourly).toFixed(2).replace('.',',')} / hora</small></span></button><button className={kind==='daily'?'selected':''} onClick={()=>setKind('daily')}><ParkingCircle size={18}/><span><b>Diária</b><small>{money(settings.daily)} · 8h–18h</small></span></button></div><button className="primary-btn start-btn" onClick={start}><Plus size={19}/> Registrar entrada <span>→</span></button><p className="helper"><LockKeyhole size={13}/> Mensalistas cadastrados são identificados automaticamente pela placa.</p></section>
 <section className="panel yard-panel"><div className="panel-heading"><div><h3>Veículos no pátio <span className="count-chip">{active.length}</span></h3><p>Tempo atualizado ao consultar ou finalizar.</p></div><div className="searchbox"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar placa..."/></div></div>{filteredActive.length===0?<div className="empty-state"><div className="empty-icon"><CarFront size={29}/></div><b>Nenhum veículo encontrado</b><p>Os veículos registrados aparecerão aqui.</p></div>:<div className="vehicle-list">{filteredActive.map(v=>{const c=calc(v);return <div className="vehicle-row" key={v.id}><div className="vehicle-symbol"><CarFront size={20}/></div><div className="vehicle-info"><strong>{v.plate}</strong><span>{v.customerName||'Cliente avulso'} · {v.kind==='monthly'?'Mensalista':v.kind==='daily'?'Diária':'Rotativo'}</span></div><div className="elapsed"><b>{duration(c.mins)}</b><span>Entrada {fmtTime(v.entryAt)}</span></div><button className="finish-btn" onClick={()=>beginCheckout(v)}>Finalizar <span>→</span></button></div>})}</div>}<div className="yard-footer"><span><span className="mini-dot"/> Contagem iniciada no registro de entrada</span><span>Atualizado em tempo real ao operar</span></div></section></div></>}
 {tab==='vehicles'&&<section className="panel full-panel"><div className="panel-heading"><div><h3>Veículos cadastrados</h3><p>Cadastro básico por placa; dados pessoais são opcionais.</p></div><button className="primary-btn compact" onClick={()=>setModal('vehicle')}><Plus size={16}/> Novo cadastro</button></div><div className="searchbox wide"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por placa ou nome..."/></div><div className="table-wrap"><table><thead><tr><th>PLACA</th><th>CLIENTE</th><th>TELEFONE</th><th>PLANO</th></tr></thead><tbody>{clients.filter(c=>(c.plate+' '+c.name+' '+c.phone).toLowerCase().includes(search.toLowerCase())).map(c=><tr key={c.id}><td><b className="plate-chip">{c.plate}</b></td><td>{c.name}</td><td>{c.phone||'—'}</td><td><span className="plan-chip">{c.plan==='garage'?'Mensal · Garagem':'Mensal · Comercial'}</span></td></tr>)}</tbody></table>{clients.length===0&&<div className="empty-inline">Nenhum cadastro ainda.</div>}</div></section>}
 {tab==='monthly'&&<section className="panel full-panel"><div className="panel-heading"><div><h3>Mensalistas</h3><p>Planos reconhecidos automaticamente pela placa.</p></div><button className="primary-btn compact" onClick={()=>setModal('vehicle')}><Plus size={16}/> Cadastrar mensalista</button></div><div className="monthly-cards"><div className="monthly-card"><span>GARAGEM</span><strong>{money(settings.garage)}<small>/mês</small></strong><p>Acesso integral conforme contrato.</p></div><div className="monthly-card commercial"><span>HORÁRIO COMERCIAL</span><strong>{money(settings.commercial)}<small>/mês</small></strong><p>Utilização das {settings.open} às {settings.close}.</p></div></div><div className="table-wrap"><table><thead><tr><th>PLACA</th><th>NOME</th><th>TELEFONE</th><th>PLANO</th></tr></thead><tbody>{clients.map(c=><tr key={c.id}><td><b className="plate-chip">{c.plate}</b></td><td>{c.name}</td><td>{c.phone||'—'}</td><td>{c.plan==='garage'?'Garagem':'Horário comercial'}</td></tr>)}</tbody></table>{clients.length===0&&<div className="empty-inline">Cadastre os mensalistas para reconhecê-los pela placa.</div>}</div></section>}
 {tab==='history'&&<section className="panel full-panel"><div className="panel-heading"><div><h3>Movimentações</h3><p>Histórico de saídas, cobranças e descontos registrados neste dispositivo.</p></div><span className="count-chip">{history.length} registros</span></div><div className="table-wrap"><table><thead><tr><th>DATA</th><th>PLACA</th><th>MODALIDADE</th><th>TEMPO</th><th>DESCONTO</th><th>TOTAL</th><th>PAGAMENTO</th></tr></thead><tbody>{history.map(x=><tr key={x.id}><td>{fmtDate(x.exitAt)} {fmtTime(x.exitAt)}</td><td><b className="plate-chip">{x.plate}</b></td><td>{x.chargeType}</td><td>{duration(x.minutes||0)}</td><td>{money(x.discount)}</td><td><b>{money(x.total)}</b></td><td>{x.payment}</td></tr>)}</tbody></table>{history.length===0&&<div className="empty-inline">As movimentações aparecerão após finalizar uma saída.</div>}</div></section>}
 {tab==='reports'&&<><div className="stats-grid report-stats"><Stat icon={CircleDollarSign} label="Faturamento total registrado" value={money(history.reduce((s,x)=>s+x.total,0))} tone="green"/><Stat icon={Clock3} label="Rotativo" value={money(totalsByType.hourly)} tone="blue"/><Stat icon={ParkingCircle} label="Diárias" value={money(totalsByType.daily)} tone="purple"/></div><section className="panel full-panel"><div className="panel-heading"><div><h3>Resumo das operações</h3><p>Valores baseados nas saídas registradas neste dispositivo.</p></div><button className="secondary-btn" onClick={()=>{const rows=[['Data','Placa','Modalidade','Minutos','Valor bruto','Desconto','Total','Pagamento'],...history.map(x=>[fmtDate(x.exitAt),x.plate,x.chargeType,x.minutes,x.gross,x.discount,x.total,x.payment])];const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));a.download='movimentacoes-estacionamento.csv';a.click();URL.revokeObjectURL(a.href)}}>Exportar CSV</button></div><p className="report-note">Os valores são calculados por modalidade; mensalidades cadastradas não são lançadas como recebimento automaticamente nesta versão inicial.</p></section></>}
 {tab==='settings'&&<section className="panel full-panel settings-panel"><div className="panel-heading"><div><h3>Configurações do estacionamento</h3><p>Área restrita para alterar tarifas e regras operacionais.</p></div><LockKeyhole size={22} className="muted-icon"/></div>{!unlocked?<div className="unlock-box"><div className="unlock-icon"><LockKeyhole size={25}/></div><h3>Acesso protegido</h3><p>Digite a senha administrativa para editar as configurações.</p><form onSubmit={e=>{e.preventDefault();if(password===settings.adminPassword){setUnlocked(true);setPassword('');setNotice('Configurações desbloqueadas.')}else setNotice('Senha incorreta.')}}><input type="password" className="text-input" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha de acesso"/><button className="primary-btn" type="submit">Desbloquear <span>→</span></button></form><small>Senha inicial de demonstração: 1234. Altere-a após configurar o sistema.</small></div>:<div className="settings-content"><div className="settings-section"><h4>Tarifas</h4><div className="settings-grid"><Setting label="Rotativo por hora (R$)" value={settings.hourly} onChange={v=>setSettings(s=>({...s,hourly:v}))}/><Setting label="Diária (R$)" value={settings.daily} onChange={v=>setSettings(s=>({...s,daily:v}))}/><Setting label="Mensalidade garagem (R$)" value={settings.garage} onChange={v=>setSettings(s=>({...s,garage:v}))}/><Setting label="Mensalidade comercial (R$)" value={settings.commercial} onChange={v=>setSettings(s=>({...s,commercial:v}))}/></div></div><div className="settings-section"><h4>Horário comercial</h4><div className="settings-grid"><Setting label="Abertura" type="time" value={settings.open} onChange={v=>setSettings(s=>({...s,open:v}))}/><Setting label="Fechamento" type="time" value={settings.close} onChange={v=>setSettings(s=>({...s,close:v}))}/></div></div><div className="settings-section"><h4>Segurança</h4><Setting label="Nova senha administrativa" type="password" value={settings.adminPassword} onChange={v=>setSettings(s=>({...s,adminPassword:v}))}/></div><div className="settings-section"><h4>Integração com Google Sheets</h4><div className="settings-grid"><Setting label="URL do Web App (Apps Script)" type="url" value={api.url} onChange={v=>setApi(a=>({...a,url:v}))}/><Setting label="Token de integração" type="password" value={api.token} onChange={v=>setApi(a=>({...a,token:v}))}/></div><div className="settings-actions" style={{marginTop:'12px'}}><button className="secondary-btn" onClick={loadNow} disabled={syncing}>Carregar da planilha</button><button className="primary-btn" onClick={syncNow} disabled={syncing}>Salvar na planilha</button></div><p className="report-note" style={{marginTop:'12px'}}>Status: {syncing?'sincronizando…':syncStatus==='online'?'conectado':syncStatus==='error'?'erro de conexão':'somente local'}{syncError&&<><br/>{syncError}</>}</p></div><div className="settings-actions"><button className="primary-btn"  onClick={()=>{setUnlocked(false);setNotice('Configurações salvas.')}}>Salvar e bloquear configurações</button><button className="secondary-btn" onClick={()=>{if(confirm('Apagar todas as movimentações e veículos ativos deste navegador?')){setActive([]);setHistory([]);setNotice('Movimentações apagadas.')}}}>Limpar movimentações</button></div><p className="report-note">Versão inicial: as configurações ficam salvas neste navegador. Para uso real em vários dispositivos, será necessário conectar o sistema ao Google Sheets/Apps Script.</p></div>}</section>}
 <footer className="footer"><span>ESTACIONA FÁCIL <b>·</b> Controle simples, atendimento rápido.</span><span>Dados locais de demonstração</span></footer></main>
 {checkout&&<div className="overlay" onClick={()=>setCheckout(null)}><div className="checkout-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">FINALIZAÇÃO</span><h2>Fechar estacionamento</h2></div><button className="icon-btn" onClick={()=>setCheckout(null)}><X size={20}/></button></div><div className="checkout-plate"><CarFront size={24}/><div><strong>{checkout.plate}</strong><span>{checkout.customerName||'Cliente avulso'}</span></div><span className="plan-chip">{checkout.kind==='monthly'?'Mensalista':checkout.kind==='daily'?'Diária':'Rotativo'}</span></div><div className="checkout-details"><div><span>Entrada</span><b>{fmtDate(checkout.entryAt)} · {fmtTime(checkout.entryAt)}</b></div><div><span>Tempo estacionado</span><b>{duration(calc(checkout).mins)}</b></div><div><span>Tarifa</span><b>{calc(checkout).label}</b></div><div><span>Valor original</span><b>{money(calc(checkout).gross)}</b></div></div><label className="field-label">DESCONTO EM REAIS (R$)</label><input className="text-input" value={discount} onChange={e=>setDiscount(e.target.value)} inputMode="decimal" placeholder="0,00"/><div className="total-line"><span>Total a cobrar</span><strong>{money(Math.max(0,calc(checkout).gross-Math.max(0,Math.min(calc(checkout).gross,Number(String(discount).replace(',','.'))||0))))}</strong></div><label className="field-label">FORMA DE PAGAMENTO</label><div className="payment-options">{[['Pix',Smartphone],['Dinheiro',Banknote],['Cartão',CreditCard]].map(([p,I])=><button key={p} className={payment===p?'selected':''} onClick={()=>setPayment(p)}><I size={17}/>{p}</button>)}</div><button className="primary-btn confirm-btn" onClick={finish}><CheckCircle2 size={18}/> Confirmar saída e pagamento</button><p className="helper center">O registro será salvo no histórico local deste navegador.</p></div></div>}
 {modal==='vehicle'&&<div className="overlay" onClick={()=>setModal('')}><div className="small-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">CADASTRO</span><h2>Novo mensalista</h2></div><button className="icon-btn" onClick={()=>setModal('')}><X size={20}/></button></div><p className="modal-desc">A placa é o identificador principal. Nome é obrigatório para diferenciar o cliente; telefone é opcional.</p><label className="field-label">PLACA</label><input id="cplate" className="text-input plate-text" placeholder="ABC1D23" maxLength={7} onChange={e=>e.target.value=plateFormat(e.target.value)}/><label className="field-label">NOME</label><input id="cname" className="text-input" placeholder="Nome completo"/><label className="field-label">TELEFONE (OPCIONAL)</label><input id="cphone" className="text-input" placeholder="(00) 00000-0000"/><label className="field-label">PLANO MENSAL</label><select id="cplan" className="text-input"><option value="garage">Garagem — {money(settings.garage)}/mês</option><option value="commercial">Horário comercial ({settings.open}–{settings.close}) — {money(settings.commercial)}/mês</option></select><button className="primary-btn confirm-btn" onClick={addClient}>Salvar mensalista</button></div></div>}
 {notice&&<div className="toast"><CheckCircle2 size={17}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
 </div>
}
function Stat({icon:Icon,label,value,tone}){return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={20}/></div><div><span>{label}</span><strong>{value}</strong></div></div>}
function Setting({label,value,onChange,type='number'}){
 const numeric=type==='number';
 return <label className="setting-field"><span>{label}</span><input type={type} value={value ?? ''} step={numeric?'0.01':undefined} onChange={e=>onChange(numeric?(e.target.value===''?'':Number(e.target.value)):e.target.value)}/></label>
}
