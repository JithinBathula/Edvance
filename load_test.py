from locust import HttpUser, task, between
import os

# Grab a valid JWT token - log in manually and copy it
TOKEN = os.environ.get("TEST_TOKEN", "eyJhbGciOiJFUzI1NiIsImtpZCI6ImM4N2RmNTNiLWJjNGQtNDcwZS1iYTYxLTkyODllOWViMjE2NyIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Jyd2Ryb3Z2emRtbHFjYm51Y21kLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlMmUzNDQ4ZS05MjYwLTRhYzEtOTAwNC1iZDI4YmE3MGIyNjkiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc0NDM0MzM2LCJpYXQiOjE3NzQ0MzA3MzYsImVtYWlsIjoicm91emhlbmtAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6InJvdXpoZW5rQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJuYW1lIjoicnoiLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6ImUyZTM0NDhlLTkyNjAtNGFjMS05MDA0LWJkMjhiYTcwYjI2OSJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzc0NDEwMjIyfV0sInNlc3Npb25faWQiOiIxOWUzYmE1MS1kMDg5LTRhYzMtOTg2MS0xN2QyNzZkMjI5MDEiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.4K9T7gyHA4jLS0GuJEppBrUqEcm3boKUdrUPlduKrqV8uP0Y5XIWBK78oqo0tpahGLaqM-DmNnfoaNopCMpsGQ")

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
