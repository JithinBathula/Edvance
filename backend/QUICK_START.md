# Quick Start Guide

## 1. Prerequisites
- Python 3.9+
- OpenAI API Key

## 2. Installation (2 minutes)

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

## 3. Start Server (1 command)

```bash
# Option 1: Using the quick start script
./run.sh

# Option 2: Direct Python
python app.py
```

Server will start on: `http://localhost:5000`

## 4. Test It Works (3 curl commands)

### Test 1: Health Check
```bash
curl http://localhost:5000/health
```

Expected: `{"status": "healthy"}`

### Test 2: Get Tools
```bash
curl http://localhost:5000/api/planning/tools
```

Expected: JSON with 5 tools

### Test 3: Search Dependencies
```bash
curl -X POST http://localhost:5000/api/planning/dependencies \
  -H "Content-Type: application/json" \
  -d '{
    "technologies": ["React", "Python"],
    "skill_level": "beginner"
  }'
```

Expected: JSON with dependency info

## 5. Create Your First Project Plan

```bash
curl -X POST http://localhost:5000/api/planning/create \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "My First Project",
    "project_description": "A simple todo list",
    "technologies": ["HTML", "CSS", "JavaScript"],
    "skill_level": "beginner",
    "estimated_duration": "4 hours",
    "learning_objectives": ["Learn basics"]
  }'
```

**Note**: This will take 30-120 seconds as it uses LLM orchestration.

## 6. Using Postman

1. Open Postman
2. Click "Import"
3. Select `backend/postman_collection.json`
4. Update `base_url` variable if needed
5. Run tests in order (1-10)

## 7. Available Endpoints

| Method | Endpoint | Purpose | Speed |
|--------|----------|---------|-------|
| GET | `/health` | Health check | Instant |
| GET | `/api/planning/tools` | List tools | Instant |
| POST | `/api/planning/dependencies` | Search deps | Fast |
| POST | `/api/planning/overview` | Generate overview | Fast |
| POST | `/api/planning/tasks` | Generate tasks | Fast |
| POST | `/api/planning/quality-check` | Check quality | Fast |
| POST | `/api/planning/edit` | Edit plan | Fast |
| **POST** | **`/api/planning/create`** | **Complete plan (MAIN)** | **Slow (LLM)** |

## 8. Common Issues

### Issue: "OPENAI_API_KEY not configured"
**Solution**: Add your API key to `.env` file
```
OPENAI_API_KEY=sk-your-key-here
```

### Issue: "Module not found"
**Solution**: Activate virtual environment
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### Issue: Port 5000 already in use
**Solution**: Change port in `.env`
```
PORT=5001
```

## 9. Project Structure

```
backend/
├── app.py              # Main Flask app (START HERE)
├── config.py           # Configuration
├── requirements.txt    # Dependencies
├── planning/
│   ├── client.py      # LLM orchestrator (BRAIN)
│   ├── tools.py       # Planning tools (WORKERS)
│   └── models.py      # Data models (TYPES)
└── README.md          # Full documentation
```

## 10. What Happens When You Call /api/planning/create?

```
1. Flask receives your request
   ↓
2. Validates project requirements
   ↓
3. Creates PlanningClient
   ↓
4. Client starts LLM conversation
   ↓
5. LLM: "I'll search for dependencies first"
   → Calls web_search_dependencies()
   ↓
6. LLM: "Now I'll create overview"
   → Calls generate_project_overview()
   ↓
7. LLM: "Let me generate tasks for each step"
   → Calls generate_step_tasks() for each step
   ↓
8. LLM: "Time to check quality"
   → Calls quality_check_plan()
   ↓
9. If quality < 70:
   LLM: "I'll fix the issues"
   → Calls edit_plan_tasks()
   → Calls quality_check_plan() again
   ↓
10. Returns complete project plan with quality score
```

## 11. Cost & Performance

- **API Calls per Request**: 8-12 OpenAI calls
- **Time**: 30-120 seconds
- **Cost**: ~$0.10-0.30 per plan (GPT-4)
- **Success Rate**: High (with retry logic)

## 12. Next Steps

1. ✅ Test all endpoints with Postman
2. ✅ Review the generated plan structure
3. ✅ Read ARCHITECTURE.md for deep dive
4. ✅ Integrate with your frontend
5. ✅ Deploy to production

## 13. Deployment Checklist

- [ ] Set `FLASK_ENV=production`
- [ ] Set `FLASK_DEBUG=0`
- [ ] Use Gunicorn: `gunicorn -w 4 app:app`
- [ ] Configure CORS origins
- [ ] Setup rate limiting
- [ ] Add monitoring
- [ ] Setup error tracking (Sentry)
- [ ] Configure logging
- [ ] Setup load balancer
- [ ] Add health check endpoint to monitor

## Need Help?

- Full docs: `README.md`
- Architecture: `ARCHITECTURE.md`
- Postman tests: `POSTMAN_TESTS.md`
- Code: Start at `app.py`, then `planning/client.py`

