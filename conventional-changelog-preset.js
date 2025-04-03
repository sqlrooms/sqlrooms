export default {
  types: [
    {type: 'feat', section: 'Features', hidden: false},
    {type: 'fix', section: 'Bug Fixes', hidden: false},
    {type: 'perf', section: 'Performance Improvements', hidden: false},
    {type: 'refactor', section: 'Code Refactoring', hidden: false},
    {type: 'docs', section: 'Documentation', hidden: true},
    {type: 'style', section: 'Styles', hidden: true},
    {type: 'chore', section: 'Chores', hidden: true},
    {type: 'test', section: 'Tests', hidden: true},
    {type: 'build', section: 'Build System', hidden: true},
    {type: 'ci', section: 'Continuous Integration', hidden: true},
  ],
  // Which commit types trigger which version bumps
  // NOTE: list of commits that trigger an automatic version bump must also be adjusted in npm-publish.yml
  releaseRules: [
    {type: 'feat', release: 'minor'},
    {type: 'fix', release: 'patch'},
    {type: 'perf', release: 'patch'},
    {type: 'refactor', release: 'patch'},
    {type: 'build', release: 'patch'},
    {type: 'chore', release: false},
    {type: 'docs', release: false},
    {type: 'style', release: false},
    {type: 'test', release: false},
    {type: 'ci', release: false},
  ],
  parserOpts: {
    noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES'],
  },
  writerOpts: {
    groupBy: 'type',
    commitGroupsSort: 'title',
    commitsSort: ['scope', 'subject'],
    noteGroupsSort: 'title',
    mainTemplate: '{{> header}}{{> commits}}{{> footer}}',
    headerPartial: '# {{version}}\n\n',
    commitPartial:
      '* {{#if scope}}**{{scope}}:** {{/if}}{{subject}} {{#if hash}}([{{shortHash}}]({{commitUrlFormat}})){{/if}}\n',
    footerPartial: '{{> notes}}',
  },
};
