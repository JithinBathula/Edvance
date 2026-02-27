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
        def __init__(self, base_url, api_key):
            self.base_url = base_url
            self.api_key = api_key

        def create(self, model="gemini-model", messages=None, **kwargs):
            resp = _req.post(
                f"{self.base_url}/api/proxy/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
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
        def __init__(self, base_url, api_key):
            self.completions = _Completions(base_url, api_key)

    class OpenAI:
        def __init__(self, base_url = None, api_key = None, **kwargs):
            if not base_url: 
                raise ValueError("Missing base_url. It should be OpenAI(base_url, api_key).")
            if not api_key:
                raise ValueError("Missing api_key. It should be OpenAI(base_url, api_key).")
            self.chat = _Chat(base_url, api_key)

    mod = _types.ModuleType("openai")
    mod.OpenAI = OpenAI
    _sys.modules["openai"] = mod

_create_openai_module()
`;
