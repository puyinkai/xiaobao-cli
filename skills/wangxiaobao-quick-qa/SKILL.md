---
name: wangxiaobao-quick-qa
description: |
  旺小宝业务数据问数 skill：用自然语言询问当前项目的客户 / 来访 / 销售 /
  录音 / 业务指标等数据，AI 直接基于旺小宝数据回答。**只读、不写文件、无副作用**——
  对应 `xiaobao_quick_qa` tool。

  **当以下情况时使用此 Skill**:
  (1) 用户问客户相关数据 —— "今天来了几个客户"、"本周新增多少客户"、
      "意向客户都有谁"、"老客户回访情况"
  (2) 用户问来访数据 —— "今天到访多少组"、"上周末来访高峰是几点"、
      "首访 / 复访比例"
  (3) 用户问挖需 / 转化指标 —— "挖需率多少"、"成交转化率"、"意向客户占比"、
      "客户分级分布"
  (4) 用户问销售 / 销冠数据 —— "本月销冠是谁"、"张三这周成交几单"、
      "销售排行榜"、"业绩 TOP3"
  (5) 用户问录音 / 通话 / 接待数据 —— "录音覆盖率多少"、"哪些销售有几条录音"、
      "本周通话时长 TOP5"、"未跟进客户有多少"
  (6) 任何"问一句旺小宝数据"的开放式问题

  **不要用本 skill 的场景**：
  - 用户要的是录音元数据列表（如"列今天所有录音的 audioId"） →
    用 `wangxiaobao-audio-query` skill，更快更精确
  - 用户要批量同步录音文本到 wiki → 用 `wangxiaobao-audio-wiki` skill
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


# 旺小宝问数

调 `xiaobao_quick_qa` tool 用自然语言问当前激活项目的业务数据。
零副作用，不写文件、不动 wiki，所以用错也没成本，鼓励放心调用。

## 执行前必读

- 必须有有效 token：先调 `xiaobao_whoami`；未登录 / 过期就调 `xiaobao_authorize`
- **必须有激活项目**：tool 内部自动从激活项目状态读 tenant/project，
  调用方**不要传** tenant/project 参数。如果 tool 返回
  `error: 'NO_ACTIVE_PROJECT'`，让用户跑 `wangxiaobao-switch-project` skill
  后再重试
- **绝不要**写文件。即使用户随口说"顺便存一下"也要拦——告诉用户"出长报告
  的功能暂未发布，如果想存可以把回答复制下来"

---

## 快速索引：意图 → 工具

| 用户意图                           | plugin tool        | 关键参数                              |
| ---------------------------------- | ------------------ | ------------------------------------- |
| 单轮问数                           | `xiaobao_quick_qa` | `prompt`                              |
| 接着上一轮继续追问                 | `xiaobao_quick_qa` | `prompt + threadId`                   |
| 给问题加上下文（如客户 ID 列表）    | `xiaobao_quick_qa` | `prompt + context: {...}`             |

---

## 核心约束

### 1. 用业务语言问，不要追问 ID

用户问"张三本周成交几单"——直接把 prompt 原样传给 tool，**不要**先去查
张三的 user-id 再拼参数。后端 AI 知道"张三"在当前项目里就是谁。

如果用户问的是开放性问题（"客户主要疑虑是啥"），更不要画蛇添足拼任何
ID / 时间窗口——AI 会自己定义合理范围。

### 2. 多轮：threadId 由 agent 自己接续

第一轮**不传** `threadId`，走单轮模式。响应里有 `resp.data.data.thread_id`，
**记在 agent 当前对话上下文里**，后续追问把它原样传回 `threadId` 入参。
**不要**把 thread_id 写到任何文件 / .env / 状态——它只是会话短期记忆。

跨 session（用户关了 chat）就**不再延续**，新 session 重新发起新一轮即可。

### 3. 响应只取 answer 给用户

`xiaobao_quick_qa` 返回结构：

```jsonc
{
  "code": "0",
  "msg":  "success",
  "data": {
    "type":      "quick-qa",
    "thread_id": "...",
    "answer":    "最终文本（这就是要展示给用户的）",
    "output":    { /* 原始结构化数据，agent 自己看就行，不展示 */ }
  }
}
```

plugin tool 又把上面塞进 `{ status, ok, data }` 外包：拿最终文本写
`resp.data.data.answer`，渲染给用户**只展示 answer**。

如果要支持后续追问，结尾加一句"💡 想接着问可以告诉我，会沿用本次对话上下文"
（threadId 由 agent 自己存，不要让用户记）。

### 4. 不要拉太多上下文进 context

`context` 字段可以塞额外背景，但**控制在 < 4KB**。需要塞大块录音 / 客户
档案的需求暂时没有 plugin 侧支持——用户可以分多轮 prompt 喂，每轮塞一段。

### 5. 不要替代 audio-query 做"列录音元数据"

用户问"列下今天哪些录音"、"audioId 是多少"——那是
`wangxiaobao-audio-query` skill 的事（直接走录音元数据 API，更快也更精确）。
本 skill 是问"开放式业务问题"用的，不是数据列表 API 代理。

---

## 使用场景示例

### 场景 1：问客户来访

```jsonc
// xiaobao_quick_qa
{ "prompt": "今天到访了多少组客户，里面有几组是首访？" }
```

渲染：

```
今天到访 18 组，其中：
- 首访 11 组（61%）
- 复访 7 组

💡 想接着问可以告诉我，会沿用本次对话上下文。
```

### 场景 2：问销冠

```jsonc
{ "prompt": "本月销冠是谁，业绩多少？" }
```

渲染：

```
本月销冠：张三
- 成交 8 单 / 金额 1240 万
- 跟进客户 47 组，成交转化率 17%
```

### 场景 3：问录音覆盖率

```jsonc
{ "prompt": "本周录音覆盖率怎么样？哪些销售覆盖低？" }
```

渲染：

```
本周录音覆盖率 78%（45 个销售里 35 个开了工牌录音）。
覆盖偏低的销售（< 50%）：
1. 李四（22%）
2. 王五（38%）
3. 赵六（45%）
```

### 场景 4：接着追问（多轮）

用户："那张三跟客户讲到学区时通常怎么应对？"
（接着上一轮 ——agent 自己存了 threadId）

```jsonc
{
  "prompt": "那张三跟客户讲到学区时通常怎么应对？",
  "threadId": "<上一轮 resp.data.data.thread_id>"
}
```

### 场景 5：带额外 context

```jsonc
{
  "prompt": "评估一下这个客户的成交概率",
  "context": {
    "customer_id": 12345,
    "recent_audio_ids": [9001, 9023, 9045]
  }
}
```

---

## 典型问数关键词参考

帮 agent 识别用户意图。看到这类词就走本 skill：

- **客户类**：客户、新客、老客、意向客、成交客、客户画像、客户分级、回访
- **来访类**：到访、来访、首访、复访、上门、到店、客流
- **挖需 / 转化**：挖需率、转化率、意向、成交率、跟进、转化漏斗
- **销售 / 销冠**：销冠、销售排行、业绩、佣金、TOP、成单
- **录音 / 接待**：录音、通话、对话、接待、覆盖率、时长
- **业务指标**：成单、签约、定金、退订、回款、佣金

---

## 常见错误与排查

- **`error: 'NO_ACTIVE_PROJECT'`** — 还没设过激活项目 → 跑
  `wangxiaobao-switch-project` skill 后重试
- **401 / token 过期** — 调 `xiaobao_authorize { force: true }` 重登，重试一次
- **响应耗时 > 30 分钟** — 后端慢到打满 plugin timeout → 告诉用户"上游慢，稍后重试"
- **answer 为空** — 上游这一轮没产出最终文本 → 让用户换个 prompt 重试
- **用户想"批量出报告"** — 拦住：本期 plugin 没有报告生成 skill，
  解释"出长报告的功能在做异步化改造，下期发布"
- **用户问"列录音元数据 / audioId 是多少"** — 切到
  `wangxiaobao-audio-query` skill，那个走元数据 API 更精确
