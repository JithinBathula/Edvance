"""
Chat API routes - Requirement Gathering
"""
import base64
import io
import json
import traceback
from typing import List, Dict, Any

from flask import Blueprint, request, jsonify, Response, stream_with_context, g

from agents.requirement_gathering_agent import RequirementGatheringAgent
from api.middleware import require_auth

chat_bp = Blueprint('chat', __name__, url_prefix='/api/chat')

# Lazy initialization to avoid timeout during app startup
_requirement_agent = None

def get_requirement_agent():
    """Get or create the requirement gathering agent instance."""
    global _requirement_agent
    if _requirement_agent is None:
        _requirement_agent = RequirementGatheringAgent()
    return _requirement_agent


# ─── File processing helpers ────────────────────────────────────────────────

IMAGE_MIME_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
TEXT_EXTENSIONS = {'.txt', '.py', '.js', '.ts', '.jsx', '.tsx', '.css', '.html',
                   '.json', '.md', '.csv', '.yaml', '.yml', '.xml', '.sql',
                   '.sh', '.bash', '.java', '.c', '.cpp', '.h', '.rb', '.go',
                   '.rs', '.swift', '.kt', '.r', '.lua', '.toml', '.ini', '.cfg'}
MAX_TEXT_FILE_SIZE = 100_000   # 100 KB cap for text files
MAX_IMAGE_SIZE = 5_000_000     # 5 MB cap for images


def _extract_pdf_text(raw_bytes: bytes) -> str:
    """Extract text from a PDF. Returns empty string on failure."""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(raw_bytes))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ''
            if text.strip():
                pages.append(f"--- Page {i+1} ---\n{text.strip()}")
        return '\n\n'.join(pages)
    except Exception as e:
        print(f"[Chat] PDF extraction failed: {e}")
        return ''


def _process_uploaded_files(files) -> List[Dict[str, Any]]:
    """
    Process uploaded files into a list of content parts the LLM can understand.

    Returns a list of dicts, each with:
      - filename: str
      - type: 'image' | 'text'
      - For images:  media_type, base64_data
      - For text:    text_content
    """
    processed: List[Dict[str, Any]] = []

    for file in files:
        if not file or not file.filename:
            continue

        raw = file.read()
        fname = file.filename
        ctype = file.content_type or ''
        ext = '.' + fname.rsplit('.', 1)[-1].lower() if '.' in fname else ''

        print(f"[Chat] Processing file: {fname} ({ctype}, {len(raw)} bytes)")

        # ── Images → base64 for vision ──────────────────────────────────────
        if ctype in IMAGE_MIME_TYPES or ext in {'.jpg', '.jpeg', '.png', '.gif', '.webp'}:
            if len(raw) > MAX_IMAGE_SIZE:
                print(f"[Chat] Skipping {fname}: exceeds {MAX_IMAGE_SIZE} byte limit")
                continue
            media_type = ctype if ctype in IMAGE_MIME_TYPES else f"image/{ext.lstrip('.')}"
            if media_type == 'image/.jpg':
                media_type = 'image/jpeg'
            processed.append({
                'filename': fname,
                'type': 'image',
                'media_type': media_type,
                'base64_data': base64.b64encode(raw).decode('utf-8'),
            })

        # ── PDFs → extract text ─────────────────────────────────────────────
        elif ctype == 'application/pdf' or ext == '.pdf':
            text = _extract_pdf_text(raw)
            if text:
                processed.append({
                    'filename': fname,
                    'type': 'text',
                    'text_content': text,
                })
            else:
                processed.append({
                    'filename': fname,
                    'type': 'text',
                    'text_content': f'[PDF "{fname}" — could not extract text (may be scanned/image-only)]',
                })

        # ── Text / code files → read as UTF-8 ──────────────────────────────
        elif ext in TEXT_EXTENSIONS or ctype.startswith('text/'):
            if len(raw) > MAX_TEXT_FILE_SIZE:
                text = raw[:MAX_TEXT_FILE_SIZE].decode('utf-8', errors='replace')
                text += f'\n\n[... truncated at {MAX_TEXT_FILE_SIZE} bytes ...]'
            else:
                text = raw.decode('utf-8', errors='replace')
            processed.append({
                'filename': fname,
                'type': 'text',
                'text_content': text,
            })

        # ── Unknown → note it ───────────────────────────────────────────────
        else:
            processed.append({
                'filename': fname,
                'type': 'text',
                'text_content': f'[File "{fname}" ({ctype}, {len(raw)} bytes) — unsupported format, content not shown]',
            })

    return processed


# ─── Route ──────────────────────────────────────────────────────────────────

@chat_bp.route('/', methods=['POST'])
@require_auth
def chat():
    content_type = request.content_type or ''

    if 'multipart/form-data' in content_type:
        message = request.form.get('message', '').strip()
        history_str = request.form.get('history', '[]')
        conversation_history = json.loads(history_str) if history_str else []
        client_session_id = request.form.get('session_id')
        user_profile_str = request.form.get('user_profile', '{}')
        user_profile = json.loads(user_profile_str) if user_profile_str else {}

        raw_files = request.files.getlist('files')
        processed_files = _process_uploaded_files(raw_files)
        print(f"[Chat] Processed {len(processed_files)} files from upload")
    else:
        data = request.get_json(silent=True) or {}
        message = data.get('message', '').strip() if data.get('message') else ''
        conversation_history = data.get('history', [])
        client_session_id = data.get('session_id')
        user_profile = data.get('user_profile', {})
        processed_files = []

    # Validation
    if not message and not processed_files:
        return jsonify({'error': 'Message or files required'}), 400
    if not message:
        message = 'I attached some files for you to look at.'
    if not client_session_id:
        return jsonify({'error': 'session_id is required'}), 400

    internal_session_id = f"{g.user_id}:{client_session_id}"
    print(f"[Chat] session={internal_session_id}, message='{message[:80]}', files={len(processed_files)}")

    def generate():
        try:
            for chunk in get_requirement_agent().process_message(
                message=message,
                conversation_history=conversation_history,
                user_profile=user_profile,
                session_id=internal_session_id,
                files=processed_files,
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            error_data = {
                "error": f"Agent error: {str(e)}",
                "content": "I encountered an error. Please try again."
            }
            print(f"Error in chat agent processing: {traceback.format_exc()}")
            yield f"data: {json.dumps(error_data)}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
    )

@chat_bp.route('/requirements/<session_id>', methods=['GET'])
@require_auth
def get_final_requirements(session_id: str):
    try:
        # session_id here is the client UUID from the URL
        internal_session_id = f"{g.user_id}:{session_id}"

        session_state = get_requirement_agent().get_session_state(internal_session_id)

        if not session_state:
            return jsonify({
                'status': 'error',
                'ready_to_plan': False,
                'message': 'Session not found'
            }), 404

        if not session_state.get('ready_to_plan'):
            return jsonify({
                'status': 'pending',
                'ready_to_plan': False,
                'message': 'Requirements not yet finalized in this session'
            }), 200
        
        return jsonify({
            'status': 'success',
            'ready_to_plan': True,
            'requirements': {'session_data': session_state}
        }), 200

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
