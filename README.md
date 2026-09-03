# School District Rocks

Search U.S. homes by **school district** instead of ZIP. The map draws official NCES district boundaries, plots elementary / middle / high schools, and treats school attributes as filters.

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
