"""
Full AI Chatbot test for the proxy endpoint.
Tests multi-turn conversation, streaming, and error handling.

Usage:
  1. Start the backend:  python app.py
  2. Paste your Supabase JWT below (F12 → Application → Local Storage → sb-*-auth-token → access_token)
  3. Run:  python test_proxy.py
"""
from openai import OpenAI

# Paste your FULL token between the quotes (all 3 parts: header.payload.signature)
TOKEN = "PASTE_YOUR_TOKEN_HERE"

BASE_URL = "http://localhost:8000/api/proxy/v1"
MODEL = "gemini-model"

client = OpenAI(base_url=BASE_URL, api_key=TOKEN)


def test_single_message():
    """Test 1: Basic single message."""
    print("=" * 50)
    print("TEST 1: Single message")
    print("=" * 50)
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": "Say hello in one sentence."}],
    )
    reply = response.choices[0].message.content
    print(f"Bot: {reply}")
    assert reply and len(reply) > 0, "Empty response!"
    print("PASSED\n")


def test_multi_turn_conversation():
    """Test 2: Multi-turn chatbot conversation (memory via message history)."""
    print("=" * 50)
    print("TEST 2: Multi-turn conversation")
    print("=" * 50)

    messages = [
        {"role": "system", "content": "You are a friendly coding tutor named Cody. Keep answers short (1-2 sentences)."},
    ]

    user_messages = [
        "Hi Cody! My name is Alex.",
        "What's my name?",
        "Can you explain what a variable is in Python?",
        "Give me a one-line example of a variable.",
    ]

    for user_msg in user_messages:
        messages.append({"role": "user", "content": user_msg})
        print(f"User: {user_msg}")

        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
        )
        reply = response.choices[0].message.content
        messages.append({"role": "assistant", "content": reply})
        print(f"Cody: {reply}\n")

    # Check that the bot remembered the name in turn 2
    assert "Alex" in messages[3]["content"] or "alex" in messages[3]["content"].lower(), \
        "Bot didn't remember the user's name!"
    print("PASSED\n")


def test_streaming():
    """Test 3: Streaming response."""
    print("=" * 50)
    print("TEST 3: Streaming response")
    print("=" * 50)
    print("Bot: ", end="", flush=True)

    stream = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": "Count from 1 to 5, one number per line."}],
        stream=True,
    )

    full_response = ""
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            text = chunk.choices[0].delta.content
            print(text, end="", flush=True)
            full_response += text

    print("\n")
    assert len(full_response) > 0, "Streaming returned empty response!"
    print("PASSED\n")


def test_system_prompt():
    """Test 4: System prompt changes bot behavior."""
    print("=" * 50)
    print("TEST 4: System prompt behavior")
    print("=" * 50)

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": "You are a pirate. Every response must include 'Arrr'."},
            {"role": "user", "content": "How are you today?"},
        ],
    )
    reply = response.choices[0].message.content
    print(f"Bot: {reply}")
    assert "arrr" in reply.lower() or "arr" in reply.lower(), "System prompt didn't affect behavior!"
    print("PASSED\n")


def test_code_generation():
    """Test 5: Ask the bot to generate Python code (chatbot use case)."""
    print("=" * 50)
    print("TEST 5: Code generation")
    print("=" * 50)

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": "You are a Python coding tutor. When asked for code, provide working Python code."},
            {"role": "user", "content": "Write a Python function called greet(name) that returns 'Hello, <name>!'"},
        ],
    )
    reply = response.choices[0].message.content
    print(f"Bot: {reply}")
    assert "def greet" in reply or "def Greet" in reply, "Bot didn't generate the function!"
    print("PASSED\n")


if __name__ == "__main__":
    if TOKEN == "PASTE_YOUR_TOKEN_HERE":
        print("ERROR: Paste your Supabase JWT token in the TOKEN variable first!")
        print("Find it: F12 -> Application -> Local Storage -> sb-*-auth-token -> access_token")
        exit(1)

    print("\nAI Chatbot Proxy Test Suite")
    print("=" * 50)
    print(f"Proxy: {BASE_URL}")
    print(f"Model: {MODEL}\n")

    passed = 0
    failed = 0
    tests = [
        test_single_message,
        test_multi_turn_conversation,
        test_streaming,
        test_system_prompt,
        test_code_generation,
    ]

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"FAILED: {e}\n")
            failed += 1

    print("=" * 50)
    print(f"RESULTS: {passed}/{passed + failed} tests passed")
    if failed == 0:
        print("All tests passed! Your AI proxy is working perfectly.")
    else:
        print(f"{failed} test(s) failed. Check the errors above.")
