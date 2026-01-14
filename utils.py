from langchain_core.messages.base import BaseMessage, get_msg_title_repr
from langchain_core.utils.interactive_env import is_interactive_env
from deepagents.backends import FilesystemBackend


def pretty_print(msg: BaseMessage, display_reasoning: bool = False):
    html=is_interactive_env()
    title = get_msg_title_repr(msg.type.title() + " Message", bold=html)
    # TODO: handle non-string content.
    if msg.name is not None:
        title += f"\nName: {msg.name}"
    print(title)
    for block in msg.content_blocks:
        if block["type"] == "text":
            print(block["text"])
        elif block["type"] == "reasoning" and display_reasoning:
            print(f"\033[90m<think>\n{block['reasoning'].strip()}\n</think>\033[0m")
        elif block["type"] == "tool_call":
            print(f"<tool_call>\n{block['name']}({', '.join(k + '=' + str(v) for k, v in block['args'].items())})\n</tool_call>")

def get_fs_system(root_dir: str = "/data/xuedizhan/deepagents/tmp"):
    fs = FilesystemBackend(root_dir=root_dir)
    # Add custom files here
    #fs.write("address_book.txt", open("knowledge/address_book.txt").read())
    return fs
    