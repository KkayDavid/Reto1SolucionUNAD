Instrucciones rápidas (Windows):
1. cd backend
2. python -m venv venv
3. venv\Scripts\activate
4. pip install -r requirements.txt
5. set environment variables or create .env and use python-dotenv if desired
6. Start API: uvicorn app.main:app --reload --port 8000
7. (Optional) Run poller: python -m app.main
8. Frontend: cd ../frontend && npm install && npm start
