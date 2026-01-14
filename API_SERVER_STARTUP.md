# API Server 启动流程优化说明

## 优化概述

`web_app/backend/api_server.py` 已经优化，确保按照正确的顺序初始化所有服务组件。

## 初始化顺序

### 1. 模块导入阶段（启动前）

当 Python 导入 `lib.email_tools` 模块时，会自动执行 `init_email()` 函数：

```python
# lib/email_tools.py
mail_box, smtp_client = None, None

def init_email():
    global mail_box, smtp_client
    try:
        mail_box = MailBoxClient(...).login(email, password)
    except Exception as e:
        warnings.warn(f"Login to IMAP server failed: {e}")
        mail_box = None

    try:
        smtp_client = SMTPProxyClient(...).connect().login(email, password)
    except Exception as e:
        warnings.warn(f"Login to SMTP server failed: {e}")
        smtp_client = None

init_email()  # 在模块级别调用
```

### 2. FastAPI 启动事件（app startup）

```python
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup in the correct order."""
    print("\n" + "="*60)
    print("🚀 Starting Email Agent API Server")
    print("="*60)

    # 步骤 1: 检查邮件服务状态
    print("\n[1/3] Checking email services...")
    email_status = check_email_services()
    # 报告 IMAP 和 SMTP 连接状态

    # 步骤 2: 初始化 DeepAgent
    print("\n[2/3] Initializing DeepAgent...")
    agent_success = initialize_agent()
    # 创建 agent 实例，包含邮件工具

    # 步骤 3: 服务就绪
    print("\n[3/3] Server initialization complete")
    print("="*60)
```

### 3. 健康检查端点

`/api/health` 端点现在返回详细的服务状态：

```json
{
  "status": "healthy",
  "timestamp": "2025-01-14T12:00:00.000000Z",
  "services": {
    "email": {
      "initialized": true,
      "imap_connected": true,
      "smtp_connected": true
    },
    "agent": {
      "initialized": true
    }
  }
}
```

## 关键改进

### 1. 明确的初始化状态标志

```python
# 初始化状态标志
email_initialized = False
agent_initialized = False
email_imap_connected = False
email_smtp_connected = False
```

### 2. 服务状态检查函数

```python
def check_email_services():
    """Check email service status."""
    # 检查 email_tools 模块是否已初始化
    email_initialized = hasattr(email_tools_module, 'mail_box') and hasattr(email_tools_module, 'smtp_client')

    # 检查连接状态
    email_imap_connected = email_tools_module.mail_box is not None
    email_smtp_connected = email_tools_module.smtp_client is not None

    return {
        "email_initialized": email_initialized,
        "imap_connected": email_imap_connected,
        "smtp_connected": email_smtp_connected
    }
```

### 3. 增强的 agent 初始化

```python
def initialize_agent():
    """Initialize the DeepAgent instance."""
    global agent, agent_initialized

    try:
        # ... 初始化逻辑 ...

        agent_initialized = True
        print("✓ Agent initialized successfully")
        return True
    except Exception as e:
        print(f"✗ Failed to initialize agent: {e}")
        agent_initialized = False
        return False
```

### 4. 确保函数改进

```python
def ensure_agent():
    """Ensure agent is initialized before use."""
    global agent
    if agent is None or not agent_initialized:
        print("Initializing agent...")
        initialize_agent()
    return agent
```

### 5. 移除了 main 中的重复初始化

```python
if __name__ == "__main__":
    import uvicorn
    # Note: startup_event() will handle initialization
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## 启动输出示例

```bash
$ cd web_app/backend && python api_server.py

============================================================
🚀 Starting Email Agent API Server
============================================================

[1/3] Checking email services...
  ✓ Email services module loaded
    - IMAP connected: ✓
    - SMTP connected: ✓

[2/3] Initializing DeepAgent...
  ✓ Agent initialized successfully
  ✓ Agent ready

[3/3] Server initialization complete
============================================================
✓ API Server ready at http://0.0.0.0:8000
✓ WebSocket endpoint: ws://0.0.0.0:8000/ws/chat
============================================================

INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## 测试验证

运行测试脚本验证启动流程：

```bash
python test_api_server_startup.py
```

预期输出：

```
Testing API Server Startup Sequence
============================================================

[1/3] Testing email_tools module import...
  ✓ lib.email_tools imported successfully
  ✓ Module attributes present: mail_box=True, smtp_client=True
  ✓ IMAP connection: ✓
  ✓ SMTP connection: ✓

[2/3] Testing api_server module import...
  ✓ api_server imported successfully
  ✓ Email initialized: True
  ✓ IMAP connected: True
  ✓ SMTP connected: True

[3/3] Testing service status functions...
  ✓ check_email_services() returned:
    - email_initialized: True
    - imap_connected: True
    - smtp_connected: True
  ✓ Health check endpoint exists: True

============================================================
✓ All startup sequence tests passed!
```

## 错误处理

如果服务初始化失败，系统会：

1. **邮件服务失败**：显示警告但继续启动（邮件功能不可用）
2. **Agent 初始化失败**：显示错误，Agent 不可用，但服务器继续运行
3. **健康检查**：准确报告每个服务的状态

## 配置更新

当通过 `/api/settings` 端点更新配置时：

```python
# Reinitialize agent with new settings
global agent, agent_initialized
agent = None  # Clear the old agent
agent_initialized = False  # Reset flag
ensure_agent()  # Initialize with new settings
```

## 总结

优化后的启动流程确保：

1. ✅ 邮件服务首先在模块导入时初始化
2. ✅ API server 在启动时检查服务状态
3. ✅ Agent 在邮件服务就绪后初始化
4. ✅ 健康检查端点报告所有服务状态
5. ✅ 清晰的启动日志和错误消息
6. ✅ 配置更新时正确重新初始化

这确保了服务启动的可靠性和可观测性。
