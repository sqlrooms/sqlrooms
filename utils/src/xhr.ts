export const postData = async ({
  url,
  data,
}: {
  url: string;
  data?: Record<string, any>;
}) => {
  const res: Response = await fetch(url, {
    method: 'POST',
    headers: new Headers({'Content-Type': 'application/json'}),
    credentials: 'same-origin',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    console.error('Error in postData', {url, data, res});
    let message = res.statusText;
    try {
      message = (await res.json()).error.message;
      console.error(message);
    } finally {
      throw new Error(message);
    }
  }

  return res.json();
};

export type ProgressInfo = {loaded: number; total: number; ratio: number};

// TODO: use range requests to download in chunks
// https://github.com/duckdb/duckdb-wasm/blob/d9ea9c919b6301e7c6dc8a9b3fd527e86f69a38e/packages/duckdb-wasm/src/bindings/runtime_browser.ts#L307

export async function downloadFile(
  url: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    onProgress?: (info: ProgressInfo) => void;
  } = {},
): Promise<Uint8Array> {
  const {method = 'GET', headers = {}, onProgress} = opts;
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // https://www.html5rocks.com/en/tutorials/file/xhr2/#toc-bin-data
    xhr.open(method, url, true);
    xhr.responseType = 'arraybuffer';
    Object.keys(headers).map((key) => {
      xhr.setRequestHeader(key, headers[key]);
    });

    xhr.onload = () => resolve(new Uint8Array(xhr.response));

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status >= 200 && xhr.status < 300) {
          // already handled by onload
        } else {
          reject({status: xhr.status, error: `File download failed`});
        }
      }
    };
    xhr.onerror = () =>
      reject({status: xhr.status, error: `File download failed`});

    if (onProgress) {
      xhr.onprogress = (event) => {
        const {lengthComputable, loaded, total} = event;
        if (lengthComputable) {
          onProgress({loaded, total, ratio: total ? loaded / total : 0});
        }
      };
    }
    xhr.send(null);
  });
}

// TODO: upload in chunks https://www.html5rocks.com/en/tutorials/file/xhr2/

export async function uploadFile(
  url: string,
  content: File | Blob | FormData,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    onProgress?: (info: ProgressInfo) => void;
  } = {},
): Promise<Response> {
  const {method = 'POST', headers = {}, onProgress} = opts;
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    Object.keys(headers).map((key) => {
      xhr.setRequestHeader(key, headers[key]);
    });
    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response);
        } else {
          reject({
            status: xhr.status,
            error: xhr.responseText,
          });
        }
      }
    };
    xhr.onerror = () => reject({status: xhr.status, error: xhr.responseText});
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        const {lengthComputable, loaded, total} = event;
        if (lengthComputable) {
          onProgress({loaded, total, ratio: total ? loaded / total : 0});
        }
      };
    }
    xhr.send(content);
  });
}
