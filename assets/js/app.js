// ===== Danielle's Planner App (Static, localStorage-based) =====

const dayjs = window.dayjs;

const state = {
  currentPage: 'dashboard',
  tasks: [],
  notes: [],
  meetings: [],
  cascades: [],
  settings: {},
  activeFilters: {},
  theme: 'light'
};

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
  state.settings = Storage.getSettings();
  state.theme = state.settings.theme || 'light';
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcon();
  setupEventListeners();
  loadData();
  renderPage('dashboard');
});

function updateThemeIcon() {
  const icon = document.querySelector('#theme-toggle i');
  if (icon) icon.className = state.theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon';
}

function loadData() {
  state.tasks = Storage.getAll('tasks');
  state.notes = Storage.getAll('notes');
  state.meetings = Storage.getAll('meetings');
  state.cascades = Storage.getAll('cascades');
}

// ===== Event Listeners =====
function setupEventListeners() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      renderPage(link.dataset.page);
    });
  });

  document.getElementById('nav-toggle').addEventListener('click', () => {
    document.getElementById('top-navbar-nav').classList.remove('show');
  });
  document.getElementById('nav-open').addEventListener('click', () => {
    document.getElementById('top-navbar-nav').classList.add('show');
  });

  document.getElementById('theme-toggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    state.settings.theme = state.theme;
    Storage.saveSettings(state.settings);
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeIcon();
  });

  document.querySelectorAll('.nav-group-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      const items = document.getElementById(group + '-group');
      if (items) items.classList.toggle('show');
    });
  });

  const exportBtn = document.getElementById('export-data-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportData);
}

// ===== Utility Functions =====
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncateText(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function formatDate(date, time) {
  if (!date) return '-';
  const d = dayjs(date);
  return time ? `${d.format('MMM D, YYYY')} at ${time}` : d.format('MMM D, YYYY');
}

function priorityBadge(priority) {
  const map = { Urgent: 'danger', High: 'warning', Normal: 'info', Low: 'secondary' };
  return map[priority] || 'secondary';
}

function showError(msg) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-danger position-fixed top-0 end-0 m-3';
  alert.style.zIndex = '2000';
  alert.innerHTML = `<i class="bi bi-exclamation-circle me-2"></i>${msg}<button class="btn-close" onclick="this.parentElement.remove()"></button>`;
  document.body.appendChild(alert);
  setTimeout(() => alert.remove(), 5000);
}

function showSuccess(msg) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-success position-fixed top-0 end-0 m-3';
  alert.style.zIndex = '2000';
  alert.innerHTML = `<i class="bi bi-check-circle me-2"></i>${msg}<button class="btn-close" onclick="this.parentElement.remove()"></button>`;
  document.body.appendChild(alert);
  setTimeout(() => alert.remove(), 3000);
}

// ===== Task History =====
function logTaskHistory(taskId, action, details) {
  const history = Storage.getAll('task_history');
  history.push({
    id: history.length ? Math.max(...history.map(h => h.id)) + 1 : 1,
    task_id: taskId,
    action,
    details: details || null,
    created_at: new Date().toISOString()
  });
  Storage.saveAll('task_history', history);
}

// ===== Page Rendering =====
function renderPage(page) {
  state.currentPage = page;
  document.getElementById('page-title').textContent = getPageTitle(page);
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });
  renderPageTabs(page);
  loadData();
  renderContent(document.getElementById('content-wrapper'), page);
  document.getElementById('top-navbar-nav').classList.remove('show');
  document.getElementById('global-search-dropdown')?.classList.remove('show');
}

function getPageTitle(page) {
  const titles = { dashboard: 'Home', calendar: 'Calendar', 'work-tasks': 'Work Tasks', 'personal-tasks': 'Personal Tasks', 'all-tasks': 'All Tasks', tasks: 'My Tasks', completed: 'Completed Tasks', notes: 'Notes', 'work-notes': 'Work Notes', 'personal-notes': 'Personal Notes', meetings: 'Meeting Notes', 'work-meetings': 'Work Meetings', 'personal-events': 'Personal Events', cascades: 'Team Cascades', settings: 'Settings' };
  return titles[page] || 'Dashboard';
}

function renderPageTabs(currentPage) {
  const pages = [
    { id: 'dashboard', label: 'Dashboard', icon: 'bi bi-speedometer2' },
    { id: 'tasks', label: 'My Tasks', icon: 'bi bi-clipboard-task' },
    { id: 'completed', label: 'Completed', icon: 'bi bi-check-circle' },
    { id: 'notes', label: 'Notes', icon: 'bi bi-journal-richtext' },
    { id: 'meetings', label: 'Meetings', icon: 'bi bi-people' },
    { id: 'cascades', label: 'Cascades', icon: 'bi bi-megaphone' },
    { id: 'settings', label: 'Settings', icon: 'bi bi-gear' }
  ];
  const tabsContainer = document.getElementById('page-tabs');
  if (!tabsContainer) return;
  tabsContainer.innerHTML = pages.map(p => `
    <button type="button" class="page-tab-btn ${p.id === currentPage ? 'active' : ''}" onclick="renderPage('${p.id}')">
      <i class="${p.icon}"></i> ${p.label}
    </button>
  `).join('');
}

async function renderContent(container, page) {
  try {
    switch (page) {
      case 'dashboard': await renderDashboard(container); break;
      case 'calendar': await renderCalendar(container); break;
      case 'work-tasks':
      case 'personal-tasks':
      case 'all-tasks':
      case 'tasks': await renderTasksPage(container); break;
      case 'completed': await renderCompletedPage(container); break;
      case 'work-notes':
      case 'personal-notes':
      case 'notes': await renderNotesPage(container); break;
      case 'work-meetings': await renderMeetingsPage(container); break;
      case 'personal-events': await renderPersonalEvents(container); break;
      case 'cascades': await renderCascadesPage(container); break;
      case 'settings': await renderSettingsPage(container); break;
      default: container.innerHTML = `<div class="empty-state"><i class="bi bi-construction"></i><h4>${getPageTitle(page)}</h4><p>Coming soon.</p></div>`; break;
    }
  } catch (e) {
    container.innerHTML = `<div class="alert alert-danger">Error loading page: ${e.message}</div>`;
  }
}

// ===== Dashboard =====
async function renderDashboard(container) {
  const tasks = Storage.getAll('tasks');
  const notes = Storage.getAll('notes');
  const cascades = Storage.getAll('cascades');
  const meetings = Storage.getAll('meetings');

  const now = new Date().toISOString();
  const today = now.split('T')[0];

  const activeTasks = tasks.filter(t => t.status !== 'Completed');
  const pending = activeTasks.filter(t => t.status === 'Pending').length;
  const inProgress = activeTasks.filter(t => t.status === 'In Progress').length;
  const urgent = activeTasks.filter(t => t.priority === 'Urgent').length;
  const overdue = activeTasks.filter(t => t.due_date && t.due_date < now).length;
  const dueToday = activeTasks.filter(t => t.due_date === today).length;

  const upcomingTasks = activeTasks
    .filter(t => t.due_date && t.due_date >= today)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    .slice(0, 5);

  const recentCompleted = tasks
    .filter(t => t.status === 'Completed' && t.completed_at)
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
    .slice(0, 5);

  const pinnedNotes = notes.filter(n => n.is_pinned === 1 && n.is_archived === 0).slice(0, 5);
  const activeCascades = cascades
    .filter(c => c.status !== 'Archived')
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
    .slice(0, 5);

  const upcomingMeetings = meetings
    .filter(m => m.date_time && m.date_time >= now && m.is_archived === 0)
    .sort((a, b) => (a.date_time || '').localeCompare(b.date_time || ''))
    .slice(0, 5);

  const recentCascades = cascades
    .filter(c => c.status === 'Cascaded' && c.date_cascaded)
    .sort((a, b) => (b.date_cascaded || '').localeCompare(a.date_cascaded || ''))
    .slice(0, 5);

  const outstandingActions = meetings
    .filter(m => m.is_archived === 0)
    .flatMap(m => {
      const actions = Array.isArray(m.action_items) ? m.action_items : JSON.parse(m.action_items || '[]');
      return actions.filter(a => !a.done).map(a => ({ ...a, meeting: m.title }));
    })
    .slice(0, 5);

  let overdueAlert = '';
  if (overdue > 0) {
    overdueAlert = `<div class="alert alert-danger d-flex align-items-center mt-4"><i class="bi bi-exclamation-triangle-fill me-2"></i><div>You have ${overdue} overdue task(s).</div><button class="btn btn-sm btn-outline-danger ms-auto" onclick="renderPage('tasks')">View</button></div>`;
  }

  let urgentAlert = '';
  if (urgent > 0) {
    urgentAlert = `<div class="alert alert-warning d-flex align-items-center mt-4"><i class="bi bi-clock-fill me-2"></i><div>${urgent} urgent task(s) pending.</div><button class="btn btn-sm btn-outline-warning ms-auto" onclick="renderPage('tasks')">View</button></div>`;
  }

  container.innerHTML = `
    <div class="dashboard-header">
      <div class="dashboard-title-row">
        <h2 class="dashboard-welcome">Welcome back, Danielle! <span class="waving-hand">👋</span></h2>
      </div>
      <p class="dashboard-subtitle">Here's what's on your plate today</p>
    </div>

    <div class="dashboard-grid">
      <div class="dashboard-widget"><div class="widget-header"><span class="widget-title">Pending Tasks</span><a href="#" class="widget-link" onclick="renderPage('tasks')">View All</a></div><div class="widget-value">${pending}</div></div>
      <div class="dashboard-widget"><div class="widget-header"><span class="widget-title">In Progress</span><a href="#" class="widget-link" onclick="renderPage('tasks')">View All</a></div><div class="widget-value">${inProgress}</div></div>
      <div class="dashboard-widget"><div class="widget-header"><span class="widget-title">Urgent Tasks</span><a href="#" class="widget-link" onclick="renderPage('tasks')">View All</a></div><div class="widget-value urgent">${urgent}</div></div>
      <div class="dashboard-widget"><div class="widget-header"><span class="widget-title">Overdue</span><a href="#" class="widget-link" onclick="renderPage('tasks')">View All</a></div><div class="widget-value overdue">${overdue}</div></div>
      <div class="dashboard-widget"><div class="widget-header"><span class="widget-title">Due Today</span><a href="#" class="widget-link" onclick="renderPage('tasks')">View All</a></div><div class="widget-value">${dueToday}</div></div>
      <div class="dashboard-widget"><div class="widget-header"><span class="widget-title">Cascades Pending</span><a href="#" class="widget-link" onclick="renderPage('cascades')">View All</a></div><div class="widget-value">${activeCascades.length}</div></div>
      <div class="dashboard-widget"><div class="widget-header"><span class="widget-title">Upcoming Meetings</span><a href="#" class="widget-link" onclick="renderPage('meetings')">View All</a></div><div class="widget-value">${upcomingMeetings.length}</div></div>
      <div class="dashboard-widget"><div class="widget-header"><span class="widget-title">Pinned Notes</span><a href="#" class="widget-link" onclick="renderPage('notes')">View All</a></div><div class="widget-value">${pinnedNotes.length}</div></div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-md-6">
        <div class="card"><div class="card-header"><i class="bi bi-clipboard-data me-2"></i>Upcoming Deadlines</div>
          <div class="card-body p-0">
            ${upcomingTasks.length > 0
              ? `<ul class="list-group list-group-flush">${upcomingTasks.map(t => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  <div><strong>${escapeHtml(t.title)}</strong><div class="text-muted small">${t.due_date || ''}${t.due_time ? ' at ' + t.due_time : ''}</div></div>
                  <span class="badge bg-${priorityBadge(t.priority)}">${t.priority}</span>
                </li>`).join('')}</ul>`
              : `<div class="empty-state"><i class="bi bi-clipboard-check"></i><p>No upcoming deadlines</p></div>`}
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card"><div class="card-header"><i class="bi bi-arrow-clockwise me-2"></i>Recently Completed</div>
          <div class="card-body p-0">
            ${recentCompleted.length > 0
              ? `<ul class="list-group list-group-flush">${recentCompleted.map(t => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  <div><strong>${escapeHtml(t.title)}</strong><div class="text-muted small">Completed ${t.completed_at ? dayjs(t.completed_at).format('MMM D, YYYY') : ''}</div></div>
                  <span class="badge bg-secondary">${t.category || 'General'}</span>
                </li>`).join('')}</ul>`
              : `<div class="empty-state"><i class="bi bi-clipboard-data"></i><p>No recently completed tasks</p></div>`}
          </div>
        </div>
      </div>
    </div>

    <div class="card"><div class="card-header"><i class="bi bi-lightning-charge me-2"></i>Quick Actions</div>
      <div class="card-body"><div class="quick-actions">
        <button class="btn btn-pink" onclick="openTaskModal()"><i class="bi bi-plus-lg"></i> New Task</button>
        <button class="btn btn-pink" onclick="openNoteModal()"><i class="bi bi-bookmark-plus"></i> New Note</button>
        <button class="btn btn-pink" onclick="openMeetingModal()"><i class="bi bi-people"></i> New Meeting</button>
        <button class="btn btn-pink" onclick="openCascadeModal()"><i class="bi bi-megaphone"></i> New Cascade</button>
      </div></div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-md-6">
        <div class="card"><div class="card-header"><i class="bi bi-arrow-up-right-square me-2"></i>Recently Cascaded</div>
          <div class="card-body p-0">
            ${recentCascades.length > 0
              ? `<ul class="list-group list-group-flush">` + recentCascades.map(c => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  <div><strong>${escapeHtml(c.title)}</strong><div class="text-muted small">Cascaded ${c.date_cascaded ? dayjs(c.date_cascaded).format('MMM D, YYYY') : ''}</div></div>
                  <span class="badge bg-secondary">${c.brand_project || 'General'}</span>
                </li>`).join('') + `</ul>`
              : `<div class="empty-state"><i class="bi bi-megaphone"></i><p>No recent cascades</p></div>`}
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card"><div class="card-header"><i class="bi bi-clipboard-task me-2"></i>Outstanding Action Items</div>
          <div class="card-body p-0">
            ${outstandingActions.length > 0
              ? `<ul class="list-group list-group-flush">` + outstandingActions.map(a => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  <div><strong>${escapeHtml(a.text || '')}</strong><div class="text-muted small">From: ${escapeHtml(a.meeting || '')}${a.assignee ? ' • ' + a.assignee : ''}</div></div>
                </li>`).join('') + `</ul>`
              : `<div class="empty-state"><i class="bi bi-check-clipboard"></i><p>No outstanding action items</p></div>`}
          </div>
        </div>
      </div>
    </div>
    ${overdueAlert}
    ${urgentAlert}
  `;
}

// ===== Calendar Page =====
async function renderCalendar(container) {
  container.innerHTML = `<div class="empty-state"><i class="bi bi-calendar-heart"></i><h4>Calendar</h4><p>Coming soon.</p></div>`;
}

// ===== Personal Events Page =====
async function renderPersonalEvents(container) {
  container.innerHTML = `<div class="empty-state"><i class="bi bi-calendar-event"></i><h4>Personal Events</h4><p>Coming soon.</p></div>`;
}
// ===== Tasks Page =====
async function renderTasksPage(container) {
  const tasks = Storage.getAll('tasks').filter(t => t.status !== 'Completed');
  const categories = [...new Set(tasks.map(t => t.category).filter(Boolean))].sort();
  const catResp = { active: categories.map(c => ({ category: c })) };

  state.tasks = tasks;

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">My Tasks</h2>
      <button class="btn btn-pink" onclick="openTaskModal()"><i class="bi bi-plus-lg"></i> New Task</button>
    </div>
    <div class="filter-pills">
      <span class="filter-pill active" onclick="filterTasks('all')">All</span>
      <span class="filter-pill" onclick="filterTasks('Pending')">Pending</span>
      <span class="filter-pill" onclick="filterTasks('In Progress')">In Progress</span>
      <span class="filter-pill" onclick="filterTasks('Urgent')">Urgent</span>
      <span class="filter-pill" onclick="filterTasks('High')">High</span>
      ${categories.map(c => `<span class="filter-pill" onclick="filterTasks('cat:${c}')">${c}</span>`).join('')}
      <span class="filter-pill clear" onclick="filterTasks('all')">Clear</span>
    </div>
    <div class="card"><div class="card-body p-0">
      ${tasks.length > 0 ? renderTaskTable(tasks) : `<div class="empty-state"><i class="bi bi-clipboard"></i><h4>No tasks yet</h4><p>Create your first task to get started.</p></div>`}
    </div></div>
  `;
}

function renderTaskTable(tasks) {
  const now = new Date().toISOString();
  return `
    <table class="table table-pink table-hover mb-0">
      <thead><tr><th></th><th>Task</th><th>Category</th><th>Priority</th><th>Status</th><th>Due Date</th><th class="text-end">Actions</th></tr></thead>
      <tbody>
        ${tasks.map(t => `
          <tr>
            <td><input type="checkbox" ${t.status === 'Completed' ? 'checked' : ''} onchange="toggleTaskComplete(${t.id}, this.checked)"></td>
            <td><strong>${escapeHtml(t.title)}</strong>${t.is_recurring ? '<span class="badge bg-info text-dark ms-1" title="Recurring">↻</span>' : ''}${t.description ? `<div class="text-muted small text-truncate">${escapeHtml(truncateText(t.description, 80))}</div>` : ''}</td>
            <td>${escapeHtml(t.category || 'General')}</td>
            <td><span class="task-priority ${t.priority}">${t.priority}</span></td>
            <td>${t.status === 'Completed'
              ? `<span class="status-badge Completed">Completed</span>`
              : `<select class="form-select form-select-sm" onchange="updateTaskStatus(${t.id}, this.value)">
                  <option value="Pending" ${t.status === 'Pending' ? 'selected' : ''}>Pending</option>
                  <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                </select>`}</td>
            <td>${formatDate(t.due_date, t.due_time)}</td>
            <td class="text-end"><button class="btn btn-sm btn-outline-secondary" onclick="openTaskModal(${t.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="deleteTask(${t.id})"><i class="bi bi-trash"></i></button></td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;
}

function filterTasks(filter) {
  const pills = document.querySelectorAll('.filter-pill');
  pills.forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
  let filtered = [...state.tasks];
  if (filter === 'all') {}
  else if (filter.startsWith('cat:')) filtered = state.tasks.filter(t => t.category === filter.replace('cat:', ''));
  else if (['Pending', 'In Progress', 'Urgent', 'High'].includes(filter)) {
    if (['Pending', 'In Progress'].includes(filter)) filtered = state.tasks.filter(t => t.status === filter);
    else filtered = state.tasks.filter(t => t.priority === filter);
  }
  const tbody = document.querySelector('tbody');
  tbody.innerHTML = filtered.length > 0 ? filtered.map(t => `
    <tr>
      <td><input type="checkbox" ${t.status === 'Completed' ? 'checked' : ''} onchange="toggleTaskComplete(${t.id}, this.checked)"></td>
      <td><strong>${escapeHtml(t.title)}</strong>${t.is_recurring ? '<span class="badge bg-info text-dark ms-1" title="Recurring">↻</span>' : ''}<td>
      <td>${escapeHtml(t.category || 'General')}</td>
      <td><span class="task-priority ${t.priority}">${t.priority}</span></td>
      <td><select class="form-select form-select-sm" onchange="updateTaskStatus(${t.id}, this.value)"><option value="Pending" ${t.status === 'Pending' ? 'selected' : ''}>Pending</option><option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option></select></td>
      <td>${formatDate(t.due_date, t.due_time)}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-secondary" onclick="openTaskModal(${t.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="deleteTask(${t.id})"><i class="bi bi-trash"></i></button></td>
    </tr>`).join('') : '<tr><td colspan="7" class="text-center text-muted">No tasks match this filter.</td></tr>';
}

async function toggleTaskComplete(id, completed) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const updates = { status: completed ? 'Completed' : 'Pending' };
  if (completed) {
    updates.completed_at = new Date().toISOString();
    logTaskHistory(id, 'completed', null);
  } else {
    updates.completed_at = null;
    logTaskHistory(id, 'reopened', null);
  }
  Storage.update('tasks', id, updates);
  loadData();
  if (state.currentPage === 'tasks') renderTasksPage(document.getElementById('content-wrapper'));
}

async function updateTaskStatus(id, status) {
  const task = Storage.getById('tasks', id);
  const updates = { status };
  if (status === 'Completed' && !task.completed_at) {
    updates.completed_at = new Date().toISOString();
    logTaskHistory(id, 'completed', null);
  } else if (status !== 'Completed' && task.completed_at) {
    updates.completed_at = null;
    logTaskHistory(id, 'reopened', null);
  }
  Storage.update('tasks', id, updates);
  loadData();
  renderTasksPage(document.getElementById('content-wrapper'));
}

// ===== Task Modal =====
let currentTaskId = null;
let currentTask = null;

async function openTaskModal(id) {
  currentTaskId = id;
  let modalDiv = document.getElementById('task-modal-container');
  if (!modalDiv) {
    modalDiv = document.createElement('div');
    modalDiv.id = 'task-modal-container';
    document.body.appendChild(modalDiv);
  }
  await loadTaskModal();
  const modal = new bootstrap.Modal(document.getElementById('task-modal'));
  modal.show();
}

async function loadTaskModal() {
  const container = document.getElementById('task-modal-container');
  if (currentTaskId) {
    currentTask = Storage.getById('tasks', currentTaskId);
    if (!currentTask) return;
  } else {
    currentTask = {
      title: '', description: '', category: 'General', priority: 'Normal',
      status: 'Pending', due_date: '', due_time: '', reminder_enabled: 0,
      checklist: [], is_recurring: 0, recurrence_interval: 1,
      recurrence_unit: 'days', recurrence_end_date: '', notes: ''
    };
  }

  const checklistItems = Array.isArray(currentTask.checklist) ? currentTask.checklist : JSON.parse(currentTask.checklist || '[]');

  container.innerHTML = `
    <div class="modal fade" id="task-modal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <form id="task-form">
            <div class="modal-header"><h5 class="modal-title">${currentTaskId ? 'Edit Task' : 'New Task'}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
              <div class="mb-3"><label class="form-label">Title *</label><input type="text" class="form-control" id="task-title" value="${escapeHtml(currentTask.title)}" required></div>
              <div class="mb-3"><label class="form-label">Description</label><textarea class="form-control" id="task-description" rows="3">${escapeHtml(currentTask.description || '')}</textarea></div>
              <div class="row g-3 mb-3">
                <div class="col-md-6"><label class="form-label">Category</label><input type="text" class="form-control" id="task-category" value="${escapeHtml(currentTask.category || 'General')}"></div>
                <div class="col-md-3"><label class="form-label">Priority</label><select class="form-select" id="task-priority">
                  <option value="Urgent" ${currentTask.priority === 'Urgent' ? 'selected' : ''}>🚨 Urgent</option>
                  <option value="High" ${currentTask.priority === 'High' ? 'selected' : ''}>🔥 High</option>
                  <option value="Normal" ${currentTask.priority === 'Normal' ? 'selected' : ''}>📋 Normal</option>
                  <option value="Low" ${currentTask.priority === 'Low' ? 'selected' : ''}>✅ Low</option>
                </select></div>
                <div class="col-md-3"><label class="form-label">Status</label><select class="form-select" id="task-status">
                  <option value="Pending" ${currentTask.status === 'Pending' ? 'selected' : ''}>Pending</option>
                  <option value="In Progress" ${currentTask.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                  <option value="Completed" ${currentTask.status === 'Completed' ? 'selected' : ''}>Completed</option>
                </select></div>
              </div>
              <div class="row g-3 mb-3">
                <div class="col-md-6"><label class="form-label">Due Date</label><input type="date" class="form-control" id="task-due-date" value="${currentTask.due_date || ''}"></div>
                <div class="col-md-3"><label class="form-label">Due Time</label><input type="time" class="form-control" id="task-due-time" value="${currentTask.due_time || ''}"></div>
                <div class="col-md-3 d-flex align-items-end"><div class="form-check"><input type="checkbox" class="form-check-input" id="task-reminder-enabled" ${currentTask.reminder_enabled ? 'checked' : ''}><label class="form-check-label" for="task-reminder-enabled">Enable Reminder</label></div></div>
              </div>
              <div class="mb-3"><label class="form-label">Reminder Offset (min before)</label><input type="number" class="form-control" id="task-reminder-offset" value="${currentTask.reminder_offset_minutes || 30}" min="0"></div>
              <div class="mb-3"><label class="form-label">Checklist</label><div id="checklist-items">
                ${checklistItems.map((item, i) => `
                <div class="checklist-item" id="checklist-item-${i}">
                  <input type="checkbox" ${item.done ? 'checked' : ''}>
                  <input type="text" class="form-control form-control-sm" value="${escapeHtml(item.text || '')}" onchange="updateChecklistItemText(${i}, this.value)">
                  <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeChecklistItem(${i})"><i class="bi bi-x"></i></button>
                </div>`).join('')}
              </div><button type="button" class="btn btn-sm btn-outline-secondary" onclick="addChecklistItem()"><i class="bi bi-plus"></i> Add Item</button></div>
              <div class="mb-3"><label class="form-switch"><input type="checkbox" class="form-check-input" id="task-recurring" ${currentTask.is_recurring ? 'checked' : ''} onchange="toggleRecurrence()"><span class="form-check-label ms-2">Recurring Task</span></label></div>
              <div id="recurrence-options" class="mb-3 ${currentTask.is_recurring ? '' : 'd-none'}">
                <div class="row g-3">
                  <div class="col-md-4"><label class="form-label">Repeat Every</label><input type="number" class="form-control" id="task-recurrence-interval" value="${currentTask.recurrence_interval || 1}" min="1"></div>
                  <div class="col-md-4"><label class="form-label">Unit</label><select class="form-select" id="task-recurrence-unit">
                    <option value="days" ${currentTask.recurrence_unit === 'days' ? 'selected' : ''}>Days</option>
                    <option value="weeks" ${currentTask.recurrence_unit === 'weeks' ? 'selected' : ''}>Weeks</option>
                    <option value="months" ${currentTask.recurrence_unit === 'months' ? 'selected' : ''}>Months</option>
                    <option value="years" ${currentTask.recurrence_unit === 'years' ? 'selected' : ''}>Years</option>
                  </select></div>
                  <div class="col-md-4"><label class="form-label">End Date (blank = no end)</label><input type="date" class="form-control" id="task-recurrence-end" value="${currentTask.recurrence_end_date || ''}"></div>
                </div>
              </div>
              <div class="mb-3"><label class="form-label">Notes</label><textarea class="form-control" id="task-notes" rows="2">${escapeHtml(currentTask.notes || '')}</textarea></div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-pink">Save</button></div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('task-form').onsubmit = function(e) {
    e.preventDefault();
    saveTask();
  };
}

function addChecklistItem() {
  const container = document.getElementById('checklist-items');
  const idx = container.children.length;
  const div = document.createElement('div');
  div.className = 'checklist-item';
  div.id = 'checklist-item-' + idx;
  div.innerHTML = `<input type="checkbox"><input type="text" class="form-control form-control-sm" onchange="updateChecklistItemText(${idx}, this.value)" placeholder="Item..."><button type="button" class="btn btn-sm btn-outline-danger" onclick="removeChecklistItem(${idx})"><i class="bi bi-x"></i></button>`;
  container.appendChild(div);
}

function removeChecklistItem(idx) {
  const item = document.getElementById('checklist-item-' + idx);
  if (item) item.remove();
  // Re-index remaining items
  const items = document.querySelectorAll('#checklist-items .checklist-item');
  items.forEach((el, i) => {
    el.id = 'checklist-item-' + i;
    const cb = el.querySelector('input[type="checkbox"]');
    const txt = el.querySelector('input[type="text"]');
    if (txt) txt.onchange = () => updateChecklistItemText(i, txt.value);
    const rmBtn = el.querySelector('button');
    if (rmBtn) rmBtn.onclick = () => removeChecklistItem(i);
  });
}

function toggleRecurrence() {
  const checked = document.getElementById('task-recurring').checked;
  document.getElementById('recurrence-options').classList.toggle('d-none', !checked);
}

async function saveTask() {
  const checklist = [];
  document.querySelectorAll('#checklist-items .checklist-item').forEach(item => {
    const cb = item.querySelector('input[type="checkbox"]');
    const txt = item.querySelector('input[type="text"]');
    if (txt && txt.value.trim()) {
      checklist.push({ text: txt.value.trim(), done: cb ? cb.checked : false });
    }
  });

  const taskData = {
    title: document.getElementById('task-title').value,
    description: document.getElementById('task-description').value,
    category: document.getElementById('task-category').value,
    priority: document.getElementById('task-priority').value,
    status: document.getElementById('task-status').value,
    due_date: document.getElementById('task-due-date').value,
    due_time: document.getElementById('task-due-time').value,
    reminder_offset_minutes: parseInt(document.getElementById('task-reminder-offset').value) || 30,
    checklist: JSON.stringify(checklist),
    is_recurring: document.getElementById('task-recurring').checked ? 1 : 0,
    recurrence_interval: parseInt(document.getElementById('task-recurrence-interval').value) || 1,
    recurrence_unit: document.getElementById('task-recurrence-unit').value,
    recurrence_end_date: document.getElementById('task-recurrence-end').value || null,
    notes: document.getElementById('task-notes').value
  };

  try {
    if (currentTaskId) {
      Storage.update('tasks', currentTaskId, taskData);
    } else {
      const task = insertRecord('tasks', taskData);
      logTaskHistory(task.id, 'created', null);
    }
    bootstrap.Modal.getInstance(document.getElementById('task-modal')).hide();
    document.getElementById('task-modal-container').innerHTML = '';
    currentTaskId = null;
    loadData();
    if (state.currentPage === 'tasks') renderTasksPage(document.getElementById('content-wrapper'));
    if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-wrapper'));
  } catch (e) {
    showError('Failed to save task: ' + e.message);
  }
}

function insertRecord(type, record) {
  const records = Storage.getAll(type);
  const lastId = records.length ? Math.max(...records.map(r => r.id)) : 0;
  record.id = lastId + 1;
  record.created_at = new Date().toISOString();
  record.updated_at = record.created_at;
  records.push(record);
  Storage.saveAll(type, records);
  return record;
}

function deleteTask(id) {
  if (!confirm('Delete this task? This cannot be undone.')) return;
  const task = Storage.getById('tasks', id);
  logTaskHistory(id, 'deleted', null);
  Storage.delete('tasks', id);
  loadData();
  renderTasksPage(document.getElementById('content-wrapper'));
}

// ===== Completed Tasks Page =====
async function renderCompletedPage(container) {
  const completed = Storage.getAll('tasks').filter(t => t.status === 'Completed');
  state.completedTasks = completed;

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Completed Tasks</h2>
      <input type="text" class="form-control form-control-sm" placeholder="Search..." style="max-width:250px" onkeyup="searchCompleted(this.value)">
    </div>
    <div class="card"><div class="card-body p-0">
      ${completed.length > 0 ? renderCompletedTable(completed) : `<div class="empty-state"><i class="bi bi-check-circle"></i><h4>No completed tasks</h4><p>Complete tasks to see them here.</p></div>`}
    </div></div>
  `;
}

function renderCompletedTable(tasks) {
  return `
    <table class="table table-pink table-hover mb-0">
      <thead><tr><th>Task</th><th>Category</th><th>Priority</th><th>Completed</th><th>Due Date</th><th class="text-end">Actions</th></tr></thead>
      <tbody>
        ${tasks.map(t => `
          <tr>
            <td><strong>${escapeHtml(t.title)}</strong>${t.description ? `<div class="text-muted small">${escapeHtml(truncateText(t.description, 80))}</div>` : ''}</td>
            <td>${escapeHtml(t.category || 'General')}</td>
            <td><span class="task-priority ${t.priority}">${t.priority}</span></td>
            <td>${t.completed_at ? dayjs(t.completed_at).format('MMM D, YYYY h:mm A') : '-'}</td>
            <td>${formatDate(t.due_date, t.due_time)}</td>
            <td class="text-end"><button class="btn btn-sm btn-outline-secondary" onclick="openTaskModal(${t.id})"><i class="bi bi-eye"></i> View</button> <button class="btn btn-sm btn-outline-warning ms-2" onclick="reopenTask(${t.id})"><i class="bi bi-arrow-counterclockwise"></i> Reopen</button></td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;
}

function searchCompleted(query) {
  const completed = (state.completedTasks || Storage.getAll('tasks').filter(t => t.status === 'Completed'));
  const filtered = query ? completed.filter(t => (t.title + ' ' + (t.description || '')).toLowerCase().includes(query.toLowerCase())) : completed;
  const tbody = document.querySelector('tbody');
  tbody.innerHTML = filtered.length > 0 ? filtered.map(t => `
    <tr><td><strong>${escapeHtml(t.title)}</strong>${t.description ? `<div class="text-muted small">${escapeHtml(truncateText(t.description, 80))}</div>` : ''}</td><td>${escapeHtml(t.category || 'General')}</td><td><span class="task-priority ${t.priority}">${t.priority}</span></td><td>${t.completed_at ? dayjs(t.completed_at).format('MMM D, YYYY h:mm A') : '-'}</td><td>${formatDate(t.due_date, t.due_time)}</td><td class="text-end"><button class="btn btn-sm btn-outline-secondary" onclick="openTaskModal(${t.id})"><i class="bi bi-eye"></i> View</button> <button class="btn btn-sm btn-outline-warning ms-2" onclick="reopenTask(${t.id})"><i class="bi bi-arrow-counterclockwise"></i> Reopen</button></td></tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted">No completed tasks match this search.</td></tr>';
}

function reopenTask(id) {
  Storage.update('tasks', id, { status: 'Pending', completed_at: null });
  logTaskHistory(id, 'reopened', null);
  loadData();
  renderCompletedPage(document.getElementById('content-wrapper'));
  renderDashboard(document.getElementById('content-wrapper'));
}

// ===== Notes Page =====
async function renderNotesPage(container) {
  const notes = Storage.getAll('notes').filter(n => n.is_archived === 0 || n.is_archived === false);
  state.notes = notes.sort((a, b) => {
    if (b.is_pinned && !a.is_pinned) return -1;
    if (!b.is_pinned && a.is_pinned) return 1;
    return (b.updated_at || '').localeCompare(a.updated_at || '');
  });
  let filtered = notes;

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Important Notes</h2>
      <button class="btn btn-pink" onclick="openNoteModal()"><i class="bi bi-plus-lg"></i> New Note</button>
    </div>
    <div class="filter-pills">
      <span class="filter-pill active" onclick="filterNotes('all')">All</span>
      <span class="filter-pill" onclick="filterNotes('pinned')">Pinned</span>
      <span class="filter-pill" onclick="filterNotes('important')">Important</span>
    </div>
    <div class="row g-3" id="notes-grid">${renderNotesGrid(filtered)}</div>
  `;
}

function renderNotesGrid(notes) {
  if (!notes.length) return `<div class="col-12"><div class="empty-state"><i class="bi bi-journal-x"></i><h4>No notes found</h4><p>Create your first note to get started.</p></div></div>`;
  return notes.map(n => {
    const tags = Array.isArray(n.tags) ? n.tags : JSON.parse(n.tags || '[]');
    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>${escapeHtml(n.title || 'Untitled')}</span>
            <div>${n.is_pinned ? '<i class="bi bi-pin-angle-fill text-warning"></i>' : ''}${n.is_important ? '<i class="bi bi-exclamation-octagon-fill text-danger"></i>' : ''}</div>
          </div>
          <div class="card-body">
            <p class="card-text text-muted small mb-2">${escapeHtml(truncateText(n.content || '', 120))}</p>
            ${tags.length ? `<div>${tags.map(t => `<span class="badge bg-secondary me-1">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
            <div class="text-muted small mt-2">${escapeHtml(n.category || 'General')}</div>
          </div>
          <div class="card-footer"><button class="btn btn-sm btn-outline-secondary" onclick="openNoteModal(${n.id})"><i class="bi bi-pencil"></i> Edit</button> <button class="btn btn-sm btn-outline-warning ms-2" onclick="toggleNotePin(${n.id})"><i class="bi bi-pin-${n.is_pinned ? 'fill' : 'angle'}"></i></button></div>
        </div>
      </div>`;
  }).join('');
}

function filterNotes(filter) {
  let filtered = [...state.notes];
  if (filter === 'pinned') filtered = state.notes.filter(n => n.is_pinned);
  else if (filter === 'important') filtered = state.notes.filter(n => n.is_important);
  document.getElementById('notes-grid').innerHTML = renderNotesGrid(filtered);
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
}

let currentNoteId = null;
async function openNoteModal(id) {
  currentNoteId = id;
  const container = document.createElement('div');
  container.id = 'note-modal-container';
  document.body.appendChild(container);

  let note = currentNoteId ? Storage.getById('notes', currentNoteId) : null;
  if (currentNoteId && !note) return;

  if (!note) {
    note = {
      title: '', content: '', category: 'General', tags: [],
      is_pinned: 0, is_important: 0, is_archived: 0,
      related_task_ids: [], related_meeting_ids: []
    };
  }

  const tagsStr = Array.isArray(note.tags) ? note.tags.join(', ') : '';

  container.innerHTML = `
    <div class="modal fade" id="note-modal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="note-form">
            <div class="modal-header"><h5 class="modal-title">${currentNoteId ? 'Edit Note' : 'New Note'}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
              <div class="mb-3"><label class="form-label">Title *</label><input type="text" class="form-control" id="note-title" value="${escapeHtml(note.title)}" required></div>
              <div class="mb-3"><label class="form-label">Content</label><textarea class="form-control" id="note-content" rows="6">${escapeHtml(note.content || '')}</textarea></div>
              <div class="row g-3 mb-3">
                <div class="col-md-6"><label class="form-label">Category</label><input type="text" class="form-control" id="note-category" value="${escapeHtml(note.category || 'General')}"></div>
                <div class="col-md-6"><label class="form-label">Tags (comma separated)</label><input type="text" class="form-control" id="note-tags" value="${escapeHtml(tagsStr)}"></div>
              </div>
              <div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="note-pinned" ${note.is_pinned ? 'checked' : ''}><label class="form-check-label" for="note-pinned">Pin this note</label></div>
              <div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="note-important" ${note.is_important ? 'checked' : ''}><label class="form-check-label" for="note-important">Mark as important</label></div>
              <div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="note-archived" ${note.is_archived ? 'checked' : ''}><label class="form-check-label" for="note-archived">Archive</label></div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-pink">Save</button></div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('note-form').onsubmit = function(e) {
    e.preventDefault();
    const tags = document.getElementById('note-tags').value.split(',').filter(t => t.trim()).map(t => t.trim());
    const data = {
      title: document.getElementById('note-title').value,
      content: document.getElementById('note-content').value,
      category: document.getElementById('note-category').value,
      tags: tags,
      is_pinned: document.getElementById('note-pinned').checked ? 1 : 0,
      is_important: document.getElementById('note-important').checked ? 1 : 0,
      is_archived: document.getElementById('note-archived').checked ? 1 : 0
    };
    if (currentNoteId) {
      Storage.update('notes', currentNoteId, data);
    } else {
      Storage.add('notes', data);
    }
    bootstrap.Modal.getInstance(document.getElementById('note-modal')).hide();
    document.getElementById('note-modal-container').remove();
    currentNoteId = null;
    loadData();
    renderNotesPage(document.getElementById('content-wrapper'));
    if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-wrapper'));
  };

  const modal = new bootstrap.Modal(document.getElementById('note-modal'));
  modal.show();
}

async function toggleNotePin(id) {
  const note = Storage.getById('notes', id);
  Storage.update('notes', id, { is_pinned: note.is_pinned ? 0 : 1 });
  loadData();
  renderNotesPage(document.getElementById('content-wrapper'));
}

// ===== Meetings Page =====
async function renderMeetingsPage(container) {
  const meetings = Storage.getAll('meetings').filter(m => m.is_archived === 0);
  state.meetings = meetings.sort((a, b) => (b.date_time || '').localeCompare(a.date_time || ''));

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Meeting Notes</h2>
      <button class="btn btn-pink" onclick="openMeetingModal()"><i class="bi bi-plus-lg"></i> New Meeting</button>
    </div>
    <div class="card"><div class="card-body p-0">
      ${meetings.length > 0 ? renderMeetingTable(meetings) : `<div class="empty-state"><i class="bi bi-people"></i><h4>No meeting notes</h4><p>Create your first meeting record to get started.</p></div>`}
    </div></div>
  `;
}

function renderMeetingTable(meetings) {
  return `
    <table class="table table-pink table-hover mb-0">
      <thead><tr><th>Meeting</th><th>Date & Time</th><th>Attendees</th><th>Project</th><th>Action Items</th><th class="text-end">Actions</th></tr></thead>
      <tbody>
        ${meetings.map(m => {
          const attendees = Array.isArray(m.attendees) ? m.attendees : JSON.parse(m.attendees || '[]');
          const actions = Array.isArray(m.action_items) ? m.action_items : JSON.parse(m.action_items || '[]');
          return `
          <tr><td><strong>${escapeHtml(m.title)}</strong></td><td>${m.date_time ? dayjs(m.date_time).format('MMM D, YYYY h:mm A') : '-'}</td><td>${attendees.join(', ') || '-'}</td><td>${escapeHtml(m.related_project || '-')}</td><td>${actions.length}</td>
            <td class="text-end"><button class="btn btn-sm btn-outline-secondary" onclick="openMeetingModal(${m.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger ms-2" onclick="deleteMeeting(${m.id})"><i class="bi bi-trash"></i></button></td></tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

let currentMeetingId = null;
async function openMeetingModal(id) {
  currentMeetingId = id;
  const container = document.createElement('div');
  container.id = 'meeting-modal-container';
  document.body.appendChild(container);

  let m = currentMeetingId ? Storage.getById('meetings', currentMeetingId) : null;
  if (currentMeetingId && !m) return;
  if (!m) m = { title: '', date_time: '', attendees: [], agenda: '', discussion_notes: '', decisions: '', action_items: [], related_project: '', is_archived: 0 };

  const attendeesStr = Array.isArray(m.attendees) ? m.attendees.join(', ') : '';
  const actionItems = Array.isArray(m.action_items) ? m.action_items : JSON.parse(m.action_items || '[]');

  container.innerHTML = `
    <div class="modal fade" id="meeting-modal" tabindex="-1">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <form id="meeting-form">
            <div class="modal-header"><h5 class="modal-title">${currentMeetingId ? 'Edit Meeting' : 'New Meeting'}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-12"><label class="form-label">Meeting Title *</label><input type="text" class="form-control" id="meeting-title" value="${escapeHtml(m.title)}" required></div>
                <div class="col-md-6"><label class="form-label">Date & Time</label><input type="datetime-local" class="form-control" id="meeting-datetime" value="${m.date_time ? m.date_time.replace(' ', 'T').slice(0, 16) : ''}"></div>
                <div class="col-md-6"><label class="form-label">Related Project</label><input type="text" class="form-control" id="meeting-project" value="${escapeHtml(m.related_project || '')}"></div>
                <div class="col-md-12"><label class="form-label">Attendees (comma separated)</label><input type="text" class="form-control" id="meeting-attendees" value="${escapeHtml(attendeesStr)}"></div>
                <div class="col-md-12"><label class="form-label">Agenda</label><textarea class="form-control" id="meeting-agenda" rows="3">${escapeHtml(m.agenda || '')}</textarea></div>
                <div class="col-md-12"><label class="form-label">Discussion Notes</label><textarea class="form-control" id="meeting-discussion" rows="4">${escapeHtml(m.discussion_notes || '')}</textarea></div>
                <div class="col-md-12"><label class="form-label">Decisions Made</label><textarea class="form-control" id="meeting-decisions" rows="3">${escapeHtml(m.decisions || '')}</textarea></div>
                <div class="col-md-12"><label class="form-label">Action Items</label><div id="action-items-list">${renderActionItems(actionItems)}</div><button type="button" class="btn btn-sm btn-outline-secondary mt-2" onclick="addActionItem()"><i class="bi bi-plus"></i> Add Action Item</button></div>
                <div class="col-md-12"><div class="form-check mt-2"><input type="checkbox" class="form-check-input" id="meeting-archived" ${m.is_archived ? 'checked' : ''}><label class="form-check-label" for="meeting-archived">Archive</label></div></div>
              </div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-pink">Save</button></div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('meeting-form').onsubmit = function(e) {
    e.preventDefault();
    const attendees = document.getElementById('meeting-attendees').value.split(',').filter(a => a.trim()).map(a => a.trim());
    const actionItemsArr = [];
    document.querySelectorAll('.action-item-row').forEach(row => {
      const text = row.querySelector('.ai-text').value;
      const assignee = row.querySelector('.ai-assignee').value;
      const due = row.querySelector('.ai-due').value;
      if (text.trim()) actionItemsArr.push({ text: text.trim(), assignee: assignee || null, due_date: due || null });
    });
    const data = {
      title: document.getElementById('meeting-title').value,
      date_time: document.getElementById('meeting-datetime').value,
      attendees: attendees,
      agenda: document.getElementById('meeting-agenda').value,
      discussion_notes: document.getElementById('meeting-discussion').value,
      decisions: document.getElementById('meeting-decisions').value,
      action_items: actionItemsArr,
      related_project: document.getElementById('meeting-project').value,
      is_archived: document.getElementById('meeting-archived').checked ? 1 : 0
    };
    if (currentMeetingId) Storage.update('meetings', currentMeetingId, data);
    else Storage.add('meetings', data);
    bootstrap.Modal.getInstance(document.getElementById('meeting-modal')).hide();
    document.getElementById('meeting-modal-container').remove();
    currentMeetingId = null;
    loadData();
    renderMeetingsPage(document.getElementById('content-wrapper'));
    if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-wrapper'));
  };

  const modal = new bootstrap.Modal(document.getElementById('meeting-modal'));
  modal.show();
}

function renderActionItems(items) {
  if (!items.length) return '<p class="text-muted small">No action items yet.</p>';
  return items.map((item, i) => `
    <div class="row action-item-row mb-2" id="action-item-${i}">
      <div class="col-md-6"><input type="text" class="form-control form-control-sm ai-text" value="${escapeHtml(item.text || '')}" placeholder="Action item..."></div>
      <div class="col-md-3"><input type="text" class="form-control form-control-sm ai-assignee" value="${escapeHtml(item.assignee || '')}" placeholder="Assignee"></div>
      <div class="col-md-3"><input type="date" class="form-control form-control-sm ai-due" value="${item.due_date ? item.due_date.split('T')[0] : ''}"></div>
    </div>`).join('');
}

function addActionItem() {
  const container = document.getElementById('action-items-list');
  container.innerHTML += `
    <div class="row action-item-row mb-2"><div class="col-md-6"><input type="text" class="form-control form-control-sm ai-text" placeholder="Action item..."></div><div class="col-md-3"><input type="text" class="form-control form-control-sm ai-assignee" placeholder="Assignee"></div><div class="col-md-3"><input type="date" class="form-control form-control-sm ai-due"></div></div>`;
}

async function deleteMeeting(id) {
  if (!confirm('Delete this meeting? This cannot be undone.')) return;
  Storage.delete('meetings', id);
  loadData();
  renderMeetingsPage(document.getElementById('content-wrapper'));
}

// ===== Cascades Page =====
async function renderCascadesPage(container) {
  const cascades = Storage.getAll('cascades').filter(c => c.status !== 'Archived');
  state.cascades = cascades.sort((a, b) => (a.creation_date || '').localeCompare(b.creation_date || ''));

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Team Cascades</h2>
      <button class="btn btn-pink" onclick="openCascadeModal()"><i class="bi bi-plus-lg"></i> New Cascade</button>
    </div>
    <div class="filter-pills">
      <span class="filter-pill active" onclick="filterCascades('all')">All Active</span>
      <span class="filter-pill" onclick="filterCascades('To Cascade')">To Cascade</span>
      <span class="filter-pill" onclick="filterCascades('Scheduled')">Scheduled</span>
      <span class="filter-pill" onclick="filterCascades('Cascaded')">Cascaded</span>
    </div>
    <div class="card"><div class="card-body p-0">
      ${cascades.length > 0 ? renderCascadeTable(cascades) : `<div class="empty-state"><i class="bi bi-megaphone"></i><h4>No team cascades</h4><p>Create your first team cascade to get started.</p></div>`}
    </div></div>
  `;
}

function renderCascadeTable(cascades) {
  return `
    <table class="table table-pink table-hover mb-0">
      <thead><tr><th>Title</th><th>Brand/Project</th><th>Priority</th><th>Status</th><th>Deadline</th><th>Created</th><th class="text-end">Actions</th></tr></thead>
      <tbody>
        ${cascades.map(c => `
          <tr>
            <td><strong>${escapeHtml(c.title)}</strong></td>
            <td>${escapeHtml(c.brand_project || '-')}</td>
            <td><span class="task-priority ${c.priority}">${c.priority}</span></td>
            <td><select class="form-select form-select-sm" onchange="updateCascadeStatus(${c.id}, this.value)">
              <option value="To Cascade" ${c.status === 'To Cascade' ? 'selected' : ''}>To Cascade</option>
              <option value="Scheduled" ${c.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
              <option value="Cascaded" ${c.status === 'Cascaded' ? 'selected' : ''}>Cascaded</option>
              <option value="Archived" ${c.status === 'Archived' ? 'selected' : ''}>Archived</option>
            </select></td>
            <td>${formatDate(c.deadline)}</td>
            <td>${c.creation_date ? dayjs(c.creation_date).format('MMM D, YYYY') : '-'}</td>
            <td class="text-end"><button class="btn btn-sm btn-outline-secondary" onclick="openCascadeModal(${c.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-secondary ms-2" onclick="archiveCascade(${c.id})"><i class="bi bi-archive"></i></button></td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;
}

function filterCascades(filter) {
  let filtered = [...state.cascades];
  if (filter === 'all') filtered = state.cascades.filter(c => c.status !== 'Archived');
  else filtered = state.cascades.filter(c => c.status === filter);
  const tbody = document.querySelector('tbody');
  tbody.innerHTML = filtered.length > 0 ? filtered.map(c => `
    <tr><td><strong>${escapeHtml(c.title)}</strong></td><td>${escapeHtml(c.brand_project || '-')}</td><td><span class="task-priority ${c.priority}">${c.priority}</span></td>
      <td><select class="form-select form-select-sm" onchange="updateCascadeStatus(${c.id}, this.value)">
        <option value="To Cascade" ${c.status === 'To Cascade' ? 'selected' : ''}>To Cascade</option>
        <option value="Scheduled" ${c.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
        <option value="Cascaded" ${c.status === 'Cascaded' ? 'selected' : ''}>Cascaded</option>
        <option value="Archived" ${c.status === 'Archived' ? 'selected' : ''}>Archived</option>
      </select></td><td>${formatDate(c.deadline)}</td><td>${c.creation_date ? dayjs(c.creation_date).format('MMM D, YYYY') : '-'}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-secondary" onclick="openCascadeModal(${c.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-secondary ms-2" onclick="archiveCascade(${c.id})"><i class="bi bi-archive"></i></button></td></tr>`).join('') : '<tr><td colspan="7" class="text-center text-muted">No cascades match this filter.</td></tr>';
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
}

function updateCascadeStatus(id, status) {
  const cascade = Storage.getById('cascades', id);
  const updates = { status };
  if (status === 'Cascaded' && !cascade.date_cascaded) updates.date_cascaded = new Date().toISOString();
  if (status === 'Archived') {
    if (confirm('Archive this cascade?')) {
      Storage.update('cascades', id, updates);
      loadData();
      renderCascadesPage(document.getElementById('content-wrapper'));
    }
  } else {
    Storage.update('cascades', id, updates);
  }
}

function archiveCascade(id) {
  if (confirm('Archive this cascade?')) {
    Storage.update('cascades', id, { status: 'Archived' });
    loadData();
    renderCascadesPage(document.getElementById('content-wrapper'));
  }
}

let currentCascadeId = null;
async function openCascadeModal(id) {
  currentCascadeId = id;
  const container = document.createElement('div');
  container.id = 'cascade-modal-container';
  document.body.appendChild(container);

  let c = currentCascadeId ? Storage.getById('cascades', currentCascadeId) : null;
  if (currentCascadeId && !c) return;
  if (!c) c = { title: '', details: '', brand_project: '', priority: 'Normal', deadline: '', status: 'To Cascade', date_cascaded: '', notes: '', original_link: '' };

  container.innerHTML = `
    <div class="modal fade" id="cascade-modal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="cascade-form">
            <div class="modal-header"><h5 class="modal-title">${currentCascadeId ? 'Edit Cascade' : 'New Cascade'}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
              <div class="mb-3"><label class="form-label">Title *</label><input type="text" class="form-control" id="cascade-title" value="${escapeHtml(c.title)}" required></div>
              <div class="mb-3"><label class="form-label">Details / Announcement Content</label><textarea class="form-control" id="cascade-details" rows="4">${escapeHtml(c.details || '')}</textarea></div>
              <div class="mb-3"><label class="form-label">Brand / Project</label><input type="text" class="form-control" id="cascade-brand" value="${escapeHtml(c.brand_project || '')}"></div>
              <div class="row g-3 mb-3">
                <div class="col-md-6"><label class="form-label">Priority</label><select class="form-select" id="cascade-priority">
                  <option value="Urgent" ${c.priority === 'Urgent' ? 'selected' : ''}>🚨 Urgent</option>
                  <option value="High" ${c.priority === 'High' ? 'selected' : ''}>🔥 High</option>
                  <option value="Normal" ${c.priority === 'Normal' ? 'selected' : ''}>📋 Normal</option>
                  <option value="Low" ${c.priority === 'Low' ? 'selected' : ''}>✅ Low</option>
                </select></div>
                <div class="col-md-6"><label class="form-label">Deadline</label><input type="date" class="form-control" id="cascade-deadline" value="${c.deadline || ''}"></div>
              </div>
              <div class="mb-3"><label class="form-label">Status</label><select class="form-select" id="cascade-status">
                <option value="To Cascade" ${c.status === 'To Cascade' ? 'selected' : ''}>To Cascade</option>
                <option value="Scheduled" ${c.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
                <option value="Cascaded" ${c.status === 'Cascaded' ? 'selected' : ''}>Cascaded</option>
                <option value="Archived" ${c.status === 'Archived' ? 'selected' : ''}>Archived</option>
              </select></div>
              <div class="mb-3"><label class="form-label">Date Cascaded</label><input type="date" class="form-control" id="cascade-date-cascaded" value="${c.date_cascaded ? c.date_cascaded.split('T')[0] : ''}"></div>
              <div class="mb-3"><label class="form-label">Notes / Follow-up Details</label><textarea class="form-control" id="cascade-notes" rows="3">${escapeHtml(c.notes || '')}</textarea></div>
              <div class="mb-3"><label class="form-label">Original Document / Link</label><input type="url" class="form-control" id="cascade-link" value="${escapeHtml(c.original_link || '')}"></div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-pink">Save</button></div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('cascade-form').onsubmit = function(e) {
    e.preventDefault();
    let dateCascaded = document.getElementById('cascade-date-cascaded').value;
    const status = document.getElementById('cascade-status').value;
    if (status === 'Cascaded' && !dateCascaded) dateCascaded = new Date().toISOString().split('T')[0];
    const data = {
      title: document.getElementById('cascade-title').value,
      details: document.getElementById('cascade-details').value,
      brand_project: document.getElementById('cascade-brand').value,
      priority: document.getElementById('cascade-priority').value,
      deadline: document.getElementById('cascade-deadline').value || null,
      status: status,
      date_cascaded: dateCascaded || null,
      notes: document.getElementById('cascade-notes').value,
      original_link: document.getElementById('cascade-link').value
    };
    if (currentCascadeId) Storage.update('cascades', currentCascadeId, data);
    else Storage.add('cascades', data);
    bootstrap.Modal.getInstance(document.getElementById('cascade-modal')).hide();
    document.getElementById('cascade-modal-container').remove();
    currentCascadeId = null;
    loadData();
    renderCascadesPage(document.getElementById('content-wrapper'));
    if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-wrapper'));
  };

  const modal = new bootstrap.Modal(document.getElementById('cascade-modal'));
  modal.show();
}

// ===== Settings Page =====
async function renderSettingsPage(container) {
  state.settings = Storage.getSettings();

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4"><h2 class="mb-0">Settings</h2></div>
    <div class="card mb-4">
      <div class="card-header">Appearance</div>
      <div class="card-body">
        <div class="form-check form-switch mb-2">
          <input type="checkbox" class="form-check-input" id="setting-theme-dark" ${state.settings.theme === 'dark' ? 'checked' : ''} onchange="saveSetting('theme', this.checked ? 'dark' : 'light')">
          <label class="form-check-label" for="setting-theme-dark">Dark theme</label>
        </div>
      </div>
    </div>
    <div class="card mb-4">
      <div class="card-header">Data Management</div>
      <div class="card-body">
        <button class="btn btn-pink" onclick="exportData()"><i class="bi bi-download"></i> Export All Data</button>
        <button class="btn btn-outline-secondary" onclick="importData()">Import Data</button>
        <input type="file" id="import-file" class="d-none" accept=".json" onchange="handleImport(this.files)">
      </div>
    </div>
    <div class="card mb-4">
      <div class="card-header">About</div>
      <div class="card-body">
        <p class="text-muted small">Danielle's Planner v1.0<br>Data is stored in your browser's local storage. It persists across page refreshes but is not synced across devices.</p>
      </div>
    </div>
  `;
}

function saveSetting(key, value) {
  state.settings[key] = value;
  Storage.saveSettings(state.settings);
}

// ===== Export/Import =====
function exportData() {
  const data = Storage.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `danielle-planner-export-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showSuccess('Data exported!');
}

function importData() {
  document.getElementById('import-file').click();
}

async function handleImport(files) {
  const file = files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!confirm('This will merge imported data with your existing records. Continue?')) return;
    Storage.importAll(data);
    loadData();
    showSuccess('Data imported successfully!');
    if (state.currentPage === 'settings') renderSettingsPage(document.getElementById('content-wrapper'));
  } catch (e) {
    showError('Invalid import file: ' + e.message);
  }
}

// ===== Global Search =====
async function performGlobalSearch() {
  const query = document.getElementById('global-search').value.trim();
  const dropdown = document.getElementById('global-search-dropdown');
  if (!query) { dropdown.classList.remove('show'); return; }

  loadData();
  const s = query.toLowerCase();
  const tasks = Storage.getAll('tasks').filter(t => t.status !== 'Completed' && ((t.title || '').toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s)));
  const notes = Storage.getAll('notes').filter(n => (n.is_archived === 0 || n.is_archived === false) && ((n.title || '').toLowerCase().includes(s) || (n.content || '').toLowerCase().includes(s)));
  const meetings = Storage.getAll('meetings').filter(m => m.is_archived === 0 && ((m.title || '').toLowerCase().includes(s) || (m.agenda || '').toLowerCase().includes(s)));
  const cascades = Storage.getAll('cascades').filter(c => c.status !== 'Archived' && ((c.title || '').toLowerCase().includes(s) || (c.details || '').toLowerCase().includes(s)));

  let html = '';
  if (tasks.length) html += '<h6 class="px-3 py-1 bg-light text-muted small mb-0">Tasks</h6>' + tasks.map(t => `<a href="#" class="global-search-item" onclick="openTaskModal(${t.id}); closeSearch();"><span class="badge bg-info text-dark search-type">Task</span><strong>${escapeHtml(t.title)}</strong><div class="text-muted small">${escapeHtml(truncateText(t.description || '', 60))}</div></a>`).join('');
  if (notes.length) html += '<h6 class="px-3 py-1 bg-light text-muted small mb-0">Notes</h6>' + notes.map(n => `<a href="#" class="global-search-item" onclick="openNoteModal(${n.id}); closeSearch();"><span class="badge bg-warning text-dark search-type">Note</span><strong>${escapeHtml(n.title)}</strong></a>`).join('');
  if (meetings.length) html += '<h6 class="px-3 py-1 bg-light text-muted small mb-0">Meetings</h6>' + meetings.map(m => `<a href="#" class="global-search-item" onclick="openMeetingModal(${m.id}); closeSearch();"><span class="badge bg-primary text-dark search-type">Meeting</span><strong>${escapeHtml(m.title)}</strong></a>`).join('');
  if (cascades.length) html += '<h6 class="px-3 py-1 bg-light text-muted small mb-0">Cascades</h6>' + cascades.map(c => `<a href="#" class="global-search-item" onclick="openCascadeModal(${c.id}); closeSearch();"><span class="badge bg-secondary search-type">Cascade</span><strong>${escapeHtml(c.title)}</strong></a>`).join('');
  if (!html) html = '<div class="global-search-item">No results found</div>';
  dropdown.innerHTML = html;
  dropdown.classList.add('show');
}

function closeSearch() {
  document.getElementById('global-search').value = '';
  document.getElementById('global-search-dropdown').classList.remove('show');
}
