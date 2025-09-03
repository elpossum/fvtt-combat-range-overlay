/** Not an actual hook listener but rather things to run on initial load */
export const Load = {
  listen() {
    /**
     * Rerender all AppV1 and AppV2 instances
     */
    function rerenderApps() {
      [
        ...Object.values(ui.windows),
        ...foundry.applications.instances.values(),
      ].forEach((app) => app.render());
    }

    // HMR for localization and template files
    if (import.meta.hot) {
      import.meta.hot.on("lang-update", async ({ path }) => {
        const lang = await foundry.utils.fetchJsonWithTimeout(path);
        /**
         * Merge language update with Foundry dictionary then rerender apps
         */
        function apply() {
          foundry.utils.mergeObject(game.i18n.translations, lang);
          rerenderApps();
        }
        if (game.ready) {
          apply();
        } else {
          Hooks.once("ready", apply);
        }
      });

      import.meta.hot.on("template-update", async ({ path }) => {
        /**
         * Replace updated template then rerender apps
         */
        async function apply() {
          delete Handlebars.partials[path];
          await foundry.applications.handlebars.getTemplate(path);
          rerenderApps();
        }
        if (game.ready) {
          apply();
        } else {
          Hooks.once("ready", apply);
        }
      });
    }
  },
};
