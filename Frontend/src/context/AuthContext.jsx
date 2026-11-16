
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  AUTH_STORAGE_KEY,
  applyAccessToken
} from "../api/client";

import {
  loginUser,
  logoutUser,
  registerUser
} from "../api/authApi";

const AuthContext = createContext(null);

function readStoredAuth() {
  try {
    return JSON.parse(
      localStorage.getItem(AUTH_STORAGE_KEY) || "null"
    );
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth);

  useEffect(() => {
    applyAccessToken(auth?.accessToken);
  }, [auth]);

  useEffect(() => {
    function handleAuthUpdated(event) {
      setAuth(event.detail);
    }

    function handleAuthExpired() {
      setAuth(null);
      applyAccessToken(null);
    }

    window.addEventListener(
      "hushtalk:auth-updated",
      handleAuthUpdated
    );

    window.addEventListener(
      "hushtalk:auth-expired",
      handleAuthExpired
    );

    return () => {
      window.removeEventListener(
        "hushtalk:auth-updated",
        handleAuthUpdated
      );

      window.removeEventListener(
        "hushtalk:auth-expired",
        handleAuthExpired
      );
    };
  }, []);

  function saveAuth(data) {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify(data)
    );

    applyAccessToken(data.accessToken);
    setAuth(data);
  }

  async function login(credentials) {
    const data = await loginUser(credentials);

    saveAuth(data);

    return data;
  }

  async function register(payload) {
    await registerUser(payload);

    const data = await loginUser({
      email: payload.email,
      password: payload.password
    });

    saveAuth(data);

    return data;
  }

  async function logout() {
    const refreshToken = auth?.refreshToken;

    try {
      await logoutUser(refreshToken);
    } catch {
      // Always clear the local session.
    } finally {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      applyAccessToken(null);
      setAuth(null);
    }
  }

  const value = useMemo(() => ({
    auth,
    isAuthenticated: Boolean(auth?.accessToken),
    login,
    register,
    logout
  }), [auth]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
