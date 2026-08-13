// Sets the .dark class on <html> before first paint, so there's no flash of
// the wrong theme. Rendered as a raw <script> directly from the root layout
// (a Server Component) rather than via a client component + a theming
// library — a client component re-rendering the same script tag on the
// client is what React 19 warns about ("scripts are never executed when
// rendering on the client"), which doesn't apply to static Server Component
// output.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;
