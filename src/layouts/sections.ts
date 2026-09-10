import { css, html } from "lit";
import { property } from "lit/decorators.js";
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

class SectionsLayout extends BaseLayout {
  _config: SectionsViewConfig;
  @property({ attribute: false }) sections: HTMLElement[] = [];
  @property({ attribute: false }) badges: HTMLElement[] = [];

  async setConfig(config: SectionsViewConfig) {
    await super.setConfig({
      ...config,
      type: "custom:sections-layout-v2",
      sections: Array.isArray(config.sections) ? config.sections : DEFAULT_SECTIONS,
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
      sections: Array.isArray(this._config.sections) ? this._config.sections : DEFAULT_SECTIONS,
      max_columns: this._config.max_columns ?? 4,
    };
  }

  private _syncNativeSectionsView() {
    const sectionsView = this.shadowRoot?.querySelector("hui-sections-view") as any;
    if (!sectionsView || !this._config) return;

    sectionsView.hass = this.hass;
    sectionsView.lovelace = this.lovelace;
    sectionsView.index = this.index;
    sectionsView.narrow = this.narrow;
    sectionsView.isStrategy = false;
    sectionsView.badges = this.badges ?? [];
    sectionsView.cards = this.cards ?? [];
    sectionsView.sections = this.sections ?? [];
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
