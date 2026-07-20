# Adding clinics

Add clinics by editing a JSON file and running one command. This inserts each
clinic through the same validated path as the admin "New clinic" form (Zod
validation, slug-uniqueness, sortScore, audit log), so imported clinics behave
exactly like hand-added ones and can be edited in `/admin/clinics` afterward.

## Daily workflow

1. Put your clinics in `scripts/clinics.json` (an array of clinic objects).
   Copy `scripts/clinics.example.json` as a starting point.
2. Reference taxonomy **by slug**. To see every valid slug:
   ```
   npm run import-clinics -- --taxonomy
   ```
3. Dry-run first — validates and resolves slugs, writes nothing:
   ```
   npm run import-clinics -- --dry
   ```
4. Import for real:
   ```
   npm run import-clinics
   ```

Import a different file: `npm run import-clinics -- path/to/file.json`

## Notes

- **Slug** is auto-generated from `name` if you omit it.
- **status** defaults to `draft` (not public). Set `"status": "published"` to
  go live immediately, or publish later in the admin.
- **Batch-resilient:** a clinic that fails validation or already exists is
  skipped with a reason; the others still import.
- **Media** (logo/cover/gallery) is easiest to add in the admin after import.
- Taxonomy `clinicCount` only reflects **published** clinics after the ranking
  recompute runs.
- If Node can't resolve the MongoDB SRV record, prefix the command with
  `SCRIPT_DNS=8.8.8.8,1.1.1.1`. Otherwise leave it unset.

## Fields

See `scripts/clinics.example.json` for the full shape. Taxonomy fields take
arrays of slugs:

- `treatmentTypes`, `conditionsTreated`, `cellSources`, `accreditations`
- `serviceFocus`: `[{ "treatment": "<slug>", "percent": 40 }]`

Everything else matches the admin form (basics, pricing, company facts,
medical director & team, locations, contact & social, highlights, FAQs, SEO).
