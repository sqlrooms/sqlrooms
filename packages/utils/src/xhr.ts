/**
 * Posts data to a specified URL endpoint using fetch API
 * @param {Object} params - The parameters for the POST request
 * @param {string} params.url - The URL to send the POST request to
 * @param {Record<string, unknown>} [params.data] - Optional data to be sent in the request body
 * @returns {Promise<any>} The parsed JSON response from the server
 * @throws {Error} If the response is not ok, throws an error with the status message or error details
 */
export const postData = async ({
  url,
  data,
}: {
  url: string;
  data?: Record<string, unknown>;
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
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return res.json();
};

/**
 * Represents progress information for file operations
 */
export type ProgressInfo = {loaded: number; total: number; ratio: number};

// TODO: use range requests to download in chunks
// https://github.com/duckdb/duckdb-wasm/blob/d9ea9c919b6301e7c6dc8a9b3fd527e86f69a38e/packages/duckdb-wasm/src/bindings/runtime_browser.ts#L307

/**
 * Downloads a file from a specified URL using XMLHttpRequest
 * @param {string} url - The URL to download the file from
 * @param {Object} [opts] - Optional configuration for the download
 * @param {string} [opts.method='GET'] - The HTTP method to use
 * @param {Record<string, string>} [opts.headers] - Additional headers to include in the request
 * @param {(info: ProgressInfo) => void} [opts.onProgress] - Callback function to track download progress
 * @returns {Promise<Uint8Array>} The downloaded file as a Uint8Array
 * @throws {Object} Throws an object containing status and error message if download fails
 */
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
      if (headers[key]) {
        xhr.setRequestHeader(key, headers[key]);
      }
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

/**
 * Uploads a file to a specified URL using XMLHttpRequest
 * @param {string} url - The URL to upload the file to
 * @param {File | Blob | FormData} content - The content to upload
 * @param {Object} [opts] - Optional configuration for the upload
 * @param {string} [opts.method='POST'] - The HTTP method to use
 * @param {Record<string, string>} [opts.headers] - Additional headers to include in the request
 * @param {(info: ProgressInfo) => void} [opts.onProgress] - Callback function to track upload progress
 * @returns {Promise<Response>} The server response
 * @throws {Object} Throws an object containing status and error message if upload fails
 */
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
      if (headers[key]) {
        xhr.setRequestHeader(key, headers[key]);
      }
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
