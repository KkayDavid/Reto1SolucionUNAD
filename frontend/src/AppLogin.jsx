import React, { useState, useEffect } from "react";
import Login from "./Login";
import App from "./App";

export default function AppLogin() {
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    const isLogged = localStorage.getItem("logged") === "true";
    setLogged(isLogged);
  }, []);

  const handleLogin = () => {
    localStorage.setItem("logged", "true");
    setLogged(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("logged");
    setLogged(false);
  };

  return logged ? <App onLogout={handleLogout} /> : <Login onLogin={handleLogin} />;
}
