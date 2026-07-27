# Why `/clinics` lives in an `(index)` route group

The group changes nothing about the URL — `(index)` is stripped, so this is still
`/clinics`. It exists to **scope `loading.tsx` to the index page only**.

`loading.tsx` wraps its segment *and every child segment* in a Suspense
boundary. With the file one level up at `clinics/loading.tsx`, the sibling
`/clinics/[slug]` landing pages inherited that boundary — and once a route
streams, the 200 status line has already been flushed by the time the body calls
`notFound()`. An unknown slug therefore returned **200 with 404 content**: a soft
404, which Google reports as an error and which no amount of `notFound()`
placement inside the page can fix.

Moving the index page and its skeleton into this group takes `[slug]` out of the
boundary. `/clinics` keeps its loading skeleton; `/clinics/does-not-exist` now
returns a real 404.

The same pattern applies to any future sibling under `/clinics`. Note that
`/clinic/[slug]` (the profile route) still has this issue from its own
`loading.tsx` — fixing that one needs the skeleton rendered inside the page
instead, since the boundary is on the leaf segment itself.
