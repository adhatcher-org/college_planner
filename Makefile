BACKEND_DIR := backend
FRONTEND_DIR := frontend

.PHONY: install update check build test coverage lint typecheck format-check format security dependency-check pr-check docker-check docker-build docker-up docker-down run clean

install:
	cd $(BACKEND_DIR) && uv sync
	cd $(FRONTEND_DIR) && npm install

update:
	cd $(BACKEND_DIR) && uv lock --upgrade
	cd $(FRONTEND_DIR) && npm update

check:
	@tmp=$$(mktemp -d); \
	trap 'rm -rf "$$tmp"' EXIT; \
	cd $(BACKEND_DIR) && \
		uv lock --check && \
		uv sync --frozen --dry-run && \
		uv run --no-sync python -c 'import sys; raise SystemExit(sys.version_info < (3, 12))' && \
		uv run --no-sync ruff format --check app tests && \
		uv run --no-sync ruff check app tests && \
		uv run --no-sync pytest && \
		COVERAGE_FILE="$$tmp/backend.coverage" uv run --no-sync pytest --cov=app --cov-report=term-missing --cov-report=xml:"$$tmp/backend-coverage.xml" && \
		uv run --no-sync bandit -r app && \
		uv run --no-sync pip-audit && \
	cd ../$(FRONTEND_DIR) && \
		npm ci --dry-run && \
		node -e 'process.exit(Number(process.versions.node.split(".")[0]) === 22 ? 0 : 1)' && \
		npm run format:check && \
		npm run lint && \
		npx tsc --noEmit --pretty false && \
		npm run test && \
		npm run coverage -- --coverage.reportsDirectory="$$tmp/frontend-coverage" && \
		npm run audit && \
		npx vite build --outDir "$$tmp/frontend-dist" --emptyOutDir && \
	cd .. && \
		python3 scripts/pr_review.py && \
		docker buildx build --call=check .

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

format-check:
	cd $(BACKEND_DIR) && uv run ruff format --check app tests
	cd $(FRONTEND_DIR) && npm run format:check

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

docker-check:
	docker buildx build --call=check .

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
