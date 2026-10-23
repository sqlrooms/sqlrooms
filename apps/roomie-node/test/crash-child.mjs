import {openWorkspace, openMetadata} from '../dist/index.mjs';
const [directory, boundary] = process.argv.slice(2);
const host = await openWorkspace({
  directory,
  openMetadata: (path) => {
    const db = openMetadata(path);
    return {
      ...db,
      commit: async (value) => {
        if (boundary === 'after') await db.commit(value);
        process.exit(73);
      },
    };
  },
});
await host.mutate({
  commandId: 'block-document.create',
  operationId: 'create',
  principalId: 'owner',
  input: {
    title: 'A durable document',
    blocks: [{id: 'intro', type: 'paragraph', text: 'From Node'}],
  },
});
