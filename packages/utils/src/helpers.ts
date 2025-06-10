import {timeFormat} from 'd3-time-format';

import dayjs, {ConfigType} from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/**
 * Number formatter instance configured for US locale with no minimum fraction digits
 */
export const NUMBER_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
});

/**
 * Formats a number using US locale formatting
 * @param n - Number to format
 * @returns Formatted number string
 * @example
 * ```ts
 * formatNumber(1234567.89); // "1,234,568"
 * ```
 */
export const formatNumber = (n: number) => NUMBER_FORMAT.format(n);

const TIME_OF_DAY_FORMAT = timeFormat('%I:%M %p');
const DATE_TIME_FORMAT = timeFormat('%a %Y-%m-%d %I:%M %p');
const DATE_FORMAT = timeFormat('%Y-%m-%d');

/**
 * Formats a date into a human-readable datetime string
 * @param d - Date to format (can be Date object, timestamp number, or bigint)
 * @returns Formatted string in "Day YYYY-MM-DD HH:MM AM/PM" format
 * @example
 * ```ts
 * formatDateTime(new Date()); // e.g., "Wed 2024-03-13 02:30 PM"
 * ```
 */
export const formatDateTime = (d: Date | number | bigint) => {
  const date = d instanceof Date ? d : new Date(Number(d));
  return DATE_TIME_FORMAT(date);
};

/**
 * Formats a date into YYYY-MM-DD format
 * @param d - Date to format (can be Date object, timestamp number, or bigint)
 * @returns Formatted date string
 * @example
 * ```ts
 * formatDate(new Date()); // e.g., "2024-03-13"
 * ```
 */
export const formatDate = (d: Date | number | bigint) => {
  const date = d instanceof Date ? d : new Date(Number(d));
  return DATE_FORMAT(date);
};

/**
 * Formats a date into time of day (HH:MM AM/PM)
 * @param d - Date to format (can be Date object, timestamp number, or bigint)
 * @returns Formatted time string
 * @example
 * ```ts
 * formatTimeOfDay(new Date()); // e.g., "02:30 PM"
 * ```
 */
export const formatTimeOfDay = (d: Date | number | bigint) => {
  const date = d instanceof Date ? d : new Date(Number(d));
  return TIME_OF_DAY_FORMAT(date);
};

/**
 * Formats a date relative to the current time (e.g., "2 hours ago", "in 3 days")
 * @param d - Date to format (accepts any dayjs ConfigType)
 * @returns Human-readable relative time string
 * @example
 * ```ts
 * formatTimeRelative(new Date(Date.now() - 3600000)); // "1 hour ago"
 * ```
 */
export const formatTimeRelative = (d: ConfigType) => {
  return dayjs().to(d);
};

/**
 * Formats the current timestamp for use in filenames (filesystem-safe)
 * @returns Timestamp string in YYYY-MM-DDTHH-mm-ss format
 * @example
 * ```ts
 * formatTimestampForFilename(); // "2024-03-13T14-30-25"
 * ```
 */
export const formatTimestampForFilename = () => {
  return dayjs().format('YYYY-MM-DDTHH-mm-ss');
};

/**
 * Extracts and formats an error message for display, removing common prefixes and truncating at first newline
 * @param e - Error object or any other value that can be converted to string
 * @returns Cleaned up error message string
 * @example
 * ```ts
 * getErrorMessageForDisplay(new Error("Query failed: Error: Invalid syntax\nMore details...")); // "Invalid syntax"
 * ```
 */
export const getErrorMessageForDisplay = (e: unknown) => {
  let msg = e instanceof Error ? e.message : String(e);
  msg = msg.replace(/Query failed: Error: /, '');
  const firstNl = msg.indexOf('\n');
  return firstNl >= 0 ? msg.substring(0, firstNl) : msg;
};
