import {
  buildAlertGroups,
  EXAM_SUBJECTS,
  buildClassPageRows,
  buildDashboardModel,
  buildExecutiveWatchlists,
  buildRankingRows,
  mean
} from './analytics.js?v=20260714-workbench-a2';
import {
  distributionChart,
  el,
  formatNumber,
  insightList,
  metricCard,
  section,
  table,
  tag
} from './ui.js?v=20260714-workbench-a2';

const routes = [
  { id: 'overview', label: '主管總覽', title: '主管總覽', eyebrow: '先看全校風險，再決定今天要追哪裡。' },
  { id: 'rankings', label: '全校排名', title: '全校排名', eyebrow: '提供導師與主管共用的全校比較基準。' },
  { id: 'classes', label: '班級分析', title: '班級分析', eyebrow: '看班級平均、標準差與班內名次。' },
  { id: 'subjects', label: '科目分析', title: '科目分析', eyebrow: '從科目角度判讀整體表現，而不是先看學生。' },
  { id: 'alerts', label: '需留意項目', title: '需留意項目', eyebrow: '列出目前需要優先關注的班級與科目。', hidden: true },
  { id: 'students', label: '學生查詢', title: '學生查詢', eyebrow: '把學生頁收斂成搜尋入口。' },
  { id: 'watchlist', label: '關注名單', title: '關注名單', eyebrow: '只保留真正要處理的兩種名單。' },
  { id: 'trends', label: '趨勢預警', title: '趨勢預警', eyebrow: '看變化是整體趨勢，還是集中在特定群體。' },
  { id: 'permissions', label: '資料權限', title: '資料權限', eyebrow: '先把誰可以看什麼訂清楚。' }
];

const state = {
  route: 'overview',
  routeParam: '',
  className: 'all',
  termKey: 'all',
  studentTermKey: '',
  weighted: true,
  subjectScope: 'exam',
  rankingSort: 'rank',
  classSort: 'seatNumber',
  classSubjectScope: 'all',
  subjectFocus: '',
  studentQuery: '',
  model: null
};

const page = document.querySelector('#page');
const nav = document.querySelector('#nav');
const title = document.querySelector('#page-title');
const eyebrow = document.querySelector('#eyebrow');

init();

async function init() {
  renderNav();
  try {
    const response = await fetch('../grades_by_student.json');
    const data = await response.json();
    state.model = buildDashboardModel(data);
    state.subjectFocus = state.model.subjects.find((item) => EXAM_SUBJECTS.includes(item.key))?.key ?? EXAM_SUBJECTS[0];
    bindEvents();
    syncRoute();
    render();
  } catch (error) {
    eyebrow.textContent = '資料載入失敗';
    page.replaceChildren(el('div', { class: 'panel' }, [
      el('div', { class: 'empty' }, ['成績資料目前無法載入，請重新整理頁面後再試一次。'])
    ]));
    console.error(error);
  }
}

function bindEvents() {
  window.addEventListener('hashchange', () => {
    syncRoute();
    render();
  });
}

function syncRoute() {
  const hash = location.hash.replace(/^#/, '') || 'overview';
  const [route, ...rest] = hash.split('/');
  state.route = route || 'overview';
  state.routeParam = decodeURIComponent(rest.join('/'));
}

function renderNav() {
  nav.replaceChildren(...routes.filter((route) => !route.hidden).map((route) =>
    el('button', {
      class: route.id === state.route ? 'active' : '',
      onclick: () => { location.hash = route.id; }
    }, [route.label])
  ));
}

function render() {
  renderNav();
  const meta = state.route === 'student'
    ? { title: '學生詳頁', eyebrow: '以一位學生為中心，查看六次成績與追蹤訊號。' }
    : routes.find((item) => item.id === state.route) ?? routes[0];
  title.textContent = meta.title;
  eyebrow.textContent = meta.eyebrow;

  const filtered = filteredModel();
  const renderer = {
    overview: renderOverview,
    rankings: renderRankings,
    classes: renderClasses,
    subjects: renderSubjects,
    alerts: renderAlerts,
    students: renderStudents,
    watchlist: renderWatchlist,
    trends: renderTrends,
    permissions: renderPermissions,
    student: () => renderStudentDetail(state.model, state.routeParam)
  }[state.route] ?? renderOverview;

  page.replaceChildren(renderer(filtered));
}

function filteredModel() {
  const records = state.model.records.filter((record) =>
    (state.className === 'all' || record.className === state.className) &&
    (state.termKey === 'all' || record.termKey === state.termKey)
  );

  return {
    ...state.model,
    records,
    students: buildFilteredStudents(records),
    classes: summarize(records, 'className'),
    subjects: summarize(records, 'subjectName'),
    terms: summarize(records, 'termKey')
  };
}

function renderOverview(model) {
  const lowStudents = model.students.filter((student) => student.lowSubjectCount > 0);
  const riskClasses = model.classes.filter((item) => item.average < 70 || item.lowRatio >= 20);
  const riskSubjects = model.subjects.filter((item) => EXAM_SUBJECTS.includes(item.key) && (item.average < 70 || item.standardDeviation >= 15));

  return el('div', { class: 'page' }, [
    el('div', { class: 'metrics metrics-compact' }, [
      metricCard('全校平均', formatNumber(mean(model.records.map((record) => record.overallAverage))), '目前範圍內成績概況', 'good'),
      linkedMetricCard('低成就學生', lowStudents.length, '至少一科低於 60 分', 'risk', '#watchlist'),
      linkedMetricCard('需留意項目', riskClasses.length + riskSubjects.length, '查看班級與科目清單', 'warn', '#alerts')
    ]),
    section('首頁摘要', '', [
      el('div', { class: 'grid cols-2 overview-compact-grid' }, [
        section('分數分布', '', [
          distributionChart(distribution(model.records.filter((record) => record.isExamSubject)))
        ]),
        section('管理提醒', '', [
          insightList([
            {
              title: '班級',
              body: riskClasses[0]
                ? `${riskClasses[0].key} 低分比例 ${formatNumber(riskClasses[0].lowRatio)}%，建議先看班內弱科與評量落差。`
                : '目前沒有明顯偏弱班級。',
              tone: riskClasses[0] ? 'warn' : 'good'
            },
            {
              title: '科目',
              body: riskSubjects[0]
                ? `${riskSubjects[0].key} 平均 ${formatNumber(riskSubjects[0].average)}、標準差 ${formatNumber(riskSubjects[0].standardDeviation)}。`
                : '目前考科表現沒有明顯異常。',
              tone: riskSubjects[0] ? 'warn' : 'good'
            },
            {
              title: '學生',
              body: `${lowStudents.length} 位學生已有低分訊號，可從關注名單進一步分流處理。`,
              tone: lowStudents.length ? 'risk' : 'good'
            }
          ])
        ])
      ])
    ])
  ]);
}

function renderAlerts(model) {
  const { classAlerts, subjectAlerts, topAlerts } = buildAlertGroups(model);

  return el('div', { class: 'page' }, [
    el('div', { class: 'metrics metrics-compact' }, [
      metricCard('需留意項目', classAlerts.length + subjectAlerts.length, topAlerts[0] ? `先看 ${topAlerts[0].label}` : '目前沒有異常', topAlerts.length ? 'warn' : 'good'),
      metricCard('需留意班級', classAlerts.length, classAlerts[0]?.reasons[0] ?? '目前沒有異常', classAlerts.length ? 'warn' : 'good'),
      metricCard('需留意科目', subjectAlerts.length, subjectAlerts[0]?.reasons[0] ?? '目前沒有異常', subjectAlerts.length ? 'warn' : 'good')
    ]),
    section('先看這些', '先決定今天會議要先討論哪幾個項目。', [
      topAlerts.length
        ? alertPriorityList(topAlerts)
        : el('div', { class: 'empty' }, ['目前沒有明顯需優先處理的項目。'])
    ]),
    el('div', { class: 'grid cols-2' }, [
      section('需留意班級', '列出原因，不只看數量。', [
        classAlerts.length ? alertClassList(classAlerts) : el('div', { class: 'empty' }, ['目前沒有需留意班級。'])
      ]),
      section('需留意科目', '列出原因，不只看數量。', [
        subjectAlerts.length ? alertSubjectList(subjectAlerts) : el('div', { class: 'empty' }, ['目前沒有需留意科目。'])
      ])
    ])
  ]);
}

function renderRankings(model) {
  const rows = sortedRankingRows(buildRankingRows(model.records, {
    weighted: state.weighted,
    subjectScope: state.subjectScope
  }), state.rankingSort);

  return el('div', { class: 'page' }, [
    pageFilterBar({
      showClass: true,
      showTerm: true
    }),
    rankingWorkbenchSection('全校排名', rows.slice(0, 80)),
  ]);
}

function rankingWorkbenchSection(titleText, rows) {
  return el('section', { class: 'panel' }, [
    el('div', { class: 'panel-head panel-head-workbench' }, [
      el('div', {}, [
        el('h2', {}, [titleText])
      ]),
      rankingWorkbenchControls()
    ]),
    el('div', { class: 'panel-body-tight' }, [
      rankingTable(rows, { mode: 'ranking' })
    ])
  ]);
}

function renderClasses(model) {
  const classOptions = unique(state.model.records.map((record) => record.className)).sort();
  const termOptions = unique(state.model.records.map((record) => record.termKey)).sort();
  const subjectOptions = ['all', ...EXAM_SUBJECTS.filter((subjectName) =>
    state.model.records.some((record) => record.isExamSubject && record.subjectName === subjectName)
  )];
  const selectedClass = classOptions.includes(state.className) ? state.className : classOptions[0];
  const selectedTerm = termOptions.includes(state.termKey) ? state.termKey : termOptions[0];
  const classRecords = state.model.records.filter((record) =>
    record.className === selectedClass && record.termKey === selectedTerm
  );
  const rows = buildClassPageRows(state.model.records, {
    className: selectedClass,
    termKey: selectedTerm,
    subjectName: state.classSubjectScope
  });
  const summaryRecords = state.classSubjectScope === 'all'
    ? classRecords.filter((record) => record.isExamSubject)
    : classRecords.filter((record) => record.subjectName === state.classSubjectScope);
  const selectedClassSummary = summarize(summaryRecords, 'className')[0];

  return el('div', { class: 'page' }, [
    el('section', { class: 'panel' }, [
      el('div', { class: 'panel-head panel-head-workbench class-workbench-head' }, [
        classWorkbenchTabs(classOptions, termOptions, subjectOptions, selectedClass, selectedTerm),
        ...(selectedClassSummary ? [classSummaryCards(selectedClassSummary)] : [])
      ]),
      rows.length ? rankingTable(rows, { mode: 'class' }) : el('div', { class: 'empty' }, ['目前沒有可顯示的班級資料。'])
    ])
  ]);
}

function renderSubjects(model) {
  const subjectOptions = model.subjects.map((item) => item.key).filter((name) => EXAM_SUBJECTS.includes(name));
  if (!subjectOptions.includes(state.subjectFocus)) state.subjectFocus = subjectOptions[0] ?? '';

  const subjectRecords = model.records.filter((record) => record.subjectName === state.subjectFocus);
  const summary = model.subjects.find((item) => item.key === state.subjectFocus);
  const classRows = summarize(subjectRecords, 'className')
    .map((item) => ({
      ...item,
      gap: Math.abs((item.regularAverage ?? 0) - (item.dailyAverage ?? 0))
    }))
    .sort((a, b) => (a.average ?? Infinity) - (b.average ?? Infinity));
  const lowScoreRows = subjectRecords
    .filter((record) => record.overallAverage < 60)
    .sort((a, b) => a.overallAverage - b.overallAverage)
    .slice(0, 10);
  const patternRows = scorePatternRows(subjectRecords);

  return el('div', { class: 'page' }, [
    pageFilterBar({
      showClass: true,
      showTerm: true,
      extraControls: [
        labelledSelect('科目', state.subjectFocus, subjectOptions.map((name) => ({ label: name, value: name })), (value) => {
          state.subjectFocus = value;
          render();
        })
      ]
    }),
    el('div', { class: 'metrics metrics-compact' }, [
      metricCard('科目平均', formatNumber(summary?.average), state.subjectFocus),
      metricCard('低分比例', `${formatNumber(summary?.lowRatio)}%`, '低於 60 分'),
      metricCard('標準差', formatNumber(summary?.standardDeviation), '判斷是否分化過大', (summary?.standardDeviation ?? 0) >= 15 ? 'warn' : 'good')
    ]),
    el('div', { class: 'grid cols-2' }, [
      section('班級比較', '先看哪幾班在這一科差最多。', [
        classRows.length
          ? subjectClassComparisonList(classRows)
          : el('div', { class: 'empty' }, ['目前沒有班級比較資料。'])
      ]),
      section('評量結構', '把三次段考、三次平時攤開，先看整體模式。', [
        patternRows.length
          ? subjectPatternList(patternRows)
          : el('div', { class: 'empty' }, ['目前沒有評量結構資料。'])
      ])
    ]),
    section('低分學生', '列出這一科目前較需要留意的學生。', [
      table([
        { label: '班級', key: 'className' },
        { label: '座號', key: 'seatNumber' },
        { label: '姓名', render: (row) => studentLink(row) },
        { label: '科目成績', key: 'overallAverage' },
        { label: '段考平均', key: 'regularAverage' },
        { label: '平時平均', key: 'dailyAverage' }
      ], lowScoreRows, '目前沒有低分學生資料。')
    ])
  ]);
}

function renderStudents() {
  const wrapper = el('div', { class: 'page' });
  const input = el('input', {
    type: 'search',
    value: state.studentQuery,
    placeholder: '輸入姓名、學號、班級或座號',
    oninput: (event) => {
      state.studentQuery = event.target.value;
      render();
    }
  });

  const keyword = state.studentQuery.trim().toLowerCase();
  const results = !keyword
    ? []
    : state.model.students.filter((student) =>
      [student.studentName, student.studentNumber, student.className, `${student.className}${student.seatNumber}`, `${student.className} ${student.seatNumber}`]
        .some((value) => String(value).toLowerCase().includes(keyword))
    ).slice(0, 12);

  const resultRoot = el('div', {});
  if (!keyword) {
    resultRoot.replaceChildren(el('section', { class: 'panel search-workbench search-workbench-empty' }, [
      el('div', { class: 'empty' }, ['輸入學生資料後即可查看個人成績。'])
    ]));
  } else if (!results.length) {
    resultRoot.replaceChildren(el('section', { class: 'panel search-workbench search-workbench-empty' }, [
      el('div', { class: 'empty' }, ['查無符合的學生。'])
    ]));
  } else {
    resultRoot.replaceChildren(el('section', { class: 'panel search-workbench' }, [
      el('div', { class: 'panel-head panel-head-compact' }, [
        el('div', {}, [
          el('h2', {}, ['查詢結果']),
          el('p', {}, ['點擊學生即可進入個別學生詳頁。'])
        ])
      ]),
      table([
        { label: '班級', key: 'className' },
        { label: '座號', key: 'seatNumber' },
        { label: '姓名', render: (row) => studentLink(row) },
        { label: '平均', key: 'overallAverage' },
        { label: '低分科數', key: 'lowSubjectCount' }
      ], results, '查無符合的學生。')
    ]));
  }

  wrapper.replaceChildren(
    el('section', { class: 'panel search-workbench' }, [
      el('div', { class: 'panel-head panel-head-compact' }, [
        el('div', {}, [
          el('h2', {}, ['學生查詢']),
          el('p', {}, ['從這裡進入個別學生頁面。'])
        ])
      ]),
      el('div', { class: 'search-workbench-bar' }, [input])
    ]),
    resultRoot
  );
  return wrapper;
}

function renderWatchlist(model) {
  const rankingRows = buildRankingRows(model.records, {
    weighted: state.weighted,
    subjectScope: 'exam'
  });
  const watchlists = buildExecutiveWatchlists(model.students, rankingRows, { prThreshold: 25 });

  return el('div', { class: 'page watchlist-workbench' }, [
    el('div', { class: 'metrics metrics-compact' }, [
      metricCard('多科不及格', watchlists.multiFailing.length, '兩科以上低於 60 分', watchlists.multiFailing.length ? 'risk' : 'good'),
      metricCard('整體偏低', watchlists.lowOverall.length, 'PR 低但非多科不及格', watchlists.lowOverall.length ? 'warn' : 'good')
    ]),
    el('section', { class: 'panel watchlist-workbench-section' }, [
      el('div', { class: 'panel-head panel-head-compact' }, [
        el('div', {}, [
          el('h2', {}, ['多科不及格']),
          el('p', {}, ['優先處理需要立即介入的學生。'])
        ])
      ]),
      table([
        { label: '班級', key: 'className' },
        { label: '座號', key: 'seatNumber' },
        { label: '姓名', render: (row) => studentLink(row) },
        { label: '平均', key: 'overallAverage' },
        { label: '低分科數', key: 'lowSubjectCount' }
      ], watchlists.multiFailing, '目前沒有多科不及格學生。')
    ]),
    el('section', { class: 'panel watchlist-workbench-section' }, [
      el('div', { class: 'panel-head panel-head-compact' }, [
        el('div', {}, [
          el('h2', {}, ['整體偏低']),
          el('p', {}, ['整體名次偏後，但不是多科不及格。'])
        ])
      ]),
      table([
        { label: '班級', key: 'className' },
        { label: '座號', key: 'seatNumber' },
        { label: '姓名', render: (row) => studentLink(row) },
        { label: '平均', key: 'average' },
        { label: 'PR', render: (row) => formatPr(row.pr) }
      ], watchlists.lowOverall, '目前沒有整體偏低學生。')
    ])
  ]);
}

function renderTrends(model) {
  const classTrends = trendBy(state.model.records, 'className');
  const subjectTrends = trendBy(state.model.records.filter((record) => record.isExamSubject), 'subjectName');
  const studentSignals = state.model.students
    .filter((student) => student.change !== null)
    .sort((a, b) => a.change - b.change)
    .slice(0, 8);

  return el('div', { class: 'page' }, [
    el('div', { class: 'grid cols-2' }, [
      section('班級變化', '比較各班跨學期的平均變化。', [trendList(classTrends, '班級')]),
      section('科目變化', '比較各考科跨學期的平均變化。', [trendList(subjectTrends, '科目')])
    ]),
    section('學生訊號', '列出近期退步較明顯的學生。', [
      studentSignals.length
        ? table([
          { label: '班級', key: 'className' },
          { label: '座號', key: 'seatNumber' },
          { label: '姓名', render: (row) => studentLink(row) },
          { label: '平均', key: 'overallAverage' },
          { label: '變化', key: 'change' }
        ], studentSignals, '目前沒有學生變化資料。')
        : el('div', { class: 'empty' }, ['目前沒有學生變化資料。'])
    ])
  ]);
}

function renderPermissions(model) {
  return el('div', { class: 'page' }, [
    section('資料權限', '成績資料敏感，建議一開始就分角色設計。', [
      table([
        { label: '角色', key: 'role' },
        { label: '可查看範圍', key: 'scope' },
        { label: '說明', key: 'detail' }
      ], model.permissions)
    ])
  ]);
}

function pageFilterBar({ showClass, showTerm, extraControls = [] }) {
  const controls = [];
  if (showClass) {
    controls.push(labelledSelect('班級', state.className, [
      { label: '全部班級', value: 'all' },
      ...unique(state.model.records.map((record) => record.className)).sort().map((className) => ({ label: className, value: className }))
    ], (value) => {
      state.className = value;
      render();
    }));
  }
  if (showTerm) {
    controls.push(labelledSelect('學期', state.termKey, [
      { label: '全部學期', value: 'all' },
      ...unique(state.model.records.map((record) => record.termKey)).sort().map((termKey) => ({ label: termKey, value: termKey }))
    ], (value) => {
      state.termKey = value;
      render();
    }));
  }

  return el('div', { class: 'filter-toolbar' }, [
    el('div', { class: 'field-row field-row-flex' }, [...controls, ...extraControls])
  ]);
}

function rankingWorkbenchControls() {
  return el('div', { class: 'workbench-controls' }, [
    segmentedControl([
      { label: '考科', value: 'exam' },
      { label: '非考科', value: 'nonExam' }
    ], state.subjectScope, (value) => {
      state.subjectScope = value;
      render();
    }),
    segmentedControl([
      { label: '加權', value: 'weighted' },
      { label: '不加權', value: 'plain' }
    ], state.weighted ? 'weighted' : 'plain', (value) => {
      state.weighted = value === 'weighted';
      render();
    }),
    segmentedControl([
      { label: '校排', value: 'rank' },
      { label: '班級', value: 'className' }
    ], state.rankingSort, (value) => {
      state.rankingSort = value;
      render();
    })
  ]);
}

function labelledSelect(label, value, options, onChange) {
  const select = el('select', { onchange: (event) => onChange(event.target.value) }, options.map((option) =>
    el('option', { value: option.value }, [option.label])
  ));
  select.value = value;
  return el('label', { class: 'control-field' }, [label, select]);
}

function compactSelectField(label, value, options, onChange, className = '') {
  const select = el('select', { onchange: (event) => onChange(event.target.value) }, options.map((option) =>
    el('option', { value: option.value }, [option.label])
  ));
  select.value = value;
  return el('label', { class: `compact-control ${className}`.trim() }, [
    el('span', {}, [label]),
    select
  ]);
}

function rankingSortOptions(mode) {
  return mode === 'class'
    ? [
      { label: '座號', value: 'seatNumber' },
      { label: '班排', value: 'classRank' },
      { label: '校排', value: 'rank' }
    ]
    : [
      { label: '校排', value: 'rank' },
      { label: '平均', value: 'average' },
      { label: '班級', value: 'className' }
    ];
}

function segmentedControl(options, currentValue, onChange) {
  return el('div', { class: 'segmented-control' }, options.map((option) =>
    el('button', {
      type: 'button',
      class: option.value === currentValue ? 'active' : '',
      onclick: () => onChange(option.value)
    }, [option.label])
  ));
}

function rankingTable(rows, options = {}) {
  const isClassMode = options.mode === 'class';
  const columns = isClassMode
    ? [
      { label: '座號', key: 'seatNumber' },
      { label: '姓名', render: (row) => studentLink(row) },
      { label: '班排', render: (row) => row.classRank },
      { label: '校排', render: (row) => row.rank },
      { label: '平均', key: 'average' },
      { label: '成績', render: (row) => workbenchSubjectChips(row, options) }
    ]
    : [
      { label: '校排', render: (row) => row.rank },
      { label: '班級', render: (row) => classLink(row.className) },
      { label: '座號', key: 'seatNumber' },
      { label: '姓名', render: (row) => studentLink(row) },
      { label: '平均', key: 'average' },
      { label: '成績', render: (row) => workbenchSubjectChips(row, options) }
    ];

  return table(columns, rows, '目前沒有可顯示的排名資料。');
}

function workbenchSubjectChips(row, options = {}) {
  const subjects = options.mode === 'class'
    ? classSubjectChips(row)
    : state.subjectScope === 'nonExam'
    ? row.subjects.map((subject) => ({
      label: subject.name === '其他' ? '非考科' : subject.name,
      average: subject.average,
      pr: subject.pr
    }))
    : row.workbenchSubjects;

  return el('div', { class: 'subject-chips workbench-subject-chips' }, subjects.map((subject) =>
    el('span', {
      class: 'subject-chip',
      title: (subject.pr === null || subject.pr === undefined)
        ? `${subject.label ?? subject.name} 無資料`
        : `${subject.label ?? subject.name} PR ${formatPr(subject.pr)}`
    }, [`${subject.label ?? subject.name} ${formatNumber(subject.average)}`])
  ));
}

function classSubjectChips(row) {
  const subjects = row.subjects.map((subject) => ({
    label: subject.name,
    average: subject.average,
    pr: subject.pr
  }));
  if (!state.classSubjectScope || state.classSubjectScope === 'all') return subjects;
  return subjects.filter((subject) => subject.label === state.classSubjectScope);
}

function trendList(items, label) {
  if (!items.length) return el('div', { class: 'empty' }, [`目前沒有可顯示的${label}趨勢。`]);
  return el('div', { class: 'trend-list' }, items.map((item) =>
    el('article', { class: 'trend-card' }, [
      el('div', { class: 'trend-head' }, [
        el('strong', {}, [item.key]),
        item.change <= -5 ? tag('下降', 'risk') : item.change >= 5 ? tag('上升', 'good') : tag('持平', 'info')
      ]),
      el('div', { class: 'trend-stats' }, [
        el('span', {}, [`前期 ${formatNumber(item.first)}`]),
        el('span', {}, [`本期 ${formatNumber(item.last)}`]),
        el('span', {}, [`變化 ${formatNumber(item.change)}`])
      ])
    ])
  ));
}

function classSummaryList(classes) {
  if (!classes.length) return el('div', { class: 'empty' }, ['目前沒有可顯示的班級摘要。']);
  return el('div', { class: 'class-summary-list' }, classes.map((item) =>
    el('article', { class: 'class-summary-card' }, [
      el('div', { class: 'class-summary-head' }, [
        el('strong', {}, [item.key]),
        item.lowRatio >= 20 || item.standardDeviation >= 12 ? tag('需留意', 'warn') : tag('穩定', 'good')
      ]),
      el('div', { class: 'class-summary-stats' }, [
        statPair('平均', formatNumber(item.average)),
        statPair('標準差', formatNumber(item.standardDeviation)),
        statPair('低分比例', `${formatNumber(item.lowRatio)}%`)
      ])
    ])
  ));
}

function classWorkbenchSummary(item) {
  return el('section', { class: 'summary-strip summary-strip-integrated' }, [
    el('div', { class: 'summary-metrics' }, [
      summaryStat('班平均', formatNumber(item.average)),
      summaryStat('標準差', formatNumber(item.standardDeviation)),
      summaryStat('低分比例', `${formatNumber(item.lowRatio)}%`)
    ])
  ]);
}

function classWorkbenchTabs(classOptions, termOptions, subjectOptions, selectedClass, selectedTerm) {
  return el('div', { class: 'class-toolbar' }, [
    compactSelectField('班級', selectedClass, classOptions.map((className) => ({ label: className, value: className })), (value) => {
      state.className = value;
      render();
    }, 'compact-control-narrow'),
    compactSelectField('學期', selectedTerm, termOptions.map((termKey) => ({ label: termKey, value: termKey })), (value) => {
      state.termKey = value;
      render();
    }, 'compact-control-narrow'),
    compactSelectField('科目', state.classSubjectScope, subjectOptions.map((subjectName) => ({
      label: subjectName === 'all' ? '全部' : subjectName,
      value: subjectName
    })), (value) => {
      state.classSubjectScope = value;
      render();
    }, 'compact-control-subject')
  ]);
}

function classSummaryCards(item) {
  return el('div', { class: 'class-summary-cards' }, [
    summaryStatCard('班平均', formatNumber(item.average)),
    summaryStatCard('標準差', formatNumber(item.standardDeviation)),
    summaryStatCard('低分比例', `${formatNumber(item.lowRatio)}%`)
  ]);
}

function renderStudentDetail(model, studentNumber) {
  const student = model.students.find((item) => item.studentNumber === studentNumber);
  if (!student) {
    return el('div', { class: 'page' }, [
      el('div', { class: 'empty' }, ['找不到這位學生的資料。'])
    ]);
  }

  const termOptions = student.termSummaries.map((term) => term.key).sort();
  const selectedTerm = termOptions.includes(state.studentTermKey) ? state.studentTermKey : (termOptions[0] ?? '');
  if (selectedTerm && state.studentTermKey !== selectedTerm) state.studentTermKey = selectedTerm;

  const termBreakdown = selectedTerm ? buildStudentTermBreakdown(student, selectedTerm) : [];
  const schoolTotal = model.students.length;
  const classTotal = model.students.filter((item) => item.className === student.className).length;
  const weakSubjects = student.subjectBreakdown
    .filter((item) => item.subjectAverage !== null && item.subjectAverage < 70)
    .sort((a, b) => (a.subjectAverage ?? Infinity) - (b.subjectAverage ?? Infinity));

  return el('div', { class: 'page' }, [
    el('div', { class: 'grid student-overview-grid' }, [
      studentIdentityCard(student),
      metricCard('校排', `${student.rank ?? '-'}/${schoolTotal}`, '', student.rank !== null && student.rank <= Math.max(3, Math.ceil(schoolTotal * 0.1)) ? 'good' : ''),
      metricCard('班排', `${student.classRank ?? '-'}/${classTotal}`, '', student.classRank !== null && student.classRank <= Math.max(3, Math.ceil(classTotal * 0.2)) ? 'good' : ''),
      metricCard('平均', formatNumber(student.overallAverage), '', student.overallAverage !== null && student.overallAverage < 60 ? 'risk' : '')
    ]),
    section('學生資訊', '', [
      el('div', { class: 'panel-head panel-head-workbench student-info-head' }, [
        el('div', { class: 'student-info-title-row' }, [
          el('strong', {}, [`${student.className} 班 ${student.seatNumber} 號 ${student.studentName}`]),
          el('div', { class: 'student-info-actions' }, [
            jumpLink('查看同班', '#classes', () => navigateToClassView(student.className, selectedTerm)),
            jumpLink('回全校排名', '#rankings')
          ])
        ]),
        el('div', { class: 'student-info-tools' }, [
          termOptions.length
            ? segmentedControl(termOptions.map((termKey) => ({ label: termKey, value: termKey })), selectedTerm, (value) => {
              state.studentTermKey = value;
              render();
            })
            : el('div', {}, [])
        ])
      ]),
      table([
        { label: '科目', key: 'subjectName' },
        { label: '段考 1', key: 'exam1' },
        { label: '段考 2', key: 'exam2' },
        { label: '段考 3', key: 'exam3' },
        { label: '平時 1', key: 'daily1' },
        { label: '平時 2', key: 'daily2' },
        { label: '平時 3', key: 'daily3' },
        { label: '平均', key: 'subjectAverage' }
      ], termBreakdown, '目前沒有這個學期的成績資料。')
    ]),
    el('div', { class: 'grid cols-2' }, [
      section('弱科與追蹤訊號', '優先看平均偏低或需要補救的科目。', [
        weakSubjects.length
          ? studentWeakSubjectList(weakSubjects)
          : el('div', { class: 'empty' }, ['目前沒有需要特別標記的弱科。'])
      ]),
      section('學期變化', '觀察跨學期平均、段考與平時變化。', [
        student.termSummaries.length
          ? studentTermSummaryList(student.termSummaries)
          : el('div', { class: 'empty' }, ['目前沒有跨學期資料。'])
      ])
    ])
  ]);
}

function summaryStat(label, value) {
  return el('div', { class: 'summary-stat' }, [
    el('span', {}, [label]),
    el('strong', {}, [value])
  ]);
}

function summaryStatCard(label, value) {
  return el('article', { class: 'summary-stat-card' }, [
    el('span', {}, [label]),
    el('strong', {}, [value])
  ]);
}

function studentIdentityCard(student) {
  return el('article', { class: 'student-identity-card' }, [
    el('span', { class: 'student-identity-label' }, [String(student.className) + ' 班 ' + String(student.seatNumber) + ' 號']),
    el('strong', { class: 'student-identity-name' }, [student.studentName])
  ]);
}

function buildStudentTermBreakdown(student, termKey) {
  const termRecords = student.records.filter((record) => record.termKey === termKey);
  const prLookup = new Map(student.subjectBreakdown.map((item) => [item.subjectName, item.subjectPr]));

  return Object.entries(groupBy(termRecords, (record) => record.subjectName)).map(([subjectName, rows]) => ({
    subjectName,
    exam1: mean(rows.map((row) => row.exam1)),
    exam2: mean(rows.map((row) => row.exam2)),
    exam3: mean(rows.map((row) => row.exam3)),
    daily1: mean(rows.map((row) => row.daily1)),
    daily2: mean(rows.map((row) => row.daily2)),
    daily3: mean(rows.map((row) => row.daily3)),
    subjectAverage: mean(rows.map((row) => row.overallAverage)),
    subjectPr: prLookup.get(subjectName) ?? null
  })).sort((a, b) => sortStudentSubjectName(a.subjectName, b.subjectName));
}

function linkedMetricCard(label, value, note = '', tone = '', href = '#') {
  return el('a', { href, class: 'metric-link' }, [
    metricCard(label, value, note, tone)
  ]);
}

function jumpLink(label, href, onClick = null) {
  return el('a', {
    href,
    class: 'jump-link',
    onclick: onClick ? (event) => {
      event.preventDefault();
      onClick();
    } : null
  }, [label]);
}

function studentWeakSubjectList(subjects) {
  return el('div', { class: 'detail-list detail-list-dense' }, subjects.map((subject) =>
    el('article', { class: 'detail-card detail-card-dense' }, [
      el('div', { class: 'detail-card-head' }, [
        el('strong', {}, [subject.subjectName]),
        subject.subjectPr === null ? tag('無 PR', 'info') : prTag(subject.subjectPr)
      ]),
      el('div', { class: 'detail-card-stats' }, [
        statPair('平均', formatNumber(subject.subjectAverage)),
        statPair('訊號', subject.subjectAverage < 60 ? '需補救' : subject.subjectAverage < 70 ? '偏弱' : '觀察')
      ])
    ])
  ));
}

function studentTermSummaryList(terms) {
  return el('div', { class: 'detail-list detail-list-dense' }, terms.map((term) =>
    el('article', { class: 'detail-card detail-card-dense' }, [
      el('div', { class: 'detail-card-head' }, [
        el('strong', {}, [term.key])
      ]),
      el('div', { class: 'detail-card-stats detail-card-stats-3' }, [
        statPair('平均', formatNumber(term.average)),
        statPair('段考', formatNumber(term.regularAverage)),
        statPair('平時', formatNumber(term.dailyAverage))
      ])
    ])
  ));
}

function subjectClassComparisonList(rows) {
  return el('div', { class: 'detail-list' }, rows.map((row) =>
    el('article', { class: 'detail-card' }, [
      el('div', { class: 'detail-card-head' }, [
        el('strong', {}, [row.key]),
        row.lowRatio >= 20 || row.standardDeviation >= 12 ? tag('需留意', 'warn') : tag('穩定', 'good')
      ]),
      el('div', { class: 'detail-card-stats detail-card-stats-2' }, [
        statPair("平均", formatNumber(row.average)),
        statPair("標準差", formatNumber(row.standardDeviation)),
        statPair("低分比例", String(formatNumber(row.lowRatio)) + "%"),
        statPair("段平落差", formatNumber(row.gap))
      ])
    ])
  ));
}

function subjectPatternList(rows) {
  return el('div', { class: 'detail-list detail-list-compact' }, rows.map((row) =>
    el('article', { class: 'detail-card detail-card-compact' }, [
      el('div', { class: 'detail-card-head' }, [
        el('strong', {}, [row.label])
      ]),
      el('div', { class: 'detail-card-stats' }, [
        statPair('平均', formatNumber(row.average))
      ])
    ])
  ));
}

function alertClassList(rows) {
  return el('div', { class: 'detail-list' }, rows.map((row) =>
    el('article', { class: 'detail-card' }, [
      el('div', { class: 'detail-card-head' }, [
        el('strong', {}, [row.key]),
        tag('班級', 'warn')
      ]),
      el('p', { class: 'alert-reason' }, [row.reasons.join('；')]),
      el('div', { class: 'detail-card-stats detail-card-stats-2' }, [
        statPair('平均', formatNumber(row.average)),
        statPair('低分比例', String(formatNumber(row.lowRatio)) + "%"),
        statPair('標準差', formatNumber(row.standardDeviation)),
        statPair('建議', row.action)
      ])
    ])
  ));
}

function alertSubjectList(rows) {
  return el('div', { class: 'detail-list' }, rows.map((row) =>
    el('article', { class: 'detail-card' }, [
      el('div', { class: 'detail-card-head' }, [
        el('strong', {}, [row.key]),
        tag('科目', 'warn')
      ]),
      el('p', { class: 'alert-reason' }, [row.reasons.join('；')]),
      el('div', { class: 'detail-card-stats detail-card-stats-2' }, [
        statPair('平均', formatNumber(row.average)),
        statPair('標準差', formatNumber(row.standardDeviation)),
        statPair('低分比例', String(formatNumber(row.lowRatio)) + "%"),
        statPair('建議', row.action)
      ])
    ])
  ));
}

function alertPriorityList(rows) {
  return el('div', { class: 'detail-list' }, rows.map((row, index) =>
    el('article', { class: 'detail-card' }, [
      el('div', { class: 'detail-card-head' }, [
        el('strong', {}, [`${index + 1}. ${row.label}`]),
        tag(row.kind === 'class' ? '班級' : '科目', row.kind === 'class' ? 'warn' : 'risk')
      ]),
      el('p', { class: 'alert-reason' }, [row.reasons.join('；')]),
      el('div', { class: 'detail-card-stats' }, [
        statPair('先看', row.action)
      ])
    ])
  ));
}

function statPair(label, value) {
  return el('span', {}, [String(label) + ' ' + String(value)]);
}

function classLink(className, termKey = '') {
  return jumpLink(className, '#classes', () => navigateToClassView(className, termKey));
}

function studentLink(row) {
  return el('a', { href: '#student/' + encodeURIComponent(row.studentNumber), class: 'student-link' }, [row.studentName]);
}

function navigateToClassView(className, termKey = '') {
  state.className = className;
  state.classSubjectScope = 'all';
  if (termKey) state.termKey = termKey;
  location.hash = '#classes';
  render();
}

function buildFilteredStudents(records) {
  return Object.entries(groupBy(records, (record) => record.studentNumber)).map(([, studentRecords]) => {
    const first = studentRecords[0];
    const subjectAverages = summarize(studentRecords, 'subjectName');
    const termSummaries = summarize(studentRecords, 'termKey').sort((a, b) => a.key.localeCompare(b.key));
    const firstTerm = termSummaries[0]?.average ?? null;
    const lastTerm = termSummaries.at(-1)?.average ?? null;

    return {
      studentNumber: first.studentNumber,
      className: first.className,
      seatNumber: first.seatNumber,
      studentName: first.studentName,
      overallAverage: mean(studentRecords.map((record) => record.overallAverage)),
      lowSubjectCount: subjectAverages.filter((item) => item.average < 60).length,
      subjectAverages,
      termSummaries,
      change: firstTerm !== null && lastTerm !== null && termSummaries.length > 1 ? Math.round((lastTerm - firstTerm) * 100) / 100 : null,
      records: studentRecords
    };
  }).sort((a, b) => a.className.localeCompare(b.className) || a.seatNumber - b.seatNumber);
}

function summarize(records, key) {
  return Object.entries(groupBy(records, (record) => record[key] ?? '未分類')).map(([groupKey, items]) => ({
    key: groupKey,
    average: mean(items.map((item) => item.overallAverage)),
    regularAverage: mean(items.map((item) => item.regularAverage)),
    dailyAverage: mean(items.map((item) => item.dailyAverage)),
    lowRatio: percentage(items.filter((item) => item.isLow).length, items.length),
    standardDeviation: standardDeviationLocal(items.map((item) => item.overallAverage)),
    lowCount: items.filter((item) => item.isLow).length
  })).sort((a, b) => (b.average ?? -Infinity) - (a.average ?? -Infinity));
}

function scorePatternRows(records) {
  const slots = [
    { key: 'exam1', label: '段考 1' },
    { key: 'exam2', label: '段考 2' },
    { key: 'exam3', label: '段考 3' },
    { key: 'daily1', label: '平時 1' },
    { key: 'daily2', label: '平時 2' },
    { key: 'daily3', label: '平時 3' }
  ];
  return slots.map((slot) => {
    const values = records.map((record) => record[slot.key]).filter((value) => typeof value === 'number');
    return {
      label: slot.label,
      average: mean(values),
      count: values.length
    };
  });
}

function trendBy(records, key) {
  return Object.entries(groupBy(records, (record) => record[key])).map(([groupKey, items]) => {
    const terms = summarize(items, 'termKey').sort((a, b) => a.key.localeCompare(b.key));
    const first = terms[0]?.average ?? null;
    const last = terms.at(-1)?.average ?? null;
    return {
      key: groupKey,
      first,
      last,
      change: first !== null && last !== null && terms.length > 1 ? Math.round((last - first) * 100) / 100 : null
    };
  }).sort((a, b) => (a.change ?? 0) - (b.change ?? 0));
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

function thresholdLabel(rows, percentile) {
  if (!rows.length) return '-';
  const cutoff = 100 - percentile;
  const item = rows.find((row) => row.pr <= cutoff) ?? rows.at(-1);
  return formatNumber(item?.average);
}

function prTag(pr) {
  const rounded = formatPr(pr);
  if (rounded >= 75) return tag('PR ' + rounded, 'good');
  if (rounded < 25) return tag('PR ' + rounded, 'risk');
  return tag('PR ' + rounded, 'info');
}

function formatPr(value) {
  return Math.round(Number(value) || 0);
}

function sortedRankingRows(rows, sortKey) {
  const copy = rows.slice();
  const descending = ['average', 'pr'].includes(sortKey);
  return copy.sort((a, b) => {
    if (sortKey === 'className') return a.className.localeCompare(b.className) || a.seatNumber - b.seatNumber;
    const av = a[sortKey];
    const bv = b[sortKey];
    return descending ? (bv ?? -Infinity) - (av ?? -Infinity) : (av ?? Infinity) - (bv ?? Infinity);
  });
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

function percentage(part, total) {
  return total ? Math.round((part / total) * 10000) / 100 : 0;
}

function sortStudentSubjectName(a, b) {
  const ai = EXAM_SUBJECTS.indexOf(a);
  const bi = EXAM_SUBJECTS.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

function standardDeviationLocal(values) {
  const numeric = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (!numeric.length) return null;
  const average = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  return Math.round(Math.sqrt(numeric.reduce((sum, value) => sum + (value - average) ** 2, 0) / numeric.length) * 100) / 100;
}









