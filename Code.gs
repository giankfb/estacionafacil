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
  monthlyBills: { name: 'ContasMensalistas', headers: ['id','clienteId','placa','nome','telefone','plano','referencia','vencimento','valor','pagamentosJson','criadoEm'] }
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
  const settingsSheet = ss.getSheetByName(SHEETS.settings.name);
  if (settingsSheet.getLastRow() < 2) {
    settingsSheet.getRange(2, 1, Object.keys(DEFAULT_SETTINGS).length, 2)
      .setValues(Object.entries(DEFAULT_SETTINGS).map(([k,v]) => [k, String(v)]));
  }
  SpreadsheetApp.getUi().alert('Estrutura criada. Abas: Configuracoes, Mensalistas, EmAndamento, Movimentacoes e ContasMensalistas.');
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
  return {
    settings,
    clients: readRows_(ss, 'clients').map(r => ({ id:r[0], plate:r[1], name:r[2], phone:r[3], plan:r[4], createdAt:r[5] })),
    active: readRows_(ss, 'active').map(r => ({ id:r[0], plate:r[1], customerName:r[2], customerPhone:r[3], kind:r[4], plan:r[5] || null, entryAt:r[6] })),
    history: readRows_(ss, 'history').map(r => ({ id:r[0], plate:r[1], customerName:r[2], customerPhone:r[3], kind:r[4], plan:r[5] || null, entryAt:r[6], exitAt:r[7], minutes:Number(r[8])||0, gross:Number(r[9])||0, discount:Number(r[10])||0, total:Number(r[11])||0, payment:r[12], chargeType:r[13] })),
    monthlyBills: readRows_(ss, 'monthlyBills').map(r => ({ id:r[0], clientId:r[1], plate:r[2], name:r[3], phone:r[4], plan:r[5], reference:r[6], dueDate:r[7], amount:Number(r[8])||0, payments:parseJson_(r[9], []), createdAt:r[10] }))
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
    writeRows_(ss, 'monthlyBills', (state.monthlyBills||[]).map(b => [b.id,b.clientId,b.plate,b.name,b.phone,b.plan,b.reference,b.dueDate,b.amount,JSON.stringify(b.payments||[]),b.createdAt]));
  } finally { lock.releaseLock(); }
}

function parseJson_(value, fallback) { try { return value ? JSON.parse(String(value)) : fallback; } catch (e) { return fallback; } }

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
