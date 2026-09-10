import { html } from "lit";
import { LAYOUT_CARD_SELECTOR_OPTIONS } from "../helpers";
import { showDashboardLayoutV2ViewDialog } from "../dashboard-layout-view-dialog";

const dashboardLayoutCardV2PatchFlag = "_dashboardLayoutCardV2Patched";
const dashboardLayoutCardV2SchemaPatchFlag = "_dashboardLayoutCardV2SchemaPatched";
const dashboardLayoutCardV2SelectorPatchFlag = "_dashboardLayoutCardV2SelectorPatched";
const dashboardLayoutCardV2RootPatchFlag = "_dashboardLayoutCardV2RootPatched";
const homeAssistantViewLayouts = new Set(["sections", "masonry", "sidebar", "panel"]);
const dashboardLayoutCardV2ViewLayouts = new Set(
  LAYOUT_CARD_SELECTOR_OPTIONS.map((option) => option.value)
);
const dashboardLayoutCardV2Icon =
  "M3 3h8v8H3V3m10 0h8v8h-8V3M3 13h8v8H3v-8m10 0h8v8h-8v-8z";

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

function getCurrentView(root: any) {
  const viewIndex = root?._curView;
  if (typeof viewIndex !== "number") return undefined;
  const viewConfig = root?.lovelace?.config?.views?.[viewIndex];
  return viewConfig ? { viewIndex, viewConfig } : undefined;
}

function hasDashboardLayoutV2View(root: any) {
  const currentView = getCurrentView(root);
  if (!currentView) return false;
  return dashboardLayoutCardV2ViewLayouts.has(currentView.viewConfig?.type);
}

function openDashboardLayoutV2Dialog(root: any) {
  const currentView = getCurrentView(root);
  if (!currentView || !root?.lovelace) return;
  showDashboardLayoutV2ViewDialog(root, {
    hass: root.hass,
    lovelace: root.lovelace,
    viewIndex: currentView.viewIndex,
    viewConfig: currentView.viewConfig,
  });
}

function patchHuiRootClass() {
  const HuiRoot = customElements.get("hui-root") as any;
  if (!HuiRoot?.prototype || HuiRoot.prototype[dashboardLayoutCardV2RootPatchFlag]) return;

  HuiRoot.prototype[dashboardLayoutCardV2RootPatchFlag] = true;
  const renderActionItems = HuiRoot.prototype._renderActionItems;
  HuiRoot.prototype._renderActionItems = function (...args) {
    const originalResult = renderActionItems?.apply(this, args);
    if (!this?._editMode || !hasDashboardLayoutV2View(this)) return originalResult;

    return html`
      ${originalResult}
      <ha-icon-button
        slot="actionItems"
        id="dashboard-layout-v2-button"
        .path=${dashboardLayoutCardV2Icon}
        .label=${"Dashboard Layout V2 konfigurieren"}
        hide-title
        @click=${() => openDashboardLayoutV2Dialog(this)}
      ></ha-icon-button>
      <ha-tooltip placement="bottom" for="dashboard-layout-v2-button">
        Dashboard Layout V2 konfigurieren
      </ha-tooltip>
    `;
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

customElements.whenDefined("hui-root").then(() => {
  patchHuiRootClass();
});

const viewEditorObserver = new MutationObserver(() => patchExistingViewEditors());
viewEditorObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});
