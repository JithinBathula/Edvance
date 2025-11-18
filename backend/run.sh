#!/bin/bash

# EdTech Planning Service - Quick Start Script

echo "🚀 Starting EdTech Planning Service..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "❗ Please edit .env file and add your OPENAI_API_KEY"
    echo "   Then run this script again."
    exit 1
fi

# Check if OPENAI_API_KEY is set
source .env
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
    echo "❗ OPENAI_API_KEY not configured in .env file"
    echo "   Please add your OpenAI API key to continue."
    exit 1
fi

# Start the server
echo ""
echo "✅ All checks passed!"
echo "🌐 Starting Flask server on port ${PORT:-5000}..."
echo ""
python app.py

