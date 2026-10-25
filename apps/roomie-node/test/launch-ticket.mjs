import {readFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';

/** Mint a single-use link without printing the owner credential. */
export async function launchTicket({url, credentialPath}) {
  const {token} = JSON.parse(await readFile(credentialPath, 'utf8'));
  const response = await fetch(`${url}/api/auth/ticket`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
  });
  if (!response.ok)
    throw new Error(
      `Could not issue browser sign-in link (${response.status}).`,
    );
  return (await response.json()).url;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const directory = resolve(
    process.env.ROOMIE_M2_DIRECTORY ?? '/private/tmp/roomie-m2-acceptance',
  );
  const control = JSON.parse(
    await readFile(join(directory, 'control.json'), 'utf8'),
  );
  console.log(
    `Browser sign-in (single use, expires in 2 minutes): ${await launchTicket(control)}`,
  );
}
