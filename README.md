# 成績資料輸出說明

## 檔案

- `grades_raw.json`
  - 保留 Excel 原始逐列資料
  - 適合做除錯、比對原始內容

- `grades_by_student.json`
  - 已整理成網頁比較好用的階層
  - 結構為：`學生 -> academicRecords -> subjects -> regularAssessments / dailyScores`

## `grades_by_student.json` 主要結構

```json
{
  "metadata": {
    "sourceFile": "7匯出評量成績-114-1.xlsx",
    "rowCount": 7366,
    "studentCount": 148
  },
  "students": [
    {
      "studentSystemId": 2659,
      "studentNumber": "LJ14089",
      "className": "701",
      "seatNumber": 1,
      "name": "林炤玹",
      "academicRecords": [
        {
          "schoolYear": 114,
          "semester": 1,
          "subjects": [
            {
              "courseName": "國文:701",
              "domain": "語文",
              "subjectName": "國文Chinese",
              "regularAssessments": [
                { "name": "第一次評量", "score": 77 }
              ],
              "dailyScores": [
                { "name": "1st平時", "score": 85 }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## 建議前端用法

- 學生列表頁：讀 `students`
- 學生詳細頁：用 `studentSystemId` 或 `studentNumber` 找學生
- 學期切換：讀 `academicRecords`
- 各科成績卡片：讀 `subjects`
- 定期評量圖表：讀 `regularAssessments`
- 平時成績圖表：讀 `dailyScores`
