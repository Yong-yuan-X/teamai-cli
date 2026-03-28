# Contribute — 分享 Session 经验到团队知识库

总结本次 AI 编码 session 中学到的经验，推送到团队知识库。

**【重要】所有生成的文档必须使用中文撰写。**

## When to Use

- When teamai suggests this session has valuable content worth sharing
- When you've solved a tricky problem and want to document the solution
- When you've discovered a useful workflow or pattern
- After a long session with diverse tool usage

## How It Works

1. **总结**：回顾本次 session 的工具使用、解决的问题、发现的模式
2. **生成文档**：用中文撰写 Markdown 文档，涵盖：
   - 任务/问题是什么
   - 关键决策及原因
   - 解决方案、变通方法或发现的模式
   - 哪些工具/skill 特别有用
   - 踩坑点和注意事项
3. **保存临时文件**：写入临时文件
4. **推送到团队**：运行 `teamai contribute --file <path> --title "<title>"`

## Document Template

```markdown
# <标题>

**Author:** <username>
**Date:** <date>
**Tags:** troubleshooting | workflow | pattern | tool-usage | deployment

## 背景
在做什么？遇到了什么问题？

## 解决方案
怎么解决的？关键步骤是什么？

## 经验总结
- 经验 1
- 经验 2

## 相关 Skills
- skill-name-1
- skill-name-2
```

## Example

```bash
# AI 生成总结文档到 /tmp/session-summary.md 后
teamai contribute --file /tmp/session-summary.md --title "K8s pod 启动超时排查"
```

## Important

- Run this as a **sub-agent** (Agent tool) to avoid polluting the main session's context
- The document is pushed directly to master in the team repo's `learnings/` directory
- Team members will see it on their next `teamai pull`
- Keep summaries concise and actionable — this is a knowledge base, not a diary
