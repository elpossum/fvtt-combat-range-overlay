import globals from "globals";
import pluginJs from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import eslintConfigPrettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        foundry: "readonly",
        game: "readonly",
        ui: "readonly",
        Hooks: "readonly",
        Handlebars: "readonly",
        FormApplication: "readonly",
        CONST: "readonly",
        Dialog: "readonly",
        canvas: "readonly",
        PIXI: "readonly",
        ClipperLib: "readonly",
        ClipperPoint: "readonly",
        CONFIG: "readonly",
        Token: "readonly",
        FullCanvasObjectMixin: "readonly",
        FullCanvasContainer: "readonly",
        libWrapper: "readonly",
        Ray: "readonly",
        MeasuredTemplateDocument: "readonly",
        DrawingDocument: "readonly",
        HexagonalGrid: "readonly",
        Edge: "readonly",
        ClockwiseSweepPolygon: "readonly",
        Region: "readonly",
        NestedObject: "readonly",
        Item: "readonly",
        ActiveEffect: "readonly",
        AbstractBaseShader: "readonly",
        Terrain: "readonly",
      },
    },
  },
  globalIgnores(["dist/"]),
  pluginJs.configs.recommended,
  jsdoc.configs["flat/recommended"],
  eslintConfigPrettier,
]);
