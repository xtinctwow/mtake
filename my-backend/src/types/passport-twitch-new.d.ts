// src/types/passport-twitch-new.d.ts
declare module "passport-twitch-new" {
  import { Strategy as OAuth2Strategy, VerifyCallback } from "passport-oauth2";
  import { Profile as PassportProfile } from "passport";

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[]; // e.g. ["user:read:email"]
  }

  export interface TwitchProfile extends PassportProfile {
    id: string;
    displayName?: string;
    emails?: Array<{ value: string }>;
    email?: string; // some libs map it here
    _json?: any;
  }

  export class Strategy extends OAuth2Strategy {
    constructor(
      options: StrategyOptions,
      verify: (
        accessToken: string,
        refreshToken: string,
        profile: TwitchProfile,
        done: VerifyCallback
      ) => void
    );
    name: string;
  }

  export { TwitchProfile as Profile };
}
