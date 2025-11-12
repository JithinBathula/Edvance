import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-949d056e/health", (c) => {
  return c.json({ status: "ok" });
});

// Get user by name
app.get("/make-server-949d056e/user/:name", async (c) => {
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
app.post("/make-server-949d056e/user", async (c) => {
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
app.post("/make-server-949d056e/user/:name/onboarding", async (c) => {
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
app.get("/make-server-949d056e/user/:name/course-progress", async (c) => {
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
app.post("/make-server-949d056e/user/:name/course-progress", async (c) => {
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
app.post("/make-server-949d056e/user/:name/project", async (c) => {
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
app.get("/make-server-949d056e/user/:name/projects", async (c) => {
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
app.post("/make-server-949d056e/project/:projectId/progress", async (c) => {
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
app.post("/make-server-949d056e/project/:projectId/complete", async (c) => {
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

Deno.serve(app.fetch);