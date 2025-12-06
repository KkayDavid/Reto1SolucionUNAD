// src/auth.js

let logged = false;

// ===== LOGIN =====
export function login(user, pass) {
  if (user === "admin" && pass === "1234") {
    logged = true;
    return true;
  }
  return false;
}

// ===== LOGOUT =====
export function logout() {
  logged = false;
}

// ===== ESTADO LOGIN =====
export function isLogged() {
  return logged;
}
