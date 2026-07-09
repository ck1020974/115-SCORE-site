import {
  EXAM_SUBJECTS,
  buildDashboardModel,
  buildExecutiveWatchlists,
  buildRankingRows,
  mean
} from './analytics.js?v=20260709-workbench2';
import {
  distributionChart,
  el,
  formatNumber,
  insightList,
  metricCard,
  section,
  table,
  tag
} from './ui.js?v=20260709-workbench2';

const routes = [
  { id: 'overview', label: '主管總覽', title: '主管總覽', eyebrow: '先看全校風險，再決定今天要追哪裡' },
  { id: 'rankings', label: '全校排名', title: '全校排名', eyebrow: '提供導師與主管共用的全校比較基準' },
  { id: 'classes', label: '班級分析', title: '班級分析', eyebrow: '看班級平均、離散程度與班內名次' },
  { id: 'subjects', label: '科目分析', title: '科目分析', eyebrow: '聚焦單一科目，判讀班級差異與異常學生' },
  { id: 'students', label: '學生追蹤', title: '學生追蹤', eyebrow: '快速查一位學生，不把整頁做成報表牆' },
  { id: 'watchlist', label: '關注名單', title: '關注名單', eyebrow: '保留真正要處理的兩種名單' },
  { id: 'trends', label: '趨勢預警', title: '趨勢預警', eyebrow: '看變化是整體現象，還是集中在特定群體' },
  { id: 'permissions', label: '資料權限', title: '資料權限', eyebrow: '先把誰可以看什麼訂清楚' }
];

const state = {
  route: location.hash.replace('#', '') || 'overview',
  className: 'all',
  termKey: 'all',
  weighted: true,
  examOnly: true,
  rankingSort: 'rank',
  classSort: 'seatNumber',
  subjectFocus: '',
  studentQuery: '',
  model: null
};

const page = document.querySelector('#page');
const nav = document.querySelector('#nav');
const title = document.querySelector('#page-title');
const eyebrow = document.querySelector('#eyebrow');
const classFilter = document.querySelector('#class-filter');
const termFilter = document.querySelector('#term-filter');

init();

async function init() {
  renderNav();
  const response = await fetch('../grades_by_student.json');
  const data = await response.json();
  state.model = buildDashboardModel(data);
  state.subjectFocus = EXAM_SUBJECTS[0] ?? '';
  fillFilters();
  bindEvents();
  render();
}

function bindEvents() {
  window.addEventListener('hashchange', () => {
    state.route = location.hash.replace('#', '') || 'overview';
    render();
  });
  classFilter.addEventListener('change', () => {
    state.className = classFilter.value;
    render();
  });
  termFilter.addEventListener('change', () => {
    state.termKey = termFilter.value;
    render();
  });
}

function renderNav() {
  nav.replaceChildren(...routes.map((route) =>
    el('button', {
      class: route.id === state.route ? 'active' : '',
      onclick: () => {
        location.hash = route.id;
      }
    }, [route.label])
  ));
}

function fillFilters() {
  unique(state.model.records.map((record) => record.className)).sort().forEach((className) => {
    classFilter.append(el('option', { value: className }, [className]));
  });
  unique(state.model.records.map((record) => record.termKey)).sort().forEach((termKey) => {
    termFilter.append(el('option', { value: termKey }, [termKey]));
  });
}

function render() {
  renderNav();
  const route = routes.find((item) => item.id === state.route) ?? routes[0];
  title.textContent = route.title;
  eyebrow.textContent = route.eyebrow;
  const model = filteredModel();
  const renderer = {
    overview: renderOverview,
    rankings: renderRankings,
    classes: renderClasses,
    subjects: renderSubjects,
    students: renderStudents,
    watchlist: renderWatchlist,
    trends: renderTrends,
    permissions: renderPermissions
  }[route.id];
  page.replaceChildren(renderer(model));
}

function filteredModel() {
  const records = state.model.records.filter((record) =>
    (state.className === 'all' || record.className === state.className) &&
    (state.termKey === 'all' || record.termKey === state.termKey)
  );
  const students = buildStudentSummaries(records);
  const classes = summarize(records, 'className');
  const subjects = summarize(records, 'subjectName');
  const terms = summarize(records, 'termKey');

  return {
    ...state.model,
    records,
    students,
    classes,
    subjects,
    terms
  };
}

function renderOverview(model) {
  const lowStudents = model.students.filter((student) => student.lowSubjectCount > 0);
  const riskClasses = model.classes.filter((item) => item.average < 70 || item.lowRatio >= 20);
  const riskSubjects = model.subjects.filter((item) => EXAM_SUBJECTS.includes(item.key) && (item.average < 70 || item.standardDeviation >= 15));

  return el('div', { class: 'page' }, [
    el('div', { class: 'metrics metrics-compact' }, [
      metricCard('全校平均', formatNumber(mean(model.records.map((record) => record.overallAverage))), '目前範圍內成績概況', 'good'),
      metricCard('低成就學生', lowStudents.length, '至少一科低於 60 分', 'risk'),
      metricCard('需留意項目', riskClasses.length + riskSubjects.length, '班級與科目合計', 'warn')
    ]),
    el('div', { class: 'grid cols-2' }, [
      section('分數分布', '先用分布看整體成績落點。', [
        distributionChart(distribution(model.records.filter((record) => record.isExamSubject)))
      ]),
      section('管理提醒', '首頁只保留會影響決策的三個訊號。', [
        insightList([
          {
            title: '班級',
            body: riskClasses[0]
              ? `${riskClasses[0].key} 低分比例 ${formatNumber(riskClasses[0].lowRatio)}%，建議先看班內弱科與評量落差。`
              : '目前沒有明顯偏弱班級。'
          },
          {
            title: '科目',
            body: riskSubjects[0]
              ? `${riskSubjects[0].key} 平均 ${formatNumber(riskSubjects[0].average)}、標準差 ${formatNumber(riskSubjects[0].standardDeviation)}，值得回頭看教學與評量。`
              : '目前考科表現沒有明顯異常。'
          },
          {
            title: '學生',
            body: `${lowStudents.length} 位學生已有低分訊號，可從關注名單進一步分流處理。`,
            tone: lowStudents.length ? 'risk' : 'good'
          }
        ])
      ])
    ])
  ]);
}

function renderRankings(model) {
  const rows = sortedRankingRows(buildRankingRows(model.records, {
    weighted: state.weighted,
    examOnly: state.examOnly
  }), state.rankingSort);

  return el('div', { class: 'page' }, [
    section('排名設定', '校排名與 PR 本質相近，因此保留一組排序邏輯就好。', [
      rankingControls('ranking')
    ]),
    el('div', { class: 'metrics metrics-compact' }, [
      metricCard('排名人數', rows.length, '依目前篩選結果'),
      metricCard('PR 25 門檻', thresholdLabel(rows, 25), '作為整體偏低參考'),
      metricCard('PR < 25', rows.filter((row) => row.pr < 25).length, '可納入預防性關注')
    ]),
    section('全校成績表', '主表先顯示科目成績，滑鼠懸停再看各科 PR。', [
      rankingTable(rows.slice(0, 80), { showClass: true })
    ])
  ]);
}

function renderClasses(model) {
  const selectedClass = state.className === 'all' ? model.classes[0]?.key : state.className;
  const rankingRows = buildRankingRows(model.records, { weighted: state.weighted, examOnly: state.examOnly });
  const rows = sortedRankingRows(rankingRows.filter((row) => row.className === selectedClass), state.classSort);

  return el('div', { class: 'page' }, [
    el('div', { class: 'grid cols-2' }, [
      section('班級摘要', '把標準差直接放在摘要中，主管一眼就能看出平均高但落差大的班。', [
        classSummaryList(model.classes)
      ]),
      section('管理提醒', '優先看低分比例高或標準差大的班級。', [
        insightList(model.classes.slice(0, 3).map((item) => ({
          title: item.key,
          body: `平均 ${formatNumber(item.average)}，標準差 ${formatNumber(item.standardDeviation)}，低分比例 ${formatNumber(item.lowRatio)}%。`,
          tone: item.lowRatio >= 20 || item.standardDeviation >= 12 ? 'warn' : 'info'
        })))
      ])
    ]),
    section(`${selectedClass ?? ''} 班內成績`, '班內清單可按座號或名次看，適合導師快速點名。', [
      rankingControls('class'),
      rows.length
        ? rankingTable(rows, { showClass: false })
        : el('div', { class: 'empty' }, ['目前沒有可顯示的班級資料。'])
    ])
  ]);
}

function renderSubjects(model) {
  const subjectOptions = model.subjects.map((item) => item.key).filter((name) => EXAM_SUBJECTS.includes(name));
  if (!subjectOptions.includes(state.subjectFocus)) state.subjectFocus = subjectOptions[0] ?? '';

  const subjectRows = model.records.filter((record) => record.subjectName === state.subjectFocus);
  const classRows = summarize(subjectRows, 'className')
    .map((item) => ({
      ...item,
      gap: Math.abs((item.regularAverage ?? 0) - (item.dailyAverage ?? 0))
    }))
    .sort((a, b) => a.average - b.average);
  const studentRows = subjectRows
    .filter((record) => record.overallAverage < 60 || record.hasAssessmentGap)
    .sort((a, b) => a.overallAverage - b.overallAverage)
    .slice(0, 12);
  const summary = model.subjects.find((item) => item.key === state.subjectFocus);

  return el('div', { class: 'page' }, [
    section('科目選擇', '一次只回答一個問題，這一科目前哪裡最需要處理。', [
      labelledSelect('科目', state.subjectFocus, subjectOptions.map((name) => ({ label: name, value: name })), (value) => {
        state.subjectFocus = value;
        render();
      })
    ]),
    el('div', { class: 'metrics metrics-compact' }, [
      metricCard('科目平均', formatNumber(summary?.average), state.subjectFocus),
      metricCard('低分比例', `${formatNumber(summary?.lowRatio)}%`, '低於 60 分'),
      metricCard('標準差', formatNumber(summary?.standardDeviation), '判斷是否分化過大', summary?.standardDeviation >= 15 ? 'warn' : 'good')
    ]),
    section('班級比較', '先看哪幾班在同一科差最多。', [
      table([
        { label: '班級', key: 'key' },
        { label: '平均', key: 'average' },
        { label: '標準差', key: 'standardDeviation' },
        { label: '低分比例', render: (row) => `${formatNumber(row.lowRatio)}%` },
        { label: '評量落差', render: (row) => formatNumber(row.gap) }
      ], classRows)
    ]),
    section('需先注意的學生', '只保留低分或評量落差明顯的學生。', [
      table([
        { label: '班級', key: 'className' },
        { label: '座號', key: 'seatNumber' },
        { label: '姓名', key: 'studentName' },
        { label: '科目成績', key: 'overallAverage' },
        { label: '定期', key: 'regularAverage' },
        { label: '平時', key: 'dailyAverage' },
        { label: '註記', render: (row) => row.overallAverage < 60 ? tag('低分', 'risk') : tag('評量落差', 'warn') }
      ], studentRows)
    ])
  ]);
}

function renderStudents(model) {
  const wrapper = el('div', { class: 'page' });
  const input = el('input', {
    type: 'search',
    value: state.studentQuery,
    placeholder: '輸入姓名、學號、班級或座號'
  });
  const resultRoot = el('div', { class: 'page' });
  const rankingRows = buildRankingRows(model.records, { weighted: state.weighted, examOnly: state.examOnly });

  const draw = () => {
    const keyword = state.studentQuery.trim().toLowerCase();
    if (!keyword) {
      resultRoot.replaceChildren(section('查詢結果', '先輸入一位學生，再看他的關鍵訊號。', [
        el('div', { class: 'empty' }, ['請先輸入姓名、學號、班級或座號。'])
      ]));
      return;
    }

    const matches = model.students.filter((student) =>
      [student.studentName, student.studentNumber, student.className, student.seatNumber].join(' ').toLowerCase().includes(keyword)
    );
    const student = matches[0];

    if (!student) {
      resultRoot.replaceChildren(el('div', { class: 'empty' }, ['找不到符合條件的學生。']));
      return;
    }

    const rankingRow = rankingRows.find((row) => row.studentNumber === student.studentNumber);
    const weakSubjects = student.subjectAverages.slice().sort((a, b) => a.average - b.average).slice(0, 4);
    const signals = [];
    if (student.lowSubjectCount >= 2) signals.push(tag('多科不及格', 'risk'));
    if ((rankingRow?.pr ?? 99) < 25) signals.push(tag('整體偏低', 'warn'));
    if (student.change !== null && student.change <= -5) signals.push(tag('明顯退步', 'warn'));

    resultRoot.replaceChildren(
      el('div', { class: 'metrics metrics-compact' }, [
        metricCard('全校排名', rankingRow ? `#${rankingRow.rank}` : '-', student.studentName),
        metricCard('班排名', rankingRow ? `#${rankingRow.classRank}` : '-', `${student.className} 班`),
        metricCard('PR', rankingRow ? formatPr(rankingRow.pr) : '-', signals.length ? '已出現風險訊號' : '目前表現穩定')
      ]),
      section('弱科概況', '先看最低的幾科，避免資訊太散。', [
        table([
          { label: '科目', key: 'key' },
          { label: '平均', key: 'average' },
          { label: '狀態', render: (row) => row.average < 60 ? tag('低分', 'risk') : row.average < 70 ? tag('偏弱', 'warn') : tag('穩定', 'good') }
        ], weakSubjects)
      ]),
      section('追蹤訊號', '這裡只保留能決定下一步處理方式的資訊。', [
        signals.length ? el('div', { class: 'toolbar' }, signals) : el('div', { class: 'empty' }, ['目前沒有明顯風險訊號。'])
      ]),
      matches.length > 1
        ? section('其他符合結果', '有同名或相似查詢時，再從這裡挑選。', [
          table([
            { label: '班級', key: 'className' },
            { label: '座號', key: 'seatNumber' },
            { label: '姓名', key: 'studentName' },
            { label: '學號', key: 'studentNumber' }
          ], matches.slice(1, 6))
        ])
        : el('div')
    );
  };

  input.addEventListener('input', () => {
    state.studentQuery = input.value;
    draw();
  });

  wrapper.append(
    section('學生查詢', '維持工作台型態，不在這頁塞整批名單。', [
      el('div', { class: 'toolbar' }, [input])
    ]),
    resultRoot
  );

  draw();
  return wrapper;
}

function renderWatchlist(model) {
  const rankingRows = buildRankingRows(model.records, { weighted: state.weighted, examOnly: state.examOnly });
  const watchlists = buildExecutiveWatchlists(model.students, rankingRows, { prThreshold: 25 });

  return el('div', { class: 'page' }, [
    section('多科不及格', '先處理學習負擔已經很重的學生。', [
      table([
        { label: '班級', key: 'className' },
        { label: '座號', key: 'seatNumber' },
        { label: '姓名', key: 'studentName' },
        { label: '平均', key: 'overallAverage' },
        { label: 'PR', render: (row) => {
          const rankingRow = rankingRows.find((item) => item.studentNumber === row.studentNumber);
          return rankingRow ? prTag(rankingRow.pr) : '-';
        } },
        { label: '不及格科數', key: 'lowSubjectCount' }
      ], watchlists.multiFailing.slice(0, 20))
    ]),
    section('整體成績偏低', '排除多科不及格後，留下容易被忽略的整體偏低學生。', [
      table([
        { label: '班級', key: 'className' },
        { label: '座號', key: 'seatNumber' },
        { label: '姓名', key: 'studentName' },
        { label: 'PR', render: (row) => prTag(row.pr) },
        { label: '平均', key: 'average' },
        { label: '不及格科數', key: 'lowSubjectCount' }
      ], watchlists.lowOverall.slice(0, 20))
    ])
  ]);
}

function renderTrends(model) {
  const classTrend = trendBy(model.records, 'className');
  const subjectTrend = trendBy(model.records, 'subjectName').filter((item) => EXAM_SUBJECTS.includes(item.key));
  const classDrop = classTrend.filter((item) => (item.change ?? 0) < 0).sort((a, b) => a.change - b.change)[0];
  const subjectDrop = subjectTrend.filter((item) => (item.change ?? 0) < 0).sort((a, b) => a.change - b.change)[0];

  return el('div', { class: 'page' }, [
    section('本期預警', '先用兩個重點告訴主管問題集中在哪裡。', [
      insightList([
        {
          title: '班級變化',
          body: classDrop
            ? `${classDrop.key} 下降 ${formatNumber(classDrop.change)} 分，建議優先回頭看班級內哪些科目一起下滑。`
            : '目前沒有顯著下滑的班級。',
          tone: classDrop ? 'warn' : 'good'
        },
        {
          title: '科目變化',
          body: subjectDrop
            ? `${subjectDrop.key} 下降 ${formatNumber(subjectDrop.change)} 分，建議比對授課班級與本次評量內容。`
            : '目前沒有顯著下滑的考科。',
          tone: subjectDrop ? 'warn' : 'good'
        }
      ])
    ]),
    el('div', { class: 'grid cols-2' }, [
      section('班級趨勢', '不使用橫向滑動，改成可直接掃視的卡片列表。', [
        trendList(classTrend.slice(0, 6), '班級')
      ]),
      section('科目趨勢', '只看考科，避免非考科稀釋訊號。', [
        trendList(subjectTrend.slice(0, 6), '科目')
      ])
    ])
  ]);
}

function renderPermissions(model) {
  return el('div', { class: 'page' }, [
    section('角色權限', '先用簡單表格確認資料邊界。', [
      table([
        { label: '角色', key: 'role' },
        { label: '可查看範圍', key: 'scope' },
        { label: '顯示細節', key: 'detail' }
      ], model.permissions)
    ])
  ]);
}

function rankingControls(mode) {
  return el('div', { class: 'field-row' }, [
    labelledSelect('範圍', state.examOnly ? 'exam' : 'all', [
      { label: '考科', value: 'exam' },
      { label: '全部科目', value: 'all' }
    ], (value) => {
      state.examOnly = value === 'exam';
      render();
    }),
    labelledSelect('計算方式', state.weighted ? 'weighted' : 'plain', [
      { label: '加權', value: 'weighted' },
      { label: '不加權', value: 'plain' }
    ], (value) => {
      state.weighted = value === 'weighted';
      render();
    }),
    labelledSelect('排序', mode === 'class' ? state.classSort : state.rankingSort, rankingSortOptions(mode), (value) => {
      if (mode === 'class') state.classSort = value;
      else state.rankingSort = value;
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

function rankingSortOptions(mode) {
  return mode === 'class'
    ? [
      { label: '座號', value: 'seatNumber' },
      { label: '班排名', value: 'classRank' },
      { label: '全校排名', value: 'rank' }
    ]
    : [
      { label: '全校排名', value: 'rank' },
      { label: '平均', value: 'average' },
      { label: '班級', value: 'className' }
    ];
}

function rankingTable(rows, options = {}) {
  return table([
    { label: '全校排名', render: (row) => `#${row.rank}` },
    { label: 'PR', render: (row) => prTag(row.pr) },
    ...(options.showClass ? [{ label: '班級', key: 'className' }] : []),
    { label: '座號', key: 'seatNumber' },
    { label: '姓名', key: 'studentName' },
    { label: '班排名', render: (row) => `#${row.classRank}` },
    { label: '平均', key: 'average' },
    { label: '科目成績', render: (row) => subjectChips(row.subjects) }
  ], rows, '目前沒有可顯示的排名資料。');
}

function subjectChips(subjects) {
  return el('div', { class: 'subject-chips' }, subjects
    .filter((subject) => subject.name !== '其他')
    .map((subject) => el('span', {
      class: 'subject-chip',
      title: `${subject.name} PR ${formatPr(subject.pr)}`
    }, [`${subject.name} ${formatNumber(subject.average)}`])));
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

function statPair(label, value) {
  return el('span', {}, [`${label} ${value}`]);
}

function buildStudentSummaries(records) {
  return Object.values(groupBy(records, (record) => record.studentNumber)).map((studentRecords) => {
    const first = studentRecords[0];
    const subjectAverages = summarize(studentRecords, 'subjectName');
    const termSummaries = summarize(studentRecords, 'termKey').sort((a, b) => a.key.localeCompare(b.key));
    const firstTerm = termSummaries[0]?.average ?? null;
    const lastTerm = termSummaries.at(-1)?.average ?? null;
    const change = firstTerm !== null && lastTerm !== null && termSummaries.length > 1
      ? Math.round((lastTerm - firstTerm) * 100) / 100
      : null;

    return {
      studentNumber: first.studentNumber,
      className: first.className,
      seatNumber: first.seatNumber,
      studentName: first.studentName,
      overallAverage: mean(studentRecords.map((record) => record.overallAverage)),
      lowSubjectCount: subjectAverages.filter((item) => item.average < 60).length,
      subjectAverages,
      termSummaries,
      change,
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
    standardDeviation: standardDeviationLocal(items.map((item) => item.overallAverage))
  })).sort((a, b) => (b.average ?? -Infinity) - (a.average ?? -Infinity));
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
  if (rounded >= 75) return tag(`PR ${rounded}`, 'good');
  if (rounded < 25) return tag(`PR ${rounded}`, 'risk');
  return tag(`PR ${rounded}`, 'info');
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

function standardDeviationLocal(values) {
  const numeric = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (!numeric.length) return null;
  const average = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  return Math.round(Math.sqrt(numeric.reduce((sum, value) => sum + (value - average) ** 2, 0) / numeric.length) * 100) / 100;
}
