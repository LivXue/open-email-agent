"""Middleware to patch ToolMessage objects with None tool_call_id."""

from typing import Any

from langchain.agents.middleware import AgentMiddleware, AgentState
from langchain_core.messages import ToolMessage
from langgraph.runtime import Runtime
from langgraph.types import Overwrite


class PatchToolMessageIdsMiddleware(AgentMiddleware):
    """Middleware to patch ToolMessage objects that have None tool_call_id.

    In some cases, particularly with certain model configurations or during
    streaming, ToolMessage objects may be created with tool_call_id=None,
    which causes Pydantic validation errors. This middleware generates valid
    tool_call_id values for such messages.
    """

    def before_agent(self, state: AgentState, runtime: Runtime[Any]) -> dict[str, Any] | None:  # noqa: ARG002
        """Before the agent runs, patch any ToolMessage with None tool_call_id.

        Args:
            state: The current agent state.
            runtime: The runtime instance.

        Returns:
            Updated state with patched ToolMessage objects, or None if no changes needed.
        """
        messages = state.get("messages", [])
        if not messages:
            return None

        patched_messages = []
        has_changes = False

        for msg in messages:
            # Check if message is a ToolMessage with None tool_call_id
            if isinstance(msg, ToolMessage):
                tool_call_id = msg.tool_call_id
                if tool_call_id is None:
                    # Generate a valid tool_call_id
                    import time
                    import uuid

                    new_id = f"patched_{int(time.time() * 1000)}_{str(uuid.uuid4())[:8]}"

                    # Create a new ToolMessage with valid tool_call_id
                    new_msg = ToolMessage(
                        content=msg.content,
                        tool_call_id=new_id,
                        name=msg.name
                    )
                    patched_messages.append(new_msg)
                    has_changes = True
                    continue

            patched_messages.append(msg)

        if has_changes:
            return {"messages": Overwrite(patched_messages)}

        return None
