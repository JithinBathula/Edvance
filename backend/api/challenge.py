"""
Community Challenge API routes.
Handles 1v1 coding challenges between students.
"""
import json
from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify, g

from api.middleware import require_auth
from db.supabase_client import (
    get_user_by_email,
    increment_xp_atomic,
    create_challenge,
    get_challenge_by_id,
    get_user_challenges,
    update_challenge_status,
    upsert_challenge_progress,
    get_challenge_progress,
)
from prompts.puzzles import generate_puzzle, XP_BY_DIFFICULTY

challenge_bp = Blueprint("challenge", __name__, url_prefix="/api/challenges")
challenge_bp.strict_slashes = False

# Pending challenges expire after 24 hours
CHALLENGE_EXPIRY_HOURS = 24


def _expire_stale(challenges: list) -> list:
    """Lazily mark pending challenges older than 24h as expired."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=CHALLENGE_EXPIRY_HOURS)
    out = []
    for c in challenges:
        if c["status"] == "pending":
            created = c.get("created_at", "")
            if isinstance(created, str) and created:
                try:
                    dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    if dt < cutoff:
                        try:
                            update_challenge_status(c["id"], "expired")
                        except Exception:
                            pass
                        c["status"] = "expired"
                except Exception:
                    pass
        out.append(c)
    return out


def _run_puzzle_tests(user_code: str, test_code: str) -> dict:
    """Run user code + test code in a sandboxed exec and return pass/fail + feedback."""
    combined = user_code + "\n\n" + test_code
    try:
        exec_globals = {}
        exec(combined, exec_globals)
        return {"is_correct": True, "feedback": "All tests passed! Great job!"}
    except AssertionError as e:
        return {"is_correct": False, "feedback": f"Test failed: {str(e) or 'One of the assertions did not pass. Check your logic and try again.'}"}
    except Exception as e:
        return {"is_correct": False, "feedback": f"Error in your code: {type(e).__name__}: {str(e)}"}


# ── POST / ── Create a challenge ──────────────────────────────────────────────

@challenge_bp.route("/", methods=["POST"])
@require_auth
def create():
    """Create a new challenge. Body: { opponent_email, difficulty }."""
    data = request.json or {}
    opponent_email = data.get("opponent_email", "").strip().lower()
    difficulty = data.get("difficulty", "medium").strip().lower()

    if not opponent_email:
        return jsonify({"success": False, "error": "opponent_email is required"}), 400

    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"

    # Look up opponent
    opponent = get_user_by_email(opponent_email)
    if not opponent:
        return jsonify({"success": False, "error": "No user found with that email"}), 404

    if opponent["id"] == g.user_id:
        return jsonify({"success": False, "error": "You cannot challenge yourself"}), 400

    # Generate a puzzle via LLM for this difficulty
    xp_bonus = XP_BY_DIFFICULTY.get(difficulty, 25)
    try:
        puzzle = generate_puzzle(difficulty)
    except Exception as e:
        print(f"[Challenge] Puzzle generation failed: {e}")
        return jsonify({"success": False, "error": "Failed to generate puzzle. Please try again."}), 500

    challenge = create_challenge(
        challenger_id=g.user_id,
        opponent_id=opponent["id"],
        difficulty=difficulty,
        puzzle=puzzle,
        xp_bonus=xp_bonus,
    )

    return jsonify({"success": True, "challenge": challenge}), 201


# ── GET / ── List my challenges ───────────────────────────────────────────────

@challenge_bp.route("/", methods=["GET"])
@require_auth
def list_challenges():
    """List all challenges for the current user."""
    challenges = get_user_challenges(g.user_id)
    challenges = _expire_stale(challenges)

    # Strip test_code from puzzle data in list view (don't leak answers)
    for c in challenges:
        puzzle = c.get("puzzle")
        if puzzle and isinstance(puzzle, dict):
            c["puzzle"] = {
                "title": puzzle.get("title", ""),
                "difficulty": c.get("difficulty", "medium"),
            }

    return jsonify({"success": True, "challenges": challenges}), 200


# ── GET /<id> ── Get challenge details ────────────────────────────────────────

@challenge_bp.route("/<challenge_id>", methods=["GET"])
@require_auth
def get_detail(challenge_id):
    """Get full challenge details including puzzle info."""
    challenge = get_challenge_by_id(challenge_id)
    if not challenge:
        return jsonify({"success": False, "error": "Challenge not found"}), 404

    if g.user_id not in (challenge["challenger_id"], challenge["opponent_id"]):
        return jsonify({"success": False, "error": "Not authorized"}), 403

    # Parse puzzle JSON — handle string encoding (single or double-encoded)
    puzzle = challenge.get("puzzle")
    for _ in range(3):  # unwrap up to 3 levels of string encoding
        if isinstance(puzzle, str):
            try:
                puzzle = json.loads(puzzle)
            except Exception:
                break
        else:
            break
    challenge["puzzle"] = puzzle

    # Strip test_code from response (don't send answers to client)
    puzzle = challenge.get("puzzle")
    if puzzle and isinstance(puzzle, dict):
        challenge["puzzle"] = {
            "title": puzzle.get("title", ""),
            "description": puzzle.get("description", ""),
            "starter_code": puzzle.get("starter_code", ""),
        }
    else:
        print(f"[Challenge] WARNING: puzzle data missing or invalid for challenge {challenge_id}, type={type(puzzle)}, value={repr(puzzle)[:200]}")

    return jsonify({"success": True, "challenge": challenge}), 200


# ── POST /<id>/accept ── Accept a challenge ───────────────────────────────────

@challenge_bp.route("/<challenge_id>/accept", methods=["POST"])
@require_auth
def accept(challenge_id):
    """Opponent accepts a pending challenge."""
    challenge = get_challenge_by_id(challenge_id)
    if not challenge:
        return jsonify({"success": False, "error": "Challenge not found"}), 404

    if challenge["opponent_id"] != g.user_id:
        return jsonify({"success": False, "error": "Only the challenged user can accept"}), 403

    if challenge["status"] != "pending":
        return jsonify({"success": False, "error": f"Challenge is already {challenge['status']}"}), 400

    # Move to active and set start time
    now = datetime.now(timezone.utc).isoformat()
    update_challenge_status(challenge_id, "active", started_at=now)

    # Create progress rows for both participants
    upsert_challenge_progress(challenge_id, challenge["challenger_id"], 0, "coding")
    upsert_challenge_progress(challenge_id, challenge["opponent_id"], 0, "coding")

    return jsonify({"success": True}), 200


# ── POST /<id>/decline ── Decline a challenge ─────────────────────────────────

@challenge_bp.route("/<challenge_id>/decline", methods=["POST"])
@require_auth
def decline(challenge_id):
    """Opponent declines a pending challenge."""
    challenge = get_challenge_by_id(challenge_id)
    if not challenge:
        return jsonify({"success": False, "error": "Challenge not found"}), 404

    if challenge["opponent_id"] != g.user_id:
        return jsonify({"success": False, "error": "Only the challenged user can decline"}), 403

    if challenge["status"] != "pending":
        return jsonify({"success": False, "error": f"Challenge is already {challenge['status']}"}), 400

    update_challenge_status(challenge_id, "declined")
    return jsonify({"success": True}), 200


# ── PUT /<id>/progress ── Update my line count ────────────────────────────────

@challenge_bp.route("/<challenge_id>/progress", methods=["PUT"])
@require_auth
def update_progress(challenge_id):
    """Update own progress (line count). Called by frontend every 3s."""
    data = request.json or {}
    line_count = data.get("line_count", 0)

    upsert_challenge_progress(challenge_id, g.user_id, line_count, "coding")
    return jsonify({"success": True}), 200


# ── GET /<id>/progress ── Get opponent progress ───────────────────────────────

@challenge_bp.route("/<challenge_id>/progress", methods=["GET"])
@require_auth
def get_progress(challenge_id):
    """Get both participants' progress for the live widget."""
    challenge = get_challenge_by_id(challenge_id)
    if not challenge:
        return jsonify({"success": False, "error": "Challenge not found"}), 404

    if g.user_id not in (challenge["challenger_id"], challenge["opponent_id"]):
        return jsonify({"success": False, "error": "Not authorized"}), 403

    progress_rows = get_challenge_progress(challenge_id)

    my_progress = {"line_count": 0, "status": "coding"}
    opponent_progress = {"line_count": 0, "status": "coding"}

    for row in progress_rows:
        if row["user_id"] == g.user_id:
            my_progress = {"line_count": row["line_count"], "status": row["status"]}
        else:
            opponent_progress = {"line_count": row["line_count"], "status": row["status"]}

    return jsonify({
        "success": True,
        "my_line_count": my_progress["line_count"],
        "my_status": my_progress["status"],
        "opponent_line_count": opponent_progress["line_count"],
        "opponent_status": opponent_progress["status"],
        "challenge_status": challenge["status"],
        "winner_id": challenge.get("winner_id"),
    }), 200


# ── POST /<id>/submit ── Submit code for evaluation ──────────────────────────

@challenge_bp.route("/<challenge_id>/submit", methods=["POST"])
@require_auth
def submit(challenge_id):
    """Submit code for a challenge. Runs puzzle test_code against user code."""
    data = request.json or {}
    code = data.get("code", "")

    if not code.strip():
        return jsonify({"success": False, "error": "Code is required"}), 400

    challenge = get_challenge_by_id(challenge_id)
    if not challenge:
        return jsonify({"success": False, "error": "Challenge not found"}), 404

    if g.user_id not in (challenge["challenger_id"], challenge["opponent_id"]):
        return jsonify({"success": False, "error": "Not authorized"}), 403

    if challenge["status"] == "completed":
        return jsonify({
            "success": True,
            "is_correct": False,
            "feedback": "This challenge has already been completed.",
            "winner_id": challenge.get("winner_id"),
        }), 200

    if challenge["status"] != "active":
        return jsonify({"success": False, "error": f"Challenge is not active (status: {challenge['status']})"}), 400

    # Mark as submitted
    upsert_challenge_progress(challenge_id, g.user_id, line_count=len(code.split("\n")), status="submitted")

    # Get puzzle data (unwrap string encoding if needed)
    puzzle = challenge.get("puzzle")
    for _ in range(3):
        if isinstance(puzzle, str):
            try:
                puzzle = json.loads(puzzle)
            except Exception:
                break
        else:
            break

    if not puzzle or not isinstance(puzzle, dict) or not puzzle.get("test_code"):
        return jsonify({"success": False, "error": "Puzzle data not found"}), 404

    # Run the tests
    result = _run_puzzle_tests(code, puzzle["test_code"])

    if result["is_correct"]:
        # Double-check the challenge is still active (race condition guard)
        fresh = get_challenge_by_id(challenge_id)
        if fresh and fresh["status"] == "completed":
            return jsonify({
                "success": True,
                "is_correct": True,
                "feedback": result["feedback"],
                "won": False,
                "winner_id": fresh.get("winner_id"),
            }), 200

        # This user wins!
        now = datetime.now(timezone.utc).isoformat()
        update_challenge_status(challenge_id, "completed", winner_id=g.user_id, completed_at=now)
        upsert_challenge_progress(challenge_id, g.user_id, line_count=len(code.split("\n")), status="completed")

        # Award XP bonus
        new_xp = None
        try:
            new_xp = increment_xp_atomic(g.user_id, challenge.get("xp_bonus", 25))
        except Exception as e:
            print(f"Warning: Failed to award challenge XP: {e}")

        return jsonify({
            "success": True,
            "is_correct": True,
            "feedback": result["feedback"],
            "won": True,
            "xp_bonus": challenge.get("xp_bonus", 25),
            "new_xp": new_xp,
        }), 200
    else:
        # Not correct — go back to coding
        upsert_challenge_progress(challenge_id, g.user_id, line_count=len(code.split("\n")), status="coding")
        return jsonify({
            "success": True,
            "is_correct": False,
            "feedback": result["feedback"],
        }), 200
