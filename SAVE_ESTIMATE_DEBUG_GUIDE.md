# Save Estimate Flow - Debug & Test Guide

## Issues Found & Fixed

### 1. **Schema Mismatch (ModuleCreate)**
**Issue**: The `ModuleCreate` schema was missing the `features` field, but the CRUD function expected it.

**Location**: `backend/app/schemas.py` line 89

**Original Code**:
```python
class ModuleCreate(ModuleBase):
    pass
```

**Fixed Code**:
```python
class ModuleCreate(ModuleBase):
    features: List['FeatureCreate'] = []
```

**Root Cause**: The API was expecting modules with nested features, but the schema didn't declare this field, causing Pydantic validation to fail.

---

### 2. **Missing Defaults in Frontend Payload**
**Issue**: Frontend was sending incomplete data with missing/undefined fields, causing validation failures.

**Location**: `frontend/src/App.jsx` lines 193-230

**Fixed Data Types**:
- All numeric fields converted with `parseInt()` / `parseFloat()`
- Complexity: Range 1-10, converted to int
- Base Hours, Quantity: Converted to float with fallback defaults
- Percentages: Converted to float (15, 10, 10 defaults)
- String fields: Fallback to empty strings or generic names
- Billable flag: Explicitly set `!== false` to handle undefined

**Example**:
```javascript
// BEFORE (incomplete):
complexity: f.complexity,

// AFTER (safe):
complexity: parseInt(f.complexity) || 5,
```

---

### 3. **Poor Error Messaging**
**Issue**: Frontend showed generic "Failed to fetch" without backend error details.

**Location**: `frontend/src/App.jsx` saveEstimate function

**Fixed Error Handling**:
```javascript
const errorData = await response.json().catch(() => ({}))
setError(`Failed to save estimate: ${response.status} ${response.statusText}${errorData.detail ? ` - ${errorData.detail}` : ''}`)
console.error('Save error:', err)
```

**Benefit**: Now shows HTTP status code and Pydantic validation error details from backend.

---

### 4. **Forward Reference in Schema**
**Issue**: TypeScript-style string forward reference `'FeatureCreate'` needed Pydantic rebuilding.

**Location**: `backend/app/schemas.py` end of file

**Added**:
```python
# Rebuild models to resolve forward references
ModuleCreate.model_rebuild()
```

---

## Complete Request Payload Shape

### What Frontend Now Sends

```javascript
{
  "name": "E-Commerce Platform",
  "description": "Full-featured e-commerce store",
  "client_name": "ABC Corp",
  "tech_stack_json": {
    "frontend": "React",
    "backend": "FastAPI",
    "database": "PostgreSQL",
    "platform": "Custom",
    "stack_level": "advanced"
  },
  "project_info": {
    "name": "E-Commerce Platform",
    "clientName": "ABC Corp",
    "description": "Full-featured e-commerce store"
  },
  "modules": [
    {
      "name": "Authentication",
      "description": "User login and registration",
      "order": 0,
      "features": [
        {
          "name": "Login/Register",
          "feature_type": "Feature",
          "complexity": 6,
          "base_hours": 16.0,
          "quantity": 1.0,
          "assigned_role": "Senior Dev",
          "is_billable": true,
          "notes": "",
          "order": 0
        }
      ]
    }
  ],
  "settings": {
    "qa_percentage": 15.0,
    "pm_percentage": 10.0,
    "risk_percentage": 10.0
  }
}
```

---

## Testing the Save Flow

### Step 1: Start Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

**Verify**: `http://localhost:8000/api/health` returns `{"status":"healthy","version":"2.0","mode":"fixed-cost-estimation"}`

---

### Step 2: Start Frontend
```bash
cd frontend
npm install
npm run dev
```

**Verify**: `http://localhost:5173` loads without CORS errors in console

---

### Step 3: Test Save Button

#### 3a. Create Basic Estimate
1. **Project Info**:
   - Name: "Test Project"
   - Client: "Test Client"
   - Description: "Test Description"

2. **Tech Stack**:
   - Frontend: React
   - Backend: FastAPI
   - Database: PostgreSQL
   - Stack Level: Advanced

3. **Module 1: Authentication**
   - Module Name: "Authentication"
   - Module Description: "User auth"
   - Feature 1:
     - Name: "Login"
     - Type: "Feature"
     - Complexity: 5
     - Base Hours: 10
     - Quantity: 1
     - Role: "Senior Dev"
     - Billable: ✓

4. **Module 2: Dashboard**
   - Module Name: "Dashboard"
   - Feature 1:
     - Name: "Analytics Widget"
     - Type: "UI"
     - Complexity: 3
     - Base Hours: 8
     - Quantity: 1
     - Role: "Junior Dev"
     - Billable: ✓

#### 3b. Calculate Estimate
- Click "Calculate Estimate"
- **Expected**: ProposalSummary shows:
  - Module breakdown with hours
  - Cost totals
  - QA/PM/Risk overhead percentages and costs

#### 3c. Click Save Estimate
- **Expected Behavior**:
  ✅ Success message: "Estimate saved successfully!"
  ✅ Button disabled while saving
  ✅ Estimate appears in "Saved Estimates" section

- **If Error**:
  - Check browser console for detailed error message
  - Error will now show HTTP status + backend validation details
  - Common issues:
    - Missing "features" field → ModuleCreate schema
    - Invalid complexity (outside 1-10) → Field validation
    - Missing required fields → Check defaults in frontend
    - CORS error → Verify backend CORS configuration

---

### Step 4: Verify Database Save

#### Option A: Check via API
```bash
curl http://localhost:8000/api/estimates/
```

**Expected**: Returns JSON array with saved estimate(s)

#### Option B: Check SQLite Database
```bash
cd backend
sqlite3 test.db
sqlite> SELECT id, name, client_name, total_estimated_hours, total_fixed_cost FROM estimates;
```

**Expected Output**:
```
1|Test Project|Test Client|50.5|4250.5
```

#### Option C: Get Breakdown
```bash
curl http://localhost:8000/api/estimates/1/breakdown
```

**Expected**: Returns full calculation breakdown with modules, features, overhead percentages

---

## Debugging Commands

### Browser Console Errors
1. Open DevTools (F12)
2. Go to **Console** tab
3. Look for:
   - CORS errors → Check backend CORS_ORIGINS
   - Network errors → Verify backend running on port 8000
   - Validation errors → Check payload shape

### Backend Validation Errors
```python
# To see exact validation error, check server logs:
# FastAPI will print Pydantic ValidationError with field names
```

Example Error Log:
```
validation error for EstimateCreateFixedCost
modules.0
  Field required (type=value_error.missing) [type=value_error.missing, input_value={'name': ..., 'description': ...}, input_type=dict, loc=('modules', 0, 'features')]
```

Translation: Module 0 is missing the "features" field.

### Testing Single Endpoint
```bash
curl -X POST http://localhost:8000/api/fixed-cost-estimates/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "client_name": "Test Client",
    "modules": [{
      "name": "Module 1",
      "order": 0,
      "features": [{
        "name": "Feature 1",
        "complexity": 5,
        "base_hours": 10,
        "quantity": 1,
        "assigned_role": "Senior Dev"
      }]
    }],
    "settings": {
      "qa_percentage": 15,
      "pm_percentage": 10,
      "risk_percentage": 10
    }
  }'
```

---

## Common Error Messages & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Failed to fetch` (generic) | Network unreachable | Start backend on port 8000 |
| `403 Forbidden` | CORS policy | Add frontend origin to `CORS_ORIGINS` in main.py |
| `422 Unprocessable Entity` | Schema validation | Check payload field names match schema exactly |
| `Field required` validation error | Missing required field | Add field with proper default value |
| `value_error.number.not_ge: ensure this value is greater than or equal to 1` | Complexity < 1 | Validate complexity field is 1-10 |
| `value_error.number.not_le: ensure this value is less than or equal to 10` | Complexity > 10 | Cap complexity at 10 |
| `500 Internal Server Error` | Database error | Check SQLite permissions, table structure |

---

## What the Save Flow Does

1. **Frontend** collects form data (projectInfo, techStack, modules, overhead)
2. **Frontend** validates basic structure (non-empty name, at least 1 module)
3. **Frontend** calls `POST /api/fixed-cost-estimates/` with full payload
4. **Backend** receives request, validates with Pydantic EstimateCreateFixedCost schema
5. **Backend** creates Estimate, EstimateSettings, Modules, and Features in database
6. **Backend** calls `update_estimate_totals()` to calculate and save total_hours and total_cost
7. **Backend** returns complete Estimate object with ID and timestamps
8. **Frontend** displays success message and adds to SavedEstimates list

---

## Data Flow Diagram

```
┌─ Frontend ─────────────────┐
│  saveEstimate()            │
│  ↓                         │
│  POST /api/fixed-cost-     │
│       estimates/           │
│  (JSON payload)            │
└────────────┬────────────────┘
             ↓
┌─ Backend ──────────────────┐
│  routes/estimates.py       │
│  ↓                         │
│  create_fixed_cost_        │
│  estimate(db, schema)      │
│  ↓ (crud.py)              │
│  models.Estimate()         │
│  models.Module[]           │
│  models.Feature[]          │
│  models.EstimateSettings() │
│  ↓                         │
│  db.commit()               │
│  ↓                         │
│  update_estimate_totals()  │
│  ↓ (calculator.py)        │
│  calculate_estimate_       │
│  breakdown()               │
│  ↓                         │
│  estimate.total_cost       │
│  estimate.total_hours      │
│  ↓                         │
│  db.commit()               │
└────────────┬────────────────┘
             ↓
┌─ SQLite Database ──────────┐
│  estimates                 │
│  modules                   │
│  features                  │
│  estimate_settings         │
│  (all persisted)           │
└────────────────────────────┘
```

---

## Verification Checklist

- [ ] Backend starts without errors on port 8000
- [ ] Frontend loads on port 5173 without CORS errors
- [ ] Health check endpoint returns `{"status":"healthy",...}`
- [ ] Can fill out estimate form without errors
- [ ] Calculate button shows breakdown correctly
- [ ] Save button is clickable
- [ ] Success message appears after save
- [ ] Estimate appears in Saved Estimates list
- [ ] SQLite database has estimate record
- [ ] Can load estimate from Saved Estimates
- [ ] Proposal export (HTML/Text) downloads correct file
- [ ] Browser console has no errors after save

---

## Files Changed

### Backend
- `backend/app/schemas.py` - Added features to ModuleCreate, added model_rebuild()

### Frontend
- `frontend/src/App.jsx` - Enhanced saveEstimate with proper defaults and error details

### No Changes Needed
- Database models (already correct structure)
- CRUD functions (already handle features properly)
- API routes (already defined correctly)
- Calculator logic (already produces correct output)
- Components (already display breakdown correctly)

---

**Version**: 1.0
**Last Updated**: 2026-06-04
**Status**: Ready for Testing
