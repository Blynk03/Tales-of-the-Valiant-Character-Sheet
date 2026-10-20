// Builds wwwroot/css/tailwind.css from the classes used in the app (replaces the Tailwind Play CDN, TVCS-105).
// From the TotvSheet folder:
//   npx tailwindcss@3.4.17 -c tailwind.config.js -i Styles/tailwind.input.css -o wwwroot/css/tailwind.css --minify
// The CI build regenerates it, so a class added in a .razor/.cs file can't go missing on the live site.
module.exports = {
  content: ['./**/*.razor', './**/*.cs', './wwwroot/index.html', './wwwroot/js/**/*.js', '!./bin/**', '!./obj/**'],
  theme: { extend: {} },
  plugins: [],
};
