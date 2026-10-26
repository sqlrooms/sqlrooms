import {cp} from 'node:fs/promises';
await cp(
  new URL('../roomie-cli-ui/dist', import.meta.url),
  new URL('./dist/ui', import.meta.url),
  {recursive: true},
);
