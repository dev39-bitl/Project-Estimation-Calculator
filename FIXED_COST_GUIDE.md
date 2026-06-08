# Fixed-Cost Project Estimation System - Implementation Guide

## Overview

This document explains the upgraded Project Estimation Calculator, now a **professional fixed-cost project estimation tool** designed for generating client proposals without billing/hiring implications.

---

## Architecture Changes

### Phase 1: Backend Database Models

**New Tables:**
- `internal_rate_cards`: Predefined internal hourly rates for roles (Senior Dev, Junior Dev, QA Tester, Project Manager)
- `tech_stacks`: Technology options with complexity multipliers (Standard 1.0x, Advanced 1.25x, Complex 1.5x)
- `modules`: Project modules that group related features
- `features`: Individual feature definitions with complexity and role assignments
- `estimate_settings`: Overhead percentages (QA, PM, Risk Buffer)

**Updated Estimate Table:**
- Backward compatible with legacy simple estimates
- New fields: `is_fixed_cost`, `tech_stack_json`, `project_info`, `proposal_summary`, `total_fixed_cost`, `total_estimated_hours`

---

## Phase 2: Calculation Engine

### Feature-Level Calculation Formula

```
Feature Hours = Base Hours × Quantity × Complexity Multiplier × Stack Multiplier

Where:
  - Base Hours: baseline effort estimate for 1 feature at standard settings
  - Quantity: multiplier for similar features (e.g., 3 similar pages = quantity 3)
  - Complexity Multiplier: 0.9 + (complexity_score × 0.1) → Range 1.0 to 1.9
  - Stack Multiplier: 1.0 (Standard), 1.25 (Advanced), 1.5 (Complex)

Feature Cost (if billable):
  Feature Cost = Feature Hours × Internal Hourly Rate
```

### Total Estimate Calculation

```
Subtotal Hours = Sum of all feature hours (billable + non-billable)
Subtotal Cost = Sum of billable feature costs only

QA Hours = Subtotal Hours × QA Percentage (default 15%)
QA Cost = QA Hours × QA Tester Rate ($50/h)

PM Hours = Subtotal Hours × PM Percentage (default 10%)
PM Cost = PM Hours × Project Manager Rate ($80/h)

Risk Hours = Subtotal Hours × Risk Percentage (default 10%)
Risk Cost = Subtotal Cost × Risk Percentage (proportional to cost, not hours)

TOTAL ESTIMATED HOURS = Subtotal + QA + PM + Risk Hours
TOTAL FIXED PROJECT COST = Subtotal + QA + PM + Risk Cost
```

### Key Calculator Features

- **Non-Billable Features**: Count toward hours but NOT toward cost (e.g., planning, research)
- **Role-Based Internal Rates**: Only for internal calculation; NOT shown in client proposal
- **Tech Stack Multiplier**: Globally applied to all features based on complexity level
- **Overhead Ratios**: Adjustable percentages for project-specific needs

---

## Phase 3: Frontend Components

### New Layout Structure

```
┌─ Dashboard Header ─────────────────────────────────────────┐
│  Title + Export (HTML/Text) + Save Button                 │
├─────────────────────────────────────────────────────────────┤
│  LEFT COLUMN               │    RIGHT COLUMN               │
├─ ProjectInfoSection        │  - ProposalSummary           │
├─ TechStackSection          │  - SavedEstimates            │
├─ ModulesSection            │                              │
├─ OverheadSection           │                              │
├─ Calculate Button          │                              │
└─────────────────────────────┴──────────────────────────────┘
```

### Component Details

#### ProjectInfoSection
- Project Name (required)
- Client Name (optional)
- Project Description

#### TechStackSection
- Frontend Framework (React, Vue, Angular, None)
- Backend Technology (Python FastAPI, Node.js, Java, Django)
- Database (PostgreSQL, MySQL, MongoDB, SQLite)
- Platform/CMS (WordPress, Shopify, Custom, None)
- Stack Complexity Level (Standard, Advanced, Complex)

#### ModulesSection
- Add/remove modules
- Add/remove features within modules
- Feature fields:
  - Name
  - Type (Feature, API, UI, Integration, Database)
  - Complexity (1-10)
  - Base Hours
  - Quantity
  - Assigned Role
  - Billable checkbox

#### OverheadSection
- QA Percentage (slider, default 15%)
- PM Percentage (slider, default 10%)
- Risk Buffer Percentage (slider, default 10%)

#### ProposalSummary
- Auto-generated proposal text
- Editable proposal narrative
- Module-wise breakdown display
- Overhead breakdown
- Copy proposal button
- Export buttons (HTML, Text)

#### SavedEstimates
- List of saved estimates with quick load/delete
- Shows hours and cost for each

---

## Phase 4: Proposal Export

### Export Formats

#### 1. **Text Export (.txt)**
- Plain text format suitable for email or documentation
- Includes:
  - Project overview
  - Scope breakdown (modules & features)
  - Cost breakdown table
  - Assumptions & exclusions
  - Scope change policy
  - Next steps

#### 2. **HTML Export (.html)**
- Formatted HTML suitable for viewing in browser or printing
- Professional styling with tables and sections
- Can be opened in any browser
- Print-to-PDF compatible

### Export Content Structure

```
1. Header (Date, Project Name, Client Name)
2. Project Overview (Description)
3. Scope Breakdown (Modules → Features)
4. Cost Summary (Table with hours and costs)
5. Assumptions & Exclusions
6. Scope Change Policy
7. Next Steps
```

### Key Features

- ✅ Fixed-cost language (NOT hourly billing)
- ✅ No role rates shown to client
- ✅ Professional formatting
- ✅ Assumptions and exclusions clearly stated
- ✅ 30-day validity period
- ✅ Change request policy included

---

## API Endpoints

### Fixed-Cost Estimation Endpoints

```
POST   /api/fixed-cost-estimates/          Create fixed-cost estimate
GET    /api/estimates/{id}/breakdown       Get detailed breakdown
POST   /api/estimates/{id}/modules/        Create module
PUT    /api/modules/{id}                   Update module
DELETE /api/modules/{id}                   Delete module
POST   /api/modules/{id}/features/         Create feature
PUT    /api/features/{id}                  Update feature
DELETE /api/features/{id}                  Delete feature
GET    /api/rate-cards/                    List internal rate cards
POST   /api/rate-cards/                    Create/update rate card
GET    /api/tech-stacks/                   List tech stacks
```

### Backward Compatibility

Legacy endpoints still work:
```
POST   /api/estimates/                 (simple estimates)
GET    /api/estimates/
GET    /api/estimates/{id}
PUT    /api/estimates/{id}
DELETE /api/estimates/{id}
```

---

## Default Internal Rate Card

```
Senior Dev      = $100/h
Junior Dev      = $60/h
QA Tester       = $50/h
Project Manager = $80/h
```

These are auto-created on first API startup and can be customized via rate-card endpoints.

---

## Running the System

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Backend runs on `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

---

## How to Use: Step-by-Step

### Creating an Estimate

1. **Enter Project Information**
   - Project name, client name, description

2. **Select Technology Stack**
   - Choose frontend, backend, database, platform
   - Select complexity level (affects hours multiplier)

3. **Define Modules & Features**
   - Create modules (e.g., "Authentication", "Dashboard", "Reporting")
   - For each module, add features:
     - Feature name, type, complexity (1-10)
     - Base hours (effort baseline)
     - Quantity (if repeating similar features)
     - Assigned role (determines cost)
     - Mark as billable or non-billable

4. **Configure Overhead**
   - Adjust QA%, PM%, Risk% sliders
   - Defaults: 15%, 10%, 10%

5. **Calculate**
   - Click "Calculate Estimate" to generate proposal

6. **Review Proposal**
   - View auto-generated proposal summary
   - Edit narrative if needed
   - See breakdown of hours and costs

7. **Export or Save**
   - Export as HTML (for printing/email)
   - Export as Text (for docs)
   - Save to database for later

### Loading a Saved Estimate

- Click "Load" next to saved estimate in the right panel
- Form fields will auto-populate from the database
- Feature lists are stored server-side (no local storage limitation)

---

## Terminology

### Internal-Facing (Admin/Calculator Area)
- "Internal Rate Card"
- "Role-Based Allocation"
- "Billable vs Non-Billable"

### Client-Facing (Proposal)
- "Fixed Project Estimate"
- "Fixed-Cost Proposal"
- "Scope Breakdown"
- "Total Estimated Hours"
- "Total Fixed Project Cost"

**NEVER use in proposals:**
- Hourly rates
- Staff augmentation language
- Dedicated resource terminology
- Monthly billing implications

---

## Example Calculation

### Scenario

**Project:** E-Commerce Platform
**Tech Stack:** React + Python FastAPI + PostgreSQL (Advanced: 1.25x)

**Module 1: Authentication** (3 features)
- Feature 1: Login/Register
  - Base Hours: 16
  - Quantity: 1
  - Complexity: 6
  - Role: Senior Dev
  - Billable: ✓

- Feature 2: Password Reset
  - Base Hours: 8
  - Quantity: 1
  - Complexity: 5
  - Role: Junior Dev
  - Billable: ✓

- Feature 3: Onboarding Documentation
  - Base Hours: 4
  - Quantity: 1
  - Complexity: 3
  - Role: Senior Dev
  - Billable: ✗ (non-billable)

### Calculation

```
Feature 1 Hours: 16 × 1 × (0.9 + 0.6) × 1.25 = 31.5h
Feature 1 Cost: 31.5h × $100 = $3,150

Feature 2 Hours: 8 × 1 × (0.9 + 0.5) × 1.25 = 14h
Feature 2 Cost: 14h × $60 = $840

Feature 3 Hours: 4 × 1 × (0.9 + 0.3) × 1.25 = 6h
Feature 3 Cost: 0 (non-billable)

Module Subtotal: 51.5h, $3,990

(With QA 15%, PM 10%, Risk 10%):
QA: 51.5 × 0.15 = 7.725h → $386.25
PM: 51.5 × 0.10 = 5.15h → $412
Risk: $3,990 × 0.10 = $399

TOTAL: 65.375h → $5,187.25
```

---

## Known Limitations & Future Enhancements

### Current (Phase 1-4)
- Frontend calculation simulation (no real-time server sync)
- Text/HTML export only (no PDF yet)
- Single-team rate cards (no multi-tenant)

### Future Enhancements
- PDF export with better formatting
- Real-time backend calculation integration
- Proposal templates/customization
- Team/department rate cards
- Historical estimates comparison
- Client portal for proposal approval
- Integration with project management tools

---

## Troubleshooting

### Backend Issues

**Error: `ModuleNotFoundError: No module named 'fastapi'`**
```bash
pip install -r requirements.txt
```

**Error: `address already in use` on port 8000**
- Change `API_PORT=8001` in `backend/.env`
- Restart backend server

### Frontend Issues

**Error: `Cannot find module 'estimateAPI'`**
- Ensure `frontend/src/services/api.js` exists
- Check import path in components

**Proposal not showing**
- Click "Calculate Estimate" button first
- Check browser console for errors

---

## Support & Questions

For implementation details, see:
- Backend: `backend/app/calculator.py` (calculation logic)
- Backend: `backend/app/crud.py` (data operations)
- Frontend: `frontend/src/App.jsx` (main application logic)
- Utils: `frontend/src/utils/proposalExport.js` (export functionality)

---

**Version:** 2.0  
**Last Updated:** 2026-06-04  
**Status:** Production Ready (Phase 1-4 Complete)
