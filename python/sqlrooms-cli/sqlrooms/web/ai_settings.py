from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import secrets
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlsplit, urlunsplit

import httpx
import tomlkit

OAUTH_DUMMY_KEY = "sqlrooms-local-proxy"
OPENAI_CLI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
OPENAI_AUTH_ISSUER = "https://auth.openai.com"
OPENAI_CODEX_API_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses"
ANTHROPIC_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"

if sys.platform.startswith("win"):
    _config_base = Path(os.environ.get("APPDATA", "")) / "sqlrooms"
else:
    _config_base = Path.home() / ".config" / "sqlrooms"
DEFAULT_AUTH_PATH = _config_base / "auth.toml"


def _read_toml(path: Path) -> dict[str, Any]:
    try:
        import tomllib  # type: ignore[attr-defined]
    except ModuleNotFoundError:
        import tomli as tomllib  # type: ignore[no-redef]
    with path.open("rb") as fh:
        data = tomllib.load(fh)
    if not isinstance(data, dict):
        raise RuntimeError(f"SQLRooms config must be a TOML object: {path}")
    return data


def _normalize_config_string(value: Any) -> str | None:
    if isinstance(value, (int, float)):
        return str(value)
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _generate_pkce() -> tuple[str, str]:
    verifier = _b64url(secrets.token_bytes(32))
    challenge = _b64url(hashlib.sha256(verifier.encode("utf-8")).digest())
    return verifier, challenge


def _default_ai_settings_config() -> dict[str, Any]:
    return {
        "defaultProvider": "openai",
        "defaultModel": "gpt-5",
        "providers": {
            "openai": {
                "title": "OpenAI",
                "kind": "builtin",
                "baseUrl": "https://api.openai.com/v1",
                "apiKey": "",
                "models": [{"modelName": "gpt-5"}, {"modelName": "gpt-4.1"}],
                "defaultAuthMethod": "manual_api_key",
                "authMethods": [
                    {
                        "id": "codex_browser",
                        "type": "oauth_auto",
                        "label": "ChatGPT Pro/Plus (browser)",
                        "description": "Use your ChatGPT subscription through Codex.",
                        "experimental": True,
                    },
                    {
                        "id": "codex_headless",
                        "type": "device_code",
                        "label": "ChatGPT Pro/Plus (headless)",
                        "description": "Device-code flow for SSH or container sessions.",
                        "experimental": True,
                    },
                    {
                        "id": "env_api_key",
                        "type": "env_api_key",
                        "label": "Use OPENAI_API_KEY",
                        "envVar": "OPENAI_API_KEY",
                    },
                    {
                        "id": "manual_api_key",
                        "type": "api_key",
                        "label": "Manually enter API Key",
                    },
                ],
                "experimental": False,
            },
            "anthropic": {
                "title": "Anthropic",
                "kind": "builtin",
                "baseUrl": "https://api.anthropic.com/v1",
                "apiKey": "",
                "models": [{"modelName": "claude-4-sonnet"}],
                "defaultAuthMethod": "manual_api_key",
                "authMethods": [
                    {
                        "id": "claude_pro",
                        "type": "oauth_code",
                        "label": "Claude Pro/Max",
                        "description": "Use your Claude Pro/Max subscription.",
                        "experimental": True,
                    },
                    {
                        "id": "create_api_key",
                        "type": "oauth_to_api_key",
                        "label": "Create an API Key",
                        "description": "Create an Anthropic API key using OAuth.",
                        "experimental": True,
                    },
                    {
                        "id": "env_api_key",
                        "type": "env_api_key",
                        "label": "Use ANTHROPIC_API_KEY",
                        "envVar": "ANTHROPIC_API_KEY",
                    },
                    {
                        "id": "manual_api_key",
                        "type": "api_key",
                        "label": "Manually enter API Key",
                    },
                ],
                "experimental": False,
            },
            "ollama": {
                "title": "Ollama",
                "kind": "builtin",
                "baseUrl": "http://127.0.0.1:11434/v1",
                "apiKey": "",
                "models": [{"modelName": "llama3.1"}],
                "defaultAuthMethod": "local",
                "authMethods": [
                    {
                        "id": "local",
                        "type": "local",
                        "label": "Use local runtime",
                    }
                ],
                "experimental": False,
            },
            "lmstudio": {
                "title": "LM Studio",
                "kind": "builtin",
                "baseUrl": "http://127.0.0.1:1234/v1",
                "apiKey": "",
                "models": [],
                "defaultAuthMethod": "local",
                "authMethods": [
                    {
                        "id": "local",
                        "type": "local",
                        "label": "Use local runtime",
                    }
                ],
                "experimental": False,
            },
        },
        "customModels": [],
        "modelParameters": {
            "maxSteps": 50,
            "additionalInstruction": "",
        },
    }


def _default_status() -> dict[str, Any]:
    return {
        "hasCredentials": False,
        "credentialType": None,
        "expiresAt": None,
        "selectedAuthMethod": None,
        "status": "disconnected",
    }


def _parse_auth_method(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _normalize_config_string(raw.get("id")) or "",
        "type": _normalize_config_string(raw.get("type")) or "api_key",
        "label": _normalize_config_string(raw.get("label")) or "",
        "description": _normalize_config_string(raw.get("description")) or "",
        "experimental": bool(raw.get("experimental")),
        "envVar": _normalize_config_string(raw.get("env_var"))
        or _normalize_config_string(raw.get("envVar")),
        "metadata": {
            str(key): str(value)
            for key, value in (raw.get("metadata") or {}).items()
            if isinstance(key, str)
        }
        if isinstance(raw.get("metadata"), dict)
        else {},
    }


def _parse_provider(raw: dict[str, Any]) -> dict[str, Any]:
    models_raw = raw.get("models") or []
    auth_methods_raw = raw.get("auth_methods") or raw.get("authMethods") or []
    models = []
    if isinstance(models_raw, list):
        for model in models_raw:
            model_name = _normalize_config_string(model)
            if model_name:
                models.append({"modelName": model_name})
    auth_methods = []
    if isinstance(auth_methods_raw, list):
        for method in auth_methods_raw:
            if isinstance(method, dict):
                parsed = _parse_auth_method(method)
                if parsed["id"]:
                    auth_methods.append(parsed)
    return {
        "title": _normalize_config_string(raw.get("title")) or "",
        "kind": _normalize_config_string(raw.get("kind")) or "builtin",
        "baseUrl": _normalize_config_string(raw.get("base_url"))
        or _normalize_config_string(raw.get("baseUrl"))
        or "",
        "apiKey": "",
        "models": models,
        "defaultAuthMethod": _normalize_config_string(raw.get("default_auth_method"))
        or _normalize_config_string(raw.get("defaultAuthMethod")),
        "authMethods": auth_methods,
        "experimental": bool(raw.get("experimental")),
    }


def load_ai_settings_config(path: Path | None) -> dict[str, Any]:
    config = _default_ai_settings_config()
    if path is None or not path.exists():
        return config

    raw = _read_toml(path)
    ai = raw.get("ai")
    if not isinstance(ai, dict):
        return config

    default_provider = _normalize_config_string(ai.get("default_provider"))
    default_model = _normalize_config_string(ai.get("default_model"))
    if default_provider:
        config["defaultProvider"] = default_provider
    if default_model:
        config["defaultModel"] = default_model

    providers_raw = ai.get("providers") or []
    if providers_raw and not isinstance(providers_raw, list):
        raise RuntimeError("'ai.providers' must be an array in SQLRooms config.")

    if isinstance(providers_raw, list):
        for idx, item in enumerate(providers_raw):
            if not isinstance(item, dict):
                raise RuntimeError(
                    f"AI provider entry at index {idx} must be an object."
                )
            provider_id = _normalize_config_string(item.get("id"))
            if not provider_id:
                raise RuntimeError(
                    f"AI provider entry at index {idx} must include a non-empty id."
                )
            current = config["providers"].get(provider_id, {})
            config["providers"][provider_id] = {
                **current,
                **_parse_provider(item),
            }
            if not config["providers"][provider_id].get("title"):
                config["providers"][provider_id]["title"] = provider_id
            if not config["providers"][provider_id].get("defaultAuthMethod"):
                methods = config["providers"][provider_id].get("authMethods") or []
                if methods:
                    config["providers"][provider_id]["defaultAuthMethod"] = methods[0][
                        "id"
                    ]

    if config["defaultProvider"] not in config["providers"]:
        raise RuntimeError(
            f"AI default_provider '{config['defaultProvider']}' is not defined under ai.providers."
        )

    if not config.get("defaultModel"):
        default_provider = config["providers"].get(config["defaultProvider"], {})
        models = default_provider.get("models") or []
        if models:
            config["defaultModel"] = models[0].get("modelName") or ""

    return config


def _replace_ai_section(
    doc: tomlkit.TOMLDocument, config: dict[str, Any]
) -> tomlkit.TOMLDocument:
    if "ai" in doc:
        del doc["ai"]  # type: ignore[arg-type]

    ai_table = tomlkit.table()
    ai_table.add("default_provider", config.get("defaultProvider") or "")
    ai_table.add("default_model", config.get("defaultModel") or "")

    providers_aot = tomlkit.aot()
    for provider_id, provider in config.get("providers", {}).items():
        item = tomlkit.table()
        item.add("id", provider_id)
        item.add("title", provider.get("title") or provider_id)
        item.add("kind", provider.get("kind") or "builtin")
        item.add("base_url", provider.get("baseUrl") or "")
        item.add(
            "models",
            [model.get("modelName") for model in provider.get("models", [])],
        )
        default_auth_method = provider.get("defaultAuthMethod")
        if default_auth_method:
            item.add("default_auth_method", default_auth_method)
        if provider.get("experimental") is not None:
            item.add("experimental", bool(provider.get("experimental")))
        auth_methods = tomlkit.aot()
        for method in provider.get("authMethods", []):
            method_item = tomlkit.table()
            method_item.add("id", method.get("id") or "")
            method_item.add("type", method.get("type") or "api_key")
            method_item.add("label", method.get("label") or "")
            if method.get("description"):
                method_item.add("description", method.get("description"))
            if method.get("experimental"):
                method_item.add("experimental", True)
            if method.get("envVar"):
                method_item.add("env_var", method.get("envVar"))
            metadata = method.get("metadata") or {}
            if metadata:
                method_item.add("metadata", metadata)
            auth_methods.append(method_item)
        item.add("auth_methods", auth_methods)
        providers_aot.append(item)
    ai_table.add("providers", providers_aot)

    doc.add("ai", ai_table)
    return doc


def write_ai_settings_to_toml(config_path: Path, config: dict[str, Any]) -> None:
    if config_path.exists():
        doc = tomlkit.parse(config_path.read_text(encoding="utf-8"))
    else:
        doc = tomlkit.document()
        config_path.parent.mkdir(parents=True, exist_ok=True)

    doc = _replace_ai_section(doc, config)
    raw = tomlkit.dumps(doc)
    raw = re.sub(r"\n{3,}", "\n\n", raw)
    config_path.write_text(raw, encoding="utf-8")


def load_auth_store(path: Path | None) -> dict[str, dict[str, Any]]:
    if path is None or not path.exists():
        return {}
    raw = _read_toml(path)
    ai = raw.get("ai")
    if not isinstance(ai, dict):
        return {}
    credentials = ai.get("credentials")
    if not isinstance(credentials, dict):
        return {}
    result: dict[str, dict[str, Any]] = {}
    for provider_id, payload in credentials.items():
        if isinstance(provider_id, str) and isinstance(payload, dict):
            result[provider_id] = dict(payload)
    return result


def write_auth_store(path: Path, credentials: dict[str, dict[str, Any]]) -> None:
    if path.exists():
        doc = tomlkit.parse(path.read_text(encoding="utf-8"))
    else:
        doc = tomlkit.document()
        path.parent.mkdir(parents=True, exist_ok=True)

    ai_table = tomlkit.table()
    credentials_table = tomlkit.table()
    for provider_id, payload in credentials.items():
        item = tomlkit.table()
        for key, value in payload.items():
            if value is None:
                continue
            item.add(key, value)
        credentials_table.add(provider_id, item)
    ai_table.add("credentials", credentials_table)
    if "ai" in doc:
        del doc["ai"]  # type: ignore[arg-type]
    doc.add("ai", ai_table)
    path.write_text(tomlkit.dumps(doc), encoding="utf-8")
    os.chmod(path, 0o600)


def _find_auth_method(
    provider: dict[str, Any], method_id: str | None
) -> dict[str, Any] | None:
    for method in provider.get("authMethods", []):
        if method.get("id") == method_id:
            return method
    return None


def _resolve_selected_method(
    provider: dict[str, Any], credential: dict[str, Any] | None
) -> str | None:
    selected = _normalize_config_string((credential or {}).get("selected_auth_method"))
    if selected:
        return selected
    return _normalize_config_string(provider.get("defaultAuthMethod"))


def _resolve_env_api_key(provider: dict[str, Any], method_id: str | None) -> str | None:
    method = _find_auth_method(provider, method_id)
    env_var = _normalize_config_string((method or {}).get("envVar"))
    if env_var:
        return _normalize_config_string(os.environ.get(env_var))
    return None


def _provider_status(
    provider: dict[str, Any], credential: dict[str, Any] | None
) -> dict[str, Any]:
    status = _default_status()
    selected = _resolve_selected_method(provider, credential)
    status["selectedAuthMethod"] = selected
    if not selected:
        return status

    method = _find_auth_method(provider, selected)
    if not method:
        return status

    method_type = method.get("type")
    if method_type == "local":
        status["hasCredentials"] = True
        status["credentialType"] = "local"
        status["status"] = "connected"
        return status

    if method_type == "env_api_key":
        api_key = _resolve_env_api_key(provider, selected)
        status["hasCredentials"] = bool(api_key)
        status["credentialType"] = "env_api_key" if api_key else None
        status["status"] = "connected" if api_key else "disconnected"
        return status

    if not credential:
        return status

    if credential.get("type") == "api_key" and credential.get("api_key"):
        status["hasCredentials"] = True
        status["credentialType"] = "api_key"
        status["status"] = "connected"
        return status

    if credential.get("type") == "oauth" and credential.get("access_token"):
        expires_at = credential.get("expires_at")
        status["hasCredentials"] = True
        status["credentialType"] = "oauth"
        status["expiresAt"] = int(expires_at) if isinstance(expires_at, int) else None
        status["status"] = "connected"
        return status

    return status


def _browser_provider(
    provider_id: str,
    provider: dict[str, Any],
    credential: dict[str, Any] | None,
    api_base_url: str,
    *,
    safe_only: bool,
) -> dict[str, Any]:
    status = _provider_status(provider, credential)
    selected = status.get("selectedAuthMethod")
    method = _find_auth_method(provider, selected)
    method_type = (method or {}).get("type")
    is_server_managed = provider_id in {"openai", "anthropic"}
    base_url = provider.get("baseUrl") or ""
    api_key = ""
    if is_server_managed:
        upstream_parts = urlsplit(base_url)
        upstream_path = upstream_parts.path.rstrip("/")
        base_url = (f"{api_base_url}/api/ai/proxy/{provider_id}{upstream_path}").rstrip(
            "/"
        )
        api_key = "" if safe_only else OAUTH_DUMMY_KEY
    elif not safe_only:
        api_key = provider.get("apiKey") or ""
    return {
        "title": provider.get("title") or provider_id,
        "kind": provider.get("kind") or "builtin",
        "baseUrl": base_url,
        "apiKey": api_key,
        "models": provider.get("models") or [],
        "defaultAuthMethod": provider.get("defaultAuthMethod"),
        "authMethods": provider.get("authMethods") or [],
        "experimental": bool(provider.get("experimental")),
        "status": status,
        "selectedAuthMethod": status.get("selectedAuthMethod"),
        "hasCredentials": bool(status.get("hasCredentials")),
        "credentialType": status.get("credentialType"),
        "expiresAt": status.get("expiresAt"),
        "proxyEnabled": is_server_managed,
        "upstreamBaseUrl": provider.get("baseUrl") or "",
        "authMethodType": method_type,
    }


def build_ai_settings_response(
    config_path: Path | None, auth_path: Path | None, api_base_url: str
) -> dict[str, Any]:
    config = load_ai_settings_config(config_path)
    auth_store = load_auth_store(auth_path)
    providers = {}
    for provider_id, provider in config["providers"].items():
        providers[provider_id] = _browser_provider(
            provider_id,
            provider,
            auth_store.get(provider_id),
            api_base_url,
            safe_only=False,
        )
    return {
        "config": {
            **config,
            "providers": providers,
        }
    }


def build_runtime_ai_providers(
    config_path: Path | None, auth_path: Path | None, api_base_url: str
) -> tuple[str | None, str | None, dict[str, dict[str, Any]]]:
    config = load_ai_settings_config(config_path)
    auth_store = load_auth_store(auth_path)
    providers = {}
    for provider_id, provider in config["providers"].items():
        providers[provider_id] = _browser_provider(
            provider_id,
            provider,
            auth_store.get(provider_id),
            api_base_url,
            safe_only=True,
        )
    return config.get("defaultProvider"), config.get("defaultModel"), providers


def _extract_openai_account_id(tokens: dict[str, Any]) -> str | None:
    for token_key in ("id_token", "access_token"):
        token = _normalize_config_string(tokens.get(token_key))
        if not token or token.count(".") != 2:
            continue
        try:
            payload = json.loads(
                base64.urlsafe_b64decode(token.split(".")[1] + "==").decode("utf-8")
            )
        except Exception:
            continue
        if isinstance(payload, dict):
            account_id = _normalize_config_string(payload.get("chatgpt_account_id"))
            if account_id:
                return account_id
            auth_payload = payload.get("https://api.openai.com/auth")
            if isinstance(auth_payload, dict):
                nested = _normalize_config_string(
                    auth_payload.get("chatgpt_account_id")
                )
                if nested:
                    return nested
            organizations = payload.get("organizations")
            if isinstance(organizations, list) and organizations:
                first = organizations[0]
                if isinstance(first, dict):
                    org_id = _normalize_config_string(first.get("id"))
                    if org_id:
                        return org_id
    return None


def _join_upstream_url(base_url: str, path: str) -> str:
    parts = urlsplit(base_url)
    base_path = parts.path.strip("/")
    normalized_path = path.strip("/")
    if base_path and normalized_path.startswith(f"{base_path}/"):
        normalized_path = normalized_path[len(base_path) + 1 :]
    elif normalized_path == base_path:
        normalized_path = ""
    combined_path = "/".join(
        segment for segment in [parts.path.rstrip("/"), normalized_path] if segment
    )
    if not combined_path.startswith("/"):
        combined_path = f"/{combined_path}"
    return urlunsplit((parts.scheme, parts.netloc, combined_path, "", ""))


@dataclass
class PreparedProxyRequest:
    url: str
    headers: dict[str, str]
    body: bytes
    query: dict[str, Any]
    response_transform: str | None = None


class AiProviderAdapter:
    provider_id = ""

    async def start(
        self,
        *,
        provider: dict[str, Any],
        method: dict[str, Any],
        pending: dict[str, Any],
        public_base_url: str,
    ) -> dict[str, Any]:
        raise RuntimeError("Unsupported auth method")

    async def complete(
        self,
        *,
        provider: dict[str, Any],
        method: dict[str, Any],
        pending: dict[str, Any] | None,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        raise RuntimeError("Unsupported auth method")

    async def prepare_proxy(
        self,
        *,
        provider: dict[str, Any],
        credential: dict[str, Any] | None,
        path: str,
        headers: dict[str, str],
        body: bytes,
        query: dict[str, Any],
    ) -> PreparedProxyRequest:
        raise RuntimeError("Unsupported provider proxy")


class OpenAIAdapter(AiProviderAdapter):
    provider_id = "openai"

    async def start(
        self,
        *,
        provider: dict[str, Any],
        method: dict[str, Any],
        pending: dict[str, Any],
        public_base_url: str,
    ) -> dict[str, Any]:
        method_id = method.get("id")
        if method_id == "manual_api_key":
            return {
                "providerId": "openai",
                "authMethodId": method_id,
                "flowType": "api_key",
                "instructions": "Paste your OpenAI API key.",
            }
        if method_id == "env_api_key":
            return {
                "providerId": "openai",
                "authMethodId": method_id,
                "flowType": "external_credentials",
                "instructions": "Set OPENAI_API_KEY in your environment and refresh.",
            }
        if method_id == "codex_browser":
            verifier, challenge = _generate_pkce()
            state = _b64url(secrets.token_bytes(24))
            redirect_uri = (
                f"{public_base_url}/api/ai/auth/callback/openai/codex_browser"
            )
            pending.update(
                {
                    "verifier": verifier,
                    "state": state,
                    "redirect_uri": redirect_uri,
                }
            )
            params = {
                "response_type": "code",
                "client_id": OPENAI_CLI_CLIENT_ID,
                "redirect_uri": redirect_uri,
                "scope": "openid profile email offline_access",
                "code_challenge": challenge,
                "code_challenge_method": "S256",
                "id_token_add_organizations": "true",
                "codex_cli_simplified_flow": "true",
                "state": state,
                "originator": "sqlrooms",
            }
            return {
                "providerId": "openai",
                "authMethodId": method_id,
                "flowType": "oauth_auto",
                "url": f"{OPENAI_AUTH_ISSUER}/oauth/authorize?{urlencode(params)}",
                "instructions": "Complete authorization in your browser. Return here after approving access.",
            }
        if method_id == "codex_headless":
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{OPENAI_AUTH_ISSUER}/api/accounts/deviceauth/usercode",
                    json={"client_id": OPENAI_CLI_CLIENT_ID},
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                device = response.json()
            pending.update(
                {
                    "device_auth_id": device.get("device_auth_id"),
                    "user_code": device.get("user_code"),
                }
            )
            interval = int(str(device.get("interval") or "5"))
            return {
                "providerId": "openai",
                "authMethodId": method_id,
                "flowType": "device_code",
                "url": f"{OPENAI_AUTH_ISSUER}/codex/device",
                "userCode": str(device.get("user_code") or ""),
                "pollIntervalMs": max(interval, 1) * 1000,
                "instructions": "Open the device page, enter the code, then refresh status here.",
            }
        raise RuntimeError(f"Unsupported OpenAI auth method: {method_id}")

    async def complete(
        self,
        *,
        provider: dict[str, Any],
        method: dict[str, Any],
        pending: dict[str, Any] | None,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        method_id = method.get("id")
        if method_id == "manual_api_key":
            api_key = _normalize_config_string(payload.get("apiKey"))
            if not api_key:
                raise RuntimeError("apiKey is required")
            return {
                "type": "api_key",
                "selected_auth_method": method_id,
                "api_key": api_key,
            }
        if method_id == "env_api_key":
            return {
                "type": "env_api_key",
                "selected_auth_method": method_id,
            }
        if method_id == "codex_headless":
            if not pending:
                raise RuntimeError("No pending device auth flow found.")
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{OPENAI_AUTH_ISSUER}/api/accounts/deviceauth/token",
                    json={
                        "device_auth_id": pending.get("device_auth_id"),
                        "user_code": pending.get("user_code"),
                    },
                    headers={"Content-Type": "application/json"},
                )
                if response.status_code in {403, 404}:
                    raise RuntimeError("Authorization not completed yet.")
                response.raise_for_status()
                code_payload = response.json()
                token_response = await client.post(
                    f"{OPENAI_AUTH_ISSUER}/oauth/token",
                    data={
                        "grant_type": "authorization_code",
                        "code": code_payload.get("authorization_code"),
                        "redirect_uri": f"{OPENAI_AUTH_ISSUER}/deviceauth/callback",
                        "client_id": OPENAI_CLI_CLIENT_ID,
                        "code_verifier": code_payload.get("code_verifier"),
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                token_response.raise_for_status()
                tokens = token_response.json()
            return {
                "type": "oauth",
                "selected_auth_method": method_id,
                "access_token": tokens.get("access_token"),
                "refresh_token": tokens.get("refresh_token"),
                "expires_at": int(time.time()) + int(tokens.get("expires_in") or 3600),
                "account_id": _extract_openai_account_id(tokens),
            }
        raise RuntimeError(f"Unsupported OpenAI completion method: {method_id}")

    async def prepare_proxy(
        self,
        *,
        provider: dict[str, Any],
        credential: dict[str, Any] | None,
        path: str,
        headers: dict[str, str],
        body: bytes,
        query: dict[str, Any],
    ) -> PreparedProxyRequest:
        method_id = _resolve_selected_method(provider, credential)
        api_key = None
        if method_id == "env_api_key":
            api_key = _resolve_env_api_key(provider, method_id)
        elif credential and credential.get("type") == "api_key":
            api_key = _normalize_config_string(credential.get("api_key"))

        upstream_url = _join_upstream_url(provider.get("baseUrl", ""), path)
        out_headers = {
            key: value
            for key, value in headers.items()
            if key.lower() not in {"authorization", "host", "content-length"}
        }

        if method_id in {"codex_browser", "codex_headless"}:
            if not credential or credential.get("type") != "oauth":
                raise RuntimeError("OpenAI OAuth credentials are missing.")
            access_token = _normalize_config_string(credential.get("access_token"))
            if not access_token:
                raise RuntimeError("OpenAI access token is missing.")
            if path.endswith("/chat/completions") or path.endswith("/responses"):
                upstream_url = OPENAI_CODEX_API_ENDPOINT
            out_headers["authorization"] = f"Bearer {access_token}"
            account_id = _normalize_config_string(credential.get("account_id"))
            if account_id:
                out_headers["ChatGPT-Account-Id"] = account_id
        else:
            if not api_key:
                raise RuntimeError("OpenAI API key is missing.")
            out_headers["authorization"] = f"Bearer {api_key}"

        return PreparedProxyRequest(
            url=upstream_url,
            headers=out_headers,
            body=body,
            query=query,
        )


class AnthropicAdapter(AiProviderAdapter):
    provider_id = "anthropic"

    async def start(
        self,
        *,
        provider: dict[str, Any],
        method: dict[str, Any],
        pending: dict[str, Any],
        public_base_url: str,
    ) -> dict[str, Any]:
        method_id = method.get("id")
        if method_id == "manual_api_key":
            return {
                "providerId": "anthropic",
                "authMethodId": method_id,
                "flowType": "api_key",
                "instructions": "Paste your Anthropic API key.",
            }
        if method_id == "env_api_key":
            return {
                "providerId": "anthropic",
                "authMethodId": method_id,
                "flowType": "external_credentials",
                "instructions": "Set ANTHROPIC_API_KEY in your environment and refresh.",
            }
        verifier, challenge = _generate_pkce()
        pending.update({"verifier": verifier})
        base = "console.anthropic.com" if method_id == "create_api_key" else "claude.ai"
        params = {
            "code": "true",
            "client_id": ANTHROPIC_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": "https://console.anthropic.com/oauth/code/callback",
            "scope": "org:create_api_key user:profile user:inference",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "state": verifier,
        }
        return {
            "providerId": "anthropic",
            "authMethodId": method_id,
            "flowType": "oauth_code",
            "url": f"https://{base}/oauth/authorize?{urlencode(params)}",
            "instructions": "Paste the authorization code returned by Anthropic.",
            "codeFormatHint": "authorization-code#state",
        }

    async def complete(
        self,
        *,
        provider: dict[str, Any],
        method: dict[str, Any],
        pending: dict[str, Any] | None,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        method_id = method.get("id")
        if method_id == "manual_api_key":
            api_key = _normalize_config_string(payload.get("apiKey"))
            if not api_key:
                raise RuntimeError("apiKey is required")
            return {
                "type": "api_key",
                "selected_auth_method": method_id,
                "api_key": api_key,
            }
        if method_id == "env_api_key":
            return {
                "type": "env_api_key",
                "selected_auth_method": method_id,
            }
        if not pending:
            raise RuntimeError("No pending Anthropic auth flow found.")
        code = _normalize_config_string(payload.get("code"))
        if not code:
            raise RuntimeError("code is required")
        code_value, _, state = code.partition("#")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://console.anthropic.com/v1/oauth/token",
                json={
                    "code": code_value,
                    "state": state or pending.get("verifier"),
                    "grant_type": "authorization_code",
                    "client_id": ANTHROPIC_CLIENT_ID,
                    "redirect_uri": "https://console.anthropic.com/oauth/code/callback",
                    "code_verifier": pending.get("verifier"),
                },
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            tokens = response.json()
            if method_id == "create_api_key":
                create_key = await client.post(
                    "https://api.anthropic.com/api/oauth/claude_cli/create_api_key",
                    headers={
                        "Content-Type": "application/json",
                        "authorization": f"Bearer {tokens.get('access_token')}",
                    },
                )
                create_key.raise_for_status()
                key_payload = create_key.json()
                return {
                    "type": "api_key",
                    "selected_auth_method": method_id,
                    "api_key": key_payload.get("raw_key"),
                }
        return {
            "type": "oauth",
            "selected_auth_method": method_id,
            "access_token": tokens.get("access_token"),
            "refresh_token": tokens.get("refresh_token"),
            "expires_at": int(time.time()) + int(tokens.get("expires_in") or 3600),
        }

    async def prepare_proxy(
        self,
        *,
        provider: dict[str, Any],
        credential: dict[str, Any] | None,
        path: str,
        headers: dict[str, str],
        body: bytes,
        query: dict[str, Any],
    ) -> PreparedProxyRequest:
        method_id = _resolve_selected_method(provider, credential)
        upstream_url = _join_upstream_url(provider.get("baseUrl", ""), path)
        out_headers = {
            key: value
            for key, value in headers.items()
            if key.lower()
            not in {"authorization", "x-api-key", "host", "content-length"}
        }
        transform = None
        if method_id == "env_api_key":
            api_key = _resolve_env_api_key(provider, method_id)
            if not api_key:
                raise RuntimeError("Anthropic API key is missing.")
            out_headers["x-api-key"] = api_key
        elif credential and credential.get("type") == "api_key":
            api_key = _normalize_config_string(credential.get("api_key"))
            if not api_key:
                raise RuntimeError("Anthropic API key is missing.")
            out_headers["x-api-key"] = api_key
        elif credential and credential.get("type") == "oauth":
            access_token = _normalize_config_string(credential.get("access_token"))
            if not access_token:
                raise RuntimeError("Anthropic OAuth access token is missing.")
            out_headers["authorization"] = f"Bearer {access_token}"
            existing_beta = out_headers.get("anthropic-beta", "")
            betas = [b.strip() for b in existing_beta.split(",") if b.strip()]
            for extra in ("oauth-2025-04-20", "interleaved-thinking-2025-05-14"):
                if extra not in betas:
                    betas.append(extra)
            out_headers["anthropic-beta"] = ",".join(betas)
            out_headers["user-agent"] = "sqlrooms-cli/0.1 (external, browser)"
            transform = "anthropic_mcp"
            parts = urlsplit(upstream_url)
            if parts.path == "/v1/messages":
                query = dict(query)
                query.setdefault("beta", "true")
        else:
            raise RuntimeError("Anthropic credentials are missing.")

        return PreparedProxyRequest(
            url=upstream_url,
            headers=out_headers,
            body=body,
            query=query,
            response_transform=transform,
        )


class DefaultAdapter(AiProviderAdapter):
    provider_id = "default"

    async def start(
        self,
        *,
        provider: dict[str, Any],
        method: dict[str, Any],
        pending: dict[str, Any],
        public_base_url: str,
    ) -> dict[str, Any]:
        if method.get("type") == "local":
            return {
                "providerId": provider.get("id") or "",
                "authMethodId": method.get("id") or "",
                "flowType": "local",
                "instructions": "No credentials are required for this provider.",
            }
        if method.get("type") == "api_key":
            return {
                "providerId": provider.get("id") or "",
                "authMethodId": method.get("id") or "",
                "flowType": "api_key",
                "instructions": "Paste your provider API key.",
            }
        if method.get("type") == "env_api_key":
            env_var = method.get("envVar") or "API_KEY"
            return {
                "providerId": provider.get("id") or "",
                "authMethodId": method.get("id") or "",
                "flowType": "external_credentials",
                "instructions": f"Set {env_var} in your environment and refresh.",
            }
        raise RuntimeError("Unsupported auth method.")

    async def complete(
        self,
        *,
        provider: dict[str, Any],
        method: dict[str, Any],
        pending: dict[str, Any] | None,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        method_type = method.get("type")
        if method_type == "local":
            return {
                "type": "local",
                "selected_auth_method": method.get("id"),
            }
        if method_type == "env_api_key":
            return {
                "type": "env_api_key",
                "selected_auth_method": method.get("id"),
            }
        api_key = _normalize_config_string(payload.get("apiKey"))
        if not api_key:
            raise RuntimeError("apiKey is required")
        return {
            "type": "api_key",
            "selected_auth_method": method.get("id"),
            "api_key": api_key,
        }

    async def prepare_proxy(
        self,
        *,
        provider: dict[str, Any],
        credential: dict[str, Any] | None,
        path: str,
        headers: dict[str, str],
        body: bytes,
        query: dict[str, Any],
    ) -> PreparedProxyRequest:
        upstream_url = _join_upstream_url(provider.get("baseUrl", ""), path)
        out_headers = {
            key: value
            for key, value in headers.items()
            if key.lower() not in {"authorization", "host", "content-length"}
        }
        if credential and credential.get("type") == "api_key":
            api_key = _normalize_config_string(credential.get("api_key"))
            if api_key:
                out_headers["authorization"] = f"Bearer {api_key}"
        return PreparedProxyRequest(
            url=upstream_url,
            headers=out_headers,
            body=body,
            query=query,
        )


ADAPTERS: dict[str, AiProviderAdapter] = {
    "openai": OpenAIAdapter(),
    "anthropic": AnthropicAdapter(),
}


def _adapter_for(provider_id: str) -> AiProviderAdapter:
    return ADAPTERS.get(provider_id, DefaultAdapter())


def _strip_mcp_prefix_stream(chunk: bytes) -> bytes:
    text = chunk.decode("utf-8", errors="ignore")
    text = text.replace('"name":"mcp_', '"name":"')
    text = text.replace('"name": "mcp_', '"name": "')
    return text.encode("utf-8")


def _prefix_anthropic_mcp_body(body: bytes) -> bytes:
    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception:
        return body
    tools = payload.get("tools")
    if isinstance(tools, list):
        for tool in tools:
            if isinstance(tool, dict) and isinstance(tool.get("name"), str):
                tool["name"] = f"mcp_{tool['name']}"
    messages = payload.get("messages")
    if isinstance(messages, list):
        for msg in messages:
            if isinstance(msg, dict) and isinstance(msg.get("content"), list):
                for part in msg["content"]:
                    if (
                        isinstance(part, dict)
                        and part.get("type") == "tool_use"
                        and isinstance(part.get("name"), str)
                    ):
                        part["name"] = f"mcp_{part['name']}"
    return json.dumps(payload).encode("utf-8")


class AiAuthManager:
    def __init__(
        self,
        *,
        config_path: Path | None,
        auth_path: Path | None = None,
    ):
        self.config_path = config_path
        self.auth_path = auth_path or DEFAULT_AUTH_PATH
        self._pending: dict[tuple[str, str], dict[str, Any]] = {}

    def _load_config(self) -> dict[str, Any]:
        return load_ai_settings_config(self.config_path)

    def _load_auth(self) -> dict[str, dict[str, Any]]:
        return load_auth_store(self.auth_path)

    def get_settings(self, api_base_url: str) -> dict[str, Any]:
        return build_ai_settings_response(
            self.config_path,
            self.auth_path,
            api_base_url,
        )

    def get_runtime_providers(
        self, api_base_url: str
    ) -> tuple[str | None, str | None, dict[str, dict[str, Any]]]:
        return build_runtime_ai_providers(
            self.config_path,
            self.auth_path,
            api_base_url,
        )

    def save_settings(self, payload: dict[str, Any]) -> dict[str, Any]:
        config = payload.get("config")
        if not isinstance(config, dict):
            raise RuntimeError("config payload is required")
        parsed = {
            "defaultProvider": _normalize_config_string(config.get("defaultProvider"))
            or "openai",
            "defaultModel": _normalize_config_string(config.get("defaultModel"))
            or "gpt-5",
            "providers": {},
            "customModels": config.get("customModels") or [],
            "modelParameters": config.get("modelParameters")
            or {"maxSteps": 50, "additionalInstruction": ""},
        }
        providers_raw = config.get("providers") or {}
        if not isinstance(providers_raw, dict):
            raise RuntimeError("config.providers must be an object")
        for provider_id, provider in providers_raw.items():
            if isinstance(provider_id, str) and isinstance(provider, dict):
                parsed["providers"][provider_id] = {
                    **_parse_provider(provider),
                    "title": _normalize_config_string(provider.get("title"))
                    or provider_id,
                    "apiKey": "",
                }
        target = self.config_path or (_config_base / "config.toml")
        write_ai_settings_to_toml(target, parsed)
        self.config_path = target
        return parsed

    async def start_auth(
        self, provider_id: str, auth_method_id: str, public_base_url: str
    ) -> dict[str, Any]:
        config = self._load_config()
        provider = config["providers"].get(provider_id)
        if not provider:
            raise RuntimeError(f"Unknown provider: {provider_id}")
        method = _find_auth_method(provider, auth_method_id)
        if not method:
            raise RuntimeError(f"Unknown auth method: {auth_method_id}")
        pending: dict[str, Any] = {}
        self._pending[(provider_id, auth_method_id)] = pending
        result = await _adapter_for(provider_id).start(
            provider={**provider, "id": provider_id},
            method=method,
            pending=pending,
            public_base_url=public_base_url,
        )
        return result

    async def complete_auth(
        self, provider_id: str, auth_method_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        config = self._load_config()
        provider = config["providers"].get(provider_id)
        if not provider:
            raise RuntimeError(f"Unknown provider: {provider_id}")
        method = _find_auth_method(provider, auth_method_id)
        if not method:
            raise RuntimeError(f"Unknown auth method: {auth_method_id}")
        pending = self._pending.get((provider_id, auth_method_id))
        credential = await _adapter_for(provider_id).complete(
            provider={**provider, "id": provider_id},
            method=method,
            pending=pending,
            payload=payload,
        )
        auth_store = self._load_auth()
        auth_store[provider_id] = credential
        write_auth_store(self.auth_path, auth_store)
        if (provider_id, auth_method_id) in self._pending:
            del self._pending[(provider_id, auth_method_id)]
        return credential

    async def complete_oauth_callback(
        self, provider_id: str, auth_method_id: str, params: dict[str, Any]
    ) -> None:
        if provider_id != "openai" or auth_method_id != "codex_browser":
            raise RuntimeError("Unsupported OAuth callback.")
        pending = self._pending.get((provider_id, auth_method_id))
        if not pending:
            raise RuntimeError("No pending OAuth flow found.")
        state = _normalize_config_string(params.get("state"))
        if state != pending.get("state"):
            raise RuntimeError("Invalid OAuth state.")
        code = _normalize_config_string(params.get("code"))
        if not code:
            raise RuntimeError("Missing OAuth code.")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{OPENAI_AUTH_ISSUER}/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": pending.get("redirect_uri"),
                    "client_id": OPENAI_CLI_CLIENT_ID,
                    "code_verifier": pending.get("verifier"),
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            tokens = response.json()
        credential = {
            "type": "oauth",
            "selected_auth_method": auth_method_id,
            "access_token": tokens.get("access_token"),
            "refresh_token": tokens.get("refresh_token"),
            "expires_at": int(time.time()) + int(tokens.get("expires_in") or 3600),
            "account_id": _extract_openai_account_id(tokens),
        }
        auth_store = self._load_auth()
        auth_store[provider_id] = credential
        write_auth_store(self.auth_path, auth_store)
        del self._pending[(provider_id, auth_method_id)]

    def logout(self, provider_id: str) -> None:
        auth_store = self._load_auth()
        auth_store.pop(provider_id, None)
        write_auth_store(self.auth_path, auth_store)

    def status(
        self, api_base_url: str, provider_id: str | None = None
    ) -> dict[str, Any]:
        settings = self.get_settings(api_base_url)
        if not provider_id:
            return settings
        providers = (settings.get("config") or {}).get("providers") or {}
        return {
            "providerId": provider_id,
            "provider": providers.get(provider_id),
        }

    def test_auth(self, provider_id: str, api_base_url: str) -> dict[str, Any]:
        providers = (self.status(api_base_url).get("config") or {}).get(
            "providers"
        ) or {}
        provider = providers.get(provider_id)
        status = (provider or {}).get("status") or {}
        return {
            "ok": bool(status.get("hasCredentials")),
            "providerId": provider_id,
            "status": status,
        }

    async def prepare_proxy_request(
        self,
        *,
        provider_id: str,
        path: str,
        headers: dict[str, str],
        body: bytes,
        query: dict[str, Any],
    ) -> PreparedProxyRequest:
        config = self._load_config()
        auth_store = self._load_auth()
        provider = config["providers"].get(provider_id)
        if not provider:
            raise RuntimeError(f"Unknown provider: {provider_id}")
        return await _adapter_for(provider_id).prepare_proxy(
            provider=provider,
            credential=auth_store.get(provider_id),
            path=path,
            headers=headers,
            body=body,
            query=query,
        )


HTML_SUCCESS = """<!doctype html>
<html><body style="font-family:system-ui;padding:2rem">
<h1>Authorization successful</h1>
<p>You can close this window and return to SQLRooms.</p>
</body></html>"""

HTML_ERROR = """<!doctype html>
<html><body style="font-family:system-ui;padding:2rem">
<h1>Authorization failed</h1>
<p>{error}</p>
</body></html>"""
