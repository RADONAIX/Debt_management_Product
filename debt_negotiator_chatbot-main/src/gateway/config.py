"""Gateway configuration (CLAUDE.md §9, §12).

Every role is independently configurable, and nothing is hardcoded at a call
site. §12: no secrets in code — the key comes from the environment.

On model selection, from probing what this key can actually reach:

``gpt-5.5`` is the strongest chat model available but **rejects the
``temperature`` parameter outright**. §9 requires a low-but-non-zero temperature
for ``COLLECTOR`` and exactly 0 for ``JUDGE``, so gpt-5.5 cannot satisfy the
spec. ``gpt-5.4`` is the strongest model that honours both, and is the default
here. Overriding these in ``.env`` is expected; the gateway verifies whatever it
is given against ``/v1/models`` before a run rather than failing mid-dialogue.

``JUDGE`` deliberately defaults to a different model family from ``COLLECTOR``
to reduce self-preference bias (§9).
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from gateway.roles import ModelRole


class CassetteMode(StrEnum):
    """Record/replay of model responses, so tests never spend money."""

    OFF = "off"
    RECORD = "record"
    REPLAY = "replay"


class RoleConfig(BaseModel):
    """Per-role model settings."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    model: str
    temperature: float | None = Field(
        default=None,
        ge=0.0,
        le=2.0,
        description="Omitted from the request entirely when None — required for "
        "models such as gpt-5.5 that reject the parameter.",
    )
    max_completion_tokens: int = Field(default=1600, gt=0)


class GatewaySettings(BaseSettings):
    """Read from the environment and ``.env``."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_prefix="NEGOTIATOR_",
    )

    openai_api_key: SecretStr = Field(alias="OPENAI_API_KEY")

    collector_model: str = "gpt-5.4"
    collector_temperature: float | None = 0.3

    extractor_model: str = "gpt-5.4"
    extractor_temperature: float | None = 0.0
    """Deterministic on purpose: evidence classification should not vary run to
    run for the same utterance."""

    judge_model: str = "gpt-4.1"
    judge_temperature: float | None = 0.0

    simulator_model: str = "gpt-5.4"
    simulator_temperature: float | None = 0.8

    synthesis_model: str = "gpt-5.4"
    synthesis_temperature: float | None = 1.0

    max_calls_per_run: int = Field(default=1500, gt=0)
    max_tokens_per_run: int = Field(default=4_000_000, gt=0)

    cassette_mode: CassetteMode = CassetteMode.OFF
    cassette_dir: str = "eval/cassettes"

    def role_config(self, role: ModelRole) -> RoleConfig:
        match role:
            case ModelRole.COLLECTOR:
                return RoleConfig(
                    model=self.collector_model, temperature=self.collector_temperature
                )
            case ModelRole.EXTRACTOR:
                return RoleConfig(
                    model=self.extractor_model,
                    temperature=self.extractor_temperature,
                    max_completion_tokens=600,
                )
            case ModelRole.JUDGE:
                return RoleConfig(
                    model=self.judge_model, temperature=self.judge_temperature
                )
            case ModelRole.SIMULATOR:
                return RoleConfig(
                    model=self.simulator_model, temperature=self.simulator_temperature
                )
            case ModelRole.SYNTHESIS:
                return RoleConfig(
                    model=self.synthesis_model,
                    temperature=self.synthesis_temperature,
                    max_completion_tokens=4000,
                )

    def configured_models(self) -> set[str]:
        return {self.role_config(r).model for r in ModelRole}
