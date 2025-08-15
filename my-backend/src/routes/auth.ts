// src/routes/auth.ts
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as LineStrategy } from "passport-line";
import { Strategy as TwitchStrategy, Profile as TwitchProfile } from "passport-twitch-new";
import { VerifyCallback } from "passport-oauth2";
import type { Request } from "express";
import { authenticateToken } from "../middleware/auth";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

import { generateCryptoAddress } from "../utils/nowpayments";

const router = express.Router();
const prisma = new PrismaClient();

type AuthReq = Request & { userId?: number };

/** ---- Env & constants ---- */
const {
  JWT_SECRET,
  API_BASE_URL,                 // e.g. https://api.cyebe.com
  FRONTEND_BASE_URL,            // e.g. https://cyebe.com
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET,
  LINE_CHANNEL_ID,
  LINE_CHANNEL_SECRET,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
} = process.env;

if (!JWT_SECRET) throw new Error("Missing JWT_SECRET");
if (!API_BASE_URL) throw new Error("Missing API_BASE_URL");
if (!FRONTEND_BASE_URL) throw new Error("Missing FRONTEND_BASE_URL");
if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID");
if (!GOOGLE_CLIENT_SECRET) throw new Error("Missing GOOGLE_CLIENT_SECRET");
if (!FACEBOOK_APP_ID) throw new Error("Missing FACEBOOK_APP_ID");
if (!FACEBOOK_APP_SECRET) throw new Error("Missing FACEBOOK_APP_SECRET");
if (!LINE_CHANNEL_ID) throw new Error("Missing LINE_CHANNEL_ID");
if (!LINE_CHANNEL_SECRET) throw new Error("Missing LINE_CHANNEL_SECRET");
if (!TWITCH_CLIENT_ID) throw new Error("Missing TWITCH_CLIENT_ID");
if (!TWITCH_CLIENT_SECRET) throw new Error("Missing TWITCH_CLIENT_SECRET");

const signJwt = (payload: object) =>
  jwt.sign(payload, JWT_SECRET!, { expiresIn: "7d" });

/** ---- Helpers ---- */
const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function ensureWallet(userId: number) {
  const address = await generateCryptoAddress("btc", userId);
  await prisma.btcWallet.create({ data: { userId, address } });
}

function emailFromIdToken(idToken?: string | null): string | null {
  if (!idToken) return null;
  try {
    const decoded: any = jwt.decode(idToken);
    return decoded?.email ?? null;
  } catch {
    return null;
  }
}

/** ----------------------------------------------------------------
 *  Twitch OAuth (stateless JWT, short session only for state)
 *  -------------------------------------------------------------- */
passport.use(
  new TwitchStrategy(
    {
      clientID: TWITCH_CLIENT_ID!,
      clientSecret: TWITCH_CLIENT_SECRET!,
      callbackURL: `${API_BASE_URL}/api/auth/twitch/callback`,
      scope: ["user:read:email"], // required to get email
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: TwitchProfile,
      done: VerifyCallback
    ) => {
      try {
        const emailRaw =
          profile.email ||
          profile.emails?.[0]?.value ||
          (profile as any)?._json?.email ||
          "";
        const email = emailRaw ? emailRaw.trim().toLowerCase() : null;

        if (!email) {
          return done(new Error("TWITCH_NO_EMAIL"));
        }

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: { email, password: "" }, // or null if schema allows
          });
          await ensureWallet(user.id);
        }

        return done(null, user as any);
      } catch (err) {
        console.error("TWITCH_VERIFY_ERROR:", err);
        return done(err as any);
      }
    }
  )
);

// Start Twitch flow
router.get(
  "/twitch",
  passport.authenticate("twitch", {
    session: false,
    scope: ["user:read:email"],
  })
);

// Twitch callback with friendly errors → your homepage modal picks these up
router.get("/twitch/callback", (req, res, next) => {
  passport.authenticate(
    "twitch",
    { session: false },
    (err: any, user: { id: number; email: string } | false) => {
      if (err || !user) {
        if (err && err.message === "TWITCH_NO_EMAIL") {
          return res.redirect(`${FRONTEND_BASE_URL}/?auth_error=twitch_no_email`);
        }
        return res.redirect(`${FRONTEND_BASE_URL}/?auth_error=twitch_auth_failed`);
      }

      const token = signJwt({ id: user.id });
      const emailParam = encodeURIComponent(user.email);
      const usernameParam = encodeURIComponent((user as any).username || "");
      return res.redirect(
		  `${FRONTEND_BASE_URL}/login?token=${token}&email=${emailParam}&username=${usernameParam}`
      );
    }
  )(req, res, next);
});

/** ----------------------------------------------------------------
 *  LINE Login (stateless) — supports no-email by deferring to modal
 *  -------------------------------------------------------------- */
passport.use(
  new (LineStrategy as any)(
    {
      channelID: LINE_CHANNEL_ID!,
      channelSecret: LINE_CHANNEL_SECRET!,
      callbackURL: `${API_BASE_URL}/api/auth/line/callback`,
      scope: "profile openid email",   // keep as a single space-delimited string
      passReqToCallback: true,
    } as any,
    async (
      _req: Request,
      _accessToken: string,
      _refreshToken: string,
      params: any,   // contains OIDC id_token
      profile: any,
      done: (err: any, user?: any) => void
    ) => {
      try {
        // try get email from profile and/or OIDC id_token
        const profileEmail: string | undefined =
          profile?.emails?.[0]?.value || profile?._json?.email;
        const idTokenEmail = emailFromIdToken(params?.id_token);
        const email = (profileEmail || idTokenEmail || "").trim().toLowerCase() || null;

        const lineId = profile?.id;

        if (!email) {
          // 1) Returning user? log in via linked providerId
          if (lineId) {
            const link = await prisma.oAuthAccount.findUnique({
              where: { providerId: `line:${lineId}` },
              include: { user: true },
            });
            if (link?.user) {
              return done(null, link.user);
            }
          }
          // 2) New user + no email → tell callback to start pending-email flow
          return done(
            null,
            {
              __pendingNoEmail: true,
              provider: "line",
              providerId: lineId,
              displayName: profile?.displayName,
              avatar: profile?.photos?.[0]?.value,
            } as any
          );
        }

        // With email → upsert user and link LINE provider
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({ data: { email, password: "" } });
          await ensureWallet(user.id);
        }

        if (lineId) {
          await prisma.oAuthAccount.upsert({
            where: { providerId: `line:${lineId}` },
            update: { userId: user.id },
            create: {
              provider: "line",
              providerId: `line:${lineId}`,
              userId: user.id,
            },
          });
        }

        return done(null, user);
      } catch (err) {
        console.error("LINE_VERIFY_ERROR:", err);
        return done(err as any);
      }
    }
  )
);

// Start LINE flow
router.get(
  "/line",
  passport.authenticate("line", {
    session: false,
    scope: "profile openid email",
  })
);

// LINE callback – issue JWT and bounce to frontend
router.get("/line/callback", (req, res, next) => {
  passport.authenticate(
    "line",
    { session: false },
    (err: any, userOrInfo: any) => {
      if (err) {
        return res.redirect(`${FRONTEND_BASE_URL}/?auth_error=line_auth_failed`);
      }

      // pending-email flow
      if (userOrInfo?.__pendingNoEmail) {
        const pendingToken = jwt.sign(
          {
            kind: "oauth_pending",
            provider: "line",
            providerId: userOrInfo.providerId,
          },
          JWT_SECRET!,
          { expiresIn: "10m" }
        );
        const redirect = `${FRONTEND_BASE_URL}/login?oauth_pending=line&pending_token=${encodeURIComponent(
          pendingToken
        )}`;
        return res.redirect(redirect);
      }

      // normal success
      const user = userOrInfo as { id: number; email: string };
      const token = signJwt({ id: user.id });
      const emailParam = encodeURIComponent(user.email);
      return res.redirect(
        `${FRONTEND_BASE_URL}/login?token=${token}&email=${emailParam}`
      );
    }
  )(req, res, next);
});

/** ---- Email/password register ---- */
router.post("/register", async (req, res) => {
  try {
    const rawEmail: string | undefined = req.body?.email;
    const password: string | undefined = req.body?.password;

    if (!rawEmail || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const email = normalizeEmail(rawEmail);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: "User exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hashed },
    });

    await ensureWallet(user.id);

    const token = signJwt({ id: user.id });
    return res.json({ token, email: user.email, username: user.username || "" });
  } catch (err) {
    console.error("REGISTER_ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/** ---- Email/password login ---- */
router.post("/login", async (req, res) => {
  try {
    const rawEmail: string | undefined = req.body?.email;
    const password: string | undefined = req.body?.password;

    if (!rawEmail || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const email = normalizeEmail(rawEmail);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });

    const token = signJwt({ id: user.id });
    return res.json({ token, email: user.email, username: user.username || "" });
  } catch (err) {
    console.error("LOGIN_ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/** ----------------------------------------------------------------
 *  Google OAuth (stateless)
 *  -------------------------------------------------------------- */
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID!,
      clientSecret: GOOGLE_CLIENT_SECRET!,
      callbackURL: `${API_BASE_URL}/api/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value
          ? normalizeEmail(profile.emails[0].value)
          : null;

        if (!email) return done(new Error("No email found on Google profile"));

        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              password: "", // or null if your schema allows
            },
          });
          await ensureWallet(user.id);
        }

        return done(null, user);
      } catch (err) {
        console.error("GOOGLE_VERIFY_ERROR:", err);
        return done(err as any);
      }
    }
  )
);

// Start Google flow
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["email", "profile"],
    prompt: "select_account",
    session: false,
  })
);

// Google callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${FRONTEND_BASE_URL}/login`,
    session: false,
  }),
  (req, res) => {
	  const user = req.user as { id: number; email: string; username?: string };
	  const token = signJwt({ id: user.id });
	  const emailParam = encodeURIComponent(user.email);
	  const usernameParam = encodeURIComponent(user.username || "");
	  res.redirect(`${FRONTEND_BASE_URL}/login?token=${token}&email=${emailParam}&username=${usernameParam}`);
	}
);

/** ----------------------------------------------------------------
 *  Facebook OAuth (stateless, supports no-email accounts)
 *  -------------------------------------------------------------- */
passport.use(
  new FacebookStrategy(
    {
      clientID: FACEBOOK_APP_ID!,
      clientSecret: FACEBOOK_APP_SECRET!,
      callbackURL: `${API_BASE_URL}/api/auth/facebook/callback`,
      profileFields: [
        "id",
        "emails",
        "name",
        "displayName",
        "picture.type(large)",
      ],
      enableProof: true,
    },
    async (accessToken, _refreshToken, profile, done) => {
      try {
        const facebookId = profile.id;

        // 1) Try to read the email from the profile object
        let emailRaw: string =
          profile.emails?.[0]?.value ||
          (profile as any)?._json?.email ||
          "";

        // 2) If still missing, fetch via Graph API with the login access token
        if (!emailRaw) {
          try {
            const resp = await axios.get<{ id?: string; email?: string }>(
              "https://graph.facebook.com/v23.0/me",
              {
                params: { fields: "id,email", access_token: accessToken },
                timeout: 4000,
              }
            );
            const data = resp.data;
            if (data?.email) emailRaw = data.email;
          } catch (e) {
            const err = e as { response?: { data?: unknown }; message?: string };
            console.warn(
              "FB Graph fallback failed to fetch email:",
              err?.response?.data ?? err?.message
            );
          }
        }

        // 3) If STILL no email: try to log in by providerId (returning users)
        if (!emailRaw) {
          const link = await prisma.oAuthAccount.findUnique({
            where: { providerId: `facebook:${facebookId}` },
            include: { user: true },
          });
          if (link?.user) {
            return done(null, link.user); // success without email
          }

          // New user + no email: pass minimal info to the callback
          return done(null, {
            __pendingNoEmail: true,
            provider: "facebook",
            providerId: facebookId,
            displayName: profile.displayName,
            avatar: profile.photos?.[0]?.value,
          } as any);
        }

        const email = emailRaw.trim().toLowerCase();

        // 4) With email → upsert user and link provider
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: { email, password: "" },
          });
          await ensureWallet(user.id);
        }

        // link provider (idempotent)
        await prisma.oAuthAccount.upsert({
          where: { providerId: `facebook:${facebookId}` },
          update: { userId: user.id },
          create: {
            provider: "facebook",
            providerId: `facebook:${facebookId}`,
            userId: user.id,
          },
        });

        return done(null, user);
      } catch (err) {
        console.error("FACEBOOK_VERIFY_ERROR:", err);
        return done(err as any);
      }
    }
  )
);

// Start Facebook flow — re-prompt if the user declined email earlier
router.get(
  "/facebook",
  passport.authenticate(
    "facebook",
    {
      scope: ["public_profile", "email"],
      authType: "rerequest",
      return_scopes: true,
      session: false,
    } as any
  )
);

// Facebook callback (supports pending no-email capture)
router.get("/facebook/callback", (req, res, next) => {
  passport.authenticate(
    "facebook",
    { session: false },
    (err: any, userOrInfo: any) => {
      if (err) {
        const msg = (err?.message || "").toLowerCase();
        if (msg.includes("app not active")) {
          return res.redirect(`${FRONTEND_BASE_URL}/?auth_error=facebook_app_inactive`);
        }
        return res.redirect(`${FRONTEND_BASE_URL}/?auth_error=facebook_auth_failed`);
      }

      // Pending flow: frontend must collect email
      if (userOrInfo?.__pendingNoEmail) {
        const pendingToken = jwt.sign(
          {
            kind: "oauth_pending",
            provider: "facebook",
            providerId: userOrInfo.providerId,
          },
          JWT_SECRET!,
          { expiresIn: "10m" }
        );
        const redirect = `${FRONTEND_BASE_URL}/login?oauth_pending=facebook&pending_token=${encodeURIComponent(
          pendingToken
        )}`;
        return res.redirect(redirect);
      }

      // Normal success
      const user = userOrInfo as { id: number; email: string; username?: string };
      const token = signJwt({ id: user.id });
      const emailParam = encodeURIComponent(user.email);
      const usernameParam = encodeURIComponent(user.username || "");
      return res.redirect(`${FRONTEND_BASE_URL}/login?token=${token}&email=${emailParam}&username=${usernameParam}`);
    }
  )(req, res, next);
});

/** Complete OAuth when provider didn't return an email */
router.post("/complete-oauth", async (req, res) => {
  try {
    const { pendingToken, email: rawEmail } = req.body || {};
    if (!pendingToken || !rawEmail) {
      return res.status(400).json({ message: "pendingToken and email are required." });
    }

    const payload = jwt.verify(pendingToken, JWT_SECRET!) as {
      kind: "oauth_pending";
      provider: "facebook" | "line" | "twitch" | "google";
      providerId: string;
      iat: number;
      exp: number;
    };

    if (payload.kind !== "oauth_pending") {
      return res.status(400).json({ message: "Invalid pending token." });
    }

    const email = normalizeEmail(rawEmail);

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email, password: "" } });
      await ensureWallet(user.id);
    }

    await prisma.oAuthAccount.upsert({
      where: { providerId: `${payload.provider}:${payload.providerId}` },
      update: { userId: user.id },
      create: {
        provider: payload.provider,
        providerId: `${payload.provider}:${payload.providerId}`,
        userId: user.id,
      },
    });

    const token = signJwt({ id: user.id });
    return res.json({ token, email: user.email, username: user.username || "" });
  } catch (err) {
    console.error("COMPLETE_OAUTH_ERROR:", err);
    return res.status(400).json({ message: "Invalid or expired pending token." });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req: AuthReq, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, username: true },
  });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

// POST /api/auth/set-username
router.post("/set-username", authenticateToken, async (req: AuthReq, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const raw = (req.body?.username || "") as string;
    const username = raw.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,16}$/.test(username)) {
      return res.status(400).json({
        message:
          "Username must be 3–16 characters and contain only letters, numbers or underscore.",
      });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { username },
      select: { email: true, username: true },
    });

    res.json(updated);
  } catch (e: any) {
    if (e?.code === "P2002" && e?.meta?.target?.includes("username")) {
      return res.status(409).json({ message: "Username is already taken." });
    }
    console.error("SET_USERNAME_ERROR:", e);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
