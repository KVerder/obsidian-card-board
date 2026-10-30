const webpack = require('webpack');
const path = require('path');
webpack({ mode: 'development', entry: path.resolve('tests/browser/bridge.ts'), output: { path: path.resolve('elm-stuff'), filename: 'smoke-bridge.js' }, resolve: { extensions: ['.ts','.js'], alias: { obsidian: path.resolve('tests/browser/obsidian.ts') } }, module: { rules: [{ test: /\.ts$/, use: { loader: 'ts-loader', options: { transpileOnly: true } } }] } }, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString()); process.exitCode = 1; } else console.log('Browser bridge built.');
});
