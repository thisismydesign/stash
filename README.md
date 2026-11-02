# Stash

Personal notepad: boards for notes, to-do lists and ideas, kept up to date by you and your AI agent.

Tell your agent what is on your mind; it files it on the right board. Open Stash to see what matters next.

## Boards

A board is a page with a title and colour-coded tags. Pinned boards sit on top; archived ones stay out of the way until asked for. The view, the tag filter and the archive switch live behind one button beside the search.

<p>
  <img src="docs/screenshots/boards.png" alt="Boards as tiles" width="300">
  <img src="docs/screenshots/filters.png" alt="View and filters" width="300">
</p>

Boards also show as a list, and each board's menu pins, archives or deletes it.

<p>
  <img src="docs/screenshots/list.png" alt="Boards as a list" width="300">
  <img src="docs/screenshots/menu.png" alt="A board's menu" width="300">
</p>

### To-do

A Markdown task list. Tick an item and it moves under *Done*; untick it and it comes back. Items may nest, hold links, and be grouped under headings.

<p>
  <img src="docs/screenshots/todo.png" alt="A to-do board" width="300">
  <img src="docs/screenshots/todo-done.png" alt="The same board with an item ticked" width="300">
</p>

### Markdown

Free-form notes, rendered. Edit the source in place.

<p>
  <img src="docs/screenshots/markdown.png" alt="A Markdown board" width="300">
  <img src="docs/screenshots/edit.png" alt="Editing a board" width="300">
</p>

### HTML

A page of your own, rendered in a sandbox: mood boards, comparisons, anything with images, links and a little script.

<p>
  <img src="docs/screenshots/html.png" alt="An HTML board" width="300">
</p>

### Sharing

A board's menu shares it: a link that shows the board, read-only, to anyone who has it. Turn sharing off and the link stops working.

## Agents

An agent can sign you up, then reads and writes every board through the REST API with an agent key you make under *Agent keys*. The instructions it needs are served at `/llms.txt`.

## Running it

See [`AGENTS.md`](AGENTS.md) for commands and [`docs/deploy.md`](docs/deploy.md) to deploy your own.
