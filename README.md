# School District Search Tool

Search U.S. homes by **school district** instead of ZIP. The map draws official NCES district boundaries, plots elementary / middle / high schools, and treats school attributes as filters.

**Repo:** [github.com/quantlover/school-district-search-tool](https://github.com/quantlover/school-district-search-tool)

## Put it on the web (Vercel)

This app needs a Node host (API routes), so GitHub Pages will not work. The usual path:

1. Open [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Import `quantlover/school-district-search-tool`.
3. Click Deploy. No env vars are required for this first version.

You get a public URL like `https://school-district-search-tool.vercel.app`. Later we can point a custom domain at it.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Try `Princeton Public Schools NJ`, `08540`, or `Austin ISD`.

## What is live vs sample

- **Live:** district search, boundary polygons, school points, CCD facts (enrollment, grades, charter, FRPL), filters, links out to NCES / GreatSchools / Niche.
- **Sample:** house pins are generated inside the polygon. Real MLS listings need a broker/IDX contract — see the in-product note.

School ratings from GreatSchools or Niche are linked, not scraped. Plug in their APIs later if you get keys.
