export interface KeywordDoc {
  description: string;
  example?: string;
}

/** Lazily loads DuckDB keyword documentation from marimo-sql data files */
export const getKeywordDocs = async (): Promise<Record<string, KeywordDoc>> => {
  const [commonKeywords, duckdbKeywords] = await Promise.all([
    import('@marimo-team/codemirror-sql/data/common-keywords.json'),
    import('@marimo-team/codemirror-sql/data/duckdb-keywords.json'),
  ]);

  return {
    ...commonKeywords.default.keywords,
    ...duckdbKeywords.default.keywords,
  };
};
