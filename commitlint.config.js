const customRules = {
  'body-required-for-types': (parsed) => {
    const typesRequiringBody = ['feat', 'fix', 'refactor', 'perf'];
    if (typesRequiringBody.includes(parsed.type)) {
      if (!parsed.body || parsed.body.trim().length === 0) {
        return [false, 'Body is required for commits of type: ' + typesRequiringBody.join(', ')];
      }
    }
    return [true];
  },
};

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-max-length': [2, 'always', 50],
    'scope-enum': [
      2,
      'always',
      [
        'cli',
        'client',
        'config',
        'core',
        'server',
        'tui',
        'docs',
        'scripts',
        'root',
      ],
    ],
    'body-required-for-types': [2, 'always'],
  },
  plugins: [
    {
      rules: customRules,
    },
  ],
};