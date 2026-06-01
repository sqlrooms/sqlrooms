import serverEntry from '@tanstack/react-start/server-entry';
import type {ServerEntry} from '@tanstack/react-start/server-entry';

const entry: ServerEntry = {
  fetch(request, opts) {
    return serverEntry.fetch(request, opts);
  },
};

export default entry;
