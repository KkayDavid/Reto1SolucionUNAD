import React, { useState } from "react";
import Login from "./Login";
import App from "./App";
import { isLogged } from "./auth";

export default function Main() {
  const [ok, setOk] = useState(isLogged());

  return (
    <>
      {!ok ? (
        <Login onLoginSuccess={() => setOk(true)} />
      ) : (
        <App />
      )}
    </>
  );
}
