# tad — Team AI DevKit

团队 AI 经验共享框架。自动在团队成员之间同步 skills、rules、docs、hooks 等 AI 工具配置。

## 安装

```bash
# 一行安装
git clone git@git.woa.com:jeffyxu/tad-cli.git ~/.tad/tad-cli \
  && cd ~/.tad/tad-cli && npm install && npm run build && npm link
```

## 前置条件

设置 TGit Personal Access Token（需要 `api` 权限）：

```bash
# 获取 token: https://git.woa.com/profile/personal_access_tokens
echo 'export TGIT_TOKEN=your_token_here' >> ~/.bashrc
source ~/.bashrc
```

## 快速开始

```bash
# 1. 初始化（关联团队仓库、注册成员、注入 hooks）
tad init --repo git@git.woa.com:jeffyxu/tad-team.git

# 2. 拉取团队资源
tad pull

# 3. 推送本地新 skills 到团队
tad push

# 4. 查看状态
tad status
```

## 命令

| 命令 | 说明 |
|------|------|
| `tad init` | 初始化（TGit 认证、关联仓库、注册成员、注入 hooks） |
| `tad push [--all]` | 推送本地新资源到团队仓库 |
| `tad pull [--silent]` | 拉取团队资源并注入到本地 AI 工具 |
| `tad sync` | 双向同步（push + pull） |
| `tad status` | 查看本地 vs 团队仓库差异 |
| `tad list [type]` | 列出资源（skills\|rules\|hooks\|docs\|instincts） |
| `tad members` | 列出团队成员 |
| `tad doctor` | 诊断配置问题 |

全局选项：
- `--dry-run` — 预览模式，不做实际变更
- `--verbose, -v` — 详细输出

## 工作原理

```
成员 A                               成员 B
  创建 skill / 写规则                   同上
    │                                     │
    ▼                                     ▼
  tad push                            tad push
    │                                     │
    └──────► TGit 团队仓库 ◄──────────────┘
                  │
                  ▼ SessionStart hook → tad pull --silent
             自动拉取到所有成员本地
```

- `tad init` 会自动注入 SessionStart hook，每次启动 AI 工具会话时自动拉取团队最新内容
- Skills 同步到 `~/.claude/skills/`、`~/.codex/skills/`、`~/.claude-internal/skills/`、`~/.cursor/skills-cursor/`
- Rules 合并到 `~/.claude/CLAUDE.md`（使用标记注释管理）
- Docs 同步到 `~/.tad/docs/`

## 更新

```bash
cd ~/.tad/tad-cli && git pull && npm install && npm run build
```
