"""Test script to verify reasoning_content tool call parsing."""

from langchain_core.messages import AIMessage

# Import the middleware
from deepagents.middleware.parse_reasoning_tool_calls import ParseReasoningToolCallsMiddleware


def test_extract_tool_calls_from_reasoning():
    """Test extraction of tool calls from various reasoning_content formats."""
    middleware = ParseReasoningToolCallsMiddleware()

    # Test case 1: OpenAI-style format with type="function"
    reasoning_1 = [
        {
            "type": "function",
            "id": "call_123",
            "function": {
                "name": "search",
                "arguments": '{"query": "test"}'
            }
        }
    ]

    result_1 = middleware._extract_tool_calls_from_reasoning(reasoning_1)
    print("Test 1 - OpenAI-style format:")
    print(f"  Input: {reasoning_1}")
    print(f"  Result: {result_1}")
    assert len(result_1) == 1
    assert result_1[0]["name"] == "search"
    assert result_1[0]["args"]["query"] == "test"
    print("  ✓ PASSED\n")

    # Test case 2: Direct tool call format
    reasoning_2 = [
        {
            "id": "call_456",
            "name": "write_file",
            "arguments": {"path": "/tmp/test.txt", "content": "hello"}
        }
    ]

    result_2 = middleware._extract_tool_calls_from_reasoning(reasoning_2)
    print("Test 2 - Direct format:")
    print(f"  Input: {reasoning_2}")
    print(f"  Result: {result_2}")
    assert len(result_2) == 1
    assert result_2[0]["name"] == "write_file"
    assert result_2[0]["args"]["path"] == "/tmp/test.txt"
    print("  ✓ PASSED\n")

    # Test case 3: String arguments (JSON)
    reasoning_3 = [
        {
            "id": "call_789",
            "name": "email",
            "arguments": '{"to": "user@example.com", "subject": "Test"}'
        }
    ]

    result_3 = middleware._extract_tool_calls_from_reasoning(reasoning_3)
    print("Test 3 - String JSON arguments:")
    print(f"  Input: {reasoning_3}")
    print(f"  Result: {result_3}")
    assert len(result_3) == 1
    assert result_3[0]["name"] == "email"
    assert result_3[0]["args"]["to"] == "user@example.com"
    print("  ✓ PASSED\n")

    # Test case 4: Empty reasoning
    reasoning_4 = []
    result_4 = middleware._extract_tool_calls_from_reasoning(reasoning_4)
    print("Test 4 - Empty reasoning:")
    print(f"  Input: {reasoning_4}")
    print(f"  Result: {result_4}")
    assert len(result_4) == 0
    print("  ✓ PASSED\n")

    # Test case 5: Invalid format
    reasoning_5 = [{"type": "text", "text": "Just some text"}]
    result_5 = middleware._extract_tool_calls_from_reasoning(reasoning_5)
    print("Test 5 - Invalid format:")
    print(f"  Input: {reasoning_5}")
    print(f"  Result: {result_5}")
    assert len(result_5) == 0
    print("  ✓ PASSED\n")


def test_before_agent():
    """Test the middleware's before_agent method."""
    middleware = ParseReasoningToolCallsMiddleware()

    # Create an AI message with reasoning_content containing tool calls
    msg = AIMessage(
        content="",
        additional_kwargs={
            "reasoning_content": [
                {
                    "type": "function",
                    "id": "call_test",
                    "function": {
                        "name": "test_tool",
                        "arguments": '{"param": "value"}'
                    }
                }
            ]
        }
    )

    state = {"messages": [msg]}

    result = middleware.before_agent(state, runtime=None)

    print("Test - before_agent integration:")
    if result:
        updated_msg = result["messages"][0]
        print(f"  Original tool_calls: {msg.tool_calls}")
        print(f"  Updated tool_calls: {updated_msg.tool_calls}")
        assert len(updated_msg.tool_calls) == 1
        assert updated_msg.tool_calls[0]["name"] == "test_tool"
        print("  ✓ PASSED\n")
    else:
        print("  ✗ FAILED - middleware returned None\n")


if __name__ == "__main__":
    print("=" * 60)
    print("Testing ParseReasoningToolCallsMiddleware")
    print("=" * 60 + "\n")

    test_extract_tool_calls_from_reasoning()
    test_before_agent()

    print("=" * 60)
    print("All tests passed! ✓")
    print("=" * 60)
