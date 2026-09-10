import { css, html } from "lit";
import { BaseLayout } from "./base-layout";
import { ViewConfig } from "../types";

type SectionsViewConfig = ViewConfig & {
  sections?: Array<Record<string, any>>;
  max_columns?: number;
};

const DEFAULT_SECTIONS = [
  {
    type: "grid",
    cards: [],
  },
];

function sectionsFromConfig(config: SectionsViewConfig) {
  if (Array.isArray(config.sections)) return config.sections;
  if (Array.isArray(config.cards) && config.cards.length) {
    return [
      {
        type: "grid",
        cards: config.cards,
      },
    ];
  }
  return DEFAULT_SECTIONS;
}

class SectionsLayout extends BaseLayout {
  _config: SectionsViewConfig;

  async setConfig(config: SectionsViewConfig) {
    await super.setConfig({
      ...config,
      type: "custom:sections-layout-v2",
      sections: sectionsFromConfig(config),
    });
  }

  async updated(changedProperties: Map<string, any>) {
    await super.updated(changedProperties);
    this._loadNativeSectionsEditors();
    this._patchNativeEditorSaves();
  }

  private async _addSection() {
    if (!this.lovelace?.config?.views?.[this.index]) return;
    const nextConfig = JSON.parse(JSON.stringify(this.lovelace.config));
    const view = nextConfig.views[this.index];
    view.sections = [...sectionsFromConfig(view), ...DEFAULT_SECTIONS];
    delete view.cards;
    await this.lovelace.saveConfig(nextConfig);
  }

  private _loadNativeSectionsEditors() {
    if (!this.lovelace?.editMode || (this as any).__dashboardLayoutV2SectionsEditorsLoaded) return;

    const loader = document.createElement("hui-sections-view") as any;
    if (typeof loader.willUpdate !== "function") return;

    (this as any).__dashboardLayoutV2SectionsEditorsLoaded = true;
    loader.hass = this.hass;
    loader.lovelace = { ...this.lovelace, editMode: true };
    loader.willUpdate(new Map([["lovelace", undefined]]));
  }

  private _nativeHeaderEditor() {
    return this.shadowRoot?.getElementById("native-header-editor") as any;
  }

  private _nativeFooterEditor() {
    return this.shadowRoot?.getElementById("native-footer-editor") as any;
  }

  private _sourceLovelaceConfig() {
    return this.lovelace?.rawConfig ?? this.lovelace?.config;
  }

  private _currentViewConfig(): SectionsViewConfig {
    const viewIndex = Number(this.index);
    const rawView = this.lovelace?.rawConfig?.views?.[viewIndex];
    const configView = this.lovelace?.config?.views?.[viewIndex];
    return {
      ...this._config,
      ...(configView ?? {}),
      ...(rawView ?? {}),
    };
  }

  private async _saveViewPatch(patch: Partial<SectionsViewConfig>) {
    const sourceConfig = this._sourceLovelaceConfig();
    const viewIndex = Number(this.index);
    if (!sourceConfig?.views?.[viewIndex] || !this.lovelace?.saveConfig) return;

    const nextConfig = JSON.parse(JSON.stringify(sourceConfig));
    nextConfig.views[viewIndex] = {
      ...nextConfig.views[viewIndex],
      ...patch,
    };

    await this.lovelace.saveConfig(nextConfig);
    if (this.lovelace.config?.views?.[viewIndex]) {
      this.lovelace.config.views[viewIndex] = nextConfig.views[viewIndex];
    }
    if (this.lovelace.rawConfig?.views?.[viewIndex]) {
      this.lovelace.rawConfig.views[viewIndex] = nextConfig.views[viewIndex];
    }
    this._config = {
      ...this._config,
      ...patch,
    };
    this.requestUpdate();
  }

  private _patchNativeEditorSaves() {
    const header = this._nativeHeaderEditor();
    if (header && !header.__dashboardLayoutV2SavePatched) {
      header._saveHeaderConfig = (headerConfig: Record<string, any>) =>
        this._saveViewPatch({ header: headerConfig });
      header.__dashboardLayoutV2SavePatched = true;
    }

    const footer = this._nativeFooterEditor();
    if (footer && !footer.__dashboardLayoutV2SavePatched) {
      footer._saveFooterConfig = (footerConfig: Record<string, any>) =>
        this._saveViewPatch({ footer: footerConfig });
      footer.__dashboardLayoutV2SavePatched = true;
    }
  }

  render() {
    const viewConfig = this._currentViewConfig();
    const sections = sectionsFromConfig(viewConfig);
    const maxColumns = viewConfig?.max_columns ?? 4;
    const editMode = Boolean(this.lovelace?.editMode);
    const badges = (this as any).badges ?? [];
    return this._renderDashboardLayoutV2Shell(html`
      <div class="sections-wrapper" style=${`--sections-max-columns: ${maxColumns}`}>
        <hui-view-header
          id="native-header-editor"
          .hass=${this.hass}
          .badges=${badges}
          .lovelace=${this.lovelace}
          .viewIndex=${this.index}
          .config=${viewConfig?.header ?? {}}
        ></hui-view-header>
        <div class="sections-view">
          ${sections.map((sectionConfig, index) => html`
            <div
              class=${editMode ? "section edit-mode" : "section"}
              style=${[
                sectionConfig.column_span
                  ? `--column-span: ${Math.min(Number(sectionConfig.column_span), maxColumns)}`
                  : "",
                sectionConfig.row_span ? `--row-span: ${sectionConfig.row_span}` : "",
              ].filter(Boolean).join(";")}
            >
              ${editMode
                ? html`
                    <hui-section-edit-mode
                      .hass=${this.hass}
                      .lovelace=${this.lovelace}
                      .index=${index}
                      .viewIndex=${this.index}
                    >
                      <hui-section
                        .hass=${this.hass}
                        .lovelace=${this.lovelace}
                        .config=${sectionConfig}
                        .viewIndex=${this.index}
                        .index=${index}
                        ?preview=${editMode}
                      ></hui-section>
                    </hui-section-edit-mode>
                  `
                : html`
                    <hui-section
                      .hass=${this.hass}
                      .lovelace=${this.lovelace}
                      .config=${sectionConfig}
                      .viewIndex=${this.index}
                      .index=${index}
                    ></hui-section>
                  `}
            </div>
          `)}
          ${editMode
            ? html`
                <button class="create-section" @click=${this._addSection} title="Abschnitt hinzufügen">
                  <ha-icon .icon=${"mdi:view-grid-plus"}></ha-icon>
                </button>
              `
            : ""}
        </div>
        <hui-view-footer
          id="native-footer-editor"
          .hass=${this.hass}
          .lovelace=${this.lovelace}
          .viewIndex=${this.index}
          .config=${viewConfig?.footer ?? {}}
        ></hui-view-footer>
      </div>
      ${this._render_fab()}
    `);
  }

  static get styles() {
    return [
      this._fab_styles,
      css`
        :host {
          display: block;
          height: 100%;
          box-sizing: border-box;
        }

        .sections-wrapper {
          --column-gap: var(--ha-view-sections-column-gap, 32px);
          --column-min-width: var(--ha-view-sections-column-min-width, 320px);
          --column-max-width: var(--ha-view-sections-column-max-width, 500px);
          display: grid;
          gap: 32px;
          width: 100%;
          max-width: calc(
            var(--sections-max-columns) * var(--column-max-width) +
              (var(--sections-max-columns) - 1) * var(--column-gap)
          );
          min-width: 0;
          margin: 0 auto;
          padding: 0 var(--column-gap);
          box-sizing: border-box;
          min-height: calc(100vh - 96px);
          grid-template-rows: auto auto 1fr;
        }

        .sections-view {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(min(100%, var(--column-min-width)), 1fr)
          );
          gap: var(--column-gap);
          width: 100%;
          min-width: 0;
        }

        .section {
          position: relative;
          grid-column: span var(--column-span, 1);
          grid-row: span var(--row-span, 1);
        }

        .section.edit-mode {
          min-height: 112px;
        }

        .create-section {
          min-height: 112px;
          border: 2px dashed var(--primary-color);
          border-radius: 16px;
          background: transparent;
          color: var(--primary-text-color);
          cursor: pointer;
        }

        hui-view-header {
          display: block;
          padding-top: var(--column-gap);
        }

        hui-view-footer {
          display: block;
          align-self: end;
          margin-bottom: 8px;
        }
      `,
    ];
  }
}

customElements.define("sections-layout-v2", SectionsLayout);
