# 成績主管決策儀表板

這個專案是一個以 `grades_by_student.json` 為資料來源的多頁成績分析原型，主要服務對象是主管、導師與教學管理者。

## 目前內容

- `app/`
  - 前端靜態網站
- `grades_by_student.json`
  - 依學生整理後的成績資料
- `grades_raw.json`
  - 原始整理資料
- `7匯出評量成績-114-1.xls` / `7匯出評量成績-114-1.xlsx`
  - 原始匯出檔
- `docs/superpowers/`
  - 設計與實作規劃文件

## 本機測試

```bash
node --test app/tests/analytics.test.js
```

## 本機預覽

可用任意靜態伺服器從專案根目錄啟動，然後開啟：

- `/`
  - 會自動導向 `/app/`
- `/app/`
  - 儀表板主程式

## GitHub Pages 部署提醒

這個專案目前採前端直接讀取 `grades_by_student.json` 的方式。

如果你把網站部署成公開網址：

- 網站內容會公開
- `grades_by_student.json` 也會被瀏覽器直接下載
- 任何知道網址的人都可以查看這份資料

請只在你清楚了解風險時公開部署。
