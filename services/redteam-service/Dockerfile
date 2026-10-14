# Python 3.12 + Node 22 in einem Image (schneller als apt + NodeSource-Setup)
FROM nikolaik/python-nodejs:python3.12-nodejs22-slim

# Promptfoo global installieren (großes Paket – Fortschritt sichtbar halten)
RUN npm install -g promptfoo@0.124.1 --loglevel=info --no-audit --no-fund

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8004
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]
