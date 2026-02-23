# Group Registration Widget

> **Status**: Implemented (commit `7893272`)
>
> **Last updated**: 2026-02-23

## Overview

A special form widget that allows a user to register themselves and additional group members in a single form submission. Renders as a series of repeated `<fieldset>` groups — each member gets their own name input and role selection, visually matching the existing form style.

This is a Veneer-only enhancement. The underlying Google Form remains a standard form with separate fields — the original Google Form continues to work independently.

---

## Use Case

When signing up for a dance event, the primary registrant enters their own name and role. Optionally, they can add additional members of their group (each with name and role). All additional members are serialized into a single text field.

---

## Pattern Detection

The widget activates when three **consecutive** form fields match this pattern:

| Position | Field type                    | Title match                                     | Required |
| -------- | ----------------------------- | ----------------------------------------------- | -------- |
| 1        | TEXT or PARAGRAPH_TEXT        | Matches `REGEX_DANCE_NAME`                      | Yes      |
| 2        | CHECKBOXES or MULTIPLE_CHOICE | Option values match `REGEX_DANCE_LEADER/FOLLOW` | Yes      |
| 3        | PARAGRAPH_TEXT                | Contains "group" (case-insensitive)             | No       |

When detected, all three fields are replaced by a single `GroupRegistration` component.

### Detection Regexes

Aligned with existing patterns in `sheet-data-pipeline.svelte.ts`, extended for Google Forms context:

```
REGEX_DANCE_NAME    = /name|닉네임/i                  # "name", 닉네임 (nickname)
REGEX_DANCE_ROLE    = /role|역할|리드|리더/i            # field title: "role", 역할, 리드, 리더
REGEX_DANCE_LEADER  = /lead|리더|리드/i                # option value: "leader", 리더, 리드
REGEX_DANCE_FOLLOW  = /follow|팔뤄|팔로우|팔로워/i      # option value: "follower", 팔뤄, 팔로우, 팔로워
REGEX_DANCE_GROUP   = /group|그룹/i                   # field title: "group", 그룹
```

These regexes are currently defined inline in `sheet-data-pipeline.svelte.ts`. They should be extracted to a shared module (e.g., `src/lib/dance-constants.ts`) so both the sheet pipeline and the group registration widget can import them.

### Role Prefix Mapping (Serialization Only)

Korean consonant abbreviations `ㄹ`/`ㅍ` are accepted as role prefixes in the serialization format (user-typed shorthand). They are **not** used in the detection regexes above — Google Form option labels use full Korean words, not consonant abbreviations.

| Prefix                               | Meaning  |
| ------------------------------------ | -------- |
| `L`, `l`, `ㄹ`                       | Leader   |
| `F`, `f`, `ㅍ`                       | Follower |
| `LF`, `FL`, `ㄹF`, `Fㄹ`, `B` (etc.) | Both     |

---

## Widget Layout

The widget replaces the three detected fields with a series of **repeated `<fieldset>` elements** — one per member. Each fieldset contains a name input and role selection that visually match the existing form's field rendering (same labels, input styles, spacing). This means additional members look like natural extensions of the form rather than a separate table UI.

Using actual `<fieldset>` + `<legend>` provides semantic grouping (screen readers announce "Member 2" when entering the group) and a natural home for the member number in the `<legend>`. Pico CSS v2 already resets fieldset styling (`border: 0; padding: 0; margin: 0; margin-bottom: var(--pico-spacing)`) and styles `<legend>` like a label (`display: block; font-weight: var(--pico-form-label-font-weight)`). We build on top of Pico's defaults — add alternating backgrounds, tighter internal spacing, and visual separation between members.

### Structure

```
┌ 1. Your name * ─────────────────┐
│ [________________________]      │
│                                 │
│ Role *                          │
│ ○ Leader  ○ Follower            │
└─────────────────────────────────┘

┌ 2. ────────────────────────[✕]──┐
│ Name                            │
│ [________________________]      │
│                                 │
│ Role                            │
│ ○ Leader  ○ Follower            │
└─────────────────────────────────┘

┌ 3. ────────────────────────[✕]──┐
│ Name                            │
│ [________________________]      │
│                                 │
│ Role                            │
│ ○ Leader  ○ Follower            │
└─────────────────────────────────┘

         [+ Add Member]
          Group of 3
```

### Member 1 (Primary Registrant)

- Numbered `1.` with the original field title (e.g., "Your name")
- **Required**: red asterisk on both name and role labels
- Standard HTML form validation — prevents submission when empty
- Bound directly to the original Name and Role form field entry IDs
- Cannot be deleted (no ✕ button)
- Renders using the same input/checkbox/radio styles as the rest of the form

### Members 2+ (Additional)

- Numbered sequentially (`2.`, `3.`, etc.) — numbers update on delete
- Reuse the same labels and input structure as member 1, but **without** required markers
- All parts optional — every row counts as a member regardless (see Validation below)
- Name input has placeholder text: `(optional)` — signals the field isn't required without cluttering the label
- Each has a delete (✕) button
- Added via the `[+ Add Member]` button, which appends a new fieldset group

### Group Count

- Displayed below the `[+ Add Member]` button: `Group of N`
- Updates reactively as members are added/removed
- Only shown when there are 2+ members (no point showing "Group of 1")

### Clear Group Button

- A `Clear group` button is shown when there are 2+ members
- Removes all members 2+ in one action, resetting back to just member 1
- Does **not** clear member 1's fields (those are the original form fields, managed independently)
- Positioned near the `[+ Add Member]` button (e.g., to its right)

### Checkbox vs Radio

Follows the convention of the original Role question — if the original is CHECKBOXES, additional members use checkboxes; if MULTIPLE_CHOICE, additional members use radio buttons.

### Visual Grouping

Each member's name + role fields must be visually grouped as a unit. In the original form (see screenshot), the name and role fields have significant vertical spacing between them — they look like independent questions. In the widget:

- Name and role inputs within the same member are **tightly spaced** (reduced gap)
- Members are separated from each other with **more visual space** (margin or divider) and alternating backgrounds
- Each member is an actual `<fieldset>` with `<legend>` showing the member number — provides semantic grouping and accessibility
- The goal: it should be immediately obvious which role belongs to which name

---

## Form Validation

### Required Fields (Member 1 only)

Member 1 maps to the original Name and Role form fields, which are marked required in the Google Form. The widget must enforce this:

- **Red asterisk (\*)** on name and role labels for member 1
- **Validation on submit**: if name is empty or no role selected, show error state (red border, error message) and prevent form submission
- Uses standard HTML constraint validation where possible (`required` attribute on the input and radio/checkbox group)

### Members 2+ (No validation)

- No required markers
- Every row counts as a member — an empty row (no name, no role) is serialized as a bare `1` (one unnamed member with unknown role)
- Partially filled rows (name but no role, or role but no name) are serialized as-is

---

## Form Submission

| Row        | Submits to                                                | Format                          |
| ---------- | --------------------------------------------------------- | ------------------------------- |
| Row 1 name | Name field entry ID (e.g., `entry.1865334243`)            | Plain text                      |
| Row 1 role | Role field entry ID (e.g., `entry.2102068387`)            | Standard checkbox/radio value   |
| Rows 2+    | Group paragraph field entry ID (e.g., `entry.1510336972`) | Compact text format (see below) |

---

## Serialization Format

Additional group members (rows 2+) are serialized into a single text string for the PARAGRAPH_TEXT field.

### Format Rules

**Serializer output** (widget → paragraph field):

- One entry per line (newline-delimited)
- No quoting needed — each line is a complete entry, spaces in names are unambiguous

**Parser input** (paragraph field → widget, also localStorage restore):

- Splits on **newlines first** — each line is one or more entries
- Within a line, splits on **spaces** to support multiple entries on one line
- Accepts both **single quotes** (`'F:Jane Doe'`) and **double quotes** (`"F:Jane Doe"`) for names with spaces when multiple entries share a line
- Tolerant of mixed whitespace (tabs, multiple spaces, blank lines)

**Entry format**:

- **Role prefix** (optional, case-insensitive): single role letter or combo of two
  - Single: `L:` (Leader), `F:` (Follower), `ㄹ:`, `ㅍ:`
  - Combo (Both): `LF:`, `FL:`, `ㄹF:`, `Fㄹ:`, `B:` — any two distinct role letters, order doesn't matter. `B:` is a shorthand alias.
- **Colon** separates role prefix from name
- **No colon** = entire token is a name with no role specified
- **Counted role** (no name): `3F`, `2LF`, `3ㄹ` — number followed by role letter(s)
- **Bare number**: Represents N unnamed members with no role
- **Empty/blank** = no additional members

### Grammar

```
input       = line ( newline line )*
line        = entry ( space entry )*
entry       = named | counted | bare_count
named       = role ":" name          # F:Alice, LF:bob, ㄹ:수진
counted     = number role            # 3F, 2LF, 3ㄹ
bare_count  = number                 # 3 (role unspecified)
role        = letter | letter letter # F, LF, FL, ㄹF — one or two distinct role letters
letter      = [LlFfBbㄹㅍ]          # B is alias for LF
name        = quoted | unquoted
quoted      = "'" chars "'" | '"' chars '"'
```

### Role Prefixes

| Prefix                                    | Meaning                  |
| ----------------------------------------- | ------------------------ |
| `L:`, `l:`, `ㄹ:`                         | Leader                   |
| `F:`, `f:`, `ㅍ:`                         | Follower                 |
| `LF:`, `FL:`, `lf:`, `ㄹF:`, `Fㄹ:`, `B:` | Both Leader and Follower |
| _(none)_                                  | No role specified        |

**Serializer output** prefers `LF:` over `B:` — more immediately readable. Parser accepts all variants.

### Examples

**Serializer output** (one entry per line):

```
F:Jane Doe
L:Kim Park
LF:Carol
3ㄹ
2
```

→ Jane Doe (Follower), Kim Park (Leader), Carol (Both), 3 unnamed leaders, 2 unnamed (no role). No quoting needed. Note: serializer outputs `LF:` not `B:` for readability.

**Parser input** (accepts all of these):

| Input                | Parsed result                                                            |
| -------------------- | ------------------------------------------------------------------------ |
| `L:Alice`            | Alice (Leader)                                                           |
| `F:Bob`              | Bob (Follower)                                                           |
| `B:Carol`            | Carol (Both) — `B:` is shorthand alias                                   |
| `LF:Carol`           | Carol (Both) — combo prefix, preferred by serializer                     |
| `FL:Carol`           | Carol (Both) — order doesn't matter                                      |
| `ㄹF:Carol`          | Carol (Both) — mixed Korean/English                                      |
| `2LF`                | 2 unnamed members, both roles                                            |
| `Alice`              | Alice (no role)                                                          |
| `Lisa`               | Lisa (no role) — no colon means no prefix                                |
| `F:Jane Doe`         | Jane Doe (Follower) — on its own line, no quoting needed                 |
| `"F:Jane Doe" L:Bob` | Jane Doe (Follower) + Bob (Leader) — double-quoted, two entries one line |
| `'F:Jane Doe' L:Bob` | same as above — single quotes also work                                  |
| `L:Alice F:Bob`      | Alice (Leader) + Bob (Follower) — two entries, one line                  |
| `3F`                 | 3 unnamed followers                                                      |
| `2l 1F`              | 2 unnamed leaders + 1 unnamed follower                                   |
| `ㄹ:수진`            | 수진 (Leader) — Korean consonant prefix                                  |
| `3ㄹ 2ㅍ`            | 3 unnamed leaders + 2 unnamed followers                                  |
| `3`                  | 3 unnamed members, no role                                               |
| _(empty/blank)_      | No additional members                                                    |

### Disambiguation Rule

The colon is the delimiter between role prefix and name:

- **Colon present**: Everything before `:` is the role prefix; everything after is the name
- **No colon**: The entire token is a name (or a bare number)
- Names starting with `L`, `F`, or `B` do NOT need quoting unless they also have a colon in them — the colon is the trigger, not the first letter

---

## Responsive Layout

Since each member is a vertically-stacked fieldset group (not a table row), the layout is **inherently responsive** — it works the same on mobile and desktop. No media query breakpoint needed.

### Visual Separation

- **Alternating background colors** (subtle gray/white) on each member group to distinguish them
- Member number (`1.`, `2.`, etc.) displayed as a header/legend for each group
- Member 1 may have a subtle highlight (e.g., slightly different background) to distinguish it as the primary registrant

### Tap Targets

- Name input gets full width
- Role checkboxes/radios get full width on their own line
- Delete button is a comfortably-sized target in the top-right corner

---

## Implementation Plan

### 1. Serialization Module

A utility module with two functions:

- **`serialize(rows)`** — Converts an array of `{name, leader, follower}` objects to the compact string format
- **`parse(text)`** — Converts the compact string back to an array of structured row objects

Both directions are needed: `parse` for restoring from localStorage or pre-filled values, `serialize` for form submission.

### 2. Pattern Detection (parser/layout level)

After parsing all fields, scan for consecutive field sequences matching the pattern described above. When detected, tag these three fields with metadata indicating they form a group registration widget.

### 3. Component: `GroupRegistration.svelte`

- Receives the three field definitions as props
- **Member 1**: Renders name input and role selection using the original field definitions (labels, entry IDs, required state). Bound directly to the original form field entry IDs. No delete button.
- **Members 2+**: Dynamic fieldset groups added via `[+ Add Member]`. Each reuses the same label/input structure as member 1 but without `required`. Delete button on each.
- **Member numbers**: Each group displays its sequential number (`1.`, `2.`, etc.), updated reactively on add/delete
- **Group count**: Shows `Group of N` below the add button (hidden when N=1)
- **Validation**: Member 1 fields have `required` attribute and red asterisks; standard HTML constraint validation on submit
- Reactive: On any change, serialize members 2+ into the hidden value for the paragraph field
- Follows existing `store.get('storedValues')` pattern for localStorage persistence

### 4. Integration in Form Rendering

- When the pattern is detected, skip individual rendering of the three matched fields
- Render `GroupRegistration` component in place of the first matched field
- The paragraph field's hidden value is set by the component (not visible to user)
- The rendered fieldset groups should visually match the form's existing field styles — same fonts, spacing, input borders, label styles — so additional members look like natural form fields

### 5. localStorage Persistence

- Save the structured row data (not just the serialized string) so the table restores properly on page reload
- Row 1 persists via the existing per-field storage (byId/byTitle)
- Rows 2+ persist as the serialized string in the paragraph field's storage slot
