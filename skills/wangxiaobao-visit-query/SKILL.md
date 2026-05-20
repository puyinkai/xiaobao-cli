---
name: wangxiaobao-visit-query
description: |
  旺小宝来访分页查询 skill：按 **客户 ID / 客户姓名 / 来访时间** 分页查
  来访记录（含接待顾问 / **录音列表 audios** / 盘客状态 / 话术命中等）。
  **只读、不写文件、无副作用**。对应 `xiaobao_list_visits` tool。
  排序固定 visit_time DESC。每条 visit 已直接带录音列表，问"这次来访打了
  几条录音 / 录音多长"时**不必再调** `xiaobao_list_audio`。

  **当以下情况时使用此 Skill**:
  (1) 用户问"今天到访"、"本周来访列表"、"最近来访"
  (2) 用户问"李女士最近几次来访"——**先调 `xiaobao_list_customers` 反查
      customerId（wang_id），再调本 skill 带 customerId 精确过滤**（更准）
  (3) 用户问"上周哪些客户来访"——`fromDate` / `toDate` 时间窗
  (4) 用户问"姓张的客户什么时候来过"——`customerName` 模糊（后端 JOIN 客户表）
  (5) 用户问"某次到访打了几条录音 / 录音多长 / 录音 fileUrl"——看
      `audioCount` + `audios[]`（直接包含录音元数据 + 签名 URL）；
      "盘客完成没"——看 `isPankeCompleted` / `pankeStatus`
  (6) 任何"看到访名单 / 接待记录 / 话术命中"的开放式查询

  **不要用本 skill 的场景**：
  - 用户要的是客户**画像** / 标签 → 走 `wangxiaobao-customer-query`
  - 用户问录音元数据 / 文本 → 走 `wangxiaobao-audio-query`
---

> **Host-agnostic CLI skill** — 本 skill 假设 `xiaobao-cli` 已装到 PATH
> (`npm i -g @puyinkai/xiaobao-cli` 或 `npx -y @puyinkai/xiaobao-cli`)。
> Agent 通过 shell 工具（Bash / Run / Shell）执行命令、读 **stdout JSON** 消费；
> stderr 是进度/错误提示。退出码 0 = 成功，非 0 = 业务/网络错（错误对象同时打到 stdout 可解析）。
>
> CLI 14 个子命令跟 openclaw-xiaobao plugin 14 个 tool **1:1 等价**，返回 JSON
> 结构完全一致（`{status, ok, data: {...}}`）。skill 里看到的 `resp.data.data.xxx`
> 取数路径直接对 stdout JSON 用 `jq` / `JSON.parse` 即可。
>
> **plugin tool → CLI 命令翻译表（数组参数走逗号分隔）**：
>
> | plugin tool | CLI 命令 |
> | --- | --- |
> | `xiaobao_authorize { force? }` | `xiaobao-cli auth login [--force]` |
> | `xiaobao_whoami` | `xiaobao-cli auth whoami` |
> | `xiaobao_logout` | `xiaobao-cli auth logout` |
> | `xiaobao_list_projects { keyword? }` | `xiaobao-cli project list [--keyword <kw>]` |
> | `xiaobao_switch_project { tenantId, tenantName, projectId, projectName }` | `xiaobao-cli project use --tenant-id ... --tenant-name ... --project-id ... --project-name ...` |
> | `xiaobao_list_consultants` | `xiaobao-cli consultant list` |
> | `xiaobao_list_audio { fromDate, toDate, userId?, userIdList?, page, size }` | `xiaobao-cli audio list --from "..." --to "..." [--user-id ...] [--user-id-list a,b,c] [--page N] [--size N]` |
> | `xiaobao_get_audio_text { audioId }` | `xiaobao-cli audio text <audioId>` |
> | `xiaobao_list_customers { ... }` | `xiaobao-cli customer list [--user-id] [--user-name] [--customer-name] [--customer-phone] [--portrait] [--from] [--to] [--page] [--size]` |
> | `xiaobao_list_visits { ... }` | `xiaobao-cli visit list [--customer-id] [--customer-name] [--from] [--to] [--page] [--size]` |
> | `xiaobao_list_customer_focus { visitIds, customerIds, audioIds, category, classification, fromDate, toDate, ... }` | `xiaobao-cli focus list [--visit-ids a,b] [--customer-ids a,b] [--audio-ids a,b] [--category ...] [--classification ...] [--from ...] [--to ...]` |
> | `xiaobao_list_customer_resistance { ... }` | `xiaobao-cli resistance list [同 focus]` |
> | `xiaobao_quick_qa { prompt, threadId? }` | `xiaobao-cli qa "<prompt>" [--thread-id ...]` |
> | `xiaobao_api { method, path, query, body, headers }` | `xiaobao-cli api <METHOD> <PATH> [--query k=v] [--body '<json>'] [--headers k=v]` |
>
> 用 `--format toon` 切到 TOON（uniform 数组省 30-50% token，LLM 上下文优化）；
> 用 `--format json`（默认）保持 JSON。state 路径：`~/.xiaobao/`（fallback 读 `~/.openclaw/state/wangxiaobao/`）。


# 旺小宝来访分页查询

调 `xiaobao_list_visits` tool 查当前激活项目的来访记录。

## 执行前必读

- 必须有有效 token：先调 `xiaobao_whoami`；未登录就 `xiaobao_authorize`
- **必须有激活项目**：tool 内部自动读，缺失返回 `NO_ACTIVE_PROJECT`
- **数据权限隔离**：跟客户接口一样，按当前用户授权可见顾问范围过滤
- LocalDateTime 格式：`yyyy-MM-dd HH:mm:ss`（空格分隔），plugin 自动转
- **不要**写文件、出报告

---

## 快速索引：意图 → 工具

| 用户意图                       | plugin tool             | 关键参数                                |
| ------------------------------ | ----------------------- | --------------------------------------- |
| 列时间窗内的全部来访           | `xiaobao_list_visits`   | `fromDate` / `toDate`                   |
| 看某客户的来访历史             | `xiaobao_list_customers` → `xiaobao_list_visits` | `customerId: <反查的 wang_id>` |
| 按客户名字模糊找来访           | `xiaobao_list_visits`   | `customerName: "张"`                    |
| **看某次来访的录音详情**       | `xiaobao_list_visits`   | 直接读返回里的 `audios[]`（含 fileUrl） |
| 估算总数                       | `xiaobao_list_visits`   | `page: 1, size: 1`，只读 `total`        |

---

## 核心约束

### 1. 客户名 vs 客户 ID —— 优先 ID，更准更快

用户说"李女士最近几次来访"——**优先**走两步：

1. 调 `xiaobao_list_customers { customerName: "李女士" }` 反查到 `customerId`
2. 调 `xiaobao_list_visits { customerId: <wang_id> }` 拿来访历史

直接传 `customerName` 也能用（后端 JOIN customer_profile 模糊匹配），但：
- 同名客户可能有多个（重名 "李女士"），结果混在一起不好辨认
- JOIN 慢于纯 visit 表查询

### 2. 时间窗：用户没明确说就推断

| 用户说法     | fromDate / toDate                                |
| ------------ | ------------------------------------------------ |
| "今天到访"   | 今天 00:00:00 / 明天 00:00:00                    |
| "本周来访"   | 周一 00:00:00 / 今天 23:59:59                    |
| "上周末"     | 上周六 00:00:00 / 本周一 00:00:00                |
| "5 月份"     | 2026-05-01 00:00:00 / 2026-06-01 00:00:00        |
| "最近 3 次"  | 不传时间窗，只看 `content[]` 前 3 条             |

### 3. 分页：page 从 **1** 开始；size 上限 500

跟其他接口一样。

### 4. 响应字段重点

```jsonc
{
  "code": "0",
  "data": {
    "page": 1, "size": 10, "total": 23,
    "content": [
      {
        "visitId":   "...",
        "customerId": "1685535452481236993",      // = wang_id，可传回 customers 查
        "visitTime": "2023-07-30 14:01:03",
        "visitCount": 1,                           // 第几次到访
        "visitTimer": 1439184,                     // 来访总秒数
        "audioCount": 3,                           // 关联录音条数（= audios.length）
        "audios": [                                // ★ 录音详情列表，按 startTime 升序
          {
            "audioId":   9001,
            "fileId":    "abc",
            "startTime": "2023-07-30 14:01:15",
            "endTime":   "2023-07-30 14:08:42",
            "duration":  447,                      // 秒
            "fileSize":  3145728,
            "hasValid":  1,                        // 0 无效 / 1 有效
            "status":    4,                        // 0 转存中/1 转文本/2 待分析/3 分析中/4 完成
            "userId":    270078834689187840,
            "fileUrl":   "https://oss.../abc?sign=..."  // 18000 秒过期
          }
        ],
        "userId": 270078834689187840,
        "userName": "兰鸿建",                       // 实际接待顾问
        "belongUserId":   ...,
        "belongUserName": "兰鸿建",                // 客户归属顾问（可能跟接待不同）
        "userInfo": { /* 顾问详情 */ },
        "pankeStatus": "已完成",                    // 盘客状态
        "isPankeCompleted": 1,
        "requireSpeechTotal": 8, "requireSpeechHit": 5,
        "salesSpeechTotal":   12, "salesSpeechHit": 9
      }
    ]
  }
}
```

plugin tool 又外包一层 → `resp.data.data.content`。

`requireSpeechHitDetail` / `salesSpeechHitDetail` 是 JSON 文本，**默认不展示给用户**
（除非用户明确问"具体哪条话术命中了"）。

### 5. 接待 vs 归属：解释差异

- `userId / userName` = **实际接待**（这次来访是谁陪同的）
- `belongUserId / belongUserName` = **客户归属**（客户档案里登记的归属销售）

正常情况两者一致；不一致时可能是：
- 销售 A 不在岗，同事 B 帮忙接待 A 的客户
- 客户重新分配过

用户问"张三接待了几个"——按 `userId == 张三`；问"张三名下客户来访"——按 `belongUserId == 张三`
（**但本 tool 当前不支持按 belongUserId 过滤**，需先用 customers 反查再 customerId 过滤）。

---

## 使用场景示例

### 场景 1：今天到访列表

```jsonc
{ "fromDate": "2026-05-13 00:00:00", "toDate": "2026-05-14 00:00:00" }
```

渲染：

```
今天共 18 次到访（按时间倒序）:
1. 屈哥 · 14:01 · 接待:兰鸿建 · 第 1 次 · 12 分 · 录音 3
2. 曹女士 · 13:45 · 接待:陈平 · 第 2 次 · 25 分 · 录音 2
...
```

### 场景 2：李女士最近 3 次来访

```jsonc
// step 1: 反查 wang_id
// xiaobao_list_customers
{ "customerName": "李女士", "size": 20 }

// step 2: 假设找到 customerId = 270072120829026305
// xiaobao_list_visits
{ "customerId": "270072120829026305", "page": 1, "size": 3 }
```

### 场景 3：上周末来访高峰

```jsonc
{ "fromDate": "2026-05-10 00:00:00", "toDate": "2026-05-12 00:00:00", "page": 1, "size": 50 }
```

后处理：按 hour 聚合 → 报告"周日下午 14-16 点是峰值"。

### 场景 4：用客户名直接模糊

```jsonc
// 不知道具体客户 ID，先用名字模糊
{ "customerName": "张", "fromDate": "2026-05-01 00:00:00", "size": 20 }
```

回复："姓张的客户 5 月来访共 8 次，分布在 3 位客户：张先生(133****0692) 来 3 次..."

### 场景 5：直接看某次到访的录音详情

```jsonc
{ "customerId": "1685535452481236993", "page": 1, "size": 5 }
```

每条 visit 已带 `audios[]`，**不必再调** `xiaobao_list_audio`：

```
屈哥 · 2023-07-30 14:01:03 · 接待:兰鸿建 · 12 分 · 3 条录音：
  1. audioId=9001 · 14:01:15 ~ 14:08:42 · 7 分 · 状态:分析完成
     fileUrl: https://oss.../abc?sign=...
  2. audioId=9002 · 14:09:00 ~ 14:11:30 · 2 分 · 状态:分析完成
  3. audioId=9003 · 14:12:00 ~ 14:15:30 · 3 分 · 状态:分析完成
```

> 想看某条录音的**转录文本**还是要单独调 `xiaobao_get_audio_text`，
> `audios[]` 里只有元数据 + 签名 URL，没有 transcript。

---

## 常见错误与排查

- **`error: 'NO_ACTIVE_PROJECT'`** — 跑 `wangxiaobao-switch-project` skill
- **401 / token 过期** — 调 `xiaobao_authorize { force: true }` 重登
- **`total: 0`** — 时间窗内确实没数据，或当前用户授权范围内没有匹配的接待顾问
- **customerName 模糊但没匹到** — 客户名拼写差异（"李女士" vs "李小姐"）；
  改用 `xiaobao_list_customers` 反查精确 customerId
- **接待顾问跟归属顾问不一致** — 正常业务情况（同事代接待），不是 bug；
  必要时跟用户解释
