"""
Requirement Gathering Agent with LLM Tool Iterations
Manages conversation flow and tool execution for project requirement gathering
"""
import json
import os
from typing import Dict, List, Any, Generator
from dotenv import load_dotenv
from openai import OpenAI

from tools.requirement import RequirementTools

load_dotenv()

# Hardcoded intermediate level student profile
DEFAULT_USER_SKILLS = {
    "userExperienceLevel": "intermediate",
    "pythonExperience": "Intermediate - 1 year",
    "theme": "web development",
    "completedProjects": ["To-Do List CLI", "Weather App API"],
    "quizResults": {
        "score": 65,
        "level": "intermediate",
        "strengths": ["functions", "data structures", "basic OOP"],
        "weaknesses": ["async programming", "advanced design patterns"]
    }
}

MAX_ITERATIONS = 5

SYSTEM_PROMPT = """You are an expert educational AI assistant helping students plan their custom Python projects.

Your role is to:
1. Understand the student's project idea through conversation
2. Use available tools to analyze technical requirements and complexity
3. Validate if the project matches the student's skill level
4. Guide the student through requirement gathering with questions
5. Help finalize project requirements before moving to planning

**Available Tools:**
- web_search: Analyze project idea and identify required libraries, frameworks, and complexity
- quality_check: Validate if project complexity matches student's skill level
- suggest_alternative_projects: Generate alternative project ideas if current one doesn't match

**Your Conversation Flow:**
1. **Initial Understanding** (Iteration 1-2):
   - Ask clarifying questions about the project idea
   - Understand what features they want
   - Get details about scope and goals

2. **Technical Analysis** (Iteration 2-3):
   - Use web_search tool to analyze technical requirements
   - Share findings with the student in a conversational way
   - Ask if they're comfortable with the required technologies

3. **Skill Validation** (Iteration 3-4):
   - Use quality_check tool to validate complexity vs skill level
   - If TOO_COMPLEX or TOO_SIMPLE, discuss alternatives
   - Let student decide: proceed anyway, modify, or choose alternative

4. **Finalization** (Iteration 4-5):
   - Confirm all requirements
   - Summarize the finalized project scope
   - Signal readiness to move to planning stage

**Communication Style:**
- Be encouraging and supportive
- Ask specific, focused questions
- Explain technical concepts in simple terms
- Present tool findings conversationally (don't just dump raw data)
- Give the student agency in decision-making
- Keep responses concise (2-3 paragraphs max)

**Important:**
- You have a maximum of 5 iterations to complete requirement gathering
- After iteration 5, you must finalize and move forward
- Don't overwhelm the student with too much information at once
- Focus on ONE aspect per message (don't ask multiple questions)
- Use tools strategically - don't call tools unnecessarily

**Current Student Profile:**
The student is at an INTERMEDIATE level with 1 year of Python experience. They're interested in web development and have completed basic projects like a To-Do List CLI and Weather App API. They're comfortable with functions, data structures, and basic OOP, but still learning async programming and advanced design patterns."""


class RequirementGatheringAgent:
    def __init__(self):
        self.openrouter = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY")
        )
        self.requirement_tools = RequirementTools()
        self.sessions = {}  # Store session state
        
    def get_session_state(self, session_id: str) -> Dict[str, Any]:
        """Get or create session state"""
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                'iteration': 0,
                'project_idea': None,
                'tech_analysis': None,
                'quality_check': None,
                'requirements_finalized': False,
                'messages': []
            }
        return self.sessions[session_id]
    
    def reset_session(self, session_id: str):
        """Reset session state"""
        if session_id in self.sessions:
            del self.sessions[session_id]
    
    def execute_tool(self, tool_name: str, tool_args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool and return results"""
        try:
            if tool_name == "web_search":
                project_idea = tool_args.get('project_idea', '')
                return self.requirement_tools.web_search(project_idea, DEFAULT_USER_SKILLS)
            
            elif tool_name == "quality_check":
                project_idea = tool_args.get('project_idea', '')
                libraries = tool_args.get('libraries', '')
                return self.requirement_tools.quality_check(
                    project_idea, libraries, DEFAULT_USER_SKILLS
                )
            
            elif tool_name == "suggest_alternative_projects":
                num_suggestions = tool_args.get('numberOfSuggestions', 3)
                avoid_topics = tool_args.get('avoid_topics', [])
                return self.requirement_tools.suggest_alternative_projects(
                    num_suggestions, avoid_topics, DEFAULT_USER_SKILLS
                )
            
            else:
                return {"error": f"Unknown tool: {tool_name}", "status": "failed"}
        
        except Exception as e:
            return {"error": str(e), "status": "failed"}
    
    def process_message(
        self,
        message: str,
        conversation_history: List[Dict[str, str]],
        session_id: str = 'default'
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Process user message through LLM with tool calling capability
        Yields streaming response chunks
        """
        session = self.get_session_state(session_id)
        session['iteration'] += 1
        
        # Build messages for LLM
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]
        
        # Add conversation history
        for msg in conversation_history:
            messages.append({
                "role": msg['role'],
                "content": msg['content']
            })
        
        # Add current user message
        messages.append({
            "role": "user",
            "content": message
        })
        
        # Add iteration context
        iteration_context = f"\n\n[System: This is iteration {session['iteration']}/{MAX_ITERATIONS} of requirement gathering]"
        messages[-1]['content'] += iteration_context
        
        # Store project idea from first message if not set
        if not session['project_idea'] and session['iteration'] == 1:
            session['project_idea'] = message
        
        # Call LLM with tool definitions
        try:
            response = self.openrouter.chat.completions.create(
                model="openai/gpt-4o",
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
                
                # Handle content streaming
                if delta.content:
                    accumulated_content += delta.content
                    yield {"content": delta.content}
                
                # Handle tool calls
                if delta.tool_calls:
                    for tool_call_chunk in delta.tool_calls:
                        if tool_call_chunk.index is not None:
                            # New tool call
                            if current_tool_call is None or tool_call_chunk.index != current_tool_call['index']:
                                if current_tool_call:
                                    tool_calls.append(current_tool_call)
                                current_tool_call = {
                                    'index': tool_call_chunk.index,
                                    'id': tool_call_chunk.id or '',
                                    'type': 'function',
                                    'function': {
                                        'name': tool_call_chunk.function.name if tool_call_chunk.function else '',
                                        'arguments': ''
                                    }
                                }
                        
                        # Accumulate function arguments
                        if tool_call_chunk.function and tool_call_chunk.function.arguments:
                            current_tool_call['function']['arguments'] += tool_call_chunk.function.arguments
                
                # Check if done
                if chunk.choices[0].finish_reason == 'tool_calls':
                    if current_tool_call:
                        tool_calls.append(current_tool_call)
                    break
                elif chunk.choices[0].finish_reason == 'stop':
                    break
            
            # If tool calls were made, execute them and continue conversation
            if tool_calls:
                yield {"content": "\n\n_[Analyzing with tools...]_\n\n"}
                
                # Execute each tool call
                tool_messages = []
                for tool_call in tool_calls:
                    tool_name = tool_call['function']['name']
                    tool_args = json.loads(tool_call['function']['arguments'])
                    
                    # Execute tool
                    tool_result = self.execute_tool(tool_name, tool_args)
                    
                    # Store results in session
                    if tool_name == "web_search":
                        session['tech_analysis'] = tool_result
                    elif tool_name == "quality_check":
                        session['quality_check'] = tool_result
                    
                    # Add tool result to messages
                    tool_messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call['id'],
                        "content": json.dumps(tool_result)
                    })
                
                # Add assistant message with tool calls
                messages.append({
                    "role": "assistant",
                    "content": accumulated_content or None,
                    "tool_calls": tool_calls
                })
                
                # Add tool results
                messages.extend(tool_messages)
                
                # Get LLM response after tool execution
                follow_up_response = self.openrouter.chat.completions.create(
                    model="openai/gpt-4o",
                    messages=messages,
                    stream=True,
                    temperature=0.7,
                )
                
                for chunk in follow_up_response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield {"content": chunk.choices[0].delta.content}
            
            # Check if we've reached max iterations
            if session['iteration'] >= MAX_ITERATIONS and not session['requirements_finalized']:
                yield {"content": "\n\n---\n\n✅ **Requirement gathering complete!** We're ready to move to the planning stage."}
                session['requirements_finalized'] = True
        
        except Exception as e:
            yield {
                "error": str(e),
                "content": f"\n\nI encountered an error: {str(e)}. Please try again."
            }

