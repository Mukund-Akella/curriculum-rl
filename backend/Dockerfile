FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
COPY backend/constraints.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY envs/ ./envs/
COPY curriculum/ ./curriculum/
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]