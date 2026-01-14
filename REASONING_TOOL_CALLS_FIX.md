# 修复: 解析 reasoning_content 中的工具调用

## 问题描述

在使用 deepagents 开发 agent 时,某些支持推理/思考功能的大模型(如启用了 `thinking: {type: "enabled"}` 的模型)会将工具调用信息嵌入在 `reasoning_content` 字段中,而不是标准的 `tool_calls` 字段。这导致 deepagents 无法识别和执行这些工具调用。

## 解决方案

创建了一个新的中间件 `ParseReasoningToolCallsMiddleware`,在 agent 运行前自动从 `reasoning_content` 中提取工具调用,并将其添加到消息的 `tool_calls` 列表中。

## 实现细节

### 新增文件

- **[deepagents/middleware/parse_reasoning_tool_calls.py](deepagents/middleware/parse_reasoning_tool_calls.py)**

  这个中间件支持以下格式:

  1. **OpenAI 风格格式**:
     ```json
     {
       "type": "function",
       "id": "call_123",
       "function": {
         "name": "tool_name",
         "arguments": "{\"param\": \"value\"}"
       }
     }
     ```

  2. **直接格式**:
     ```json
     {
       "id": "call_456",
       "name": "tool_name",
       "arguments": {
         "param": "value"
       }
     }
     ```

  3. **字符串参数** (自动 JSON 解析):
     ```json
     {
       "name": "tool_name",
       "arguments": "{\"param\": \"value\"}"
     }
     ```

### 修改文件

- **[deepagents/graph.py](deepagents/graph.py)**

  - 导入 `ParseReasoningToolCallsMiddleware`
  - 在两个中间件栈中都添加了该中间件:
    - 主 agent 的中间件栈
    - 子 agent 的中间件栈
  - 将其放置在 `PatchToolCallsMiddleware` 之前,确保工具调用被正确提取后再处理

## 工作流程

1. AI 模型返回包含 `reasoning_content` 的消息
2. `ParseReasoningToolCallsMiddleware.before_agent()` 被调用
3. 中间件检查消息的 `additional_kwargs` 中是否有 `reasoning_content`
4. 如果存在,解析其中的工具调用
5. 将提取的工具调用与现有的 `tool_calls` 合并(去重)
6. 后续中间件(如 `PatchToolCallsMiddleware`)可以正常处理这些工具调用

## 测试

运行测试脚本验证核心逻辑:

```bash
python test_middleware_simple.py
```

测试覆盖的场景:
- ✓ OpenAI 风格格式 (type="function")
- ✓ 直接格式 with dict 参数
- ✓ 字符串 JSON 参数
- ✓ 多个工具调用
- ✓ 空 reasoning_content
- ✓ 无效格式

## 使用示例

在你的 `test.py` 中,无需任何代码更改。修复会自动生效:

```python
from deepagents import create_deep_agent

agent = create_deep_agent(
    model=chat_model,
    system_prompt=MAIN_PROMPT,
    tools=[internet_search, email_dashboard, ...],
)

# 现在 agent 可以正确处理 reasoning_content 中的工具调用了
result = agent.invoke({"messages": messages})
```

## 兼容性

- ✓ 不影响现有的工具调用机制
- ✓ 只在 `reasoning_content` 存在且包含工具调用时才进行处理
- ✓ 支持所有主流的 reasoning_content 格式
- ✓ 自动去重,避免重复添加工具调用

## 相关文件

- [deepagents/middleware/parse_reasoning_tool_calls.py](deepagents/middleware/parse_reasoning_tool_calls.py) - 中间件实现
- [deepagents/graph.py](deepagents/graph.py) - 中间件注册
- [test_middleware_simple.py](test_middleware_simple.py) - 单元测试
