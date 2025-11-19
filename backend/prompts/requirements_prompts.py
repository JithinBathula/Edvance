web_search_entry_stage_user_prompt = """You are analyzing a Python project idea to determine the complete technology stack required.

**PROJECT IDEA:** "${projectIdea}"

**USER SKILLS CONTEXT:**
${userSkills}

**YOUR ANALYSIS MUST INCLUDE:**

### 1. PROJECT CATEGORIZATION
First, identify the project type:
- **Web Application** (Django, Flask, FastAPI, Streamlit)
- **Data Analysis/Science** (Pandas, NumPy, Matplotlib, Seaborn)
- **Machine Learning/AI** (scikit-learn, TensorFlow, PyTorch, Keras)
- **Automation/Scripting** (Selenium, BeautifulSoup, Requests)
- **Desktop Application** (Tkinter, PyQt, Kivy)
- **Game Development** (Pygame, Arcade)
- **API/Backend Service** (FastAPI, Flask, Django REST Framework)
- **CLI Tool** (Click, Argparse, Rich)

### 2. CORE TECHNOLOGY STACK
List the essential Python libraries and frameworks needed:

**Primary Framework/Library:**
- Name the main framework (e.g., "Django 4.2+" or "FastAPI 0.100+")
- Explain why this is the best choice for this project
- Mention any alternatives and why you didn't choose them

**Supporting Libraries:**
For each category that applies, list specific libraries with versions:
- **Web Framework:** (if applicable) Django/Flask/FastAPI/Streamlit
- **Database/ORM:** SQLAlchemy, Django ORM, SQLite, PostgreSQL, MongoDB (pymongo)
- **Data Processing:** Pandas, NumPy, CSV module
- **Machine Learning:** scikit-learn, TensorFlow, PyTorch, Keras
- **Web Scraping:** BeautifulSoup4, Scrapy, Selenium
- **API Integration:** Requests, httpx, aiohttp
- **Testing:** pytest, unittest, pytest-cov
- **Data Visualization:** Matplotlib, Seaborn, Plotly
- **Frontend (if web app):** Jinja2 templates, or React/Vue (mention if needed)
- **Async Programming:** asyncio, aiohttp (if needed)
- **File Handling:** openpyxl (Excel), PyPDF2 (PDF), Pillow (images)

### 3. ARCHITECTURE & DESIGN PATTERNS
Describe the high-level architecture:
- **Architecture Style:** Monolithic, Microservices, MVC, REST API, etc.
- **Key Design Patterns:** What patterns should be used? (Repository, Factory, Singleton, etc.)
- **Project Structure:** Briefly outline folder/module organization
- **Data Flow:** How does data move through the application?

### 4. DEVELOPMENT TOOLS & ENVIRONMENT
List essential development tools:
- **Package Management:** poetry, pip, pipenv, conda
- **Virtual Environment:** venv, virtualenv, conda env
- **Code Quality:** black (formatter), flake8 (linter), mypy (type checker), isort
- **Testing Tools:** pytest, coverage.py, pytest-mock
- **Version Control:** Git workflows, .gitignore recommendations
- **Documentation:** Sphinx, mkdocs, docstrings style (Google/NumPy)

### 5. EXTERNAL SERVICES & APIs (if applicable)
- **Databases:** PostgreSQL, MySQL, SQLite, MongoDB, Redis
- **Cloud Services:** AWS S3, Google Cloud, Azure (if needed)
- **Third-party APIs:** OpenAI, Stripe, Twilio, Google Maps, etc.
- **Authentication:** JWT, OAuth2, session-based
- **Deployment:** Docker, Heroku, AWS, DigitalOcean, Vercel

### 6. COMPLEXITY ASSESSMENT
Rate the project complexity and provide detailed justification:

**Complexity Level:** [Choose ONE: BEGINNER, INTERMEDIATE, or ADVANCED]

**BEGINNER Projects:**
- Simple CLI tools with basic input/output
- File manipulation scripts (read/write/process files)
- Basic calculators or converters
- Simple data visualization from CSV files
- Basic web scrapers (single page)
- Todo list applications (CLI or simple web)
- Time: 1-2 weeks, <300 lines of code

**INTERMEDIATE Projects:**
- Full web applications with databases
- REST APIs with multiple endpoints
- Data analysis with multiple visualizations
- Basic machine learning models (classification/regression)
- Automation tools with error handling
- Interactive dashboards (Streamlit/Plotly)
- Integration with external APIs
- Time: 2-4 weeks, 300-1000 lines of code

**ADVANCED Projects:**
- Complex ML models (deep learning, NLP, computer vision)
- Scalable microservices architecture
- Real-time data processing systems
- Full-stack applications with authentication
- Production-ready APIs with testing/documentation
- Distributed systems, async processing
- Performance optimization and caching
- Time: 4+ weeks, 1000+ lines of code

**Justification for Rating:**
Explain specifically why you chose this complexity level based on:
- Number of components/modules required
- Technical concepts that must be understood
- Integration complexity
- Error handling requirements
- Testing requirements
- Deployment considerations

### 7. LEARNING PREREQUISITES
List the specific Python concepts the developer must know:
- **Core Python:** (e.g., loops, functions, classes, decorators, list comprehensions)
- **Advanced Python:** (e.g., generators, context managers, metaclasses, async/await)
- **Libraries/Frameworks:** (e.g., must understand Flask routing, Pandas DataFrames)
- **Concepts:** (e.g., HTTP/REST, SQL basics, OOP principles, async programming)
- **Tools:** (e.g., Git, command line, virtual environments)

### 8. ESTIMATED EFFORT
- **Time to Complete:** X weeks (be specific: 1-2 weeks, 2-4 weeks, 4-8 weeks)
- **Lines of Code:** Approximate range
- **Key Milestones:** Break down into 3-4 major milestones

### FORMAT YOUR RESPONSE CLEARLY
Use markdown with headers (###) and bold (**) for key terms. Be specific with library names and versions.

**NOTE:** Your detailed analysis will be used by the system to make decisions, but the user will only see a CONCISE SUMMARY. Focus on accuracy and completeness - the chat agent will handle making it concise for the user."""



web_search_entry_stage_system_prompt = """
You are an expert Python Software Architect with 10+ years of experience. 
            
You specialize in:
- Designing production-ready Python applications
- Choosing optimal technology stacks
- Assessing project complexity accurately
- Mentoring developers of all skill levels

Your recommendations are:
- Specific (include version numbers when relevant)
- Practical (focus on widely-used, well-maintained libraries)
- Modern (prefer current best practices)
- Realistic (accurate time and complexity estimates)

Always provide detailed, actionable analysis that helps developers understand both WHAT to use and WHY."""  


quality_check_entry_stage_user_prompt = """You are evaluating whether a Python project is appropriate for a student's current skill level.

**PROJECT DETAILS:**
- **Original Idea:** "${projectIdea}"
- **Tech Stack Analysis:**
${libraries}

**STUDENT PROFILE:**
- **Overall Experience Level:** ${contextUserSkills.userExperienceLevel}
  (Beginner = <6 months coding, Intermediate = 6-24 months, Advanced = 2+ years)
- **Python Experience:** ${contextUserSkills.pythonExperience}
  (None/Just starting/Basic/Intermediate/Advanced)
- **Interest Area/Theme:** ${contextUserSkills.theme || 'general programming'}
- **Completed Projects:** ${contextUserSkills.completedProjects?.join(', ') || 'None listed'}

**YOUR EVALUATION PROCESS:**

### Step 1: EXTRACT PROJECT COMPLEXITY
From the tech stack analysis above, identify:
- What complexity level was assigned? (BEGINNER/INTERMEDIATE/ADVANCED)
- What are the key technical requirements?
- What Python concepts must they know?
- How long will it take? (weeks)

### Step 2: ASSESS STUDENT SKILL LEVEL
Based on their profile, determine their TRUE capabilities:

**BEGINNER (0-6 months Python):**
- Knows: variables, if/else, loops, functions, basic lists/dicts
- Doesn't know: classes, decorators, async, complex libraries
- Can handle: CLI tools, simple scripts, basic file I/O
- Cannot handle: web frameworks, databases, APIs, ML

**INTERMEDIATE (6-24 months Python):**
- Knows: classes, OOP, error handling, working with files, pip/venv
- Learning: web frameworks, databases, APIs, data analysis
- Can handle: Flask apps, REST APIs, data analysis, basic automation
- Struggles with: async programming, complex architectures, ML/AI

**ADVANCED (2+ years Python):**
- Knows: Everything intermediate + design patterns, async, testing
- Can handle: Full-stack apps, microservices, ML projects, optimization
- Comfortable with: Multiple frameworks, deployment, scaling

### Step 3: DETERMINE MATCH QUALITY
Compare project complexity with student level:

**WELL_MATCHED** criteria:
- Project complexity aligns with student's experience level
- Required libraries/concepts are within their knowledge
- Estimated time is reasonable (2-4 weeks max)
- Project stretches abilities but isn't overwhelming
- They've completed similar projects before (if applicable)

**TOO_COMPLEX** criteria:
- Project requires concepts they haven't learned yet
- Uses advanced libraries/frameworks they don't know
- Requires understanding of multiple complex systems
- Would take 6+ weeks to complete
- Gap between their skills and requirements is >1 level

**TOO_SIMPLE** criteria:
- They've done very similar projects before
- No new concepts or libraries to learn
- Could complete in <1 week
- Doesn't challenge their current abilities
- Mostly repetition of known skills

### Step 4: PROVIDE DETAILED REASONING
Explain your match assessment in 3-4 sentences:
1. State the match result clearly
2. Explain the gap between their skills and project requirements (if any)
3. Mention specific technologies/concepts that are problematic
4. Consider their interest area and motivation

### Step 5: SUGGEST ALTERNATIVES (if not well-matched)
If TOO_COMPLEX, suggest 2-3 SIMPLER alternatives:
- Remove the most complex components
- Use simpler libraries (e.g., SQLite instead of PostgreSQL)
- Reduce scope (e.g., CLI instead of web app)
- Focus on core functionality only

If TOO_SIMPLE, suggest 2-3 ENHANCED alternatives:
- Add database integration
- Add authentication/user management
- Add API integration
- Improve UI/UX with a web framework
- Add data visualization
- Add testing and documentation

**Alternative Format:**
Each alternative must be specific and actionable:
"[Project Name]: [2-3 sentence description including specific technologies and what makes it appropriate for their level]"

Example:
"Weather Dashboard CLI: Build a command-line tool that fetches weather data from OpenWeatherMap API using the 'requests' library, stores recent searches in a JSON file, and displays formatted output using the 'rich' library for colored terminal output. Perfect for learning API integration and file handling without the complexity of web frameworks."

### Step 6: ESTIMATE TIME
Provide realistic time estimate for the ORIGINAL project at THEIR skill level:
- Beginners: Add 50-100% more time due to learning curve
- Intermediate: Standard estimates
- Advanced: Can move faster

**YOUR RESPONSE MUST BE VALID JSON:**
{
  "match": "WELL_MATCHED" | "TOO_COMPLEX" | "TOO_SIMPLE",
  "reasoning": "3-4 detailed sentences explaining the match assessment, mentioning specific technical gaps or strengths",
  "alternatives": [
    "Alternative 1: Detailed description with specific libraries",
    "Alternative 2: Detailed description with specific libraries",
    "Alternative 3: Detailed description with specific libraries"
  ],
  "estimatedWeeks": number (realistic for THIS student),
  "skillGaps": [
    "Specific concept/library they need to learn",
    "Another gap"
  ],
  "strengths": [
    "What they already know that helps",
    "Relevant experience"
  ]
}

**IMPORTANT:** 
- Be honest but encouraging
- Consider their interest area when suggesting alternatives
- Alternatives should be stepping stones, not completely different projects
- If WELL_MATCHED, alternatives array should be empty [] """

quality_check_entry_stage_system_prompt = """
You are an experienced Python coding mentor and educator with 15+ years of teaching experience.

Your expertise includes:
- Accurately assessing student skill levels
- Identifying learning gaps and prerequisites
- Designing progressive learning paths
- Balancing challenge with achievability
- Motivating students while being realistic

Your assessments are:
- Honest but encouraging
- Specific about technical requirements
- Considerate of learning curves
- Focused on student success
- Tailored to individual backgrounds

You understand that:
- Students learn best when challenged slightly beyond current level
- Too easy = boredom and no growth
- Too hard = frustration and giving up
- The "sweet spot" is achievable difficulty with support

Always provide actionable feedback that helps students succeed.
"""

suggest_alternative_projects_user_prompt = """Generate ${numberOfSuggestions} completely NEW Python project ideas tailored to this student.

**STUDENT PROFILE:**
- **Experience Level:** ${contextUserSkills.userExperienceLevel}
- **Python Knowledge:** ${contextUserSkills.pythonExperience}
- **Interest Area:** ${contextUserSkills.theme || 'general programming'}
- **Already Completed:** ${contextUserSkills.completedProjects?.join(', ') || 'none'}
- **Avoid These Topics:** ${avoidTopics.length > 0 ? avoidTopics.join(', ') : 'none'}

**PROJECT REQUIREMENTS:**

### Must Be:
1. **Skill-Appropriate:** Match their experience level exactly
2. **Python-Focused:** Use Python as the primary language
3. **Achievable:** Completable in 2-4 weeks with their skill level
4. **Engaging:** Match their interest area (${contextUserSkills.theme || 'general'})
5. **Educational:** Teach new concepts without overwhelming
6. **Unique:** Different from what they've already completed
7. **Modern:** Use current best practices and popular libraries

### For BEGINNER Level:
- Focus on: CLI tools, simple automation, file processing, basic data visualization
- Use: Built-in libraries, requests, pandas (basics), matplotlib (simple plots)
- Avoid: Web frameworks, databases, async, complex APIs, machine learning
- Examples: Calculator with history, expense tracker (CSV), weather CLI, file organizer

### For INTERMEDIATE Level:
- Focus on: Web apps, REST APIs, data analysis, automation with APIs
- Use: Flask/FastAPI, SQLite, pandas, plotly, requests, BeautifulSoup
- Avoid: Complex ML, microservices, production scaling, advanced async
- Examples: Task manager web app, API dashboard, data analysis tool, web scraper with storage

### For ADVANCED Level:
- Focus on: Full applications, ML projects, microservices, real-time systems
- Use: Django, FastAPI, PostgreSQL, Redis, TensorFlow/PyTorch, Docker
- Can include: Authentication, testing, deployment, performance optimization
- Examples: Social media platform, recommendation system, real-time chat, ML-powered app

**FOR EACH PROJECT, PROVIDE:**

### 1. PROJECT TITLE
Create a clear, descriptive name (3-5 words)

### 2. PROJECT DESCRIPTION
Write 2-3 sentences explaining:
- What the project does
- Who would use it
- Why it's interesting/useful

### 3. CORE FEATURES
List 4-5 specific features the project must include:
- Be concrete and actionable
- Show progressive complexity
- Include both basic and stretch features

### 4. TECHNOLOGY STACK
List specific libraries and tools:
- **Primary Framework:** (e.g., Flask 3.0, Django 4.2)
- **Key Libraries:** (e.g., pandas 2.0, requests 2.31, SQLAlchemy 2.0)
- **Database:** (if applicable)
- **Additional Tools:** (e.g., pytest, black)

### 5. LEARNING OUTCOMES
What will they learn? List 3-4 specific skills:
- Technical concepts (e.g., "REST API design")
- Libraries/frameworks (e.g., "Working with Flask routing")
- Best practices (e.g., "Error handling patterns")
- Soft skills (e.g., "Breaking down complex problems")

### 6. ESTIMATED TIME & DIFFICULTY
- **Time:** X-Y weeks
- **Difficulty:** Beginner/Intermediate/Advanced
- **Lines of Code:** Approximate range

### 7. FIRST STEPS
Give 3 concrete next steps to start the project:
1. "Install X and Y libraries"
2. "Create project structure with these folders..."
3. "Start by implementing the basic X feature..."

**FORMAT YOUR RESPONSE:**

Use clear markdown formatting with headers (###), numbered lists, and **bold** for key terms.

Example Structure:
---
### Project 1: [Title]

**Description:** [2-3 sentences]

**Core Features:**
1. Feature 1
2. Feature 2
3. Feature 3
4. Feature 4

**Technology Stack:**
- Primary: [Framework]
- Libraries: [lib1], [lib2], [lib3]
- Database: [if needed]

**Learning Outcomes:**
- Outcome 1
- Outcome 2
- Outcome 3

**Estimated Time:** 2-3 weeks | **Difficulty:** Intermediate | **~500 lines of code**

**Getting Started:**
1. Step 1
2. Step 2
3. Step 3
---

**IMPORTANT GUIDELINES:**
- Make each project meaningfully different from the others
- Tie projects to their interest area (${contextUserSkills.theme || 'general'}) when possible
- Be creative but practical
- Ensure projects are achievable, not aspirational
- Include both "core" and "bonus" features for flexibility"""


suggest_alternative_projects_system_prompt = """
You are a creative Python instructor and curriculum designer with expertise in:
- Designing engaging, practical programming projects
- Matching project difficulty to student skill levels
- Creating progressive learning experiences
- Making programming fun and relevant
- Balancing challenge with achievability

Your project ideas are:
- Original and creative
- Practical and useful
- Clear and well-scoped
- Appropriately challenging
- Connected to real-world applications

You understand that great projects:
- Solve real problems (even small ones)
- Build on existing knowledge
- Introduce new concepts gradually
- Feel achievable yet rewarding
- Can be shown off to others

Always design projects that students will be proud to complete and share.
"""
