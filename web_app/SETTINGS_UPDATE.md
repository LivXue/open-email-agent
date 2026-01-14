# Settings页面更新说明

## 修改内容

### 1. 前端修改

#### 1.1 API类型定义 (`frontend/src/lib/api.ts`)
添加了三个新的布尔类型参数：
- `IMAP_USE_PROXY: boolean` - IMAP是否使用代理
- `SMTP_USE_SSL: boolean` - SMTP是否使用SSL
- `SMTP_USE_PROXY: boolean` - SMTP是否使用代理

#### 1.2 Settings页面 (`frontend/src/pages/SettingsPage.tsx`)
**字体颜色修改：**
- 所有输入框添加了 `text-gray-900` 类，确保输入文字显示为黑色
- 修改的输入框包括：
  - OpenAI API Key
  - Base URL
  - Tavily API Key
  - Username
  - Password
  - IMAP Server
  - IMAP Port
  - SMTP Server
  - SMTP Port
  - Proxy URL

**新增参数控件：**
1. **IMAP Use Proxy** (Checkbox) - IMAP服务器是否使用代理
   - 位置：IMAP Server和Port设置之后
   - 默认值：false

2. **SMTP Use SSL** (Checkbox) - SMTP服务器是否使用SSL
   - 位置：SMTP Server和Port设置之后
   - 默认值：true

3. **SMTP Use Proxy** (Checkbox) - SMTP服务器是否使用代理
   - 位置：SMTP Use SSL之后
   - 默认值：false

### 2. 后端修改 (`backend/api_server.py`)

#### 2.1 数据模型更新
更新了 `EnvSettings` Pydantic模型，添加新字段：
```python
IMAP_USE_PROXY: bool = False
SMTP_USE_SSL: bool = True
SMTP_USE_PROXY: bool = False
```

#### 2.2 GET /api/settings 端点
添加新字段的读取逻辑：
```python
"IMAP_USE_PROXY": os.getenv("IMAP_USE_PROXY", "False") == "True",
"SMTP_USE_SSL": os.getenv("SMTP_USE_SSL", "True") == "True",
"SMTP_USE_PROXY": os.getenv("SMTP_USE_PROXY", "False") == "True",
```

#### 2.3 POST /api/settings 端点
1. 更新.env文件写入逻辑，包含新参数：
```env
IMAP_USE_PROXY=True/False
SMTP_USE_SSL=True/False
SMTP_USE_PROXY=True/False
```

2. 更新环境变量设置：
```python
os.environ["IMAP_USE_PROXY"] = str(settings.IMAP_USE_PROXY)
os.environ["SMTP_USE_SSL"] = str(settings.SMTP_USE_SSL)
os.environ["SMTP_USE_PROXY"] = str(settings.SMTP_USE_PROXY)
```

## .env文件格式示例

```env
# Model Settings
OPENAI_API_KEY=sk-c0wzfi9b51k68ubvr9tars1yytxg913bhkc6up68amf5rq88
OPENAI_BASE_URL=https://api.xiaomimimo.com/v1
DISPLAY_REASONING=True

# Tavily Search Settings
TAVILY_API_KEY=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

# Email Settings
USERNAME=gausslian@gmail.com
PASSWORD=bdzhtsmjrfoenejk
IMAP_SERVER=imap.gmail.com
IMAP_PORT=993
IMAP_USE_PROXY=True
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=465
SMTP_USE_SSL=True
SMTP_USE_PROXY=True
DONT_SET_READ=True
PROXY=http://yujbutgf:684hr7epfdsy@166.88.195.84:5716
```

## 使用说明

1. **启动后端服务器：**
```bash
cd /data/xuedizhan/deepagents/web_app/backend
python api_server.py
```

2. **启动前端服务器：**
```bash
cd /data/xuedizhan/deepagents/web_app/frontend
npm run dev
```

3. **访问Settings页面：**
- 打开浏览器访问 `http://localhost:3000`
- 点击左侧导航栏的 "Settings"
- 现在所有输入框的文字都是黑色，清晰可见
- 可以配置新的三个代理和SSL选项

4. **保存设置：**
- 点击 "Save Settings" 按钮
- 设置会自动保存到 `.env` 文件
- Agent会自动重启以应用新配置

## 注意事项

1. **默认值：**
   - IMAP_USE_PROXY: False (不使用代理)
   - SMTP_USE_SSL: True (使用SSL，推荐)
   - SMTP_USE_PROXY: False (不使用代理)

2. **代理设置：**
   - 只有勾选对应的Use Proxy选项时，代理才会生效
   - 代理地址需要在Proxy URL字段中配置
   - 格式：`http://username:password@host:port`

3. **SSL设置：**
   - SMTP_USE_SSL默认为True，推荐保持启用
   - 大多数现代邮件服务器要求SSL/TLS连接

## 测试建议

1. 测试输入框是否显示黑色文字
2. 测试新增的三个checkbox是否正常工作
3. 测试保存设置后.env文件是否正确更新
4. 测试设置保存后agent是否正常重启
