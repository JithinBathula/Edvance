import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono, Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import * as kv from "./kv_store.ts";
import { streamText, convertToCoreMessages } from "ai";
import { createTools } from "./requirementGatheringAgent.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { z } from "npm:zod@3.23.8";
import { createOpenAI } from "npm:@ai-sdk/openai@1.0.11";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS (Keep your existing CORS settings)
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "x-vercel-ip-timezone", "x-vercel-ip-country"], // Added standard AI headers
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: Deno.env.get("OPENROUTER_API_KEY"), // This now holds your 'sk-or-...' key
});

// Health check endpoint
app.get("/server/health", (c: Context) => {
  return c.json({ status: "ok" });
});

// Get user by name
app.get("/server/user/:name", async (c: Context) => {
  try {
    const name = c.req.param("name");
    const user = await kv.get(`user:${name}`);
    
    if (!user) {
      return c.json({ exists: false });
    }
    
    return c.json({ exists: true, user });
  } catch (error) {
    console.log(`Error fetching user: ${error}`);
    return c.json({ error: "Failed to fetch user" }, 500);
  }
});

// Create or update user
app.post("/server/user", async (c: Context) => {
  try {
    const body = await c.req.json();
    const { name, onboarding } = body;
    
    if (!name) {
      return c.json({ error: "Name is required" }, 400);
    }
    
    const user = {
      name,
      onboarding: onboarding || null,
      createdAt: new Date().toISOString(),
      xp: 0,
      completedProjects: [],
    };
    
    await kv.set(`user:${name}`, user);
    return c.json({ success: true, user });
  } catch (error) {
    console.log(`Error creating user: ${error}`);
    return c.json({ error: "Failed to create user" }, 500);
  }
});

// Update user onboarding
app.post("/server/user/:name/onboarding", async (c: Context) => {
  try {
    const name = c.req.param("name");
    const body = await c.req.json();
    
    const user = await kv.get(`user:${name}`);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }
    
    user.onboarding = body;
    await kv.set(`user:${name}`, user);
    
    return c.json({ success: true, user });
  } catch (error) {
    console.log(`Error updating onboarding: ${error}`);
    return c.json({ error: "Failed to update onboarding" }, 500);
  }
});

// Get user progress for course
app.get("/server/user/:name/course-progress", async (c: Context) => {
  try {
    const name = c.req.param("name");
    const progress = await kv.get(`progress:${name}:course`);
    
    return c.json({ progress: progress || { completedLessons: [], currentLesson: null } });
  } catch (error) {
    console.log(`Error fetching course progress: ${error}`);
    return c.json({ error: "Failed to fetch progress" }, 500);
  }
});

// Update user progress for course
app.post("/server/user/:name/course-progress", async (c: Context) => {
  try {
    const name = c.req.param("name");
    const body = await c.req.json();
    
    await kv.set(`progress:${name}:course`, body);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error updating course progress: ${error}`);
    return c.json({ error: "Failed to update progress" }, 500);
  }
});

// Create custom project
app.post("/server/user/:name/project", async (c: Context) => {
  try {
    const name = c.req.param("name");
    const body = await c.req.json();
    const { title, description, difficulty, tasks } = body;
    
    const projectId = `project:${name}:${Date.now()}`;
    const project = {
      id: projectId,
      title,
      description,
      difficulty,
      tasks,
      createdAt: new Date().toISOString(),
      completed: false,
      progress: { completedTasks: [] },
    };
    
    await kv.set(projectId, project);
    
    // Add project to user's list
    const user = await kv.get(`user:${name}`);
    if (user) {
      if (!user.projects) user.projects = [];
      user.projects.push(projectId);
      await kv.set(`user:${name}`, user);
    }
    
    return c.json({ success: true, project });
  } catch (error) {
    console.log(`Error creating project: ${error}`);
    return c.json({ error: "Failed to create project" }, 500);
  }
});

// Get user's projects
app.get("/server/user/:name/projects", async (c: Context) => {
  try {
    const name = c.req.param("name");
    const user = await kv.get(`user:${name}`);
    
    if (!user || !user.projects) {
      return c.json({ projects: [] });
    }
    
    const projects = await kv.mget(user.projects);
    return c.json({ projects });
  } catch (error) {
    console.log(`Error fetching projects: ${error}`);
    return c.json({ error: "Failed to fetch projects" }, 500);
  }
});

// Update project progress
app.post("/server/project/:projectId/progress", async (c: Context) => {
  try {
    const projectId = c.req.param("projectId");
    const body = await c.req.json();
    
    const project = await kv.get(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }
    
    project.progress = body;
    await kv.set(projectId, project);
    
    return c.json({ success: true, project });
  } catch (error) {
    console.log(`Error updating project progress: ${error}`);
    return c.json({ error: "Failed to update progress" }, 500);
  }
});

// Complete project and award XP
app.post("/server/project/:projectId/complete", async (c:Context) => {
  try {
    const projectId = c.req.param("projectId");
    const { userName } = await c.req.json();
    
    const project = await kv.get(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }
    
    project.completed = true;
    project.completedAt = new Date().toISOString();
    await kv.set(projectId, project);
    
    // Award XP to user
    const user = await kv.get(`user:${userName}`);
    if (user) {
      user.xp = (user.xp || 0) + 100;
      if (!user.completedProjects) user.completedProjects = [];
      user.completedProjects.push(projectId);
      await kv.set(`user:${userName}`, user);
    }
    
    return c.json({ success: true, xpAwarded: 100, totalXp: user.xp });
  } catch (error) {
    console.log(`Error completing project: ${error}`);
    return c.json({ error: "Failed to complete project" }, 500);
  }
});

// --- CHAT ROUTE ---
app.post("/server/user/:name/chat", async (c: Context) => {
  try {    
    const name = c.req.param("name");
    
    // 1. Parse body safely
    let body = {};
    try { 
      body = await c.req.json(); 
    } catch (e) { 
      console.log("Empty body received"); 
    }

    // 2. Safety Check: Ensure messages is an array
    const rawMessages = (body.messages && Array.isArray(body.messages)) 
      ? body.messages 
      : [];

    const userSkills = body.userSkills || { 
      userExperienceLevel: "beginner", 
      pythonExperience: "none" 
    };
      
    console.log("Processing chat for:", name, "Msg count:", rawMessages.length);
    console.log("User Skills:", userSkills);

    // 3. Check for API Key
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    console.log("API Key Status:", apiKey ? "Found" : "MISSING");

    if (!apiKey) {
      return c.json({ 
        error: "Server Configuration Error", 
        details: "The OPENROUTER_API_KEY is missing on the server. Run 'npx supabase secrets set' to fix." 
      }, 500);
    }

    // 4. Run the Agent with streamlined system prompt
    const result = await streamText({
      model: openrouter('gpt-4o'),
      system: `You are a friendly Python mentor helping students find the right project for their skill level.

**USER PROFILE:**
- Experience: ${userSkills.userExperienceLevel || 'Beginner'}
- Python Knowledge: ${userSkills.pythonExperience || 'None'}
- Interests: ${userSkills.theme || 'General'}

**YOUR PROCESS:**
1. For EVERY new project idea the user shares:
   - Call 'webSearchForDependencies' to analyze the tech stack
   - Call 'qualityCheckTool' to check if it matches their skill level

2. Interpret the tool results:
   - If the tool says "proceed" → The project is a good match! Explain why in 2-3 concise sentences and ask: "Are you ready to create the learning plan for this project?"
   - If the tool says "choose_option" → The project doesn't match well. Summarize the key issue in 1-2 sentences, then offer these exact 3 options:
     * **Option 1:** Stick with my original idea (I'll help break it down, but it will be challenging!)
     * **Option 2:** Try a different project idea (I can suggest some if you'd like)
     * **Option 3:** Tell me another project idea you have in mind

**CRITICAL FORMATTING RULES (MUST FOLLOW):**
- ALWAYS use **bold** (double asterisks) for: technology names, key concepts, and option labels
- ALWAYS use bullet points (asterisks) when listing the 3 options
- Keep responses CONCISE - no walls of text
- Write in 2-3 sentence paragraphs maximum
- When presenting tool analysis, SUMMARIZE the key points only
- Example of correct option formatting:
  * **Option 1:** Description here
  * **Option 2:** Description here  
  * **Option 3:** Description here

**RESPONSE LENGTH GUIDELINES:**
- Project mismatch explanation: 1-2 sentences MAX (just the key issue)
- Alternative suggestions: List 2-3 project names only (no detailed descriptions)
- Good match confirmation: 2-3 sentences MAX (why it's a good fit)
- DO NOT repeat everything from the tool analysis - just the essential points
- Keep your tone conversational and encouraging, not technical or verbose

**IMPORTANT:**
- The tools handle all the analysis - just present their findings naturally
- When the user picks Option 2, call 'suggestAlternativeProject' to get tailored suggestions
- When the user picks Option 3 or shares a new idea, start the process over (call both tools again)
- Never say "there was an issue" or mention tool failures
- After user confirms the project (says "yes", "ready", etc.), simply say: "Great! Let me hand you over to the planning phase where we'll break this down into manageable tasks." Then STOP - do not generate any tasks or plans yourself`,

      messages: convertToCoreMessages(rawMessages),
      tools: createTools(userSkills),      
      maxSteps: 5,
    });

    return result.toDataStreamResponse();

  } catch (error: any) {
    console.error("CRITICAL CHAT ERROR:", error);
    
    if (error.message?.includes("API key")) {
      console.error("HINT: Did you set the OPENROUTER_API_KEY secret in Supabase?");
    }

    return c.json({ 
      error: "Failed to process chat", 
      details: error.message || String(error) 
    }, 500);
  }
});

// // Testing route for openAI key
// app.post("/server/user/:name/chat", async (c: Context) => {
//   try {
//     // 1. DEBUG: Check if the request actually reached this line
//     console.log("Request received at /user/:name/chat");

//     // 2. DEBUG: Check for API Key
//     const apiKey = Deno.env.get("OPENAI_API_KEY");
//     console.log("API Key Status:", apiKey ? "Found" : "MISSING");

//     if (!apiKey) {
//         // Return a clear error to the frontend network tab
//         return c.json({ 
//             error: "Server Configuration Error", 
//             details: "The OPENAI_API_KEY is missing on the server. Run 'npx supabase secrets set' to fix." 
//         }, 500);
//     }

//     // 3. Parse Body
//     const body = await c.req.json();
//     const messages = (body.messages && Array.isArray(body.messages)) ? body.messages : [];
//     const userSkills = body.userSkills || {};

//     console.log("Processing messages:", messages.length);

//     // 4. Run AI
//     const result = await streamText({
//       model: openai('gpt-4o', { apiKey: apiKey }), // Use the key we found
//       system: `You are an expert Software Architect.`,
//       messages: convertToCoreMessages(messages),
//       tools: tools,
//       maxSteps: 5,
//     });

//     return result.toDataStreamResponse();

//   } catch (error: any) {
//     console.error("CRASH:", error);
//     return c.json({ 
//         error: "Failed to process chat", 
//         details: error.message || String(error) 
//     }, 500);
//   }
// });

// //Testing route without tools
// app.post("/server/user/:name/chat", async (c: Context) => {
//   try {    
//     console.log("1. Request Received");
    
//     let body = {};
//     try { body = await c.req.json(); } catch (e) {}
    
//     const rawMessages = (body.messages && Array.isArray(body.messages)) ? body.messages : [];
//     console.log("2. Messages extracted:", rawMessages.length);

//     // TEST 1: Can we just talk to OpenAI without tools?
//     const result = await streamText({
//       model: openai('gpt-4o', { apiKey: Deno.env.get("OPENAI_API_KEY") }),
//       system: "You are a helpful assistant. Just say 'Hello, the connection is working!'",
//       messages: convertToCoreMessages(rawMessages),
      
//       // TOOLS DISABLED FOR TESTING
//       // tools: tools, 
//       // maxSteps: 5,
      
//       // DEBUG: Log when the AI finishes a step
//       onFinish: (event) => {
//         console.log("3. Stream Finished. Usage:", JSON.stringify(event.usage));
//         console.log("3. Finish Reason:", event.finishReason);
//       },
//     });

//     console.log("4. Stream started successfully");
//     return result.toDataStreamResponse();

//   } catch (error: any) {
//     console.error("CRITICAL ERROR:", error);
//     return c.json({ error: error.message }, 500);
//   }
// });

export default app;
