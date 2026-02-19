from hashlib import new
import json
import os
from typing import Dict, List, Any, Generator, Optional
from dotenv import load_dotenv
from openai import OpenAI
import time

from requests import session

from tools.requirement import RequirementTools
from prompts import requirements_prompts

load_dotenv()

DEFAULT_USER_SKILLS = {
    "educationLevel": "primary",
    "schoolExperience": "beginner",
    "pythonLevel": "level-1",
    "biggestChallenges": "planning",
    "learningMode": "guided"
    # TODO: add completed projects in database as well
}

MAX_ITERATIONS = 4              
HISTORY_TAIL = 8                # only include last N chat messages from frontend
PROMPT_TAIL = 14                # keep system + last N messages during tool loop
TOOL_OUTPUT_CAP = 2000          # cap tool output injected into prompt

# Requirements limits
MAX_ITEMS_PER_FIELD = 30
MAX_TOTAL_ITEMS = 100
MAX_ITEM_LENGTH = 200

# Prompt display limits (avoid huge system prompt)
MAX_LIST_DISPLAY = 10           # show only first N items per list in system prompt
MAX_DECISIONS_DISPLAY = 5       # show only last N decisions


class RequirementGatheringAgent:
    def __init__(self):
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY")
        )
        self.requirement_tools = RequirementTools()
        self.sessions: Dict[str, Dict[str, Any]] = {} 

#----------------
# SESSION MODEL
#-----------------
    def get_session_state(self, session_id: str) -> Dict[str, Any]:
        """Get or create session state. Session state tracks the progress of requirement gathering."""
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "project_idea": None,
                "ready_to_plan": False,
                "snapshot": {
                    "project_title": "",
                    "project_summary": "",
                    "constraints": [],
                    "must_haves": [],                    
                    "nice_to_haves": [],
                    "out_of_scope": [],
                    "assumptions": [],
                    "acceptance_criteria": [],
                },
                "decision_log": [],
                # append-only tool context (so nothing overwrites)
                "tool_context": {
                    "tech_analysis_history": [],
                    "quality_check_history": [],
                },
                
                # metadata
                "created_at": time.time(),
                "last_updated": time.time(),
            }
        return self.sessions[session_id]
    
    def reset_session(self, session_id: str):
        """Reset session state"""
        if session_id in self.sessions:
            del self.sessions[session_id]
    
#----------------
# HELPERS
#-----------------

    def _format_list(self, items: List[str]) -> str:
        """Format list for display in system prompt - shows all items."""
        if not items:
            return "  (none)"
        
        formatted = "\n".join(f"  - {item}" for item in items)
        
        # Add warning for unusually long lists
        if len(items) > 20:
            formatted += f"\n  [Note: Large list with {len(items)} items - consider consolidating]"
        
        return formatted

    def _build_system_prompt(self, user_profile: Dict[str, Any], session: Dict[str, Any]) -> str:
        """Construct the system prompt with user profile AND current snapshot."""
        base_prompt = requirements_prompts.requirements_agent_prompt.format(
        educationLevel=user_profile["educationLevel"],
        schoolExperience=user_profile["schoolExperience"],
        pythonLevel=user_profile["pythonLevel"],
        biggestChallenges=user_profile["biggestChallenges"],
        learningMode=user_profile["learningMode"]
        )
        
        # Add current snapshot context
        snapshot = session['snapshot']
        snapshot_summary = f"""
        
        CURRENT REQUIREMENTS SNAPSHOT:
        - Title: {snapshot.get('project_title', 'Not set')}
        - Summary: {snapshot.get('project_summary', 'Not set')}
        - Constraints: {snapshot.get('constraints', [])} items
        - Must-haves: {snapshot.get('must_haves', [])} items
        - Nice-to-haves: {snapshot.get('nice_to_haves', [])} items
        - Out of scope: {snapshot.get('out_of_scope', [])} items
        - Assumptions: {snapshot.get('assumptions', [])} items
        - Acceptance Criteria: {snapshot.get('acceptance_criteria', [])} items

        Rules:
            - Use update_snapshot to modify requirements.
            - Only call mark_ready_to_plan when requirements are truly finalized
            - Avoid calling the same tool repeatedly unless user provides new information
        """
        return base_prompt + snapshot_summary
    
    def _dedupe_extend(self, arr: List[Any], items: Any) -> None:
        """Extend list without duplicates (supports scalar or list)."""
        new_items = items if isinstance(items, list) else [items]
        for it in new_items:
            if it is None:
                continue
            if it not in arr:
                arr.append(it)

    def _validate_snapshot_shape(self, snapshot: Dict[str, Any]) -> Optional[str]:
        """Return error string if invalid, else None."""
        required_keys = [
            "project_title",
            "project_summary",
            "constraints",
            "must_haves",
            "nice_to_haves",
            "out_of_scope",
            "assumptions",
            "acceptance_criteria",
        ]
        for k in required_keys:
            if k not in snapshot:
                return f"Snapshot missing key: {k}"
        # Type checks
        for k in ["constraints", "must_haves", "nice_to_haves", "out_of_scope", "assumptions", "acceptance_criteria"]:
            if not isinstance(snapshot.get(k), list):
                return f"Snapshot field '{k}' must be a list"
        for k in ["project_title", "project_summary"]:
            if not isinstance(snapshot.get(k), str):
                return f"Snapshot field '{k}' must be a string"
        return None

#----------------
# MULTIMODAL MESSAGE BUILDER
#-----------------    
    def _build_user_content(self, message: str, files: List[Dict[str, Any]]):
        """
        Build the 'content' value for the user message.

        - No files → plain string (cheaper, faster).
        - With files → list of content parts (OpenAI multimodal format):
              {"type": "text", "text": "..."}
              {"type": "image_url", "image_url": {"url": "data:...;base64,..."}}
        """
        if not files:
            return message

        parts: List[Dict[str, Any]] = []

        # Lead with the user's text message
        if message:
            parts.append({"type": "text", "text": message})

        for f in files:
            fname = f.get('filename', 'file')

            if f['type'] == 'image':
                # Vision: inline base64 image
                data_url = f"data:{f['media_type']};base64,{f['base64_data']}"
                parts.append({
                    "type": "image_url",
                    "image_url": {"url": data_url, "detail": "auto"},
                })
                parts.append({
                    "type": "text",
                    "text": f"[Attached image: {fname}]",
                })

            elif f['type'] == 'text':
                # Text / code / PDF content
                parts.append({
                    "type": "text",
                    "text": f"--- Content of {fname} ---\n{f['text_content']}\n--- End of {fname} ---",
                })

        return parts
        
#----------------
# TOOL DISPATCH
#-----------------
    def _tool_dispatch(self, tool_name: str, tool_args: Dict[str, Any], user_profile: Dict[str, Any], session: Dict[str, Any]) -> Dict[str, Any]:
        print(f"Dispatching tool: {tool_name}")
        print(f"Arguments: {json.dumps(tool_args, indent=2)}")
        
        try:
            if tool_name == "web_search":
                result = self.requirement_tools.web_search(
                    project_idea=tool_args.get('project_idea', ''), 
                    user_skills=user_profile
                )
                session["tool_context"]["tech_analysis_history"].append({
                    "ts": time.time(), "args": tool_args, "result": result}
                )
                session["last_updated"] = time.time()

                print(f"Tech analysis history: {result.get('required_technologies',[])}")
                return result
            
            elif tool_name == "quality_check":
                result = self.requirement_tools.quality_check(
                    project_idea=tool_args.get('project_idea', ''),
                    libraries=tool_args.get('libraries', ''), 
                    user_skills=user_profile
                )
                session["tool_context"]["quality_check_history"].append(
                    {"ts": time.time(), "args": tool_args, "result": result}
                )
                session["last_updated"] = time.time()

                print(f"Quality check: {result.get('action','unknown')}")
                return result
            
            elif tool_name == "update_snapshot":
                patch_obj = tool_args.get("patch", {})
                note = tool_args.get("note", "")
                snapshot = session["snapshot"]

                for key, value in patch_obj.items():
                    if key not in snapshot:
                        continue
                    
                    # If it's a list (like must_haves), deduplicate and extend
                    if isinstance(snapshot[key], list):
                        self._dedupe_extend(snapshot[key], value)
                    else:
                        # If it's a string (like title), only update if the new value isn't empty
                        if value:
                            snapshot[key] = str(value)

                session["last_updated"] = time.time()
                return {"status": "refined", "note": note}
            
            elif tool_name == "mark_ready_to_plan":
                ready = tool_args.get('ready_to_plan', False)
                final_snapshot = tool_args.get("snapshot") or session["snapshot"]
                
                err = self._validate_snapshot_shape(final_snapshot)
                if err:
                    # Never mark ready if invalid
                    session["ready_to_plan"] = False
                    return {"ready_to_plan": False, "error": err}

                if ready:
                    session["snapshot"] = final_snapshot
                    session["ready_to_plan"] = True
                    session["last_updated"] = time.time()

                    print("REQUIREMENTS FINALIZED")
                    print(f"Final Snapshot:")
                    print(json.dumps(final_snapshot, indent=2))
                    return {"ready_to_plan": True, "snapshot": final_snapshot}

                session["ready_to_plan"] = False
                return {"ready_to_plan": False}
            
            elif tool_name == "suggest_alternative_projects":
                # ensure avoid_topics includes current project
                avoid_list = tool_args.get('avoid_topics', []) or []
                if session.get('project_idea') and session['project_idea'] not in avoid_list:
                    avoid_list.append(session['project_idea'])
                
                result = self.requirement_tools.suggest_alternative_projects(
                    numberOfSuggestions=tool_args.get('numberOfSuggestions', 3),
                    avoid_topics=avoid_list,
                    userSkills=user_profile
                )
                print(f"Generated suggestions: {json.dumps(result, indent=2)[:500]}")
                return result
            
            else:
                return {"error": f"Unknown tool: {tool_name}", "status": "failed"}
        
        except Exception as e:
            print(f"Tool dispatch error for {tool_name}: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"error": str(e), "status": "failed"}

  #---------------------
  # MAIN PROCESSING LOOP
  #---------------------

    def process_message(
        self,
        message: str,
        conversation_history: List[Dict[str, str]],
        user_profile: Dict[str, Any],
        session_id: str = 'default',
        files: Optional[List[Dict[str, Any]]] = None,
    ) -> Generator[Dict[str, Any], None, None]:
        """Process message and stream responses.
        
        Clean flow:
        1. LLM talks to user
        2. LLM calls tools to analyze/update requirements
        3. LLM calls mark_ready_to_plan when done
        4. Backend yields handoff signal
        5. Frontend reacts to handoff and moves to planning phase

        ``files`` – list of processed file dicts from chat.py, each with:
            type='image' → media_type, base64_data
            type='text'  → text_content
        """

        active_user_profile = user_profile if user_profile else DEFAULT_USER_SKILLS
        session = self.get_session_state(session_id)
        
        # Track the current project idea if it's new
        if session.get("project_idea") is None:
            session["project_idea"] = message

        # Prepare Context
        system_prompt = self._build_system_prompt(active_user_profile, session)
        messages: List[Dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        messages.extend(conversation_history)

        # Build the user message — multimodal when files are present
        user_content_parts = self._build_user_content(message, files or [])
        messages.append({"role": "user", "content": user_content_parts})
        
        # Optional hint for first-time idea analysis
        if session.get("project_idea") == message and not session["tool_context"]["tech_analysis_history"]:
            messages.append(
                {
                    "role": "system",
                    "content": (
                        "[System Note]: New project idea. Call 'web_search' and 'quality_check', "
                        "then refine requirements via 'update_snapshot'."
                    ),
                }
            )

        session['turn_count'] = session.get('turn_count', 0) + 1
        current_turn = session['turn_count']

        # --- THE STREAMING LOOP ---
        iteration_count = 0
        while iteration_count < MAX_ITERATIONS:
            iteration_count += 1
            print(f"Turn {current_turn} | Iteration {iteration_count}/{MAX_ITERATIONS} | Session ID: {session_id}")            
            try:
                response = self.client.chat.completions.create(
                    model="openai/gpt-5.2",
                    messages=messages,
                    tools=self.requirement_tools.get_tool_definitions(),
                    tool_choice="auto", 
                    stream=True,
                    temperature=0.7,
                )
                
                accumulated_content = ""
                tool_calls_by_index: Dict[int, Dict[str, Any]] = {}

                for chunk in response:
                    if not chunk.choices:
                        continue
                    
                    delta = chunk.choices[0].delta
                    
                    # 1. Handle content streaming
                    if delta.content:
                        accumulated_content += delta.content
                        yield {"content": delta.content}

                    # 2. Handle tool calls accumulation
                    if delta.tool_calls:
                        for tc in delta.tool_calls:
                            if tc.index is None:
                                continue

                            entry = tool_calls_by_index.get(tc.index)
                            if entry is None:
                                entry = {
                                    "index": tc.index,
                                    "id": tc.id or f"call_{time.time()}_{tc.index}",
                                    "type": "function",
                                    "function": {"name": "", "arguments": ""},
                                }
                                tool_calls_by_index[tc.index] = entry

                            if tc.id:
                                entry["id"] = tc.id

                            if tc.function and tc.function.name:
                                entry["function"]["name"] = tc.function.name

                            if tc.function and tc.function.arguments:
                                entry["function"]["arguments"] += tc.function.arguments

                tool_calls = [tool_calls_by_index[i] for i in sorted(tool_calls_by_index.keys())]

                # If no tool calls, this turn is complete
                if not tool_calls:
                    print("\nNo tools called - turn complete")
                    break

                tool_outputs: List[Dict[str, Any]] = []
                handoff_triggered = False

                for tool_call in tool_calls:
                    tool_name = tool_call["function"]["name"]
                    tool_args_str = tool_call["function"]["arguments"] or ""

                    try:
                        args = json.loads(tool_args_str) if tool_args_str else {}
                    except json.JSONDecodeError:
                        args = {}
                        result = {"error": "Invalid JSON arguments", "status": "failed"}
                    else:
                        result = self._tool_dispatch(tool_name, args, active_user_profile, session)

                    if tool_name == "mark_ready_to_plan" and result.get("ready_to_plan") is True:
                        handoff_triggered = True

                    tool_outputs.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call["id"],
                            "content": json.dumps(result),
                        }
                    )

            except Exception as e:
                import traceback
                traceback.print_exc()
                yield {"error": str(e), "content": "\n\n**Internal Error:** Check backend logs for details."}
                return

            # Add assistant message and tool results to context
            messages.append({
                "role": "assistant",
                "content": accumulated_content if accumulated_content else None,
                "tool_calls": tool_calls
            })
            messages.extend(tool_outputs)
            
            # Handle handoff
            if handoff_triggered:
                yield {"content": "\n\nI'll now hand you over to the planning phase."}
                yield {
                    "handoff": True,
                    "session_data": {
                        "snapshot": session["snapshot"],
                        "tech_analysis_history": session["tool_context"]["tech_analysis_history"],
                        "quality_check_history": session["tool_context"]["quality_check_history"],
                    },
                }
                print("\n" + "-"*30 + " HANDOFF DATA CHECK " + "-"*30)
    
                # 1. Print the full tech analysis history values
                tech_hist = session.get("tool_context", {}).get("tech_analysis_history", [])
                print(f"TECH ANALYSIS VALUES ({len(tech_hist)} items):")
                for item in tech_hist:
                    print(f"  - {item}")

                # 2. Print the full quality check history values
                qual_hist = session.get("tool_context", {}).get("quality_check_history", [])
                print(f"QUALITY CHECK VALUES ({len(qual_hist)} items):")
                for item in qual_hist:
                    print(f"  - {item}")

                print("-" * 20)
                print("MESSAGES HISTORY:")
                for i, msg in enumerate(messages):
                    role = msg.get("role")
                    # Truncate content for readability in logs if it's too long
                    content = (msg.get("content")[:100] + "...") if msg.get("content") and len(msg.get("content")) > 100 else msg.get("content")
                    print(f"  [{i}] {role.upper()}: {content}")

                return

        # Max iterations reached BUT DO NOT auto-handoff
        if iteration_count >= MAX_ITERATIONS and not session.get("ready_to_plan"):
            yield {
                "content": (
                    "\n\nI can’t hand off to planning yet because requirements weren’t explicitly finalized. Tell me what to finalize or confirm, and I’ll proceed."
                )
            }
