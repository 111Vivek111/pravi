# MASTER CODING PROMPT

## Government Physical Asset Lifecycle Management System

You are a senior full-stack software architect and developer.

Your task is to build a complete, production-quality MVP for a **Government Physical Asset Lifecycle Management System**.

This system will manage government physical assets from initial planning through approval, tender, construction, inspection, maintenance, retirement, and disposal.

The application must be secure, role-based, modular, maintainable, responsive, and designed so that every important lifecycle action is recorded in an audit history.

---

# 1. MOST IMPORTANT INSTRUCTION

Before writing or modifying any code:

1. Inspect the entire existing repository.
2. Understand the existing:
   - backend
   - frontend
   - database
   - authentication
   - API structure
   - models
   - schemas
   - services
   - configuration
   - Docker configuration
   - environment variables
   - existing dependencies

3. Do NOT unnecessarily rewrite or replace working code.
4. Reuse the existing technology stack wherever possible.
5. Integrate this system into the existing project cleanly.
6. Preserve all existing working functionality.
7. Do not introduce a new framework or architecture unless there is a clear technical reason.
8. Before implementing a module, inspect related existing files and reuse existing patterns.
9. Do not create duplicate models, duplicate authentication systems, duplicate database connections, or duplicate business logic.
10. If an existing implementation conflicts with this specification, document the conflict and modify it carefully.

Do not start by generating random files.

First understand the repository.

---

# 2. PRODUCT OBJECTIVE

Build a centralized portal for managing government physical assets throughout their complete lifecycle.

The system should allow authorized government users to:

- create and manage assets
- manage asset categories/types
- associate assets with departments
- maintain project/planning information
- manage approval records
- manage tender information
- record contractor information without giving contractors portal access
- manage construction/project progress
- assign inspectors
- perform inspections
- record physical condition
- record defects
- create and manage maintenance tasks
- re-inspect assets after maintenance
- retire assets
- dispose of assets
- view complete asset history
- search/filter/paginate assets
- monitor lifecycle status through dashboards

Every important lifecycle action must be auditable.

---

# 3. MVP USERS

There are ONLY TWO application users.

## 3.1 ADMIN

Admin is responsible for administrative and lifecycle management.

Admin can:

- login
- view dashboard
- manage departments
- manage asset types
- create inspectors
- activate/deactivate inspectors
- create assets
- edit asset master information
- manage planning
- manage approval
- manage tender
- record contractor information
- manage construction/project information
- assign/reassign inspectors
- view all assets
- view all inspections
- view all maintenance tasks
- retire assets
- dispose assets
- view asset history
- search/filter assets
- view system statistics

Admin cannot arbitrarily modify lifecycle status.

Lifecycle transitions must go through the centralized lifecycle/state-machine service.

---

# 4. INSPECTOR

Inspector is responsible for physical asset inspection and maintenance-related activities.

Inspector can:

- login
- view assigned assets
- view pending inspections
- view completed inspections
- inspect assigned assets
- record physical condition
- record safety condition
- record structural condition
- record equipment condition
- record defects
- add inspection remarks
- upload supporting documents/photos
- pass/fail an inspection
- create maintenance tasks
- start maintenance
- update maintenance
- complete maintenance
- record work performed
- record materials used
- record maintenance cost
- re-inspect after maintenance
- verify maintenance completion

Inspector MUST NOT:

- approve projects
- reject approvals
- manage tenders
- change approval status
- arbitrarily change lifecycle status
- retire assets
- dispose assets
- access another inspector's restricted assets unless explicitly authorized
- modify unrelated administrative information

Backend authorization must enforce these restrictions.

Do NOT rely only on frontend hiding buttons.

---

# 5. CONTRACTOR ROLE

DO NOT create a Contractor login or Contractor portal.

Contractors are external third parties.

Contractor information can be stored as part of tender/project records:

- contractor/company name
- contract amount
- contract dates
- tender reference

But contractors do not have:

- login
- password
- JWT
- dashboard
- API access
- portal access

Do NOT create a contractor user table unless the existing project absolutely requires one.

For this MVP, contractor information is simply project/tender data.

---

# 6. DEPARTMENTS

Initially support these departments:

### Water

Examples:

- Water Treatment Plant
- Water Tank
- Pipeline
- Pump Station

### Construction / PWD

Examples:

- Road
- Bridge
- Government Building
- Flyover

### Healthcare

Examples:

- Hospital
- Primary Health Centre
- Health Facility

### Education

Examples:

- School
- College
- Government Educational Building

However, DO NOT hardcode the system to only these asset types.

Create an `asset_types` master table so Admin can create additional asset types later.

---

# 7. CORE CONCEPTS

Keep these three concepts separate.

## 7.1 Lifecycle Status

Use controlled lifecycle states:

```text
PLANNING
APPROVAL_PENDING
APPROVED
REJECTED
TENDER_PENDING
TENDER_COMPLETED
UNDER_CONSTRUCTION
CONSTRUCTION_ON_HOLD
CONSTRUCTION_COMPLETED
INSPECTION_PENDING
INSPECTION_COMPLETED
INSPECTION_FAILED
MAINTENANCE_REQUIRED
MAINTENANCE_IN_PROGRESS
MAINTENANCE_COMPLETED
OPERATIONAL
RETIRED
DISPOSED
CANCELLED
```

Do not add unnecessary states such as:

```text
APPROVAL_OVERDUE
INSPECTION_OVERDUE
MAINTENANCE_OVERDUE
```

Overdue should be calculated from dates.

Example:

```text
expected_completion_date < current_date
AND actual_completion_date IS NULL
```

Then the UI can display "Overdue" without changing lifecycle state.

---

# 8. ASSET CONDITION

Condition is separate from lifecycle status.

Allowed values:

```text
GOOD
FAIR
POOR
CRITICAL
```

For example:

```text
Lifecycle Status = OPERATIONAL
Condition = POOR
```

This is valid.

Do not combine condition and lifecycle into one field.

---

# 9. MAINTENANCE STATUS

Maintenance task status is separate.

Allowed:

```text
CREATED
IN_PROGRESS
COMPLETED
```

---

# 10. COMPLETE LIFECYCLE

The lifecycle is:

```text
PLANNING
    ↓
APPROVAL_PENDING
    ↓
APPROVED
    ↓
TENDER_PENDING
    ↓
TENDER_COMPLETED
    ↓
UNDER_CONSTRUCTION
    ↓
CONSTRUCTION_COMPLETED
    ↓
INSPECTION_PENDING
    ↓
INSPECTION_COMPLETED
    ↓
OPERATIONAL
    ↓
MAINTENANCE_REQUIRED
    ↓
MAINTENANCE_IN_PROGRESS
    ↓
MAINTENANCE_COMPLETED
    ↓
INSPECTION_PENDING
    ↓
INSPECTION_COMPLETED
    ↓
OPERATIONAL
    ↓
RETIRED
    ↓
DISPOSED
```

Additional branches are allowed for rejection, hold, cancellation and inspection failure.

---

# 11. LIFECYCLE STATE MACHINE

Implement lifecycle transitions centrally.

DO NOT allow:

```http
PATCH /assets/{id}
{
  "status": "DISPOSED"
}
```

This is prohibited.

Instead, use controlled transition actions.

Example:

```http
POST /api/v1/assets/{id}/submit-approval
POST /api/v1/assets/{id}/approve
POST /api/v1/assets/{id}/reject
POST /api/v1/assets/{id}/start-tender
POST /api/v1/assets/{id}/complete-tender
POST /api/v1/assets/{id}/start-construction
POST /api/v1/assets/{id}/hold-construction
POST /api/v1/assets/{id}/resume-construction
POST /api/v1/assets/{id}/complete-construction
POST /api/v1/assets/{id}/assign-inspector
POST /api/v1/assets/{id}/retire
POST /api/v1/assets/{id}/dispose
```

---

# 12. ALLOWED TRANSITIONS

Implement exactly these business rules.

```text
PLANNING
    → APPROVAL_PENDING
    → CANCELLED

APPROVAL_PENDING
    → APPROVED
    → REJECTED

REJECTED
    → APPROVAL_PENDING
    → CANCELLED

APPROVED
    → TENDER_PENDING
    → CANCELLED

TENDER_PENDING
    → TENDER_COMPLETED
    → CANCELLED

TENDER_COMPLETED
    → UNDER_CONSTRUCTION
    → CANCELLED

UNDER_CONSTRUCTION
    → CONSTRUCTION_ON_HOLD
    → CONSTRUCTION_COMPLETED
    → CANCELLED

CONSTRUCTION_ON_HOLD
    → UNDER_CONSTRUCTION
    → CANCELLED

CONSTRUCTION_COMPLETED
    → INSPECTION_PENDING

INSPECTION_PENDING
    → INSPECTION_COMPLETED

INSPECTION_COMPLETED
    → OPERATIONAL
    → INSPECTION_FAILED

INSPECTION_FAILED
    → MAINTENANCE_REQUIRED

MAINTENANCE_REQUIRED
    → MAINTENANCE_IN_PROGRESS

MAINTENANCE_IN_PROGRESS
    → MAINTENANCE_COMPLETED

MAINTENANCE_COMPLETED
    → INSPECTION_PENDING
    → OPERATIONAL

OPERATIONAL
    → MAINTENANCE_REQUIRED
    → RETIRED

RETIRED
    → DISPOSED

DISPOSED
    → NO FURTHER TRANSITIONS
```

DISPOSED is terminal.

---

# 13. STATE TRANSITION SERVICE

Create a centralized lifecycle service.

Example:

```text
LifecycleService
```

Every lifecycle transition must:

1. Load asset.
2. Authenticate current user.
3. Verify user role.
4. Verify asset access.
5. Check current lifecycle state.
6. Check whether target transition is allowed.
7. Validate required stage-specific information.
8. Save the stage record.
9. Update asset lifecycle status.
10. Create an asset history record.
11. Commit transaction.

If any step fails:

```text
ROLLBACK
```

Never partially update lifecycle information.

Use database transactions.

---

# 14. STAGE-SPECIFIC DATA

Every lifecycle stage must collect its own information.

Do NOT put everything into the `assets` table.

The asset table contains master information.

Stage-specific tables contain stage-specific information.

---

# 15. ASSET MASTER

Create:

```text
assets
```

Recommended fields:

```text
id
asset_code
name
description
department_id
asset_type_id

location
address
city
district
state
postal_code

current_lifecycle_status
current_condition

assigned_inspector_id

created_by
created_at
updated_by
updated_at

is_active
```

Asset code must be unique.

---

# 16. PLANNING MODULE

Create:

```text
asset_planning
```

Fields:

```text
id
asset_id
purpose
project_description
estimated_cost
expected_start_date
expected_completion_date
priority
remarks
supporting_document_url_or_path
created_by
created_at
updated_at
```

Planning information is required before moving to:

```text
APPROVAL_PENDING
```

Validate:

- estimated cost >= 0
- completion date >= start date
- required fields are present

---

# 17. APPROVAL MODULE

Create:

```text
asset_approvals
```

Fields:

```text
id
asset_id
approval_reference_number
approval_date
approved_amount
approving_authority
status
rejection_reason
remarks
approval_document_url_or_path
submitted_by
approved_by
created_at
updated_at
```

Approval status:

```text
PENDING
APPROVED
REJECTED
```

Rules:

For approval:

- approval reference required
- approval date required
- approving authority required
- approved amount required

For rejection:

- rejection reason required

Rejected assets must preserve their previous approval record.

A rejected project can be resubmitted.

Do not delete rejected records.

---

# 18. TENDER MODULE

Create:

```text
asset_tenders
```

Fields:

```text
id
asset_id
tender_id
tender_notice_number
tender_type
publication_date
closing_date
estimated_tender_value
eligibility_criteria
number_of_bidders

selected_contractor
contract_amount
contract_start_date
contract_end_date

status
remarks
tender_document_url_or_path

created_by
created_at
updated_at
```

Tender status may include:

```text
PENDING
PUBLISHED
COMPLETED
FAILED
CANCELLED
```

The contractor is stored only as information.

No contractor user account.

Validate:

```text
closing_date >= publication_date
contract_end_date >= contract_start_date
contract_amount >= 0
estimated_tender_value >= 0
number_of_bidders >= 0
```

If tender fails, support re-tendering while preserving previous tender records.

---

# 19. CONSTRUCTION MODULE

Create:

```text
asset_construction
```

Fields:

```text
id
asset_id

construction_start_date
expected_completion_date
actual_completion_date

progress_percentage

final_project_cost

completion_certificate_number

status

hold_reason
hold_date
resume_date

remarks

completion_document_url_or_path

created_by
updated_by

created_at
updated_at
```

Construction status:

```text
NOT_STARTED
IN_PROGRESS
ON_HOLD
COMPLETED
CANCELLED
```

Rules:

```text
progress_percentage >= 0
progress_percentage <= 100
```

When construction is completed:

```text
progress_percentage = 100
actual_completion_date required
completion certificate may be required
```

If construction is placed on hold:

```text
hold_reason required
hold_date required
```

When resumed:

```text
resume_date required
```

Construction cancellation must preserve the history.

---

# 20. CONSTRUCTION MILESTONES

Create:

```text
construction_milestones
```

Fields:

```text
id
construction_id
name
status
start_date
completion_date
remarks
created_at
updated_at
```

Allow Admin to create/update milestones.

Example:

```text
Foundation
Structural Work
Electrical Work
Plumbing
Finishing
Final Completion
```

Do not hardcode only these examples.

---

# 21. INSPECTION MODULE

Create:

```text
asset_inspections
```

Fields:

```text
id
asset_id
inspector_id
inspection_date

physical_condition
safety_condition
structural_condition
equipment_condition

defects_found
remarks

inspection_result

supporting_document_url_or_path

created_at
updated_at
```

Inspection result:

```text
PASS
FAIL
```

Condition values:

```text
GOOD
FAIR
POOR
CRITICAL
```

Inspector should only inspect assets assigned to them.

Inspection must validate:

- inspector owns/has access to asset
- asset is not disposed
- required inspection fields exist
- inspection date is valid

If inspection passes:

```text
INSPECTION_COMPLETED
→ OPERATIONAL
```

If inspection fails:

```text
INSPECTION_COMPLETED
→ INSPECTION_FAILED
→ MAINTENANCE_REQUIRED
```

---

# 22. MAINTENANCE MODULE

Create:

```text
maintenance_tasks
```

Fields:

```text
id
asset_id

created_by
assigned_to

maintenance_type

problem_description
priority
required_action

start_date
expected_completion_date
actual_completion_date

work_performed
material_used
cost

status

remarks

supporting_document_url_or_path

created_at
updated_at
```

Maintenance priority:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Maintenance status:

```text
CREATED
IN_PROGRESS
COMPLETED
```

Inspector can:

- create maintenance
- start maintenance
- update maintenance
- complete maintenance

Validate:

```text
cost >= 0
expected_completion_date >= start_date
actual_completion_date >= start_date
```

After completion:

```text
MAINTENANCE_COMPLETED
```

Then:

```text
MAINTENANCE_COMPLETED
→ INSPECTION_PENDING
```

A re-inspection can verify the maintenance.

---

# 23. RETIREMENT MODULE

Create:

```text
asset_retirement
```

Fields:

```text
id
asset_id
retirement_date
retirement_reason
asset_condition
retirement_approval_reference
estimated_remaining_value
remarks
supporting_document_url_or_path
retired_by
created_at
```

Only Admin can retire an asset.

An asset must not be arbitrarily retired from any lifecycle state.

Validate the allowed current state.

---

# 24. DISPOSAL MODULE

Create:

```text
asset_disposal
```

Fields:

```text
id
asset_id
disposal_date
disposal_method
disposal_authority
disposal_reference_number
disposal_value
remarks
disposal_document_url_or_path
disposed_by
created_at
```

Only Admin can dispose an asset.

After disposal:

```text
DISPOSED
```

The asset becomes terminal.

No normal updates should be allowed after disposal except viewing historical records.

---

# 25. ASSET HISTORY / AUDIT TRAIL

Create:

```text
asset_history
```

Fields:

```text
id
asset_id
action
from_status
to_status
performed_by
performed_at
remarks
metadata
```

`metadata` can be JSON.

Every important transition must generate a history record.

Example:

```text
Asset created
Planning completed
Approval submitted
Approval rejected
Approval resubmitted
Approval approved
Tender created
Tender completed
Construction started
Construction put on hold
Construction resumed
Construction completed
Inspector assigned
Inspection completed
Inspection failed
Maintenance created
Maintenance started
Maintenance completed
Re-inspection completed
Asset operational
Asset retired
Asset disposed
```

History must never be silently deleted.

---

# 26. NO HARD DELETE

For important government lifecycle records:

DO NOT implement normal hard-delete functionality.

Instead use:

- inactive flags
- cancellation
- retirement
- disposal
- history

Government records must remain auditable.

---

# 27. USER TABLE

Create/use:

```text
users
```

Fields should include at least:

```text
id
name
email
password_hash
role
is_active
created_at
updated_at
```

Roles:

```text
ADMIN
INSPECTOR
```

Never store plaintext passwords.

Use secure password hashing.

---

# 28. AUTHENTICATION

Implement JWT authentication if the existing project already uses JWT.

Authentication flow:

```text
Login
 ↓
Validate credentials
 ↓
Generate JWT
 ↓
Frontend stores token securely
 ↓
API validates token
 ↓
Extract user identity and role
```

Admin can create Inspector users.

Do not provide public Inspector registration.

Inactive users must not be allowed to access protected APIs.

---

# 29. AUTHORIZATION

Implement backend RBAC.

Example:

```text
require_admin()
require_inspector()
require_authenticated_user()
```

Also enforce asset-level authorization.

Example:

Inspector A must not access Inspector B's assigned asset if the business rule says assignments are restricted.

Do not trust:

```text
inspector_id
```

sent from frontend.

The backend must determine the authenticated user from JWT.

---

# 30. MASTER DATA

Create management modules for:

## Departments

Admin can:

- create
- view
- edit
- activate/deactivate

Initial departments:

```text
Water
Construction / PWD
Healthcare
Education
```

## Asset Types

Admin can:

- create
- view
- edit
- activate/deactivate

Do not hardcode asset types.

---

# 31. ASSET CREATION

Admin workflow:

```text
Login
 ↓
Dashboard
 ↓
Asset Inventory
 ↓
Create Asset
```

Asset creation form:

### Basic Information

```text
Asset Code
Asset Name
Description
Department
Asset Type
```

### Location

```text
Location
Address
City
District
State
Postal Code
```

### Initial Planning

```text
Purpose
Project Description
Estimated Cost
Expected Start Date
Expected Completion Date
Priority
Remarks
Supporting Documents
```

After creation:

```text
PLANNING
```

The asset should not automatically jump to later lifecycle states.

---

# 32. INSPECTOR ASSIGNMENT

Admin can assign/reassign an Inspector.

Use:

```http
POST /api/v1/assets/{id}/assign-inspector
```

Request:

```json
{
  "inspector_id": 123
}
```

The backend must verify:

- inspector exists
- inspector is active
- user role is INSPECTOR

Record assignment in history.

---

# 33. ADMIN DASHBOARD

Build a dashboard showing:

```text
Total Assets
Planning
Pending Approval
Approved
Tender Pending
Under Construction
Construction Completed
Pending Inspection
Operational
Maintenance Required
Retired
Disposed
```

Also show:

```text
Assets by Department
Assets by Condition
Pending Inspections
Overdue Stages
Recent Activity
```

Overdue should be calculated from dates.

Do not create fake database statuses for overdue.

---

# 34. INSPECTOR DASHBOARD

Show:

```text
Total Assigned
Pending Inspection
Inspected
Good
Fair
Poor
Critical
Pending Maintenance
Maintenance In Progress
Completed Maintenance
```

Also display:

```text
Pending Inspections
Completed Inspections
Maintenance Tasks
```

---

# 35. ASSET DETAILS PAGE

Every asset must have a detailed page.

Display:

## Asset Information

```text
Asset Code
Name
Department
Asset Type
Location
Description
```

## Current State

```text
Lifecycle Status
Condition
Assigned Inspector
```

## Lifecycle Timeline

Example:

```text
Planning
  ✓

Approval
  ✓

Tender
  ✓

Construction
  ✓

Inspection
  ✓

Maintenance
  ✓

Operational
  CURRENT
```

## Stage Sections

Display:

```text
Planning
Approval
Tender
Construction
Inspections
Maintenance
Retirement
Disposal
History
```

Each stage should show its specific information.

---

# 36. FRONTEND ROUTES

Create or adapt these routes:

```text
/login

/admin/dashboard
/admin/departments
/admin/asset-types
/admin/users

/admin/assets
/admin/assets/create
/admin/assets/:id
/admin/assets/:id/planning
/admin/assets/:id/approval
/admin/assets/:id/tender
/admin/assets/:id/construction
/admin/assets/:id/history

/inspector/dashboard
/inspector/assets
/inspector/assets/:id

/inspector/inspections/pending
/inspector/inspections/completed
/inspector/inspections/:id

/inspector/maintenance
/inspector/maintenance/:id
```

Adapt these to the existing frontend framework/router.

Do not unnecessarily migrate the frontend framework.

---

# 37. API VERSIONING

All APIs must use:

```text
/api/v1/
```

Example:

```text
GET /api/v1/assets
```

---

# 38. ASSET APIs

Implement:

```http
GET    /api/v1/assets
POST   /api/v1/assets
GET    /api/v1/assets/{id}
PUT    /api/v1/assets/{id}
PATCH  /api/v1/assets/{id}
```

Important:

`PUT/PATCH` is for editable asset master information.

Do NOT allow lifecycle status modification through arbitrary PATCH.

---

# 39. LIFECYCLE APIs

Implement:

```http
POST /api/v1/assets/{id}/submit-approval

POST /api/v1/assets/{id}/approve

POST /api/v1/assets/{id}/reject

POST /api/v1/assets/{id}/start-tender

POST /api/v1/assets/{id}/complete-tender

POST /api/v1/assets/{id}/start-construction

POST /api/v1/assets/{id}/hold-construction

POST /api/v1/assets/{id}/resume-construction

POST /api/v1/assets/{id}/complete-construction

POST /api/v1/assets/{id}/assign-inspector

POST /api/v1/assets/{id}/retire

POST /api/v1/assets/{id}/dispose
```

Every endpoint must use:

- authentication
- authorization
- transition validation
- stage validation
- transaction
- history logging

---

# 40. INSPECTION APIs

Implement:

```http
GET /api/v1/inspections/my

GET /api/v1/inspections/pending

GET /api/v1/inspections/completed

POST /api/v1/assets/{id}/inspections

GET /api/v1/inspections/{id}

PUT /api/v1/inspections/{id}
```

---

# 41. MAINTENANCE APIs

Implement:

```http
GET /api/v1/maintenance

GET /api/v1/maintenance/my

POST /api/v1/assets/{id}/maintenance

GET /api/v1/maintenance/{id}

PUT /api/v1/maintenance/{id}

POST /api/v1/maintenance/{id}/start

POST /api/v1/maintenance/{id}/complete
```

---

# 42. HISTORY API

Implement:

```http
GET /api/v1/assets/{id}/history
```

Return chronological history.

---

# 43. SEARCH

Asset list must support search by:

```text
Asset Code
Asset Name
```

---

# 44. FILTERING

Support filtering by:

```text
Department
Asset Type
Location
Lifecycle Status
Condition
Assigned Inspector
```

---

# 45. PAGINATION

Use server-side pagination.

Example:

```http
GET /api/v1/assets?page=1&page_size=20
```

Response:

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 100,
  "total_pages": 5
}
```

Do not load thousands of records into the frontend unnecessarily.

---

# 46. SORTING

Support server-side sorting where appropriate.

Example:

```text
created_at
updated_at
asset_code
name
status
```

Never directly inject raw user-provided SQL/order-by values.

Whitelist allowed sorting fields.

---

# 47. VALIDATION

Validation must happen at multiple levels.

## Schema validation

Validate:

- required fields
- types
- enums
- dates
- numeric ranges
- string lengths

## Business validation

Validate:

- lifecycle transition
- permissions
- asset assignment
- current lifecycle state
- required stage information
- duplicate asset codes
- disposed assets
- inactive inspectors

Never depend only on frontend validation.

---

# 48. IMPORTANT VALIDATION RULES

Asset code:

```text
UNIQUE
```

Costs:

```text
>= 0
```

Progress:

```text
0 <= progress <= 100
```

Dates:

```text
end >= start
```

Number of bidders:

```text
>= 0
```

Maintenance cost:

```text
>= 0
```

Do not allow:

```text
NULL required fields
negative financial values
invalid date sequences
progress > 100
progress < 0
duplicate asset codes
```

---

# 49. ERROR HANDLING

Use consistent API errors.

Expected HTTP statuses:

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Validation Error
500 Internal Server Error
```

Examples:

```text
401 → not authenticated

403 → authenticated but not authorized

404 → asset not found

409 → duplicate asset code / invalid state conflict

422 → invalid input format
```

Do not expose internal stack traces to users in production.

Log detailed errors on the server.

---

# 50. EDGE CASES

The implementation MUST handle these.

## Approval never happens

Asset remains:

```text
APPROVAL_PENDING
```

It should appear as pending/overdue based on dates.

Do not create a new lifecycle status.

---

## Approval rejected

Status:

```text
REJECTED
```

Store:

```text
rejection_reason
```

Allow resubmission:

```text
REJECTED
→ APPROVAL_PENDING
```

Keep previous approval records.

---

## Tender fails

Do not delete the tender.

Store:

```text
FAILED
```

Allow another tender process.

Preserve historical tender records.

---

## Construction delayed

Do not create a special global status.

Use expected completion date and calculate overdue.

---

## Construction on hold

Use:

```text
CONSTRUCTION_ON_HOLD
```

Require:

```text
hold_reason
hold_date
```

---

## Construction resumed

Use:

```text
UNDER_CONSTRUCTION
```

Record:

```text
resume_date
```

---

## Construction cancelled

Use:

```text
CANCELLED
```

Preserve all records.

---

## Inspector doesn't inspect

Keep:

```text
INSPECTION_PENDING
```

Display it as pending/overdue based on due date if available.

---

## Inspection fails

Use:

```text
INSPECTION_FAILED
```

Then:

```text
MAINTENANCE_REQUIRED
```

---

## Maintenance not completed

Keep:

```text
MAINTENANCE_IN_PROGRESS
```

Do not falsely mark it complete.

---

## Maintenance verification fails

Create another maintenance/rework cycle.

Do not delete the previous maintenance record.

---

## Inspector unavailable

Admin can reassign the asset to another active Inspector.

Record reassignment in history.

---

## Unauthorized access

Return:

```text
403 Forbidden
```

Do not leak information about restricted assets.

---

## Asset already disposed

Do not allow:

- inspection
- maintenance
- retirement
- construction
- lifecycle modification

Return appropriate conflict/error.

---

## Missing stage information

Do not allow lifecycle transition.

Return a clear validation error.

---

## Duplicate asset code

Return:

```text
409 Conflict
```

---

## Invalid financial values

Reject negative values.

---

## Invalid progress

Reject:

```text
-1
101
```

---

# 51. TRANSACTIONS

Lifecycle operations must be transactional.

Example:

```text
Approve Asset

BEGIN TRANSACTION

Validate asset
Validate user
Validate state
Validate approval data

Create approval record
Update asset status
Create history

COMMIT
```

If anything fails:

```text
ROLLBACK
```

This prevents inconsistent lifecycle data.

---

# 52. DATABASE RELATIONSHIPS

Relationships:

```text
Department
    |
    └── many Assets

AssetType
    |
    └── many Assets

Inspector
    |
    └── many assigned Assets

Asset
    |
    ├── Planning
    ├── Approvals
    ├── Tenders
    ├── Construction
    ├── Inspections
    ├── Maintenance Tasks
    ├── Retirement
    ├── Disposal
    └── History
```

Use proper foreign keys.

Use indexes for frequently queried fields.

At minimum consider indexes for:

```text
asset_code
department_id
asset_type_id
current_lifecycle_status
current_condition
assigned_inspector_id
created_at
```

---

# 53. DATABASE TABLES

Expected core tables:

```text
users

departments

asset_types

assets

asset_planning

asset_approvals

asset_tenders

asset_construction

construction_milestones

asset_inspections

maintenance_tasks

asset_retirement

asset_disposal

asset_history
```

If the existing project already has equivalent tables, reuse them rather than duplicating them.

---

# 54. BACKEND STRUCTURE

Use a clean modular architecture similar to:

```text
backend/
└── app/
    ├── main.py
    │
    ├── core/
    │   ├── config.py
    │   ├── security.py
    │   └── exceptions.py
    │
    ├── database/
    │   ├── database.py
    │   └── base.py
    │
    ├── models/
    │   ├── user.py
    │   ├── department.py
    │   ├── asset_type.py
    │   ├── asset.py
    │   ├── planning.py
    │   ├── approval.py
    │   ├── tender.py
    │   ├── construction.py
    │   ├── inspection.py
    │   ├── maintenance.py
    │   ├── retirement.py
    │   ├── disposal.py
    │   └── history.py
    │
    ├── schemas/
    │   ├── auth.py
    │   ├── user.py
    │   ├── department.py
    │   ├── asset_type.py
    │   ├── asset.py
    │   ├── planning.py
    │   ├── approval.py
    │   ├── tender.py
    │   ├── construction.py
    │   ├── inspection.py
    │   ├── maintenance.py
    │   ├── retirement.py
    │   ├── disposal.py
    │   └── history.py
    │
    ├── api/
    │   └── v1/
    │       ├── auth.py
    │       ├── users.py
    │       ├── departments.py
    │       ├── asset_types.py
    │       ├── assets.py
    │       ├── inspections.py
    │       ├── maintenance.py
    │       ├── dashboard.py
    │       └── ...
    │
    ├── services/
    │   ├── auth_service.py
    │   ├── asset_service.py
    │   ├── lifecycle_service.py
    │   ├── inspection_service.py
    │   ├── maintenance_service.py
    │   └── dashboard_service.py
    │
    ├── repositories/
    │   └── ...
    │
    └── utils/
        └── ...
```

Adapt this to the existing project.

---

# 55. FRONTEND ARCHITECTURE

Use the existing frontend framework.

Organize components logically.

Suggested:

```text
frontend/
├── components/
│   ├── Navbar
│   ├── Sidebar
│   ├── DataTable
│   ├── StatusBadge
│   ├── ConditionBadge
│   ├── LifecycleTimeline
│   ├── Modal
│   └── Pagination
│
├── pages/
│   ├── Login
│   ├── admin/
│   └── inspector/
│
├── services/
│   └── api
│
├── hooks/
│
├── utils/
│
└── ...
```

Again, adapt to the existing project instead of blindly recreating it.

---

# 56. FILE UPLOADS

Support documents/photos where required.

Potential files:

```text
planning documents
approval documents
tender documents
completion certificates
inspection photos
inspection documents
maintenance photos
maintenance documents
retirement documents
disposal documents
```

Validate:

- file type
- file size
- safe filename
- storage path

Do not trust uploaded filenames.

Do not expose sensitive files publicly without authorization.

Use a storage abstraction so storage can later move from local filesystem to cloud storage.

---

# 57. SECURITY

Implement:

- password hashing
- JWT authentication
- role-based authorization
- asset-level authorization
- input validation
- safe file upload
- environment variables for secrets
- no passwords in source code
- no API secrets in frontend source
- no SQL injection
- safe sorting/filtering
- CORS configuration
- proper error handling

Frontend route protection is required, but backend authorization is the real security boundary.

---

# 58. ENVIRONMENT VARIABLES

Use `.env` for:

```text
DATABASE_URL
JWT_SECRET
JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES
CORS_ORIGINS
UPLOAD_DIRECTORY
```

Never commit secrets.

Create/update `.env.example`.

---

# 59. DASHBOARD CALCULATIONS

Dashboard numbers must come from the database.

Do not hardcode:

```text
Total Assets = 100
```

Use real queries.

Examples:

```text
COUNT(*) total assets

COUNT(status = APPROVAL_PENDING)

COUNT(status = UNDER_CONSTRUCTION)

COUNT(condition = GOOD)
```

Use efficient aggregate queries.

---

# 60. AUDIT HISTORY

For every lifecycle transition:

```text
current state
↓
transition
↓
new state
↓
history record
```

History should include:

```text
who
what
when
from state
to state
remarks
metadata
```

This is essential for a government system.

---

# 61. UI/UX

The application should look like a professional government administration portal.

Use:

- clean dashboard
- sidebar navigation
- responsive tables
- status badges
- condition badges
- lifecycle timeline
- confirmation dialogs
- clear validation messages
- loading states
- empty states
- error states
- pagination
- search/filter controls

Do not overcomplicate the design.

Prioritize usability and correctness.

---

# 62. RESPONSIVE DESIGN

The UI must work on:

```text
Desktop
Laptop
Tablet
```

A mobile-first dedicated mobile application is NOT required.

---

# 63. NOT IN MVP

DO NOT implement these unless explicitly requested later:

```text
Contractor portal
Contractor login
Department Officer role
Notifications
SMS
Email notifications
GIS / maps
AI inspection
AI image analysis
Mobile app
Advanced financial accounting
Complex accounting workflows
```

Do not introduce these features "because they may be useful."

Scope must remain controlled.

---

# 64. API DESIGN PRINCIPLES

Use:

```text
REST
JSON
/api/v1/
```

Use meaningful HTTP methods.

Use:

```text
GET
POST
PUT
PATCH
```

Do not use GET to modify data.

Do not use PATCH to bypass lifecycle validation.

---

# 65. BUSINESS LOGIC LOCATION

Do NOT put complex business logic directly inside API route/controller files.

Bad:

```text
route
 → 100 lines of lifecycle logic
```

Preferred:

```text
route
 ↓
service
 ↓
repository/database
```

For lifecycle:

```text
API
 ↓
LifecycleService
 ↓
Validation
 ↓
Database transaction
 ↓
History
```

---

# 66. ENUMS / CONSTANTS

Use enums/constants for:

```text
UserRole
LifecycleStatus
AssetCondition
InspectionResult
MaintenanceStatus
MaintenancePriority
TenderStatus
ConstructionStatus
ApprovalStatus
```

Do not scatter raw strings throughout the code.

---

# 67. API RESPONSE CONSISTENCY

Use consistent response structures.

Success:

```json
{
  "message": "Asset created successfully",
  "data": {}
}
```

Error:

```json
{
  "detail": "Asset is not in a valid state for this operation"
}
```

Paginated:

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 100,
  "total_pages": 5
}
```

Adapt to the existing project's conventions if already established.

---

# 68. TESTING

Create automated tests wherever the existing stack supports them.

Minimum tests:

## Authentication

- valid login
- invalid password
- inactive user
- invalid JWT
- expired JWT

## Authorization

- Admin endpoint accessed by Inspector
- Inspector endpoint accessed by Admin where inappropriate
- Inspector accessing another inspector's asset
- unauthenticated request

## Assets

- create
- update
- duplicate asset code
- invalid cost
- invalid data
- search
- filtering
- pagination

## Planning

- valid planning
- missing required fields
- invalid dates

## Approval

- submit
- approve
- reject
- reject without reason
- resubmit
- invalid transition

## Tender

- create
- complete
- fail
- re-tender
- invalid dates

## Construction

- start
- progress update
- hold
- resume
- complete
- invalid progress
- cancellation

## Inspection

- assigned inspector
- unauthorized inspector
- pass
- fail
- missing required fields

## Maintenance

- create
- start
- complete
- invalid cost
- invalid date
- re-inspection

## Retirement

- valid retirement
- invalid lifecycle state

## Disposal

- valid disposal
- disposed asset cannot be modified

## History

Verify history is created after every important lifecycle transition.

## State Machine

Test every allowed transition.

Test invalid transitions.

---

# 69. END-TO-END TEST

The following scenario must work.

Create:

```text
Asset:
Government Hospital
Asset Code:
HOSP-001
Department:
Healthcare
```

Flow:

```text
Planning
 ↓
Approval Pending
 ↓
Approved
 ↓
Tender
 ↓
Contractor recorded
 ↓
Construction
 ↓
Construction Completed
 ↓
Inspector assigned
 ↓
Inspection
 ↓
Inspection FAIL
 ↓
Maintenance Required
 ↓
Maintenance Created
 ↓
Maintenance In Progress
 ↓
Maintenance Completed
 ↓
Re-inspection
 ↓
PASS
 ↓
Operational
 ↓
Retired
 ↓
Disposed
```

Every stage must contain its appropriate data.

Every transition must create history.

---

# 70. EXAMPLE HISTORY

For the above asset, history might look like:

```text
Asset created
PLANNING

Planning submitted
PLANNING → APPROVAL_PENDING

Approval approved
APPROVAL_PENDING → APPROVED

Tender completed
TENDER_PENDING → TENDER_COMPLETED

Construction started
TENDER_COMPLETED → UNDER_CONSTRUCTION

Construction completed
UNDER_CONSTRUCTION → CONSTRUCTION_COMPLETED

Inspection started
CONSTRUCTION_COMPLETED → INSPECTION_PENDING

Inspection failed
INSPECTION_PENDING → INSPECTION_FAILED

Maintenance required
INSPECTION_FAILED → MAINTENANCE_REQUIRED

Maintenance started
MAINTENANCE_REQUIRED → MAINTENANCE_IN_PROGRESS

Maintenance completed
MAINTENANCE_IN_PROGRESS → MAINTENANCE_COMPLETED

Re-inspection
MAINTENANCE_COMPLETED → INSPECTION_PENDING

Inspection passed
INSPECTION_PENDING → INSPECTION_COMPLETED

Asset operational
INSPECTION_COMPLETED → OPERATIONAL

Asset retired
OPERATIONAL → RETIRED

Asset disposed
RETIRED → DISPOSED
```

---

# 71. DATA INTEGRITY

Use:

- foreign keys
- unique constraints
- indexes
- not-null constraints where appropriate
- enum constraints where appropriate
- database transactions

Do not rely only on frontend validation.

---

# 72. DATABASE MIGRATIONS

If the project uses Alembic or another migration system:

Create proper migrations.

Do NOT manually modify production database structure without migrations.

Migration process:

```text
Model changes
 ↓
Generate migration
 ↓
Review migration
 ↓
Apply migration
```

Do not destroy existing production data.

---

# 73. SEED DATA

Provide development seed data.

Minimum:

```text
1 Admin

2-3 Inspectors

Water department
Construction / PWD department
Healthcare department
Education department

Several asset types

Several sample assets
```

Use obviously fake/demo data.

Do not hardcode demo credentials into production.

---

# 74. LOGGING

Add useful backend logs for:

- authentication failures
- lifecycle transitions
- exceptions
- important administrative operations

Do not log:

- passwords
- JWT secrets
- sensitive credentials

---

# 75. DOCUMENTATION

Update/create:

```text
README.md
.env.example
API documentation
```

README should explain:

```text
Project purpose
Architecture
Requirements
Environment setup
Database setup
Migration
Seed data
Backend startup
Frontend startup
Testing
API documentation
```

If FastAPI is being used, ensure Swagger/OpenAPI works.

---

# 76. DEVELOPMENT ORDER

Implement in this exact logical order.

## Phase 1 — Repository analysis

Inspect existing project.

Do not code yet.

Identify:

```text
backend framework
frontend framework
database
authentication
existing models
existing APIs
existing folder structure
Docker
environment configuration
```

---

## Phase 2 — Database foundation

Implement:

```text
users
departments
asset_types
assets
```

Then stage tables:

```text
planning
approval
tender
construction
milestones
inspection
maintenance
retirement
disposal
history
```

---

## Phase 3 — Authentication

Implement:

```text
login
JWT
password hashing
RBAC
Admin
Inspector
```

---

## Phase 4 — Master data

Implement:

```text
Departments
Asset Types
Users
```

---

## Phase 5 — Asset management

Implement:

```text
Create asset
Edit asset
List assets
Search
Filter
Pagination
Asset details
```

---

## Phase 6 — Lifecycle engine

Implement centralized:

```text
LifecycleService
```

Then implement every valid transition.

---

## Phase 7 — Planning

Implement:

```text
planning data
validation
documents
submit approval
```

---

## Phase 8 — Approval

Implement:

```text
approve
reject
resubmit
history
```

---

## Phase 9 — Tender

Implement:

```text
tender
contractor record
completion
failure
re-tender
```

---

## Phase 10 — Construction

Implement:

```text
construction
milestones
progress
hold
resume
completion
cancellation
```

---

## Phase 11 — Inspector

Implement:

```text
assignment
pending inspections
inspection
condition
defects
pass/fail
```

---

## Phase 12 — Maintenance

Implement:

```text
maintenance creation
start
update
complete
re-inspection
```

---

## Phase 13 — Retirement and disposal

Implement:

```text
retirement
disposal
terminal state
```

---

## Phase 14 — Dashboards

Implement:

```text
Admin dashboard
Inspector dashboard
```

---

## Phase 15 — History

Ensure all lifecycle actions are recorded.

---

## Phase 16 — Frontend polish

Implement:

```text
responsive layout
tables
filters
pagination
forms
validation
timeline
status badges
confirmation dialogs
loading states
empty states
error states
```

---

## Phase 17 — Testing

Run:

```text
unit tests
integration tests
API tests
authorization tests
state machine tests
end-to-end tests
```

---

## Phase 18 — Final verification

Verify:

```text
No broken routes
No broken APIs
No unauthorized access
No lifecycle bypass
No duplicate models
No duplicate database connections
No secrets committed
No hard delete of lifecycle records
No missing history
No invalid state transitions
No frontend-only authorization
```

---

# 77. CODE QUALITY RULES

Use:

- clean naming
- modular architecture
- reusable components
- reusable services
- reusable validation
- type safety where supported
- meaningful comments only where needed
- no unnecessary comments
- no duplicated business logic

Avoid:

```text
God classes
God components
huge route files
duplicated validation
duplicated API logic
hardcoded IDs
hardcoded user roles everywhere
hardcoded lifecycle transitions in multiple places
```

---

# 78. DO NOT OVERENGINEER

This is an MVP.

Do not add:

```text
microservices
event sourcing
Kafka
Redis
Kubernetes
AI
GIS
notification infrastructure
complex workflow engines
```

unless already present in the repository or explicitly required later.

A modular monolith is preferred.

---

# 79. IMPORTANT STATE MACHINE IMPLEMENTATION

Create one central transition map.

Conceptually:

```python
ALLOWED_TRANSITIONS = {
    "PLANNING": [
        "APPROVAL_PENDING",
        "CANCELLED"
    ],
    "APPROVAL_PENDING": [
        "APPROVED",
        "REJECTED"
    ],
    "REJECTED": [
        "APPROVAL_PENDING",
        "CANCELLED"
    ],
    ...
}
```

But do not rely only on this dictionary.

Each transition must also have:

```text
required role
required data
business validation
history action
```

For example:

```text
approve
→ ADMIN only
→ current state must be APPROVAL_PENDING
→ approval data required
→ save approval
→ change state
→ create history
```

---

# 80. CENTRALIZE TRANSITION LOGIC

Prefer a service like:

```text
lifecycle_service.py
```

Possible conceptual method:

```text
transition_asset(
    asset_id,
    action,
    current_user,
    transition_data
)
```

The service should:

```text
authorize
validate
transition
persist
history
commit
```

Routes should remain thin.

---

# 81. ROLE RESPONSIBILITY SUMMARY

## ADMIN

Responsible for:

```text
Planning
Approval
Tender
Contractor record
Construction administration
Inspector assignment
Departments
Asset Types
Users
Retirement
Disposal
Dashboard
History
```

## INSPECTOR

Responsible for:

```text
Inspection
Condition
Defects
Maintenance
Maintenance completion
Re-inspection
```

---

# 82. NO ARBITRARY STATUS UPDATE

This is a critical requirement.

Never implement:

```http
PATCH /asset/{id}
{
    "current_lifecycle_status": "OPERATIONAL"
}
```

Instead:

```http
POST /asset/{id}/complete-inspection
```

The backend determines whether:

```text
INSPECTION_COMPLETED
```

is valid.

The frontend does not decide lifecycle truth.

---

# 83. SECURITY BOUNDARY

Assume the frontend can be manipulated.

Therefore:

```text
Frontend validation = UX
Backend validation = Security
```

Every protected operation must be checked on the backend.

---

# 84. AUDITABILITY

Because this is a government asset system, important changes must be traceable.

Never silently overwrite important lifecycle events.

Store history.

Example:

If an approval was rejected and later approved:

```text
Approval #1 → REJECTED
Approval #2 → APPROVED
```

Do not replace Approval #1 with Approval #2.

---

# 85. DATA PRESERVATION

Never delete:

```text
rejected approvals
failed tenders
construction history
inspections
maintenance records
retirement records
disposal records
asset history
```

Preserve the lifecycle.

---

# 86. FRONTEND PERMISSION UX

The UI should hide actions the user cannot perform.

For example:

Admin sees:

```text
Approve
Reject
Create Tender
Start Construction
Retire
Dispose
Assign Inspector
```

Inspector sees:

```text
Inspect
Report Defect
Create Maintenance
Start Maintenance
Complete Maintenance
Re-inspect
```

But remember:

Frontend visibility is NOT authorization.

Backend must still enforce every permission.

---

# 87. FORMS

Forms must show:

- required field indicators
- validation messages
- date validation
- numeric validation
- enum dropdowns
- confirmation before destructive/terminal actions
- loading state
- success state
- error state

For disposal and retirement, use confirmation dialogs.

---

# 88. TABLES

Asset tables should support:

```text
Asset Code
Asset Name
Department
Asset Type
Location
Lifecycle Status
Condition
Inspector
Created Date
Actions
```

Actions should depend on:

```text
role
current state
permissions
```

---

# 89. STATUS DISPLAY

Use readable labels.

Example:

Backend:

```text
APPROVAL_PENDING
```

Frontend:

```text
Approval Pending
```

Backend values should remain stable.

---

# 90. CONDITION DISPLAY

Backend:

```text
GOOD
FAIR
POOR
CRITICAL
```

Frontend:

```text
Good
Fair
Poor
Critical
```

Use consistent visual badges.

---

# 91. FINAL IMPLEMENTATION RULE

When you encounter ambiguity:

1. Prefer the simplest implementation.
2. Follow this specification.
3. Preserve existing project architecture.
4. Do not invent additional roles.
5. Do not invent additional modules.
6. Do not add excluded features.
7. Document important assumptions.
8. Never silently change the product scope.

---

# 92. DEFINITION OF DONE

The project is NOT complete until all of the following are true:

### Authentication

- [ ] Admin login works
- [ ] Inspector login works
- [ ] JWT works
- [ ] Passwords are hashed
- [ ] Inactive users are blocked

### Authorization

- [ ] Admin permissions work
- [ ] Inspector permissions work
- [ ] Unauthorized API calls return 403
- [ ] Asset-level authorization works

### Master Data

- [ ] Departments work
- [ ] Asset types work
- [ ] Inspector management works

### Assets

- [ ] Create asset
- [ ] Edit asset
- [ ] View asset
- [ ] Search
- [ ] Filter
- [ ] Pagination
- [ ] Unique asset code

### Planning

- [ ] Planning information
- [ ] Validation
- [ ] Documents

### Approval

- [ ] Submit
- [ ] Approve
- [ ] Reject
- [ ] Resubmit
- [ ] Rejection reason
- [ ] History

### Tender

- [ ] Tender creation
- [ ] Contractor information
- [ ] Tender completion
- [ ] Tender failure
- [ ] Re-tender

### Construction

- [ ] Start
- [ ] Progress
- [ ] Milestones
- [ ] Hold
- [ ] Resume
- [ ] Complete
- [ ] Cancel

### Inspection

- [ ] Assign inspector
- [ ] Pending list
- [ ] Inspection
- [ ] Condition
- [ ] Defects
- [ ] Pass
- [ ] Fail

### Maintenance

- [ ] Create
- [ ] Start
- [ ] Update
- [ ] Complete
- [ ] Cost
- [ ] Materials
- [ ] Re-inspection

### Retirement

- [ ] Retirement record
- [ ] Approval/reference
- [ ] History

### Disposal

- [ ] Disposal record
- [ ] Authority
- [ ] Reference
- [ ] Terminal state

### History

- [ ] Every lifecycle transition recorded
- [ ] User recorded
- [ ] Timestamp recorded
- [ ] From status recorded
- [ ] To status recorded

### Dashboards

- [ ] Admin dashboard
- [ ] Inspector dashboard
- [ ] Real database statistics

### Security

- [ ] No plaintext passwords
- [ ] No secrets in source
- [ ] Backend authorization
- [ ] Safe uploads
- [ ] Validation
- [ ] SQL injection protection

### Testing

- [ ] Authentication tests
- [ ] RBAC tests
- [ ] Lifecycle tests
- [ ] Validation tests
- [ ] Inspection tests
- [ ] Maintenance tests
- [ ] Retirement/disposal tests
- [ ] History tests
- [ ] End-to-end test

---

# 93. FINAL INSTRUCTION TO THE CODING AGENT

Do NOT simply generate a large amount of code immediately.

Work systematically.

First inspect the repository and report:

```text
1. Existing architecture
2. Backend framework
3. Frontend framework
4. Database
5. Existing authentication
6. Existing models
7. Existing APIs
8. Existing frontend routes
9. Existing Docker/deployment configuration
10. What can be reused
11. What needs modification
12. What new modules/files are required
```

Then create an implementation plan based on the existing repository.

After that, implement the system phase by phase.

After every major phase:

```text
run tests
check imports
check migrations
check database relationships
check API routes
check authorization
check frontend integration
```

Do not move forward while the current phase is broken.

At the end:

1. Run the complete test suite.
2. Fix all errors.
3. Verify database migrations.
4. Verify authentication.
5. Verify role-based authorization.
6. Verify every lifecycle transition.
7. Verify invalid transitions are rejected.
8. Verify history is generated.
9. Verify dashboards use real database data.
10. Verify frontend and backend integration.
11. Verify no secrets are committed.
12. Verify no excluded MVP features were accidentally implemented.
13. Provide a final summary of:
    - files created
    - files modified
    - database changes
    - APIs created
    - frontend pages created
    - tests created
    - commands required to run the project
    - any remaining issues

The final implementation must follow this specification exactly unless an existing repository constraint requires an adaptation. If adaptation is required, explain it clearly before making the change.

DO NOT change the product scope without explicit approval.
DO NOT add Contractor login.
DO NOT add Department Officer.
DO NOT add notifications.
DO NOT add GIS.
DO NOT add AI inspection.
DO NOT add mobile app.
DO NOT bypass the lifecycle state machine.
DO NOT allow arbitrary lifecycle status updates.
DO NOT delete important lifecycle records.
DO NOT rely on frontend authorization.
DO NOT rewrite working parts of the existing repository unnecessarily.

Build a secure, maintainable, auditable government physical asset lifecycle management system.
