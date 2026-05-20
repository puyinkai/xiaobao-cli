# @puyinkai/xiaobao-cli

旺小宝 CLI —— [openclaw-xiaobao](https://github.com/puyinkai/openclaw-xiaobao)
plugin 的 host-agnostic 等价物。14 个能力 1:1 映射为 14 个 CLI 子命令，**人类
直接敲也好用，AI agent（Claude Code / Codex / Cursor / OpenClaw / 任何能 shell
out 的 host）通过 stdout JSON 消费**。

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

## 14 个能力

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
| `qa <prompt> [--thread-id <id>]` | `xiaobao_quick_qa` |
| `api <METHOD> <path>` | `xiaobao_api` |

## 通用 flags

- `--format json|toon|table` —— 默认 `json`（agent 友好）；`table` 人类友好；`toon` 给 LLM 上下文用
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

`skills/` 目录下 8 个 SKILL.md 跟 cli 同包发布，跟 openclaw-xiaobao 那边镜像，
只是调用从 plugin tool invoke 改为 shell out `xiaobao-cli ...`。

## License

MIT
