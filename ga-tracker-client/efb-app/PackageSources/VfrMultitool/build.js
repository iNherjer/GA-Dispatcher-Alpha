const copyStaticFiles = require('esbuild-copy-static-files');
const globalExternals = require('@fal-works/esbuild-plugin-global-externals');
const { typecheckPlugin } = require('@jgoz/esbuild-plugin-typecheck');
const esbuild = require('esbuild');
const postcss = require('postcss');
const postCssUrl = require('postcss-url');
const postcssPrefixSelector = require('postcss-prefix-selector');
const sassPlugin = require('esbuild-sass-plugin');

require('dotenv').config({ path: `${__dirname}/.env` });

const servingMode = process.env.SERVING_MODE || '';
const baseConfig = {
  entryPoints: ['src/VfrMultitool.tsx'],
  keepNames: true,
  bundle: true,
  outdir: 'dist',
  loader: {
    '.png': 'dataurl'
  },
  sourcemap: process.env.SOURCE_MAPS === 'true',
  minify: process.env.MINIFY !== 'false',
  target: 'es2017',
  define: {
    BASE_URL: JSON.stringify('coui://html_ui/efb_ui/efb_apps/vfrmultitool'),
    EFB_APP_VERSION: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    TRACKER_API_URL: JSON.stringify(process.env.TRACKER_API_URL || 'http://127.0.0.1:49880')
  },
  plugins: [
    copyStaticFiles({ src: './src/Assets', dest: './dist/Assets' }),
    globalExternals.globalExternals({
      '@microsoft/msfs-sdk': { varName: 'msfssdk', type: 'cjs' }
    }),
    sassPlugin.sassPlugin({
      async transform(source) {
        const { css } = await postcss([
          postCssUrl({ url: 'copy' }),
          postcssPrefixSelector({ prefix: '.efb-view.vfrmultitool' })
        ]).process(source, { from: undefined });
        return css;
      }
    }),
    typecheckPlugin({ watch: servingMode === 'WATCH' })
  ]
};

if (servingMode === 'WATCH') {
  esbuild.context(baseConfig).then((context) => context.watch());
} else {
  esbuild.build(baseConfig);
}
