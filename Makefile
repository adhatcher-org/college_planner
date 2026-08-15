BACKEND_DIR := backend
FRONTEND_DIR := frontend

.PHONY: install update check build test coverage lint typecheck format security dependency-check pr-check docker-build docker-up docker-down run clean

install:
	cd $(BACKEND_DIR) && uv sync
	cd $(FRONTEND_DIR) && npm install

update:
	cd $(BACKEND_DIR) && uv lock --upgrade
	cd $(FRONTEND_DIR) && npm update

check:
	cd $(BACKEND_DIR) && uv sync --frozen
	cd $(FRONTEND_DIR) && npm ci
	$(MAKE) lint
	$(MAKE) typecheck
	$(MAKE) test
	$(MAKE) coverage
	$(MAKE) security
	$(MAKE) dependency-check
	$(MAKE) pr-check
	docker build --file Dockerfile --tag app-ci:check .

build:
	cd $(BACKEND_DIR) && uv run ruff check app tests
	cd $(FRONTEND_DIR) && npm run build

test:
	cd $(BACKEND_DIR) && uv run pytest
	cd $(FRONTEND_DIR) && npm run test

coverage:
	cd $(BACKEND_DIR) && uv run pytest --cov=app --cov-report=term-missing --cov-report=xml
	cd $(FRONTEND_DIR) && npm run coverage

lint:
	cd $(BACKEND_DIR) && uv run ruff check app tests
	cd $(FRONTEND_DIR) && npm run lint

typecheck:
	cd $(FRONTEND_DIR) && npm run typecheck

format:
	cd $(BACKEND_DIR) && uv run ruff format app tests
	cd $(BACKEND_DIR) && uv run ruff check --fix app tests
	cd $(FRONTEND_DIR) && npm run format

security:
	cd $(BACKEND_DIR) && uv run bandit -r app
	cd $(BACKEND_DIR) && uv run pip-audit
	cd $(FRONTEND_DIR) && npm run audit

dependency-check:
	cd $(BACKEND_DIR) && uv lock --check
	cd $(BACKEND_DIR) && uv sync --frozen
	cd $(BACKEND_DIR) && uv run pip-audit

pr-check:
	python3 scripts/pr_review.py

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

run:
	cd $(BACKEND_DIR) && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

clean:
	rm -rf $(BACKEND_DIR)/.pytest_cache $(BACKEND_DIR)/.ruff_cache $(BACKEND_DIR)/htmlcov $(BACKEND_DIR)/coverage.xml
	rm -rf $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/coverage
