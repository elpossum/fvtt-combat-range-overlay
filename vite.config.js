import { viteStaticCopy } from "vite-plugin-static-copy";
import { defineConfig, transformWithEsbuild } from "vite";

const config = defineConfig(() => {
  const plugins = [];
  plugins.push([
    {
      name: "minify",
      renderChunk: {
        order: "post",
        handler: async (code, chunk) => {
          return chunk.fileName.endsWith(".js")
            ? transformWithEsbuild(code, chunk.fileName, {
                minify: true,
                sourcemap: true,
              })
            : code;
        },
      },
    },
    viteStaticCopy({
      targets: [
        {
          src: "CHANGELOG.md",
          dest: ".",
        },
        {
          src: "README.md",
          dest: ".",
        },
        {
          src: "LICENSE",
          dest: ".",
        },
      ],
    }),
  ]);

  return {
    base: "./",
    publicDir: "static",
    build: {
      sourcemap: true,
      minify: false,
      lib: {
        entry: "modules/main.js",
        formats: ["es"],
        fileName: "main",
      },
      rollupOptions: {
        output: {
          entryFileNames: "main.js",
          sourcemapExcludeSources: true,
        },
      },
      target: "es2022",
    },
    plugins,
  };
});

export default config;
