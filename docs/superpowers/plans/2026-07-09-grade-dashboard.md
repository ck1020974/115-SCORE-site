# Grade Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-page static supervisor decision dashboard from `grades_by_student.json`.

**Architecture:** A no-build static SPA reads the existing JSON file, transforms it through pure analytics functions, and renders page views from reusable UI helpers. Analytics are isolated from DOM code so calculations can be tested with Node's built-in test runner.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Node built-in test runner, Python local static server.

## Global Constraints

- Read `grades_by_student.json` as the first-version data source.
- Exclude non-numeric scores from numeric calculations.
- Implement pages: supervisor overview, class analysis, subject analysis, student tracking, watchlist, trends and alerts, permission design.
- Do not implement real authentication in version one.
- Keep the app runnable without package installation or build tooling.
- Use Node tests for analytics rules before relying on the UI.

---

### Task 1: Analytics Contract

**Files:**
- Create: `app/tests/analytics.test.js`
- Create: `app/src/analytics.js`

**Interfaces:**
- Produces: `toNumber(value)`, `mean(values)`, `standardDeviation(values)`, `normalizeGradebook(data)`, `buildDashboardModel(data)`
- Consumes: raw JSON shaped like `grades_by_student.json`

- [ ] **Step 1: Write failing analytics tests**

Create tests for numeric cleanup, mean, standard deviation, low-score detection, multi-subject low detection, decline detection, assessment gap detection, and high performer detection.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test app/tests/analytics.test.js`
Expected: fail because `app/src/analytics.js` does not export the required functions yet.

- [ ] **Step 3: Implement minimal analytics**

Create pure analytics functions that flatten student records, calculate aggregates, and produce a dashboard model.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test app/tests/analytics.test.js`
Expected: all tests pass.

### Task 2: Static SPA Shell

**Files:**
- Create: `app/index.html`
- Create: `app/styles/main.css`
- Create: `app/src/ui.js`
- Create: `app/src/app.js`

**Interfaces:**
- Consumes: `buildDashboardModel(data)` from `app/src/analytics.js`
- Produces: a browser app at `/app/`

- [ ] **Step 1: Add HTML shell**

Create a semantic document with a sidebar, filter bar, route title, and page root.

- [ ] **Step 2: Add layout and component CSS**

Style the app as a dense education administration workbench with accessible contrast and responsive layouts.

- [ ] **Step 3: Add reusable UI helpers**

Implement cards, tables, bars, mini line charts, badges, and empty states.

- [ ] **Step 4: Add app routing and data loading**

Load `../grades_by_student.json`, build the dashboard model, and render route views.

### Task 3: Dashboard Pages

**Files:**
- Modify: `app/src/app.js`
- Modify: `app/src/ui.js`
- Modify: `app/styles/main.css`

**Interfaces:**
- Consumes: dashboard model sections `overview`, `classes`, `subjects`, `students`, `watchlists`, `trends`, `permissions`
- Produces: seven navigable page views

- [ ] **Step 1: Implement supervisor overview**

Render KPI cards, class averages, subject averages, score distribution, semester trend, and meeting prompts.

- [ ] **Step 2: Implement class analysis**

Render class ranking, low-score ratios, subject matrix, regular/daily gaps, and improved/declined student lists.

- [ ] **Step 3: Implement subject analysis**

Render subject averages, standard deviations, low ratios, class comparisons, and subject warnings.

- [ ] **Step 4: Implement student tracking**

Render search controls and individual student detail panels.

- [ ] **Step 5: Implement watchlist**

Render categorized student watchlists with risk tags and suggested follow-up owners.

- [ ] **Step 6: Implement trends and alerts**

Render school, class, and subject trend comparisons with abnormal decline tags.

- [ ] **Step 7: Implement permission design**

Render role capability matrix for supervisor, homeroom teacher, subject teacher, counselor, parent, and student.

### Task 4: Verification

**Files:**
- Modify: only if verification reveals defects.

**Interfaces:**
- Consumes: complete static app
- Produces: tested local prototype URL

- [ ] **Step 1: Run analytics tests**

Run: `node --test app/tests/analytics.test.js`
Expected: all tests pass.

- [ ] **Step 2: Start local server**

Run from workspace root: `python -m http.server 5173`
Expected: server listens on `http://localhost:5173/`.

- [ ] **Step 3: Browser smoke check**

Open `http://localhost:5173/app/` and verify the seven pages, navigation, filters, and search.

