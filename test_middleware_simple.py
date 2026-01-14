"""Simple test to verify the reasoning_content tool call parsing logic."""

import json


def extract_tool_calls_from_reasoning(reasoning_content):
    """Extract tool calls from reasoning_content (simplified version from middleware)."""
    tool_calls = []

    # Handle string reasoning_content
    if isinstance(reasoning_content, str):
        try:
            parsed = json.loads(reasoning_content)
            if isinstance(parsed, list):
                for item in parsed:
                    tool_calls.extend(_parse_single_tool_call(item))
            elif isinstance(parsed, dict):
                tool_calls.extend(_parse_single_tool_call(parsed))
        except (json.JSONDecodeError, TypeError):
            pass

    # Handle list reasoning_content
    elif isinstance(reasoning_content, list):
        for item in reasoning_content:
            tool_calls.extend(_parse_single_tool_call(item))

    # Handle dict reasoning_content
    elif isinstance(reasoning_content, dict):
        tool_calls.extend(_parse_single_tool_call(reasoning_content))

    return tool_calls


def _parse_single_tool_call(item):
    """Parse a single item that might be a tool call."""
    if not isinstance(item, dict):
        return []

    # Format 1: OpenAI-style with type="function"
    if item.get("type") == "function" and "function" in item:
        func = item["function"]
        if "name" in func and "arguments" in func:
            return [
                {
                    "id": item.get("id", f"reasoning_tc_{id(item)}"),
                    "name": func["name"],
                    "args": json.loads(func["arguments"])
                    if isinstance(func["arguments"], str)
                    else func["arguments"],
                }
            ]

    # Format 2: Direct tool call format
    if "name" in item and ("arguments" in item or "args" in item):
        args = item.get("arguments", item.get("args", {}))
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except json.JSONDecodeError:
                args = {}

        return [
            {
                "id": item.get("id", f"reasoning_tc_{id(item)}"),
                "name": item["name"],
                "args": args,
            }
        ]

    return []


def main():
    print("=" * 60)
    print("Testing Reasoning Content Tool Call Parsing")
    print("=" * 60)
    print()

    # Test case 1: OpenAI-style format
    print("Test 1: OpenAI-style format with type='function'")
    reasoning_1 = [
        {
            "type": "function",
            "id": "call_123",
            "function": {
                "name": "search",
                "arguments": '{"query": "test search"}'
            }
        }
    ]
    result_1 = extract_tool_calls_from_reasoning(reasoning_1)
    print(f"  Input: {json.dumps(reasoning_1, indent=2)}")
    print(f"  Result: {json.dumps(result_1, indent=2)}")
    assert len(result_1) == 1
    assert result_1[0]["name"] == "search"
    assert result_1[0]["args"]["query"] == "test search"
    print("  ✓ PASSED\n")

    # Test case 2: Direct format with dict arguments
    print("Test 2: Direct format with dict arguments")
    reasoning_2 = [
        {
            "id": "call_456",
            "name": "write_file",
            "arguments": {
                "path": "/tmp/test.txt",
                "content": "hello world"
            }
        }
    ]
    result_2 = extract_tool_calls_from_reasoning(reasoning_2)
    print(f"  Input: {json.dumps(reasoning_2, indent=2)}")
    print(f"  Result: {json.dumps(result_2, indent=2)}")
    assert len(result_2) == 1
    assert result_2[0]["name"] == "write_file"
    assert result_2[0]["args"]["path"] == "/tmp/test.txt"
    print("  ✓ PASSED\n")

    # Test case 3: String JSON arguments
    print("Test 3: String JSON arguments")
    reasoning_3 = [
        {
            "id": "call_789",
            "name": "send_email",
            "arguments": '{"to": "user@example.com", "subject": "Test Email", "body": "Hello"}'
        }
    ]
    result_3 = extract_tool_calls_from_reasoning(reasoning_3)
    print(f"  Input: {json.dumps(reasoning_3, indent=2)}")
    print(f"  Result: {json.dumps(result_3, indent=2)}")
    assert len(result_3) == 1
    assert result_3[0]["name"] == "send_email"
    assert result_3[0]["args"]["to"] == "user@example.com"
    print("  ✓ PASSED\n")

    # Test case 4: Multiple tool calls
    print("Test 4: Multiple tool calls")
    reasoning_4 = [
        {
            "type": "function",
            "id": "call_1",
            "function": {
                "name": "search",
                "arguments": '{"query": "weather"}'
            }
        },
        {
            "type": "function",
            "id": "call_2",
            "function": {
                "name": "write_file",
                "arguments": '{"path": "/tmp/weather.txt", "content": "sunny"}'
            }
        }
    ]
    result_4 = extract_tool_calls_from_reasoning(reasoning_4)
    print(f"  Input: {json.dumps(reasoning_4, indent=2)}")
    print(f"  Result: {json.dumps(result_4, indent=2)}")
    assert len(result_4) == 2
    assert result_4[0]["name"] == "search"
    assert result_4[1]["name"] == "write_file"
    print("  ✓ PASSED\n")

    # Test case 5: Empty reasoning
    print("Test 5: Empty reasoning content")
    reasoning_5 = []
    result_5 = extract_tool_calls_from_reasoning(reasoning_5)
    print(f"  Input: {reasoning_5}")
    print(f"  Result: {result_5}")
    assert len(result_5) == 0
    print("  ✓ PASSED\n")

    # Test case 6: Invalid format (no tool calls)
    print("Test 6: Invalid format (no tool calls)")
    reasoning_6 = [{"type": "text", "text": "Just some reasoning text"}]
    result_6 = extract_tool_calls_from_reasoning(reasoning_6)
    print(f"  Input: {json.dumps(reasoning_6, indent=2)}")
    print(f"  Result: {result_6}")
    assert len(result_6) == 0
    print("  ✓ PASSED\n")

    print("=" * 60)
    print("All tests passed! ✓")
    print("=" * 60)
    print()
    print("The middleware will:")
    print("1. Parse tool calls from reasoning_content in AI messages")
    print("2. Support OpenAI-style format (type='function')")
    print("3. Support direct format with name/arguments")
    print("4. Handle both string and dict arguments")
    print("5. Merge extracted tool calls with existing tool_calls")


if __name__ == "__main__":
    main()
