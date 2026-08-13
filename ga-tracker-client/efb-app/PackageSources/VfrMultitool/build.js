const copyStaticFiles = require('esbuild-copy-static-files');
const globalExternals = require('@fal-works/esbuild-plugin-global-externals');
const { typecheckPlugin } = require('@jgoz/esbuild-plugin-typecheck');
const esbuild = require('esbuild');
const postcss = require('postcss');
const postCssUrl = require('postcss-url');
const postcssPrefixSelector = require('postcss-prefix-selector');
const sassPlugin = require('esbuild-sass-plugin');
const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config({ path: `${__dirname}/.env` });

const servingMode = process.env.SERVING_MODE || '';
const efbE6bCompatPlugin = {
  name: 'efb-e6b-compat-assets',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length) return;
      const e6bSource = path.resolve(__dirname, '../../../../e6b');
      const e6bOutput = path.resolve(__dirname, 'dist/Assets/E6B');
      fs.mkdirSync(e6bOutput, { recursive: true });
      const front = fs.readFileSync(path.join(e6bSource, 'e6b-workbench-front-disc.json'), 'utf8').trim();
      const wind = fs.readFileSync(path.join(e6bSource, 'e6b-workbench-wind-disc.json'), 'utf8').trim();
      fs.writeFileSync(
        path.join(e6bOutput, 'e6b-efb-disc-data.js'),
        `window.GAE6B_EFB_DISCS={front:${front},wind:${wind}};\n`,
        'utf8'
      );
      const sourceHtml = fs.readFileSync(path.join(e6bSource, 'e6b-flight-computer.html'), 'utf8');
      const efbHtml = sourceHtml.replace(
        '<script src="./e6b-core.js',
        '<script src="./e6b-efb-disc-data.js"></script>\n    <script src="./e6b-core.js'
      );
      if (efbHtml === sourceHtml || !efbHtml.includes('e6b-efb-disc-data.js')) {
        throw new Error('EFB E6B preload could not be injected into e6b-flight-computer.html');
      }
      fs.writeFileSync(path.join(e6bOutput, 'e6b-flight-computer-efb.html'), efbHtml, 'utf8');
    });
  }
};

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
    copyStaticFiles({ src: '../../../../e6b', dest: './dist/Assets/E6B' }),
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
    typecheckPlugin({ watch: servingMode === 'WATCH' }),
    efbE6bCompatPlugin
  ]
};

if (servingMode === 'WATCH') {
  esbuild.context(baseConfig).then((context) => context.watch());
} else {
  esbuild.build(baseConfig);
}
