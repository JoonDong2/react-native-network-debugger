import { defineConfig } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import external from 'rollup-plugin-peer-deps-external';
import json from '@rollup/plugin-json'; 

export default defineConfig([
  {
    input: './src/server/index.js',
    output: [
      {
        file: './dist/server/index.js',
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
    input: './src/client/index.js',
    output: [
      {
        file: './dist/client/index.js',
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