"""The model gateway (CLAUDE.md §9, §12).

Every LLM call in the system goes through here. No direct SDK use anywhere else.

Three things this owns that nothing else should:

- **Role routing.** A caller asks for ``ModelRole.JUDGE``; it does not get to
  pick a model, a temperature, or a token budget.
- **Law 6 enforcement.** A gateway constructed with ``production=True`` refuses
  every eval-only role.
- **Spend.** A hard per-run budget on calls and tokens, because the harness runs
  hundreds of dialogues against someone's real API key.
"""

from __future__ import annotations

import json
import time
from typing import Any

from openai import APIConnectionError, APIStatusError, OpenAI, RateLimitError
from pydantic import BaseModel, ConfigDict, Field

from gateway.cassette import Cassette
from gateway.config import CassetteMode, GatewaySettings
from gateway.roles import ModelRole, assert_reachable


class BudgetExceededError(RuntimeError):
    """The run hit its call or token ceiling. Deliberately fatal."""


class ModelUnavailableError(RuntimeError):
    """A configured model id is not reachable with this key."""


class GatewayResponse(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    role: ModelRole
    model: str
    text: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    replayed: bool = False

    def parsed(self) -> dict[str, Any]:
        """Structured-output responses only."""
        loaded: dict[str, Any] = json.loads(self.text)
        return loaded


class Usage(BaseModel):
    """Running spend, surfaced in every report."""

    model_config = ConfigDict(extra="forbid")

    calls: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    calls_by_role: dict[str, int] = Field(default_factory=dict)

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


class Gateway:
    """Role-routed OpenAI client with retries, budget, and cassette support."""

    _RETRYABLE = (RateLimitError, APIConnectionError)

    def __init__(
        self,
        settings: GatewaySettings | None = None,
        *,
        production: bool = False,
        max_retries: int = 4,
    ) -> None:
        self.settings = settings or GatewaySettings()
        self.production = production
        self.max_retries = max_retries
        self.usage = Usage()
        self._client: OpenAI | None = None
        self._cassette = Cassette(self.settings.cassette_dir)
        self._verified = False

    @property
    def client(self) -> OpenAI:
        """Constructed lazily so replay-mode runs need no API key at all."""
        if self._client is None:
            self._client = OpenAI(
                api_key=self.settings.openai_api_key.get_secret_value()
            )
        return self._client

    def verify_models(self) -> None:
        """Fail loudly, before a run, if a configured model is unreachable.

        Discovering a bad model id 300 dialogues into an eval is expensive in
        both money and time.
        """
        if self._verified or self.settings.cassette_mode is CassetteMode.REPLAY:
            return
        available = {m.id for m in self.client.models.list()}
        missing = self.settings.configured_models() - available
        if missing:
            raise ModelUnavailableError(
                f"configured model(s) not available to this key: {sorted(missing)}"
            )
        self._verified = True

    def _check_budget(self) -> None:
        if self.usage.calls >= self.settings.max_calls_per_run:
            raise BudgetExceededError(
                f"run hit its call ceiling of {self.settings.max_calls_per_run}"
            )
        if self.usage.total_tokens >= self.settings.max_tokens_per_run:
            raise BudgetExceededError(
                f"run hit its token ceiling of {self.settings.max_tokens_per_run}"
            )

    def complete(
        self,
        role: ModelRole,
        messages: list[dict[str, str]],
        *,
        schema: dict[str, Any] | None = None,
        schema_name: str = "response",
    ) -> GatewayResponse:
        """One completion for one role.

        ``schema`` turns on structured output, which is how every agent in this
        system returns a strategy label and an agreement delta — parsing prose
        for those would be its own failure mode.
        """
        assert_reachable(role, production=self.production)
        self._check_budget()

        cfg = self.settings.role_config(role)
        request: dict[str, Any] = {
            "model": cfg.model,
            "messages": messages,
            "max_completion_tokens": cfg.max_completion_tokens,
        }
        # Omitted entirely rather than sent as None: models such as gpt-5.5
        # reject the parameter outright rather than ignoring it.
        if cfg.temperature is not None:
            request["temperature"] = cfg.temperature
        if schema is not None:
            request["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                },
            }

        cassette_key = {**request, "role": role.value}

        if self.settings.cassette_mode is CassetteMode.REPLAY:
            recorded = self._cassette.load(cassette_key)
            self._record_usage(role, recorded)
            return GatewayResponse(
                role=role,
                model=cfg.model,
                text=recorded["text"],
                prompt_tokens=recorded.get("prompt_tokens", 0),
                completion_tokens=recorded.get("completion_tokens", 0),
                replayed=True,
            )

        payload = self._call_with_retries(request)

        if self.settings.cassette_mode is CassetteMode.RECORD:
            self._cassette.save(cassette_key, payload)

        self._record_usage(role, payload)
        return GatewayResponse(
            role=role,
            model=cfg.model,
            text=payload["text"],
            prompt_tokens=payload["prompt_tokens"],
            completion_tokens=payload["completion_tokens"],
        )

    def _call_with_retries(self, request: dict[str, Any]) -> dict[str, Any]:
        delay = 1.0
        last: Exception | None = None

        for attempt in range(self.max_retries):
            try:
                completion = self.client.chat.completions.create(**request)
            except self._RETRYABLE as exc:
                last = exc
            except APIStatusError as exc:
                # 5xx is worth retrying; a 4xx is our bug and retrying it just
                # burns time and money.
                if exc.status_code < 500:
                    raise
                last = exc
            else:
                usage = completion.usage
                return {
                    "text": completion.choices[0].message.content or "",
                    "prompt_tokens": usage.prompt_tokens if usage else 0,
                    "completion_tokens": usage.completion_tokens if usage else 0,
                }

            if attempt < self.max_retries - 1:
                time.sleep(delay)
                delay *= 2

        raise RuntimeError(
            f"gateway call failed after {self.max_retries} attempts: {last}"
        )

    def _record_usage(self, role: ModelRole, payload: dict[str, Any]) -> None:
        self.usage.calls += 1
        self.usage.prompt_tokens += payload.get("prompt_tokens", 0)
        self.usage.completion_tokens += payload.get("completion_tokens", 0)
        self.usage.calls_by_role[role.value] = (
            self.usage.calls_by_role.get(role.value, 0) + 1
        )
