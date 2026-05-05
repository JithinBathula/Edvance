from locust import HttpUser, task, between
import os

# Set TEST_TOKEN to a valid Supabase access token for a test account before running.
# Usage: TEST_TOKEN=... locust -f backend/scripts/load_test.py --host http://localhost:8000
TOKEN = os.environ["TEST_TOKEN"]

class StudentUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        self.headers = {"Authorization": f"Bearer {TOKEN}"}
    
    @task(3)
    def get_project(self):
        """Simulates loading a project workspace"""
        self.client.get(
            "/api/progress/projects",
            headers=self.headers,
        )

    @task(1)
    def submit_code(self):
        """Simulates a code submission (heaviest endpoint - LLM call)"""
        self.client.post(
            "/api/submission/evaluate",
            json={
                "task_id": "c3eacc90-fbd4-493e-b46e-b5ec6ba72c59",
                "code": "def add(a, b):\n    return a + b",
                "project_id": "df66578e-b6a9-4d70-a23e-571c12b9cd9d",
            },
            headers=self.headers,
        )
