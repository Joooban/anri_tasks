// Sets the .dark class on <html> before first paint, so there's no flash of
// the wrong theme. Rendered via next/script with strategy="beforeInteractive"
// from the root layout — a raw <script> tag triggers Next 16's "scripts are
// never executed when rendering on the client" warning even from a Server
// Component, and beforeInteractive is the documented way to guarantee this
// runs before hydration (see node_modules/next/dist/docs/.../scripts.md).
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;
