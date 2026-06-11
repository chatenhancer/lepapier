# Lepapier

Lepapier is a local-first writing tool for Markdown posts. It keeps drafts in the browser, stores selected images locally, opens existing post folders, and exports portable post folders as ZIP files.

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
- Exported ZIP files contain one folder per post with `index.md` and any referenced images.
