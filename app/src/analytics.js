const LOW_SCORE = 60;
const DECLINE_POINTS = 5;
const GAP_POINTS = 10;
const DISPERSION_WARNING = 15;

export const EXAM_SUBJECTS = ['國文', '英文', '數學', '生物', '歷史', '地理', '公民'];

export function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function mean(values) {
  const numeric = values.map(toNumber).filter((value) => value !== null);
  if (!numeric.length) return null;
  return round(numeric.reduce((sum, value) => sum + value, 0) / numeric.length);
}

export function standardDeviation(values) {
  const numeric = values.map(toNumber).filter((value) => value !== null);
  if (!numeric.length) return null;
  const average = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  const variance = numeric.reduce((sum, value) => sum + (value - average) ** 2, 0) / numeric.length;
  return round(Math.sqrt(variance));
}

export function simplifySubjectName(rawName = '') {
  const name = String(rawName);
  if (/多元評量|班級自治|Class Meeting|生活科技|Living Technology|本土語|寫作/.test(name)) {
    return { name: '其他', category: '其他', exam: false };
  }
  if (/國文|Chinese/i.test(name)) return { name: '國文', category: '國文', exam: true };
  if (/英文|English/i.test(name)) return { name: '英文', category: '英文', exam: true };
  if (/數學|Mathematics|Math/i.test(name)) return { name: '數學', category: '數學', exam: true };
  if (/生物|Biology|自然/.test(name)) return { name: '生物', category: '自然', exam: true };
  if (/歷史|History/i.test(name)) return { name: '歷史', category: '社會', exam: true };
  if (/地理|Geography/i.test(name)) return { name: '地理', category: '社會', exam: true };
  if (/公民|Civics/i.test(name)) return { name: '公民', category: '社會', exam: true };
  return { name: '其他', category: '其他', exam: false };
}

export function normalizeGradebook(data) {
  return (data.students ?? []).flatMap((student) =>
    (student.academicRecords ?? []).flatMap((term) =>
      (term.subjects ?? []).map((subject) => {
        const rawSubjectName = subject.subjectName ?? subject.courseName ?? '未命名科目';
        const simplified = simplifySubjectName(rawSubjectName);
        const regularScores = scoresFrom(subject.regularAssessments);
        const dailyScores = scoresFrom(subject.dailyScores);
        const regularAverage = mean(regularScores);
        const dailyAverage = mean(dailyScores);
        const overallAverage = mean([...regularScores, ...dailyScores]);

        return {
          studentSystemId: student.studentSystemId,
          studentNumber: student.studentNumber,
          className: String(student.className),
          seatNumber: student.seatNumber,
          studentName: student.name,
          schoolYear: term.schoolYear,
          semester: term.semester,
          termKey: `${term.schoolYear}-${term.semester}`,
          courseName: subject.courseName,
          domain: subject.domain,
          rawSubjectName: cleanSubjectName(rawSubjectName),
          subjectName: simplified.name,
          subjectCategory: simplified.category,
          isExamSubject: simplified.exam,
          weight: toNumber(subject.weight) ?? toNumber(subject.periods) ?? 1,
          regularAverage,
          dailyAverage,
          overallAverage,
          regularScores,
          dailyScores,
          scoreCount: regularScores.length + dailyScores.length,
          isLow: overallAverage !== null && overallAverage < LOW_SCORE,
          hasAssessmentGap:
            regularAverage !== null &&
            dailyAverage !== null &&
            Math.abs(regularAverage - dailyAverage) >= GAP_POINTS
        };
      })
    )
  );
}

export function buildDashboardModel(data) {
  const records = normalizeGradebook(data).filter((record) => record.overallAverage !== null);
  const students = buildStudentSummaries(data.students ?? [], records);
  const classes = groupSummaries(records, 'className').map((item) => ({
    ...item,
    lowRatio: ratio(records.filter((record) => record.className === item.key && record.isLow).length, records.filter((record) => record.className === item.key).length)
  }));
  const subjects = groupSummaries(records, 'subjectName').map((item) => ({
    ...item,
    lowRatio: ratio(records.filter((record) => record.subjectName === item.key && record.isLow).length, records.filter((record) => record.subjectName === item.key).length),
    warning: item.standardDeviation >= DISPERSION_WARNING ? '落差偏大' : ''
  }));
  const terms = groupSummaries(records, 'termKey');
  const lowStudents = students.filter((student) => student.lowSubjectCount > 0);
  const multiSubjectLow = students.filter((student) => student.lowSubjectCount >= 2);
  const declining = students.filter((student) => student.change !== null && student.change <= -DECLINE_POINTS);
  const improving = students.filter((student) => student.change !== null && student.change >= DECLINE_POINTS);
  const highPerformers = students.filter((student) => student.overallAverage >= 90 && student.lowestSubjectAverage >= 80);
  const assessmentGap = records.filter((record) => record.hasAssessmentGap);

  return {
    records,
    overview: {
      studentCount: (data.students ?? []).length,
      classCount: unique(records.map((record) => record.className)).length,
      subjectCount: unique(records.map((record) => record.subjectName)).length,
      lowStudentCount: lowStudents.length,
      highRiskClassCount: classes.filter((item) => item.average < 70 || item.lowRatio >= 20).length,
      highRiskSubjectCount: subjects.filter((item) => item.average < 70 || item.standardDeviation >= DISPERSION_WARNING || item.lowRatio >= 20).length,
      average: mean(records.map((record) => record.overallAverage)),
      distribution: distribution(records)
    },
    classes: classes.sort((a, b) => b.average - a.average),
    subjects: subjects.sort((a, b) => b.average - a.average),
    students,
    terms,
    ranking: buildRankingRows(records, { weighted: true, examOnly: true }),
    watchlists: {
      lowStudents,
      multiSubjectLow,
      declining,
      improving,
      assessmentGap,
      highPerformers,
      dailyLowRegularNormal: records.filter((record) => record.dailyAverage !== null && record.regularAverage !== null && record.dailyAverage < LOW_SCORE && record.regularAverage >= 70),
      regularLowDailyNormal: records.filter((record) => record.regularAverage !== null && record.dailyAverage !== null && record.regularAverage < LOW_SCORE && record.dailyAverage >= 70)
    },
    permissions: buildPermissions()
  };
}

export function buildExecutiveWatchlists(students, rankingRows, options = {}) {
  const prThreshold = options.prThreshold ?? 25;
  const studentLookup = new Map(students.map((student) => [student.studentNumber, student]));
  const multiFailing = students
    .filter((student) => (student.lowSubjectCount ?? 0) >= 2)
    .sort((a, b) => (a.overallAverage ?? Infinity) - (b.overallAverage ?? Infinity));
  const multiFailingSet = new Set(multiFailing.map((student) => student.studentNumber));
  const lowOverall = rankingRows
    .filter((row) => row.pr < prThreshold && !multiFailingSet.has(row.studentNumber))
    .map((row) => {
      const student = studentLookup.get(row.studentNumber);
      return {
        ...row,
        lowSubjectCount: student?.lowSubjectCount ?? 0,
        overallAverage: student?.overallAverage ?? row.average
      };
    })
    .sort((a, b) => a.pr - b.pr || a.average - b.average);

  return { multiFailing, lowOverall };
}

export function buildRankingRows(records, options = {}) {
  const weighted = options.weighted ?? true;
  const examOnly = options.examOnly ?? true;
  const sourceRecords = records.filter((record) => record.overallAverage !== null && (!examOnly || record.isExamSubject));
  const subjectPrLookup = buildSubjectPrLookup(sourceRecords);
  const rows = Object.entries(groupBy(sourceRecords, (record) => record.studentNumber)).map(([, studentRecords]) => {
    const first = studentRecords[0];
    const subjectRows = rollupStudentSubjects(studentRecords).map((subject) => ({
      ...subject,
      pr: subjectPrLookup.get(`${subject.name}|${first.studentNumber}`) ?? null
    }));
    const average = weighted ? weightedAverage(subjectRows) : mean(subjectRows.map((subject) => subject.average));

    return {
      studentNumber: first.studentNumber,
      className: first.className,
      seatNumber: first.seatNumber,
      studentName: first.studentName,
      average,
      subjectCount: subjectRows.length,
      subjects: subjectRows
    };
  }).filter((row) => row.average !== null);

  assignRanks(rows, 'rank', 'pr');
  Object.values(groupBy(rows, (row) => row.className)).forEach((classRows) => assignRanks(classRows, 'classRank', 'classPr'));
  return rows.sort((a, b) => a.rank - b.rank || a.className.localeCompare(b.className) || a.seatNumber - b.seatNumber);
}

function buildSubjectPrLookup(records) {
  const lookup = new Map();
  Object.values(groupBy(records, (record) => record.subjectName)).forEach((subjectRecords) => {
    const subjectRows = Object.entries(groupBy(subjectRecords, (record) => record.studentNumber)).map(([, rows]) => ({
      studentNumber: rows[0].studentNumber,
      average: mean(rows.map((record) => record.overallAverage))
    })).filter((row) => row.average !== null);
    assignRanks(subjectRows, 'rank', 'pr');
    subjectRows.forEach((row) => lookup.set(`${subjectRecords[0].subjectName}|${row.studentNumber}`, row.pr));
  });
  return lookup;
}

function rollupStudentSubjects(records) {
  return Object.entries(groupBy(records, (record) => record.subjectName)).map(([name, items]) => ({
    name,
    category: items[0].subjectCategory,
    exam: items[0].isExamSubject,
    average: mean(items.map((item) => item.overallAverage)),
    weight: Math.max(...items.map((item) => item.weight || 1))
  })).sort((a, b) => EXAM_SUBJECTS.indexOf(a.name) - EXAM_SUBJECTS.indexOf(b.name));
}

function weightedAverage(subjects) {
  const valid = subjects.filter((subject) => subject.average !== null);
  const totalWeight = valid.reduce((sum, subject) => sum + (subject.weight || 1), 0);
  if (!valid.length || !totalWeight) return null;
  return round(valid.reduce((sum, subject) => sum + subject.average * (subject.weight || 1), 0) / totalWeight);
}

function assignRanks(rows, rankKey, prKey) {
  rows.sort((a, b) => b.average - a.average);
  let previousAverage = null;
  let previousRank = 0;
  rows.forEach((row, index) => {
    const rank = previousAverage === row.average ? previousRank : index + 1;
    row[rankKey] = rank;
    row[prKey] = rows.length === 1 ? 99 : Math.round(((rows.length - rank) / (rows.length - 1)) * 98 + 1);
    previousAverage = row.average;
    previousRank = rank;
  });
}

function scoresFrom(assessments = []) {
  return assessments.map((assessment) => toNumber(assessment.score)).filter((value) => value !== null);
}

function cleanSubjectName(name) {
  return String(name).replace(/^[?\s]+/, '').trim() || '未命名科目';
}

function buildStudentSummaries(sourceStudents, records) {
  return sourceStudents.map((student) => {
    const studentRecords = records.filter((record) => record.studentNumber === student.studentNumber);
    const subjectAverages = groupSummaries(studentRecords, 'subjectName');
    const termSummaries = groupSummaries(studentRecords, 'termKey').sort((a, b) => a.key.localeCompare(b.key));
    const firstTerm = termSummaries[0]?.average ?? null;
    const lastTerm = termSummaries.at(-1)?.average ?? null;
    const change = firstTerm !== null && lastTerm !== null && termSummaries.length > 1 ? round(lastTerm - firstTerm) : null;
    const lowestSubjectAverage = subjectAverages.length ? Math.min(...subjectAverages.map((item) => item.average)) : null;

    return {
      studentSystemId: student.studentSystemId,
      studentNumber: student.studentNumber,
      className: String(student.className),
      seatNumber: student.seatNumber,
      studentName: student.name,
      overallAverage: mean(studentRecords.map((record) => record.overallAverage)),
      lowSubjectCount: subjectAverages.filter((item) => item.average < LOW_SCORE).length,
      lowestSubjectAverage,
      subjectAverages,
      termSummaries,
      change,
      records: studentRecords
    };
  });
}

function groupSummaries(records, key) {
  return Object.entries(groupBy(records, (record) => record[key] ?? '未分類')).map(([groupKey, items]) => ({
    key: groupKey,
    count: items.length,
    average: mean(items.map((item) => item.overallAverage)),
    regularAverage: mean(items.map((item) => item.regularAverage)),
    dailyAverage: mean(items.map((item) => item.dailyAverage)),
    standardDeviation: standardDeviation(items.map((item) => item.overallAverage)),
    lowCount: items.filter((item) => item.isLow).length,
    records: items
  }));
}

function distribution(records) {
  return [
    { label: '90 以上', count: records.filter((record) => record.overallAverage >= 90).length },
    { label: '80-89', count: records.filter((record) => record.overallAverage >= 80 && record.overallAverage < 90).length },
    { label: '70-79', count: records.filter((record) => record.overallAverage >= 70 && record.overallAverage < 80).length },
    { label: '60-69', count: records.filter((record) => record.overallAverage >= 60 && record.overallAverage < 70).length },
    { label: '60 以下', count: records.filter((record) => record.overallAverage < 60).length }
  ];
}

function buildPermissions() {
  return [
    { role: '主管', scope: '全校、全年級、全班、全科', detail: '可看總覽、班級、科目、趨勢、關注名單' },
    { role: '導師', scope: '自己班級與學生', detail: '可看班級分析、學生追蹤、關注名單與全校排名位置' },
    { role: '任課老師', scope: '自己科目與授課班級', detail: '可看科目分析、班級同科比較' },
    { role: '輔導人員', scope: '關注學生', detail: '可看風險標籤與輔導追蹤欄位，不預設開放所有科目細節' },
    { role: '家長 / 學生', scope: '個人資料', detail: '只看個人成績、趨勢與簡化建議' }
  ];
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups[key] ??= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function ratio(part, total) {
  return total ? round((part / total) * 100) : 0;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
