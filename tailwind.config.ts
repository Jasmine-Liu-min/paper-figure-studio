import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        paper: "#f7f5ef",
        moss: "#4b6f53",
        coral: "#c96850",
        cobalt: "#315c9f"
      },
      boxShadow: {
        soft: "0 18px 55px rgba(23, 32, 42, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
