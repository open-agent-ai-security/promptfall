import React from "react";
import { createRoot } from "react-dom/client";
import Game from "../app/Game";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Promptfall could not find its root element.");
}

createRoot(root).render(
  <React.StrictMode>
    <Game />
  </React.StrictMode>,
);
