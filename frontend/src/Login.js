import React, { useState } from "react";
import "./login.css";

export default function Login({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  function handleLogin(e) {
    e.preventDefault();
    if (user === "admin" && pass === "123") {
      onLogin(true);
    } else {
      alert("Credenciales incorrectas");
    }
  }

  return (
    <div className="login-wrapper">

      {/* 🔥 VIDEO DE FONDO */}
      <video className="bg-video" autoPlay muted loop>
        <source src="/video.mp4" type="video/mp4" />
      </video>

      <div className="login-box">
        <h2 className="login-title">🔐 Iniciar sesión</h2>

        <form onSubmit={handleLogin}>
          <input
            className="login-input"
            placeholder="Usuario"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />

          <input
            className="login-input"
            type="password"
            placeholder="Contraseña"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />

          <button className="login-btn">Entrar</button>
        </form>
      </div>
    </div>
  );
}
