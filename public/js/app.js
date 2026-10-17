// ===== PersonalPlanner App =====

const API = axios.create({ baseURL: '/api', timeout: 10000 });
const dayjs = window.dayjs;
dayjs.extend(window.dayjs_plugin_customParseFormat);

// State
const state = {
  currentPage: 'dashboard',
  tasks: [],
  completedTasks: [],
  notes: [],
  meetings: [],
  cascades: [],
  notifications: [],
  settings: {},
  pushSubscription: null,
  activeFilters: {},
  searchQuery: '',
  theme: localStorage.getItem('theme') || 'light'
};

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  registerServiceWorker();
  loadSettings();
  setupEventListeners();
  checkNotificationPermission();
  renderPage('dashboard');
});

// ===== Theme =====
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const icon = document.querySelector('#theme-toggle i');
  if (state.theme === 'dark') icon.className = 'bi bi-sun';
  else icon.className = 'bi bi-moon';
}

// ===== Service Worker =====
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      // Register push subscription
      if (typeof axios === 'undefined') return;
      const vapidResp = await API.get('/push/vapidPublicKey');
      const vapidPublicKey = vapidResp.data.key;
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      state.pushSubscription = await reg.pushManager.subscribe({
        userVisibleOptions: {
          applicationServerKey: convertedKey,
          scope: { body: "task_notifications", icon: "/favicon.ico" }
        }
      });
      await API.post('/push/subscribe', { subscription: state.pushSubscription });
      console.log('Push subscription registered');
      loadDevices();
    } catch (e) { console.log('SW/Push registration:', e.message); }
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

// ===== Event Listeners =====
function setupEventListeners() {
  // Sidebar navigation
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.page;
      renderPage(page);
    });
  });

  // Sidebar toggle mobile
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('show');
  });
  document.getElementById('sidebar-open').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('show');
  });

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    applyTheme();
  });

  // Global search
  const searchInput = document.getElementById('global-search');
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performGlobalSearch(), 300);
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') performGlobalSearch();
  });
  document.getElementById('global-search-btn').addEventListener('click', performGlobalSearch);

  // Notification prompts
  document.getElementById('enable-notifications-btn').addEventListener('click', requestNotificationPermission);
  document.getElementById('dismiss-notifications-btn').addEventListener('click', () => {
    document.getElementById('notification-permission-prompt').classList.add('d-none');
  });

  // Desktop alert actions
  document.getElementById('alert-mark-complete').addEventListener('click', closeDesktopAlert);
  document.getElementById('alert-acknowledge').addEventListener('click', closeDesktopAlert);
  document.getElementById('alert-snooze').addEventListener('click', snoozeAlert);
  document.getElementById('alert-open-details').addEventListener('click', openAlertDetails);

  // Click outside search dropdown
  document.addEventListener('click', e => {
    if (!e.target.closest('#global-search-container')) {
      document.getElementById('global-search-dropdown').classList.remove('show');
    }
  });

  // Export data
  document.getElementById('export-data-btn').addEventListener('click', exportData);
}

// ===== Notification Permission =====
function checkNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    document.getElementById('notification-permission-prompt').classList.remove('d-none');
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  const permission = await Notification.requestPermission();
  document.getElementById('notification-permission-prompt').classList.add('d-none');
  if (permission === 'granted') {
    registerServiceWorker();
  }
}

// ===== Rendering Pages =====
function renderPage(page) {
  state.currentPage = page;
  document.getElementById('page-title').textContent = getPageTitle(page);

  // Update sidebar
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  // Hide all pages, show current
  const container = document.getElementById('content-wrapper');
  renderContent(container, page);

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('show');
}

function getPageTitle(page) {
  const titles = {
    dashboard: 'Dashboard',
    tasks: 'My Tasks',
    completed: 'Completed / Archived',
    notes: 'Important Notes',
    meetings: 'Meeting Notes',
    cascades: 'Team Cascades',
    notifications: 'Notifications',
    settings: 'Settings'
  };
  return titles[page] || 'Dashboard';
}

async function renderContent(container, page) {
  try {
    switch (page) {
      case 'dashboard':
        await renderDashboard(container);
        break;
      case 'tasks':
        await renderTasksPage(container);
        break;
      case 'completed':
        await renderCompletedPage(container);
        break;
      case 'notes':
        await renderNotesPage(container);
        break;
      case 'meetings':
        await renderMeetingsPage(container);
        break;
      case 'cascades':
        await renderCascadesPage(container);
        break;
      case 'notifications':
        await renderNotificationsPage(container);
        break;
      case 'settings':
        await renderSettingsPage(container);
        break;
    }
  } catch (e) {
    container.innerHTML = `<div class="alert alert-danger">Error loading page: ${e.message}</div>`;
  }
}

// ===== Dashboard =====
async function renderDashboard(container) {
  const [summaryResp, settingsResp] = await Promise.allSettled([
    API.get('/dashboard'),
    API.get('/settings')
  ]);
  const summary = summaryResp.status === 'fulfilled' ? summaryResp.value.data : {};
  state.settings = settingsResp.status === 'fulfilled' ? settingsResp.value.data : {};

  let overdueAlert = '';
  if (summary.overdue > 0) {
    overdueAlert = `
      <div class="alert alert-danger d-flex align-items-center" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        <div>You have ${summary.overdue} overdue ${summary.overdue === 1 ? 'task' : 'tasks'} that need attention.</div>
        <button class="btn btn-sm btn-outline-danger ms-auto" onclick="renderPage('tasks')">View Overdue</button>
      </div>
    `;
  }

  let urgentAlert = '';
  if (summary.urgent > 0) {
    urgentAlert = `
      <div class="alert alert-warning d-flex align-items-center" role="alert">
        <i class="bi bi-clock-fill me-2"></i>
        <div>${summary.urgent} urgent ${summary.urgent === 1 ? 'task' : 'tasks'} pending.</div>
        <button class="btn btn-sm btn-outline-warning ms-auto" onclick="renderPage('tasks')">View Urgent</button>
      </div>
    `;
  }

  // Trigger desktop alert for urgent tasks if dashboard is visible
  if (summary.urgent > 0 && !sessionStorage.getItem(`alert_shown_${summary.urgent}`)) {
    setTimeout(() => showDesktopAlert({
      title: 'Urgent Tasks Reminder',
      message: `You have ${summary.urgent} urgent task(s) that need attention. Don't let them slip through!`,
      priority: 'Urgent',
      deadline: summary.upcomingTasks?.[0]?.due_date || '-',
      source: 'My Tasks',
      url: '/tasks'
    }), 500);
    sessionStorage.setItem(`alert_shown_${summary.urgent}`, '1');
  }

  container.innerHTML = `
    <div class="dashboard-grid">
      <div class="dashboard-widget">
        <div class="widget-header">
          <span class="widget-title">Pending Tasks</span>
          <a href="#" class="widget-link" onclick="renderPage('tasks')">View All</a>
        </div>
        <div class="widget-value">${summary.pending || 0}</div>
      </div>
      <div class="dashboard-widget">
        <div class="widget-header">
          <span class="widget-title">In Progress</span>
          <a href="#" class="widget-link" onclick="renderPage('tasks')">View All</a>
        </div>
        <div class="widget-value">${summary.inProgress || 0}</div>
      </div>
      <div class="dashboard-widget">
        <div class="widget-header">
          <span class="widget-title">Urgent Tasks</span>
          <a href="#" class="widget-link" onclick="renderPage('tasks')">View All</a>
        </div>
        <div class="widget-value urgent">${summary.urgent || 0}</div>
      </div>
      <div class="dashboard-widget">
        <div class="widget-header">
          <span class="widget-title">Overdue</span>
          <a href="#" class="widget-link" onclick="renderPage('tasks')">View All</a>
        </div>
        <div class="widget-value overdue">${summary.overdue || 0}</div>
      </div>
      <div class="dashboard-widget">
        <div class="widget-header">
          <span class="widget-title">Due Today</span>
          <a href="#" class="widget-link" onclick="renderPage('tasks')">View All</a>
        </div>
        <div class="widget-value">${summary.dueToday || 0}</div>
      </div>
      <div class="dashboard-widget">
        <div class="widget-header">
          <span class="widget-title">Team Cascades Pending</span>
          <a href="#" class="widget-link" onclick="renderPage('cascades')">View All</a>
        </div>
        <div class="widget-value">${summary.activeCascades?.length || 0}</div>
      </div>
      <div class="dashboard-widget">
        <div class="widget-header">
          <span class="widget-title">Upcoming Meetings</span>
          <a href="#" class="widget-link" onclick="renderPage('meetings')">View All</a>
        </div>
        <div class="widget-value">${summary.upcomingMeetings?.length || 0}</div>
      </div>
      <div class="dashboard-widget">
        <div class="widget-header">
          <span class="widget-title">Pinned Notes</span>
          <a href="#" class="widget-link" onclick="renderPage('notes')">View All</a>
        </div>
        <div class="widget-value">${summary.pinnedNotes?.length || 0}</div>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-md-6">
        <div class="card">
          <div class="card-header"><i class="bi bi-clipboard-data me-2"></i>Upcoming Deadlines</div>
          <div class="card-body p-0">
            ${summary.upcomingTasks && summary.upcomingTasks.length > 0
              ? `<ul class="list-group list-group-flush">${summary.upcomingTasks.map(t => `
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <strong>${escapeHtml(t.title)}</strong>
                      <div class="text-muted small">${t.due_date || ''}${t.due_time ? ' at ' + t.due_time : ''}</div>
                    </div>
                    <span class="badge bg-${priorityBadge(t.priority)}">${t.priority}</span>
                  </li>
                `).join('')}</ul>`
              : `<div class="empty-state"><i class="bi bi-clipboard-check"></i><p>No upcoming deadlines</p></div>`
            }
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card">
          <div class="card-header"><i class="bi bi-arrow-clockwise me-2"></i>Recently Completed</div>
          <div class="card-body p-0">
            ${summary.recentCompleted && summary.recentCompleted.length > 0
              ? `<ul class="list-group list-group-flush">${summary.recentCompleted.map(t => `
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <strong>${escapeHtml(t.title)}</strong>
                      <div class="text-muted small">Completed ${t.completed_at ? dayjs(t.completed_at).format('MMM D, YYYY') : ''}</div>
                    </div>
                    <span class="badge bg-secondary">${t.category || 'General'}</span>
                  </li>
                `).join('')}</ul>`
              : `<div class="empty-state"><i class="bi bi-clipboard-data"></i><p>No recently completed tasks</p></div>`
            }
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><i class="bi bi-lightning-charge me-2"></i>Quick Actions</div>
      <div class="card-body">
        <div class="quick-actions">
          <button class="btn btn-pink" onclick="openTaskModal()"><i class="bi bi-plus-lg"></i> New Task</button>
          <button class="btn btn-pink" onclick="openNoteModal()"><i class="bi bi-bookmark-plus"></i> New Note</button>
          <button class="btn btn-pink" onclick="openMeetingModal()"><i class="bi bi-people"></i> New Meeting</button>
          <button class="btn btn-pink" onclick="openCascadeModal()"><i class="bi bi-megaphone"></i> New Cascade</button>
        </div>
      </div>
    </div>
  `;

  // Render alert if needed
  if (overdueAlert) container.insertAdjacentHTML('beforeend', overdueAlert);
}

// ===== Tasks Page =====
async function renderTasksPage(container) {
  const resp = await API.get('/tasks');
  state.tasks = resp.data;
  const catResp = await API.get('/tasks/categories');
  const categories = catResp.data.active || [];

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">My Tasks</h2>
      <button class="btn btn-pink" onclick="openTaskModal()">
        <i class="bi bi-plus-lg"></i> New Task
      </button>
    </div>

    <div class="filter-pills">
      <span class="filter-pill active" onclick="filterTasks('all')">All</span>
      <span class="filter-pill" onclick="filterTasks('Pending')">Pending</span>
      <span class="filter-pill" onclick="filterTasks('In Progress')">In Progress</span>
      <span class="filter-pill" onclick="filterTasks('Urgent')">Urgent</span>
      <span class="filter-pill" onclick="filterTasks('High')">High</span>
      ${categories.map(c => `<span class="filter-pill" onclick="filterTasks('cat:${c.category}')">${c.category}</span>`).join('')}
      <span class="filter-pill clear" onclick="filterTasks('all')">Clear</span>
    </div>

    <div class="card">
      <div class="card-body p-0">
        ${state.tasks.length > 0 ? renderTaskTable(state.tasks) : `
          <div class="empty-state">
            <i class="bi bi-clipboard"></i>
            <h4>No tasks yet</h4>
            <p>Create your first task to get started.</p>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderTaskTable(tasks) {
  return `
    <table class="table table-pink table-hover mb-0">
      <thead>
        <tr>
          <th></th>
          <th>Task</th>
          <th>Category</th>
          <th>Priority</th>
          <th>Status</th>
          <th>Due Date</th>
          <th class="text-end">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map(t => `
          <tr>
            <td><input type="checkbox" ${t.status === 'Completed' ? 'checked' : ''} onchange="toggleTaskComplete(${t.id}, this.checked)"></td>
            <td>
              <strong>${escapeHtml(t.title)}</strong>
              ${t.is_recurring ? '<span class="badge bg-info text-dark ms-1" title="Recurring">↻</span>' : ''}
              ${t.description ? `<div class="text-muted small text-truncate">${escapeHtml(t.description)}</div>` : ''}
            </td>
            <td>${escapeHtml(t.category || 'General')}</td>
            <td><span class="task-priority ${t.priority}">${t.priority}</span></td>
            <td>
              ${t.status === 'Completed'
                ? `<span class="status-badge Completed">Completed</span>`
                : `<select class="form-select form-select-sm" onchange="updateTaskStatus(${t.id}, this.value)">
                    <option value="Pending" ${t.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                  </select>`
              }
            </td>
            <td>${formatDate(t.due_date, t.due_time)}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-secondary" onclick="openTaskModal(${t.id})">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteTask(${t.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function filterTasks(filter) {
  const activePills = document.querySelectorAll('.filter-pill');
  activePills.forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
  // Re-render with filter
  let filtered = [...state.tasks];
  if (filter === 'all') {
    // do nothing
  } else if (filter.startsWith('cat:')) {
    const cat = filter.replace('cat:', '');
    filtered = state.tasks.filter(t => t.category === cat);
  } else if (['Pending', 'In Progress', 'Urgent', 'High'].includes(filter)) {
    if (['Pending', 'In Progress'].includes(filter)) {
      filtered = state.tasks.filter(t => t.status === filter);
    } else {
      filtered = state.tasks.filter(t => t.priority === filter);
    }
  }
  const tbody = document.querySelector('tbody');
  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td><input type="checkbox" ${t.status === 'Completed' ? 'checked' : ''} onchange="toggleTaskComplete(${t.id}, this.checked)"></td>
      <td><strong>${escapeHtml(t.title)}</strong> ${t.is_recurring ? '<span class="badge bg-info text-dark ms-1" title="Recurring">↻</span>' : ''}</td>
      <td>${escapeHtml(t.category || 'General')}</td>
      <td><span class="task-priority ${t.priority}">${t.priority}</span></td>
      <td>${t.status === 'Completed' ? '<span class="status-badge Completed">Completed</span>' : `<select class="form-select form-select-sm" onchange="updateTaskStatus(${t.id}, this.value)"><option value="Pending" ${t.status === 'Pending' ? 'selected' : ''}>Pending</option><option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option></select>`}</td>
      <td>${formatDate(t.due_date, t.due_time)}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-secondary" onclick="openTaskModal(${t.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="deleteTask(${t.id})"><i class="bi bi-trash"></i></button></td>
    </tr>
  `).join('');
  if (filtered.length === 0) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No tasks match this filter.</td></tr>`;
}

async function toggleTaskComplete(id, completed) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  await API.put(`/tasks/${id}`, { status: completed ? 'Completed' : 'Pending' });
  if (completed) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    sessionStorage.removeItem(`alert_shown_`);
  } else {
    task.status = 'Pending';
  }
  renderTasksPage(document.getElementById('content-wrapper'));
}

async function updateTaskStatus(id, status) {
  await API.put(`/tasks/${id}`, { status });
  renderTasksPage(document.getElementById('content-wrapper'));
}

// ===== Completed Tasks Page =====
async function renderCompletedPage(container) {
  const resp = await API.get('/tasks/completed');
  state.completedTasks = resp.data;
  const catResp = await API.get('/tasks/categories');
  const categories = catResp.data.completed || [];

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Completed / Archived Tasks</h2>
      <input type="text" class="form-control form-control-sm" placeholder="Search completed tasks..." style="max-width: 250px;" onkeyup="searchCompleted(this.value)">
    </div>

    <div class="card">
      <div class="card-body p-0">
        ${state.completedTasks.length > 0 ? renderCompletedTaskTable(state.completedTasks) : `
          <div class="empty-state">
            <i class="bi bi-check-circle"></i>
            <h4>No completed tasks</h4>
            <p>Complete tasks to see them here.</p>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderCompletedTaskTable(tasks) {
  return `
    <table class="table table-pink table-hover mb-0">
      <thead>
        <tr>
          <th>Task</th>
          <th>Category</th>
          <th>Priority</th>
          <th>Completed</th>
          <th>Due Date</th>
          <th class="text-end">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map(t => `
          <tr>
            <td><strong>${escapeHtml(t.title)}</strong> ${t.description ? `<div class="text-muted small">${escapeHtml(t.description)}</div>` : ''}</td>
            <td>${escapeHtml(t.category || 'General')}</td>
            <td><span class="task-priority ${t.priority}">${t.priority}</span></td>
            <td>${t.completed_at ? dayjs(t.completed_at).format('MMM D, YYYY h:mm A') : '-'}</td>
            <td>${formatDate(t.due_date, t.due_time)}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-secondary" onclick="openTaskModal(${t.id})">
                <i class="bi bi-eye"></i> View
              </button>
              <button class="btn btn-sm btn-outline-warning" onclick="reopenTask(${t.id})">
                <i class="bi bi-arrow-counterclockwise"></i> Reopen
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function searchCompleted(query) {
  const filtered = state.completedTasks.filter(t =>
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    t.description.toLowerCase().includes(query.toLowerCase()) ||
    (t.category || '').toLowerCase().includes(query.toLowerCase())
  );
  const tbody = document.querySelector('tbody');
  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td><strong>${escapeHtml(t.title)}</strong> ${t.description ? `<div class="text-muted small">${escapeHtml(t.description)}</div>` : ''}</td>
      <td>${escapeHtml(t.category || 'General')}</td>
      <td><span class="task-priority ${t.priority}">${t.priority}</span></td>
      <td>${t.completed_at ? dayjs(t.completed_at).format('MMM D, YYYY h:mm A') : '-'}</td>
      <td>${formatDate(t.due_date, t.due_time)}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-secondary" onclick="openTaskModal(${t.id})"><i class="bi bi-eye"></i> View</button> <button class="btn btn-sm btn-outline-warning" onclick="reopenTask(${t.id})"><i class="bi bi-arrow-counterclockwise"></i> Reopen</button></td>
    </tr>
  `).join('');
  if (filtered.length === 0) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No completed tasks match this search.</td></tr>`;
}

async function reopenTask(id) {
  await API.put(`/tasks/${id}`, { status: 'Pending', completed_at: null });
  renderCompletedPage(document.getElementById('content-wrapper'));
  renderPage('dashboard'); // refresh dashboard counts
}

// ===== Task Modal =====
let currentTaskId = null;
let currentTaskData = null;
let checklistCounter = 0;

async function openTaskModal(id) {
  currentTaskId = id;
  const modalEl = document.getElementById('task-modal');
  if (!modalEl) {
    // Create modal dynamically
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = `
      <div class="modal fade" id="task-modal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <form id="task-form">
              <div class="modal-header">
                <h5 class="modal-title" id="task-modal-title">New Task</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body" id="task-modal-body">
                <!-- Loaded by loadTaskModal -->
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-pink" id="task-save-btn">Save Task</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalDiv);
  }
  await loadTaskModal();
  const modal = new bootstrap.Modal(document.getElementById('task-modal'));
  modal.show();
}

async function loadTaskModal() {
  const body = document.getElementById('task-modal-body');
  const titleEl = document.getElementById('task-modal-title');
  const submitBtn = document.getElementById('task-save-btn');

  if (currentTaskId) {
    const resp = await API.get(`/tasks/${currentTaskId}`);
    currentTaskData = resp.data;
    titleEl.textContent = 'Edit Task';
  } else {
    currentTaskData = {
      title: '', description: '', category: 'General', priority: 'Normal',
      status: 'Pending', due_date: '', due_time: '', reminder_enabled: 0,
      reminder_offset_minutes: 30, checklist: [], is_recurring: 0,
      recurrence_pattern: '', recurrence_interval: 1, recurrence_unit: 'days',
      recurrence_end_date: '', notes: ''
    };
    titleEl.textContent = 'New Task';
  }

  // Check if checklist section already rendered
  if (body.innerHTML.includes('task-form-fields')) return;

  body.innerHTML = '';
  body.innerHTML = `
    <div id="task-form-fields">
      <div class="mb-3">
        <label class="form-label">Title *</label>
        <input type="text" class="form-control" id="task-title" value="${escapeHtml(currentTaskData.title)}" required>
      </div>
      <div class="mb-3">
        <label class="form-label">Description</label>
        <textarea class="form-control" id="task-description" rows="3">${escapeHtml(currentTaskData.description || '')}</textarea>
      </div>
      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <label class="form-label">Category</label>
          <input type="text" class="form-control" id="task-category" value="${escapeHtml(currentTaskData.category || 'General')}">
        </div>
        <div class="col-md-3">
          <label class="form-label">Priority</label>
          <select class="form-select" id="task-priority">
            <option value="Urgent" ${currentTaskData.priority === 'Urgent' ? 'selected' : ''}>🚨 Urgent</option>
            <option value="High" ${currentTaskData.priority === 'High' ? 'selected' : ''}>🔥 High</option>
            <option value="Normal" ${currentTaskData.priority === 'Normal' ? 'selected' : ''}>📋 Normal</option>
            <option value="Low" ${currentTaskData.priority === 'Low' ? 'selected' : ''}>✅ Low</option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label">Status</label>
          <select class="form-select" id="task-status">
            <option value="Pending" ${currentTaskData.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="In Progress" ${currentTaskData.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Completed" ${currentTaskData.status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <label class="form-label">Due Date</label>
          <input type="date" class="form-control" id="task-due-date" value="${currentTaskData.due_date || ''}">
        </div>
        <div class="col-md-3">
          <label class="form-label">Due Time</label>
          <input type="time" class="form-control" id="task-due-time" value="${currentTaskData.due_time || ''}">
        </div>
        <div class="col-md-3 d-flex align-items-end">
          <div class="form-check">
            <input type="checkbox" class="form-check-input" id="task-reminder-enabled" ${currentTaskData.reminder_enabled ? 'checked' : ''}>
            <label class="form-check-label" for="task-reminder-enabled">Enable Reminder</label>
          </div>
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label">Reminder Offset (minutes before)</label>
        <input type="number" class="form-control" id="task-reminder-offset" value="${currentTaskData.reminder_offset_minutes || 30}" min="0">
      </div>

      <div class="mb-3">
        <label class="form-label">Checklist</label>
        <div id="checklist-items">
          ${renderChecklist(currentTaskData.checklist || [])}
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="addChecklistItem()">
          <i class="bi bi-plus"></i> Add Item
        </button>
      </div>

      <div class="mb-3">
        <label class="form-switch">
          <input type="checkbox" class="form-check-input" id="task-recurring" ${currentTaskData.is_recurring ? 'checked' : ''} onchange="toggleRecurrenceOptions()">
          <span class="form-check-label ms-2">Recurring Task</span>
        </label>
      </div>

      <div id="recurrence-options" class="mb-3 ${currentTaskData.is_recurring ? '' : 'd-none'}">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label">Repeat Every</label>
            <input type="number" class="form-control" id="task-recurrence-interval" value="${currentTaskData.recurrence_interval || 1}" min="1">
          </div>
          <div class="col-md-4">
            <label class="form-label">Unit</label>
            <select class="form-select" id="task-recurrence-unit">
              <option value="days" ${currentTaskData.recurrence_unit === 'days' ? 'selected' : ''}>Days</option>
              <option value="weeks" ${currentTaskData.recurrence_unit === 'weeks' ? 'selected' : ''}>Weeks</option>
              <option value="months" ${currentTaskData.recurrence_unit === 'months' ? 'selected' : ''}>Months</option>
              <option value="years" ${currentTaskData.recurrence_unit === 'years' ? 'selected' : ''}>Years</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label">End Date (leave blank for no end)</label>
            <input type="date" class="form-control" id="task-recurrence-end" value="${currentTaskData.recurrence_end_date || ''}">
          </div>
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="task-notes" rows="2">${escapeHtml(currentTaskData.notes || '')}</textarea>
      </div>
    </div>
  `;

  // Setup form submit
  const form = document.getElementById('task-form');
  form.onsubmit = async function(e) {
    e.preventDefault();
    await saveTask();
  };

  // Set reminder offset visibility
  toggleReminderOptions();
}

function renderChecklist(items) {
  if (!items || !items.length) {
    return `<div id="checklist-items"><div class="checklist-item"><input type="text" class="form-control form-control-sm" placeholder="Add checklist items..."></div></div>`;
  }
  checklistCounter = items.length;
  return items.map((item, i) => `
    <div class="checklist-item" id="checklist-item-${i}">
      <input type="checkbox" ${item.done ? 'checked' : ''} onchange="updateChecklistItem(${i})">
      <input type="text" class="form-control form-control-sm" value="${escapeHtml(item.text || '')}" onchange="updateChecklistItemText(${i}, this.value)">
      <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeChecklistItem(${i})"><i class="bi bi-x"></i></button>
    </div>
  `).join('');
}

function addChecklistItem() {
  const container = document.getElementById('checklist-items');
  const idx = checklistCounter++;
  const div = document.createElement('div');
  div.className = 'checklist-item';
  div.id = `checklist-item-${idx}`;
  div.innerHTML = `
    <input type="checkbox">
    <input type="text" class="form-control form-control-sm" placeholder="Checklist item...">
    <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeChecklistItem(${idx})"><i class="bi bi-x"></i></button>
  `;
  container.appendChild(div);
}

function removeChecklistItem(idx) {
  const item = document.getElementById(`checklist-item-${idx}`);
  if (item) item.remove();
}

function toggleRecurrenceOptions() {
  const checked = document.getElementById('task-recurring').checked;
  document.getElementById('recurrence-options').classList.toggle('d-none', !checked);
}

function toggleReminderOptions() {
  const checked = document.getElementById('task-reminder-enabled')?.checked;
  if (checked) {
    document.getElementById('task-reminder-offset').parentElement.classList.remove('d-none');
  }
}

async function saveTask() {
  const checklist = [];
  const items = document.querySelectorAll('#checklist-items .checklist-item');
  items.forEach(item => {
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
    reminder_enabled: document.getElementById('task-reminder-enabled').checked ? 1 : 0,
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
      await API.put(`/tasks/${currentTaskId}`, taskData);
    } else {
      await API.post('/tasks', taskData);
    }
    bootstrap.Modal.getInstance(document.getElementById('task-modal')).hide();
    renderPage(state.currentPage);
  } catch (e) {
    showError('Failed to save task: ' + e.message);
  }
}

// ===== Notes Page =====
async function renderNotesPage(container) {
  const resp = await API.get('/notes');
  state.notes = resp.data;

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Important Notes</h2>
      <button class="btn btn-pink" onclick="openNoteModal()">
        <i class="bi bi-plus-lg"></i> New Note
      </button>
    </div>

    <div class="filter-pills">
      <span class="filter-pill active" onclick="filterNotes('all')">All</span>
      <span class="filter-pill" onclick="filterNotes('pinned')">Pinned</span>
      <span class="filter-pill" onclick="filterNotes('important')">Important</span>
      <span class="filter-pill" onclick="filterNotes('archived')">Archived</span>
    </div>

    <div class="row g-3" id="notes-grid">
      ${renderNotesGrid(state.notes)}
    </div>
  `;
}

function renderNotesGrid(notes) {
  if (!notes.length) return `<div class="col-12"><div class="empty-state"><i class="bi bi-journal-x"></i><h4>No notes found</h4><p>Create your first note to get started.</p></div></div>`;
  return notes.map(n => {
    const tags = JSON.parse(n.tags || '[]');
    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>${escapeHtml(n.title || 'Untitled')}</span>
            <div>
              ${n.is_pinned ? '<i class="bi bi-pin-angle-fill text-warning"></i>' : ''}
              ${n.is_important ? '<i class="bi bi-exclamation-octagon-fill text-danger"></i>' : ''}
            </div>
          </div>
          <div class="card-body">
            <p class="card-text text-muted small mb-2">${escapeHtml(truncateText(n.content || '', 120))}</p>
            ${tags.length ? `<div>${tags.map(t => `<span class="badge bg-secondary me-1">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
            <div class="text-muted small mt-2">${escapeHtml(n.category || 'General')}</div>
          </div>
          <div class="card-footer">
            <button class="btn btn-sm btn-outline-secondary" onclick="openNoteModal(${n.id})"><i class="bi bi-pencil"></i> Edit</button>
            <button class="btn btn-sm btn-outline-${n.is_pinned ? 'warning' : 'outline'} ms-2" onclick="toggleNotePin(${n.id})">
              <i class="bi bi-pin-${n.is_pinned ? 'fill' : 'angle'}"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterNotes(filter) {
  let filtered = [...state.notes];
  if (filter === 'pinned') filtered = state.notes.filter(n => n.is_pinned);
  else if (filter === 'important') filtered = state.notes.filter(n => n.is_important);
  else if (filter === 'archived') filtered = state.notes.filter(n => n.is_archived);
  document.getElementById('notes-grid').innerHTML = renderNotesGrid(filtered);
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
}

let currentNoteId = null;
function openNoteModal(id) {
  currentNoteId = id;
  showNoteModal();
}

async function showNoteModal() {
  const modalDiv = document.createElement('div');
  modalDiv.innerHTML = `
    <div class="modal fade" id="note-modal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="note-form">
            <div class="modal-header">
              <h5 class="modal-title">${currentNoteId ? 'Edit Note' : 'New Note'}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Title *</label>
                <input type="text" class="form-control" id="note-title" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Content</label>
                <textarea class="form-control" id="note-content" rows="6"></textarea>
              </div>
              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label">Category</label>
                  <input type="text" class="form-control" id="note-category">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Tags (comma separated)</label>
                  <input type="text" class="form-control" id="note-tags">
                </div>
              </div>
              <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="note-pinned">
                <label class="form-check-label" for="note-pinned">Pin this note</label>
              </div>
              <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="note-important">
                <label class="form-check-label" for="note-important">Mark as important</label>
              </div>
              <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="note-archived">
                <label class="form-check-label" for="note-archived">Archive</label>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-pink">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalDiv);

  if (currentNoteId) {
    const resp = await API.get(`/notes/${currentNoteId}`);
    const note = resp.data;
    document.getElementById('note-title').value = note.title;
    document.getElementById('note-content').value = note.content;
    document.getElementById('note-category').value = note.category;
    document.getElementById('note-tags').value = JSON.parse(note.tags || '[]').join(', ');
    document.getElementById('note-pinned').checked = note.is_pinned;
    document.getElementById('note-important').checked = note.is_important;
    document.getElementById('note-archived').checked = note.is_archived;
  } else {
    document.getElementById('note-category').value = 'General';
  }

  document.getElementById('note-form').onsubmit = async function(e) {
    e.preventDefault();
    const tags = document.getElementById('note-tags').value.split(',').filter(t => t.trim()).map(t => t.trim());
    const data = {
      title: document.getElementById('note-title').value,
      content: document.getElementById('note-content').value,
      category: document.getElementById('note-category').value,
      tags: JSON.stringify(tags),
      is_pinned: document.getElementById('note-pinned').checked ? 1 : 0,
      is_important: document.getElementById('note-important').checked ? 1 : 0,
      is_archived: document.getElementById('note-archived').checked ? 1 : 0
    };
    try {
      if (currentNoteId) await API.put(`/notes/${currentNoteId}`, data);
      else await API.post('/notes', data);
      bootstrap.Modal.getInstance(document.getElementById('note-modal')).hide();
      document.getElementById('note-modal').remove();
      currentNoteId = null;
      renderPage('notes');
    } catch (e) {
      showError('Failed to save note: ' + e.message);
    }
  };

  const modal = new bootstrap.Modal(document.getElementById('note-modal'));
  modal.show();
}

async function toggleNotePin(id) {
  const resp = await API.get(`/notes/${id}`);
  const note = resp.data;
  await API.put(`/notes/${id}`, { is_pinned: note.is_pinned ? 0 : 1 });
  renderPage('notes');
}

// ===== Meetings Page =====
async function renderMeetingsPage(container) {
  const resp = await API.get('/meetings');
  state.meetings = resp.data;

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Meeting Notes</h2>
      <button class="btn btn-pink" onclick="openMeetingModal()">
        <i class="bi bi-plus-lg"></i> New Meeting
      </button>
    </div>

    <div class="card">
      <div class="card-body p-0">
        ${state.meetings.length > 0 ? renderMeetingTable(state.meetings) : `
          <div class="empty-state">
            <i class="bi bi-people"></i>
            <h4>No meeting notes</h4>
            <p>Create your first meeting record to get started.</p>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderMeetingTable(meetings) {
  return `
    <table class="table table-pink table-hover mb-0">
      <thead>
        <tr>
          <th>Meeting</th>
          <th>Date & Time</th>
          <th>Attendees</th>
          <th>Project</th>
          <th>Action Items</th>
          <th class="text-end">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${meetings.map(m => {
          const attendees = JSON.parse(m.attendees || '[]');
          const actions = JSON.parse(m.action_items || '[]');
          return `
          <tr>
            <td><strong>${escapeHtml(m.title)}</strong></td>
            <td>${m.date_time ? dayjs(m.date_time).format('MMM D, YYYY h:mm A') : '-'}</td>
            <td>${attendees.join(', ') || '-'}</td>
            <td>${escapeHtml(m.related_project || '-')}</td>
            <td>${actions.length}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-secondary" onclick="openMeetingModal(${m.id})">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteMeeting(${m.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

let currentMeetingId = null;
async function openMeetingModal(id) {
  currentMeetingId = id;
  const modalDiv = document.createElement('div');
  modalDiv.innerHTML = `
    <div class="modal fade" id="meeting-modal" tabindex="-1">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <form id="meeting-form">
            <div class="modal-header">
              <h5 class="modal-title">${id ? 'Edit Meeting' : 'New Meeting'}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-12">
                  <label class="form-label">Meeting Title *</label>
                  <input type="text" class="form-control" id="meeting-title" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Date & Time</label>
                  <input type="datetime-local" class="form-control" id="meeting-datetime">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Related Project</label>
                  <input type="text" class="form-control" id="meeting-project">
                </div>
                <div class="col-md-12">
                  <label class="form-label">Attendees (comma separated)</label>
                  <input type="text" class="form-control" id="meeting-attendees">
                </div>
                <div class="col-md-12">
                  <label class="form-label">Agenda</label>
                  <textarea class="form-control" id="meeting-agenda" rows="3"></textarea>
                </div>
                <div class="col-md-12">
                  <label class="form-label">Discussion Notes</label>
                  <textarea class="form-control" id="meeting-discussion" rows="4"></textarea>
                </div>
                <div class="col-md-12">
                  <label class="form-label">Decisions Made</label>
                  <textarea class="form-control" id="meeting-decisions" rows="3"></textarea>
                </div>
                <div class="col-md-12">
                  <label class="form-label">Action Items</label>
                  <div id="action-items-list"></div>
                  <button type="button" class="btn btn-sm btn-outline-secondary mt-2" onclick="addActionItem()">
                    <i class="bi bi-plus"></i> Add Action Item
                  </button>
                </div>
                <div class="col-md-12">
                  <div class="form-check mt-2">
                    <input type="checkbox" class="form-check-input" id="meeting-archived">
                    <label class="form-check-label" for="meeting-archived">Archive</label>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-pink">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalDiv);

  if (id) {
    const resp = await API.get(`/meetings/${id}`);
    const m = resp.data;
    document.getElementById('meeting-title').value = m.title;
    document.getElementById('meeting-datetime').value = m.date_time ? m.date_time.slice(0, 16) : '';
    document.getElementById('meeting-project').value = m.related_project || '';
    document.getElementById('meeting-attendees').value = JSON.parse(m.attendees || '[]').join(', ');
    document.getElementById('meeting-agenda').value = m.agenda;
    document.getElementById('meeting-discussion').value = m.discussion_notes;
    document.getElementById('meeting-decisions').value = m.decisions;
    document.getElementById('meeting-archived').checked = m.is_archived;
    renderActionItems(JSON.parse(m.action_items || '[]'));
  } else {
    renderActionItems([]);
  }

  document.getElementById('meeting-form').onsubmit = async function(e) {
    e.preventDefault();
    const attendees = document.getElementById('meeting-attendees').value.split(',').filter(a => a.trim()).map(a => a.trim());
    const actionItems = [];
    document.querySelectorAll('.action-item-row').forEach(row => {
      const text = row.querySelector('.ai-text').value;
      const assignee = row.querySelector('.ai-assignee').value;
      const due = row.querySelector('.ai-due').value;
      if (text.trim()) actionItems.push({ text: text.trim(), assignee: assignee || null, due_date: due || null });
    });
    const data = {
      title: document.getElementById('meeting-title').value,
      date_time: document.getElementById('meeting-datetime').value,
      attendees: JSON.stringify(attendees),
      agenda: document.getElementById('meeting-agenda').value,
      discussion_notes: document.getElementById('meeting-discussion').value,
      decisions: document.getElementById('meeting-decisions').value,
      action_items: JSON.stringify(actionItems),
      related_project: document.getElementById('meeting-project').value,
      is_archived: document.getElementById('meeting-archived').checked ? 1 : 0
    };
    try {
      if (id) await API.put(`/meetings/${id}`, data);
      else await API.post('/meetings', data);
      bootstrap.Modal.getInstance(document.getElementById('meeting-modal')).hide();
      document.getElementById('meeting-modal').remove();
      currentMeetingId = null;
      renderPage('meetings');
    } catch (e) {
      showError('Failed to save meeting: ' + e.message);
    }
  };

  const modal = new bootstrap.Modal(document.getElementById('meeting-modal'));
  modal.show();
}

function renderActionItems(items) {
  const container = document.getElementById('action-items-list');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<p class="text-muted small">No action items yet.</p>';
    return;
  }
  container.innerHTML = items.map((item, i) => `
    <div class="row action-item-row mb-2" id="action-item-${i}">
      <div class="col-md-6">
        <input type="text" class="form-control form-control-sm ai-text" value="${escapeHtml(item.text || '')}" placeholder="Action item...">
      </div>
      <div class="col-md-3">
        <input type="text" class="form-control form-control-sm ai-assignee" value="${escapeHtml(item.assignee || '')}" placeholder="Assignee">
      </div>
      <div class="col-md-3">
        <input type="date" class="form-control form-control-sm ai-due" value="${item.due_date ? item.due_date.split('T')[0] : ''}">
      </div>
    </div>
  `).join('');
}

function addActionItem() {
  const container = document.getElementById('action-items-list');
  const idx = Date.now();
  const div = document.createElement('div');
  div.className = 'row action-item-row mb-2';
  div.innerHTML = `
    <div class="col-md-6">
      <input type="text" class="form-control form-control-sm ai-text" placeholder="Action item...">
    </div>
    <div class="col-md-3">
      <input type="text" class="form-control form-control-sm ai-assignee" placeholder="Assignee">
    </div>
    <div class="col-md-3">
      <input type="date" class="form-control form-control-sm ai-due">
    </div>
  `;
  container.appendChild(div);
}

async function deleteMeeting(id) {
  if (!confirm('Delete this meeting? This cannot be undone.')) return;
  await API.delete(`/meetings/${id}`);
  renderPage('meetings');
}

// ===== Cascades Page =====
async function renderCascadesPage(container) {
  const resp = await API.get('/cascades');
  state.cascades = resp.data;

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Team Cascades</h2>
      <button class="btn btn-pink" onclick="openCascadeModal()">
        <i class="bi bi-plus-lg"></i> New Cascade
      </button>
    </div>

    <div class="filter-pills">
      <span class="filter-pill active" onclick="filterCascades('all')">All Active</span>
      <span class="filter-pill" onclick="filterCascades('To Cascade')">To Cascade</span>
      <span class="filter-pill" onclick="filterCascades('Scheduled')">Scheduled</span>
      <span class="filter-pill" onclick="filterCascades('Cascaded')">Cascaded</span>
      <span class="filter-pill" onclick="filterCascades('archived')">Archived</span>
    </div>

    <div class="card">
      <div class="card-body p-0">
        ${state.cascades.length > 0 ? renderCascadeTable(state.cascades) : `
          <div class="empty-state">
            <i class="bi bi-megaphone"></i>
            <h4>No team cascades</h4>
            <p>Create your first team cascade to get started.</p>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderCascadeTable(cascades) {
  return `
    <table class="table table-pink table-hover mb-0">
      <thead>
        <tr>
          <th>Title</th>
          <th>Brand/Project</th>
          <th>Priority</th>
          <th>Status</th>
          <th>Deadline</th>
          <th>Created</th>
          <th class="text-end">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${cascades.map(c => `
          <tr>
            <td><strong>${escapeHtml(c.title)}</strong></td>
            <td>${escapeHtml(c.brand_project || '-')}</td>
            <td><span class="task-priority ${c.priority}">${c.priority}</span></td>
            <td>
              <select class="form-select form-select-sm" onchange="updateCascadeStatus(${c.id}, this.value)">
                <option value="To Cascade" ${c.status === 'To Cascade' ? 'selected' : ''}>To Cascade</option>
                <option value="Scheduled" ${c.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
                <option value="Cascaded" ${c.status === 'Cascaded' ? 'selected' : ''}>Cascaded</option>
                <option value="Archived" ${c.status === 'Archived' ? 'selected' : ''}>Archived</option>
              </select>
            </td>
            <td>${formatDate(c.deadline)}</td>
            <td>${c.creation_date ? dayjs(c.creation_date).format('MMM D, YYYY') : '-'}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-secondary" onclick="openCascadeModal(${c.id})">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteCascade(${c.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function filterCascades(filter) {
  let filtered = [...state.cascades];
  if (filter === 'all') filtered = state.cascades.filter(c => c.status !== 'Archived');
  else if (filter === 'archived') filtered = state.cascades.filter(c => c.status === 'Archived');
  else filtered = state.cascades.filter(c => c.status === filter);
  const tbody = document.querySelector('tbody');
  tbody.innerHTML = filtered.map(c => `
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
      <td class="text-end"><button class="btn btn-sm btn-outline-secondary" onclick="openCascadeModal(${c.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="deleteCascade(${c.id})"><i class="bi bi-trash"></i></button></td>
    </tr>
  `).join('');
  if (filtered.length === 0) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No cascades match this filter.</td></tr>`;
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
}

async function updateCascadeStatus(id, status) {
  const cascade = state.cascades.find(c => c.id === id);
  const data = { status };
  if (status === 'Cascaded' && !cascade.date_cascaded) {
    data.date_cascaded = new Date().toISOString();
  }
  await API.put(`/cascades/${id}`, data);
  renderCascadesPage(document.getElementById('content-wrapper'));
}

let currentCascadeId = null;
async function openCascadeModal(id) {
  currentCascadeId = id;
  const modalDiv = document.createElement('div');
  modalDiv.innerHTML = `
    <div class="modal fade" id="cascade-modal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="cascade-form">
            <div class="modal-header">
              <h5 class="modal-title">${id ? 'Edit Cascade' : 'New Cascade'}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Title *</label>
                <input type="text" class="form-control" id="cascade-title" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Details / Announcement Content</label>
                <textarea class="form-control" id="cascade-details" rows="4"></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label">Brand / Project</label>
                <input type="text" class="form-control" id="cascade-brand">
              </div>
              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label">Priority</label>
                  <select class="form-select" id="cascade-priority">
                    <option value="Urgent">🚨 Urgent</option>
                    <option value="High" selected>🔥 High</option>
                    <option value="Normal">📋 Normal</option>
                    <option value="Low">✅ Low</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Deadline</label>
                  <input type="date" class="form-control" id="cascade-deadline">
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Status</label>
                <select class="form-select" id="cascade-status">
                  <option value="To Cascade">To Cascade</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Cascaded">Cascaded</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Date Cascaded</label>
                <input type="date" class="form-control" id="cascade-date-cascaded">
              </div>
              <div class="mb-3">
                <label class="form-label">Notes / Follow-up Details</label>
                <textarea class="form-control" id="cascade-notes" rows="3"></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label">Original Document / Link</label>
                <input type="url" class="form-control" id="cascade-link" placeholder="https://...">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-pink">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalDiv);

  if (id) {
    const resp = await API.get(`/cascades/${id}`);
    const c = resp.data;
    document.getElementById('cascade-title').value = c.title;
    document.getElementById('cascade-details').value = c.details;
    document.getElementById('cascade-brand').value = c.brand_project;
    document.getElementById('cascade-priority').value = c.priority;
    document.getElementById('cascade-deadline').value = c.deadline;
    document.getElementById('cascade-status').value = c.status;
    document.getElementById('cascade-date-cascaded').value = c.date_cascaded ? c.date_cascaded.split('T')[0] : '';
    document.getElementById('cascade-notes').value = c.notes;
    document.getElementById('cascade-link').value = c.original_link;
  }

  document.getElementById('cascade-form').onsubmit = async function(e) {
    e.preventDefault();
    let dateCascaded = document.getElementById('cascade-date-cascaded').value;
    const status = document.getElementById('cascade-status').value;
    if (status === 'Cascaded' && !dateCascaded) {
      dateCascaded = new Date().toISOString().split('T')[0];
    }
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
    try {
      if (id) await API.put(`/cascades/${id}`, data);
      else await API.post('/cascades', data);
      bootstrap.Modal.getInstance(document.getElementById('cascade-modal')).hide();
      document.getElementById('cascade-modal').remove();
      currentCascadeId = null;
      renderPage('cascades');
    } catch (e) {
      showError('Failed to save cascade: ' + e.message);
    }
  };

  const modal = new bootstrap.Modal(document.getElementById('cascade-modal'));
  modal.show();
}

function deleteCascade(id) {
  // Soft delete: archive it
  API.put(`/cascades/${id}`, { status: 'Archived' });
  renderPage('cascades');
}

// ===== Notifications Page =====
async function renderNotificationsPage(container) {
  const resp = await API.get('/settings');
  state.settings = resp.data;

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Notification Settings</h2>
    </div>

    <div class="card mb-4">
      <div class="card-header">Notification History</div>
      <div class="card-body">
        <div id="notification-history">
          ${renderNotificationHistory()}
        </div>
      </div>
    </div>

    <form id="settings-form">
      <div class="card mb-4">
        <div class="card-header">General Settings</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">Timezone</label>
              <select class="form-select" id="setting-timezone">
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (US & Canada)</option>
                <option value="America/Chicago">Central Time (US & Canada)</option>
                <option value="America/Denver">Mountain Time (US & Canada)</option>
                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                <option value="Asia/Singapore">Singapore</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label">Snooze Duration (min)</label>
              <input type="number" class="form-control" id="setting-snooze" min="5" value="${state.settings.snooze_duration_minutes || 60}">
            </div>
            <div class="col-md-3">
              <label class="form-label">Reminder Frequency</label>
              <select class="form-select" id="setting-frequency">
                <option value="1440">Daily</option>
                <option value="720">12 Hours</option>
                <option value="360">6 Hours</option>
                <option value="60">Hourly</option>
              </select>
            </div>
          </div>

          <div class="row g-3 mt-2">
            <div class="col-md-3">
              <label class="form-label">Quiet Hours Start</label>
              <input type="time" class="form-control" id="setting-quiet-start" value="${state.settings.quiet_hours_start || '22:00'}">
            </div>
            <div class="col-md-3">
              <label class="form-label">Quiet Hours End</label>
              <input type="time" class="form-control" id="setting-quiet-end" value="${state.settings.quiet_hours_end || '07:00'}">
            </div>
          </div>

          <div class="form-check mt-3">
            <input type="checkbox" class="form-check-input" id="setting-sound" ${state.settings.sound_enabled ? 'checked' : ''}>
            <label class="form-check-label" for="setting-sound">Enable notification sounds</label>
          </div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header">Notification Categories</div>
        <div class="card-body">
          <div class="form-check mb-2">
            <input type="checkbox" class="form-check-input" id="setting-task-reminders" ${state.settings.task_reminders ? 'checked' : ''}>
            <label class="form-check-label" for="setting-task-reminders">Task reminders</label>
          </div>
          <div class="form-check mb-2">
            <input type="checkbox" class="form-check-input" id="setting-overdue-reminders" ${state.settings.overdue_reminders ? 'checked' : ''}>
            <label class="form-check-label" for="setting-overdue-reminders">Overdue task reminders</label>
          </div>
          <div class="form-check mb-2">
            <input type="checkbox" class="form-check-input" id="setting-recurring-reminders" ${state.settings.recurring_reminders ? 'checked' : ''}>
            <label class="form-check-label" for="setting-recurring-reminders">Recurring task reminders</label>
          </div>
          <div class="form-check mb-2">
            <input type="checkbox" class="form-check-input" id="setting-cascade-deadlines" ${state.settings.cascade_deadlines ? 'checked' : ''}>
            <label class="form-check-label" for="setting-cascade-deadlines">Cascade deadline reminders</label>
          </div>
          <div class="form-check mb-2">
            <input type="checkbox" class="form-check-input" id="setting-meeting-reminders" ${state.settings.meeting_reminders ? 'checked' : ''}>
            <label class="form-check-label" for="setting-meeting-reminders">Meeting reminders</label>
          </div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header">Connected Devices</div>
        <div class="card-body">
          <div id="devices-list">
            <p class="text-muted small">Checking for connected devices...</p>
          </div>
          <button type="button" class="btn btn-sm btn-outline-secondary mt-2" onclick="loadDevices()">Refresh</button>
          <button type="button" class="btn btn-sm btn-pink mt-2" onclick="sendTestNotification()">Send Test Notification</button>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header">Quick Actions</div>
        <div class="card-body">
          <button type="button" class="btn btn-pink" onclick="saveSettings()">Save Settings</button>
          <button type="button" class="btn btn-outline-secondary ms-2" onclick="renderPage('settings')">Reset</button>
        </div>
      </div>
    </form>
  `;

  document.getElementById('setting-timezone').value = state.settings.timezone || 'UTC';
  document.getElementById('setting-frequency').value = state.settings.upcoming_deadline_minutes || 1440;

  // Auto-save on toggle
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      setTimeout(saveSettings, 500);
    });
  });
}

function renderNotificationHistory() {
  const history = JSON.parse(localStorage.getItem('notification_history') || '[]');
  if (!history.length) return '<p class="text-muted small">No notification history yet.</p>';
  return `
    <div class="list-group">
      ${history.slice().reverse().slice(0, 30).map(n => `
        <div class="list-group-item">
          <strong>${escapeHtml(n.title)}</strong>
          <div class="text-muted small">${escapeHtml(n.body || '')}</div>
          <div class="text-muted small">${new Date(n.timestamp).toLocaleString()}</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadDevices() {
  try {
    const resp = await API.get('/push/subscriptions');
    const container = document.getElementById('devices-list');
    if (!resp.data.length) {
      container.innerHTML = '<p class="text-muted small">No devices registered. Enable browser notifications to get started.</p>';
      return;
    }
    container.innerHTML = `
      <table class="table table-sm table-pink">
        <thead><tr><th>Device</th><th>Last Used</th><th class="text-end">Actions</th></tr></thead>
        <tbody>
          ${resp.data.map(d => `
            <tr>
              <td>${d.endpoint.split('/').slice(-2)[0] || d.endpoint.slice(0, 50)}</td>
              <td>${d.last_used ? dayjs(d.last_used).format('MMM D, YYYY h:mm A') : '-'}</td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-danger" onclick="removeDevice(${d.id})">
                  <i class="bi bi-trash"></i> Remove
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    console.error('Failed to load devices:', e);
  }
}

async function removeDevice(id) {
  await API.delete(`/push/subscriptions/${id}`);
  loadDevices();
}

async function sendTestNotification() {
  try {
    const resp = await API.post('/push/sendTest');
    if (resp.data.sent > 0) {
      showSuccess('Test notification sent!');
    } else {
      showError('No devices registered or VAPID keys not configured.');
    }
  } catch (e) {
    showError('Failed to send test notification: ' + e.response?.data?.error);
  }
}

async function saveSettings() {
  const data = {
    enabled: 1,
    upcoming_deadline_minutes: 1440, // default daily
    overdue_reminder_minutes: 1440,
    recurring_urgent_minutes: 1440,
    snooze_duration_minutes: parseInt(document.getElementById('setting-snooze').value) || 60,
    quiet_hours_start: document.getElementById('setting-quiet-start').value,
    quiet_hours_end: document.getElementById('setting-quiet-end').value,
    timezone: document.getElementById('setting-timezone').value,
    sound_enabled: document.getElementById('setting-sound').checked ? 1 : 0,
    task_reminders: document.getElementById('setting-task-reminders').checked ? 1 : 0,
    overdue_reminders: document.getElementById('setting-overdue-reminders').checked ? 1 : 0,
    recurring_reminders: document.getElementById('setting-recurring-reminders').checked ? 1 : 0,
    cascade_deadlines: document.getElementById('setting-cascade-deadlines').checked ? 1 : 0,
    meeting_reminders: document.getElementById('setting-meeting-reminders').checked ? 1 : 0
  };
  try {
    await API.put('/settings', data);
    showSuccess('Settings saved!');
  } catch (e) {
    showError('Failed to save settings: ' + e.message);
  }
}

// ===== Settings Page =====
async function renderSettingsPage(container) {
  await renderNotificationsPage(container);
}

// ===== Export Data =====
async function exportData() {
  try {
    const resp = await API.get('/export');
    const blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `personalplanner-export-${dayjs().format('YYYY-MM-DD')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    showError('Export failed: ' + e.message);
  }
}

// ===== Global Search =====
async function performGlobalSearch() {
  const query = document.getElementById('global-search').value.trim();
  const dropdown = document.getElementById('global-search-dropdown');
  if (!query) {
    dropdown.classList.remove('show');
    return;
  }
  try {
    const resp = await API.get(`/search?q=${encodeURIComponent(query)}`);
    const results = resp.data;
    let html = '';
    if (results.tasks.length) {
      html += '<h6 class="px-3 py-1 bg-light text-muted small mb-0">Tasks</h6>';
      html += results.tasks.map(t => `
        <a href="#" class="global-search-item" onclick="openTaskModal(${t.id}); closeSearch();">
          <span class="badge bg-info text-dark search-type">Task</span>
          <strong>${escapeHtml(t.title)}</strong>
          <div class="text-muted small">${escapeHtml(t.description || '')}</div>
        </a>
      `).join('');
    }
    if (results.notes.length) {
      html += '<h6 class="px-3 py-1 bg-light text-muted small mb-0">Notes</h6>';
      html += results.notes.map(n => `
        <a href="#" class="global-search-item" onclick="openNoteModal(${n.id}); closeSearch();">
          <span class="badge bg-warning text-dark search-type">Note</span>
          <strong>${escapeHtml(n.title)}</strong>
        </a>
      `).join('');
    }
    if (results.meetings.length) {
      html += '<h6 class="px-3 py-1 bg-light text-muted small mb-0">Meetings</h6>';
      html += results.meetings.map(m => `
        <a href="#" class="global-search-item" onclick="openMeetingModal(${m.id}); closeSearch();">
          <span class="badge bg-primary text-dark search-type">Meeting</span>
          <strong>${escapeHtml(m.title)}</strong>
        </a>
      `).join('');
    }
    if (results.cascades.length) {
      html += '<h6 class="px-3 py-1 bg-light text-muted small mb-0">Cascades</h6>';
      html += results.cascades.map(c => `
        <a href="#" class="global-search-item" onclick="openCascadeModal(${c.id}); closeSearch();">
          <span class="badge bg-secondary search-type">Cascade</span>
          <strong>${escapeHtml(c.title)}</strong>
        </a>
      `).join('');
    }
    if (!html) html = '<div class="global-search-item">No results found</div>';
    dropdown.innerHTML = html;
    dropdown.classList.add('show');
  } catch (e) {
    console.error('Search failed:', e);
  }
}

function closeSearch() {
  document.getElementById('global-search').value = '';
  document.getElementById('global-search-dropdown').classList.remove('show');
}

// ===== Utilities =====
function formatDate(date, time) {
  if (!date) return '-';
  const d = dayjs(date);
  return time ? `${d.format('MMM D, YYYY')} at ${time}` : d.format('MMM D, YYYY');
}

function truncateText(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function priorityBadge(priority) {
  const map = { Urgent: 'danger', High: 'warning', Normal: 'info', Low: 'secondary' };
  return map[priority] || 'secondary';
}

function showError(msg) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-danger position-fixed top-0 end-0 m-3';
  alert.style.zIndex = '2000';
  alert.innerHTML = `<i class="bi bi-exclamation-circle me-2"></i>${msg} <button class="btn-close" onclick="this.parentElement.remove()"></button>`;
  document.body.appendChild(alert);
  setTimeout(() => alert.remove(), 5000);
}

function showSuccess(msg) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-success position-fixed top-0 end-0 m-3';
  alert.style.zIndex = '2000';
  alert.innerHTML = `<i class="bi bi-check-circle me-2"></i>${msg} <button class="btn-close" onclick="this.parentElement.remove()"></button>`;
  document.body.appendChild(alert);
  setTimeout(() => alert.remove(), 3000);
}

// ===== Desktop Alert System =====
let desktopAlertData = null;

function showDesktopAlert(data) {
  desktopAlertData = data;
  const overlay = document.getElementById('desktop-alert-overlay');
  document.getElementById('desktop-alert-title').textContent = data.title;
  document.getElementById('desktop-alert-message').textContent = data.message;
  document.getElementById('desktop-alert-priority').textContent = data.priority;
  document.getElementById('desktop-alert-deadline').textContent = data.deadline || '-';
  document.getElementById('desktop-alert-source').textContent = data.source;
  document.getElementById('desktop-alert-source-detail').textContent = data.source;
  overlay.classList.remove('d-none');

  // Play sound if enabled
  if (state.settings?.sound_enabled && state.settings?.enabled) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 800;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      oscillator.start();
      setTimeout(() => oscillator.stop(), 200);
    } catch (e) {}
  }
}

function closeDesktopAlert() {
  const overlay = document.getElementById('desktop-alert-overlay');
  overlay.classList.add('d-none');
  desktopAlertData = null;
  // Acknowledge = log in notification history
  if (localStorage) {
    const history = JSON.parse(localStorage.getItem('notification_history') || '[]');
    history.push({
      title: 'Alert acknowledged',
      body: `Alert dismissed: ${desktopAlertData?.title || 'Unknown'}`,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('notification_history', JSON.stringify(history.slice(-50)));
  }
}

function snoozeAlert() {
  const snoozeTime = prompt('Snooze for how many minutes?', '60');
  if (!snoozeTime) return;
  const minutes = parseInt(snoozeTime);
  if (isNaN(minutes) || minutes < 1) return;
  closeDesktopAlert();
  setTimeout(() => {
    showDesktopAlert(desktopAlertData);
  }, minutes * 60 * 1000);
  showSuccess(`Alert snoozed for ${minutes} minutes.`);
}

function openAlertDetails() {
  if (desktopAlertData?.url) {
    closeDesktopAlert();
    const page = desktopAlertData.url.split('?')[0].replace('/', '');
    if (page && window[`renderPage`]) {
      renderPage(page || 'dashboard');
    }
  } else {
    closeDesktopAlert();
  }
}

// ===== Keyboard Controls for Desktop Alert =====
document.addEventListener('keydown', e => {
  const overlay = document.getElementById('desktop-alert-overlay');
  if (!overlay || overlay.classList.contains('d-none')) return;
  switch (e.key) {
    case 'Escape': closeDesktopAlert(); break;
    case 'Enter': openAlertDetails(); break;
    case 's': case 'S': snoozeAlert(); break;
    case 'a': case 'A': ack = closeDesktopAlert(); break;
  }
});

// ===== Load settings on init =====
async function loadSettings() {
  try {
    const resp = await API.get('/settings');
    state.settings = resp.data;
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}
