# zengtrade paper-trading worker — runs the proven strategy on live Binance data for every
# ACTIVE paper deployment, writing trades/book_state back to Supabase. Self-contained (vendored bot/).
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# continuous mode: loops every WORKER_INTERVAL seconds. DATABASE_URL comes from the host env.
CMD ["sh", "-c", "python worker.py --interval ${WORKER_INTERVAL:-300}"]
