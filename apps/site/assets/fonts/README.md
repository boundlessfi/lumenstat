Inter and Inconsolata, latin subset, from the `@fontsource/inter` and `@fontsource/inconsolata` packages (5.3.0). Both are licensed under the SIL Open Font License 1.1.

They are read at build time by `app/opengraph-image.tsx`, which needs font files on disk. The page itself loads its fonts through `next/font`.
