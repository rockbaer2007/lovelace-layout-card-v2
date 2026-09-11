import { CSSResultArray, css, html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { DashboardLayoutCardConfig, DashboardLayoutMenuConfig } from "./types";
import { loadHaForm } from "./helpers";

class DashboardLayoutCardV2Editor extends LitElement {
  @property() _config: DashboardLayoutCardConfig;
  @property() hass;

  _schema = [
    {
      name: "menu",
      selector: {
        object: {},
      },
    },
    {
      name: "chrome",
      selector: {
        object: {},
      },
    },
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
    if (!menu) return { position: "left", title: "Haus", clock: "digital", date: true, weekday: "none" };
    if (typeof menu === "string") return { position: menu };
    return menu;
  }

  _valueChanged(ev) {
    ev.stopPropagation();
    const config = {
      ...this._config,
      ...ev.detail.value,
    };
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config } }));
  }

  _computeLabel(schema) {
    if (schema.name === "menu") return "Menu";
    if (schema.name === "chrome") return "HA-Oberfläche";
    if (schema.name === "pages") return "Pages";
    return schema.name;
  }

  render() {
    if (!this.hass || !this._config) return html``;
    return html`
      <div class="editor">
        <p>
          Configure the side menu and pages. Each page has its own
          <code>layout_type</code>, <code>layout</code> and <code>cards</code>.
        </p>
        <ha-form
          .hass=${this.hass}
          .data=${this._config}
          .schema=${this._schema}
          .computeLabel=${this._computeLabel}
          @value-changed=${this._valueChanged}
        ></ha-form>
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
      `,
    ];
  }
}

customElements.define("dashboard-layout-card-v2-editor", DashboardLayoutCardV2Editor);
