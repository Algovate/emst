import path from 'path';
import { fileURLToPath } from 'url';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: 'production',
  entry: {
    cli: './src/cli/index.ts',
    // Note: index.ts is compiled separately using TypeScript compiler
    // to ensure proper ES module exports (see build:api script)
  },
  target: 'node18',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: false, // Don't clean dist, preserve TypeScript-compiled files
    module: true,
    chunkFormat: 'module',
  },
  experiments: {
    outputModule: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
  plugins: [
    // Only add shebang to CLI entry
    new webpack.BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
      include: /cli\.js$/,
    }),
  ],
  externals: ({ request }, callback) => {
    // Puppeteer 相关依赖（需要原生模块，不应打包）
    const externals = [
      'puppeteer',
      'puppeteer-extra',
      'puppeteer-extra-plugin-stealth',
    ];
    
    if (externals.includes(request)) {
      // For ES modules, return the module name as-is
      // Node.js will resolve it from node_modules at runtime
      return callback(null, request);
    }
    
    callback();
  },
  optimization: {
    minimize: false,
  },
};

