import {postData} from './xhr';

// TODO: this should live in app
export async function getSignedFileUrl(
  params:
    | {fname: string; upload?: boolean}
    | {projectId: string; fname: string; upload?: boolean; password?: string},
) {
  const {url: locationsUrl} = await postData({
    url: '/api/gen-signed-url',
    data: params,
  });
  return locationsUrl;
}
