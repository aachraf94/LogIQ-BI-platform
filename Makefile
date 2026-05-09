# Local Development
setup-dagster:
	cd dagster && python -m venv venv && . venv/bin/activate && pip install -r requirements.txt

setup-backend:
	cd backend && python -m venv venv && . venv/bin/activate && pip install -r requirements.txt

setup-frontend:
	cd frontend && npm install

setup: setup-dagster setup-backend setup-frontend

dagster:
	cd dagster && . venv/bin/activate && dagster dev

backend:
	cd backend && . venv/bin/activate && python manage.py runserver

celery:
	cd backend && . venv/bin/activate && celery -A config worker -l info

frontend:
	cd frontend && npm run dev

# Deployment
deploy:
	docker-compose up --build -d

deploy-down:
	docker-compose down
