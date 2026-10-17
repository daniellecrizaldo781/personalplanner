const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const webpush = require('web-push');
const dotenv = require('dotenv');
const { loadData, saveData, now, findById, findAll, insertRecord, updateRecord, deleteRecord, filterRecords, saveData: saveDB2 } = require('./db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"]
    }
  }
}));
app.use(cors({ origin: process.env.BASE_URL || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { error: 'Too many requests' }
});
app.use('/api/', apiLimiter);

function getDB() { return loadData(); }
function saveDB(data) { saveDB2(data); }

function logTaskHistory(data, taskId, action, details) {
  insertRecord(data, 'task_history', { task_id: taskId, action, details: details || null });
}

// ===== TASKS API =====
app.get('/api/tasks', (req, res) => {
  try {
    const data = getDB();
    const { status, priority, category, search, sortBy = 'created_at', sortDir = 'DESC' } = req.query;
    let tasks = filterRecords(data, 'tasks', t => t.status !== 'Completed');
    if (status) tasks = tasks.filter(t => t.status === status);
    if (priority) tasks = tasks.filter(t => t.priority === priority);
    if (category) tasks = tasks.filter(t => t.category === category);
    if (search) {
      const s = search.toLowerCase();
      tasks = tasks.filter(t => (t.title || '').toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s) || (t.category || '').toLowerCase().includes(s));
    }
    tasks.sort((a, b) => {
      let av = a[sortBy] || '', bv = b[sortBy] || '';
      if (av < bv) return sortDir === 'ASC' ? -1 : 1;
      if (av > bv) return sortDir === 'ASC' ? 1 : -1;
      return 0;
    });
    res.json(tasks);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tasks/completed', (req, res) => {
  try {
    const data = getDB();
    const { search, category, sortBy = 'completed_at', sortDir = 'DESC' } = req.query;
    let tasks = filterRecords(data, 'tasks', t => t.status === 'Completed');
    if (category) tasks = tasks.filter(t => t.category === category);
    if (search) {
      const s = search.toLowerCase();
      tasks = tasks.filter(t => (t.title || '').toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s));
    }
    tasks.sort((a, b) => {
      let av = a[sortBy] || '', bv = b[sortBy] || '';
      if (av < bv) return sortDir === 'ASC' ? -1 : 1;
      if (av > bv) return sortDir === 'ASC' ? 1 : -1;
      return 0;
    });
    res.json(tasks);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tasks/:id', (req, res) => {
  const data = getDB();
  const task = findById(data, 'tasks', req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

app.post('/api/tasks', (req, res) => {
  try {
    const data = getDB();
    const d = req.body;
    const task = insertRecord(data, 'tasks', {
      title: d.title || '', description: d.description || '', category: d.category || 'General',
      priority: d.priority || 'Normal', status: d.status || 'Pending',
      due_date: d.due_date || null, due_time: d.due_time || null,
      reminder_offset_minutes: d.reminder_offset_minutes || 30,
      reminder_enabled: d.reminder_enabled || 0,
      checklist: Array.isArray(d.checklist) ? d.checklist : JSON.parse(d.checklist || '[]'),
      notes: d.notes || '',
      is_recurring: d.is_recurring || 0,
      recurrence_pattern: d.recurrence_pattern || '',
      recurrence_interval: d.recurrence_interval || 1,
      recurrence_unit: d.recurrence_unit || 'days',
      recurrence_end_date: d.recurrence_end_date || null,
      completed_at: null
    });
    logTaskHistory(data, task.id, 'created', null);
    saveDB(data);
    res.json(task);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tasks/:id', (req, res) => {
  try {
    const data = getDB();
    const d = req.body;
    const before = findById(data, 'tasks', req.params.id);
    if (!before) { res.status(404).json({ error: 'Task not found' }); return; }
    const updates = {
      title: d.title !== undefined ? d.title : before.title,
      description: d.description !== undefined ? d.description : before.description,
      category: d.category !== undefined ? d.category : before.category,
      priority: d.priority !== undefined ? d.priority : before.priority,
      status: d.status !== undefined ? d.status : before.status,
      due_date: d.due_date !== undefined ? d.due_date : before.due_date,
      due_time: d.due_time !== undefined ? d.due_time : before.due_time,
      reminder_offset_minutes: d.reminder_offset_minutes !== undefined ? d.reminder_offset_minutes : before.reminder_offset_minutes,
      reminder_enabled: d.reminder_enabled !== undefined ? d.reminder_enabled : before.reminder_enabled,
      checklist: d.checklist !== undefined ? (Array.isArray(d.checklist) ? d.checklist : JSON.parse(d.checklist)) : before.checklist,
      notes: d.notes !== undefined ? d.notes : before.notes,
      is_recurring: d.is_recurring !== undefined ? d.is_recurring : before.is_recurring,
      recurrence_pattern: d.recurrence_pattern !== undefined ? d.recurrence_pattern : before.recurrence_pattern,
      recurrence_interval: d.recurrence_interval !== undefined ? d.recurrence_interval : before.recurrence_interval,
      recurrence_unit: d.recurrence_unit !== undefined ? d.recurrence_unit : before.recurrence_unit,
      recurrence_end_date: d.recurrence_end_date !== undefined ? d.recurrence_end_date : before.recurrence_end_date,
    };
    if (d.status && d.status !== before.status) {
      logTaskHistory(data, before.id, 'status_changed', `from ${before.status} to ${d.status}`);
      if (d.status === 'Completed' && !before.completed_at) {
        updates.completed_at = now();
        logTaskHistory(data, before.id, 'completed', null);
      } else if (d.status !== 'Completed' && before.completed_at) {
        updates.completed_at = null;
        logTaskHistory(data, before.id, 'reopened', null);
      }
    }
    const updated = updateRecord(data, 'tasks', req.params.id, updates);
    saveDB(data);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    const data = getDB();
    const before = findById(data, 'tasks', req.params.id);
    if (!before) { res.status(404).json({ error: 'Task not found' }); return; }
    logTaskHistory(data, before.id, 'deleted', null);
    deleteRecord(data, 'tasks', req.params.id);
    saveDB(data);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tasks/history/:id', (req, res) => {
  const data = getDB();
  const history = filterRecords(data, 'task_history', h => h && h.task_id === parseInt(req.params.id));
  res.json(history);
});

app.get('/api/tasks/categories', (req, res) => {
  const data = getDB();
  const active = [...new Set(data.tasks.filter(t => t.status !== 'Completed').map(t => t.category).filter(Boolean))].sort();
  const completed = [...new Set(data.tasks.filter(t => t.status === 'Completed').map(t => t.category).filter(Boolean))].sort();
  res.json({ active: active.map(c => ({ category: c })), completed: completed.map(c => ({ category: c })) });
});

// ===== NOTES API =====
app.get('/api/notes', (req, res) => {
  const data = getDB();
  const { search, archived = '0' } = req.query;
  let notes = filterRecords(data, 'notes', n => n.is_archived === parseInt(archived));
  if (search) {
    const s = search.toLowerCase();
    notes = notes.filter(n => (n.title || '').toLowerCase().includes(s) || (n.content || '').toLowerCase().includes(s));
  }
  notes.sort((a, b) => {
    if (b.is_pinned && !a.is_pinned) return -1;
    if (!b.is_pinned && a.is_pinned) return 1;
    return (b.updated_at || '').localeCompare(a.updated_at || '');
  });
  res.json(notes);
});

app.get('/api/notes/:id', (req, res) => {
  const data = getDB();
  const note = findById(data, 'notes', req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json(note);
});

app.post('/api/notes', (req, res) => {
  try {
    const data = getDB();
    const d = req.body;
    const note = insertRecord(data, 'notes', {
      title: d.title || '', content: d.content || '',
      category: d.category || 'General',
      tags: Array.isArray(d.tags) ? d.tags : (d.tags ? JSON.parse(d.tags) : []),
      is_pinned: d.is_pinned || 0, is_important: d.is_important || 0,
      is_archived: d.is_archived || 0,
      related_task_ids: Array.isArray(d.related_task_ids) ? d.related_task_ids : [],
      related_meeting_ids: Array.isArray(d.related_meeting_ids) ? d.related_meeting_ids : [],
    });
    saveDB(data);
    res.json(note);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/notes/:id', (req, res) => {
  try {
    const data = getDB();
    const d = req.body;
    const before = findById(data, 'notes', req.params.id);
    if (!before) { res.status(404).json({ error: 'Note not found' }); return; }
    const parseIfStr = (val, fallback) => typeof val === 'string' ? JSON.parse(val) : val;
    const updated = updateRecord(data, 'notes', req.params.id, {
      title: d.title !== undefined ? d.title : before.title,
      content: d.content !== undefined ? d.content : before.content,
      category: d.category !== undefined ? d.category : before.category,
      tags: d.tags !== undefined ? (Array.isArray(d.tags) ? d.tags : JSON.parse(d.tags)) : before.tags,
      is_pinned: d.is_pinned !== undefined ? d.is_pinned : before.is_pinned,
      is_important: d.is_important !== undefined ? d.is_important : before.is_important,
      is_archived: d.is_archived !== undefined ? d.is_archived : before.is_archived,
      related_task_ids: d.related_task_ids !== undefined ? parseIfStr(d.related_task_ids, before.related_task_ids) : before.related_task_ids,
      related_meeting_ids: d.related_meeting_ids !== undefined ? parseIfStr(d.related_meeting_ids, before.related_meeting_ids) : before.related_meeting_ids,
    });
    saveDB(data);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/notes/:id', (req, res) => {
  const data = getDB();
  deleteRecord(data, 'notes', req.params.id);
  saveDB(data);
  res.json({ success: true });
});

// ===== MEETINGS API =====
app.get('/api/meetings', (req, res) => {
  const data = getDB();
  const { search, archived = '0' } = req.query;
  let meetings = filterRecords(data, 'meetings', m => m.is_archived === parseInt(archived));
  if (search) {
    const s = search.toLowerCase();
    meetings = meetings.filter(m => (m.title || '').toLowerCase().includes(s) || (m.agenda || '').toLowerCase().includes(s));
  }
  meetings.sort((a, b) => (b.date_time || '').localeCompare(a.date_time || ''));
  res.json(meetings);
});

app.get('/api/meetings/:id', (req, res) => {
  const data = getDB();
  const meeting = findById(data, 'meetings', req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  res.json(meeting);
});

app.post('/api/meetings', (req, res) => {
  try {
    const data = getDB();
    const d = req.body;
    const meeting = insertRecord(data, 'meetings', {
      title: d.title || '', date_time: d.date_time || null,
      attendees: Array.isArray(d.attendees) ? d.attendees : JSON.parse(d.attendees || '[]'),
      agenda: d.agenda || '', discussion_notes: d.discussion_notes || '',
      decisions: d.decisions || '',
      action_items: Array.isArray(d.action_items) ? d.action_items : JSON.parse(d.action_items || '[]'),
      related_project: d.related_project || '', is_archived: d.is_archived || 0
    });
    saveDB(data);
    res.json(meeting);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/meetings/:id', (req, res) => {
  try {
    const data = getDB();
    const d = req.body;
    const before = findById(data, 'meetings', req.params.id);
    if (!before) { res.status(404).json({ error: 'Meeting not found' }); return; }
    const parseIfStr = (val, fallback) => typeof val === 'string' ? JSON.parse(val) : val;
    const updated = updateRecord(data, 'meetings', req.params.id, {
      title: d.title !== undefined ? d.title : before.title,
      date_time: d.date_time !== undefined ? d.date_time : before.date_time,
      attendees: d.attendees !== undefined ? parseIfStr(d.attendees, before.attendees) : before.attendees,
      agenda: d.agenda !== undefined ? d.agenda : before.agenda,
      discussion_notes: d.discussion_notes !== undefined ? d.discussion_notes : before.discussion_notes,
      decisions: d.decisions !== undefined ? d.decisions : before.decisions,
      action_items: d.action_items !== undefined ? parseIfStr(d.action_items, before.action_items) : before.action_items,
      related_project: d.related_project !== undefined ? d.related_project : before.related_project,
      is_archived: d.is_archived !== undefined ? d.is_archived : before.is_archived
    });
    saveDB(data);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/meetings/:id', (req, res) => {
  const data = getDB();
  deleteRecord(data, 'meetings', req.params.id);
  saveDB(data);
  res.json({ success: true });
});

app.post('/api/meetings/:id/action-to-task', (req, res) => {
  try {
    const data = getDB();
    const meeting = findById(data, 'meetings', req.params.id);
    const { actionIndex } = req.body;
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    const actionItems = meeting.action_items || [];
    if (actionIndex < 0 || actionIndex >= actionItems.length) return res.status(400).json({ error: 'Invalid action item' });
    const ai = actionItems[actionIndex];
    const task = insertRecord(data, 'tasks', {
      title: ai.text || '',
      description: `From meeting: ${meeting.title}`,
      category: meeting.related_project || 'General',
      priority: 'Normal', status: 'Pending',
      due_date: ai.due_date || null, due_time: null,
      checklist: [], notes: '', is_recurring: 0
    });
    logTaskHistory(data, task.id, 'created', `Action item from meeting #${meeting.id}`);
    saveDB(data);
    res.json(task);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== CASCADES API =====
app.get('/api/cascades', (req, res) => {
  try {
    const data = getDB();
    const { search, status, priority, category, sortBy = 'creation_date', sortDir = 'DESC' } = req.query;
    let cascades = filterRecords(data, 'cascades', c => c.status !== 'Archived');
    if (status) cascades = cascades.filter(c => c.status === status);
    if (priority) cascades = cascades.filter(c => c.priority === priority);
    if (category) cascades = cascades.filter(c => c.brand_project === category);
    if (search) {
      const s = search.toLowerCase();
      cascades = cascades.filter(c => (c.title || '').toLowerCase().includes(s) || (c.details || '').toLowerCase().includes(s));
    }
    cascades.sort((a, b) => {
      let av = a[sortBy] || '', bv = b[sortBy] || '';
      if (av < bv) return sortDir === 'ASC' ? -1 : 1;
      if (av > bv) return sortDir === 'ASC' ? 1 : -1;
      return 0;
    });
    res.json(cascades);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/cascades/completed', (req, res) => {
  const data = getDB();
  const { search } = req.query;
  let cascades = filterRecords(data, 'cascades', c => c.status === 'Archived');
  if (search) {
    const s = search.toLowerCase();
    cascades = cascades.filter(c => (c.title || '').toLowerCase().includes(s));
  }
  res.json(cascades);
});

app.get('/api/cascades/:id', (req, res) => {
  const data = getDB();
  const cascade = findById(data, 'cascades', req.params.id);
  if (!cascade) return res.status(404).json({ error: 'Cascade not found' });
  res.json(cascade);
});

app.post('/api/cascades', (req, res) => {
  try {
    const data = getDB();
    const d = req.body;
    const cascade = insertRecord(data, 'cascades', {
      title: d.title || '', details: d.details || '',
      brand_project: d.brand_project || '', priority: d.priority || 'Normal',
      deadline: d.deadline || null, status: d.status || 'To Cascade',
      date_cascaded: d.date_cascaded || null, notes: d.notes || '',
      original_link: d.original_link || '',
      related_note_ids: Array.isArray(d.related_note_ids) ? d.related_note_ids : [],
      related_task_ids: Array.isArray(d.related_task_ids) ? d.related_task_ids : [],
    });
    saveDB(data);
    res.json(cascade);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/cascades/:id', (req, res) => {
  try {
    const data = getDB();
    const d = req.body;
    const before = findById(data, 'cascades', req.params.id);
    if (!before) { res.status(404).json({ error: 'Cascade not found' }); return; }
    const parseIfStr = (val, fallback) => typeof val === 'string' ? JSON.parse(val) : val;
    const updated = updateRecord(data, 'cascades', req.params.id, {
      title: d.title !== undefined ? d.title : before.title,
      details: d.details !== undefined ? d.details : before.details,
      brand_project: d.brand_project !== undefined ? d.brand_project : before.brand_project,
      priority: d.priority !== undefined ? d.priority : before.priority,
      deadline: d.deadline !== undefined ? d.deadline : before.deadline,
      status: d.status !== undefined ? d.status : before.status,
      date_cascaded: d.date_cascaded !== undefined ? d.date_cascaded : before.date_cascaded,
      notes: d.notes !== undefined ? d.notes : before.notes,
      original_link: d.original_link !== undefined ? d.original_link : before.original_link,
      related_note_ids: d.related_note_ids !== undefined ? parseIfStr(d.related_note_ids, before.related_note_ids) : before.related_note_ids,
      related_task_ids: d.related_task_ids !== undefined ? parseIfStr(d.related_task_ids, before.related_task_ids) : before.related_task_ids,
    });
    saveDB(data);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== PUSH NOTIFICATIONS =====
app.get('/api/push/vapidPublicKey', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(500).json({ error: 'VAPID key not configured' });
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', (req, res) => {
  try {
    const data = getDB();
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
    const existing = data.push_subscriptions.find(s => s.endpoint === subscription.endpoint);
    if (existing) {
      existing.subscription = subscription;
      existing.last_used = now();
    } else {
      insertRecord(data, 'push_subscriptions', { endpoint: subscription.endpoint, subscription, last_used: now() });
    }
    saveDB(data);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/push/subscriptions', (req, res) => {
  const data = getDB();
  const subs = data.push_subscriptions.map(s => ({ id: s.id, endpoint: s.endpoint, last_used: s.last_used }));
  res.json(subs);
});

app.delete('/api/push/subscriptions/:id', (req, res) => {
  const data = getDB();
  deleteRecord(data, 'push_subscriptions', req.params.id);
  saveDB(data);
  res.json({ success: true });
});

app.post('/api/push/sendTest', (req, res) => {
  try {
    const data = getDB();
    const subs = data.push_subscriptions;
    if (!subs.length) return res.status(400).json({ error: 'No devices subscribed' });
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'VAPID keys not configured' });
    webpush.setVapidDetails('mailto:reminders@personalplanner.daniellecrizaldo.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const payload = JSON.stringify({
      title: 'PersonalPlanner Test',
      body: 'This is a test notification from your PersonalPlanner dashboard.',
      url: '/'
    });
    let sent = 0, failed = 0;
    for (const sub of subs) {
      try { webpush.sendNotification(sub.subscription, payload); sent++; } catch (e) { failed++; }
    }
    res.json({ sent, failed, total: subs.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== NOTIFICATION SETTINGS =====
app.get('/api/settings', (req, res) => {
  const data = getDB();
  res.json(data.notification_settings);
});

app.put('/api/settings', (req, res) => {
  try {
    const data = getDB();
    const d = req.body;
    const fields = ['enabled', 'upcoming_deadline_minutes', 'overdue_reminder_minutes',
      'recurring_urgent_minutes', 'snooze_duration_minutes', 'quiet_hours_start',
      'quiet_hours_end', 'timezone', 'sound_enabled', 'task_reminders',
      'overdue_reminders', 'recurring_reminders', 'cascade_deadlines', 'meeting_reminders'];
    for (const f of fields) { if (d[f] !== undefined) data.notification_settings[f] = d[f]; }
    saveDB(data);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== EXPORT / IMPORT =====
app.get('/api/export', (req, res) => {
  const data = getDB();
  res.json({
    tasks: data.tasks, notes: data.notes, meetings: data.meetings,
    cascades: data.cascades, task_history: data.task_history,
    exported_at: new Date().toISOString()
  });
});

app.post('/api/import', (req, res) => {
  try {
    const data = getDB();
    const d = req.body;
    const nowISO = now();
    for (const [table, key] of [['tasks', 'tasks'], ['notes', 'notes'], ['meetings', 'meetings'], ['cascades', 'cascades']]) {
      if (d[key]) {
        for (const item of d[key]) {
          const existing = data[table].find(x => x.id === item.id);
          if (existing) Object.assign(existing, item, { updated_at: nowISO });
          else { const copy = { ...item }; copy.id = undefined; data[table].push(copy); }
        }
      }
    }
    if (d.task_history) {
      for (const h of d.task_history) { insertRecord(data, 'task_history', h); }
    }
    saveDB(data);
    res.json({ success: true, message: 'Import completed' });
  } catch (e) { res.status(500).json({ error: 'Import failed', details: e.message }); }
});

// ===== Global Search =====
app.get('/api/search', (req, res) => {
  const data = getDB();
  const { q } = req.query;
  if (!q) return res.json({ tasks: [], notes: [], meetings: [], cascades: [] });
  const s = q.toLowerCase();
  const tasks = data.tasks.filter(t => t.status !== 'Completed' && ((t.title || '').toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s)));
  const notes = data.notes.filter(n => n.is_archived === 0 && ((n.title || '').toLowerCase().includes(s) || (n.content || '').toLowerCase().includes(s)));
  const meetings = data.meetings.filter(m => m.is_archived === 0 && ((m.title || '').toLowerCase().includes(s) || (m.agenda || '').toLowerCase().includes(s)));
  const cascades = data.cascades.filter(c => c.status !== 'Archived' && ((c.title || '').toLowerCase().includes(s) || (c.details || '').toLowerCase().includes(s)));
  res.json({
    tasks: tasks.map(t => ({ id: t.id, title: t.title, description: t.description, category: t.category, priority: t.priority, status: t.status })),
    notes: notes.map(n => ({ id: n.id, title: n.title, content: n.content })),
    meetings: meetings.map(m => ({ id: m.id, title: m.title, agenda: m.agenda, date_time: m.date_time })),
    cascades: cascades.map(c => ({ id: c.id, title: c.title, details: c.details, brand_project: c.brand_project }))
  });
});

// ===== Dashboard Summary =====
app.get('/api/dashboard', (req, res) => {
  try {
    const data = getDB();
    const nowISO = now();
    const today = nowISO.split('T')[0];
    const pending = data.tasks.filter(t => t.status === 'Pending').length;
    const inProgress = data.tasks.filter(t => t.status === 'In Progress').length;
    const urgent = data.tasks.filter(t => t.priority === 'Urgent' && t.status !== 'Completed').length;
    const overdue = data.tasks.filter(t => t.due_date && t.due_date < nowISO && t.status !== 'Completed').length;
    const dueToday = data.tasks.filter(t => t.due_date === today && t.status !== 'Completed').length;
    const upcomingTasks = data.tasks.filter(t => t.due_date && t.due_date > nowISO && t.status !== 'Completed').sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).slice(0, 5);
    const recentCompleted = data.tasks.filter(t => t.status === 'Completed' && t.completed_at).sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || '')).slice(0, 5);
    const pinnedNotes = data.notes.filter(n => n.is_pinned === 1 && n.is_archived === 0).slice(0, 5);
    const activeCascades = data.cascades.filter(c => c.status === 'To Cascade' || c.status === 'Scheduled').sort((a, b) => (a.deadline || '').localeCompare(b.deadline || '')).slice(0, 5);
    const upcomingMeetings = data.meetings.filter(m => m.date_time && m.date_time >= nowISO && m.is_archived === 0).sort((a, b) => (a.date_time || '').localeCompare(b.date_time || '')).slice(0, 5);
    res.json({ pending, inProgress, urgent, overdue, dueToday, upcomingTasks, recentCompleted, pinnedNotes, activeCascades, upcomingMeetings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ===== Background Reminder System =====
function checkReminders() {
  setInterval(() => {
    try {
      const data = getDB();
      const settings = data.notification_settings;
      if (!settings.enabled) return;
      const nowDate = new Date();
      const nowISO = nowDate.toISOString();
      const today = nowISO.split('T')[0];
      const nowTime = nowDate.toTimeString().slice(0, 5);
      const inQuietHours = settings.quiet_hours_start && settings.quiet_hours_end
        ? (nowTime >= settings.quiet_hours_start || nowTime <= settings.quiet_hours_end) : false;
      if (inQuietHours) return;
      const subs = data.push_subscriptions;
      if (!subs.length) return;
      if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
      webpush.setVapidDetails('mailto:reminders@personalplanner.daniellecrizaldo.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
      let notificationsSent = 0;

      // Overdue tasks
      const overdueTasks = data.tasks.filter(t => t.due_date && t.due_date < nowISO && t.status !== 'Completed');
      for (const task of overdueTasks) {
        const lastReminderMatch = (task.notes || '').match(/last_overdue_reminder:([^\s]+)/);
        if (lastReminderMatch && lastReminderMatch[1] === today) continue;
        const payload = JSON.stringify({ title: `Overdue: ${task.title}`, body: `Due on ${task.due_date}.`, url: `/tasks/${task.id}` });
        for (const sub of subs) {
          try { webpush.sendNotification(sub.subscription, payload); notificationsSent++; } catch (e) {}
        }
        task.notes = (task.notes || '') + ` last_overdue_reminder:${today}`;
      }

      // Upcoming deadlines
      const upcomingMinutes = settings.upcoming_deadline_minutes || 1440;
      const threshold = new Date(Date.now() + upcomingMinutes * 60 * 1000).toISOString();
      for (const task of data.tasks) {
        if (task.status === 'Completed' || !task.due_date) continue;
        const taskDT = task.due_date + 'T' + (task.due_time || '23:59:59');
        if (taskDT > nowISO && taskDT <= threshold) {
          const payload = JSON.stringify({ title: `Upcoming: ${task.title}`, body: `Due ${task.due_date}${task.due_time ? ' at ' + task.due_time : ''}.`, url: `/tasks/${task.id}` });
          for (const sub of subs) {
            try { webpush.sendNotification(sub.subscription, payload); notificationsSent++; } catch (e) {}
          }
        }
      }

      // Recurring task generation
      for (const task of data.tasks) {
        if (!task.is_recurring || task.is_recurring === 0 || task.status !== 'Completed' || !task.due_date) continue;
        const dueDate = new Date(task.due_date);
        if (dueDate.getTime() > nowDate.getTime()) continue;
        if (task.recurrence_end_date && new Date(task.recurrence_end_date) < nowDate) continue;
        const interval = task.recurrence_interval || 1;
        let nextDate;
        if (task.recurrence_unit === 'days') nextDate = new Date(dueDate.getTime() + interval * 24 * 60 * 60 * 1000);
        else if (task.recurrence_unit === 'weeks') nextDate = new Date(dueDate.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
        else if (task.recurrence_unit === 'months') { nextDate = new Date(dueDate); nextDate.setMonth(nextDate.getMonth() + interval); }
        else if (task.recurrence_unit === 'years') { nextDate = new Date(dueDate); nextDate.setFullYear(nextDate.getFullYear() + interval); }
        if (nextDate && nextDate.getTime() <= nowDate.getTime()) {
          const newTask = {
            title: task.title, description: task.description, category: task.category,
            priority: task.priority, status: 'Pending', due_date: nextDate.toISOString().split('T')[0],
            due_time: task.due_time, reminder_offset_minutes: task.reminder_offset_minutes,
            reminder_enabled: task.reminder_enabled, checklist: task.checklist,
            notes: task.notes, is_recurring: task.is_recurring, recurrence_pattern: task.recurrence_pattern,
            recurrence_interval: task.recurrence_interval, recurrence_unit: task.recurrence_unit,
            recurrence_end_date: task.recurrence_end_date, completed_at: null, created_at: nowISO, updated_at: nowISO
          };
          newTask.id = data._lastId.tasks = (data._lastId.tasks || 0) + 1;
          data.tasks.push(newTask);
          logTaskHistory(data, newTask.id, 'created', 'Recurring task instance');
          if (settings.recurring_reminders) {
            const payload = JSON.stringify({ title: `New recurring task: ${task.title}`, body: 'A new instance has been generated.', url: `/tasks/${newTask.id}` });
            for (const sub of subs) { try { webpush.sendNotification(sub.subscription, payload); } catch (e) {} }
          }
        }
      }

      // Cascades deadline
      for (const cascade of data.cascades) {
        if (cascade.status === 'Archived' || !cascade.deadline) continue;
        const cascadeDT = cascade.deadline;
        if (cascadeDT > nowISO && cascadeDT <= threshold) {
          const payload = JSON.stringify({ title: `Cascade deadline: ${cascade.title}`, body: `Deadline: ${cascade.deadline}`, url: `/cascades/${cascade.id}` });
          for (const sub of subs) { try { webpush.sendNotification(sub.subscription, payload); } catch (e) {} }
        }
      }

      // Meetings
      for (const meeting of data.meetings) {
        if (meeting.is_archived || !meeting.date_time) continue;
        if (meeting.date_time > nowISO && meeting.date_time <= threshold) {
          const payload = JSON.stringify({ title: `Meeting: ${meeting.title}`, body: `Starts at ${meeting.date_time}`, url: `/meetings/${meeting.id}` });
          for (const sub of subs) { try { webpush.sendNotification(sub.subscription, payload); } catch (e) {} }
        }
      }

      saveData(data);
      if (notificationsSent > 0) console.log(`[${new Date().toISOString()}] Sent ${notificationsSent} push notifications`);
    } catch (e) { console.error('Reminder check error:', e.message); }
  }, 60000);
}

checkReminders();

app.listen(PORT, () => {
  console.log(`PersonalPlanner server running on port ${PORT}`);
});
