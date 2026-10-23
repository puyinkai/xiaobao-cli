# @puyinkai/xiaobao-cli

旺小宝 CLI —— [openclaw-xiaobao](https://github.com/puyinkai/openclaw-xiaobao)
plugin 的 host-agnostic 等价物。业务数据 / 问数 / 来访总结 / 知识库 / 员工工具 等能力映射为
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

员工工具（登录 + 激活项目后即可用，无需其他配置）：

```bash
xiaobao-cli staff list                                  # 看开放了哪些员工工具
xiaobao-cli staff call staff-receptions \
  --variables '{"staff_receptions_page_num":1,"staff_receptions_page_size":10}'  # 我的接待记录
xiaobao-cli staff call staff-employee-comparison \
  --variables '{"staff_user_ids":["<授权员工ID1>","<授权员工ID2>"]}' \
  --format toon                                         # 员工对比，TOON 输出省 token
```

> 员工对象不传时使用当前授权范围；`staff_*_*` 系列变量是各工具的业务过滤条件，
> 具体字段见 `staff list` 返回的 inputSchema。

> openclaw-xiaobao 老用户：CLI 默认从 `~/.openclaw/state/wangxiaobao/` fallback
> 读 token + active-project，**零迁移开箱即用**。新写操作落到 `~/.xiaobao/`。

## 能力一览

| 命令                                                 | 对应 openclaw-xiaobao tool           |
| -------------------------------------------------- | ---------------------------------- |
| `auth login [--force]`                             | `xiaobao_authorize`                |
| `auth whoami`                                      | `xiaobao_whoami`                   |
| `auth logout`                                      | `xiaobao_logout`                   |
| `project list [--keyword <kw>]`                    | `xiaobao_list_projects`            |
| `project use --tenant-id ... --project-id ...`     | `xiaobao_switch_project`           |
| `consultant list`                                  | `xiaobao_list_consultants`         |
| `audio list --from --to [--user-id] ...`           | `xiaobao_list_audio`               |
| `audio text <audio-id>`                            | `xiaobao_get_audio_text`           |
| `customer list [--customer-name] [--portrait] ...` | `xiaobao_list_customers`           |
| `visit list [--customer-id] [--from] [--to]`       | `xiaobao_list_visits`              |
| `focus list [--visit-ids] [--category] ...`        | `xiaobao_list_customer_focus`      |
| `resistance list [...]`                            | `xiaobao_list_customer_resistance` |
| `qa <prompt> [--thread-id <id>]`                   | `xiaobao_quick_qa`                 |
| `api <METHOD> <path>`                              | `xiaobao_api`                      |

`staff` 两个命令走 ai-open REST，目录包含员工查询与当前项目权限查询工具：

| 命令 | 说明 |
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
| `follow list` / `follow summary` | 新增 · 旺跟进明细分页 / 电话微信指标汇总 |
| `portrait list` / `portrait get <字段>` | 新增 · 画像字段清单 / 单字段饼图分布 |
| `config fields` | 新增 · 客户字段配置字典（解读 dynamic_tags） |
| `audio analyze <query> [--customer-id]` | 新增 · 录音批量分析（LLM） |
| `beautx plan\|deal-analysis\|portrait-tags\|visit-evaluate` | 新增 · 医美四查询 |
| `date now\|today\|range this-week …` | 新增 · 本地日期工具（不走网络） |
| `admin sales-report --from --to [--by project\|zone]` | 新增 · 公司经营数据 出库/回款（super-admin，独立白名单） |
| `admin token-usage --from --to [--model] …` | 新增 · LLM token 用量（super-admin，独立白名单） |
| `staff list` | 新增 · 员工工具目录（`json` 含各工具 inputSchema） |
| `staff call <tool> [--variables '{json}']` | 新增 · 调用员工工具（参数见 docs/staff-tools.md） |
| `api <METHOD> <path>` | `xiaobao_api` |

员工对象省略时使用当前授权范围（以 `staff-permission-scope` 的 `active_scope` 为准）；指定员工查看时，
授权范围由服务端按当前管理关系计算，越权目标会被拒绝。

各工具的完整参数、分页/时间变量、错误码约定与逐条示例，见
**[员工工具使用说明](docs/staff-tools.md)**。

### 员工工具接口

```bash
xiaobao-cli staff list
xiaobao-cli staff call staff-permission-scope
xiaobao-cli staff call staff-receptions --variables '{"staff_receptions_page_num":1,"staff_receptions_page_size":10}'
xiaobao-cli staff call staff-recent-reception-summary --time-start "2026-10-01 00:00:00" --time-end "2026-10-16 00:00:00"
```

`staff` 与其他业务命令共用 ai-open 地址和登录 token：

- 目录：`GET /ai-open/staff/tools`
- 调用：`POST /ai-open/staff/tools/{toolName}/call`，Body 为 `{variables,timeRange?}`
- CLI 发送 Bearer token 与标准 `X-Tenant-*` / `X-Project-*` 头；用户身份由服务端认证上下文确定

默认 `XIAOBAO_API_BASE=https://open-ai.wangxiaobao.com`。联调时将 `--api-base` 或该环境变量
设置为目标环境的开放 API 网关，并配套设置 `--auth-base`；员工命令不再使用 MCP 专用域名。
开放接口、application 员工能力和 agent-tool 连接须先部署配置完成。

## WorkBuddy Connector

`workbuddy/` 是按《WorkBuddy Connector 对接规范》方案二（CLI + Skill）准备的连接器配置
（`connector-meta.json` / `cli.json` / `icon.svg`）；`npm run workbuddy:pack` 会连同 `skills/`
打成 `dist-workbuddy/wangxiaobao-connector.zip` 供提交审核。认证走 `auth login`（device flow）
+ `auth status`（exit 0 = 已登录，可完成待授权的 device code 换 token）+ `auth logout`。

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
员工工具的 agent 说明见 `wangxiaobao-staff-tools`。

## License

MIT
