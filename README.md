# 115-SCORE-site

這是成績主管決策儀表板的公開站版本。

## 內容

- `index.html`
  - 站台入口，會導向 `app/`
- `app/`
  - 儀表板前端程式
- `grades_by_student.json`
  - 網站直接讀取的成績資料

## GitHub Pages

這個 repo 適合直接用 GitHub Pages 從 `main` branch 的 root 發佈。

發布後預期網址會是：

`https://ck1020974.github.io/115-SCORE-site/`

## 風險提醒

這個 repo 內含真實成績資料，且網站會直接把 `grades_by_student.json` 提供給瀏覽器。

也就是說：

- 網站公開，資料就可被下載
- 任何知道網址的人都能取得這份資料

請只在你已接受這個風險時使用。
