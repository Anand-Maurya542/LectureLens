import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("lecturelens_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("lecturelens_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifySession() {
      if (token) {
        try {
          const profile = await api.getMe();
          setUser(profile);
          localStorage.setItem("lecturelens_user", JSON.stringify(profile));
        } catch {
          logout();
        }
      }
      setLoading(false);
    }

    verifySession();

    function handleForceLogout() {
      logout();
    }
    window.addEventListener("auth:logout", handleForceLogout);
    return () => window.removeEventListener("auth:logout", handleForceLogout);
  }, [token]);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem("lecturelens_token", res.access_token);
    localStorage.setItem("lecturelens_user", JSON.stringify(res.user));
    return res.user;
  };

  const register = async (data) => {
    const res = await api.register(data);
    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem("lecturelens_token", res.access_token);
    localStorage.setItem("lecturelens_user", JSON.stringify(res.user));
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("lecturelens_token");
    localStorage.removeItem("lecturelens_user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isTeacher: user?.role === "teacher" || user?.role === "admin",
        isStudent: user?.role === "student",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

