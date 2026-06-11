<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/icons/lepapier-dark.svg">
    <img src="public/assets/icons/lepapier.svg" alt="Lepapier logo" width="96">
  </picture>
</p>

# Lepapier

Lepapier is a local-first writing tool for Markdown documents. It keeps drafts in the browser, stores selected images locally, opens existing document folders, and exports portable document folders as ZIP files.

## Development

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## Product shape

- Vite serves and bundles the standalone app.
- The editor remains a vanilla DOM app so browser-native APIs such as IndexedDB, File System Access, clipboard images, and Chrome built-in AI stay direct.
- Draft text is saved in `localStorage`; selected image files and editable folder handles are saved in IndexedDB.
- Exported ZIP files contain one folder per document with `index.md` and any referenced images.
