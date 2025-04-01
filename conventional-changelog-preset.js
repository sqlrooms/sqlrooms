export default {
  types: [
    {type: 'feat', section: 'Features', hidden: false},
    {type: 'fix', section: 'Bug Fixes', hidden: false},
    {type: 'chore', section: 'Chores', hidden: true},
    {type: 'docs', section: 'Documentation', hidden: false},
    {type: 'style', section: 'Styles', hidden: false},
    {type: 'refactor', section: 'Code Refactoring', hidden: false},
    {type: 'perf', section: 'Performance Improvements', hidden: false},
    {type: 'test', section: 'Tests', hidden: false},
    {type: 'build', section: 'Build System', hidden: false},
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
};
