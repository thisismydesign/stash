// Served at /agent and as the site's /llms.txt, with the {{placeholders}} filled in by docs.ts. Markdown; backticks are escaped.
export default `# Stash for agents

Stash ({{site}}) is the user's personal notepad: boards of notes, lists and ideas. You keep it for them. When they mention something to remember, buy, do, plan or look at, file it on the right board; when they ask what is up, read the boards and tell them.

## Boards

A board is one row in \`boards\`: \`title\`, \`kind\`, \`content\`, \`tags\`, \`pinned\`, \`archived_at\`, \`share_token\`.

- \`content\` is the whole board as text. Read it, change it, write it back whole.
- \`kind\` is one of:
  - \`todo\` — a Markdown task list. Items are \`- [ ] text\`; nested items indent two spaces under their parent. Ticked items are \`- [x]\` and live under a \`## Done\` heading at the end; the app moves whole top-level items there when ticked and back when unticked. Open items stay above the heading. Headings and plain lines may group items.
  - \`markdown\` — free-form notes, rendered with GitHub-flavoured Markdown.
  - \`html\` — a complete document, rendered in a sandboxed iframe (scripts run, no access to the app). Inline styles and scripts, absolute URLs for images.
- \`tags\` is a list of short lower-case labels (for example \`travel\`, \`home\`, \`cars\`); the app colours and filters by them. Reuse what exists before inventing new ones: list the boards first.
- \`pinned\` boards sort first. \`archived_at\` hides a board from the main list; never delete a board the user did not ask to delete.
- \`share_token\` is set while the board is shared: anyone with the link \`{{shareLink}}\` can read it. Only the sharing functions below change it. Share a board only when the user asks.

## Writing for the user

- Keep the user's words. They dictate, so a word may be misspelled or be a sound-alike of the one meant; carry it over as given unless the intent is clear, and ask when a different reading would change the board.
- Add to boards rather than rewriting them. New to-do items go at the end of the open list, or under the heading they belong to.
- When something is done, tick it (\`- [x]\`) and move the item under \`## Done\`.

## Access

- If the user gave you an agent key (they make them under Agent keys in their profile menu), exchange it for a session at \`POST {{token}}\` with header \`Authorization: Bearer <key>\`.
- If you stored a refresh token earlier, refresh the session: \`POST {{tokenRefresh}}\` with header \`apikey: {{publishableKey}}\` and JSON \`{"refresh_token"}\`. Each refresh returns a new refresh token; store it.
- Stash has no sign-up. The user creates their account and their keys in the app.

## API

Boards are read and written through the Supabase REST API at {{rest}}, described at {{restOpenapi}}. Every call sends \`apikey: {{publishableKey}}\` and \`Authorization: Bearer <access_token>\`.

- List: \`GET {{rest}}/boards?select=id,title,kind,tags,pinned,archived_at,updated_at&order=pinned.desc,updated_at.desc\`
- Read one: \`GET {{rest}}/boards?id=eq.<id>&select=*\`
- Create: \`POST {{rest}}/boards\` with JSON \`{"title","kind","content","tags"}\` and header \`Prefer: return=representation\`
- Change: \`PATCH {{rest}}/boards?id=eq.<id>\` with the fields that change
- Delete: \`DELETE {{rest}}/boards?id=eq.<id>\`
- Share: \`POST {{rest}}/rpc/share_board\` with JSON \`{"board_id"}\`; returns \`[board]\` with \`share_token\` filled in. Give the user the link \`{{shareLink}}\`.
- Stop sharing: \`POST {{rest}}/rpc/unshare_board\` with JSON \`{"board_id"}\`; the link stops working.

Sessions and this document are described at {{openapi}}.
`;
