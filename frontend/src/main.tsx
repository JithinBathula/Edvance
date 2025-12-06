import { createRoot } from "react-dom/client";
// Removed BrowserRouter and Routes/Route as internal navigation is state-driven
import App from "./App.tsx";
import React from "react";
import "./index.css";
// import { CustomProjectChat } from "./components/CustomProjectChat.tsx"; // Not needed here

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* App component handles all internal screen rendering and state */}
    <App />
  </React.StrictMode>
);