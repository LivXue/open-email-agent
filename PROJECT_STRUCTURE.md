# 项目结构说明

## 目录组织

```
deepagents/
├── deepagents/              # 核心深度学习代理框架
│   ├── __init__.py
│   ├── backends/           # 后端存储实现
│   ├── middleware/         # 中间件组件
│   └── graph.py            # 图结构定义
│
├── lib/                     # 共享库文件
│   ├── __init__.py         # 包初始化，导出所有公共接口
│   ├── email_tools.py      # 邮件操作工具（@tool 装饰的函数）
│   ├── email_utils.py      # 邮件客户端工具类（MailBoxClient, SMTPProxyClient）
│   ├── utils.py            # 通用工具函数
│   └── address_book.json   # 通讯录数据
│
├── web_app/                 # Web 应用程序
│   ├── start.sh            # 启动脚本
│   ├── backend/            # 后端服务
│   │   ├── api_server.py   # FastAPI 服务器（使用 lib.email_tools）
│   │   ├── requirements.txt
│   │   └── venv/           # Python 虚拟环境
│   └── frontend/           # 前端应用
│
├── tests/                   # 测试文件
├── .env                     # 环境变量配置
├── .gitignore
├── pyproject.toml          # 项目配置
└── README.md
```

## 重要说明

### lib/ 目录

`lib/` 目录包含以下共享模块：

1. **email_tools.py** - 提供邮件操作的工具函数
   - `email_dashboard()` - 邮件仪表板
   - `read_emails()` - 读取邮件
   - `send_email()` - 发送邮件
   - `delete_email()` - 删除邮件
   - `move_email()` - 移动邮件
   - `flag_email()` - 标记邮件
   - `list_folders()` - 列出文件夹
   - `search_address_book()` - 搜索通讯录
   - `download_attachments()` - 下载附件

2. **email_utils.py** - 邮件客户端实现
   - `MailBoxClient` - IMAP 邮箱客户端（支持代理）
   - `SMTPProxyClient` - SMTP 客户端（支持代理）

3. **utils.py** - 通用工具
   - `pretty_print()` - 打印消息
   - `pretty_print_stream()` - 打印流消息
   - `get_fs_system()` - 获取文件系统后端

### 导入方式

在项目其他地方使用这些模块：

```python
# 方式 1: 从 lib 子模块导入
from lib.email_tools import send_email, read_emails
from lib.email_utils import MailBoxClient
from lib.utils import pretty_print

# 方式 2: 从 lib 包导入（推荐）
import lib
tools = lib.email_tools, send_email

# 方式 3: 导入特定函数
from lib import (
    email_dashboard,
    read_emails,
    send_email,
    # ... 其他工具
)
```

### Web 应用

Web 应用位于 `web_app/` 目录：

```bash
# 启动 Web 应用
cd web_app
./start.sh
```

启动脚本会：
1. 检查并安装后端依赖（如需要）
2. 检查并安装前端依赖（如需要）
3. 启动后端服务器（http://localhost:8000）
4. 启动前端开发服务器（http://localhost:3000）

### 环境配置

确保在项目根目录创建 `.env` 文件，包含以下配置：

```env
# 模型设置
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=your_base_url
DISPLAY_REASONING=True

# Tavily 搜索
TAVILY_API_KEY=your_tavily_key

# 邮件设置
USERNAME=your_email@example.com
PASSWORD=your_password
IMAP_SERVER=imap.example.com
IMAP_PORT=993
IMAP_USE_PROXY=False
SMTP_SERVER=smtp.example.com
SMTP_PORT=465
SMTP_USE_SSL=True
SMTP_USE_PROXY=False
DONT_SET_READ=True
PROXY=optional_proxy_url
```

## 迁移说明

如果你有代码使用旧的导入路径，需要更新：

**旧路径：**
```python
from email_tools import send_email
from email_utils import MailBoxClient
from utils import pretty_print
```

**新路径：**
```python
from lib.email_tools import send_email
from lib.email_utils import MailBoxClient
from lib.utils import pretty_print
```

## 测试

运行测试脚本验证导入是否正常：

```bash
python test_imports.py
```

## Git 状态

以下文件已被移动：
- `email_tools.py` → `lib/email_tools.py`
- `email_utils.py` → `lib/email_utils.py`
- `utils.py` → `lib/utils.py`
- `address_book.json` → `lib/address_book.json`

Git 会将这些移动识别为重命名操作，保留文件历史。
