declare module 'ember-cli/lib/broccoli/ember-app.js' {
  const EmberApp: new(defaults: unknown, options: { hinting: boolean; babel: { plugins: unknown[] } }) =>
    Parameters<typeof import('@embroider/compat').compatBuild>[0]
  export default EmberApp
}
