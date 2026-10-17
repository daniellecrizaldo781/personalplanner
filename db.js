const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'personalplanner.db.json');

function defaultData() {
  return {
    tasks: [],
    task_history: [],
    notes: [],
    meetings: [],
    cascades: [],
    push_subscriptions: [],
    notification_settings: {
      id: 1,
      enabled: 1,
      upcoming_deadline_minutes: 1440,
      overdue_reminder_minutes: 1440,
      recurring_urgent_minutes: 1440,
      snooze_duration_minutes: 60,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
      timezone: 'UTC',
      sound_enabled: 1,
      task_reminders: 1,
      overdue_reminders: 1,
      recurring_reminders: 1,
      cascade_deadlines: 1,
      meeting_reminders: 1
    },
    users: [],
    _lastId: {
      tasks: 0,
      task_history: 0,
      notes: 0,
      meetings: 0,
      cascades: 0,
      push_subscriptions: 0,
      users: 0
    }
  };
}

function loadData() {
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const data = JSON.parse(raw);
    // Merge with defaults to handle new fields
    const defaults = defaultData();
    for (const key of Object.keys(defaults)) {
      if (!(key in data)) data[key] = defaults[key];
    }
    // Ensure _lastId exists for all collections
    if (!data._lastId) {
      data._lastId = {};
      for (const key of Object.keys(defaults._lastId)) {
        data._lastId[key] = data[key] && data[key].length ? Math.max(...data[key].map(r => r.id || 0)) : 0;
      }
    }
    return data;
  } catch (e) {
    const data = defaultData();
    saveData(data);
    return data;
  }
}

function saveData(data) {
  const tmpPath = dbPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, dbPath);
}

function nextId(data, collection) {
  data._lastId[collection] = (data._lastId[collection] || 0) + 1;
  return data._lastId[collection];
}

function now() {
  return new Date().toISOString();
}

// Query helpers
function findById(data, collection, id) {
  return data[collection].find(r => r.id === parseInt(id));
}

function findAll(data, collection) {
  return data[collection];
}

function insertRecord(data, collection, record) {
  record.id = nextId(data, collection);
  record.created_at = record.created_at || now();
  record.updated_at = record.updated_at || now();
  data[collection].push(record);
  return record;
}

function updateRecord(data, collection, id, updates) {
  const idx = data[collection].findIndex(r => r.id === parseInt(id));
  if (idx === -1) return null;
  Object.assign(data[collection][idx], updates, { updated_at: now() });
  return data[collection][idx];
}

function deleteRecord(data, collection, id) {
  const idx = data[collection].findIndex(r => r.id === parseInt(id));
  if (idx === -1) return false;
  data[collection].splice(idx, 1);
  return true;
}

function filterRecords(data, collection, predicate) {
  return data[collection].filter(predicate);
}

module.exports = {
  loadData, saveData, now, nextId,
  findById, findAll, insertRecord, updateRecord, deleteRecord, filterRecords,
  dataDir, dbPath
};
