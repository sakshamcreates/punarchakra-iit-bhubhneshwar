import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentUser, getToken, login as loginUser, logout as clearAuth, refreshUser, register as registerUser } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCurrentUser());
  const [token, setToken] = useState(() => getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const existingToken = getToken();
      if (!existingToken) {
        setLoading(false);
        return;
      }

      try {
        const refreshedUser = await refreshUser();
        setUser(refreshedUser);
        setToken(getToken());
      } catch {
        clearAuth();
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = async (credentials) => {
    const result = await loginUser(credentials);
    setUser(result.user);
    setToken(getToken());
    return result;
  };

  const register = async (userData) => {
    const result = await registerUser(userData);
    setUser(result.user);
    setToken(getToken());
    return result;
  };

  const signOut = () => {
    clearAuth();
    setUser(null);
    setToken(null);
  };

  const refresh = async () => {
    try {
      const refreshedUser = await refreshUser();
      setUser(refreshedUser);
      setToken(getToken());
      return refreshedUser;
    } catch (error) {
      signOut();
      throw error;
    }
  };

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: Boolean(token && user),
    loading,
    login,
    register,
    logout: signOut,
    refreshUser: refresh
  }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
