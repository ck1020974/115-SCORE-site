import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExecutiveWatchlists,
  buildDashboardModel,
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
              regularAssessments: [{ name: 'mid', score: 80 }, { name: 'final', score: '免' }],
              dailyScores: [{ name: 'daily', score: 90 }]
            },
            {
              subjectName: 'Chinese',
              regularAssessments: [{ name: 'mid', score: 95 }],
              dailyScores: [{ name: 'daily', score: 93 }]
            }
          ]
        },
        {
          schoolYear: 114,
          semester: 2,
          subjects: [
            {
              subjectName: 'Math',
              regularAssessments: [{ name: 'mid', score: 60 }],
              dailyScores: [{ name: 'daily', score: 90 }]
            },
            {
              subjectName: 'Chinese',
              regularAssessments: [{ name: 'mid', score: 92 }],
              dailyScores: [{ name: 'daily', score: 92 }]
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
              regularAssessments: [{ name: 'mid', score: 50 }],
              dailyScores: [{ name: 'daily', score: 65 }]
            },
            {
              subjectName: 'Chinese',
              regularAssessments: [{ name: 'mid', score: 55 }],
              dailyScores: [{ name: 'daily', score: 55 }]
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
              regularAssessments: [{ name: 'mid', score: 98 }],
              dailyScores: [{ name: 'daily', score: 95 }]
            },
            {
              subjectName: 'Chinese',
              regularAssessments: [{ name: 'mid', score: 91 }],
              dailyScores: [{ name: 'daily', score: 90 }]
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
  assert.equal(toNumber('免'), null);
  assert.equal(toNumber(null), null);
});

test('calculates mean and population standard deviation from numeric values only', () => {
  assert.equal(mean([80, '免', 90, null]), 85);
  assert.equal(standardDeviation([50, 60, 70]), 8.16);
});

test('normalizes gradebook into student subject semester records', () => {
  const records = normalizeGradebook(fixture);
  const math = records.find((record) => record.studentNumber === 'S001' && record.subjectName === '數學' && record.semester === 1);

  assert.equal(records.length, 8);
  assert.equal(math.regularAverage, 80);
  assert.equal(math.dailyAverage, 90);
  assert.equal(math.overallAverage, 85);
});

test('builds management model with low scores, gaps, declines, and high performers', () => {
  const model = buildDashboardModel(fixture);

  assert.equal(model.overview.studentCount, 3);
  assert.equal(model.overview.classCount, 2);
  assert.equal(model.overview.subjectCount, 2);
  assert.equal(model.watchlists.multiSubjectLow.length, 1);
  assert.equal(model.watchlists.multiSubjectLow[0].studentNumber, 'S002');
  assert.equal(model.watchlists.assessmentGap.some((item) => item.studentNumber === 'S001' && item.subjectName === '數學'), true);
  assert.equal(model.watchlists.declining.some((item) => item.studentNumber === 'S001'), true);
  assert.equal(model.watchlists.highPerformers.some((item) => item.studentNumber === 'S003'), true);
});

test('simplifies subject names and identifies exam subjects for ranking', () => {
  assert.deepEqual(simplifySubjectName('國文Chinese'), { name: '國文', category: '國文', exam: true });
  assert.deepEqual(simplifySubjectName('數學Mathematics'), { name: '數學', category: '數學', exam: true });
  assert.deepEqual(simplifySubjectName('生物Biology'), { name: '生物', category: '自然', exam: true });
  assert.deepEqual(simplifySubjectName('歷史G7多元評量成績(佔期末考25%)'), { name: '其他', category: '其他', exam: false });
  assert.deepEqual(simplifySubjectName('班級自治會Class Meeting'), { name: '其他', category: '其他', exam: false });
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
            { subjectName: '國文Chinese', weight: 4, regularAssessments: [{ score: 90 }], dailyScores: [] },
            { subjectName: '數學Mathematics', weight: 2, regularAssessments: [{ score: 80 }], dailyScores: [] },
            { subjectName: '班級自治會Class Meeting', weight: 10, regularAssessments: [{ score: 100 }], dailyScores: [] }
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
            { subjectName: '國文Chinese', weight: 4, regularAssessments: [{ score: 80 }], dailyScores: [] },
            { subjectName: '數學Mathematics', weight: 2, regularAssessments: [{ score: 100 }], dailyScores: [] },
            { subjectName: '生活科技Living Technology', weight: 10, regularAssessments: [{ score: 100 }], dailyScores: [] }
          ]
        }]
      }
    ]
  };
  const model = buildDashboardModel(rankingFixture);
  const weighted = buildRankingRows(model.records, { weighted: true, examOnly: true });
  const unweighted = buildRankingRows(model.records, { weighted: false, examOnly: true });
  const allSubjects = buildRankingRows(model.records, { weighted: false, examOnly: false });

  assert.equal(weighted[0].studentNumber, 'A');
  assert.equal(weighted[0].rank, 1);
  assert.equal(weighted[0].pr, 99);
  assert.equal(weighted[0].subjects.find((subject) => subject.name === '國文').pr, 99);
  assert.equal(unweighted[0].studentNumber, 'B');
  assert.equal(allSubjects[0].average, 93.33);
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
          { subjectName: '??Chinese', regularAssessments: [{ score: 95 - index * 5 }], dailyScores: [] }
        ]
      }]
    }))
  };
  const model = buildDashboardModel(fixtureWithFour);
  const ranking = buildRankingRows(model.records, { weighted: false, examOnly: true });

  assert.deepEqual(ranking.map((row) => row.pr), [99, 66, 34, 1]);
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
