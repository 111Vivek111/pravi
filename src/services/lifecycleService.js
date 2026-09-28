const db = require('../db');

const allowedTransitions = {
  PLANNING: ['APPROVAL_PENDING', 'CANCELLED'],
  APPROVAL_PENDING: ['APPROVED', 'REJECTED'],
  REJECTED: ['APPROVAL_PENDING', 'CANCELLED'],
  APPROVED: ['TENDER_PENDING', 'CANCELLED'],
  TENDER_PENDING: ['TENDER_COMPLETED', 'CANCELLED'],
  TENDER_COMPLETED: ['UNDER_CONSTRUCTION', 'CANCELLED'],
  UNDER_CONSTRUCTION: ['CONSTRUCTION_ON_HOLD', 'CONSTRUCTION_COMPLETED', 'CANCELLED'],
  CONSTRUCTION_ON_HOLD: ['UNDER_CONSTRUCTION', 'CANCELLED'],
  CONSTRUCTION_COMPLETED: ['INSPECTION_PENDING'],
  INSPECTION_PENDING: ['INSPECTION_COMPLETED'],
  INSPECTION_COMPLETED: ['OPERATIONAL', 'INSPECTION_FAILED'],
  INSPECTION_FAILED: ['MAINTENANCE_REQUIRED'],
  MAINTENANCE_REQUIRED: ['MAINTENANCE_IN_PROGRESS'],
  MAINTENANCE_IN_PROGRESS: ['MAINTENANCE_COMPLETED'],
  MAINTENANCE_COMPLETED: ['INSPECTION_PENDING', 'OPERATIONAL'],
  OPERATIONAL: ['MAINTENANCE_REQUIRED', 'RETIRED'],
  RETIRED: ['DISPOSED'],
  DISPOSED: []
};

function isAllowedTransition(fromStatus, toStatus) {
  return (allowedTransitions[fromStatus] || []).includes(toStatus);
}

function addHistory(assetId, action, fromStatus, toStatus, performedBy, remarks, metadata = {}) {
  db.prepare(`
    INSERT INTO asset_history (asset_id, action, from_status, to_status, performed_by, remarks, metadata, performed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(assetId, action, fromStatus, toStatus, performedBy, remarks, JSON.stringify(metadata));
}

function transitionAsset({ assetId, fromStatus, toStatus, performedBy, action, remarks, metadata = {}, validate = () => true }) {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
  if (!asset) {
    throw new Error('Asset not found');
  }

  if (asset.current_lifecycle_status !== fromStatus) {
    throw new Error(`Asset is in ${asset.current_lifecycle_status}, expected ${fromStatus}`);
  }

  if (!isAllowedTransition(fromStatus, toStatus)) {
    throw new Error(`Transition ${fromStatus} -> ${toStatus} is not allowed`);
  }

  validate(asset);

  const tx = db.transaction(() => {
    db.prepare("UPDATE assets SET current_lifecycle_status = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?")
      .run(toStatus, performedBy, assetId);

    addHistory(assetId, action, fromStatus, toStatus, performedBy, remarks, metadata);
  });

  tx();

  return db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
}

module.exports = { allowedTransitions, isAllowedTransition, transitionAsset };
