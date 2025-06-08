/// <reference types="vinxi/types/client" />
import { StartClient } from "@tanstack/react-start/client";
import { hydrateRoot } from "react-dom/client";
import { createRouter } from "./router";
import { getStore } from "./store";

const router = createRouter();

// Initialize the store before starting the app
getStore()
  .then(() => {
    hydrateRoot(
      document.getElementById("root")!,
      <StartClient router={router} />
    );
  })
  .catch(console.error);
