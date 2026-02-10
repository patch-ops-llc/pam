// Based on blueprint:javascript_auth_all_persistance integration
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { z } from "zod";

declare global {
  namespace Express {
    interface User extends Omit<SelectUser, 'password'> {}
  }
}

const scryptAsync = promisify(scrypt);

// Sanitize user object by removing password hash
function sanitizeUser(user: SelectUser): Omit<SelectUser, 'password'> {
  const { password, ...sanitized } = user;
  return sanitized;
}

// Input validation schema for registration
const registerSchema = insertUserSchema.omit({ id: true });

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  if (!stored || !stored.includes(".")) {
    return false;
  }
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) {
    return false;
  }
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Passport serialization/deserialization (sanitized user data only)
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (user) {
        done(null, sanitizeUser(user));
      } else {
        done(null, false);
      }
    } catch (error) {
      done(error);
    }
  });

  // Local Strategy for username/password authentication
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        } else {
          return done(null, sanitizeUser(user));
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  // Google OAuth Strategy for SSO login
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    // Build absolute callback URL with HTTPS
    const getCallbackUrl = () => {
      if (process.env.APP_URL) {
        let appUrl = process.env.APP_URL.trim().replace(/\/+$/, ''); // trim trailing slashes
        // Ensure the URL has a protocol prefix
        if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
          appUrl = `https://${appUrl}`;
        }
        const url = `${appUrl}/auth/google/callback`;
        console.log("[Google OAuth] Using APP_URL callback:", url);
        return url;
      }
      console.log("[Google OAuth] Using relative callback URL");
      return "/auth/google/callback";
    };

    const callbackUrl = getCallbackUrl();
    console.log("[Google OAuth] Configured callback URL:", callbackUrl);

    passport.use("google",
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: callbackUrl,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            console.log("[Google OAuth] Callback received for email:", email);
            
            if (!email) {
              console.log("[Google OAuth] ERROR: No email in profile");
              return done(new Error("No email found in Google profile"));
            }

            // Check if user exists by Google ID first
            let existingUser = await storage.getUserByGoogleId(profile.id);
            console.log("[Google OAuth] User by Google ID:", existingUser ? existingUser.id : "not found");
            
            if (!existingUser) {
              // Check if user exists by email (to link accounts)
              existingUser = await storage.getUserByEmail(email);
              console.log("[Google OAuth] User by email:", existingUser ? existingUser.id : "not found");
              
              if (!existingUser) {
                // User doesn't exist - don't auto-register
                console.log("[Google OAuth] REJECTED: No account found for email:", email);
                return done(null, false, { message: "Account not found. Please contact an administrator." });
              }
              
              // Link Google ID to existing email account
              await storage.updateUser(existingUser.id, {
                googleId: profile.id,
                profileImageUrl: profile.photos?.[0]?.value,
              });
              existingUser = await storage.getUser(existingUser.id);
            } else {
              // Update profile image if changed
              if (profile.photos?.[0]?.value && existingUser.profileImageUrl !== profile.photos[0].value) {
                await storage.updateUser(existingUser.id, {
                  profileImageUrl: profile.photos[0].value,
                });
                existingUser = await storage.getUser(existingUser.id);
              }
            }

            if (!existingUser) {
              return done(new Error("Failed to retrieve user"));
            }

            return done(null, sanitizeUser(existingUser));
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );

    // Google OAuth routes
    app.get("/auth/google", passport.authenticate("google", { 
      scope: ["profile", "email"]
    }));

    app.get("/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/auth?error=google_login_failed" }),
      (req, res) => {
        console.log("[Google OAuth] Login successful, user:", req.user?.id);
        console.log("[Google OAuth] Session ID:", req.sessionID);
        res.redirect("/");
      }
    );
  }

  // User registration endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      // Validate input data
      const validatedData = registerSchema.parse(req.body);

      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const user = await storage.createUser({
        ...validatedData,
        password: await hashPassword(validatedData.password),
      });

      const sanitizedUser = sanitizeUser(user);
      // Regenerate session to prevent session fixation
      req.session.regenerate((err) => {
        if (err) return next(err);
        req.login(sanitizedUser, (loginErr) => {
          if (loginErr) return next(loginErr);
          res.status(201).json(sanitizedUser);
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid input data", 
          details: error.errors 
        });
      }
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  // User login endpoint  
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message || "Login failed" });
      
      // Regenerate session to prevent session fixation
      req.session.regenerate((sessionErr) => {
        if (sessionErr) return next(sessionErr);
        req.login(user, (loginErr) => {
          if (loginErr) return next(loginErr);
          res.status(200).json(user); // Already sanitized by LocalStrategy
        });
      });
    })(req, res, next);
  });

  // User logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      // Destroy session for complete cleanup
      req.session.destroy((sessionErr) => {
        if (sessionErr) return next(sessionErr);
        res.sendStatus(200);
      });
    });
  });

  // Get current user endpoint
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user); // Already sanitized from session
  });
}

// Middleware to protect routes - requires authentication
export function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  next();
}

// API Key utilities
export async function generateApiKey(): Promise<{ plainKey: string; hashedKey: string; keyPrefix: string }> {
  const keyBytes = randomBytes(32);
  const plainKey = `pam_${keyBytes.toString("hex")}`;
  const keyPrefix = plainKey.substring(0, 12); // "pam_" + 8 chars
  const hashedKey = await hashApiKey(plainKey);
  return { plainKey, hashedKey, keyPrefix };
}

export async function hashApiKey(key: string): Promise<string> {
  const salt = "pam-api-key-static-salt"; // Use static salt for API key lookup
  const buf = (await scryptAsync(key, salt, 64)) as Buffer;
  return buf.toString("hex");
}

// Middleware that accepts either session auth OR API key
export async function requireApiKeyOrAuth(req: any, res: any, next: any) {
  // First check session auth
  if (req.isAuthenticated()) {
    return next();
  }

  // Then check API key
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || typeof apiKey !== "string") {
    return res.status(401).json({ error: "Authentication required. Provide session auth or x-api-key header." });
  }

  // Validate API key format
  if (!apiKey.startsWith("pam_") || apiKey.length < 20) {
    return res.status(401).json({ error: "Invalid API key format" });
  }

  try {
    // Validate API key before allowing request
    const keyPrefix = apiKey.substring(0, 12);
    const hashedKey = await hashApiKey(apiKey);
    const result = await storage.validateApiKey(keyPrefix, hashedKey);
    
    if (!result) {
      return res.status(401).json({ error: "Invalid or expired API key" });
    }
    
    // Attach sanitized user to request (strip password hash for security)
    const { password, ...sanitizedUser } = result.user;
    req.user = sanitizedUser;
    req.isApiKeyAuth = true;
    
    // Update last used timestamp (fire and forget)
    storage.updateApiKeyLastUsed(result.apiKey.id).catch(() => {});
    
    next();
  } catch (error) {
    console.error("API key validation error:", error);
    return res.status(500).json({ error: "Authentication error" });
  }
}

// Admin email for quota/bonus management (can be extended to multiple admins)
const QUOTA_ADMIN_EMAIL = "zach@patchops.io";

// Middleware to protect quota/bonus management routes - requires admin role or specific email
export function requireQuotaAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  
  const user = req.user;
  const isAdmin = user?.role === 'admin' || user?.email === QUOTA_ADMIN_EMAIL;
  
  if (!isAdmin) {
    return res.status(403).json({ error: "Unauthorized: Only administrators can modify quota and bonus settings" });
  }
  
  next();
}