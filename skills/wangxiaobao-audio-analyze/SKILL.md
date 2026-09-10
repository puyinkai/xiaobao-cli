---
name: wangxiaobao-audio-analyze
version: 0.1.0
description: "旺小宝录音批量分析（LLM 生成式）：对指定客户/顾问范围的录音做全文分析或时间线分析，返回分析文本。只读但昂贵（LangGraph，最长可达数分钟）。高频命令: xiaobao-cli audio analyze \"<分析问题>\" --customer-id <wang_id> [--type general_analysis|timeline_analysis]。何时用：用户说 分析某客户的历史录音、总结某顾问接待话术/共性抗性、按时间线梳理对话要点。注：必须至少带 --customer-id/--customer-ids/--advisor-ids 之一收窄范围；查录音元数据用 audio list、看逐字稿用 audio text、统计类 KPI（录音覆盖率/盘客率）用 quantum job-performance——都不是这里。"
metadata:
  requires:
    bins: ["xiaobao-cli"]
  cliHelp: "xiaobao-cli audio analyze --help"
---

# 旺小宝录音批量分析（LLM）

> **CRITICAL** —— 跑命令前 MUST 先用 Read tool 读取 [`../wangxiaobao-shared/SKILL.md`](../wangxiaobao-shared/SKILL.md)。

## 分工
| 需求 | 用什么 |
| --- | --- |
| 生成式分析（总结/抗性归纳/时间线） | `audio analyze`（本 skill，**昂贵**） |
| 录音元数据（列表/时长/文件） | `audio list` |
| 逐字稿原文 | `audio text <audio-id>` |
| 录音覆盖率/盘客率等 KPI | `quantum job-performance` |

## 命令
```bash
xiaobao-cli audio analyze "总结客户主要顾虑" --customer-id <wang_id>
xiaobao-cli audio analyze "按时间线梳理对话要点" --customer-ids id1,id2 --type timeline_analysis
xiaobao-cli audio analyze "总结这位顾问的话术问题" --advisor-ids 123
```
参数：`query` positional 必填（分析问题/指令）；`--type` = `general_analysis`（默认）/ `timeline_analysis`；`--customer-id`（单个 wang_id）/ `--customer-ids`（CSV）/ `--advisor-ids`（CSV 顾问 userId）。

## 响应字段
`data.answer`（**优先读这个**，最终分析文本）、`output`（上游原始输出，answer 空时再看）、`type`、`threadId` 等运行元数据。没有 `audio text` 那种分段 role 结构。

## Agent 约束（控成本）
- **昂贵调用**：必须至少带 `--customer-id` / `--customer-ids` / `--advisor-ids` 之一，禁止无范围全项目分析
- 客户名 → 先 `customer list --customer-name` 反查 wang_id
- 多客户合并一次 `--customer-ids`，不要逐个 analyze
- 只需要看原文片段时用 `audio text` / `focus list` / `resistance list`，更轻

## 常见错误
- 耗时长是正常（LLM 分析）；超时/IO 异常 → 稍后重试或缩小范围
- `NO_ACTIVE_PROJECT`/401 → 见 shared
