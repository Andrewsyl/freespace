"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { login, refreshSession, register, revokeSession, oauthLoginGoogle, type AuthResponse } from "../lib/api";
import { trackEvent } from "../lib/telemetry";
import { useAppStatus } from "./AppStatusProvider";
import { usePostHog } from "posthog-js/react";

type User = AuthResponse["user"];

type AuthContextValue = {
  user: User | null;
  token: string | null;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string, phone?: string, firstName?: string, lastName?: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<User>;
  signOut: () => void;
  error: string | null;
  loading: boolean;
  emailVerified: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type JwtPayload = {
  exp?: number;
  iat?: number;
};

const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
};

function persistSession(session: { token: string; user: User }) {
  localStorage.setItem("auth_token", session.token);
  localStorage.setItem("auth_user", JSON.stringify(session.user));
}

function readSession() {
  const token = localStorage.getItem("auth_token");
  const userRaw = localStorage.getItem("auth_user");
  if (!token || !userRaw) return null;
  const payload = decodeJwtPayload(token);
  const expiresAt = payload?.exp ? payload.exp * 1000 : null;
  if (expiresAt && expiresAt <= Date.now()) {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    return null;
  }
  try {
    const user = JSON.parse(userRaw) as User;
    return { token, user };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const ph = usePostHog();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const { setLoading, setError: setGlobalError } = useAppStatus();
  const [error, setError] = useState<string | null>(null);
  const [loading, setAuthLoading] = useState<boolean>(true);
  const emailVerified = !!user?.emailVerified;
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const restore = async () => {
      const session = readSession();
      const storedRefresh = localStorage.getItem("auth_refresh");
      if (session) {
        const payload = decodeJwtPayload(session.token);
        const expiresAt = payload?.exp ? payload.exp * 1000 : null;
        if (expiresAt && expiresAt <= Date.now() && storedRefresh) {
          try {
            const refreshed = await refreshSession(storedRefresh);
            setUser(refreshed.user);
            setToken(refreshed.token);
            const nextRefreshToken = refreshed.refreshToken ?? storedRefresh;
            setRefreshToken(nextRefreshToken);
            localStorage.setItem("auth_token", refreshed.token);
            localStorage.setItem("auth_user", JSON.stringify(refreshed.user));
            localStorage.setItem("auth_refresh", nextRefreshToken);
            setAuthLoading(false);
            setLoading(false);
            return;
          } catch {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            localStorage.removeItem("auth_refresh");
          }
        }
        setUser(session.user);
        setToken(session.token);
        setRefreshToken(storedRefresh);
      }
      setAuthLoading(false);
      setLoading(false);
    };
    void restore();
  }, [setLoading]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setAuthLoading(true);
    setError(null);
    setGlobalError(null);
    try {
      const res = await login(email, password);
      setUser(res.user);
      setToken(res.token);
      const nextRefreshToken = res.refreshToken ?? null;
      setRefreshToken(nextRefreshToken);
      persistSession(res);
      if (nextRefreshToken) {
        localStorage.setItem("auth_refresh", nextRefreshToken);
      }
      void trackEvent("web_login_succeeded", {
        method: "password",
        userId: res.user.id,
      });
      ph?.identify(res.user.id, { email: res.user.email, name: res.user.name });
      return res.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      setGlobalError(msg);
      throw err;
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  }, [setLoading, setGlobalError]);

  const signUp = useCallback(async (email: string, password: string, phone?: string, firstName?: string, lastName?: string) => {
    setLoading(true);
    setAuthLoading(true);
    setError(null);
    setGlobalError(null);
    try {
      const res = await register(email, password, phone, firstName, lastName);
      setUser(res.user);
      setToken(res.token);
      const nextRefreshToken = res.refreshToken ?? null;
      setRefreshToken(nextRefreshToken);
      persistSession(res);
      if (nextRefreshToken) {
        localStorage.setItem("auth_refresh", nextRefreshToken);
      }
      void trackEvent("web_signup_completed", {
        method: "password",
        userId: res.user.id,
        phoneProvided: Boolean(phone),
      });
      ph?.identify(res.user.id, { email: res.user.email, name: res.user.name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signup failed";
      setError(msg);
      setGlobalError(msg);
      throw err;
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  }, [setLoading, setGlobalError]);

  const signInWithGoogle = useCallback(async (idToken: string) => {
    setLoading(true);
    setAuthLoading(true);
    setError(null);
    setGlobalError(null);
    try {
      const res = await oauthLoginGoogle(idToken);
      setUser(res.user);
      setToken(res.token);
      const nextRefreshToken = res.refreshToken ?? null;
      setRefreshToken(nextRefreshToken);
      persistSession(res);
      if (nextRefreshToken) {
        localStorage.setItem("auth_refresh", nextRefreshToken);
      }
      void trackEvent("web_login_succeeded", {
        method: "google",
        userId: res.user.id,
      });
      ph?.identify(res.user.id, { email: res.user.email, name: res.user.name });
      return res.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      setError(msg);
      setGlobalError(msg);
      throw err;
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  }, [setLoading, setGlobalError]);

  const signOut = useCallback(() => {
    const currentToken = token;
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_refresh");
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (currentToken) {
      void revokeSession(currentToken);
    }
    ph?.reset();
    setAuthLoading(false);
  }, [token, ph]);

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
        setUser(refreshed.user);
        setToken(refreshed.token);
        const nextRefreshToken = refreshed.refreshToken ?? refreshToken;
        setRefreshToken(nextRefreshToken);
        localStorage.setItem("auth_token", refreshed.token);
        localStorage.setItem("auth_user", JSON.stringify(refreshed.user));
        localStorage.setItem("auth_refresh", nextRefreshToken);
      } catch {
        signOut();
      }
    };
    if (delayMs <= 0) {
      // Access token already expired (e.g. the tab was suspended past expiry).
      // Try to refresh before giving up on the session.
      if (refreshToken) {
        void refreshNow();
      } else {
        signOut();
      }
      return;
    }
    if (refreshToken) {
      // With a refresh token there is no hard-logout deadline: a timer doesn't
      // fire while the tab is suspended, and racing a logout against an in-flight
      // refresh on resume can wipe a session that was just renewed. If the
      // refresh fails, refreshNow signs out.
      const refreshDelayMs = Math.max(delayMs - 60_000, 0);
      refreshTimerRef.current = setTimeout(() => {
        void refreshNow();
      }, refreshDelayMs);
      return;
    }
    logoutTimerRef.current = setTimeout(() => {
      signOut();
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
  }, [token, refreshToken, signOut]);

  const value = useMemo(
    () => ({
      user,
      token,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      error,
      loading: loading,
      emailVerified,
      setUser,
      setToken,
    }),
    [user, token, signIn, signUp, signInWithGoogle, signOut, error, loading, emailVerified]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
