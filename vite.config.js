import { viteStaticCopy } from "vite-plugin-static-copy";
import { defineConfig, transformWithEsbuild } from "vite";

const config = defineConfig(({ command }) => {
  const plugins = [];
  switch (command) {
    case "build":
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
      break;
    case "serve":
      plugins.push([
        {
          name: "handlebars-json-hmr",
          apply: "serve",
          handleHotUpdate({file, server}) {
            if (file.startsWith("dist")) return;

            if (file.includes("lang/") && file.endsWith(".json")) {
              const basePath = file.slice(
                file.indexOf("lang/"),
              );
              server.hot.send({
                type: "custom",
                event: "lang-update",
                data: { path: `modules/combat-range-overlay/${basePath}` },
              });
            }

            if (file.includes("templates/") && file.endsWith(".hbs")) {
              const basePath = file.slice(
                file.indexOf("templates/"),
              );
              server.hot.send({
                type: "custom",
                event: "template-update",
                data: { path: `modules/combat-range-overlay/${basePath}` },
              });
            }
          },
        },
      ]);
      break;
  }

  return {
    base: command === "serve" ? "/modules/combat-range-overlay/" : "./",
    publicDir: "static",
    server: {
      port: 30001,
      open: "/",
      proxy: {
        "^(?!/modules/combat-range-overlay)": "http://localhost:30000/",
        "/socket.io": {
          target: "ws://localhost:30000",
          ws: true,
        },
      },
    },
    build: {
      sourcemap: true,
      minify: false,
      lib: {
        entry: "src/main.js",
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
