import { useCallback, useEffect, useMemo, useState } from "react";
import AuthContext from "./AuthContext";
import { apiRequest } from "../services/api";

const TOKEN_KEY = "authToken";

function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(token));

  const saveSession = useCallback((nextToken, nextUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.removeItem("currentUser");
    localStorage.removeItem("token");
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("currentUser");
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    const savedToken = localStorage.getItem(TOKEN_KEY);

    localStorage.removeItem("token");

    if (!savedToken) {
      return () => {
        active = false;
      };
    }

    apiRequest("/auth/me", { token: savedToken, requiresAuth: true })
      .then((response) => {
        if (active) {
          saveSession(savedToken, response.data.user);
        }
      })
      .catch(() => {
        if (active) {
          clearSession();
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [clearSession, saveSession]);

  useEffect(() => {
    window.addEventListener("auth:unauthorized", clearSession);
    return () => window.removeEventListener("auth:unauthorized", clearSession);
  }, [clearSession]);

  const register = useCallback(
    async (credentials) => {
      const response = await apiRequest("/auth/register", {
        method: "POST",
        body: credentials,
      });
      saveSession(response.data.token, response.data.user);
      return response.data.user;
    },
    [saveSession],
  );

  const login = useCallback(
    async (credentials) => {
      const response = await apiRequest("/auth/login", {
        method: "POST",
        body: credentials,
      });
      saveSession(response.data.token, response.data.user);
      return response.data.user;
    },
    [saveSession],
  );

  const updateUser = useCallback((updatedUser) => {
    setUser((currentUser) => ({ ...currentUser, ...updatedUser }));
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login,
      register,
      updateUser,
      logout: clearSession,
    }),
    [clearSession, isLoading, login, register, token, updateUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
