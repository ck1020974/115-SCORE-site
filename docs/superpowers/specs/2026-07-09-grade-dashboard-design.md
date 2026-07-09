# Grade Dashboard Design

## Goal

Build a multi-page school grade management prototype for supervisors. The dashboard should help answer management questions quickly: which classes, subjects, semesters, and students need attention, and how those findings can support meetings, counseling, and teaching improvement.

## Data Source

- Primary source: `grades_by_student.json`
- Shape: `students -> academicRecords -> subjects -> regularAssessments / dailyScores`
- Known constraints:
  - The data includes 148 students, 4 classes, 11 subjects, and semesters `114-1` and `114-2`.
  - Some scores are non-numeric, such as `免`; those values must be excluded from numeric calculations.
  - The first prototype reads local JSON and does not mutate source data.

## Product Scope

The first version is a static multi-page SPA. It uses a left navigation rail and a global filter bar. It does not implement real login or server-side permissions, but includes a permission design page for future implementation.

### Pages

1. Supervisor Overview
   - Shows student count, class count, subject count, low-achievement count, high-risk class count, and high-risk subject count.
   - Shows class averages, subject averages, score distribution, and semester trend.
   - Surfaces meeting prompts such as falling classes, subjects with high spread, and students with multiple low subjects.

2. Class Analysis
   - Compares class averages, low-score ratios, score distributions, subject matrix, and improved or declined students.
   - Highlights classes where regular assessments are much lower than daily scores.

3. Subject Analysis
   - Compares subject averages, standard deviations, low-achievement ratios, and class-by-subject performance.
   - Highlights subjects with large score dispersion or regular-vs-daily assessment gaps.

4. Student Tracking
   - Supports search by name, student number, class, and seat number.
   - Shows individual subject performance, semester trend, and risk tags.

5. Watchlist
   - Lists students below 60, students with multiple low subjects, clearly declined students, regular-low/daily-normal students, daily-low/regular-normal students, and consistently high performers.

6. Trends and Alerts
   - Compares school, class, and subject trends across `114-1` and `114-2`.
   - Marks abnormal declines and groups needing remedial support.

7. Permission Design
   - Shows role visibility for supervisors, homeroom teachers, subject teachers, counselors, parents, and students.

## Analytics Rules

- Numeric score: a finite number or numeric string. Other values are ignored.
- Low score: numeric score below `60`.
- Multi-subject low student: a student with at least two subjects whose semester subject average is below `60`.
- Decline: current semester average at least `5` points below previous semester average.
- Large regular/daily gap: absolute difference between regular average and daily average is at least `10` points.
- High performer: overall average at least `90` and no subject average below `80`.
- Subject dispersion warning: standard deviation at least `15`.

## Architecture

- `app/index.html`: SPA shell.
- `app/styles/main.css`: full application styling.
- `app/src/analytics.js`: pure data loading and analytics functions.
- `app/src/ui.js`: reusable rendering helpers for cards, tables, charts, tags, and filters.
- `app/src/app.js`: routing, state, page composition, and data binding.
- `app/tests/analytics.test.js`: Node tests for analytics behavior.

## Visual Direction

The interface should feel like an education administration workbench: clear, dense, calm, and suitable for meeting projection. It should avoid marketing-page composition. Use a restrained neutral base with distinct accent colors for risk, warning, positive trend, and comparison.

## Testing

Use Node's built-in test runner for analytics. Core analytics rules must be tested before implementation:

- Non-numeric scores are excluded.
- Mean and standard deviation are calculated correctly.
- Low scores and multi-subject low students are detected.
- Semester decline is detected.
- Regular-vs-daily gaps are detected.
- High performers are detected.

## Verification

- Run analytics tests with `node --test app/tests/analytics.test.js`.
- Start a local server with `python -m http.server 5173` from the workspace root.
- Open `http://localhost:5173/app/`.
- Verify all pages render, navigation works, search works, filters update content, and the browser console has no data-loading errors.

