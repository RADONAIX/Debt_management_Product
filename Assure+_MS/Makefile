.PHONY: help install run migrate revision seed lint fmt start

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "\033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Create venv and install runtime + dev deps
	python -m venv .venv
	. .venv/bin/activate && pip install -e ".[dev]"

run: ## Run the API locally with reload (port 8008)
	.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8008

migrate: ## Apply DB migrations
	.venv/bin/alembic upgrade head

revision: ## Autogenerate a migration (msg="...")
	.venv/bin/alembic revision --autogenerate -m "$(msg)"

seed: ## Seed roles + bootstrap admin user
	.venv/bin/python -m app.seed

lint: ## Lint with ruff
	ruff check app migrations

fmt: ## Auto-fix lint + format
	ruff check --fix app migrations
	ruff format app migrations

start: migrate seed ## Migrate, seed, then run the API in the background on port 8008
	nohup .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8008 > api.log 2>&1 &
	@echo "API starting on http://127.0.0.1:8008 — logs: Assure+_MS/api.log"
