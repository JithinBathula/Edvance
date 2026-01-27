import json
import os
from typing import Dict, List, Any, Generator
from dotenv import load_dotenv
from openai import OpenAI
import time

from tools.requirement import RequirementTools
from prompts import requirements_prompts
load_dotenv()

# Hardcoded intermediate level student profile (Used as default if user data is missing)
DEFAULT_USER_SKILLS = {
    "userExperienceLevel": "beginner",
    "pythonExperience": "Just starting out",
    "theme": "web development",
    "strengths": ["functions", "data structures", "basic OOP"],
    "weaknesses": ["async programming", "advanced design patterns"],
    "completedProjects": []
}

MAX_ITERATIONS = 5

class RequirementGatheringAgent:
    @staticmethod
    def _has_ready_flag(text: str) -> bool:
        """Return True if the assistant emitted the ready-to-plan JSON flag. 
        Used to end the requirements gathering and move on to the planning stage.
        
        Input: text: str - accumulated assistant content
        Output: bool - whether ready_to_plan flag is present"""

        if not text:
            return False
        stripped = text.strip()
        try:
            parsed = json.loads(stripped)
            if isinstance(parsed, dict):
                return bool(parsed.get("ready_to_plan") is True)
        except Exception:
            pass
        lowered = stripped.lower().replace(" ", "")
        return '"ready_to_plan":true' in lowered or "'ready_to_plan':true" in lowered

    def __init__(self):
        """
        Initialize the Requirement Gathering Agent with OpenAI client and tools.
        """
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY")
        )
        self.requirement_tools = RequirementTools()

        # Session states in memory dictionary
        self.sessions = {}
        
    def get_session_state(self, session_id: str) -> Dict[str, Any]:
        """Get or create session state. Session state tracks the progress of requirement gathering."""
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                'iteration': 0,
                'project_idea': None,
                'tech_analysis': None, 
                'quality_check': None, 
                'requirements_finalized': False,
                'avoid_topics': []
            }
        return self.sessions[session_id]
    
    def reset_session(self, session_id: str):
        """Reset session state"""
        if session_id in self.sessions:
            del self.sessions[session_id]
    
    def _tool_dispatch(self, tool_name: str, tool_args: Dict[str, Any], session: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool and return results. 
        
        Input:
        - tool_name: str - name of the tool to execute
        - tool_args: Dict[str, Any] - arguments for the tool
        - session: Dict[str, Any] - current session state
        
        Ouput:
        - Dict[str, Any] - tool execution result"""
        print(f"Dispatching tool: {tool_name}")
        print(f"Arguments: {json.dumps(tool_args, indent=2)}")
        
        try:
            if tool_name == "web_search":
                return self.requirement_tools.web_search(
                    project_idea=tool_args.get('project_idea', ''), 
                    user_skills=DEFAULT_USER_SKILLS
                )
            
            elif tool_name == "quality_check":
                return self.requirement_tools.quality_check(
                    project_idea=tool_args.get('project_idea', ''),
                    libraries=tool_args.get('libraries', ''), 
                    user_skills=DEFAULT_USER_SKILLS
                )
            
            elif tool_name == "mark_ready_to_plan":
                session['ready_summary'] = tool_args.get('summary')
                return {
                    "ready_to_plan": bool(tool_args.get('ready_to_plan')),
                    "summary": tool_args.get('summary'),
                    "status": "complete"
                }
            
            elif tool_name == "suggest_alternative_projects":
                # Ensure avoid_topics includes current project
                avoid_list = tool_args.get('avoid_topics', [])
                if session.get('project_idea') and session['project_idea'] not in avoid_list:
                    avoid_list.append(session['project_idea'])
                
                result = self.requirement_tools.suggest_alternative_projects(
                    numberOfSuggestions=tool_args.get('numberOfSuggestions', 3),
                    avoid_topics=avoid_list,
                    userSkills=DEFAULT_USER_SKILLS
                )
                print(f"✅ Suggestions result: {json.dumps(result, indent=2)[:500]}")
                return result
            
            else:
                return {"error": f"Unknown tool: {tool_name}", "status": "failed"}
        
        except Exception as e:
            print(f"❌ Tool dispatch error for {tool_name}: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"error": str(e), "status": "failed"}
    
    def _build_system_prompt(self) -> str:
        """Construct the system prompt with user skills embedded."""
        return requirements_prompts.requirements_agent_prompt.format(
            experience=DEFAULT_USER_SKILLS["userExperienceLevel"].upper(),
            python_knowledge=DEFAULT_USER_SKILLS["pythonExperience"],
            interests=DEFAULT_USER_SKILLS["theme"],
        )

    def process_message(
        self,
        message: str,
        conversation_history: List[Dict[str, str]],
        session_id: str = 'default'
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Process user message and stream responses.
        The LLM will naturally understand user intent and call appropriate tools.

        Input:
        - message: str - user message
        - conversation_history: List[Dict[str, str]] - prior messages in the conversation
        - session_id: str - unique session identifier

        Output:
        - Generator yielding response chunks as Dict[str, Any] for streaming
        """
        session = self.get_session_state(session_id)
        
        # Track the current project idea if it's new
        if session['project_idea'] is None and len(conversation_history) < 2:
            session['project_idea'] = message
        
        # Prepare Context
        system_prompt = self._build_system_prompt()
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(conversation_history)
        messages.append({"role": "user", "content": message})
        
        # If this looks like a first project idea, add a hint
        if session['project_idea'] == message and session['tech_analysis'] is None:
            messages.append({
                "role": "system", 
                "content": "[System Note]: This is a new project idea. Analyze it by calling 'web_search' and 'quality_check' tools."
            })

        # --- THE STREAMING LOOP ---
        iteration_count = 0
        while iteration_count < MAX_ITERATIONS:
            iteration_count += 1
            finalize_now = False
            
            try:
                # API Call
                response = self.client.chat.completions.create(
                    model="openai/gpt-5.2",
                    messages=messages,
                    tools=self.requirement_tools.get_tool_definitions(),
                    tool_choice="auto", 
                    stream=True,
                    temperature=0.7,
                )
                
                accumulated_content = ""
                tool_calls = []
                current_tool_call = None

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
                        for tool_call_chunk in delta.tool_calls:
                            if tool_call_chunk.index is not None:
                                # Save previous tool call if starting a new one
                                if current_tool_call is not None and current_tool_call['index'] != tool_call_chunk.index:
                                    tool_calls.append(current_tool_call)
                                    current_tool_call = None
                                
                                # Initialize new tool call
                                if current_tool_call is None or current_tool_call['index'] != tool_call_chunk.index:
                                    current_tool_call = {
                                        'index': tool_call_chunk.index,
                                        'id': tool_call_chunk.id or f"call_{time.time()}_{tool_call_chunk.index}",
                                        'type': 'function',
                                        'function': {
                                            'name': tool_call_chunk.function.name if tool_call_chunk.function and tool_call_chunk.function.name else '',
                                            'arguments': ''
                                        }
                                    }
                            
                            # Append arguments
                            if tool_call_chunk.function and tool_call_chunk.function.arguments:
                                if current_tool_call:
                                    current_tool_call['function']['arguments'] += tool_call_chunk.function.arguments
                
                # Save the last tool call
                if current_tool_call:
                    tool_calls.append(current_tool_call)

            except Exception as e:
                print(f"Error during AI processing: {str(e)}")
                yield {"error": str(e), "content": "\n\n**Error:** I encountered a backend error. Please try again."}
                return

            # --- DECISION POINT ---
            
            # Case A: No tools called - conversation done
            if not tool_calls:
                if self._has_ready_flag(accumulated_content):
                    if not session['requirements_finalized']:
                        session['requirements_finalized'] = True
                        print("REQUIREMENTS", json.dumps(session, indent=2))
                        final_msg = "\n\nI'll now hand you over to the planning phase."
                        yield {"content": final_msg}
                break 

            # Case B: Execute tools
            print(f"Executing {len(tool_calls)} tool calls")
            
            tool_outputs = []
            
            for tool_call in tool_calls:
                tool_name = tool_call['function']['name']
                tool_args_str = tool_call['function']['arguments']
                
                print(f"Tool: {tool_name}, Args: {tool_args_str[:100]}")
                
                try:
                    args = json.loads(tool_args_str) if tool_args_str else {}
                    result = self._tool_dispatch(tool_name, args, session)
                    
                    # Save state
                    if tool_name == "web_search":
                        session['tech_analysis'] = result
                    elif tool_name == "quality_check":
                        session['quality_check'] = result
                    elif tool_name == "mark_ready_to_plan":
                        if result.get("ready_to_plan") is True and not session['requirements_finalized']:
                            session['requirements_finalized'] = True
                            print("REQUIREMENTS", json.dumps(session, indent=2))
                            finalize_now = True
                    
                    # Check if tool execution failed
                    if result.get('status') == 'failed':
                        print(f"⚠️  Tool {tool_name} failed: {result.get('error')}")
                        # Continue anyway - let the LLM handle the failure
                    
                except json.JSONDecodeError as e:
                    print(f"JSON Error for tool {tool_name}: {e}")
                    print(f"Bad JSON string: {tool_args_str}")
                    result = {"error": "Invalid arguments", "status": "failed"}
                except Exception as e:
                    print(f"Tool execution error: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    result = {"error": f"Tool execution failed: {str(e)}", "status": "failed"}

                tool_outputs.append({
                    "role": "tool",
                    "tool_call_id": tool_call['id'],
                    "content": json.dumps(result)
                })

            # Add assistant message and tool results to context
            messages.append({
                "role": "assistant",
                "content": accumulated_content if accumulated_content else None,
                "tool_calls": tool_calls
            })
            messages.extend(tool_outputs)
            
            if finalize_now:
                final_msg = "\n\nI'll now hand you over to the planning phase."
                yield {"content": final_msg}
                break
            
            # Loop continues - LLM will process tool results

        # Loop exit
        if iteration_count >= MAX_ITERATIONS:
            yield {"content": "\n\n*I've analyzed enough. Let's proceed based on what we have.*"}
            if not session['requirements_finalized']:
                session['requirements_finalized'] = True
                print("REQUIREMENTS", json.dumps(session, indent=2))
