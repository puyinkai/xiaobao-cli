---
name: wangxiaobao-customer-focus-query
description: |
  旺小宝**客户关注点**分页查询 skill：按 visit/customer/audio ID 列表、一级/二级
  分类模糊、来访时间窗组合查 AI 在客户对话里抽出的「关注点」标签
  （客户主动表达的关心：学区 / 户型 / 价格优惠 / 配套等）。**只读、不写文件、
  无副作用**。对应 `xiaobao_list_customer_focus` tool。排序固定 visit_time DESC。
  每条 tag 含 customer / userInfo / audio + value_str（详细说明） + text_fragment（录音原文片段）。

  **当以下情况时使用此 Skill**:
  (1) 用户问"客户关注点"、"客户最在意什么"、"客户关心什么"、"客户问得最多"
  (2) 用户问某客户的关注点 —— 先调 `xiaobao_list_customers` 反查 customerId，
      再调本 skill 带 customerIds 精确过滤
  (3) 用户问某次到访 / 某条录音里的关注点 —— 带 visitIds / audioIds
  (4) 用户按分类找 —— 户型 / 价格 / 学区 / 交通 / 商业配套 等 → category 模糊
  (5) 用户按二级分类找 —— "户型因素" / "位置因素" / "发展因素" → classification 模糊
  (6) 用户给时间窗 —— "5 月份的关注点" / "本周关注点" → fromDate / toDate

  **不要用本 skill 的场景**：
  - 用户问的是**抗性点 / 疑虑 / 反对意见** → 走 `wangxiaobao-customer-resistance-query`
  - 用户要的是客户**画像** / 标签 → 走 `wangxiaobao-customer-query`
  - 用户问"完整录音文本" → 走 `wangxiaobao-audio-query` + `xiaobao_get_audio_text`
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


# 旺小宝客户关注点查询

调 `xiaobao_list_customer_focus` tool 查 AI 抽出的客户关注点标签。
跟抗性点 skill 镜像，差别就是底层走 `mv_open_customer_focus` 表。

## 执行前必读

- 必须有有效 token：先调 `xiaobao_whoami`；未登录就 `xiaobao_authorize`
- **必须有激活项目**：tool 内部自动读，缺失返回 `NO_ACTIVE_PROJECT`
- **数据权限隔离**：按当前用户授权可见顾问范围过滤（普通顾问看自己 /
  团队长看团队 / 项目管理员看全项目）
- LocalDateTime 格式：`yyyy-MM-dd HH:mm:ss`（空格分隔），plugin 自动转
- **不要**写文件、出报告

---

## 快速索引：意图 → 工具

| 用户意图                             | plugin tool                       | 关键参数                           |
| ------------------------------------ | --------------------------------- | ---------------------------------- |
| 列时段内全部关注点                   | `xiaobao_list_customer_focus`     | `fromDate` / `toDate`              |
| 看某客户的关注点                     | `xiaobao_list_customers` → `xiaobao_list_customer_focus` | `customerIds: [<wang_id>]` |
| 看某次到访的关注点                   | `xiaobao_list_customer_focus`     | `visitIds: [<visit_id>]`           |
| 看某条录音的关注点                   | `xiaobao_list_customer_focus`     | `audioIds: [<audio_id>]`           |
| 按分类找（一级）                     | `xiaobao_list_customer_focus`     | `category: "户型"` 等              |
| 按分类找（二级）                     | `xiaobao_list_customer_focus`     | `classification: "户型因素"`        |
| 估算总数                             | `xiaobao_list_customer_focus`     | `page: 1, size: 1`，只读 `total`   |

---

## 核心约束

### 1. 客户名 → wang_id 反查

用户说"屈哥的关注点"——先调 `xiaobao_list_customers { customerName: "屈哥" }`
拿到 `customerId`（= wang_id），再传给 `customerIds` 数组（即使只有一个也用数组）。

### 2. 分类模糊：一级 + 二级二选一或同时用

```
category 一级常见值：户型 / 价格 / 环境 / 教育 / 交通 / 商业配套 / 装修 / 其他
classification 二级常见值：户型因素 / 价格因素 / 环境因素 / ... / 位置因素 / 发展因素
```

模糊关键词越短越宽：`category: "户型"` 同时命中 "户型因素" 和别的含 "户型" 的分类。

### 3. 时间窗：用户没明确说就推断

| 用户说法     | fromDate / toDate                                |
| ------------ | ------------------------------------------------ |
| "今天关注点" | 今天 00:00:00 / 明天 00:00:00                    |
| "本周关注点" | 周一 00:00:00 / 今天 23:59:59                    |
| "5 月份"     | 2026-05-01 00:00:00 / 2026-06-01 00:00:00        |
| "最近一个月" | 30 天前 / now                                    |

### 4. 响应字段重点

```jsonc
{
  "code": "0",
  "data": {
    "page": 1, "size": 10, "total": 47,
    "content": [
      {
        "id": "507495633116995584",                // tag 自身 ID
        "visitId": "507016570438942720",
        "audioId": "507494047338729472",
        "customerId": "507016570019512320",
        "textFragment": "新规户型我看了他们的那个四房的，还不错啊，",  // 录音原文片段
        "startOffset": 945120,                     // 在录音中的起始毫秒
        "endOffset":   949840,
        "keyStr":   "对盛世禧悦户型感兴趣",          // 简短描述
        "valueStr": "客户表示看了盛世禧悦的新规四房户型觉得不错...",  // 详细说明
        "category":       "户型因素",                // 一级
        "classification": "户型因素",                // 二级
        "visitTime": "2025-04-30 10:22:28",
        "customer": {                              // 批量补全
          "customerId": "507016570019512320",
          "customerName": "屈哥",
          "customerPhone": "173****7325",
          "intentLevel": "A",
          ...
        },
        "userInfo": { /* 接待顾问详情 */ },
        "audio": {                                 // 录音简要 + 签名 fileUrl
          "audioId": 507494047338729472,
          "fileId":  "507494045212213248",
          "startTime": "2025-04-30 10:22:50",
          "duration":  2263,
          "fileUrl":   "https://oss.../...?sign=..."
        }
      }
    ]
  }
}
```

plugin tool 又外包一层 → 渲染用 `resp.data.data.content`。

### 5. 渲染给用户时只展示核心

- **必显**：keyStr（标题）+ valueStr（详细说明）+ visitTime + 客户名
- **可选**：category（分类标签）+ textFragment（原文，省略号截断）
- **链接**：如果用户要听原录音，给 `audio.fileUrl`（注意 18000 秒过期）

---

## 使用场景示例

### 场景 1：本月客户最在意什么

```jsonc
{
  "fromDate": "2026-05-01 00:00:00",
  "toDate":   "2026-06-01 00:00:00",
  "page": 1, "size": 50
}
```

后处理：按 `category` 聚合 → "5 月份 87 条关注点：户型因素 28 条 / 价格因素 19 条 / ..."。

### 场景 2：屈哥本次到访的关注点

```jsonc
// step 1: 反查 wang_id（如果只知名字）
// xiaobao_list_customers
{ "customerName": "屈哥" }

// step 2: 拿到 customerId = 507016570019512320
// xiaobao_list_customer_focus
{ "customerIds": ["507016570019512320"], "page": 1, "size": 20 }
```

### 场景 3：户型相关关注点

```jsonc
{ "category": "户型", "page": 1, "size": 30 }
```

### 场景 4：特定录音里的关注点

```jsonc
{ "audioIds": ["507494047338729472"], "page": 1, "size": 50 }
```

渲染：列出该录音里 AI 抽出的所有关注点，按 startOffset 升序展示原文 + 描述。

---

## 常见错误与排查

- **`error: 'NO_ACTIVE_PROJECT'`** — 跑 `wangxiaobao-switch-project` skill
- **401 / token 过期** — 调 `xiaobao_authorize { force: true }` 重登
- **`total: 0`** — 过滤条件没匹配 / 该时段没数据 / 当前用户授权范围内没匹配的接待顾问
- **传入的 ID 找不到对应数据** — 数据权限隔离把不属于授权顾问的 tag 过滤掉了；
  这是预期行为，不是 bug
- **category 模糊命中过多** — 加 classification 二级分类收敛
