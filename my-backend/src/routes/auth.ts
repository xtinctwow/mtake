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
import dotenv from "dotenv";
dotenv.config();

import { generateCryptoAddress } from "../utils/nowpayments";

const router = express.Router();
const prisma = new PrismaClient();

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
      return res.redirect(
        `${FRONTEND_BASE_URL}/login?token=${token}&email=${emailParam}`
      );
    }
  )(req, res, next);
});

/** ----------------------------------------------------------------
 *  LINE Login (stateless)
 *  NOTE: Casting to `any` to bypass inaccurate type overloads in `passport-line`
 *  -------------------------------------------------------------- */
passport.use(
  new (LineStrategy as any)(
    {
      channelID: LINE_CHANNEL_ID!,
      channelSecret: LINE_CHANNEL_SECRET!,
      callbackURL: `${API_BASE_URL}/api/auth/line/callback`,
      scope: "profile openid email",   // must be a single string
      passReqToCallback: true,         // verify will receive (req, ...)
    } as any,
    async (
      req: Request,
      _accessToken: string,
      _refreshToken: string,
      params: any,                     // contains id_token
      profile: any,
      done: (err: any, user?: any) => void
    ) => {
      try {
        const profileEmail: string | undefined =
          profile?.emails?.[0]?.value || profile?._json?.email;

        const idTokenEmail = emailFromIdToken(params?.id_token);
        const email =
          (profileEmail || idTokenEmail || "").trim().toLowerCase() || null;

        if (!email) {
          return done(new Error("LINE_NO_EMAIL"));
        }

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: { email, password: "" }, // or null if your schema allows
          });
          await ensureWallet(user.id);
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
    scope: "profile openid email", // keep as string if you set it here
  })
);

// LINE callback – issue JWT and bounce to frontend
router.get("/line/callback", (req, res, next) => {
  passport.authenticate(
    "line",
    { session: false },
    (err: any, user: { id: number; email: string } | false) => {
      if (err || !user) {
        // Specific warning when the user didn’t grant/provide an email
        if (err && (err.message === "LINE_NO_EMAIL")) {
          return res.redirect(`${FRONTEND_BASE_URL}/?auth_error=line_no_email`);
        }
        // Generic LINE failure warning
        return res.redirect(`${FRONTEND_BASE_URL}/?auth_error=line_auth_failed`);
      }

      // Success → issue JWT and send to your normal login handoff route
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
    return res.json({ token, email: user.email });
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
    return res.json({ token, email: user.email });
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
    const user = req.user as { id: number; email: string };
    const token = signJwt({ id: user.id });
    const emailParam = encodeURIComponent(user.email);
    res.redirect(`${FRONTEND_BASE_URL}/login?token=${token}&email=${emailParam}`);
  }
);

/** ----------------------------------------------------------------
 *  Facebook OAuth (stateless)
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
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email =
          profile.emails?.[0]?.value
            ? normalizeEmail(profile.emails[0].value)
            : null;

        if (!email) {
          return done(new Error("No email found on Facebook profile"));
        }

        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              password: "", // or null if schema allows
            },
          });
          await ensureWallet(user.id);
        }

        return done(null, user);
      } catch (err) {
        console.error("FACEBOOK_VERIFY_ERROR:", err);
        return done(err as any);
      }
    }
  )
);

// Start Facebook flow
router.get(
  "/facebook",
  passport.authenticate("facebook", {
    scope: ["email"],
    session: false,
  })
);

// Facebook callback
router.get(
  "/facebook/callback",
  passport.authenticate("facebook", {
    failureRedirect: `${FRONTEND_BASE_URL}/login?error=facebook_auth_failed`,
    session: false,
  }),
  (req, res) => {
    const user = req.user as { id: number; email: string };
    const token = signJwt({ id: user.id });
    const emailParam = encodeURIComponent(user.email);
    res.redirect(`${FRONTEND_BASE_URL}/login?token=${token}&email=${emailParam}`);
  }
);

export default router;
