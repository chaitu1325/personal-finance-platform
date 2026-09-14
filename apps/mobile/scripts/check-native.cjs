const { buildEnvironment } = require('./native-config.cjs');

try {
  const build = buildEnvironment(process.env);
  console.log('Native build:', JSON.stringify({ ...build, commit: process.env.GITHUB_SHA || 'local' }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
