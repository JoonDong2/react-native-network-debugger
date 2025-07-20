import { defineConfig } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import external from 'rollup-plugin-peer-deps-external';
import json from '@rollup/plugin-json'; 

export default defineConfig([
  {
    input: './src/dev-server/index.js',
    output: [
      {
        file: './dist/dev-server/index.js',
        format: 'cjs',
        sourcemap: false,
      },
    ],
    plugins: [
      json(),
      external({ includeDependencies: true }),
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
    ],
  },
  {
    input: './src/dev-client/index.js',
    output: [
      {
        file: './dist/dev-client/index.js',
        format: 'cjs',
        sourcemap: false,
      },
    ],
    plugins: [
      json(),
      external({ includeDependencies: true }),
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
    ],
  }
]);