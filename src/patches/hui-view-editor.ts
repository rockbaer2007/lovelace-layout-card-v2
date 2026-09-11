import { html } from "lit";
import { LAYOUT_CARD_SELECTOR_OPTIONS } from "../helpers";
import { showDashboardLayoutV2ViewDialog } from "../dashboard-layout-view-dialog";

const dashboardLayoutCardV2PatchFlag = "_dashboardLayoutCardV2Patched";
const dashboardLayoutCardV2SchemaPatchFlag = "_dashboardLayoutCardV2SchemaPatched";
const dashboardLayoutCardV2SelectorPatchFlag = "_dashboardLayoutCardV2SelectorPatched";
const dashboardLayoutCardV2RootPatchFlag = "_dashboardLayoutCardV2RootPatched";
const homeAssistantViewLayouts = new Set(["sections", "masonry", "sidebar", "panel"]);
const sectionsLayoutV2Type = "custom:sections-layout-v2";
const sectionsViewLayouts = new Set(["sections", sectionsLayoutV2Type]);
const dashboardLayoutCardV2ViewLayouts = new Set(
  LAYOUT_CARD_SELECTOR_OPTIONS.map((option) => option.value)
);
const dashboardLayoutCardV2Icon =
  "M3 4h12v4H3V4m0 6h12v4H3v-4m0 6h8v4H3v-4M17.8 12.2l2 2L13.6 20.4H11.6V18.4L17.8 12.2m2.7-2.7c.3-.3.8-.3 1.1 0l.9.9c.3.3.3.8 0 1.1l-1.2 1.2-2-2 1.2-1.2z";
const validPathRegex = /^[a-zA-Z0-9_-]+$/;
const integerRegex = /^[0-9]+$/;

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

function duplicateSectionsSpecificsForV2(schema: any[]) {
  if (!Array.isArray(schema)) return;
  const sectionSpecifics = schema.find((entry) => entry?.name === "section_specifics");
  if (!sectionSpecifics) return;
  const hasV2SectionSpecifics = schema.some(
    (entry) => entry?.name === "section_specifics" && entry?.visible?.value === sectionsLayoutV2Type
  );
  if (hasV2SectionSpecifics) return;

  schema.push({
    ...sectionSpecifics,
    visible: {
      ...(sectionSpecifics.visible ?? {}),
      value: sectionsLayoutV2Type,
    },
  });
}

function slugifyPath(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function patchValueChanged(target: any) {
  if (!target || target._dashboardLayoutCardV2ValueChangedPatched || typeof target._valueChanged !== "function") return;

  target._valueChanged = function (ev: CustomEvent) {
    const config = ev.detail.value;
    if (!sectionsViewLayouts.has(config.type)) {
      delete config.max_columns;
      delete config.dense_section_placement;
      delete config.top_margin;
    }

    const slugifyTitle = (title: string | undefined) => {
      const slug = slugifyPath(title || "");
      if (integerRegex.test(slug)) {
        return `view-${slug}`;
      }
      return slug;
    };

    if (
      this.isNew &&
      !this._suggestedPath &&
      this._config.path === config.path &&
      (!this._config.path || config.path === slugifyTitle(this._config.title))
    ) {
      config.path = slugifyTitle(config.title);
    }

    let valid = true;
    this._error = undefined;
    if (config.path && !validPathRegex.test(config.path)) {
      valid = false;
      this._error = { path: "error_invalid_path" };
    } else if (config.path && integerRegex.test(config.path)) {
      valid = false;
      this._error = { path: "error_number" };
    }

    this.dispatchEvent(new CustomEvent("view-config-changed", {
      bubbles: true,
      composed: true,
      detail: { valid, config },
    }));
  };

  target._dashboardLayoutCardV2ValueChangedPatched = true;
}

function patchSchemaProvider(target: any) {
  if (!target || target[dashboardLayoutCardV2SchemaPatchFlag] || typeof target._schema !== "function") return;

  const originalSchema = target._schema;
  target._schema = function (...args) {
    const retval = originalSchema.apply(this, args);
    const typeSelector = retval?.find?.((entry) => entry.name === "type");
    appendLayoutCardV2Options(typeSelector);
    duplicateSectionsSpecificsForV2(retval);

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
  patchValueChanged(editor);
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
  const viewConfig =
    root?.lovelace?.rawConfig?.views?.[viewIndex] ??
    root?.lovelace?.config?.views?.[viewIndex];
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
  patchValueChanged(HuiViewEditor.prototype);

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
