import { createRoot } from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import App from "./App.tsx";
import React from "react";
import { CustomProjectNew } from "./components/CustomProjectNew";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <Router>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/custom-project" element={<CustomProjectNew />} />
    </Routes>
  </Router>
);