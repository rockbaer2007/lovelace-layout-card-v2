import { css, html, LitElement } from "lit";
import { property, state } from "lit/decorators.js";
import {
  CardConfig,
  DashboardLayoutChromeConfig,
  DashboardLayoutCardConfig,
  DashboardLayoutMenuConfig,
  DashboardLayoutMenuPosition,
  DashboardLayoutPageConfig,
  LovelaceCard,
} from "./types";
import { applyHaChromeVisibility } from "./ha-chrome";

function normalizeLayoutType(layoutType?: string) {
  if (!layoutType) return "masonry-layout-v2";
  let normalized = layoutType;
  if (normalized.startsWith("custom:")) {
    normalized = normalized.substring("custom:".length);
  }
  if (!normalized.endsWith("-layout") && !normalized.endsWith("-layout-v2")) {
    normalized += "-layout-v2";
  }
  if (normalized.endsWith("-layout") && !normalized.endsWith("-layout-v2")) {
    normalized = `${normalized}-v2`;
  }
  return normalized;
}

function normalizeMenu(menu?: DashboardLayoutCardConfig["menu"]): DashboardLayoutMenuConfig {
  if (!menu) return { position: "left", clock: "digital", date: true };
  if (typeof menu === "string") return { position: menu };
  return menu;
}

function normalizeChrome(chrome?: DashboardLayoutChromeConfig): DashboardLayoutChromeConfig {
  return {
    hide_ha_chrome: false,
    admin_always_visible: true,
    visible_users: "",
    ...(chrome ?? {}),
  };
}

class DashboardLayoutCardV2 extends LitElement {
  @property() hass;
  @property() editMode = false;
  @property() lovelace;
  @property() _config: DashboardLayoutCardConfig;
  @property() _cards: Array<LovelaceCard> = [];
  @property() _layoutElement?: HTMLElement;
  @state() _activePage = 0;
  @state() _now = new Date();

  _clockTimer?: number;

  setConfig(config: DashboardLayoutCardConfig) {
    if (!Array.isArray(config.pages) || config.pages.length === 0) {
      throw new Error("dashboard-layout-card-v2 requires at least one page.");
    }
    this._config = {
      ...config,
      chrome: normalizeChrome(config.chrome),
      pages: config.pages.map((page) => ({
        ...page,
        cards: page.cards ?? [],
      })),
    };
    this._activePage = Math.min(this._activePage, this._config.pages.length - 1);
    this._createActivePageLayout();
  }

  connectedCallback() {
    super.connectedCallback();
    this._clockTimer = window.setInterval(() => {
      this._now = new Date();
    }, 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._clockTimer) window.clearInterval(this._clockTimer);
    applyHaChromeVisibility(this.hass, undefined);
  }

  async updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    if (changedProperties.has("hass")) {
      this._cards.forEach((card) => {
        card.hass = this.hass;
      });
      if (this._layoutElement) (this._layoutElement as any).hass = this.hass;
    }
    applyHaChromeVisibility(this.hass, this._config?.chrome);
  }

  get _pages() {
    return this._config?.pages ?? [];
  }

  get _activePageConfig(): DashboardLayoutPageConfig {
    return this._pages[this._activePage] ?? this._pages[0];
  }

  _getLovelace(el: any = this) {
    if (this.lovelace) return this.lovelace;
    if (el.lovelace) return el.lovelace;
    if (el.localName === "home-assistant") return undefined;
    if (el.parentElement && (el.parentElement as any).host) {
      return this._getLovelace((el.parentElement as any).host);
    }
    if (el.parentNode && (el.parentNode as any).host) {
      return this._getLovelace((el.parentNode as any).host);
    }
    if (el.parentElement) return this._getLovelace(el.parentElement);
    if (el.parentNode) return this._getLovelace(el.parentNode);
  }

  async _createCard(cardConfig: CardConfig, cardHelpers: any): Promise<LovelaceCard> {
    const card = cardHelpers.createCardElement(cardConfig);
    card.hass = this.hass;
    return card;
  }

  async _createActivePageLayout() {
    const page = this._activePageConfig;
    if (!page) return;

    const layoutType = normalizeLayoutType(page.layout_type);
    const layoutElement = document.createElement(layoutType);
    const cards = page.cards ?? [];
    (layoutElement as any).setConfig?.({
      type: layoutType,
      layout: page.layout ?? {},
      cards,
    });
    (layoutElement as any).hass = this.hass;
    (layoutElement as any).narrow = false;
    (layoutElement as any).lovelace = {
      ...this._getLovelace(),
      editMode: false,
    };
    (layoutElement as any).index = 1;

    const cardHelpers = await (window as any).loadCardHelpers?.();
    this._cards = cardHelpers
      ? await Promise.all(cards.map((cardConfig) => this._createCard(cardConfig, cardHelpers)))
      : [];
    (layoutElement as any).cards = this._cards;
    this._layoutElement = layoutElement;
  }

  async _selectPage(index: number) {
    if (index === this._activePage) return;
    this._activePage = index;
    await this._createActivePageLayout();
  }

  _menuPosition(menu: DashboardLayoutMenuConfig): DashboardLayoutMenuPosition {
    return menu.position ?? "left";
  }

  _renderClock(menu: DashboardLayoutMenuConfig) {
    if (menu.clock === "none") return html``;
    if (menu.clock === "analog") {
      const seconds = this._now.getSeconds();
      const minutes = this._now.getMinutes() + seconds / 60;
      const hours = (this._now.getHours() % 12) + minutes / 60;
      return html`
        <div class="analog-clock" aria-label="Analog clock">
          <span class="hand hour" style=${`transform: rotate(${hours * 30}deg)`}></span>
          <span class="hand minute" style=${`transform: rotate(${minutes * 6}deg)`}></span>
        </div>
      `;
    }
    return html`<strong class="digital-clock">${this._now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}</strong>`;
  }

  _renderMenu(menu: DashboardLayoutMenuConfig) {
    if (this._menuPosition(menu) === "none") return html``;
    const style = menu.style ?? {};
    const background =
      style.background_mode === "color" && style.background_color
        ? style.background_color
        : style.background_mode === "image" && style.background_image
          ? `center / cover no-repeat url("${style.background_image}")`
          : "";
    return html`
      <nav
        class="menu"
        aria-label="Dashboard pages"
        style=${[
          style.icon_color ? `--dashboard-layout-v2-icon-color: ${style.icon_color}` : "",
          style.icon_background_color || style.icon_circle_color
            ? `--dashboard-layout-v2-icon-background-color: ${style.icon_background_color ?? style.icon_circle_color}`
            : "",
          style.icon_shape === "rounded-square" ? "--dashboard-layout-v2-icon-radius: 8px" : "",
          style.active_tab_color ? `--dashboard-layout-v2-active-tab-color: ${style.active_tab_color}` : "",
          style.inactive_tab_color ? `--dashboard-layout-v2-inactive-tab-color: ${style.inactive_tab_color}` : "",
          style.hover_tab_color ? `--dashboard-layout-v2-hover-tab-color: ${style.hover_tab_color}` : "",
          style.active_tab_text_color ? `--dashboard-layout-v2-active-tab-text-color: ${style.active_tab_text_color}` : "",
          style.inactive_tab_text_color ? `--dashboard-layout-v2-inactive-tab-text-color: ${style.inactive_tab_text_color}` : "",
          style.hover_tab_text_color ? `--dashboard-layout-v2-hover-tab-text-color: ${style.hover_tab_text_color}` : "",
          style.clock_size ? `--dashboard-layout-v2-clock-size: ${style.clock_size}` : "",
          style.date_size ? `--dashboard-layout-v2-date-size: ${style.date_size}` : "",
          background ? `--dashboard-layout-v2-menu-background: ${background}` : "",
        ].filter(Boolean).join(";")}
      >
        <header class="menu-header">
          ${menu.title ? html`<span class="menu-title">${menu.title}</span>` : ""}
          ${this._renderClock(menu)}
          ${menu.date !== false ? html`<span class="menu-date">${this._now.toLocaleDateString()}</span>` : ""}
        </header>
        <div class="menu-pages">
          ${this._pages.map((page, index) => html`
            <button
              class=${index === this._activePage ? "active" : ""}
              type="button"
              @click=${() => this._selectPage(index)}
            >
              ${page.icon ? html`<ha-icon .icon=${page.icon}></ha-icon>` : ""}
              <span>${page.title}</span>
            </button>
          `)}
        </div>
      </nav>
    `;
  }

  render() {
    if (!this._config) return html``;
    const menu = normalizeMenu(this._config.menu);
    const position = this._menuPosition(menu);
    return html`
      <ha-card class=${`dashboard-layout-card menu-${position}`}>
        ${position === "left" ? this._renderMenu(menu) : ""}
        <main class="page">${this._layoutElement}</main>
        ${position === "right" ? this._renderMenu(menu) : ""}
      </ha-card>
    `;
  }

  static getConfigElement() {
    return document.createElement("dashboard-layout-card-v2-editor");
  }

  static getStubConfig() {
    return {
      menu: {
        position: "left",
        title: "Haus",
        clock: "digital",
        date: true,
      },
      chrome: {
        hide_ha_chrome: false,
        admin_always_visible: true,
        visible_users: "",
      },
      pages: [
        {
          title: "Keller",
          icon: "mdi:home-floor-negative-1",
          layout_type: "custom:grid-layout-v2",
          layout: {
            "grid-template-columns": "repeat(3, minmax(0, 1fr))",
            gap: "8px",
          },
          cards: [],
        },
      ],
    };
  }

  static get styles() {
    return css`
      ha-card.dashboard-layout-card {
        display: grid;
        grid-template-columns: minmax(148px, 220px) minmax(0, 1fr);
        min-height: 320px;
        overflow: hidden;
      }

      ha-card.menu-right {
        grid-template-columns: minmax(0, 1fr) minmax(148px, 220px);
      }

      ha-card.menu-none {
        display: block;
      }

      .menu {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        border-right: 1px solid var(--divider-color);
        background: var(
          --dashboard-layout-v2-menu-background,
          color-mix(in srgb, var(--card-background-color) 92%, var(--primary-color))
        );
      }

      ha-card.menu-right .menu {
        border-right: 0;
        border-left: 1px solid var(--divider-color);
      }

      .menu-header {
        display: grid;
        justify-items: center;
        text-align: center;
        gap: 4px;
        min-height: 72px;
      }

      .menu-title {
        color: var(--secondary-text-color);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .digital-clock {
        color: var(--primary-text-color);
        font-size: 28px;
        line-height: 1;
      }

      .menu-date {
        color: var(--secondary-text-color);
        font-size: var(--dashboard-layout-v2-date-size, 12px);
      }

      .analog-clock {
        position: relative;
        width: var(--dashboard-layout-v2-clock-size, 42px);
        height: var(--dashboard-layout-v2-clock-size, 42px);
        border: 2px solid var(--dashboard-layout-v2-icon-color, var(--primary-color));
        border-radius: 50%;
      }

      .hand {
        position: absolute;
        bottom: 50%;
        left: calc(50% - 1px);
        width: 2px;
        transform-origin: bottom center;
        background: var(--primary-text-color);
      }

      .hand.hour {
        height: calc(var(--dashboard-layout-v2-clock-size, 42px) * 0.29);
      }

      .hand.minute {
        height: calc(var(--dashboard-layout-v2-clock-size, 42px) * 0.4);
      }

      .menu-pages {
        display: grid;
        gap: 6px;
      }

      .menu-pages button {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 40px;
        border: 0;
        border-radius: 8px;
        padding: 8px 10px;
        color: var(--dashboard-layout-v2-inactive-tab-text-color, var(--primary-text-color));
        background: var(--dashboard-layout-v2-inactive-tab-color, transparent);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .menu-pages button:hover {
        color: var(--dashboard-layout-v2-hover-tab-text-color, var(--dashboard-layout-v2-inactive-tab-text-color, var(--primary-text-color)));
        background: var(--dashboard-layout-v2-hover-tab-color, transparent);
      }

      .menu-pages button.active {
        color: var(--dashboard-layout-v2-active-tab-text-color, var(--text-primary-color, #fff));
        background: var(--dashboard-layout-v2-active-tab-color, var(--primary-color));
      }

      .menu-pages ha-icon {
        --mdc-icon-size: 20px;
        display: inline-grid;
        place-items: center;
        width: 28px;
        height: 28px;
        min-width: 28px;
        padding: 4px;
        box-sizing: border-box;
        border-radius: var(--dashboard-layout-v2-icon-radius, 50%);
        background: var(--dashboard-layout-v2-icon-background-color, transparent);
        color: var(--dashboard-layout-v2-icon-color, var(--primary-color));
      }

      .page {
        min-width: 0;
        padding: 8px;
      }
    `;
  }
}

customElements.define("dashboard-layout-card-v2", DashboardLayoutCardV2);
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "dashboard-layout-card-v2",
  name: "Dashboard Layout Card V2",
  preview: false,
  description: "Dashboard pages with optional side menu and per-page layouts.",
});
