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
  }

  private async _addSection() {
    if (!this.lovelace?.config?.views?.[this.index]) return;
    const nextConfig = JSON.parse(JSON.stringify(this.lovelace.config));
    const view = nextConfig.views[this.index];
    view.sections = [...sectionsFromConfig(view), ...DEFAULT_SECTIONS];
    delete view.cards;
    await this.lovelace.saveConfig(nextConfig);
  }

  render() {
    const sections = sectionsFromConfig(this._config);
    const maxColumns = this._config?.max_columns ?? 4;
    return this._renderDashboardLayoutV2Shell(html`
      <div class="sections-wrapper" style=${`--sections-max-columns: ${maxColumns}`}>
        <hui-view-header
          .hass=${this.hass}
          .badges=${[]}
          .lovelace=${this.lovelace}
          .viewIndex=${this.index}
          .config=${this._config?.header}
        ></hui-view-header>
        <div class="sections-view">
          ${sections.map((sectionConfig, index) => html`
            <div
              class="section"
              style=${[
                sectionConfig.column_span
                  ? `--column-span: ${Math.min(Number(sectionConfig.column_span), maxColumns)}`
                  : "",
                sectionConfig.row_span ? `--row-span: ${sectionConfig.row_span}` : "",
              ].filter(Boolean).join(";")}
            >
              <hui-section
                .hass=${this.hass}
                .lovelace=${this.lovelace}
                .config=${sectionConfig}
                .viewIndex=${this.index}
                .index=${index}
                ?preview=${Boolean(this.lovelace?.editMode)}
              ></hui-section>
            </div>
          `)}
          ${this.lovelace?.editMode
            ? html`
                <button class="create-section" @click=${this._addSection} title="Abschnitt hinzufügen">
                  <ha-icon .icon=${"mdi:view-grid-plus"}></ha-icon>
                </button>
              `
            : ""}
        </div>
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
          grid-column: span var(--column-span, 1);
          grid-row: span var(--row-span, 1);
        }

        .create-section {
          min-height: 112px;
          border: 2px dashed var(--primary-color);
          border-radius: 16px;
          background: transparent;
          color: var(--primary-text-color);
          cursor: pointer;
        }
      `,
    ];
  }
}

customElements.define("sections-layout-v2", SectionsLayout);
