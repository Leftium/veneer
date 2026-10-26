# Form metadata API (v1)

`GET /api/form-meta?id=<URL-encoded URL or Veneer ID>` is the supported JSON HTTP
interface for external consumers. SvelteKit page-data transport and generated
remote-function URLs are internal implementation details.

NL Event should discover URLs locally, then call this endpoint through its
same-origin server proxy only after the user opts into external enrichment.
Requests with an Origin other than the endpoint's own origin return HTTP 403.
No cross-origin access or credential forwarding is enabled. Server-to-server
requests without an Origin are supported.

## Inputs

Accepted IDs are `f.`, `s.`, `g.`, `b.`, `h.`, and `u.` followed by an identifier
containing letters, numbers, underscores or hyphens. Accepted HTTPS URLs are:

- `docs.google.com/forms/d/e/<published-form-id>/viewform` (also edit/preview).
- `docs.google.com/spreadsheets/d/<id>` (also published `/d/e/<id>` syntax).
- `forms.gle/<token>`, `bit.ly/<token>`, `shorturl.at/<token>`, `url.kr/<token>`.

URLs with credentials, nondefault ports, other schemes, hosts or paths are
rejected. Query parameters and fragments, including prefilled answers, are
removed before resolution. Redirects can pass through supported shorteners
only and must end at an accepted Google document. Login pages, interstitials,
JavaScript redirects and unavailable documents yield explicit failure results.

## Response

All responses have `Content-Type: application/json`, `Cache-Control: no-store`,
and the following fields. Additive fields may be introduced without changing
this contract; consumers should ignore unknown fields.

| Field                    | Meaning                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `status`                 | `ok`, `invalid_input`, `unsupported_target`, `unavailable`, `limit_exceeded`, `timeout`, or `forbidden_origin` |
| `type`                   | `form`, `sheet`, or `null` on failure                                                                          |
| `documentId`             | Resolved `f.<id>` or `s.<id>`; `null` on failure                                                               |
| `formId`                 | Bare published Form ID, otherwise `null`                                                                       |
| `veneerId`               | Canonical resolved Veneer ID, otherwise `null`                                                                 |
| `title`                  | Document title; empty string on failure                                                                        |
| `headerImageUrl`         | Existing launcher image field; `null` without an image                                                         |
| `accentColor`, `bgColor` | Existing launcher colors; `null` when absent                                                                   |
| `description`            | Primary Form description, exactly as parsed; `null` when unavailable, `""` when present but empty              |
| `infoText`               | Ordered plain-text introductory content; `""` for an empty intro, `null` for non-Forms or failures             |
| `autoSheets`             | Existing array of `{ veneerId, title }` suggestions; empty when none are available                             |
| `autoSheetsStatus`       | On successful Forms, `complete` or `partial` if a candidate failed or exceeded the scan bound                  |

For launcher compatibility, expected resolution failures return HTTP 200 with
`status` and empty metadata. Inspect `status`, not just the HTTP code. Cross-origin
requests return HTTP 403 with `status: "forbidden_origin"`. A resolved Sheet is
an explicit `type: "sheet"` result and has no Form description.

```json
{
	"status": "ok",
	"type": "form",
	"documentId": "f.example",
	"formId": "example",
	"veneerId": "f.example",
	"title": "Dance evening",
	"headerImageUrl": null,
	"accentColor": null,
	"bgColor": null,
	"description": "Doors open at 7.\n\nBring indoor shoes.",
	"infoText": "Doors open at 7.\n\nBring indoor shoes.\n\nVenue\nMain hall",
	"autoSheets": [],
	"autoSheetsStatus": "complete"
}
```

`infoText` includes the primary description once, followed by titles and
text of introductory TITLE_AND_DESCRIPTION sections before the first answer
input. Paragraphs, repeated source text, section order and footer separators
are preserved. The Form title is returned separately. Image captions, image
URLs, HTML description fields, question prompts/options and later sections are
excluded. The page's `info` and `footers` use the same source selection, with
Markdown headings, images and footer wrappers added for display.

Text fields are untrusted plain text, even if an author typed markup into a
Form. Consumers must render them as text or escape them for their destination.
They must not interpret these fields as trusted HTML.

## Request bounds and reuse

Each request has a 15-second deadline covering DNS, redirects, document fetching
and Sheet discovery. Each resolution chain permits five shortener redirects;
the Form fetch permits five redirects within the same Form. A loop fails closed.
Each upstream response is capped at 4 MiB with a streamed byte count. Compressed
responses are rejected. Each API request permits at most 20 upstream requests
and considers at most eight Sheet-link candidates.

Every connection validates all DNS answers against nonpublic address ranges and
pins a validated address for the socket while retaining HTTPS hostname
verification. Redirects are manual and revalidated. The transport requires a
Node-compatible server with `node:dns`, `node:https`, and `node:net`; it does not
fall back to an unchecked fetch on unsupported runtimes.

Sheet suggestions reuse the existing link discovery and request only
`properties(title)` from the Sheets API, using the server's configured
`GCP_API_KEY`. Only Google spreadsheet links and supported shorteners count
toward the candidate limit. Unrelated links, including maps, email links and
other Google document types, are ignored. Failed Sheet lookups, unresolved
supported shorteners and exhausted budgets produce `autoSheetsStatus: "partial"`.
No cells, rows, grids or attendee entries are fetched. A Sheet
that cannot return public API metadata is unavailable; published-only Sheet IDs
may therefore have no suggestion. The Form metadata remains available when
Sheet discovery is partial.

Fetched responses are reused only within one API request. There is no
cross-request metadata cache or user-data persistence. The endpoint does not log
raw URLs or document content. NL Event can reuse a successful response in its
own opt-in workflow instead of calling again during composition/export.
