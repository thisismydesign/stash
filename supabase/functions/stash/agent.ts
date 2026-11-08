// Served at /agent and as the site's /llms.txt, with the {{placeholders}} filled in by docs.ts. Markdown; backticks are escaped.
export default `# Stash for agents

Stash ({{site}}) is the user's personal notepad: boards of notes, lists and ideas. You keep it for them. When they mention something to remember, buy, do, plan or look at, file it on the right board; when they ask what is up, read the boards and tell them.

## Boards

A board is one row in \`boards\`: \`title\`, \`kind\`, \`content\`, \`description\`, \`columns\`, \`tags\`, \`pinned\`, \`archived_at\`, \`share_token\`, \`image\`.

- \`description\` is a line or two about the board in Markdown, shown under its title; empty for none.
- \`content\` is the whole board as text. Read it, change it, write it back whole. A \`table\` keeps it empty: its data is in \`columns\` and \`rows\`.
- \`kind\` is one of:
  - \`todo\` — a Markdown task list. Items are \`- [ ] text\`; nested items indent two spaces under their parent. Ticked items are \`- [x]\` and live under a \`## Done\` heading at the end; the app moves whole top-level items there when ticked and back when unticked. Open items stay above the heading. Headings and plain lines may group items.
  - \`markdown\` — free-form notes, rendered with GitHub-flavoured Markdown.
  - \`html\` — a complete document, rendered in a sandboxed iframe (scripts run, no access to the app); the app calls it a page. Inline styles and scripts, absolute URLs for images, \`color-scheme: light dark\` so it reads in either theme. The app starts people off with templates (a mood board of pictures, a comparison, a recipe, a timeline); design yours to fit what the user asked for.
  - \`table\` — a table of records, such as transactions for a tax return: \`columns\` says what each row holds, and the rows are rows of their own (below), so you add one with one request.
- \`columns\` is a JSON list, in display order, of \`{"key", "name", "type"}\`, where \`key\` names the cell in a row's \`data\` (short, \`snake_case\`, never changed once rows have it), \`name\` is the heading, and \`type\` is one of:
  - \`text\` — a string
  - \`number\` — a JSON number; \`"decimals": 2\` on the column fixes how many are shown. Money is a number plus a currency column; money out is negative.
  - \`date\` — \`"YYYY-MM-DD"\`
  - \`checkbox\` — \`true\` or \`false\`
  - \`select\` — one of the column's \`"options": [...]\`; each shows in a colour of its own, or the one the column's \`"colors": {"Travel": "orange"}\` names (red, pink, grape, violet, indigo, blue, cyan, teal, green, lime, yellow, orange, gray)
  - \`url\` — a link
  A column may also carry \`"width"\`, how wide it shows in pixels. Cells of a type other than written read as text, so get the type right before writing rows: the database rejects a cell of the wrong type, a choice not among the column's options, and a key no column has, with a message saying which. \`[]\` for every other kind.
- \`tags\` is a list of short lower-case labels (for example \`travel\`, \`home\`, \`cars\`); the app colours and filters by them. Reuse what exists before inventing new ones: list the boards first.
- \`pinned\` boards sort first. \`archived_at\` hides a board from the main list; never delete a board the user did not ask to delete.
- \`share_token\` is set while the board is shared: anyone with the link \`{{shareLink}}\` can read it. Only the sharing functions below change it. Share a board only when the user asks.
- \`image\` is the board's picture, shown on its tile: an \`https://\` link, or the path of a file uploaded as below. Null for none.

## Writing for the user

- Keep the user's words. They dictate, so a word may be misspelled or be a sound-alike of the one meant; carry it over as given unless the intent is clear, and ask when a different reading would change the board.
- Add to boards rather than rewriting them. New to-do items go at the end of the open list, or under the heading they belong to.
- When something is done, tick it (\`- [x]\`) and move the item under \`## Done\`.

## Access

- If the user gave you an agent key (they make them under Agent keys in their profile menu), exchange it for a session at \`POST {{token}}\` with header \`Authorization: Bearer <key>\`.
- If you stored a refresh token earlier, refresh the session: \`POST {{tokenRefresh}}\` with header \`apikey: {{publishableKey}}\` and JSON \`{"refresh_token"}\`. Each refresh returns a new refresh token; store it.
- Otherwise, sign the user up: ask for their email and whether they want to choose a password or have Stash make one, then \`POST {{signup}}\` with JSON \`{"email", "password"}\`; leave \`password\` out for Stash to make one, returned once in the response. Store the refresh token durably and tell the user where. Give the user their email and password for signing in on the site; there is no reset by email, so they should keep it in a password manager, and can change it under Settings → Password.

## API

Boards are read and written through the Supabase REST API at {{rest}}, described at {{restOpenapi}}. Every call sends \`apikey: {{publishableKey}}\` and \`Authorization: Bearer <access_token>\`.

- List: \`GET {{rest}}/boards?select=id,title,kind,tags,pinned,archived_at,updated_at&order=pinned.desc,updated_at.desc\`
- Read one: \`GET {{rest}}/boards?id=eq.<id>&select=*\`
- Create: \`POST {{rest}}/boards\` with JSON \`{"title","kind","content","tags"}\` and header \`Prefer: return=representation\`
- Change: \`PATCH {{rest}}/boards?id=eq.<id>\` with the fields that change
- Delete: \`DELETE {{rest}}/boards?id=eq.<id>\`
- Share: \`POST {{rest}}/rpc/share_board\` with JSON \`{"board_id"}\`; returns \`[board]\` with \`share_token\` filled in. Give the user the link \`{{shareLink}}\`.
- Stop sharing: \`POST {{rest}}/rpc/unshare_board\` with JSON \`{"board_id"}\`; the link stops working.

A table's rows are in \`rows\`: \`id\`, \`board_id\`, \`data\`, \`created_at\`, \`updated_at\`. \`data\` is an object keyed by the table's column keys; a key left out is an empty cell. The app lists rows in the order they were added and sorts by any column on request; a row's change counts as the table's.

- Make a table: \`POST {{rest}}/boards\` with JSON \`{"title", "kind": "table", "columns": [{"key": "date", "name": "Date", "type": "date"}, {"key": "amount", "name": "Amount", "type": "number", "decimals": 2}, ...], "tags"}\`
- List rows: \`GET {{rest}}/rows?board_id=eq.<board_id>&order=created_at\`; filter on a cell with \`data->>category=eq.Travel\` or \`data->>date=gte.2026-01-01\`
- Add a row: \`POST {{rest}}/rows\` with JSON \`{"board_id", "data": {"date": "2026-03-01", "description": "Domain renewal", "amount": -14.99, "currency": "EUR"}}\` and header \`Prefer: return=representation\`
- Change a row: \`PATCH {{rest}}/rows?id=eq.<id>\` with JSON \`{"data": {...}}\`, the whole object
- Delete a row: \`DELETE {{rest}}/rows?id=eq.<id>\`
- Add or change columns: \`PATCH\` the board with the whole \`columns\` list. A column left out takes its cells from every row, and a change of type fails while rows hold cells of the old one. A table with rows cannot become another kind.

Pictures go in the private \`images\` bucket, under a folder named by the user's id (\`GET {{user}}\` returns it as \`id\`), with the same headers as above:

- Upload: \`POST {{storage}}/object/images/<user_id>/<name>\` with the file as the body and its \`Content-Type\` (PNG, JPEG, GIF, WebP or AVIF, up to 5 MB); then \`PATCH\` the board with \`{"image": "<user_id>/<name>"}\`.
- Remove: \`PATCH\` the board with \`{"image": null}\`, then \`DELETE {{storage}}/object/images/<user_id>/<name>\`.
- Read: \`POST {{storage}}/object/sign/images/<user_id>/<name>\` with JSON \`{"expiresIn": 3600}\` returns a \`signedURL\`, relative to \`{{storage}}\`.

Sessions and this document are described at {{openapi}}.
`;
