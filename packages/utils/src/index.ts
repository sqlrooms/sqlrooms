/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {opacifyHex} from './color';

export {formatCount, formatCount4, formatCountShort, shorten} from './format';

export {
  NUMBER_FORMAT,
  formatNumber,
  formatDateTime,
  formatDate,
  formatTimeOfDay,
  formatTimeRelative,
  formatTimestampForFilename,
  getErrorMessageForDisplay,
} from './helpers';

export {isMacOS} from './browser';

export {genRandomStr} from './random';

export {formatBytes, camelCaseToTitle, capitalize, truncate} from './str';

export {postData, downloadFile, uploadFile, type ProgressInfo} from './xhr';

export {
  splitFilePath,
  convertToValidColumnOrTableName,
  convertToUniqueColumnOrTableName,
  generateUniqueName,
  generateUniquePath,
  convertToUniqueS3ObjectName,
  convertToUniqueS3FolderPath,
} from './filepaths';

export {safeJsonParse} from './json';
export {memoizeOnce} from './memoization';
export {
  isNegativeDecimal,
  negateDecimal,
  toDecimalString,
  toDecimalNumber,
  fromDecimalString,
} from './decimal';
