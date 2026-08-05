# @puyinkai/xiaobao-cli

旺小宝 CLI —— [openclaw-xiaobao](https://github.com/puyinkai/openclaw-xiaobao)
plugin 的 host-agnostic 等价物。业务数据 / 问数 / 来访总结 / 知识库 等能力映射为
CLI 子命令，**人类直接敲也好用，AI agent（Claude Code / Codex / Cursor / OpenClaw /
任何能 shell out 的 host）通过 stdout JSON 消费**。

> 后端链路：CLI 调 `ai-open`（公网开放层 / OAuth 鉴权），ai-open 作为薄代理转发到内网
> 业务层 `wang-ai-mcp`。命令用法对调用方透明。

参考 [larksuite/cli](https://github.com/larksuite/cli) 范式，跟 OpenClaw plugin
解耦：plugin 这条线（`@puyinkai/openclaw-xiaobao`）保持现状，本 CLI 走 npm，
两条线并存。

## 安装

```bash
npm install -g @puyinkai/xiaobao-cli
# 或 npx 一次性用
npx -y @puyinkai/xiaobao-cli --help
```

## 快速上手

```bash
xiaobao-cli auth login                                         # 走 device flow 登录
xiaobao-cli project list --keyword 盛世                        # 找项目
xiaobao-cli project use --tenant-id 1234 --tenant-name 示例租户 \
                       --project-id 9001 --project-name 盛世禧悦  # 激活项目
xiaobao-cli audio list --from "2026-05-01 00:00:00" --to "2026-05-02 00:00:00" --size 5
```

> openclaw-xiaobao 老用户：CLI 默认从 `~/.openclaw/state/wangxiaobao/` fallback
> 读 token + active-project，**零迁移开箱即用**。新写操作落到 `~/.xiaobao/`。

## 能力一览

| 命令 | 对应 openclaw-xiaobao tool |
| --- | --- |
| `auth login [--force]` | `xiaobao_authorize` |
| `auth whoami` | `xiaobao_whoami` |
| `auth logout` | `xiaobao_logout` |
| `project list [--keyword <kw>]` | `xiaobao_list_projects` |
| `project use --tenant-id ... --project-id ...` | `xiaobao_switch_project` |
| `consultant list` | `xiaobao_list_consultants` |
| `audio list --from --to [--user-id] ...` | `xiaobao_list_audio` |
| `audio text <audio-id>` | `xiaobao_get_audio_text` |
| `customer list [--customer-name] [--portrait] ...` | `xiaobao_list_customers` |
| `visit list [--customer-id] [--from] [--to]` | `xiaobao_list_visits` |
| `focus list [--visit-ids] [--category] ...` | `xiaobao_list_customer_focus` |
| `resistance list [...]` | `xiaobao_list_customer_resistance` |
| `qa <prompt> [--thread-id <id>]` | `xiaobao_quick_qa`（底层已切 sql-agent） |
| `visit summary [--customer-id] [--visit-id] [--template] [--from] [--to]` | 新增 · 来访接待总结 |
| `kb search <query> [--k]` | 新增 · 知识库语义检索 |
| `kb docs [--title]` | 新增 · 知识库文档列表 |
| `kb doc <doc-id>` | 新增 · 知识库文档详情 |
| `kb doc-content <doc-id> [--offset] [--limit]` | 新增 · 知识库文档正文分页 |
| `quantum <metric> [--view] [--visit-type] …` | 新增 · 量子看板 / KPI 统计（20 指标） |
| `admin sales-report --from --to [--by project\|zone]` | 新增 · 公司经营数据 出库/回款（super-admin，独立白名单） |
| `admin token-usage --from --to [--model] …` | 新增 · LLM token 用量（super-admin，独立白名单） |
| `api <METHOD> <path>` | `xiaobao_api` |

## 通用 flags

- `--format toon|json|table` —— 默认 `toon`（省 token，适合 LLM 上下文）；`json` 严格 JSON、agent/人类友好；`table` 暂未实现（回退 JSON）
- `--api-base <url>` / `--auth-base <url>` —— 覆盖默认（也可 env `XIAOBAO_API_BASE` / `XIAOBAO_AUTH_BASE`）

## 输出协议

- stdout 写**结果**（`--format` 决定形态）
- stderr 写**进度 / 日志 / 错误**（不污染 stdout）
- 退出码：成功 0，业务错误（401/NO_ACTIVE_PROJECT/参数错）非 0
- 错误对象同时打到 stdout 保持可 parse

## state 存储

| 文件 | 路径 | 权限 |
| --- | --- | --- |
| OAuth tokens | `~/.xiaobao/token.json` | 0600 |
| Active project | `~/.xiaobao/active-project.json` | 0600 |
| User config（可选） | `~/.xiaobao/config.json` | 0600 |

读取顺序：`~/.xiaobao/` → fallback `~/.openclaw/state/wangxiaobao/`。写永远到 `~/.xiaobao/`。

## skill 配套

`skills/` 目录下的 SKILL.md 跟 cli 同包发布，跟 openclaw-xiaobao 那边镜像，
只是调用从 plugin tool invoke 改为 shell out `xiaobao-cli ...`。近期新增
`wangxiaobao-visit-summary-query`（来访接待总结）、`wangxiaobao-knowledge-base`（知识库）
与 `wangxiaobao-quantum-stats`（量子看板 / KPI 统计，含 `references/quantum-metrics.md`）；
`wangxiaobao-quick-qa` 的问数底层由 fast-responder 切换为 sql-agent。

## License

MIT
