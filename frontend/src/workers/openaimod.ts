export const openaiShimCode = `
import requests as _req
import os as _os
import types as _types
import sys as _sys

def _create_openai_module():
    class _Message:
        def __init__(self, content):
            self.content = content

    class _Choice:
        def __init__(self, message):
            self.message = message

    class _ChatResponse:
        def __init__(self, choices):
            self.choices = choices

    class _Completions:
        def create(self, model="gemini-model", messages=None, **kwargs):
            token = _os.environ.get("AUTH_TOKEN", "")
            proxy_url = _os.environ.get("PROXY_URL", "http://localhost:8000")
            resp = _req.post(
                f"{proxy_url}/api/proxy/v1/chat/completions",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages or []}
            )
            data = resp.json()
            if resp.status_code != 200:
                if isinstance(data, dict):
                    err_msg = data.get("error", {}).get("message", f"AI request failed ({resp.status_code})")
                else:
                    err_msg = f"AI request failed ({resp.status_code}): {data}"
                raise Exception(err_msg)

            if isinstance(data, list):
                raise Exception(f"Unexpected response format: {data}")
            choices = [_Choice(_Message(c["message"]["content"])) for c in data.get("choices", [])]
            return _ChatResponse(choices)

    class _Chat:
        def __init__(self):
            self.completions = _Completions()

    class OpenAI:
        def __init__(self, **kwargs):
            self.chat = _Chat()

    mod = _types.ModuleType("openai")
    mod.OpenAI = OpenAI
    _sys.modules["openai"] = mod

_create_openai_module()
`;
