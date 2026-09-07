# School District Search Tool

Search U.S. homes by **school district** instead of ZIP.

**Live site:** [schooldistrictsearchtool.vercel.app](https://schooldistrictsearchtool.vercel.app)

## How to use it

1. Search a district name or ZIP (try `Princeton Public Schools NJ`, `08540`, or `Austin ISD`).
2. Click a school to draw its attendance zone (orange) inside the district outline (green).
3. Filter by elementary, middle, or high school, plus attributes like charter, magnet, Title I, and enrollment.
4. Open **Niche** for that school’s profile page, or **NCES** for the official CCD record.

## What’s on the map

- **Live:** district search, NCES district boundaries, school points, CCD facts (enrollment, grades, charter, FRPL), filters, and links to NCES / Niche / GreatSchools.
- **Sample:** house pins are generated inside the polygon for demo only. Real MLS listings need a broker/IDX feed.

School attendance zones come from NCES SABS 2015–16 where available; older or missing zones fall back to the full district outline.
