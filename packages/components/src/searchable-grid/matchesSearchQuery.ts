import {defaultMemoize} from 'reselect';

export const splitIntoWords = (str: string) => {
  // https://stackoverflow.com/a/25575009/120779
  return str
    .toLowerCase()

    .match(
      /([^\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~\s]+)/g,
    );
};
const memoizedSplitIntoWords = defaultMemoize(splitIntoWords);

/**
 * Checks whether the text matches the query. Both are split into words.
 * Returns true if for each query word there is a word in the text which
 * begins with it. Case-insensitive.
 */
export function matchesSearchQuery(query: string, text: string) {
  const queryWords = memoizedSplitIntoWords(query);
  if (!queryWords) {
    return false;
  }
  return matchesSearchWords(queryWords, text);
}

export function matchesSearchWords(queryWords: string[], text: string) {
  if (!queryWords || queryWords.length === 0) {
    return true;
  }
  const startsWith = (queryWord: string, textWord: string) =>
    textWord.indexOf(queryWord) === 0;
  const textWords = splitIntoWords(text);
  if (!textWords || textWords.length === 0) {
    return false;
  }
  const hasMatch = (queryWord: string) => {
    for (const w of textWords) {
      if (startsWith(queryWord, w)) {
        return true;
      }
    }
    return false;
  };

  for (const q of queryWords) {
    if (!hasMatch(q)) {
      return false;
    }
  }
  return true;
}
