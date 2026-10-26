/** Estaciona Fácil — API inicial para Google Sheets
 * Cria as abas e fornece leitura/gravação do estado do aplicativo.
 * Antes de publicar: defina APP_TOKEN com uma chave longa e exclusiva.
 */
const APP_NAME = 'Estaciona Fácil';
const APP_TOKEN = 'TROQUE_POR_UMA_CHAVE_LONGA_E_EXCLUSIVA';
const SHEETS = {
  settings: { name: 'Configuracoes', headers: ['chave', 'valor'] },
  clients: { name: 'Mensalistas', headers: ['id', 'placa', 'nome', 'telefone', 'plano', 'criadoEm'] },
  active: { name: 'EmAndamento', headers: ['id', 'placa', 'nomeCliente', 'telefone', 'modalidade', 'plano', 'entradaEm'] },
  history: { name: 'Movimentacoes', headers: ['id', 'placa', 'nomeCliente', 'telefone', 'modalidade', 'plano', 'entradaEm', 'saidaEm', 'minutos', 'valorBruto', 'desconto', 'total', 'pagamento', 'tipoCobranca'] },
  monthlyBills: { name: 'ContasMensalistas', headers: ['id','clienteId','placa','nome','telefone','plano','referencia','vencimento','valor','criadoEm'] },
  monthlyPayments: { name: 'PagamentosMensalistas', headers: ['id','contaId','clienteId','placa','nome','referencia','data','valor','formaPagamento','criadoEm'] }
};
const DEFAULT_SETTINGS = { hourly: 6, daily: 40, garage: 400, commercial: 200, open: '08:00', close: '18:00', adminPassword: '1234' };

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : '';
  if (action === 'ping') return json_({ ok: true, app: APP_NAME, version: '1.0' });
  if (action !== 'read') return json_({ ok: false, error: 'Ação inválida. Use action=read.' });
  try { return json_({ ok: true, state: readState_() }); }
  catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!APP_TOKEN || APP_TOKEN === 'TROQUE_POR_UMA_CHAVE_LONGA_E_EXCLUSIVA' || body.token !== APP_TOKEN) {
      return json_({ ok: false, error: 'Token inválido. Configure APP_TOKEN no Apps Script e envie o mesmo token pelo aplicativo.' });
    }
    if (body.action !== 'save') return json_({ ok: false, error: 'Ação inválida.' });
    saveState_(body.state || {});
    return json_({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}

function setupEstacionaFacil() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Abra este Apps Script a partir da planilha Estaciona Fácil (Extensões > Apps Script).');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Object.keys(SHEETS).forEach(key => {
    const def = SHEETS[key];
    let sh = ss.getSheetByName(def.name);
    if (!sh) sh = ss.insertSheet(def.name);
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, def.headers.length).setFontWeight('bold').setBackground('#10233f').setFontColor('#ffffff');
    sh.autoResizeColumns(1, def.headers.length);
  });
  // Converte registros antigos que guardavam vários pagamentos em uma célula JSON
  // para uma linha independente por pagamento. IDs existentes são preservados.
  migrateLegacyMonthlyPayments_(ss);

  const settingsSheet = ss.getSheetByName(SHEETS.settings.name);
  if (settingsSheet.getLastRow() < 2) {
    settingsSheet.getRange(2, 1, Object.keys(DEFAULT_SETTINGS).length, 2)
      .setValues(Object.entries(DEFAULT_SETTINGS).map(([k,v]) => [k, String(v)]));
  }
  SpreadsheetApp.getUi().alert('Estrutura criada. Abas: Configuracoes, Mensalistas, EmAndamento, Movimentacoes, ContasMensalistas e PagamentosMensalistas.');
}

function readState_() {
  const ss = getSpreadsheet_();
  const settings = { ...DEFAULT_SETTINGS };
  const cfg = ss.getSheetByName(SHEETS.settings.name);
  if (cfg && cfg.getLastRow() > 1) {
    cfg.getRange(2, 1, cfg.getLastRow()-1, 2).getValues().forEach(([k,v]) => {
      if (k) settings[k] = parseSetting_(k, v);
    });
  }
  const monthlyPayments = readRows_(ss, 'monthlyPayments').map(r => ({
    id:String(r[0]), billId:String(r[1]), clientId:String(r[2] || ''), plate:String(r[3] || ''),
    name:String(r[4] || ''), reference:normalizeMonth_(r[5]), date:normalizeDate_(r[6]),
    amount:Number(r[7])||0, method:String(r[8] || ''), createdAt:normalizeDateTime_(r[9])
  }));
  const monthlyBills = readRows_(ss, 'monthlyBills').map(r => ({
    id:String(r[0]), clientId:String(r[1]), plate:String(r[2] || ''), name:String(r[3] || ''),
    phone:String(r[4] || ''), plan:String(r[5] || ''), reference:normalizeMonth_(r[6]),
    dueDate:normalizeDate_(r[7]), amount:Number(r[8])||0, createdAt:normalizeDateTime_(r[9]), payments:[]
  }));
  const paymentsByBill = {};
  monthlyPayments.forEach(function(p) {
    const billId = String(p.billId || '');
    if (!paymentsByBill[billId]) {
      paymentsByBill[billId] = [];
    }
    paymentsByBill[billId].push({
      id: p.id,
      date: p.date,
      amount: p.amount,
      method: p.method,
      createdAt: p.createdAt
    });
  });
  monthlyBills.forEach(function(b) {
    b.payments = paymentsByBill[String(b.id)] || [];
  });
  return {
    settings,
    clients: readRows_(ss, 'clients').map(r => ({ id:r[0], plate:r[1], name:r[2], phone:r[3], plan:r[4], createdAt:r[5] })),
    active: readRows_(ss, 'active').map(r => ({ id:r[0], plate:r[1], customerName:r[2], customerPhone:r[3], kind:r[4], plan:r[5] || null, entryAt:r[6] })),
    history: readRows_(ss, 'history').map(r => ({ id:r[0], plate:r[1], customerName:r[2], customerPhone:r[3], kind:r[4], plan:r[5] || null, entryAt:r[6], exitAt:r[7], minutes:Number(r[8])||0, gross:Number(r[9])||0, discount:Number(r[10])||0, total:Number(r[11])||0, payment:r[12], chargeType:r[13] })),
    monthlyBills
  };
}

function saveState_(state) {
  const ss = getSpreadsheet_();
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (state.settings && typeof state.settings === 'object') {
      const sh = ss.getSheetByName(SHEETS.settings.name);
      const rows = Object.entries(state.settings).map(([k,v]) => [k, String(v)]);
      sh.clearContents();
      sh.getRange(1,1,1,2).setValues([SHEETS.settings.headers]);
      // Horários devem ser armazenados como TEXTO. Caso a célula esteja
      // formatada como hora, o Google Sheets devolve um objeto Date (1899),
      // e o aplicativo acaba exibindo "Sat Dec 30 1899...".
      sh.getRange(1,1,Math.max(2, rows.length + 1),2).setNumberFormat('@');
      if (rows.length) sh.getRange(2,1,rows.length,2).setValues(rows);
    }
    writeRows_(ss, 'clients', (state.clients||[]).map(c => [c.id,c.plate,c.name,c.phone,c.plan,c.createdAt]));
    writeRows_(ss, 'active', (state.active||[]).map(v => [v.id,v.plate,v.customerName,v.customerPhone,v.kind,v.plan||'',v.entryAt]));
    writeRows_(ss, 'history', (state.history||[]).map(x => [x.id,x.plate,x.customerName,x.customerPhone,x.kind,x.plan||'',x.entryAt,x.exitAt,x.minutes,x.gross,x.discount,x.total,x.payment,x.chargeType]));
    const bills = state.monthlyBills || [];
    writeRows_(ss, 'monthlyBills', bills.map(b => [b.id,b.clientId,b.plate,b.name,b.phone,b.plan,b.reference,b.dueDate,b.amount,b.createdAt]));
    // Cada pagamento é uma linha própria, vinculada à cobrança por contaId.
    const paymentRows = [];
    bills.forEach(b => (b.payments || []).forEach(p => paymentRows.push([
      p.id || Utilities.getUuid(), b.id, b.clientId, b.plate, b.name, b.reference,
      p.date, Number(p.amount) || 0, p.method || '', p.createdAt || new Date().toISOString()
    ])));
    writeRows_(ss, 'monthlyPayments', paymentRows);
  } finally { lock.releaseLock(); }
}

function migrateLegacyMonthlyPayments_(ss) {
  const billsSheet = ss.getSheetByName(SHEETS.monthlyBills.name);
  const paymentsSheet = ss.getSheetByName(SHEETS.monthlyPayments.name);
  if (!billsSheet || billsSheet.getLastRow() < 1 || !paymentsSheet) return;
  const header = billsSheet.getRange(1, 1, 1, billsSheet.getLastColumn()).getDisplayValues()[0];
  const legacyIndex = header.indexOf('pagamentosJson');
  if (legacyIndex < 0) return; // Já está no formato normalizado.

  const existingIds = new Set();
  if (paymentsSheet.getLastRow() > 1) {
    paymentsSheet.getRange(2, 1, paymentsSheet.getLastRow() - 1, 1).getDisplayValues().flat().forEach(id => existingIds.add(String(id)));
  }
  const oldRows = billsSheet.getLastRow() > 1
    ? billsSheet.getRange(2, 1, billsSheet.getLastRow() - 1, billsSheet.getLastColumn()).getValues()
    : [];
  const normalizedBills = [];
  const paymentsToAdd = [];
  oldRows.forEach(r => {
    if (!r[0]) return;
    normalizedBills.push([r[0],r[1],r[2],r[3],r[4],r[5],normalizeMonth_(r[6]),normalizeDate_(r[7]),Number(r[8])||0,r[10]||'']);
    parseJson_(r[legacyIndex], []).forEach(p => {
      const id = String(p.id || Utilities.getUuid());
      if (existingIds.has(id)) return;
      existingIds.add(id);
      paymentsToAdd.push([id,String(r[0]),String(r[1]||''),String(r[2]||''),String(r[3]||''),normalizeMonth_(r[6]),normalizeDate_(p.date),Number(p.amount)||0,String(p.method||''),p.createdAt||new Date().toISOString()]);
    });
  });
  if (paymentsToAdd.length) {
    const start = paymentsSheet.getLastRow() + 1;
    paymentsSheet.getRange(start, 1, paymentsToAdd.length, SHEETS.monthlyPayments.headers.length).setValues(paymentsToAdd);
  }
  billsSheet.clearContents();
  billsSheet.getRange(1,1,1,SHEETS.monthlyBills.headers.length).setValues([SHEETS.monthlyBills.headers]);
  if (normalizedBills.length) billsSheet.getRange(2,1,normalizedBills.length,SHEETS.monthlyBills.headers.length).setValues(normalizedBills);
  billsSheet.getRange(1,7,Math.max(2,normalizedBills.length+1),2).setNumberFormat('@');
  billsSheet.setFrozenRows(1);
}

function parseJson_(value, fallback) { try { return value ? JSON.parse(String(value)) : fallback; } catch (e) { return fallback; } }

// Normaliza valores antigos que o Google Sheets possa ter convertido em datas.
function normalizeMonth_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM');
  }
  const s = String(value == null ? '' : value).trim();
  const m = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime()) && s) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM');
  return s;
}
function normalizeDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(value == null ? '' : value).trim();
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  return s;
}
function normalizeDateTime_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value.toISOString();
  return String(value == null ? '' : value);
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Execute setupEstacionaFacil() na planilha vinculada.');
  return ss;
}
function readRows_(ss, key) {
  const sh = ss.getSheetByName(SHEETS[key].name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,SHEETS[key].headers.length).getValues().filter(r => r[0] !== '' && r[0] != null);
}
function writeRows_(ss, key, rows) {
  const def = SHEETS[key]; let sh = ss.getSheetByName(def.name);
  if (!sh) sh = ss.insertSheet(def.name);
  // Limpa somente o conteúdo; formatação/layout da planilha é preservado.
  sh.clearContents(); sh.getRange(1,1,1,def.headers.length).setValues([def.headers]);

  if (key === 'monthlyBills') {
    // Evita que o Sheets converta referência como 2026-10 em data.
    sh.getRange(1, 7, Math.max(2, rows.length + 1), 2).setNumberFormat('@');
  }
  if (key === 'monthlyPayments') {
    // Referência mensal, data e forma são texto explícito; valor permanece numérico.
    sh.getRange(1, 6, Math.max(2, rows.length + 1), 2).setNumberFormat('@');
    sh.getRange(1, 9, Math.max(2, rows.length + 1), 1).setNumberFormat('@');
  }
  if (rows.length) sh.getRange(2,1,rows.length,def.headers.length).setValues(rows.map(r => r.map(v => v == null ? '' : v)));
  sh.setFrozenRows(1);
}
function parseSetting_(key, value) {
  if (['hourly','daily','garage','commercial'].includes(key)) return Number(value) || 0;
  // O Sheets pode devolver uma célula de horário como Date (data base 1899).
  if (['open','close'].includes(key) && Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(value == null ? '' : value);
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
