import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

const git = (cmd, fallback) => {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
};

const commitHash = git("git rev-parse --short HEAD", "dev");
const commitCount = git("git rev-list --count HEAD", "0");

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(`v1.0.${commitCount}`), // e.g. v1.0.142
    __APP_COMMIT__: JSON.stringify(commitHash),             // e.g. a3f9c1e
  },
});