const SHEET_NAME = 'SheetsTracker';
const SHARED_TOKEN = 'bt_X9f82KqLmP47sZ1aYvT0rNcW8G2uH5';
const ALLOWED_TYPES = ['האכלה', 'פיפי', 'קקי', 'ויטמינים', 'הערה'];

function doGet(e) {
  try {
    const token = String((e.parameter && e.parameter.token) || '');
    if (token !== SHARED_TOKEN) {
      return json({ ok: false, error: 'Unauthorized' });
    }

    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    if (!values.length) {
      return json({ ok: true, data: [] });
    }

    const headers = values[0].map(String);
    const rows = values.slice(1).filter(row => row.some(cell => cell !== ''));

    const data = rows.map(row => rowToObject_(headers, row));
    return json({ ok: true, data });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (String(body.token || '') !== SHARED_TOKEN) {
      return json({ ok: false, error: 'Unauthorized' });
    }

    const action = String(body.action || '');
    if (action === 'save') {
      return saveEntry_(body.entry || {});
    }
    if (action === 'delete') {
      return deleteEntry_(String(body.id || ''));
    }

    return json({ ok: false, error: 'Invalid action' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function saveEntry_(entry) {
  const clean = validateEntry_(entry);
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);

  const idCol = headers.indexOf('id') + 1;
  const updatedCol = headers.indexOf('updatedAt') + 1;
  if (!idCol || !updatedCol) throw new Error('Missing required columns');

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === clean.id) {
        const currentUpdated = String(sheet.getRange(i + 2, updatedCol).getValue() || '');
        if (new Date(clean.updatedAt).getTime() >= new Date(currentUpdated || 0).getTime()) {
          const rowValues = headers.map(function(h) { return toSheetValue_(clean[h]); });
          sheet.getRange(i + 2, 1, 1, headers.length).setValues([rowValues]);
        }
        return json({ ok: true, updated: true, id: clean.id });
      }
    }
  }

  const rowValues = headers.map(function(h) { return toSheetValue_(clean[h]); });
  sheet.appendRow(rowValues);
  return json({ ok: true, created: true, id: clean.id });
}

function deleteEntry_(id) {
  id = String(id || '').trim();
  if (!id) return json({ ok: false, error: 'Missing id' });

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);

  const idCol = headers.indexOf('id') + 1;
  const deletedCol = headers.indexOf('deleted') + 1;
  const updatedCol = headers.indexOf('updatedAt') + 1;
  if (!idCol || !deletedCol || !updatedCol) throw new Error('Missing required columns');

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return json({ ok: false, error: 'Not found' });

  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) {
      sheet.getRange(i + 2, deletedCol).setValue(true);
      sheet.getRange(i + 2, updatedCol).setValue(new Date().toISOString());
      return json({ ok: true, deleted: true, id: id });
    }
  }

  return json({ ok: false, error: 'Not found' });
}

function validateEntry_(entry) {
  var clean = {
    id: String(entry.id || '').trim(),
    createdAt: String(entry.createdAt || '').trim(),
    updatedAt: String(entry.updatedAt || '').trim(),
    date: String(entry.date || '').trim(),
    time: String(entry.time || '').trim(),
    type: String(entry.type || '').trim(),
    amount: entry.amount === undefined || entry.amount === null ? '' : String(entry.amount).trim(),
    note: String(entry.note || '').trim(),
    device: String(entry.device || '').trim(),
    deleted: entry.deleted === true || String(entry.deleted).toLowerCase() === 'true'
  };

  if (!clean.id || clean.id.length > 120) throw new Error('Invalid id');
  if (!clean.createdAt || isNaN(new Date(clean.createdAt).getTime())) throw new Error('Invalid createdAt');
  if (!clean.updatedAt || isNaN(new Date(clean.updatedAt).getTime())) throw new Error('Invalid updatedAt');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean.date)) throw new Error('Invalid date');
  if (!/^\d{2}:\d{2}$/.test(clean.time)) throw new Error('Invalid time');
  if (ALLOWED_TYPES.indexOf(clean.type) === -1) throw new Error('Invalid type');
  if (clean.device.length > 120) throw new Error('Invalid device');

  if (clean.note.length > 180) {
    clean.note = clean.note.slice(0, 180);
  }

  if (clean.type === 'האכלה') {
    var amountNum = Number(clean.amount);
    if (!clean.amount || isNaN(amountNum) || amountNum < 0 || amountNum > 1000) {
      throw new Error('Invalid amount');
    }
    clean.amount = String(Math.round(amountNum));
  } else {
    clean.amount = '';
  }

  return clean;
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + SHEET_NAME);
  return sheet;
}

function rowToObject_(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    var value = row[i];

    if (value instanceof Date) {
      value = value.toISOString();
    }

    if (key === 'deleted') {
      value = value === true || String(value).toLowerCase() === 'true';
    }

    obj[key] = value === undefined ? '' : value;
  }
  return obj;
}

function toSheetValue_(value) {
  if (value === true) return true;
  if (value === false) return false;
  return value === undefined || value === null ? '' : value;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
