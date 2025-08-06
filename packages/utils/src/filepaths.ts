/**
 * Splits a file path into its directory, name, and extension components.
 * Preserves the original path separator style (Windows backslashes or Unix forward slashes).
 * @param filePath - The full file path to split
 * @returns An object containing the directory path, file name (without extension), extension, and full filename
 * @example
 * splitFilePath("path/to/file.txt") // returns { dir: "path/to", name: "file", ext: "txt", filename: "file.txt" }
 * splitFilePath("C:\\Users\\file.txt") // returns { dir: "C:\\Users", name: "file", ext: "txt", filename: "file.txt" }
 */
export function splitFilePath(filePath: string): {
  dir: string;
  name: string;
  ext: string;
  filename: string;
} {
  // If backslash appears, assume Windows filesystem (backslash is not a valid path separator on Unix)
  const separator = filePath.includes('\\') ? '\\' : '/';

  // Handle both Windows backslashes and Unix forward slashes
  const pathParts = filePath.split(/[/\\]/);
  const file = pathParts.pop() || '';

  const dotIndex = file.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === 0)
    return {
      dir: pathParts.join(separator),
      name: file,
      ext: '',
      filename: file,
    };

  const name = file.substring(0, dotIndex);
  const ext = file.substring(dotIndex + 1);

  return {
    dir: pathParts.join(separator),
    name,
    ext,
    filename: file,
  };
}

/**
 * Converts a filename into a valid column or table name for database use.
 * - Removes file extension
 * - Replaces invalid characters with underscores
 * - Ensures the name starts with a letter or underscore
 * - Truncates to max length of 63 characters
 *
 * @param filename - The original filename to convert
 * @returns A valid table/column name
 * @example
 * convertToValidColumnOrTableName("my-file.csv") // returns "my_file"
 * convertToValidColumnOrTableName("123data.csv") // returns "_123data"
 */
export function convertToValidColumnOrTableName(filename: string): string {
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

  return tableName;
}

/**
 * Converts a filename into a valid and unique column or table name for database use.
 * - Removes file extension
 * - Replaces invalid characters with underscores
 * - Ensures the name starts with a letter or underscore
 * - Truncates to max length of 63 characters
 * - Ensures uniqueness among existing names
 *
 * @param filename - The original filename to convert
 * @param existingTables - Optional array of existing table names to ensure uniqueness
 * @returns A valid and unique table/column name
 * @example
 * convertToUniqueColumnOrTableName("my-file.csv") // returns "my_file"
 * convertToUniqueColumnOrTableName("123data.csv") // returns "_123data"
 */
export function convertToUniqueColumnOrTableName(
  filename: string,
  existingTables?: string[],
): string {
  const tableName = convertToValidColumnOrTableName(filename);
  return generateUniqueName(tableName, existingTables);
}

/**
 * Generates a unique name by appending a numeric suffix if the name already exists.
 * @param name - The base name to make unique
 * @param usedNames - Optional array of existing names to check against
 * @returns A unique name, potentially with a numeric suffix
 * @example
 * generateUniqueName("table", ["table"]) // returns "table_1"
 * generateUniqueName("table_1", ["table_1"]) // returns "table_2"
 */
export function generateUniqueName(name: string, usedNames?: string[]) {
  const usedNamesLower = usedNames?.map((n) => n.toLowerCase());

  // If tableName exists in the list
  if (usedNamesLower?.includes(name.toLowerCase())) {
    let baseName: string | undefined = name;
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

/**
 * Generates a unique file path by appending a numeric suffix if the path already exists.
 * @param filePath - The original file path
 * @param existingPaths - Array of existing file paths to check against
 * @returns A unique file path
 * @example
 * generateUniquePath("file.txt", ["file.txt"]) // returns "file_1.txt"
 */
export function generateUniquePath(
  filePath: string,
  existingPaths: string[],
): string {
  let nextPath = filePath;
  if (existingPaths?.includes(filePath)) {
    const {dir, name, ext} = splitFilePath(filePath);

    let i = 0;
    let baseName: string | undefined = name;
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

/**
 * Converts a string into a valid and unique S3 object name.
 * - Replaces special characters with underscores
 * - Ensures name is within S3's length limits
 * - Ensures uniqueness among existing objects
 *
 * @param str - The string to convert into an S3 object name
 * @param existingObjects - Optional array of existing S3 object names to ensure uniqueness
 * @returns A valid and unique S3 object name
 * @example
 * convertToUniqueS3ObjectName("my file.txt") // returns "my_file.txt"
 */
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

/**
 * Converts a string into a valid and unique S3 folder path.
 * - Ensures the path ends with a forward slash
 * - Replaces special characters with underscores
 * - Ensures uniqueness among existing paths
 *
 * @param str - The string to convert into an S3 folder path
 * @param existingObjects - Optional array of existing S3 paths to ensure uniqueness
 * @returns A valid and unique S3 folder path ending with a forward slash
 * @example
 * convertToUniqueS3FolderPath("my folder") // returns "my_folder/"
 */
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
