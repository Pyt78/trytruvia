# trytruvia.com

Static landing page for Truvia, served by GitHub Pages at https://trytruvia.com.

## Structure

- `index.html` — the page
- `src/input.css` — Tailwind source
- `assets/styles.css` — compiled CSS (committed, since Pages serves the repo as-is)
- `CNAME` — custom domain for GitHub Pages

## Development

```bash
npm install
npm run dev     # rebuild CSS on change
npm run build   # one-off minified build
```

Open `index.html` in a browser, or run `npx serve .`.

Re-run `npm run build` and commit `assets/styles.css` whenever classes in `index.html` change.
