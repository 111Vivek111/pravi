const state = {
  token: localStorage.getItem('assetToken') || '',
  user: JSON.parse(localStorage.getItem('assetUser') || 'null'),
  assets: [],
  activeView: 'dashboard',
  departments: [],
  assetTypes: [],
  inspectors: [],
  selectedAssetId: null
};

const elements = {
  loginView: document.getElementById('loginView'),
  appView: document.getElementById('appView'),
  loginForm: document.getElementById('loginForm'),
  loginError: document.getElementById('loginError'),
  userInfo: document.getElementById('userInfo'),
  welcomeTitle: document.getElementById('welcomeTitle'),
  assetList: document.getElementById('assetList'),
  inspectionList: document.getElementById('inspectionList'),
  historyList: document.getElementById('historyList'),
  logoutBtn: document.getElementById('logoutBtn'),
  totalAssets: document.getElementById('totalAssets'),
  adminCount: document.getElementById('adminCount'),
  inspectorCount: document.getElementById('inspectorCount'),
  maintenanceCount: document.getElementById('maintenanceCount'),
  createAssetBtn: document.getElementById('createAssetBtn'),
  assetModal: document.getElementById('assetModal'),
  modalTitle: document.getElementById('modalTitle'),
  assetForm: document.getElementById('assetForm'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  detailPanel: document.getElementById('detailPanel')
};

const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Request failed');
  }

  return response.json();
};

function setView(viewName) {
  state.activeView = viewName;
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName);
  });

  document.getElementById('dashboardView').classList.toggle('hidden', viewName !== 'dashboard');
  document.getElementById('assetsView').classList.toggle('hidden', viewName !== 'assets');
  document.getElementById('inspectionsView').classList.toggle('hidden', viewName !== 'inspections');
  document.getElementById('historyView').classList.toggle('hidden', viewName !== 'history');
}

async function loadDashboard() {
  try {
    const dashboard = await api('/dashboard');
    const { counts } = dashboard;
    elements.totalAssets.textContent = counts.total_assets || 0;
    elements.adminCount.textContent = counts.admin_users || 0;
    elements.inspectorCount.textContent = counts.inspector_users || 0;
    elements.maintenanceCount.textContent = counts.maintenance_records || 0;
  } catch (error) {
    console.error('Dashboard load failed', error);
  }
}

function renderAssetCards(assets) {
  if (!assets.length) {
    elements.assetList.innerHTML = '<div class="empty-state">No assets found.</div>';
    return;
  }

  elements.assetList.innerHTML = assets
    .map(
      (asset) => `
        <div class="asset-card">
          <div class="asset-head">
            <h4>${asset.name}</h4>
            <span class="status-badge">${asset.current_lifecycle_status}</span>
          </div>
          <p><strong>Code:</strong> ${asset.asset_code}</p>
          <p><strong>Department:</strong> ${asset.department_name || 'N/A'}</p>
          <p><strong>Condition:</strong> ${asset.current_condition}</p>
          <p><strong>Inspector:</strong> ${asset.inspector_name || 'Unassigned'}</p>
          <button class="secondary-btn" data-asset-id="${asset.id}" data-action="view-asset">View details</button>
        </div>
      `
    )
    .join('');

  elements.assetList.querySelectorAll('[data-action="view-asset"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedAssetId = Number(button.dataset.assetId);
      openAssetDetail(state.selectedAssetId);
    });
  });
}

function renderInspectionCards(items) {
  if (!items.length) {
    elements.inspectionList.innerHTML = '<div class="empty-state">No inspection records found.</div>';
    return;
  }

  elements.inspectionList.innerHTML = items
    .map(
      (item) => `
        <div class="asset-card">
          <div class="asset-head">
            <h4>Inspection #${item.id}</h4>
            <span class="status-badge">${item.inspection_result}</span>
          </div>
          <p><strong>Asset:</strong> ${item.asset_name || item.asset_id}</p>
          <p><strong>Date:</strong> ${item.inspection_date}</p>
          <p><strong>Physical:</strong> ${item.physical_condition}</p>
        </div>
      `
    )
    .join('');
}

function renderHistoryCards(items) {
  if (!items.length) {
    elements.historyList.innerHTML = '<div class="empty-state">No lifecycle history found.</div>';
    return;
  }

  elements.historyList.innerHTML = items
    .map(
      (item) => `
        <div class="asset-card">
          <div class="asset-head">
            <h4>${item.action}</h4>
            <span class="status-badge">${item.to_status || 'N/A'}</span>
          </div>
          <p><strong>From:</strong> ${item.from_status || 'N/A'}</p>
          <p><strong>Performed:</strong> ${item.performed_at}</p>
          <p><strong>Remarks:</strong> ${item.remarks || 'No remarks'}</p>
        </div>
      `
    )
    .join('');
}

async function loadAssets() {
  try {
    const data = await api('/assets');
    state.assets = data.assets || [];
    renderAssetCards(state.assets);
  } catch (error) {
    console.error('Assets load failed', error);
  }
}

async function loadInspections() {
  try {
    const data = await api('/assets');
    const inspectionRecords = [];

    for (const asset of data.assets || []) {
      const details = await api(`/assets/${asset.id}`);
      if (details.inspections && details.inspections.length) {
        inspectionRecords.push(...details.inspections.map((inspection) => ({ ...inspection, asset_name: asset.name })));
      }
    }

    renderInspectionCards(inspectionRecords);
  } catch (error) {
    console.error('Inspection load failed', error);
  }
}

async function loadHistory() {
  try {
    const data = await api('/assets');
    const history = [];

    for (const asset of data.assets || []) {
      const details = await api(`/assets/${asset.id}`);
      if (details.history && details.history.length) {
        history.push(...details.history.map((item) => ({ ...item, asset_name: asset.name })));
      }
    }

    renderHistoryCards(history);
  } catch (error) {
    console.error('History load failed', error);
  }
}

async function loadMasterData() {
  try {
    const data = await api('/assets/masters');
    state.departments = data.departments || [];
    state.assetTypes = data.assetTypes || [];
    state.inspectors = data.inspectors || [];
  } catch (error) {
    console.error('Master data load failed', error);
  }
}

function closeModal() {
  elements.assetModal.classList.add('hidden');
  elements.assetForm.innerHTML = '';
}

function openModal(title, html, submitHandler) {
  elements.modalTitle.textContent = title;
  elements.assetForm.innerHTML = html;
  elements.assetForm.onsubmit = submitHandler;
  elements.assetModal.classList.remove('hidden');
}

function renderCreateAssetForm() {
  const departmentOptions = state.departments.map((dept) => `<option value="${dept.id}">${dept.name}</option>`).join('');
  const typeOptions = state.assetTypes.map((type) => `<option value="${type.id}">${type.name}</option>`).join('');
  const inspectorOptions = state.inspectors.map((inspector) => `<option value="${inspector.id}">${inspector.name}</option>`).join('');

  openModal(
    'Create Asset',
    `
      <div class="form-grid">
        <label class="full"><span>Asset Code</span><input name="asset_code" required /></label>
        <label class="full"><span>Name</span><input name="name" required /></label>
        <label class="full"><span>Description</span><textarea name="description" rows="3"></textarea></label>
        <label><span>Department</span><select name="department_id">${departmentOptions}</select></label>
        <label><span>Asset Type</span><select name="asset_type_id">${typeOptions}</select></label>
        <label><span>Location</span><input name="location" /></label>
        <label><span>Address</span><input name="address" /></label>
        <label><span>City</span><input name="city" /></label>
        <label><span>District</span><input name="district" /></label>
        <label><span>State</span><input name="state" /></label>
        <label><span>Postal Code</span><input name="postal_code" /></label>
        <label><span>Condition</span><select name="current_condition"><option>GOOD</option><option>FAIR</option><option>POOR</option><option>CRITICAL</option></select></label>
        <label><span>Assigned Inspector</span><select name="assigned_inspector_id"><option value="">Unassigned</option>${inspectorOptions}</select></label>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" id="cancelModalBtn">Cancel</button>
        <button type="submit" class="primary-btn">Save Asset</button>
      </div>
    `,
    async (event) => {
      event.preventDefault();
      const formData = new FormData(event.target);
      const payload = Object.fromEntries(formData.entries());
      payload.department_id = payload.department_id ? Number(payload.department_id) : null;
      payload.asset_type_id = payload.asset_type_id ? Number(payload.asset_type_id) : null;
      payload.assigned_inspector_id = payload.assigned_inspector_id ? Number(payload.assigned_inspector_id) : null;

      try {
        await api('/assets', { method: 'POST', body: JSON.stringify(payload) });
        closeModal();
        await loadAssets();
        await loadDashboard();
      } catch (error) {
        alert(error.message);
      }
    }
  );

  document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
}

function getAllowedLifecycleActions() {
  if (state.user?.role === 'INSPECTOR') {
    return ['inspection', 'maintenance'];
  }

  return ['planning', 'approval', 'tender', 'construction', 'inspection', 'maintenance', 'retire', 'dispose'];
}

function openAssetDetail(assetId) {
  api(`/assets/${assetId}`)
    .then((details) => {
      const asset = details.asset;
      const panels = [];
      const allowedActions = getAllowedLifecycleActions();

      panels.push(`
        <div class="detail-section">
          <h3>${asset.name}</h3>
          <div class="detail-grid">
            <div><strong>Asset Code:</strong><br>${asset.asset_code}</div>
            <div><strong>Status:</strong><br>${asset.current_lifecycle_status}</div>
            <div><strong>Department:</strong><br>${asset.department_name || 'N/A'}</div>
            <div><strong>Type:</strong><br>${asset.asset_type_name || 'N/A'}</div>
            <div><strong>Condition:</strong><br>${asset.current_condition}</div>
            <div><strong>Inspector:</strong><br>${asset.inspector_name || 'Unassigned'}</div>
          </div>
        </div>
      `);

      if (details.planning) {
        panels.push(`
          <div class="detail-section">
            <h4>Planning</h4>
            <p><strong>Purpose:</strong> ${details.planning.purpose || 'N/A'}</p>
            <p><strong>Est. Cost:</strong> ${details.planning.estimated_cost || 0}</p>
          </div>
        `);
      }

      if (details.approval) {
        panels.push(`
          <div class="detail-section">
            <h4>Approval</h4>
            <p><strong>Reference:</strong> ${details.approval.approval_reference_number || 'N/A'}</p>
            <p><strong>Status:</strong> ${details.approval.status}</p>
          </div>
        `);
      }

      if (details.tender) {
        panels.push(`
          <div class="detail-section">
            <h4>Tender</h4>
            <p><strong>Notice:</strong> ${details.tender.tender_notice_number || 'N/A'}</p>
            <p><strong>Status:</strong> ${details.tender.status}</p>
          </div>
        `);
      }

      if (details.construction) {
        panels.push(`
          <div class="detail-section">
            <h4>Construction</h4>
            <p><strong>Progress:</strong> ${details.construction.progress_percentage || 0}%</p>
            <p><strong>Status:</strong> ${details.construction.status}</p>
          </div>
        `);
      }

      const actionButtons = allowedActions
        .map(
          (actionType) => `<button type="button" class="secondary-btn" data-action-form="${actionType}">${actionType.charAt(0).toUpperCase() + actionType.slice(1)}</button>`
        )
        .join('');

      elements.detailPanel.innerHTML = `
        <div class="modal-header">
          <h3>Asset Detail</h3>
          <button type="button" id="closeDetailPanelBtn" class="close-btn">×</button>
        </div>
        ${panels.join('')}
        <div class="detail-section">
          <h4>Lifecycle Actions</h4>
          <div class="form-actions" style="justify-content:flex-start; flex-wrap:wrap;">
            ${actionButtons}
          </div>
        </div>
      `;

      document.getElementById('closeDetailPanelBtn').addEventListener('click', () => {
        elements.detailPanel.classList.add('hidden');
      });

      document.querySelectorAll('[data-action-form]').forEach((button) => {
        button.addEventListener('click', () => {
          const formType = button.dataset.actionForm;
          showActionForm(formType, assetId);
        });
      });

      elements.detailPanel.classList.remove('hidden');
    })
    .catch((error) => {
      alert(error.message);
    });
}

function showActionForm(actionType, assetId) {
  const forms = {
    planning: `
      <div class="form-grid">
        <label class="full"><span>Purpose</span><input name="purpose" required /></label>
        <label class="full"><span>Project Description</span><textarea name="project_description" rows="3" required></textarea></label>
        <label><span>Estimated Cost</span><input name="estimated_cost" type="number" min="0" value="0" /></label>
        <label><span>Priority</span><select name="priority"><option>LOW</option><option selected>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
        <label><span>Expected Start</span><input type="date" name="expected_start_date" required /></label>
        <label><span>Expected Completion</span><input type="date" name="expected_completion_date" required /></label>
        <label class="full"><span>Remarks</span><textarea name="remarks" rows="2"></textarea></label>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" id="cancelModalBtn">Cancel</button>
        <button type="submit" class="primary-btn">Save Planning</button>
      </div>
    `,
    approval: `
      <div class="form-grid">
        <label><span>Approval Reference</span><input name="approval_reference_number" required /></label>
        <label><span>Approval Date</span><input type="date" name="approval_date" required /></label>
        <label><span>Approving Authority</span><input name="approving_authority" required /></label>
        <label><span>Approved Amount</span><input type="number" name="approved_amount" min="0" required /></label>
        <label class="full"><span>Remarks</span><textarea name="remarks" rows="2"></textarea></label>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" id="cancelModalBtn">Cancel</button>
        <button type="submit" class="primary-btn">Submit Approval</button>
      </div>
    `,
    tender: `
      <div class="form-grid">
        <label><span>Tender ID</span><input name="tender_id" /></label>
        <label><span>Tender Notice Number</span><input name="tender_notice_number" /></label>
        <label><span>Tender Type</span><input name="tender_type" value="OPEN" /></label>
        <label><span>Publication Date</span><input type="date" name="publication_date" /></label>
        <label><span>Closing Date</span><input type="date" name="closing_date" /></label>
        <label><span>Estimated Tender Value</span><input type="number" name="estimated_tender_value" min="0" value="0" /></label>
        <label class="full"><span>Eligibility Criteria</span><textarea name="eligibility_criteria" rows="2"></textarea></label>
        <label><span>Number of Bidders</span><input type="number" name="number_of_bidders" min="0" value="0" /></label>
        <label><span>Selected Contractor</span><input name="selected_contractor" /></label>
        <label><span>Contract Amount</span><input type="number" name="contract_amount" min="0" value="0" /></label>
        <label><span>Contract Start</span><input type="date" name="contract_start_date" /></label>
        <label><span>Contract End</span><input type="date" name="contract_end_date" /></label>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" id="cancelModalBtn">Cancel</button>
        <button type="submit" class="primary-btn">Start Tender</button>
      </div>
    `,
    construction: `
      <div class="form-grid">
        <label><span>Construction Start</span><input type="date" name="construction_start_date" required /></label>
        <label><span>Expected Completion</span><input type="date" name="expected_completion_date" required /></label>
        <label><span>Actual Completion</span><input type="date" name="actual_completion_date" /></label>
        <label><span>Progress %</span><input type="number" name="progress_percentage" min="0" max="100" value="0" /></label>
        <label><span>Final Project Cost</span><input type="number" name="final_project_cost" min="0" value="0" /></label>
        <label><span>Completion Certificate</span><input name="completion_certificate_number" /></label>
        <label class="full"><span>Remarks</span><textarea rows="2" name="remarks"></textarea></label>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" id="cancelModalBtn">Cancel</button>
        <button type="submit" class="primary-btn">Start Construction</button>
      </div>
    `,
    inspection: `
      <div class="form-grid">
        <label><span>Inspection Date</span><input type="date" name="inspection_date" required /></label>
        <label><span>Inspection Result</span><select name="inspection_result"><option>PASS</option><option>FAIL</option></select></label>
        <label><span>Physical Condition</span><select name="physical_condition"><option>GOOD</option><option>FAIR</option><option>POOR</option><option>CRITICAL</option></select></label>
        <label><span>Safety Condition</span><select name="safety_condition"><option>GOOD</option><option>FAIR</option><option>POOR</option><option>CRITICAL</option></select></label>
        <label><span>Structural Condition</span><select name="structural_condition"><option>GOOD</option><option>FAIR</option><option>POOR</option><option>CRITICAL</option></select></label>
        <label><span>Equipment Condition</span><select name="equipment_condition"><option>GOOD</option><option>FAIR</option><option>POOR</option><option>CRITICAL</option></select></label>
        <label class="full"><span>Defects Found</span><textarea rows="2" name="defects_found"></textarea></label>
        <label class="full"><span>Remarks</span><textarea rows="2" name="remarks"></textarea></label>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" id="cancelModalBtn">Cancel</button>
        <button type="submit" class="primary-btn">Record Inspection</button>
      </div>
    `,
    maintenance: `
      <div class="form-grid">
        <label><span>Maintenance Type</span><input name="maintenance_type" required /></label>
        <label><span>Priority</span><select name="priority"><option>LOW</option><option selected>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
        <label class="full"><span>Problem Description</span><textarea name="problem_description" required rows="3"></textarea></label>
        <label class="full"><span>Required Action</span><textarea name="required_action" rows="2"></textarea></label>
        <label><span>Start Date</span><input type="date" name="start_date" /></label>
        <label><span>Expected Completion</span><input type="date" name="expected_completion_date" /></label>
        <label><span>Cost</span><input type="number" name="cost" min="0" value="0" /></label>
        <label class="full"><span>Remarks</span><textarea name="remarks" rows="2"></textarea></label>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" id="cancelModalBtn">Cancel</button>
        <button type="submit" class="primary-btn">Create Maintenance</button>
      </div>
    `,
    retire: `
      <div class="form-grid">
        <label><span>Retirement Date</span><input type="date" name="retirement_date" required /></label>
        <label><span>Retirement Reason</span><input name="retirement_reason" required /></label>
        <label><span>Condition</span><select name="asset_condition"><option>GOOD</option><option>FAIR</option><option>POOR</option><option>CRITICAL</option></select></label>
        <label><span>Approval Ref.</span><input name="retirement_approval_reference" /></label>
        <label><span>Remaining Value</span><input type="number" min="0" name="estimated_remaining_value" value="0" /></label>
        <label class="full"><span>Remarks</span><textarea name="remarks" rows="2"></textarea></label>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" id="cancelModalBtn">Cancel</button>
        <button type="submit" class="primary-btn">Retire Asset</button>
      </div>
    `,
    dispose: `
      <div class="form-grid">
        <label><span>Disposal Date</span><input type="date" name="disposal_date" required /></label>
        <label><span>Disposal Method</span><input name="disposal_method" required /></label>
        <label><span>Disposal Authority</span><input name="disposal_authority" required /></label>
        <label><span>Reference Number</span><input name="disposal_reference_number" /></label>
        <label><span>Disposal Value</span><input type="number" min="0" name="disposal_value" value="0" /></label>
        <label class="full"><span>Remarks</span><textarea name="remarks" rows="2"></textarea></label>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" id="cancelModalBtn">Cancel</button>
        <button type="submit" class="primary-btn">Dispose Asset</button>
      </div>
    `
  };

  openModal(`Asset Action - ${actionType.toUpperCase()}`, forms[actionType], async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());

    Object.keys(payload).forEach((key) => {
      if (payload[key] === '') payload[key] = undefined;
    });

    const endpoints = {
      planning: `/assets/${assetId}/submit-planning`,
      approval: `/assets/${assetId}/submit-approval`,
      tender: `/assets/${assetId}/start-tender`,
      construction: `/assets/${assetId}/start-construction`,
      inspection: `/assets/${assetId}/inspection`,
      maintenance: `/assets/${assetId}/maintenance`,
      retire: `/assets/${assetId}/retire`,
      dispose: `/assets/${assetId}/dispose`
    };

    try {
      await api(endpoints[actionType], { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      elements.detailPanel.classList.add('hidden');
      await loadAssets();
      await loadDashboard();
      await loadHistory();
      await loadInspections();
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
}

function syncAuthState() {
  const isLoggedIn = Boolean(state.token && state.user);
  elements.loginView.classList.toggle('hidden', isLoggedIn);
  elements.appView.classList.toggle('hidden', !isLoggedIn);

  const createAssetBtn = document.getElementById('createAssetBtn');
  const canManageAssets = state.user?.role === 'ADMIN';
  createAssetBtn.classList.toggle('hidden', !canManageAssets);

  if (isLoggedIn) {
    elements.userInfo.textContent = `${state.user.role} • ${state.user.name}`;
    elements.welcomeTitle.textContent = `Welcome, ${state.user.name}`;
    loadDashboard();
    loadAssets();
    loadInspections();
    loadHistory();
    if (state.user.role === 'ADMIN') {
      loadMasterData();
    }
  }
}

async function onLogin(event) {
  event.preventDefault();
  elements.loginError.textContent = '';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const response = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    state.token = response.token;
    state.user = response.user;
    localStorage.setItem('assetToken', state.token);
    localStorage.setItem('assetUser', JSON.stringify(state.user));
    syncAuthState();
  } catch (error) {
    elements.loginError.textContent = error.message;
  }
}

function onLogout() {
  state.token = '';
  state.user = null;
  localStorage.removeItem('assetToken');
  localStorage.removeItem('assetUser');
  elements.detailPanel.classList.add('hidden');
  syncAuthState();
}

document.getElementById('loginForm').addEventListener('submit', onLogin);
document.getElementById('logoutBtn').addEventListener('click', onLogout);
document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('createAssetBtn').addEventListener('click', () => {
  if (state.departments.length === 0 || state.assetTypes.length === 0) {
    loadMasterData().then(renderCreateAssetForm);
    return;
  }
  renderCreateAssetForm();
});
document.querySelectorAll('.nav-btn').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

syncAuthState();
