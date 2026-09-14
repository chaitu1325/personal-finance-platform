function workflowOptions(env) {
  const selected = {};
  for (const [option, variable] of Object.entries({ android: 'PF_BUILD_ANDROID', ios: 'PF_BUILD_IOS', upload: 'PF_UPLOAD_TO_DRIVE' })) {
    if (!['true', 'false'].includes(env[variable])) throw new Error('Expected true or false for ' + variable);
    selected[option] = env[variable] === 'true';
  }
  if (!selected.android && !selected.ios) throw new Error('Select at least one platform: Android or iOS.');
  // iOS-only runs do not have Android files to upload, even if the upload box is checked.
  selected.upload = selected.upload && selected.android;
  if (selected.upload && (env.BUILD_EVENT !== 'workflow_dispatch' || env.BUILD_REF !== 'refs/heads/main')) {
    throw new Error('Drive uploads require a manual build from reviewed main. Uncheck upload_to_drive to build this branch.');
  }
  return selected;
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(workflowOptions(process.env)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { workflowOptions };
