// localStorage-based data storage for PersonalPlanner
// All data is kept in browser localStorage - no external database needed

const Storage = {
  // Get all records of a type
  getAll(type) {
    const key = 'pp_' + type;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse ' + key, e);
      return [];
    }
  },

  // Get a single record by ID
  getById(type, id) {
    const records = this.getAll(type);
    return records.find(r => r.id === parseInt(id)) || null;
  },

  // Save all records of a type
  saveAll(type, records) {
    const key = 'pp_' + type;
    localStorage.setItem(key, JSON.stringify(records || []));
  },

  // Add a new record
  add(type, record) {
    const records = this.getAll(type);
    const lastId = records.length ? Math.max(...records.map(r => r.id || 0)) : 0;
    record.id = lastId + 1;
    record.created_at = record.created_at || new Date().toISOString();
    record.updated_at = new Date().toISOString();
    records.push(record);
    this.saveAll(type, records);
    return record;
  },

  // Update a record
  update(type, id, updates) {
    const records = this.getAll(type);
    const idx = records.findIndex(r => r.id === parseInt(id));
    if (idx === -1) return null;
    Object.assign(records[idx], updates, { updated_at: new Date().toISOString() });
    this.saveAll(type, records);
    return records[idx];
  },

  // Delete a record
  delete(type, id) {
    const records = this.getAll(type);
    const idx = records.findIndex(r => r.id === parseInt(id));
    if (idx === -1) return false;
    records.splice(idx, 1);
    this.saveAll(type, records);
    return true;
  },

  // Get settings
  getSettings() {
    const defaults = {
      theme: 'light'
    };
    try {
      const raw = localStorage.getItem('pp_settings');
      const saved = raw ? JSON.parse(raw) : {};
      return { ...defaults, ...saved };
    } catch (e) {
      return defaults;
    }
  },

  // Save settings
  saveSettings(settings) {
    localStorage.setItem('pp_settings', JSON.stringify(settings));
  },

  // Export all data
  exportAll() {
    const data = {
      tasks: this.getAll('tasks'),
      task_history: this.getAll('task_history'),
      notes: this.getAll('notes'),
      meetings: this.getAll('meetings'),
      cascades: this.getAll('cascades'),
      settings: this.getSettings(),
      exported_at: new Date().toISOString()
    };
    return data;
  },

  // Import data (merge with existing)
  importAll(data) {
    if (data.tasks) {
      const existing = this.getAll('tasks');
      const imported = data.tasks.map(t => {
        // Ensure no ID conflicts
        t.id = undefined;
        return t;
      });
      this.saveAll('tasks', [...existing, ...imported]);
    }
    if (data.notes) {
      const existing = this.getAll('notes');
      const imported = data.notes.map(n => { n.id = undefined; return n; });
      this.saveAll('notes', [...existing, ...imported]);
    }
    if (data.meetings) {
      const existing = this.getAll('meetings');
      const imported = data.meetings.map(m => { m.id = undefined; return m; });
      this.saveAll('meetings', [...existing, ...imported]);
    }
    if (data.cascades) {
      const existing = this.getAll('cascades');
      const imported = data.cascades.map(c => { c.id = undefined; return c; });
      this.saveAll('cascades', [...existing, ...imported]);
    }
    if (data.task_history) {
      const existing = this.getAll('task_history');
      const imported = data.task_history.map(h => { h.id = undefined; return h; });
      this.saveAll('task_history', [...existing, ...imported]);
    }
    if (data.settings) {
      this.saveSettings({ ...this.getSettings(), ...data.settings });
    }
  },

  // Clear all data (for testing)
  clearAll() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('pp_')) localStorage.removeItem(key);
    });
  }
};
