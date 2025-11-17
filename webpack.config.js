import path from 'path';
import { fileURLToPath } from 'url';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: 'production',
  entry: './src/cli/index.ts',
  target: 'node18',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    clean: true,
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
    new webpack.BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
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

