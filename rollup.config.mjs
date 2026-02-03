import { defineConfig } from "rollup";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import external from "rollup-plugin-peer-deps-external";
import json from "@rollup/plugin-json";
import { terser } from "rollup-plugin-terser";
import typescript from "@rollup/plugin-typescript";

export default defineConfig([
  {
    input: "./src/server/index.ts",
    output: [
      {
        file: "./dist/server/index.js",
        format: "cjs",
        sourcemap: false,
      },
    ],
    plugins: [
      json(),
      external(),
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
      }),
      terser({
        format: {
          comments: false,
        },
        compress: true,
      }),
    ],
  },
  {
    input: "./src/client/index.ts",
    output: [
      {
        file: "./dist/client/index.js",
        format: "cjs",
        sourcemap: false,
      },
    ],
    plugins: [
      json(),
      external(),
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
      }),
      terser({
        format: {
          comments: false,
        },
        compress: true,
      }),
    ],
  },
]);
