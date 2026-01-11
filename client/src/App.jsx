import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import api from "./api/axios";
import Login from "./components/Login";
import Register from "./components/Register";
import Chat from "./components/Chat";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 1. Try to refresh the access token using the refresh cookie
        await api.post("/auth/refresh");
        // 2. Fetch the user details using the newly set access token cookie
        const res = await api.get("/auth/me");
        setUser(res.data);
      } catch (err) {
        console.log("No active session found");
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (loading) return <div style={styles.loading}>Loading App...</div>;

  return (
    <Router>
      <Routes>
        {/* If logged in, show Chat. If not, redirect to Login */}
        <Route
          path="/"
          element={
            user ? (
              <Chat user={user} setUser={setUser} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Auth Routes: Redirect to home if user is already logged in */}
        <Route
          path="/login"
          element={
            !user ? (
              <Login onLogin={(userData) => setUser(userData)} />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/register"
          element={!user ? <Register /> : <Navigate to="/" />}
        />

        {/* Catch-all: Redirect unknown paths to home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

const styles = {
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    fontSize: "1.5rem",
  },
};

export default App;
