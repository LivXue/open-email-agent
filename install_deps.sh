#!/bin/bash
# 安装MailMind的所有依赖包

echo "Installing MailMind dependencies..."
echo "======================================"

# Email相关依赖
echo "Installing email-related packages..."
pip install better-proxy imap-tools python-socks

# LangChain相关依赖
echo "Installing LangChain packages..."
pip install langchain-qwq langchain-anthropic

# 其他依赖
echo "Installing other dependencies..."
pip install wcmatch tavily-python

# 创建address_book.json
echo "Creating address_book.json..."
cd /data/xuedizhan/deepagents
if [ ! -f address_book.json ]; then
    echo '{}' > address_book.json
    echo "✓ Created address_book.json"
else
    echo "✓ address_book.json already exists"
fi

echo ""
echo "======================================"
echo "Installation complete!"
echo ""
echo "Run the test script to verify:"
echo "  cd /data/xuedizhan/deepagents"
echo "  python test_agent_init.py"
echo ""
echo "Then start the servers:"
echo "  Backend:  cd /data/xuedizhan/deepagents/web_app/backend && python api_server.py"
echo "  Frontend: cd /data/xuedizhan/deepagents/web_app/frontend && npm run dev"
