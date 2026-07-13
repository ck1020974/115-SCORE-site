import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAlertGroups,
  buildClassPageRows,
  buildDashboardModel,
  buildExecutiveWatchlists,
  buildRankingRows,
  mean,
  normalizeGradebook,
  simplifySubjectName,
  standardDeviation,
  toNumber
} from '../src/analytics.js';

const fixture = {
  metadata: { studentCount: 3 },
  students: [
    {
      studentSystemId: 1,
      studentNumber: 'S001',
      className: '701',
      seatNumber: 1,
      name: 'Student A',
      academicRecords: [
        {
          schoolYear: 114,
          semester: 1,
          subjects: [
            {
              subjectName: 'Math',
              regularAssessments: [{ name: 'exam1', score: 80 }, { name: 'exam2', score: 78 }],
              dailyScores: [{ name: 'daily1', score: 90 }, { name: 'daily2', score: 88 }]
            },
            {
              subjectName: 'Chinese',
              regularAssessments: [{ name: 'exam1', score: 95 }],
              dailyScores: [{ name: 'daily1', score: 93 }]
            }
          ]
        },
        {
          schoolYear: 114,
          semester: 2,
          subjects: [
            {
              subjectName: 'Math',
              regularAssessments: [{ name: 'exam1', score: 60 }],
              dailyScores: [{ name: 'daily1', score: 90 }]
            },
            {
              subjectName: 'Chinese',
              regularAssessments: [{ name: 'exam1', score: 92 }],
              dailyScores: [{ name: 'daily1', score: 92 }]
            }
          ]
        }
      ]
    },
    {
      studentSystemId: 2,
      studentNumber: 'S002',
      className: '702',
      seatNumber: 2,
      name: 'Student B',
      academicRecords: [
        {
          schoolYear: 114,
          semester: 1,
          subjects: [
            {
              subjectName: 'Math',
              regularAssessments: [{ name: 'exam1', score: 50 }],
              dailyScores: [{ name: 'daily1', score: 65 }]
            },
            {
              subjectName: 'Chinese',
              regularAssessments: [{ name: 'exam1', score: 55 }],
              dailyScores: [{ name: 'daily1', score: 55 }]
            }
          ]
        }
      ]
    },
    {
      studentSystemId: 3,
      studentNumber: 'S003',
      className: '702',
      seatNumber: 3,
      name: 'Student C',
      academicRecords: [
        {
          schoolYear: 114,
          semester: 1,
          subjects: [
            {
              subjectName: 'Math',
              regularAssessments: [{ name: 'exam1', score: 98 }],
              dailyScores: [{ name: 'daily1', score: 95 }]
            },
            {
              subjectName: 'Chinese',
              regularAssessments: [{ name: 'exam1', score: 91 }],
              dailyScores: [{ name: 'daily1', score: 90 }]
            }
          ]
        }
      ]
    }
  ]
};

test('converts only finite numeric scores', () => {
  assert.equal(toNumber(88), 88);
  assert.equal(toNumber('79.5'), 79.5);
  assert.equal(toNumber('not-a-number'), null);
  assert.equal(toNumber(null), null);
});

test('calculates mean and population standard deviation from numeric values only', () => {
  assert.equal(mean([80, '90', null]), 85);
  assert.equal(standardDeviation([50, 60, 70]), 8.16);
});

test('simplifies subject names and identifies exam subjects for ranking', () => {
  assert.deepEqual(simplifySubjectName('Chinese'), { name: '國文', category: '國文', exam: true });
  assert.deepEqual(simplifySubjectName('Mathematics'), { name: '數學', category: '數學', exam: true });
  assert.deepEqual(simplifySubjectName('Biology'), { name: '生物', category: '自然', exam: true });
  assert.deepEqual(simplifySubjectName('Class Meeting'), { name: '其他', category: '其他', exam: false });
});

test('normalizes gradebook into student subject semester records with split score slots', () => {
  const records = normalizeGradebook(fixture);
  const math = records.find((record) => record.studentNumber === 'S001' && record.subjectName === '數學' && record.semester === 1);

  assert.equal(records.length, 8);
  assert.equal(math.regularAverage, 79);
  assert.equal(math.dailyAverage, 89);
  assert.equal(math.exam1, 80);
  assert.equal(math.exam2, 78);
  assert.equal(math.exam3, null);
  assert.equal(math.daily1, 90);
  assert.equal(math.daily2, 88);
  assert.equal(math.daily3, null);
});

test('builds management model with student subject breakdown for detail views', () => {
  const model = buildDashboardModel(fixture);
  const student = model.students.find((item) => item.studentNumber === 'S001');
  const math = student.subjectBreakdown.find((item) => item.subjectName === '數學');

  assert.equal(model.overview.studentCount, 3);
  assert.equal(model.overview.classCount, 2);
  assert.equal(model.overview.subjectCount, 2);
  assert.equal(student.subjectBreakdown.length, 2);
  assert.equal(math.exam1, 70);
  assert.equal(math.daily1, 90);
  assert.equal(math.subjectAverage, 79.5);
  assert.equal(typeof math.subjectPr, 'number');
});

test('builds school ranking rows with weighted toggle, exam-only filtering, and subject PR', () => {
  const rankingFixture = {
    students: [
      {
        studentNumber: 'A',
        className: '701',
        seatNumber: 1,
        name: 'Alpha',
        academicRecords: [{
          schoolYear: 114,
          semester: 1,
          subjects: [
            { subjectName: 'Chinese', weight: 4, regularAssessments: [{ score: 90 }], dailyScores: [] },
            { subjectName: 'Mathematics', weight: 2, regularAssessments: [{ score: 80 }], dailyScores: [] },
            { subjectName: 'Class Meeting', weight: 10, regularAssessments: [{ score: 100 }], dailyScores: [] }
          ]
        }]
      },
      {
        studentNumber: 'B',
        className: '701',
        seatNumber: 2,
        name: 'Beta',
        academicRecords: [{
          schoolYear: 114,
          semester: 1,
          subjects: [
            { subjectName: 'Chinese', weight: 4, regularAssessments: [{ score: 80 }], dailyScores: [] },
            { subjectName: 'Mathematics', weight: 2, regularAssessments: [{ score: 100 }], dailyScores: [] },
            { subjectName: 'Living Technology', weight: 10, regularAssessments: [{ score: 100 }], dailyScores: [] }
          ]
        }]
      }
    ]
  };

  const model = buildDashboardModel(rankingFixture);
  const weighted = buildRankingRows(model.records, { weighted: true, subjectScope: 'exam' });
  const unweighted = buildRankingRows(model.records, { weighted: false, subjectScope: 'exam' });
  const allSubjects = buildRankingRows(model.records, { weighted: false, subjectScope: 'all' });

  assert.equal(weighted[0].studentNumber, 'A');
  assert.equal(weighted[0].pr, 99);
  assert.equal(weighted[0].subjects.find((subject) => subject.name === '國文').pr, 99);
  assert.equal(unweighted[0].studentNumber, 'B');
  assert.equal(allSubjects[0].average, 93.33);
});

test('supports non-exam subject scope in ranking rows', () => {
  const rankingFixture = {
    students: [
      {
        studentNumber: 'A',
        className: '701',
        seatNumber: 1,
        name: 'Alpha',
        academicRecords: [{
          schoolYear: 114,
          semester: 1,
          subjects: [
            { subjectName: 'Chinese', regularAssessments: [{ score: 90 }], dailyScores: [] },
            { subjectName: 'Class Meeting', regularAssessments: [{ score: 70 }], dailyScores: [] }
          ]
        }]
      }
    ]
  };

  const model = buildDashboardModel(rankingFixture);
  const ranking = buildRankingRows(model.records, { weighted: false, subjectScope: 'nonExam' });

  assert.equal(ranking.length, 1);
  assert.equal(ranking[0].average, 70);
});

test('builds workbench subject columns in 國文、數學、自然、社會 order', () => {
  const rankingFixture = {
    students: [
      {
        studentNumber: 'A',
        className: '701',
        seatNumber: 1,
        name: 'Alpha',
        academicRecords: [{
          schoolYear: 114,
          semester: 1,
          subjects: [
            { subjectName: 'Chinese', regularAssessments: [{ score: 90 }], dailyScores: [] },
            { subjectName: 'Mathematics', regularAssessments: [{ score: 80 }], dailyScores: [] },
            { subjectName: 'Biology', regularAssessments: [{ score: 88 }], dailyScores: [] },
            { subjectName: 'History', regularAssessments: [{ score: 70 }], dailyScores: [] },
            { subjectName: 'Geography', regularAssessments: [{ score: 74 }], dailyScores: [] },
            { subjectName: 'Civics', regularAssessments: [{ score: 76 }], dailyScores: [] }
          ]
        }]
      }
    ]
  };

  const model = buildDashboardModel(rankingFixture);
  const ranking = buildRankingRows(model.records, { weighted: false, examOnly: true });

  assert.deepEqual(
    ranking[0].workbenchSubjects.map((subject) => subject.label),
    ['國文', '數學', '自然', '社會']
  );
  assert.deepEqual(
    ranking[0].workbenchSubjects.map((subject) => subject.average),
    [90, 80, 88, 73.33]
  );
});

test('rounds PR values to whole numbers', () => {
  const fixtureWithFour = {
    students: ['A', 'B', 'C', 'D'].map((name, index) => ({
      studentNumber: name,
      className: '701',
      seatNumber: index + 1,
      name,
      academicRecords: [{
        schoolYear: 114,
        semester: 1,
        subjects: [
          { subjectName: 'Chinese', regularAssessments: [{ score: 95 - index * 5 }], dailyScores: [] }
        ]
      }]
    }))
  };

  const model = buildDashboardModel(fixtureWithFour);
  const ranking = buildRankingRows(model.records, { weighted: false, examOnly: true });

  assert.deepEqual(ranking.map((row) => row.pr), [99, 66, 34, 1]);
});

test('builds class page rows with school-wide rank and class rank under selected term and subject', () => {
  const classPageFixture = {
    students: [
      {
        studentNumber: 'A',
        className: '701',
        seatNumber: 1,
        name: 'Alpha',
        academicRecords: [{
          schoolYear: 114,
          semester: 1,
          subjects: [
            { subjectName: 'Chinese', regularAssessments: [{ score: 90 }], dailyScores: [] },
            { subjectName: 'Mathematics', regularAssessments: [{ score: 70 }], dailyScores: [] }
          ]
        }]
      },
      {
        studentNumber: 'B',
        className: '701',
        seatNumber: 2,
        name: 'Beta',
        academicRecords: [{
          schoolYear: 114,
          semester: 1,
          subjects: [
            { subjectName: 'Chinese', regularAssessments: [{ score: 80 }], dailyScores: [] },
            { subjectName: 'Mathematics', regularAssessments: [{ score: 95 }], dailyScores: [] }
          ]
        }]
      },
      {
        studentNumber: 'C',
        className: '702',
        seatNumber: 1,
        name: 'Gamma',
        academicRecords: [{
          schoolYear: 114,
          semester: 1,
          subjects: [
            { subjectName: 'Chinese', regularAssessments: [{ score: 95 }], dailyScores: [] },
            { subjectName: 'Mathematics', regularAssessments: [{ score: 60 }], dailyScores: [] }
          ]
        }]
      }
    ]
  };

  const model = buildDashboardModel(classPageFixture);
  const chinese = simplifySubjectName('Chinese').name;
  const rows = buildClassPageRows(model.records, {
    className: '701',
    termKey: '114-1',
    subjectName: chinese
  });

  assert.deepEqual(rows.map((row) => row.studentNumber), ['A', 'B']);
  assert.deepEqual(rows.map((row) => row.rank), [2, 3]);
  assert.deepEqual(rows.map((row) => row.classRank), [1, 2]);
  assert.deepEqual(rows.map((row) => row.average), [90, 80]);
});

test('builds executive watchlists for multi-fail and low-overall students without overlap', () => {
  const rankingRows = [
    { studentNumber: 'S001', className: '701', seatNumber: 1, studentName: 'A', average: 82, pr: 70 },
    { studentNumber: 'S002', className: '702', seatNumber: 2, studentName: 'B', average: 54, pr: 8 },
    { studentNumber: 'S003', className: '702', seatNumber: 3, studentName: 'C', average: 63, pr: 22 }
  ];
  const students = [
    { studentNumber: 'S001', lowSubjectCount: 0, overallAverage: 82 },
    { studentNumber: 'S002', lowSubjectCount: 2, overallAverage: 54 },
    { studentNumber: 'S003', lowSubjectCount: 0, overallAverage: 63 }
  ];

  const watchlists = buildExecutiveWatchlists(students, rankingRows);

  assert.deepEqual(watchlists.multiFailing.map((item) => item.studentNumber), ['S002']);
  assert.deepEqual(watchlists.lowOverall.map((item) => item.studentNumber), ['S003']);
});

test('builds alert groups with explicit reasons and top priorities', () => {
  const model = {
    classes: [
      { key: '701', average: 68, lowRatio: 12, standardDeviation: 8 },
      { key: '702', average: 76, lowRatio: 25, standardDeviation: 10 }
    ],
    subjects: [
      { key: '國文', average: 69, lowRatio: 10, standardDeviation: 11 },
      { key: '數學', average: 82, lowRatio: 8, standardDeviation: 17 },
      { key: '音樂', average: 50, lowRatio: 50, standardDeviation: 20 }
    ]
  };

  const alerts = buildAlertGroups(model);

  assert.deepEqual(alerts.classAlerts.map((item) => item.label), ['702', '701']);
  assert.match(alerts.classAlerts[0].reasons.join(' '), /低分比例/);
  assert.deepEqual(alerts.subjectAlerts.map((item) => item.label), ['數學', '國文']);
  assert.match(alerts.subjectAlerts[0].reasons.join(' '), /標準差/);
  assert.equal(alerts.topAlerts.length, 3);
});
