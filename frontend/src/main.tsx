import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { CustomProjectNew } from "./components/CustomProjectNew";
import "./index.css";

const path = window.location.pathname;
const normalizedPath =
  path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
const isCustomProjectRoute = normalizedPath === "/custom-project";

createRoot(document.getElementById("root")!).render(
  isCustomProjectRoute ? <CustomProjectNew /> : <App />
);
  
