<div align="center">

  # 📧 MailMind

  ### 你的电子邮件终于可以自己工作了！

  ![Version](https://img.shields.io/badge/version-0.0.2-blue.svg)
  ![Status](https://img.shields.io/badge/status-beta-orange.svg)
  ![License](https://img.shields.io/badge/license-MIT-green.svg)
  ![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
  ![Node](https://img.shields.io/badge/node-18+-green.svg)

  **一款由人工智能驱动的电子邮件智能体，融合了大语言模型与现代邮件系统。**

  MailMind 通过直观的聊天界面帮助您阅读、整理、起草和管理邮件。

  [快速开始](#-快速开始) • [功能特性](#-功能特性) • [联系人管理](#-联系人管理) • [文档](#-文档) • [贡献](#-贡献) • [English](README.md)

</div>

---

<div align="center">

## 🎉 v0.0.2 版本更新

### ✨ 邮件页面 - 全面焕新

我们彻底重新设计了邮件页面，打造了现代化、功能丰富的邮件客户端界面。

</div>

---

## ✨ 功能特性

<table>
<tr>
<td>

### 🤖 AI 驱动的邮件代理
- 自然语言交互
- 上下文感知响应
- 智能邮件处理
- 自动化工作流与智能规划

</td>
<td>

### 📧 智能邮箱
- 阅读、撰写、发送邮件
- AI 自动整理邮件
- 直观的信息提取
- 生成沟通流程

</td>
</tr>
<tr>
<td>

### 👥 AI 可访问的联系人
- 创建和编辑联系人
- AI 自动组织
- AI 理解社交网络
- 强大的搜索和过滤功能

</td>
<td>

### 🔍 智能能力
- 网络搜索集成
- 多会话支持
- 实时流式传输
- 附件处理

</td>
</tr>
</table>

## 🏗️ 架构设计

### 后端技术栈

```
FastAPI    → 高性能异步 Web 框架
LangGraph  → 高级代理编排
WebSocket  → 实时双向通信
IMAP/SMTP  → 直接邮件协议集成
```

### 前端技术栈

```
React 18      → 现代化 UI 与 Hooks
TypeScript    → 类型安全开发
Tailwind CSS  → 实用优先的样式
Vite          → 极速构建工具
Axios         → HTTP 与 WebSocket 客户端
```

### AI 集成

- **OpenAI 兼容 API** - 支持多种 LLM 提供商
- **Tavily 搜索** - 网络搜索能力
- **子代理架构** - 专业化任务处理
- **上下文管理** - 智能对话跟踪

## 🚀 快速开始

### 前置要求

- **Node.js** 18+ 和 npm
- **Python** 3.10+
- 支持 IMAP 访问的邮箱账户（推荐 Gmail）
- 您选择的 LLM 提供商的 API 密钥

### 安装步骤

<details>
<summary><b>1. 克隆仓库</b></summary>

```bash
git clone https://github.com/yourusername/mailmind.git
cd mailmind
```

</details>

<details>
<summary><b>2. 配置环境变量</b></summary>

```bash
cd web_app
cp .env.example .env
# 编辑 .env 文件，填入您的 API 密钥和邮箱凭据
```

</details>

<details>
<summary><b>3. 启动应用</b></summary>

```bash
./start.sh
```

启动脚本将自动：
- ✅ 在虚拟环境中安装 Python 依赖
- ✅ 安装 Node.js 依赖
- ✅ 启动后端服务器（默认：http://localhost:2821）
- ✅ 启动前端开发服务器（默认：http://localhost:2922）

</details>

<details>
<summary><b>4. 打开浏览器</b></summary>

导航到 `http://localhost:2922`，开始用 AI 管理您的邮件！

</details>

## ⚙️ 配置说明

### 模型设置

| 变量 | 描述 | 示例 |
|----------|-------------|---------|
| `MODEL` | 模型名称 | `gpt-4`、`claude-3-sonnet` |
| `OPENAI_API_KEY` | 您的 API 密钥 | `sk-...` |
| `OPENAI_BASE_URL` | API 端点 | `https://api.openai.com/v1` |
| `DISPLAY_REASONING` | 显示推理过程 | `True`/`False` |

### 邮箱设置

| 变量 | 描述 | 默认值 |
|----------|-------------|---------|
| `USERNAME` | 您的邮箱地址 | - |
| `PASSWORD` | 应用专用密码 | - |
| `IMAP_SERVER` | IMAP 服务器地址 | `imap.gmail.com` |
| `SMTP_SERVER` | SMTP 服务器地址 | `smtp.gmail.com` |
| `IMAP_PORT` | IMAP 端口 | `993` |
| `SMTP_PORT` | SMTP 端口 | `465` |

### 已测试的邮箱提供商

| 提供商 | 状态 | 说明 |
|----------|--------|-------|
| ✅ **Gmail** | 完全测试和支持 | 需要应用密码。在设置中启用 IMAP。 |
| 🔄 **Outlook** | 测试中 | 通过 IMAP 和 SMTP 协议访问非常复杂。 |


<details>
<summary><b>Gmail 设置指南（推荐）</b></summary>

1. **启用双因素认证**
   - 前往 Google 账户设置
   - 安全 → 两步验证
   - 启用 2FA

2. **生成应用密码**
   - 前往 Google 账户设置
   - 安全 → 应用密码
   - 生成新的应用密码
   - 在 `PASSWORD` 字段中使用此密码

3. **启用 IMAP 访问**
   - 前往 Gmail 设置
   - 转发和 POP/IMAP
   - 启用 IMAP
   - 保存更改

4. **配置 MailMind**
   ```
   USERNAME=yourname@gmail.com
   PASSWORD=[您的 16 位应用密码]
   IMAP_SERVER=imap.gmail.com
   SMTP_SERVER=smtp.gmail.com
   IMAP_PORT=993
   SMTP_PORT=465
   ```

</details>

### 网络设置

| 变量 | 描述 | 默认值 |
|----------|-------------|---------|
| `BACKEND_PORT` | 后端服务器端口 | `2821` |
| `FRONTEND_PORT` | 前端开发服务器端口 | `2922` |

## 💡 使用指南

### 聊天界面

1. **开始对话** - 用自然语言输入您的请求：
   ```
   "总结我的未读邮件"
   "回复所有未读的新年问候邮件"
   "删除所有来自 newsletter@example.com 的邮件"
   ```

2. **观察 AI 工作** - 实时查看代理的思维过程和工具调用

3. **管理多个会话** - 为不同任务创建新的聊天会话

### 邮件管理

| 操作 | 描述 |
|--------|-------------|
| 📖 **阅读** | 获取并显示带过滤功能的邮件 |
| ✉️ **发送** | 撰写和发送新邮件 |
| 🗑️ **删除** | 删除不需要的邮件 |
| 📁 **移动** | 将邮件整理到文件夹 |
| 🏴 **标记** | 标记为重要/未读 |
| 📎 **附件** | 查看和下载文件 |

### 联系人管理

使用我们全面的联系人功能高效组织您的联系人：

| 功能 | 描述 |
|---------|-------------|
| 👤 **添加联系人** | 创建包含多个邮箱地址的联系人 |
| ✏️ **编辑联系人** | 随时更新联系人信息 |
| 🗑️ **删除联系人** | 经确认后删除联系人 |
| 🏷️ **分组** | 将联系人组织到自定义组中 |
| 🔍 **搜索** | 按姓名、邮箱或组查找联系人 |
| 📋 **字母排序视图** | 联系人按首字母自动排序 |

**优势**：
- 📧 撰写邮件时快速访问
- 🎯 按联系人过滤邮件
- 👥 将联系人组织到组（家人、工作、朋友等）
- 🔎 即时搜索所有联系人字段

### 设置页面

通过 Web UI 配置所有内容：
- 🔑 更新 API 密钥
- 📧 配置邮件服务器
- 🔌 调整网络端口
- 🎨 切换显示选项

### 联系人页面

高效管理您的联系人网络：

**添加联系人**：
1. 点击 **"添加联系人"** 按钮
2. 输入联系人姓名（必填）
3. 添加一个或多个邮箱地址
4. 分配到组（例如：家人、工作、朋友）
5. 保存联系人

**使用分组整理**：
- 创建自定义组来分类联系人
- 在侧边栏中按组过滤联系人
- 组显示联系人数量
- 轻松添加/删除组中的联系人

**搜索联系人**：
- 按姓名、邮箱或组搜索
- 输入时实时过滤
- 按字母顺序排序显示
- 快速访问联系人详细信息

**管理联系人**：
- ✏️ 编辑任何联系人以更新信息
- 🗑️ 带确认对话框的删除功能
- 📧 每个联系人多个邮箱地址
- 🏷️ 每个联系人上的可视化组标签

## 📁 项目结构

```
mailmind/
├── deepagents/              # 核心代理框架
│   ├── backends/           # 后端实现
│   ├── middleware/         # 代理中间件
│   └── ...
├── lib/                    # 共享工具
│   ├── email_tools.py     # 邮件操作
│   ├── prompt.py          # 系统提示词
│   └── ...
├── web_app/               # Web 应用
│   ├── backend/          # FastAPI 服务器
│   │   ├── api_server.py
│   │   └── requirements.txt
│   ├── frontend/         # React + TypeScript UI
│   │   ├── src/
│   │   │   ├── components/   # UI 组件
│   │   │   ├── pages/        # 页面组件
│   │   │   ├── lib/          # API 和工具
│   │   │   └── contexts/     # React 上下文
│   │   ├── package.json
│   │   └── vite.config.js
│   └── start.sh         # 启动脚本
├── .env.example          # 环境变量模板
└── README.md            # 本文件
```

## 🛠️ 开发指南

### 后端开发

```bash
cd web_app/backend
source venv/bin/activate  # 激活虚拟环境
python api_server.py      # 启动并自动重载
```

### 前端开发

```bash
cd web_app/frontend
npm run dev     # 启动开发服务器并热重载
npm run build   # 构建生产版本
npm run preview # 预览生产构建
```

### 快速开发代理

```bash
python lib/test.py
```

## 🔑 核心功能说明

### 会话隔离
每个聊天会话保持：
- ✅ 独立的代理实例和隔离状态
- ✅ 独立的邮件缓存
- ✅ 文件操作的专用文件系统
- ✅ 独特的对话历史

### 实时流式传输
- ✅ WebSocket 即时通信连接
- ✅ 逐令牌流式传输代理响应
- ✅ 实时显示工具调用和结果
- ✅ 代理状态的可视化反馈

### 邮件缓存持久化
- ✅ 缓存持久化到 `.emails_cache.json`
- ✅ 服务器重启后仍然保留
- ✅ 删除会话时自动清理
- ✅ 会话隔离以防止交叉污染

## 🔧 故障排除

### 邮箱连接问题

<details>
<summary><b>Gmail 特定问题</b></summary>

- 使用**应用密码**而不是您的常规密码
- 在 Gmail 设置中启用 **IMAP 访问**
- 如果适用，检查"不太安全的应用访问"
- 验证是否启用了 2FA（应用密码所需）

</details>

<details>
<summary><b>通用邮件问题</b></summary>

- 如果使用代理，检查防火墙/代理设置
- 验证 IMAP/SMTP 服务器地址和端口
- 确保端口 993 (IMAP) 和 465/587 (SMTP) 开放
- 使用 `telnet imap.gmail.com 993` 测试连接

</details>

### API 错误

<details>
<summary><b>常见 API 问题</b></summary>

- 验证 API 密钥有效且有足够额度
- 检查 `OPENAI_BASE_URL` 对您的提供商是否正确
- 某些提供商需要特定的模型名称
- 检查速率限制和配额使用情况
- 查看后端日志中的错误消息

</details>

### WebSocket 连接

<details>
<summary><b>连接问题</b></summary>

- 确保后端正在运行且可访问
- 检查 `.env` 中的端口冲突
- 验证浏览器控制台是否有错误
- 尝试刷新页面
- 检查浏览器 DevTools 中的网络选项卡

</details>

### 性能问题

<details>
<summary><b>性能缓慢</b></summary>

- 减少 `read_emails` 工具中的邮件批次大小
- 关闭未使用的聊天会话
- 如果 UI 缓慢，清除浏览器缓存
- 检查系统资源（CPU、内存）
- 监控网络选项卡中的大负载

</details>

## 🔒 安全注意事项

⚠️ **重要安全提示**：

- ❌ **切勿提交** `.env` 文件到版本控制
- 🔑 使用**应用密码**进行邮件身份验证
- 🔄 保持 API 密钥安全并定期轮换
- ⚠️ 谨慎使用代理配置
- 🌐 应用在本地运行；避免将端口暴露到互联网
- 📁 检查 `.gitignore` 确保敏感文件被排除

## 📝 待办事项

- [ ] **邮箱界面** - 智能邮件客户端界面
- [ ] **用户文件上传** - 上传文件用于 AI 聊天
- [ ] **长期记忆** - 存储和检索对话事实
- [ ] **高级搜索** - AI 驱动的分类
- [ ] **多账户支持** - 多个邮箱账户
- [ ] **邮件分析** - 统计仪表板
- [ ] **AI 摘要** - 邮件线程摘要
- [ ] **日历集成** - Google 日历和 Outlook
- [ ] **更多 LLM API** - Anthropic、Cohere 等

## 📄 许可证

本项目在 MIT 许可证下发布 - 详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎贡献！请随时提交 Pull Request。

1. Fork 仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 🙏 致谢

使用出色的开源工具构建：

- [DeepAgents](https://github.com/langchain-ai/deepagents) - 代理编排
- [React](https://react.dev/) - UI 框架
- [Tailwind CSS](https://tailwindcss.com/) - 样式
- [Lucide](https://lucide.dev/) - 图标
- [imap-tools](https://github.com/ikvk/imap_tools) - 邮件操作
- [FastAPI](https://fastapi.tiangolo.com/) - 后端框架

## 💬 支持

如有问题和疑问：

- 🐛 [报告错误](../../issues)
- 💡 [请求功能](../../issues)
- 📖 查看现有文档
- 🔧 查看[故障排除部分](#-故障排除)

---

<div align="center">

  **Built with ❤️ by the MailMind team**

  [⬆ 返回顶部](#-mailmind)

</div>
