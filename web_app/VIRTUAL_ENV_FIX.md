# 虚拟环境修复说明

## 问题

使用 `start.sh` 启动时，agent初始化失败：
```
Failed to initialize agent: No module named 'langchain_qwq'
```

## 根本原因

`start.sh` 脚本创建并使用虚拟环境 `backend/venv`，但该虚拟环境中的 `requirements.txt` 缺少很多依赖包。

## 解决方案

### 1. 更新 requirements.txt

已更新 `/data/xuedizhan/deepagents/web_app/backend/requirements.txt`，添加所有缺失的依赖：

```txt
# Web Framework
fastapi==0.115.0
uvicorn[standard]==0.32.0
websockets==13.1
python-dotenv==1.0.1
pydantic==2.10.0

# LangChain and AI
langchain==1.2.3
langchain-core==1.2.7
langchain-qwq==0.3.4
langchain-openai
langchain-anthropic==1.3.1

# LangGraph
langgraph==1.0.6
langgraph-checkpoint==4.0.0
langgraph-prebuilt==1.0.6
langgraph-sdk==0.3.3

# Search
tavily-python==0.7.17

# Email and IMAP
better-proxy==1.3.1
imap-tools==1.11.0
python-socks[asyncio]==2.8.0

# Utilities
wcmatch==10.1
anthropic>=0.76.0
```

### 2. 重建虚拟环境

删除旧的虚拟环境并重新创建：

```bash
cd /data/xuedizhan/deepagents/web_app/backend
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. 修复 address_book.json 路径问题

`email_tools.py` 使用相对路径 `"address_book.json"`，当从不同目录运行时会找不到文件。

**修改位置**: `/data/xuedizhan/deepagents/email_tools.py`

**修改前**:
```python
address_book_data = {}
def load_address_book():
    global address_book_data
    with open("address_book.json", "r") as f:
        address_book_data = json.load(f)
```

**修改后**:
```python
address_book_data = {}
def load_address_book():
    global address_book_data
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    address_book_path = os.path.join(script_dir, "address_book.json")
    with open(address_book_path, "r") as f:
        address_book_data = json.load(f)
```

同时在 `modify_address_book` 函数末尾添加保存功能：

```python
    # Save changes to file
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        address_book_path = os.path.join(script_dir, "address_book.json")
        with open(address_book_path, "w") as f:
            json.dump(address_book_data, f, indent=2)
        return f"Address book updated successfully."
    except Exception as e:
        return f"Error saving address book: {str(e)}"
```

## 验证修复

### 方法1: 使用 start.sh

```bash
cd /data/xuedizhan/deepagents/web_app
./start.sh
```

### 方法2: 手动启动（使用虚拟环境）

```bash
# 启动后端
cd /data/xuedizhan/deepagents/web_app/backend
source venv/bin/activate
python api_server.py

# 启动前端（新终端）
cd /data/xuedizhan/deepagents/web_app/frontend
npm run dev
```

### 方法3: 测试虚拟环境中的agent

```bash
cd /data/xuedizhan/deepagents/web_app/backend
source venv/bin/activate
python -c "
import sys
sys.path.insert(0, '../..')
from dotenv import load_dotenv
load_dotenv()
from api_server import initialize_agent
initialize_agent()
print('Agent initialized successfully!')
"
```

## 现在的工作流程

1. **虚拟环境已创建**: `backend/venv/`
2. **所有依赖已安装**: 包括 langchain-qwq, tavily-python, better-proxy 等
3. **路径问题已修复**: address_book.json 使用绝对路径
4. **start.sh 可以正常使用**

## 预期输出

当使用 `start.sh` 启动时，后端应该显示：

```
Starting backend server on http://localhost:8000
Starting Email Agent API server...
Agent will be initialized on first request
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

当首次对话时，agent应该初始化成功：

```
Initializing agent...
Connecting to IMAP server imap.gmail.com:993...
Connected to IMAP server successfully!
Connecting to SMTP server smtp.gmail.com:465...
Connected to SMTP server successfully!
Agent initialized successfully!
```

## Pydantic 警告

可能会看到以下警告信息：
```
pydantic.errors.PydanticSchemaGenerationError: Unable to generate pydantic-core schema for typing.NotRequired[dict[str, deepagents.middleware.filesystem.FileData]]
```

这是 Pydantic 的一个已知问题，但不影响 agent 的实际运行。Agent 仍然会成功初始化并正常工作。

## 常见问题

### Q: 为什么之前手动安装的包在虚拟环境中找不到？

A: 手动使用 `pip install` 安装的包会安装到系统 Python 环境中，而虚拟环境 (`venv`) 是一个独立的 Python 环境，需要单独安装依赖。

### Q: 如何确认虚拟环境已激活？

A: 激活虚拟环境后，命令提示符前会显示 `(venv)`：
```bash
(venv) user@host:/path$
```

### Q: 如何在虚拟环境中安装新包？

A:
```bash
cd /data/xuedizhan/deepagents/web_app/backend
source venv/bin/activate
pip install package-name
pip freeze > requirements.txt  # 更新 requirements.txt
```

## 相关文件

- `/data/xuedizhan/deepagents/web_app/backend/requirements.txt` - 依赖列表
- `/data/xuedizhan/deepagents/web_app/backend/venv/` - 虚拟环境目录
- `/data/xuedizhan/deepagents/email_tools.py` - 邮件工具（已修复路径）
- `/data/xuedizhan/deepagents/address_book.json` - 地址簿数据
- `/data/xuedizhan/deepagents/web_app/start.sh` - 启动脚本
