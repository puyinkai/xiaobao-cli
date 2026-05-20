---
name: wangxiaobao-switch-project
version: 0.1.0
description: "旺小宝多租户/项目切换。列出当前账号有权限的租户与项目（可按 keyword 模糊过滤收敛），让用户选择后激活到 ~/.xiaobao/active-project.json（0600）；后续所有 xiaobao-cli 命令从该文件读 tenant/project 上下文，不再需要传 tenantId/projectId 入参。高频命令: xiaobao-cli project list [--keyword <kw>]、xiaobao-cli project use --tenant-id ... --tenant-name ... --project-id ... --project-name ...。何时用：用户说切项目/选项目/换项目/项目列表/切到 XX 项目；任意 xiaobao-cli 命令返回 NO_ACTIVE_PROJECT 错误；用户准备查录音/客户/来访但还没设激活项目；用户想看自己有权限访问哪些租户和项目。"
metadata:
  requires:
    bins: ["xiaobao-cli"]
  cliHelp: "xiaobao-cli project --help"
---

# 旺小宝项目切换

把当前账号下的「租户 + 项目」枚举出来让用户挑一个，确认后调
`xiaobao-cli project use` 写入 CLI 全局状态文件，供后续 命令 读取。

## 执行前必读

- 必须先通过 `xiaobao-cli auth login` 完成 OAuth 登录；token 没拿到时本 skill 不能继续
- **不要**自己 fs.writeFile 写 `.env` 或任何文件——状态落地走
  `xiaobao-cli project use`，由 CLI 统一管理权限和路径
- 多个项目时**必须让用户挑**，绝对不要自动选择第一个；只有一个项目时才可以自动选
- 用户确认前不要跑 wangxiaobao-switch-project skill

---

## 流程

### 第 1 步：拿到项目列表

调用 命令 `xiaobao-cli project list`。**可选 `keyword` 参数**对租户名/
项目名做包含模糊过滤（大小写不敏感）：

- 用户已经说了想要哪个项目（如"切到盛世禧悦"）→ **直接带 `keyword`**：
  `xiaobao-cli project list { keyword: "盛世禧悦" }`，收敛后通常只剩 1-2 条，
  省去让用户从一长串里挑
- 用户只说"换个项目""看看有哪些" → 不带 keyword，拉全量
- 账号项目很多、全量列表太长 → 提示用户给个关键字，再带 `keyword` 重查

返回结构：
```json
{
  "projects": [
    { "tenantId": "1234", "tenantName": "示例租户A", "projectId": "9001", "projectName": "示例项目甲" },
    { "tenantId": "1234", "tenantName": "示例租户A", "projectId": "9002", "projectName": "示例项目乙" },
    { "tenantId": "5678", "tenantName": "示例租户B", "projectId": "9101", "projectName": "示例项目丙" }
  ],
  "count": 3
}
```

如果 `count == 0`：

- **带了 `keyword`** → 是关键字没命中，不是没权限。提示用户换更短的关键字、
  或不带 keyword 看全量；**不要**直接说"没有项目"
- **没带 `keyword`** → 账号确实没有可访问的项目，结束

如果 命令 报错（401 / token 过期等），先调 `xiaobao-cli auth login --force` 重新登录，再重试一次。

### 第 2 步：展示并让用户选

按"租户 → 项目"分组渲染，编号从 1 开始：

```
[示例租户A]
  1. 示例项目甲 (projectId=9001)
  2. 示例项目乙 (projectId=9002)

[示例租户B]
  3. 示例项目丙 (projectId=9101)
```

- **多个项目**：让用户回复编号或项目名。用户回复后，**再显示一次「即将激活的
  租户/项目信息」并请用户确认 y/n**，确认后才跑 `xiaobao-cli project use`
- **仅一个项目**：直接告诉用户"账号下只有一个项目 X，是否激活？"等用户确认即可

### 第 3 步：跑 `xiaobao-cli project use` 落地

```json
{
  "tenantId":    "<选中条目的 tenantId>",
  "tenantName":  "<选中条目的 tenantName>",
  "projectId":   "<选中条目的 projectId>",
  "projectName": "<选中条目的 projectName>"
}
```

成功返回：

```json
{
  "success": true,
  "activeProject": {
    "tenantId": "1234",
    "tenantName": "示例租户A",
    "projectId": "9001",
    "projectName": "示例项目甲",
    "updatedAt": "2026-05-13T..."
  },
  "message": "已切换到「示例租户A / 示例项目甲」"
}
```

状态写到 `~/.xiaobao/active-project.json`，权限 0600。

---

## 输出模板

成功后回复用户（中文）：

```
✅ 已切换到「示例租户A / 示例项目甲」
租户 ID: 1234
项目 ID: 9001
状态保存在 ~/.xiaobao/active-project.json

下一步可以：
- 查录音：让我帮你跑 wangxiaobao-audio-query / wangxiaobao-audio-wiki skill
- 快问 AI：让我帮你跑 wangxiaobao-quick-qa skill
```

---

## 仅查看不切换

用户只想"看看有哪些项目"而**不切换**时，调 `xiaobao-cli project list`（必要时带
`keyword` 收敛）渲染列表后停下来，不要跑 `xiaobao-cli project use`。

---

## 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---|---|---|
| `xiaobao-cli project list` 返回 401 / token 过期 | 没登录或 refresh 失败 | 调 `xiaobao-cli auth login --force` 重新走 device flow |
| `count == 0`（没带 keyword） | 账号无任何租户/项目权限 | 让用户找管理员加权限，本 skill 不继续 |
| `count == 0`（带了 keyword） | 关键字没匹配到任何项目 | 换更短关键字 / 不带 keyword 看全量，别直接说"没项目" |
| 用户输入的编号超出范围 | 选错了 | 重新提示当前可选编号区间 |
| 其他 命令 仍返回 `NO_ACTIVE_PROJECT` | 没跑 wangxiaobao-switch-project skill 落地 | 检查 `~/.xiaobao/active-project.json` 是否存在，重新走本 skill |
