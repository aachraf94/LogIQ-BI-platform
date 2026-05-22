FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV DAGSTER_HOME=/app/dagster_home

RUN mkdir -p /app/dagster_home && \
    if [ ! -f /app/dagster_home/dagster.yaml ]; then \
      printf 'python_logs:\n  python_log_level: INFO\ntelemetry:\n  enabled: false\n' \
      > /app/dagster_home/dagster.yaml; \
    fi

EXPOSE 3000

CMD ["dagster", "dev", "-h", "0.0.0.0", "-p", "3000"]
