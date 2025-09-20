.PHONY: dev build seed lint fmt test cli bundle

dev:
	docker-compose up --build -d

build:
	docker-compose build

seed:
	docker-compose exec api python -m api.seed

cli:
	docker-compose exec api python -m cli --help

bundle:
	docker-compose exec api python -c "from api.bundle import export_bundle_cli; export_bundle_cli()"

lint:
	docker-compose exec api ruff check api worker cli || true

fmt:
	docker-compose exec api ruff format api worker cli

test:
	docker-compose exec api pytest -q

