# Google Forms `FB_PUBLIC_LOAD_DATA_` Data Structure Reference

> **Status**: Reverse-engineered, undocumented by Google. Subject to change without notice.
>
> **Last updated**: 2026-02-17

Google Forms embeds a JavaScript variable `FB_PUBLIC_LOAD_DATA_` in the HTML of every published form. This contains the complete form structure as a nested JSON array. Veneer parses this to render forms.

---

## Top-Level Array

```
FB_PUBLIC_LOAD_DATA_ = [
  [0]  null,
  [1]  <FormData>,              // Main form data object (see below)
  [2]  "/forms",                // Base path
  [3]  "Document filename",     // Google Drive filename (may differ from display title)
  [4]  null,
  [5]  null,
  [6]  null,
  [7]  "",                      // Possibly theme ID
  [8]  null,
  [9]  0,                       // Unknown flag
  [10] 0,                       // Unknown flag
  [11] null,
  [12] "",                      // Possibly custom theme CSS
  [13] 0,                       // Unknown flag
  [14] "e/1FAIpQLSd4l...",      // Published form ID path
  [15] 0,                       // Unknown flag
  [16] "[]",                    // Stringified empty array (possibly linked sheets)
  [17] 0,                       // Unknown flag
  [18] 0,                       // Unknown flag
  [19] 1,                       // Unknown flag
]
```

**Parsed by Veneer**: `[1]` (form data), `[3]` (filename).

---

## FormData: `jArray[1][...]`

```
[0]  ""                         // Form description (plain text)
[1]  [<Field>, <Field>, ...]    // Array of ALL fields/questions (see Field Array below)
[2]  [                          // Confirmation settings
       "Response recorded msg",   // [2][0] Confirmation message text
       1,                         // [2][1] Show "submit another response" link?
       0,                         // [2][2] Unknown
       1,                         // [2][3] Unknown
       0                          // [2][4] Unknown
     ]
[3]  null
[4]  null
[5]  null
[6]  null
[7]  null
[8]  "Form Display Title"       // Form title shown to respondents
[9]  73                         // Unknown (possibly theme/color code)
[10] [                          // Form settings
       null,                      // [10][0]
       null,                      // [10][1]
       null,                      // [10][2]
       2,                         // [10][3] Unknown setting
       null,                      // [10][4]
       null,                      // [10][5]
       1                          // [10][6] Email collection rule:
                                  //         1 = NONE
                                  //         2 = VERIFIED
                                  //         3 = INPUT
     ]
[11] null
[12] null
[13] null
[14] null
[15] [2]                        // Unknown (array with single number)
[16] [                          // Response settings/limits
       [1,1,1,1,1],              // [16][0] Unknown flags
       1,                         // [16][1] Unknown
       0,                         // [16][2] Unknown
       1,                         // [16][3] Unknown
       0                          // [16][4] Unknown
     ]
[17]-[22] null
[23] [null, ""]                 // Unknown
[24] [null, "Title HTML"]       // Form description as rich text/HTML (commented out in parser)
[25] [null, "Title HTML"]       // Form title as rich text/HTML (commented out in parser)
```

**Parsed by Veneer**: `[0]` (description), `[1]` (fields), `[8]` (title), `[10][6]` (email collection rule).

**Available but unused**: `[2][0]` (confirmation message), `[24]`/`[25]` (rich text HTML for title/description).

---

## Field Array: `field[...]`

Each element in `jArray[1][1]` is an array representing one form item (question, section header, image, video, page break, etc.).

### Field Indices

```
[0]  123456789                  // Item ID (unique numeric identifier)
[1]  "Question title"           // Title (plain text), or null
[2]  "Description text"         // Description (plain text), or null
[3]  <TypeCode>                 // Type code (see Type Codes below)
[4]  [<AnswerConfig>, ...]      // Answer configuration array, or null for non-input types
[5]  null                       // Unknown
[6]  <MediaMetadata>            // Media metadata for IMAGE (type 11) / VIDEO (type 12) types
                                //   [imageId, flag, [width, height, 0]]
                                //   [imageId, type, [w, h, 0], youtubeId]  (for VIDEO)
[7]  null                       // Unknown
[8]  null                       // Unknown
[9]  [<MediaMetadata>]          // Media metadata for SUBMITTABLE types with attached images
                                //   Wrapped in an extra array: [[imageId, null, [w, h, 0]]]
[10] null                       // Unknown
[11] [null, "<html>"]           // Title as rich text/HTML (Google's own rendering)
[12] [null, "<html>"]           // Description as rich text/HTML (Google's own rendering)
```

**Parsed by Veneer**: `[0]`-`[4]`, `[6]`, `[9]` (as of our recent fix).

**Available but unused**: `[11]` (title HTML), `[12]` (description HTML).

### Important: Media Metadata Location

Google stores media metadata at **different indices** depending on the field type:

| Field type                            | Media location | Structure                                             |
| ------------------------------------- | -------------- | ----------------------------------------------------- |
| IMAGE (type 11), VIDEO (type 12)      | `field[6]`     | `[imageId, flag, [w, h, 0]]`                          |
| Submittable types with attached image | `field[9][0]`  | `[imageId, null, [w, h, 0]]` (wrapped in extra array) |

Veneer handles both via: `const mediaMetadata = field[6] ?? field[9]?.[0]`

---

## Type Codes: `field[3]`

| Code  | Type                  | Submittable | Has Answer Config | Notes                                      |
| ----- | --------------------- | ----------- | ----------------- | ------------------------------------------ |
| 0     | TEXT (Short answer)   | Yes         | Yes               | Single-line text input                     |
| 1     | PARAGRAPH_TEXT        | Yes         | Yes               | Multi-line textarea                        |
| 2     | MULTIPLE_CHOICE       | Yes         | Yes               | Radio buttons                              |
| 3     | DROPDOWN              | Yes         | Yes               | Select dropdown                            |
| 4     | CHECKBOXES            | Yes         | Yes               | Checkbox group                             |
| 5     | SCALE                 | Yes         | Yes               | Linear scale (1-5, 1-10, etc.)             |
| 6     | TITLE_AND_DESCRIPTION | No          | No                | Section header (decorative, no input)      |
| 7     | GRID                  | Yes         | Yes               | Grid/matrix of radio buttons or checkboxes |
| **8** | **PAGE_BREAK**        | **No**      | **No**            | **Section divider for multi-page forms**   |
| 9     | DATE                  | Yes         | Yes               | Date picker                                |
| 10    | TIME                  | Yes         | Yes               | Time picker                                |
| 11    | IMAGE                 | No          | No                | Standalone image                           |
| 12    | VIDEO                 | No          | No                | Embedded YouTube video                     |
| 13    | FILE_UPLOAD           | Yes         | Yes               | File upload field                          |

> **Warning**: Veneer's `GoogleFormsFieldTypeEnum` currently maps `FILE_UPLOAD = 8`,
> which is **incorrect**. The correct mapping is `PAGE_BREAK = 8`, `FILE_UPLOAD = 13`.
> This bug causes multi-page forms to break silently.

### Veneer Rendering Support

| Type                  | Parsed                 | Rendered | Notes                                              |
| --------------------- | ---------------------- | -------- | -------------------------------------------------- |
| TEXT                  | Yes                    | Yes      | `<input>`                                          |
| PARAGRAPH_TEXT        | Yes                    | Yes      | `<textarea>`                                       |
| MULTIPLE_CHOICE       | Yes                    | Yes      | Radio buttons (or checkboxes if single option)     |
| DROPDOWN              | Yes                    | Yes      | `<select>`                                         |
| CHECKBOXES            | Yes                    | Yes      | Checkbox group                                     |
| SCALE                 | Yes                    | **No**   | Hidden in `<div class="hidden">`                   |
| TITLE_AND_DESCRIPTION | Yes                    | Yes      | `<h3>` + description as Markdown                   |
| GRID                  | Yes                    | **No**   | Hidden in `<div class="hidden">`                   |
| PAGE_BREAK            | **No** (misidentified) | **No**   | Silently discarded or misidentified as FILE_UPLOAD |
| DATE                  | Yes                    | **No**   | Hidden in `<div class="hidden">`                   |
| TIME                  | Yes                    | **No**   | Hidden in `<div class="hidden">`                   |
| IMAGE                 | Yes                    | Yes      | `<img>` with imgUrl                                |
| VIDEO                 | Yes                    | Yes      | YouTube `<iframe>` embed                           |
| FILE_UPLOAD           | Misidentified          | **No**   | Enum maps to wrong code (8 instead of 13)          |

---

## Answer Config: `field[4][0][...]`

For submittable question types, `field[4]` contains an array of answer sub-questions (typically just one at `field[4][0]`, but grids may have multiple).

```
[0]  222144381                  // Submission entry ID (used as "entry.XXXXX" in form POST)
[1]  [<Option>, <Option>, ...]  // Answer options (for MC, DROPDOWN, CHECKBOXES)
                                //   null for free-text types (TEXT, PARAGRAPH_TEXT)
[2]  1                          // Required flag: 1 = required, 0 = optional
[3]  null                       // Unknown
[4]  null                       // Unknown
[5]  null                       // Unknown
[6]  null                       // Unknown
[7]  null                       // Unknown
[8]  0                          // Unknown (seen on CHECKBOXES, possibly selection limit)
```

**Parsed by Veneer**: `[0]` (entry ID), `[1]` (options list), `[2]` (required flag).

---

## Answer Option: `field[4][0][1][n][...]`

Each option in a MULTIPLE_CHOICE, DROPDOWN, or CHECKBOXES field:

```
[0]  "Option display text"      // Label shown to user
[1]  null                       // Unknown (possibly option image)
[2]  null                       // Unknown
[3]  null                       // Unknown
[4]  0                          // Unknown flag (possibly "is other" / custom text option)
[5]  <targetSectionId>          // Go-to-section target (multi-page forms only):
                                //   null or 0  = Continue to next section (default)
                                //   <number>   = Jump to PAGE_BREAK with this itemId
                                //   (special sentinel values may indicate "Submit" or "Restart")
```

**Parsed by Veneer**: `[0]` (option text).

**Available but unused**: `[4]` (is-other flag), `[5]` (go-to-section navigation target).

---

## Media Metadata

### For IMAGE type (field[6])

```
[0]  "1AYLicv-17xR..."          // Google Drive file ID
[1]  0                          // Flag (0 for images)
[2]  [1131, 1600, 0]            // [width, height, unknown]
```

### For VIDEO type (field[6])

```
[0]  "driveFileId"              // Google Drive file ID (may be empty)
[1]  <type>                     // Video type flag
[2]  [width, height, 0]         // Dimensions
[3]  "dQw4w9WgXcQ"             // YouTube video ID
```

### For submittable types with attached image (field[9])

```
[
  [                             // Wrapped in extra array
    "1uVKcf0-GggPd2D...",        // [0] Google Drive file ID
    null,                         // [1] null (not a standalone image)
    [740, 1046, 0]                // [2] [width, height, unknown]
  ]
]
```

### Image URL Resolution

The image file IDs in the metadata do NOT directly map to URLs. Image URLs are extracted separately from `<img>` tags in the HTML that match:

```
<img src="https://lh7-rt.googleusercontent.com/formsz/AN7Bs..." />
```

Veneer matches these URLs to questions by comparing the `=w{N}` width suffix in the URL against `mediaWidth` from the metadata. Falls back to sequential index matching.

---

## Multi-Page Form Support

### How Multi-Page Forms Differ

| Aspect                          | Single-page                       | Multi-page                                    |
| ------------------------------- | --------------------------------- | --------------------------------------------- |
| PAGE_BREAK items (type 8)       | Absent                            | Present in field array                        |
| Field array contents            | Only questions + decorative items | Questions + PAGE_BREAK dividers interspersed  |
| Option navigation (`option[5]`) | `null` / absent                   | Contains target section `itemId`              |
| Form submission                 | Single POST, `pageHistory=0`      | Sequential POSTs with `pageHistory=0,1,2,...` |
| HTML rendering by Google        | All questions on one page         | Only first section shown; Next/Back buttons   |

### PAGE_BREAK Field Structure

```json
[
	123456789, // [0] itemId (used as navigation target by option[5])
	"Section 2 Title", // [1] title
	"Section description", // [2] description
	8, // [3] type = PAGE_BREAK
	null // [4] no answer data
]
```

### Conditional Navigation (Go to Section Based on Answer)

For MULTIPLE_CHOICE (type 2) and DROPDOWN (type 3) questions, each answer option can specify which section to navigate to:

```
field[4][0][1][n][5] = targetSectionItemId
```

- `null` or `0`: Continue to next section (default)
- A numeric `itemId`: Jump to the PAGE_BREAK field with that itemId
- Special sentinel values may indicate "Submit form" or "Restart form"

### Submission for Multi-Page Forms

Google's `/formResponse` endpoint expects a `pageHistory` parameter for multi-page forms, tracking which pages were visited (e.g., `"0,1,2"`). Without it, submission may be rejected.

Many community tools have found that POSTing all fields at once with the full `pageHistory` string works, even without stepping through pages sequentially.

### Current Veneer Status

**Multi-page forms are NOT supported.** Specific issues:

1. **Enum bug**: `FILE_UPLOAD = 8` is wrong; type 8 is `PAGE_BREAK`, `FILE_UPLOAD` is type 13
2. **PAGE_BREAK fields are discarded**: Either skipped by `field.length < 4` check or misidentified
3. **No section grouping**: All fields rendered as a flat list
4. **No conditional navigation**: `option[5]` (go-to-section) is not parsed
5. **No `pageHistory`**: Submission does not include the required parameter
6. **No wizard UI**: No Next/Back buttons or section state management

### Implementation Approach (Future)

For full wizard-mode support with conditional branching:

| Layer        | Effort       | What's needed                                                               |
| ------------ | ------------ | --------------------------------------------------------------------------- |
| Parser fixes | Small        | Fix enum, add PAGE_BREAK type, extract option[5] nav targets                |
| Data model   | Medium       | Section grouping, navigation map, track which section each field belongs to |
| Wizard UI    | Medium-High  | Section state, Next/Back buttons, reactive branching on answer changes      |
| Submission   | Small-Medium | Add `pageHistory` parameter tracking visited sections                       |

---

## Example: Raw `FB_PUBLIC_LOAD_DATA_` (Single-Page Form)

From the btango reservation form:

```json
[null,
  ["",                                    // [1][0] description (empty)
    [                                     // [1][1] fields array
      [292005560, null, "<center>...", 6, ...],   // TITLE_AND_DESCRIPTION
      [1537852404, null, null, 11, ...],          // IMAGE (banner)
      [1021421034, "닉네임(Your Name)", null, 1, [[1865334243, null, 1]]],  // PARAGRAPH_TEXT
      [1547624626, "리더/팔로워...", null, 4, [[2102068387, [...], 1]]],     // CHECKBOXES
      [989626698, "테이블 번호...", null, 0, [[222144381, null, 1]],        // TEXT + attached image
        null,null,null,null, [["1uVKcf0-...", null, [740,1046,0]]]],
      [1578824412, "입금자명...", "계좌정보...", 0, [[45541019, null, 1]]],  // TEXT
      [906675078, "연락처(Contact)", null, 0, [[1111082152, null, 1]]],     // TEXT
      [1034874381, "기타...", null, 1, [[816226820, null, 0]]]              // PARAGRAPH_TEXT
    ],
    ["응답이 기록되었습니다.", 1, 0, 1, 0],  // [1][2] confirmation
    null, null, null, null, null,
    "일욜 수업 및 밀롱가 예약 신청서...",     // [1][8] form title
    73,                                      // [1][9] unknown
    [null,null,null,2,null,null,1],          // [1][10] settings (email=NONE)
    ...
  ],
  "/forms",                                  // [2] base path
  "2시밀 예약 신청서...의 사본",               // [3] filename
  null,null,null,"",null,0,0,null,"",0,
  "e/1FAIpQLSd4l...",                        // [14] form ID
  0,"[]",0,0,1
]
```
