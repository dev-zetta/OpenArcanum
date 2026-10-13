import { defineConfig } from 'vite'
import { extensions, classicEmberSupport, ember } from '@embroider/vite'
import { babel } from '@rollup/plugin-babel'

export default defineConfig({
  plugins: [
    classicEmberSupport(),
    ember(),
    babel({ babelHelpers: 'runtime', extensions }),
  ],
  css: { preprocessorOptions: { scss: {
    loadPaths: ['node_modules'],
    // Bootstrap 5 still ships its supported legacy Sass imports.
    quietDeps: true,
    silenceDeprecations: ['import'],
  } } },
})
