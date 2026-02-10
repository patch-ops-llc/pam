import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const app = express();

// Health check endpoint - must respond before any async initialization
// This ensures deployment health checks pass immediately
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Ensure anonymous user exists for calendar connections and slack configurations
async function ensureAnonymousUser() {
  try {
    const [anonymousUser] = await db.select().from(users).where(eq(users.username, 'anonymous')).limit(1);
    
    if (!anonymousUser) {
      await db.insert(users).values({
        username: 'anonymous',
        email: 'anonymous@system.local',
        password: 'unused', // Won't be used for login
        firstName: 'Anonymous',
        lastName: 'User',
        role: 'user'
      });
      log('Created anonymous user for system operations');
    }
  } catch (error) {
    log('Note: Anonymous user may already exist or schema not ready yet');
  }
}

// Export helper to get anonymous user ID
export async function getAnonymousUserId(): Promise<string> {
  const [anonymousUser] = await db.select().from(users).where(eq(users.username, 'anonymous')).limit(1);
  if (!anonymousUser) {
    throw new Error('Anonymous user not found - ensure database is initialized');
  }
  return anonymousUser.id;
}

(async () => {
  // Ensure anonymous user exists before starting
  await ensureAnonymousUser();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    // Variable import path prevents esbuild from bundling dev-only vite dependency
    const devModule = "./vite-dev";
    const { setupVite } = await import(devModule);
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Railway injects PORT automatically. Default to 5000 for local dev.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
