# Agent初始化问题修复说明

## 问题现象

与agent对话时报错：
```
Error: Agent not available. Please check configuration.
```

## 根本原因

后端API服务器在初始化agent时缺少多个Python依赖包，导致导入失败。

### 缺失的依赖包

1. **better-proxy** - 代理服务器处理
2. **imap-tools** - IMAP邮件操作
3. **python-socks** - SOCKS代理支持
4. **langchain-qwq** - LangChain的QwQ模型集成
5. **langchain-anthropic** - LangChain的Anthropic集成
6. **wcmatch** - 通配符匹配
7. **tavily-python** - Tavily搜索API

### 缺失的文件

1. **address_book.json** - 地址簿数据文件

## 解决方案

### 1. 安装所有缺失的依赖

```bash
# 安装email相关依赖
pip install better-proxy imap-tools python-socks

# 安装LangChain相关依赖
pip install langchain-qwq langchain-anthropic

# 安装其他依赖
pip install wcmatch tavily-python
```

或者一次性安装所有：
```bash
pip install better-proxy imap-tools python-socks langchain-qwq langchain-anthropic wcmatch tavily-python
```

### 2. 创建address_book.json文件

```bash
cd /data/xuedizhan/deepagents
echo '{}' > address_book.json
```

### 3. 更新api_server.py

在 `api_server.py` 的 `get_imports()` 函数中添加了 `move_email` 工具：

```python
from email_tools import (
    email_dashboard,
    read_emails,
    send_email,
    delete_email,
    move_email,  # 新增
    flag_email,
    list_folders,
    search_address_book,
    download_attachments
)
email_tools = {
    "email_dashboard": email_dashboard,
    "read_emails": read_emails,
    "send_email": send_email,
    "delete_email": delete_email,
    "move_email": move_email,  # 新增
    "flag_email": flag_email,
    "list_folders": list_folders,
    "search_address_book": search_address_book,
    "download_attachments": download_attachments,
}
```

## 验证修复

运行测试脚本验证所有依赖是否已正确安装：

```bash
cd /data/xuedizhan/deepagents
python test_agent_init.py
```

预期输出：
```
✅ All dependencies installed!
✓ email_tools imported successfully
✓ Agent initialized successfully
✅ All tests passed! The backend should work correctly.
```

## 启动服务

### 启动后端服务器

```bash
cd /data/xuedizhan/deepagents/web_app/backend
python api_server.py
```

预期输出：
```
Starting Email Agent API server...
Agent will be initialized on first request
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 启动前端服务器

```bash
cd /data/xuedizhan/deepagents/web_app/frontend
npm run dev
```

### 访问应用

打开浏览器访问：`http://localhost:3000`

## 测试对话

1. 访问 http://localhost:3000/chat
2. 确认显示 "● Connected" 状态（绿色）
3. 输入测试消息：
   - "Tell me your name and the tools you can use."
   - "Read my latest emails"
   - "Check my inbox"

## 完整的依赖列表

以下是目前安装的所有相关依赖（可以通过 `pip list` 查看）：

- `better-proxy` - 代理支持
- `imap-tools` - IMAP邮件操作
- `python-socks` - SOCKS代理
- `langchain` - LangChain核心
- `langchain-core` - LangChain核心组件
- `langchain-openai` - OpenAI集成
- `langchain-qwq` - QwQ模型集成
- `langchain-anthropic` - Anthropic集成
- `langgraph` - LangGraph框架
- `deepagents` - 自定义Agent框架
- `tavily-python` - Tavily搜索API
- `wcmatch` - 通配符匹配
- `fastapi` - Web框架
- `uvicorn` - ASGI服务器
- `pydantic` - 数据验证
- `python-dotenv` - 环境变量管理

## 常见问题

### Q: 仍然显示"Agent not available"错误？

A: 检查以下几点：
1. 确认后端服务器正在运行
2. 确认 `.env` 文件包含所有必需的环境变量
3. 查看后端日志，确认agent成功初始化
4. 运行 `python test_agent_init.py` 验证依赖

### Q: 邮件连接失败？

A: 这是正常的警告，不会影响agent运行：
```
Connect to SMTP server with proxy failed: 403 Forbidden
Try to connect without proxy...
Connected to SMTP server successfully!
```
系统会自动fallback到无代理模式。

### Q: 如何查看详细的错误日志？

A: 后端服务器会打印详细日志：
```bash
cd /data/xuedizhan/deepagents/web_app/backend
python api_server.py
```

查看输出的错误信息以定位问题。

## 相关文件

- `/data/xuedizhan/deepagents/web_app/backend/api_server.py` - 后端API服务器
- `/data/xuedizhan/deepagents/email_tools.py` - 邮件工具
- `/data/xuedizhan/deepagents/.env` - 环境变量配置
- `/data/xuedizhan/deepagents/address_book.json` - 地址簿数据
- `/data/xuedizhan/deepagents/test_agent_init.py` - 依赖测试脚本
