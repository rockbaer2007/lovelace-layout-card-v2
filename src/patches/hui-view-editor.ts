import { LAYOUT_CARD_SELECTOR_OPTIONS } from "../helpers";

customElements.whenDefined("hui-view-editor").then(() => {
  const HuiViewEditor = customElements.get("hui-view-editor");

  if (HuiViewEditor.prototype._dashboardLayoutCardV2Patched) return;
  HuiViewEditor.prototype._dashboardLayoutCardV2Patched = true;

  const appendLayoutCardV2Options = (schemaEntry: any) => {
    const selector = schemaEntry?.selector;
    const optionContainers = [
      selector?.select,
      selector?.radio,
    ].filter((container) => Array.isArray(container?.options));

    for (const container of optionContainers) {
      const existingValues = new Set(container.options.map((option) => option.value));
      const missingOptions = LAYOUT_CARD_SELECTOR_OPTIONS.filter(
        (option) => !existingValues.has(option.value)
      );
      if (missingOptions.length) {
        container.options = [...container.options, ...missingOptions];
      }
    }
  };

  const firstUpdated = HuiViewEditor.prototype.firstUpdated;
  HuiViewEditor.prototype.firstUpdated = function () {
    firstUpdated?.bind(this)();

    this._oldSchema = this._schema;
    this._schema = (...arg) => {
      const retval = this._oldSchema(...arg);
      const typeSelector = retval.find((e) => e.name == "type");
      appendLayoutCardV2Options(typeSelector);

      if (retval.find((e) => e.name === "layout") === undefined)
        retval.push({
          name: "layout",
          selector: { object: {} },
        });
      return retval;
    };

    if (!this.shadowRoot.querySelector(".dashboard-layout-card-v2-help")) {
      const helpLink = document.createElement("p");
      helpLink.className = "dashboard-layout-card-v2-help";
      helpLink.innerHTML = `
        Dashboard Layout Card V2 adds extra layout choices without replacing Home Assistant or original layout-card entries.
        <style>
          .dashboard-layout-card-v2-help {padding: 16px 0 0; margin-bottom: 0;}
          .dashboard-layout-card-v2-help {color: var(--secondary-text-color);}
        </style>
      `;
      this.shadowRoot.appendChild(helpLink);
    }
    this.requestUpdate();
  };
});
