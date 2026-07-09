export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  });
  children.forEach((child) => node.append(child?.nodeType ? child : document.createTextNode(String(child))));
  return node;
}

export function metricCard(label, value, note = '', tone = '') {
  return el('article', { class: `metric ${tone}`.trim() }, [
    el('span', {}, [label]),
    el('strong', {}, [value ?? '-']),
    el('small', {}, [note])
  ]);
}

export function section(title, subtitle, children = []) {
  return el('section', { class: 'panel' }, [
    el('div', { class: 'panel-head' }, [
      el('div', {}, [
        el('h2', {}, [title]),
        subtitle ? el('p', {}, [subtitle]) : el('span')
      ])
    ]),
    ...children
  ]);
}

export function table(columns, rows, empty = '目前沒有資料。') {
  if (!rows.length) return el('div', { class: 'empty' }, [empty]);
  return el('div', { class: 'table-wrap' }, [
    el('table', {}, [
      el('thead', {}, [
        el('tr', {}, columns.map((column) => el('th', {}, [column.label])))
      ]),
      el('tbody', {}, rows.map((row) =>
        el('tr', {}, columns.map((column) =>
          el('td', {}, [formatCell(column.render ? column.render(row) : row[column.key])])
        ))
      ))
    ])
  ]);
}

export function distributionChart(items) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return el('div', { class: 'distribution' }, items.map((item) =>
    el('div', { class: 'distribution-item' }, [
      el('div', { class: 'dist-bar', style: `height:${Math.max(8, (item.count / max) * 120)}px` }),
      el('strong', {}, [item.count]),
      el('span', {}, [item.label])
    ])
  ));
}

export function tag(text, tone = 'neutral') {
  return el('span', { class: `tag ${tone}`.trim() }, [text]);
}

export function insightList(items) {
  return el('div', { class: 'insights' }, items.map((item) =>
    el('article', { class: `insight ${item.tone ?? ''}`.trim() }, [
      el('strong', {}, [item.title]),
      el('p', {}, [item.body])
    ])
  ));
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1);
}

function formatCell(value) {
  if (value?.nodeType) return value;
  if (typeof value === 'number') return formatNumber(value);
  return value ?? '-';
}
