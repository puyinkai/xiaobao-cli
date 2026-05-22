---
name: wangxiaobao-shared
version: 0.1.0
description: "旺小宝 CLI 共享规则：安装方式（npm / npx），认证（OAuth device flow），激活项目，全局 flags（--format json/toon），输出协议（stdout JSON / stderr 错误 / exit code），错误码语义（NO_ACTIVE_PROJECT / NOT_AUTHENTICATED 含 hint 字段），权限隔离原则，token / active-project 文件位置（含 ~/.openclaw fallback）。任何旺小宝 skill 在执行命令前应先用 Read tool 读取本文件 —— 它定义了所有 xiaobao-cli 命令共享的前置约定。"
metadata:
  requires:
    bins: ["xiaobao-cli"]
  cliHelp: "xiaobao-cli --help"
---

# 旺小宝 CLI 共享规则

本 skill 定义所有 `xiaobao-cli` 命令通用的前置约束 + 协议，**其他旺小宝 skill
开始执行前 MUST 先用 Read tool 完整读取本文件**。

## 安装

```bash
# 全局安装（推荐，长期用）
npm install -g @puyinkai/xiaobao-cli

# 或一次性用（不污染全局）
npx -y @puyinkai/xiaobao-cli <subcommand>...
```

装好后 `xiaobao-cli --version` 应返回 `0.1.x`。Node 22+。

## 三步走基础流程

任何 xiaobao-cli 命令的**前置 3 步**：

```bash
# 1. 登录（OAuth device flow，token 自动缓存）—— 见下方两种模式
xiaobao-cli auth login

# 2. 选激活项目（多租户 / 多项目场景必做；旺小宝是多租户业务）
xiaobao-cli project list                # 列可选
xiaobao-cli project use --tenant-id ... --tenant-name ... \
                       --project-id ...  --project-name ...

# 3. 跑业务命令（这一步往后所有 list/text/qa 命令都从激活项目读 tenant/project）
xiaobao-cli audio list --from ... --to ...
xiaobao-cli customer list --portrait 高意向
# ...
```

### 登录的两种模式 —— agent 必须用 split-flow

`xiaobao-cli auth login` 默认**阻塞**轮询，最长卡 5 分钟等用户在浏览器授权。
**agent 绝对不要直接跑阻塞模式** —— 它会占满一整轮对话。改用 `--no-wait`
split-flow（两步、不阻塞）:

```bash
# 步骤 A：发起，立即返回（约 0.5s），拿到 verification_uri + device_code
xiaobao-cli auth login --no-wait
# stdout: { "awaiting_authorization": true, "verification_uri": "...",
#           "user_code": "...", "device_code": "...", "expires_in": 300, ... }
```

agent 拿到后：把 `verification_uri` **原样**发给用户（放进只含 URL 的代码块，
不要改写不要做 URL 编码），让用户浏览器打开授权，然后**结束本轮**，把控制权
交还用户。

```bash
# 步骤 B：用户回复"授权完成"后，用步骤 A 的 device_code 换 token（秒级）
xiaobao-cli auth login --device-code "<步骤A返回的 device_code>"
# stdout: { "source": "device-flow", "expires_at": ..., "scope": "..." }
```

device_code 有效期 `expires_in` 秒（约 5 分钟）。超时就重跑步骤 A。
若 token 仍有效 / refresh_token 可用，`--no-wait` 也会走 cache/refresh
快速返回（`source: cache` / `refresh`），不会发起新的 device flow。

**人类**在终端直接用，可以跑默认阻塞模式 `xiaobao-cli auth login`，盯着终端
授权完它自己退出，更省事。

查身份 / 当前激活项目（任何时候都可以）：

```bash
xiaobao-cli auth whoami       # 显示 logged_in + user 信息 + token 剩余有效期
xiaobao-cli project current   # 显示当前激活的 tenant/project + updatedAt
```

## 输出协议

所有命令统一协议:

| 流 | 内容 |
| --- | --- |
| **stdout** | 结果 / 错误对象，**JSON 格式**（默认）或 TOON 格式（`--format toon`），都是有效 JSON / 可机器解析 |
| **stderr** | 进度 / 人类友好错误提示 / verification URL 等。Agent 一般忽略 |
| **exit code** | 0 = 成功；非 0 = 失败（业务错误 / 参数错 / 网络错） |

Agent 消费时**只 parse stdout JSON**，stderr 是辅助。

### `--format` 全局 flag

| 值 | 用途 |
| --- | --- |
| `json`（默认） | pretty JSON，agent / 人类都能读 |
| `toon` | TOON 格式，uniform array of objects 省 30-50% token（LLM 上下文优化） |

## 错误对象结构

失败时 stdout 输出结构化错误（仍是合法 JSON，agent 直接 parse）:

```json
{
  "error": "NO_ACTIVE_PROJECT",
  "message": "当前未设置激活项目",
  "hint": "先用 `xiaobao-cli project list [--keyword <kw>]` 查看可选项目，再用 `xiaobao-cli project use ...` 激活。"
}
```

字段语义:

- `error`：**机器可读错误码**（常量字符串，agent 用它做分支判断）
- `message`：**短描述**（一句话讲发生了什么）
- `hint`：**actionable 命令引导**（agent 直接照这条命令解决，不要再让用户自己想）

### 常见错误码

| code | 触发场景 | hint 内 actionable 命令 |
| --- | --- | --- |
| `NOT_AUTHENTICATED` | 未登录 / token 过期且 refresh_token 也失效 | `xiaobao-cli auth login` |
| `NO_ACTIVE_PROJECT` | 没设激活项目就跑了需要 tenant/project 的命令 | `xiaobao-cli project list` + `xiaobao-cli project use ...` |
| `API_ERROR` | 上游 ai-open / saas API 返非 2xx | 看 `details.status` 和 `details.body`，可能 token scope 不够 / 上游临时挂 |
| `BAD_METHOD` | `api` 命令传错 HTTP method | 用 GET / POST / PUT / PATCH / DELETE |

遇到 `NOT_AUTHENTICATED` 或 `NO_ACTIVE_PROJECT` 时**立即按 hint 走**，不要追问用户。

## state 文件位置

| 文件 | 用途 | 路径 | 权限 |
| --- | --- | --- | --- |
| OAuth tokens | access_token + refresh_token + id_token + expires_at | `~/.xiaobao/token.json` | 0600 |
| Active project | tenantId / tenantName / projectId / projectName / updatedAt | `~/.xiaobao/active-project.json` | 0600 |
| User config（可选） | 覆盖 authBase / apiBase / scopes | `~/.xiaobao/config.json` | 0600 |

### `~/.openclaw/state/wangxiaobao/` fallback（向后兼容 openclaw-xiaobao plugin 用户）

读 token / active-project 时如果 `~/.xiaobao/` 没有，会**自动 fallback** 读
`~/.openclaw/state/wangxiaobao/{token,active-project}.json`。这是 plugin 用户
迁移到 CLI 的零摩擦机制：装上 CLI 直接 `auth whoami` / `project current`
就有数据，不用重新登录 / 重新选项目。

**写**操作（login / logout / project use）**永远写到 `~/.xiaobao/`**，不动
openclaw 的副本（保留 plugin session 完整性）。`auth logout` 例外 ——
会主动清掉两边的 token，否则 fallback 读 legacy 会让"登出后 whoami 仍显示已登录"。

## 数据权限隔离

`audio list` / `customer list` / `visit list` / `focus list` / `resistance list` /
`consultant list` 所有业务命令的后端都按**当前登录用户的授权范围**过滤数据:

- 普通顾问：只看自己名下
- 团队长：看本团队
- 项目管理员：看本项目全部

`total: 0` 不一定是"没数据"，也可能是**当前账号无权访问**。看不到的客户 / 顾问
不是 bug，是设计如此。要扩权限找管理员。

## 时间格式

所有 `--from` / `--to` 用 `yyyy-MM-dd HH:mm:ss`（空格分隔，**不带时区**）。
ISO 8601 形式 `2026-05-12T00:00:00+08:00` 也支持，CLI 内部转换为空格形式。

时区按服务端默认（中国时区）解释，**不要**在 prompt 里手动换算。

## generic `api` 命令

`xiaobao-cli api <METHOD> <PATH>` 是 escape hatch：调任意 wangxiaobao endpoint。
默认从 active-project 自动注入 `X-Tenant-Id` / `X-Project-Id` 等 4 个 headers
（跟 dedicated 命令一致）；要 opt-out 加 `--no-default-headers`。

```bash
# 跟 `consultant list` 等价（自动注入 tenant/project headers）
xiaobao-cli api GET /ai-open/consultants

# 调不需要 tenant 上下文的端点
xiaobao-cli api GET /saas/v2/estate/tenant-and-estate/by-user-id --no-default-headers

# POST + body
xiaobao-cli api POST /ai-open/audio/page --body '{"fromDate":"...","toDate":"..."}'
```

## 切勿在 prompt / agent 上下文里贴 token

`access_token` / `refresh_token` 是凭据，泄露到对话 / 公开仓库 / 截图都是事故。
agent 永远不要 `cat ~/.xiaobao/token.json` 打印给用户看。要查身份用
`xiaobao-cli auth whoami`（只显示 user info + expires，不显示 token 本身）。
