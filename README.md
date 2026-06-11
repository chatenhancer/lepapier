<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/icons/lepapier-dark.svg">
    <img src="public/assets/icons/lepapier.svg" alt="Lepapier logo" width="72">
  </picture>
</p>

# Lepapier.app

Lepapier (from French: le papier, "the paper") is a local-first Markdown writing app for drafting, editing, previewing, and exporting documents from the browser.

It is designed to serve as a quiet writing surface with the least distractions possible, while still handling the practical parts of publishing: frontmatter, images, Markdown previews, drafts, importing and exporting, syncing with local files, and portability.

It builds into a single `index.html` file that can be placed and opened anywhere.

## What’s it good for?
It was mainly developed to cleanly create, edit, and export Markdown archives for static *Astro* sites and blogs–but it can be used to edit any form of Markdown content.

## Feature list

- Local-first editing with drafts saved in the browser.

- Multi-document workspace with document selection, bulk download, and bulk delete.

- Open a Markdown file or a folder of Markdown files.

- Open and sync a Markdown file or folder using the File System Access API where supported.

- Import referenced image assets from opened folders.

- Add cover images and document images, then export them with Markdown.

- Download one document as `.md` when no assets are needed, or export documents and assets as a `.zip`.

- Live Markdown preview with editable preview text and image controls.

- Frontmatter fields for title, date, slug, description, tags, and cover image.

- Optional manual Chrome built-in AI metadata refresh buttons for title, description, and tags.

- Smart punctuation and image filename randomization options.

- PWA-ready standalone app built with Vite and vanilla DOM APIs.

## Development

Install dependencies:

```sh
npm install
```

Start the local dev server:

```sh
npm run dev
```

Run TypeScript checks:

```sh
npm run check
```

Run tests:

```sh
npm test
```

Build for production:

```sh
npm run build
```

Preview the production build:

```sh
npm run preview
```

## Architecture

- `Vite` serves and bundles the standalone app.

- The editor is a vanilla DOM app with direct access to browser-native APIs stay direct: IndexedDB, File System Access, clipboard images, PWA support, and Chrome built-in AI.

- Draft text is saved in `localStorage`; selected image files and editable file/folder handles are saved in IndexedDB.

- Exports are generated client-side as Markdown files or zip archives depending on selected documents and referenced assets.
