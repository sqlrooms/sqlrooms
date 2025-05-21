import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import {S3FileOrDirectory} from './S3FileOrDirectory';

export interface ListFilesOptions {
  /**
   * Whether to keep the prefix in the returned file keys
   * Default: false (for backward compatibility)
   */
  keepPrefix?: boolean;
}

export async function listFilesAndDirectoriesWithPrefix(
  S3: S3Client,
  bucket: string,
  prefix?: string,
  options?: ListFilesOptions
): Promise<S3FileOrDirectory[]> {
  const keepPrefix = options?.keepPrefix ?? false;
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix ? `${prefix}${prefix.endsWith('/') ? '' : '/'}` : '',
    Delimiter: '/',
  });

  const response = await S3.send(command);

  const objects: S3FileOrDirectory[] = [];

  const formatKey = (key: string) => {
    if (keepPrefix || !prefix) {
      return key;
    }
    return key.replace(prefix ?? '', '');
  };

  if (response.CommonPrefixes) {
    for (const commonPrefix of response.CommonPrefixes) {
      if (commonPrefix.Prefix) {
        // Extract the directory name from the CommonPrefixes
        const directoryKey = keepPrefix 
          ? commonPrefix.Prefix.slice(0, -1) // Remove trailing slash but keep prefix
          : formatKey(commonPrefix.Prefix).slice(0, -1); // Remove prefix and trailing slash
        objects.push({key: directoryKey, isDirectory: true});
      }
    }
  }

  if (response.Contents) {
    for (const content of response.Contents) {
      const key = content.Key;
      if (key) {
        // Exclude subdirectories by checking if the Key ends with '/'
        if (!key.endsWith('/')) {
          const fileName = formatKey(key);

          const headCommand = new HeadObjectCommand({
            Bucket: bucket,
            Key: key,
          });

          const headResponse = await S3.send(headCommand);

          objects.push({
            key: fileName,
            isDirectory: false,
            lastModified: content.LastModified,
            size: content.Size,
            contentType: headResponse.ContentType,
          });
        }
      }
    }
  }

  return objects;
}

// async function listBucketContents(
//   prefix: string,
// ): Promise<ListObjectsCommandOutput> {
//   if (!prefix.length) {
//     throw new Error('Prefix cannot be empty');
//   }
//   const listObjectsCommand = new ListObjectsCommand({
//     Bucket: S3_BUCKET_NAME,
//     Prefix: `${prefix}/`,
//   });
//   const response = await S3.send(listObjectsCommand);
//   return response;
// }

/**
 * Delete all files with the given prefix
 * @param prefix
 */
// export async function deleteS3Files(
//   S3: S3Client,
//   bucket: string,
//   prefix: string,
// ) {
//   const data = await S3.send(
//     new ListObjectsCommand({Bucket: bucket, Prefix: `${prefix}/`}),
//   );
//   if (data.Contents?.length) {
//     for (const obj of data.Contents) {
//       await S3.send(new DeleteObjectCommand({Bucket: bucket, Key: obj.Key}));
//     }
//   }
// }
