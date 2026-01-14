"""Middleware to parse tool calls from reasoning_content in AI messages."""

from typing import Any

from langchain.agents.middleware import AgentMiddleware, AgentState
from langgraph.runtime import Runtime
from langgraph.types import Overwrite


class ParseReasoningToolCallsMiddleware(AgentMiddleware):
    """Middleware to parse tool calls from reasoning_content in AI messages.

    Some models (like those with reasoning/thinking capabilities) may return
    tool calls embedded in the reasoning_content field rather than in the
    standard tool_calls field. This middleware extracts those tool calls
    and adds them to the message's tool_calls list.
    """

    def before_agent(self, state: AgentState, runtime: Runtime[Any]) -> dict[str, Any] | None:  # noqa: ARG002
        """Before the agent runs, parse tool calls from reasoning_content.

        Args:
            state: The current agent state.
            runtime: The runtime instance.

        Returns:
            Updated state with parsed tool calls, or None if no changes needed.
        """
        messages = state.get("messages", [])
        if not messages:
            return None

        patched_messages = []
        has_changes = False

        for msg in messages:
            # Check if message is an AI message with reasoning_content
            if hasattr(msg, "additional_kwargs") and "reasoning_content" in msg.additional_kwargs:
                reasoning_content = msg.additional_kwargs["reasoning_content"]

                # Check if reasoning_content contains tool calls
                tool_calls_from_reasoning = self._extract_tool_calls_from_reasoning(
                    reasoning_content
                )

                if tool_calls_from_reasoning:
                    # Merge with existing tool_calls
                    existing_tool_calls = list(msg.tool_calls) if hasattr(msg, "tool_calls") else []

                    # Avoid duplicates by checking tool call IDs
                    existing_ids = {tc.get("id") for tc in existing_tool_calls if tc.get("id")}
                    new_tool_calls = [
                        tc for tc in tool_calls_from_reasoning
                        if tc.get("id") not in existing_ids
                    ]

                    if new_tool_calls:
                        # Create a new message with merged tool_calls
                        all_tool_calls = existing_tool_calls + new_tool_calls

                        # Create a copy of the message with updated tool_calls
                        if hasattr(msg, "model_copy"):
                            new_msg = msg.model_copy(update={"tool_calls": all_tool_calls})
                        else:
                            # Fallback for older message types
                            new_msg = msg
                            new_msg.tool_calls = all_tool_calls

                        patched_messages.append(new_msg)
                        has_changes = True
                        continue

            patched_messages.append(msg)

        if has_changes:
            return {"messages": Overwrite(patched_messages)}

        return None

    def _extract_tool_calls_from_reasoning(
        self, reasoning_content: Any
    ) -> list[dict[str, Any]]:
        """Extract tool calls from reasoning_content.

        Args:
            reasoning_content: The reasoning content which may contain tool calls.

        Returns:
            List of tool call dictionaries found in reasoning_content.
        """
        tool_calls = []

        # Handle string reasoning_content
        if isinstance(reasoning_content, str):
            # Try to parse as JSON if it looks like it might contain tool calls
            try:
                import json

                parsed = json.loads(reasoning_content)
                if isinstance(parsed, list):
                    for item in parsed:
                        tool_calls.extend(self._parse_single_tool_call(item))
                elif isinstance(parsed, dict):
                    tool_calls.extend(self._parse_single_tool_call(parsed))
            except (json.JSONDecodeError, TypeError):
                pass

        # Handle list reasoning_content
        elif isinstance(reasoning_content, list):
            for item in reasoning_content:
                tool_calls.extend(self._parse_single_tool_call(item))

        # Handle dict reasoning_content
        elif isinstance(reasoning_content, dict):
            tool_calls.extend(self._parse_single_tool_call(reasoning_content))

        return tool_calls

    def _parse_single_tool_call(self, item: Any) -> list[dict[str, Any]]:
        """Parse a single item that might be a tool call.

        Args:
            item: The item to parse.

        Returns:
            List containing the tool call if valid, empty list otherwise.
        """
        if not isinstance(item, dict):
            return []

        # Check for different tool call formats
        # Format 1: OpenAI-style with type="function"
        if item.get("type") == "function" and "function" in item:
            func = item["function"]
            if "name" in func and "arguments" in func:
                import json

                return [
                    {
                        "id": item.get("id", f"reasoning_tc_{id(func)}"),
                        "name": func["name"],
                        "args": json.loads(func["arguments"])
                        if isinstance(func["arguments"], str)
                        else func["arguments"],
                    }
                ]

        # Format 2: Direct tool call format
        if "name" in item and ("arguments" in item or "args" in item):
            import json

            args = item.get("arguments", item.get("arguments", {}))
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

        # Format 3: Check for nested tool_calls array
        if "tool_calls" in item and isinstance(item["tool_calls"], list):
            return self._extract_tool_calls_from_reasoning(item["tool_calls"])

        return []
