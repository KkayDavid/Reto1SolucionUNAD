import React from "react";
import "./index.css";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import AppLogin from "./AppLogin";
import App from "./App";

const root = createRoot(document.getElementById("root"));

root.render(
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<AppLogin />} />
            <Route path="/app" element={<App />} />
        </Routes>
    </BrowserRouter>
);
