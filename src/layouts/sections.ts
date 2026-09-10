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
  private _sectionElements: HTMLElement[] = [];
  private _sectionSignature = "";

  async setConfig(config: SectionsViewConfig) {
    await super.setConfig({
      ...config,
      type: "custom:sections-layout-v2",
      sections: sectionsFromConfig(config),
    });
    this._syncNativeSectionsView();
  }

  async updated(changedProperties: Map<string, any>) {
    await super.updated(changedProperties);
    this._syncNativeSectionsView();
  }

  firstUpdated() {
    this._syncNativeSectionsView();
  }

  private _nativeSectionsConfig() {
    return {
      ...this._config,
      type: "sections",
      sections: sectionsFromConfig(this._config),
      max_columns: this._config.max_columns ?? 4,
    };
  }

  private _buildSectionElements() {
    const sections = sectionsFromConfig(this._config);
    const signature = JSON.stringify(sections);

    if (signature !== this._sectionSignature) {
      this._sectionElements = sections.map((sectionConfig, index) => {
        const section = document.createElement("hui-section") as any;
        this._applySectionConfig(section, sectionConfig, index);
        return section;
      });
      this._sectionSignature = signature;
    }

    this._sectionElements.forEach((section: any, index) => {
      const sectionConfig = sections[index];
      this._applySectionConfig(section, sectionConfig, index);
    });

    return this._sectionElements;
  }

  private _applySectionConfig(section: any, sectionConfig: Record<string, any>, index: number) {
    section.hass = this.hass;
    section.lovelace = this.lovelace;
    section.viewIndex = this.index;
    section.index = index;
    section.preview = Boolean(this.lovelace?.editMode);
    section.config = sectionConfig;
    section.requestUpdate?.();
  }

  private _syncNativeSectionsView() {
    const sectionsView = this.shadowRoot?.querySelector("hui-sections-view") as any;
    if (!sectionsView || !this._config) return;

    sectionsView.hass = this.hass;
    sectionsView.lovelace = this.lovelace;
    sectionsView.index = this.index;
    sectionsView.narrow = this.narrow;
    sectionsView.isStrategy = false;
    sectionsView.badges = [];
    sectionsView.cards = this.cards ?? [];
    sectionsView.sections = this._buildSectionElements();
    sectionsView.setConfig?.(this._nativeSectionsConfig());
    sectionsView.requestUpdate?.();
  }

  render() {
    return this._renderDashboardLayoutV2Shell(html`
      <hui-sections-view class="sections-view"></hui-sections-view>
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

        .sections-view {
          display: block;
          min-width: 0;
        }
      `,
    ];
  }
}

customElements.define("sections-layout-v2", SectionsLayout);
