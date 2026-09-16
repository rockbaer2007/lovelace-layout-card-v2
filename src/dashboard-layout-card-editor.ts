import { CSSResultArray, css, html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { DashboardLayoutCardConfig, DashboardLayoutMenuConfig } from "./types";
import { loadHaForm } from "./helpers";

type DashboardLayoutEditorTab = "menu" | "pages" | "chrome" | "advanced";

class DashboardLayoutCardV2Editor extends LitElement {
  @property() _config: DashboardLayoutCardConfig;
  @property() hass;
  @property() _activeTab: DashboardLayoutEditorTab = "menu";

  _menuSchema = [
    {
      name: "menu",
      selector: {
        object: {},
      },
    },
  ];

  _chromeSchema = [
    {
      name: "chrome",
      selector: {
        object: {},
      },
    },
  ];

  _pagesSchema = [
    {
      name: "pages",
      selector: {
        object: {},
      },
    },
  ];

  setConfig(config: DashboardLayoutCardConfig) {
    this._config = {
      ...config,
      menu: this._normalizeMenu(config.menu),
      chrome: config.chrome ?? {
        hide_ha_chrome: false,
        admin_always_visible: true,
        visible_users: "",
      },
      pages: config.pages ?? [],
    };
  }

  async firstUpdated() {
    await loadHaForm();
  }

  _normalizeMenu(menu: DashboardLayoutCardConfig["menu"]): DashboardLayoutMenuConfig {
    if (!menu) return { position: "left", title: "Haus", clock: "digital", date: true, weekday: "none", icon_only: false };
    if (typeof menu === "string") return { position: menu, icon_only: false };
    return { icon_only: false, ...menu };
  }

  _emitConfig(config: DashboardLayoutCardConfig) {
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config } }));
  }

  _valueChanged(ev) {
    ev.stopPropagation();
    this._emitConfig({
      ...this._config,
      ...ev.detail.value,
    });
  }

  _setMenuValue(key: keyof DashboardLayoutMenuConfig, value: DashboardLayoutMenuConfig[keyof DashboardLayoutMenuConfig]) {
    const menu = this._normalizeMenu(this._config.menu);
    this._emitConfig({
      ...this._config,
      menu: {
        ...menu,
        [key]: value,
      },
    });
  }

  _toggleIconOnly(ev: Event) {
    const target = ev.currentTarget as HTMLInputElement;
    this._setMenuValue("icon_only", target.checked);
  }

  _selectTab(tab: DashboardLayoutEditorTab) {
    this._activeTab = tab;
  }

  _computeLabel(schema) {
    if (schema.name === "menu") return "Menu configuration";
    if (schema.name === "chrome") return "HA interface";
    if (schema.name === "pages") return "Pages";
    return schema.name;
  }

  _renderTabButton(tab: DashboardLayoutEditorTab, label: string) {
    const active = this._activeTab === tab;
    return html`
      <button
        type="button"
        class=${active ? "active" : ""}
        role="tab"
        aria-selected=${String(active)}
        @click=${() => this._selectTab(tab)}
      >
        ${label}
      </button>
    `;
  }

  _renderMenuTab(menu: DashboardLayoutMenuConfig) {
    return html`
      <section class="tab-panel" role="tabpanel">
        <div class="quick-options">
          <label class="check-row">
            <input type="checkbox" .checked=${menu.icon_only === true} @change=${(ev: Event) => this._toggleIconOnly(ev)}>
            <span>Show only icons in the menu</span>
          </label>
          <p class="hint">Forces compact menu mode on desktop. Without this option, automatic mobile icon mode still applies.</p>
        </div>
        <ha-form
          .hass=${this.hass}
          .data=${{ menu }}
          .schema=${this._menuSchema}
          .computeLabel=${this._computeLabel}
          @value-changed=${this._valueChanged}
        ></ha-form>
      </section>
    `;
  }

  _renderPagesTab() {
    return html`
      <section class="tab-panel" role="tabpanel">
        <p class="hint">Main pages, dividers, spacers and later submenus stay together here.</p>
        <ha-form
          .hass=${this.hass}
          .data=${{ pages: this._config.pages ?? [] }}
          .schema=${this._pagesSchema}
          .computeLabel=${this._computeLabel}
          @value-changed=${this._valueChanged}
        ></ha-form>
      </section>
    `;
  }

  _renderChromeTab() {
    return html`
      <section class="tab-panel" role="tabpanel">
        <ha-form
          .hass=${this.hass}
          .data=${{ chrome: this._config.chrome }}
          .schema=${this._chromeSchema}
          .computeLabel=${this._computeLabel}
          @value-changed=${this._valueChanged}
        ></ha-form>
      </section>
    `;
  }

  _renderAdvancedTab() {
    return html`
      <section class="tab-panel" role="tabpanel">
        <div class="placeholder">
          <strong>Advanced menu / submenu</strong>
          <p>
            This area is prepared for the next expansion step: submenus per main menu button,
            fixed or selected position and dedicated pages per submenu entry.
          </p>
        </div>
      </section>
    `;
  }

  render() {
    if (!this.hass || !this._config) return html``;
    const menu = this._normalizeMenu(this._config.menu);
    return html`
      <div class="editor">
        <p>
          Configure Dashboard Layout Card V2. The settings are split into tabs,
          so new menu and submenu features stay manageable.
        </p>
        <nav class="tabs" role="tablist" aria-label="Dashboard Layout Card V2 settings">
          ${this._renderTabButton("menu", "Menu")}
          ${this._renderTabButton("pages", "Pages")}
          ${this._renderTabButton("chrome", "HA interface")}
          ${this._renderTabButton("advanced", "Advanced")}
        </nav>
        ${this._activeTab === "menu" ? this._renderMenuTab(menu) : ""}
        ${this._activeTab === "pages" ? this._renderPagesTab() : ""}
        ${this._activeTab === "chrome" ? this._renderChromeTab() : ""}
        ${this._activeTab === "advanced" ? this._renderAdvancedTab() : ""}
      </div>
    `;
  }

  static get styles(): CSSResultArray {
    return [
      css`
        .editor {
          display: grid;
          gap: 12px;
        }

        p {
          margin: 0;
          color: var(--secondary-text-color);
        }

        code {
          color: var(--primary-color);
        }

        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tabs button {
          min-height: 34px;
          padding: 7px 12px;
          border: 1px solid var(--divider-color, #cbd5e1);
          border-radius: 999px;
          background: var(--secondary-background-color, transparent);
          color: var(--secondary-text-color);
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .tabs button.active {
          border-color: var(--primary-color, #03a9f4);
          background: color-mix(in srgb, var(--primary-color, #03a9f4) 22%, transparent);
          color: var(--primary-text-color);
        }

        .tabs button:focus-visible {
          outline: 3px solid color-mix(in srgb, var(--primary-color, #03a9f4) 28%, transparent);
          outline-offset: 2px;
        }

        .tab-panel {
          display: grid;
          gap: 12px;
        }

        .quick-options,
        .placeholder {
          display: grid;
          gap: 8px;
          padding: 12px;
          border: 1px solid var(--divider-color, #cbd5e1);
          border-radius: 10px;
          background: color-mix(in srgb, var(--card-background-color, #fff) 92%, var(--primary-color, #03a9f4));
        }

        .check-row {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--primary-text-color);
          font-weight: 700;
        }

        .check-row input {
          width: 18px;
          height: 18px;
          accent-color: var(--primary-color, #03a9f4);
        }

        .hint,
        .placeholder p {
          margin: 0;
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.4;
        }
      `,
    ];
  }
}

customElements.define("dashboard-layout-card-v2-editor", DashboardLayoutCardV2Editor);
