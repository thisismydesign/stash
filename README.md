# Stash

Personal notepad: boards, notes, lists and pages. Notion, Obsidian and Notes all in one.

Tell your agent what is on your mind; it files it on the right board. Open Stash to see what matters next.

[Use it live](https://stash.thisismydesign.io) or [deploy your own](docs/deploy.md).

## Boards

A board has a title and colour-coded tags. Pinned boards sit on top; archived ones stay out of the way until asked for. The view, the tag filter and the archive switch live behind one button beside the search.

<p>
  <img src="docs/screenshots/boards.png" alt="Boards as tiles" width="300">
  <img src="docs/screenshots/filters.png" alt="View and filters" width="300">
</p>

Boards also show as a list, and each board's menu pins, archives or deletes it, and gives it a picture: a file of your own or a link.

<p>
  <img src="docs/screenshots/list.png" alt="Boards as a list" width="300">
  <img src="docs/screenshots/menu.png" alt="A board's menu" width="300">
</p>

A new board is a page, Markdown or a table. A page starts from a template: blank, a to-do, a mood board of pictures, a comparison, a recipe or a timeline.

### To-do

A Markdown task list. Tick an item and it moves under *Done*; untick it and it comes back. Items may nest, hold links, and be grouped under headings. Edit it as you see it, or as Markdown source.

<p>
  <img src="docs/screenshots/todo.png" alt="A to-do board" width="300">
  <img src="docs/screenshots/todo-done.png" alt="The same board with an item ticked" width="300">
</p>

### Markdown

Free-form notes, rendered. Edit them as you see them, or switch to the Markdown source.

<p>
  <img src="docs/screenshots/markdown.png" alt="A Markdown board" width="300">
  <img src="docs/screenshots/edit.png" alt="Editing a board" width="300">
</p>

### Page

A page of your own, rendered in a sandbox: mood boards, comparisons, anything with images, links and a little script. Your agent writes and changes it; the templates give it a shape.

<p>
  <img src="docs/screenshots/html.png" alt="A page" width="300">
</p>

### Table

Records with typed columns: text, number, date, checkbox, choice or link. Tap a cell to change it, a heading to sort, filter by text, choice, checkbox or date range, and the numbers add up at the bottom. The menu downloads it as CSV. Your agent adds a row with one request, and the database turns away a cell that does not fit its column.

### Sharing

A board's menu shares it: a link that shows the board, read-only, to anyone who has it. Turn sharing off and the link stops working.

## Agents

An agent can sign you up, then reads and writes every board through the REST API with an agent key you make under *Agent keys*. The instructions it needs are served at `/llms.txt`.

## Running it

See [`AGENTS.md`](AGENTS.md) for commands and [`docs/deploy.md`](docs/deploy.md) to deploy your own.
