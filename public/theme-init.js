// Sets the theme before first paint so there's no flash of the wrong colors.
//
// This used to be an inline <script> in index.html, but vercel.json's
// Content-Security-Policy is `script-src 'self'` (no 'unsafe-inline'), so
// production browsers silently refused to run it. Served as a same-origin
// file it is allowed.
//
// The id list must match THEMES in src/theme.js. A saved id that's no longer
// in it (e.g. the removed "light" theme) falls back to the default.
(function () {
  var fallback = "forest";
  try {
    var ids = ["forest", "deepsea", "plum", "wine", "amoled"];
    var stored = localStorage.getItem("kwenta_theme");
    document.documentElement.setAttribute(
      "data-theme",
      ids.indexOf(stored) > -1 ? stored : fallback,
    );
  } catch (e) {
    document.documentElement.setAttribute("data-theme", fallback);
  }
})();
