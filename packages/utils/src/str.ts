export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  let sizeValue = bytes / Math.pow(k, i);
  // Use floor to check if there's a non-zero fractional part, format accordingly
  sizeValue =
    sizeValue != Math.floor(sizeValue)
      ? parseFloat(sizeValue.toFixed(2))
      : Math.floor(sizeValue);

  return sizeValue + ' ' + sizes[i];
}

export function splitFilePath(filePath: string): {
  dir: string;
  name: string;
  ext: string;
} {
  const pathParts = filePath.split('/');
  const file = pathParts.pop() || '';

  const dotIndex = file.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === 0)
    return {dir: pathParts.join('/'), name: file, ext: ''};

  const name = file.substring(0, dotIndex);
  const ext = file.substring(dotIndex + 1);

  return {dir: pathParts.join('/'), name, ext};
}

export function convertToUniqueColumnOrTableName(
  filename: string,
  existingTables?: string[],
): string {
  // Remove file extension
  const base = filename.replace(/\.[^/.]+$/, '');

  // Replace any invalid character with underscore, and convert to lowercase
  let tableName = base.replace(/[^a-z0-9_]/gi, '_');

  // If the first character is a number, prepend an underscore
  if (/^\d/.test(tableName)) {
    tableName = '_' + tableName;
  }

  // Truncate to the max length 63
  if (tableName.length > 63) {
    tableName = tableName.substring(0, 63);
  }

  tableName = generateUniqueName(tableName, existingTables);

  return tableName;
}

export function generateUniqueName(name: string, usedNames?: string[]) {
  const usedNamesLower = usedNames?.map((n) => n.toLowerCase());

  // If tableName exists in the list
  if (usedNamesLower?.includes(name.toLowerCase())) {
    let baseName = name;
    let i = 0;

    // If tableName ends with `_${i}` pattern, update the baseTableName and i
    const matched = name.match(/^(.+)_(\d+)$/);
    if (matched) {
      baseName = matched[1];
      i = Number(matched[2]);
    }

    do {
      i++;
      name = `${baseName}_${i}`;
    } while (usedNamesLower.includes(name.toLowerCase()));
  }

  return name;
}

export function generateUniquePath(
  filePath: string,
  existingPaths: string[],
): string {
  let nextPath = filePath;
  if (existingPaths?.includes(filePath)) {
    const {dir, name, ext} = splitFilePath(filePath);

    let i = 0;
    let baseName = name;
    const matched = name.match(/^(.+)_(\d+)$/);
    if (matched) {
      baseName = matched[1];
      i = Number(matched[2]);
    }

    do {
      i++;
      const fname = `${baseName}_${i}${ext ? `.${ext}` : ''}`;
      nextPath = `${dir}${dir ? '/' : ''}${fname}`;
    } while (existingPaths.includes(nextPath));
  }

  return nextPath;
}

export function convertToUniqueS3ObjectName(
  str: string,
  existingObjects?: string[],
): string {
  let rv = str
    .trim() // Remove leading and trailing white spaces
    .replace(/[^\w\s-\.]/g, '_') // Replace special characters with underscores
    .replace(/\s+/g, '_') // Replace consecutive spaces with a single underscore
    // .replace(/_+/g, '_') // Remove consecutive underscores
    // .replace(/^_/, '') // Remove leading underscores
    // .replace(/_$/, '') // Remove trailing underscores
    .slice(0, 255); // Truncate the string if it exceeds 255 characters

  if (existingObjects?.length) {
    rv = generateUniquePath(rv, existingObjects);
  }

  return rv;
}

export function convertToUniqueS3FolderPath(
  str: string,
  existingObjects?: string[],
): string {
  let next = convertToUniqueS3ObjectName(str, existingObjects);
  if (!next.endsWith('/')) next += '/'; // Add trailing slash if not present
  return next;
  // return (
  //   str
  //     .trim() // Remove leading and trailing white spaces
  //     .replace(/\/+/g, '/') // Replace consecutive slashes with a single slash
  //     .replace(/[^\w\s-\/]/g, '_') // Replace special characters with underscores
  //     .replace(/\s+/g, '_') // Replace consecutive spaces with a single underscore
  //     .replace(/^\//, '') + // Remove leading slash
  //   (str.endsWith('/') ? '' : '/')
  // );
}

export function camelCaseToTitle(camelCase: string): string {
  // Split the string into words on the camelCase boundaries
  const words = camelCase.match(/^[a-z]+|[A-Z][a-z]*/g);

  // If words are found, transform them and join into a title string
  if (words) {
    return words
      .map((word) => {
        // Capitalize the first letter of each word
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' '); // Join the words with space
  }

  // If no words were found, just capitalize the whole string
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}
