import next from "eslint-config-next";

// eslint-config-next 16 ships a native flat config (an array). Use it directly;
// the old FlatCompat bridge crashes on ESLint 9 (circular JSON).
const eslintConfig = [
  ...next,
  {
    ignores: ["node_modules/**", ".next/**", "var/**", "src/generated/**"],
  },
  {
    rules: {
      // Data-fetch effects intentionally set a loading flag, and a couple of
      // effects reset local form state on tab change. This React 19 rule is
      // overly aggressive for those safe, idiomatic patterns — keep as a hint.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
