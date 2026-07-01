import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  acceptLegal as apiAcceptLegal,
  login as apiLogin,
  oauthLoginFacebook,
  oauthLoginGoogle,
  refreshSession,
  register as apiRegister,
  revokeSession,
  unregisterPushToken,
} from "./api";
import { trackEvent, identifyPostHogUser, resetPostHogUser } from "./analytics";

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  phoneVerified?: boolean;
  vehicleMake?: string | null;
  vehicleType?: string | null;
  vehicleColor?: string | null;
  vehiclePlate?: string | null;
  status?: "active" | "suspended";
  role?: string;
  emailVerified?: boolean;
  termsVersion?: string | null;
  termsAcceptedAt?: string | null;
  privacyVersion?: string | null;
  privacyAcceptedAt?: string | null;
  authProvider?: "password" | "google" | "facebook";
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  legalPromptRequired: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (
    email: string,
    password: string,
    legal: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      termsVersion: string;
      privacyVersion: string;
    }
  ) => Promise<{ previewUrl: string | null; user: AuthUser }>;
  loginWithOAuth: (provider: "google" | "facebook", token: string) => Promise<AuthUser>;
  acceptLegal: (payload: { termsVersion: string; privacyVersion: string }) => Promise<AuthUser>;
  setAuthUser: (user: AuthUser) => Promise<void>;
  hydrateSession: (session: { token: string; user: AuthUser; refreshToken?: string | null } | null) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";
const REFRESH_TOKEN_KEY = "authRefreshToken";
// Written by PushRegistration (App.tsx); read here so logout can unbind the device.
export const EXPO_PUSH_TOKEN_KEY = "expoPushToken";

// The access + refresh tokens are credentials, so keep them in the OS keystore
// (iOS Keychain / Android EncryptedSharedPreferences via SecureStore) instead of
// AsyncStorage's plaintext store. SecureStore isn't available on web, so fall
// back to AsyncStorage there. The non-sensitive user profile stays in AsyncStorage.
const secureCapable = Platform.OS !== "web";
const tokenStore = {
  getItem: (key: string) =>
    secureCapable ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key),
  setItem: (key: string, value: string) =>
    secureCapable ? SecureStore.setItemAsync(key, value) : AsyncStorage.setItem(key, value),
  removeItem: (key: string) =>
    secureCapable ? SecureStore.deleteItemAsync(key) : AsyncStorage.removeItem(key),
};

// One-time migration for users upgrading from a build that stored tokens in
// AsyncStorage: move any plaintext token/refresh values into SecureStore and
// delete the plaintext copies so credentials aren't left behind in cleartext.
async function migrateTokensToSecureStore() {
  if (!secureCapable) return;
  try {
    for (const key of [TOKEN_KEY, REFRESH_TOKEN_KEY]) {
      const legacy = await AsyncStorage.getItem(key);
      if (legacy == null) continue;
      const existing = await SecureStore.getItemAsync(key);
      if (existing == null) await SecureStore.setItemAsync(key, legacy);
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // Best-effort; a failed migration just means the user re-authenticates.
  }
}

type JwtPayload = {
  exp?: number;
  iat?: number;
};

const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const decoded =
      typeof globalThis.atob === "function"
        ? globalThis.atob(normalized)
        : typeof (globalThis as any).Buffer !== "undefined"
          ? (globalThis as any).Buffer.from(normalized, "base64").toString("utf8")
          : null;
    if (!decoded) return null;
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
};

const needsLegalAcceptance = (candidate: AuthUser | null) =>
  !!candidate && (!candidate.termsVersion || !candidate.privacyVersion);

const withAuthProvider = (
  candidate: AuthUser | null,
  authProvider?: AuthUser["authProvider"]
): AuthUser | null => (candidate ? { ...candidate, authProvider: authProvider ?? candidate.authProvider } : candidate);

const inferStoredAuthProvider = async (candidate: AuthUser | null): Promise<AuthUser | null> => {
  if (!candidate || candidate.authProvider) return candidate;
  try {
    const googleUser = GoogleSignin.getCurrentUser();
    const googleEmail = googleUser?.user?.email?.toLowerCase();
    if (googleEmail && candidate.email.toLowerCase() === googleEmail) {
      return { ...candidate, authProvider: "google" };
    }
  } catch {
    // Ignore provider inference failures and fall back to existing behavior.
  }
  return candidate;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [legalPromptRequired, setLegalPromptRequired] = useState(false);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // logout/refresh callbacks are intentionally stable (empty deps); these refs
  // give them the current values instead of the ones captured at mount.
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;
  const userRef = useRef<AuthUser | null>(null);
  userRef.current = user;

  useEffect(() => {
    const restore = async () => {
      await migrateTokensToSecureStore();
      const storedToken = await tokenStore.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);
      const storedRefreshToken = await tokenStore.getItem(REFRESH_TOKEN_KEY);
      const parsedStoredUser = await inferStoredAuthProvider(
        storedUser ? (JSON.parse(storedUser) as AuthUser) : null
      );
      if (storedToken) {
        const payload = decodeJwtPayload(storedToken);
        const expiresAt = payload?.exp ? payload.exp * 1000 : null;
        if (expiresAt && expiresAt <= Date.now()) {
          if (storedRefreshToken) {
            try {
              const refreshed = await refreshSession(storedRefreshToken);
              const nextUser = withAuthProvider(refreshed.user, parsedStoredUser?.authProvider);
              setToken(refreshed.token);
              setUser(nextUser);
              setLegalPromptRequired(false);
              const nextRefreshToken = refreshed.refreshToken ?? storedRefreshToken;
              setRefreshToken(nextRefreshToken);
              await tokenStore.setItem(TOKEN_KEY, refreshed.token);
              await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
              await tokenStore.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
              setLoading(false);
              return;
            } catch {
              await tokenStore.removeItem(TOKEN_KEY);
              await AsyncStorage.removeItem(USER_KEY);
              await tokenStore.removeItem(REFRESH_TOKEN_KEY);
              setToken(null);
              setUser(null);
              setLegalPromptRequired(false);
              setRefreshToken(null);
              setLoading(false);
              return;
            }
          }
          await tokenStore.removeItem(TOKEN_KEY);
          await AsyncStorage.removeItem(USER_KEY);
          await tokenStore.removeItem(REFRESH_TOKEN_KEY);
          setToken(null);
          setUser(null);
          setLegalPromptRequired(false);
          setRefreshToken(null);
          setLoading(false);
          return;
        }
      }
      setToken(storedToken);
      setUser(parsedStoredUser);
      setLegalPromptRequired(false);
      setRefreshToken(storedRefreshToken);
      setLoading(false);
    };
    void restore();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    const nextUser = withAuthProvider(response.user, "password");
    setToken(response.token);
    setUser(nextUser);
    setLegalPromptRequired(needsLegalAcceptance(nextUser));
    const nextRefreshToken = response.refreshToken ?? null;
    setRefreshToken(nextRefreshToken);
    await tokenStore.setItem(TOKEN_KEY, response.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    if (nextRefreshToken) {
      await tokenStore.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
    }
    void trackEvent("mobile_login_succeeded", {
      method: "password",
      userId: nextUser?.id ?? null,
    });
    if (nextUser) void identifyPostHogUser(nextUser.id, { email: nextUser.email, name: nextUser.name });
    return nextUser as AuthUser;
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      legal: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        termsVersion: string;
        privacyVersion: string;
      }
    ) => {
      const response = await apiRegister(email, password, legal);
      const nextUser = withAuthProvider(response.user, "password");
      setToken(response.token);
      setUser(nextUser);
      setLegalPromptRequired(needsLegalAcceptance(nextUser));
      const nextRefreshToken = response.refreshToken ?? null;
      setRefreshToken(nextRefreshToken);
      await tokenStore.setItem(TOKEN_KEY, response.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      if (nextRefreshToken) {
        await tokenStore.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
      }
      void trackEvent("mobile_signup_completed", {
        method: "password",
        userId: nextUser?.id ?? null,
        phoneProvided: Boolean(legal.phone),
      });
      if (nextUser) void identifyPostHogUser(nextUser.id, { email: nextUser.email, name: nextUser.name });
      return { previewUrl: response.previewUrl ?? null, user: nextUser as AuthUser };
    },
    []
  );

  const logout = useCallback(async () => {
    const currentToken = tokenRef.current;
    setToken(null);
    setUser(null);
    setLegalPromptRequired(false);
    setRefreshToken(null);
    await tokenStore.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    await tokenStore.removeItem(REFRESH_TOKEN_KEY);
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (currentToken) {
      // Unbind this device from the account's push notifications before the
      // session token is revoked (the call needs a valid token).
      try {
        const expoToken = await AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY);
        if (expoToken) {
          await unregisterPushToken(currentToken, expoToken);
        }
      } catch {
        // Ignore push unregister errors; logout proceeds regardless.
      }
      try {
        await revokeSession(currentToken);
      } catch {
        // Ignore server logout errors.
      }
    }
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch {
      // Ignore Google sign-out failures; local session is already cleared.
    }
    void resetPostHogUser();
  }, []);

  const loginWithOAuth = useCallback(async (provider: "google" | "facebook", tokenValue: string) => {
    const response =
      provider === "google"
        ? await oauthLoginGoogle(tokenValue)
        : await oauthLoginFacebook(tokenValue);
    const nextUser = withAuthProvider(response.user, provider);
    setToken(response.token);
    setUser(nextUser);
    setLegalPromptRequired(needsLegalAcceptance(nextUser));
    const nextRefreshToken = response.refreshToken ?? null;
    setRefreshToken(nextRefreshToken);
    await tokenStore.setItem(TOKEN_KEY, response.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    if (nextRefreshToken) {
      await tokenStore.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
    }
    void trackEvent("mobile_login_succeeded", {
      method: provider,
      userId: nextUser?.id ?? null,
    });
    if (nextUser) void identifyPostHogUser(nextUser.id, { email: nextUser.email, name: nextUser.name });
    return nextUser as AuthUser;
  }, []);

  const acceptLegal = useCallback(
    async (payload: { termsVersion: string; privacyVersion: string }) => {
      if (!token) {
        throw new Error("No active session");
      }
      const response = await apiAcceptLegal(token, payload);
      const nextUser = withAuthProvider(response.user, user?.authProvider);
      setUser(nextUser);
      setLegalPromptRequired(false);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      return nextUser as AuthUser;
    },
    [token, user?.authProvider]
  );

  const setAuthUser = useCallback(async (nextUser: AuthUser) => {
    setUser(nextUser);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }, []);

  const hydrateSession = useCallback(
    async (session: { token: string; user: AuthUser; refreshToken?: string | null } | null) => {
      if (!session) {
        setToken(null);
        setUser(null);
        setLegalPromptRequired(false);
        setRefreshToken(null);
        await tokenStore.removeItem(TOKEN_KEY);
        await AsyncStorage.removeItem(USER_KEY);
        await tokenStore.removeItem(REFRESH_TOKEN_KEY);
        return;
      }

      const nextUser = withAuthProvider(session.user, session.user.authProvider);
      setToken(session.token);
      setUser(nextUser);
      setLegalPromptRequired(needsLegalAcceptance(nextUser));
      const nextRefreshToken = session.refreshToken ?? null;
      setRefreshToken(nextRefreshToken);
      await tokenStore.setItem(TOKEN_KEY, session.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      if (nextRefreshToken) {
        await tokenStore.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
      } else {
        await tokenStore.removeItem(REFRESH_TOKEN_KEY);
      }
    },
    []
  );

  useEffect(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (!token) return;
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return;
    const expiresAt = payload.exp * 1000;
    const delayMs = expiresAt - Date.now();
    const refreshNow = async () => {
      if (!refreshToken) return;
      try {
        const refreshed = await refreshSession(refreshToken);
        const nextUser = withAuthProvider(refreshed.user, userRef.current?.authProvider);
        setToken(refreshed.token);
        setUser(nextUser);
        setLegalPromptRequired(false);
        const nextRefreshToken = refreshed.refreshToken ?? refreshToken;
        setRefreshToken(nextRefreshToken);
        await tokenStore.setItem(TOKEN_KEY, refreshed.token);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
        await tokenStore.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
      } catch {
        void logout();
      }
    };
    if (delayMs <= 0) {
      // Token already expired (e.g. the app was suspended past expiry).
      // Try to refresh before giving up on the session.
      if (refreshToken) {
        void refreshNow();
      } else {
        void logout();
      }
      return;
    }
    if (refreshToken) {
      // With a refresh token there is no hard-logout deadline: timers don't run
      // while the app is suspended, and racing a logout timer against an
      // in-flight refresh on resume can wipe a session that was just renewed.
      // If the refresh fails, refreshNow logs out.
      const refreshDelayMs = Math.max(delayMs - 60_000, 0);
      refreshTimerRef.current = setTimeout(() => {
        void refreshNow();
      }, refreshDelayMs);
      return;
    }
    logoutTimerRef.current = setTimeout(() => {
      void logout();
    }, delayMs);
    return () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [token, refreshToken, logout]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      legalPromptRequired,
      login,
      register,
      loginWithOAuth,
      acceptLegal,
      setAuthUser,
      hydrateSession,
      logout,
    }),
    [token, user, loading, legalPromptRequired, login, register, loginWithOAuth, acceptLegal, setAuthUser, hydrateSession, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
