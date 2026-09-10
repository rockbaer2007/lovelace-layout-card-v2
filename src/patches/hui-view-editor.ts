import { LAYOUT_CARD_SELECTOR_OPTIONS } from "../helpers";

const dashboardLayoutCardV2PatchFlag = "_dashboardLayoutCardV2Patched";
const dashboardLayoutCardV2SchemaPatchFlag = "_dashboardLayoutCardV2SchemaPatched";
const dashboardLayoutCardV2SelectorPatchFlag = "_dashboardLayoutCardV2SelectorPatched";
const homeAssistantViewLayouts = new Set(["sections", "masonry", "sidebar", "panel"]);

function appendLayoutCardV2Options(schemaEntry: any) {
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
}

function patchSchemaProvider(target: any) {
  if (!target || target[dashboardLayoutCardV2SchemaPatchFlag] || typeof target._schema !== "function") return;

  const originalSchema = target._schema;
  target._schema = function (...args) {
    const retval = originalSchema.apply(this, args);
    const typeSelector = retval?.find?.((entry) => entry.name === "type");
    appendLayoutCardV2Options(typeSelector);

    if (retval?.find?.((entry) => entry.name === "layout") === undefined) {
      retval.push({
        name: "layout",
        selector: { object: {} },
      });
    }
    return retval;
  };
  target[dashboardLayoutCardV2SchemaPatchFlag] = true;
}

function appendHelpText(editor: any) {
  if (!editor?.shadowRoot || editor.shadowRoot.querySelector(".dashboard-layout-card-v2-help")) return;
  const helpLink = document.createElement("p");
  helpLink.className = "dashboard-layout-card-v2-help";
  helpLink.innerHTML = `
    Dashboard Layout Card V2 adds extra layout choices without replacing Home Assistant or original layout-card entries.
    <style>
      .dashboard-layout-card-v2-help {padding: 16px 0 0; margin-bottom: 0;}
      .dashboard-layout-card-v2-help {color: var(--secondary-text-color);}
    </style>
  `;
  editor.shadowRoot.appendChild(helpLink);
}

function patchViewEditorInstance(editor: any) {
  patchSchemaProvider(editor);
  appendHelpText(editor);
  editor?.requestUpdate?.();
}

function patchSelectSelectorInstance(selectorElement: any) {
  const options = selectorElement?.selector?.select?.options;
  if (!Array.isArray(options)) return;

  const values = new Set(options.map((option) => option?.value ?? option));
  const hasHomeAssistantViewLayouts = Array.from(homeAssistantViewLayouts).every((value) =>
    values.has(value)
  );
  if (!hasHomeAssistantViewLayouts) return;

  appendLayoutCardV2Options({ selector: selectorElement.selector });
  selectorElement._getOptions?.cache?.clear?.();
  selectorElement.requestUpdate?.();
}

function patchSelectSelectorClass() {
  const SelectSelector = customElements.get("ha-selector-select") as any;
  if (!SelectSelector?.prototype || SelectSelector.prototype[dashboardLayoutCardV2SelectorPatchFlag]) return;

  SelectSelector.prototype[dashboardLayoutCardV2SelectorPatchFlag] = true;
  const connectedCallback = SelectSelector.prototype.connectedCallback;
  SelectSelector.prototype.connectedCallback = function () {
    connectedCallback?.bind(this)();
    patchSelectSelectorInstance(this);
  };

  const willUpdate = SelectSelector.prototype.willUpdate;
  SelectSelector.prototype.willUpdate = function (...args) {
    patchSelectSelectorInstance(this);
    willUpdate?.apply(this, args);
  };
}

function collectElementsDeep(root: Document | ShadowRoot | Element, selector: string, result: Element[] = []) {
  if (root instanceof Element && root.matches(selector)) {
    result.push(root);
  }
  if ("querySelectorAll" in root) {
    result.push(...Array.from(root.querySelectorAll(selector)));
    for (const element of Array.from(root.querySelectorAll("*"))) {
      if ((element as HTMLElement).shadowRoot) {
        collectElementsDeep((element as HTMLElement).shadowRoot, selector, result);
      }
    }
  }
  return result;
}

function patchExistingViewEditors() {
  for (const editor of collectElementsDeep(document, "hui-view-editor")) {
    patchViewEditorInstance(editor);
  }
  for (const selector of collectElementsDeep(document, "ha-selector-select")) {
    patchSelectSelectorInstance(selector);
  }
}

customElements.whenDefined("hui-view-editor").then(() => {
  const HuiViewEditor = customElements.get("hui-view-editor") as any;

  patchSchemaProvider(HuiViewEditor.prototype);

  if (HuiViewEditor.prototype[dashboardLayoutCardV2PatchFlag]) {
    patchExistingViewEditors();
    return;
  }
  HuiViewEditor.prototype[dashboardLayoutCardV2PatchFlag] = true;

  const firstUpdated = HuiViewEditor.prototype.firstUpdated;
  HuiViewEditor.prototype.firstUpdated = function () {
    firstUpdated?.bind(this)();
    patchViewEditorInstance(this);
  };

  patchExistingViewEditors();
});

customElements.whenDefined("ha-selector-select").then(() => {
  patchSelectSelectorClass();
  patchExistingViewEditors();
});

const viewEditorObserver = new MutationObserver(() => patchExistingViewEditors());
viewEditorObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});
