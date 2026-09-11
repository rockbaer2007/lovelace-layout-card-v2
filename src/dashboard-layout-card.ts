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

function isMenuOnlyPage(page?: DashboardLayoutPageConfig) {
  return page?.type === "spacer" || page?.type === "divider";
}

function pageTitle(page?: DashboardLayoutPageConfig) {
  return String(page?.title ?? (page as any)?.name ?? page?.path ?? "");
}

function formatStatusValue(value?: string) {
  if (value === undefined || value === null) return "—";
  const normalized = String(value).replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return String(value);
  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) return String(value);
  return numericValue.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function notifyMessage(value?: string) {
  if (value === undefined || value === null) return "";
  const message = String(value).trim();
  if (!message || message === "unknown" || message === "unavailable") return "";
  return message;
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
    if (isMenuOnlyPage(this._config.pages[this._activePage])) {
      this._activePage = this._config.pages.findIndex((page) => !isMenuOnlyPage(page));
    }
    if (this._activePage < 0) this._activePage = 0;
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
    if (!page || isMenuOnlyPage(page)) return;

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
    if (isMenuOnlyPage(this._config.pages[index])) return;
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
          ${menu.analog_minute_marks
            ? Array.from({ length: 60 }, (_, index) =>
                index % 5 === 0
                  ? ""
                  : html`<span class="minute-mark" style=${`transform: rotate(${index * 6}deg)`}></span>`
              )
            : ""}
          ${menu.analog_hour_marks
            ? Array.from({ length: 12 }, (_, index) => html`
                <span class="mark" style=${`transform: rotate(${index * 30}deg)`}></span>
              `)
            : ""}
          <span class="hand hour" style=${`transform: rotate(${hours * 30}deg)`}></span>
          <span class="hand minute" style=${`transform: rotate(${minutes * 6}deg)`}></span>
          ${menu.analog_seconds
            ? html`<span class="hand second" style=${`transform: rotate(${seconds * 6}deg)`}></span>`
            : ""}
        </div>
      `;
    }
    return html`<strong class="digital-clock">${this._now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}</strong>`;
  }

  _renderDate(menu: DashboardLayoutMenuConfig) {
    if (menu.date === false) return html``;
    const style = menu.style ?? {};
    const dateSize = Number(String(style.date_size ?? "12px").replace(/[^\d.]/g, "")) || 12;
    const wrapSize = Number(String(style.weekday_wrap_size ?? "21px").replace(/[^\d.]/g, "")) || 21;
    const date = this._now.toLocaleDateString();
    if (menu.weekday === "short") {
      const weekday = this._now.toLocaleDateString([], { weekday: "short" }).replace(/\.$/, "");
      return html`<span class="menu-date">${weekday}. ${date}</span>`;
    }
    if (menu.weekday === "long") {
      const weekday = this._now.toLocaleDateString([], { weekday: "long" });
      return dateSize >= wrapSize
        ? html`<span class="menu-date two-line"><span>${weekday}</span><span>${date}</span></span>`
        : html`<span class="menu-date">${weekday} ${date}</span>`;
    }
    return html`<span class="menu-date">${date}</span>`;
  }

  _statusBorderColor(menu: DashboardLayoutMenuConfig) {
    const statusColor = menu.status?.border_color?.trim();
    if (statusColor) return statusColor;
    const tabColor = menu.style?.tab_border_color?.trim();
    if (tabColor && tabColor !== "transparent") return tabColor;
    return "#ffffff";
  }

  _notifyBorderColor(menu: DashboardLayoutMenuConfig) {
    return menu.notify?.border_color?.trim() || "var(--error-color, #db4437)";
  }

  _renderNotify(menu: DashboardLayoutMenuConfig) {
    const notify = menu.notify;
    if (notify?.enabled !== true) return html``;
    const entityId = notify.entity?.trim() || "input_text.dashboard_notification";
    const stateObj = this.hass?.states?.[entityId];
    const message = notifyMessage(stateObj?.state);
    if (!message) return html``;

    return html`
      <div class="menu-notify" style=${`--dashboard-layout-v2-notify-border-color: ${this._notifyBorderColor(menu)}`}>
        ${message}
      </div>
    `;
  }

  _renderStatus(menu: DashboardLayoutMenuConfig) {
    const status = menu.status;
    if (status?.enabled !== true) return html``;
    const items = (status.items ?? []).filter((item) => item?.entity);
    if (!items.length) return html``;

    return html`
      <div class="menu-status" style=${`--dashboard-layout-v2-status-border-color: ${this._statusBorderColor(menu)}`}>
        ${items.slice(0, 4).map((item) => {
          const stateObj = this.hass?.states?.[item.entity ?? ""];
          const label = item.label || stateObj?.attributes?.friendly_name || item.entity;
          const unit = stateObj?.attributes?.unit_of_measurement || item.unit || "";
          const value = formatStatusValue(stateObj?.state);
          return html`
            <div class="status-row">
              <span class="status-label">${label}</span>
              <span class="status-value">${value}${unit ? ` ${unit}` : ""}</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  _renderMenuItem(page: DashboardLayoutPageConfig, index: number) {
    if (page.type === "spacer") {
      return html`<div class="menu-spacer" aria-hidden="true"></div>`;
    }
    if (page.type === "divider") {
      return html`
        <div
          class="menu-divider"
          style=${[
            `--dashboard-layout-v2-divider-color: ${page.color || "#ffffff"}`,
            `--dashboard-layout-v2-divider-shadow-frame-color: ${page.shadow_frame_color || "transparent"}`,
          ].join(";")}
          aria-hidden="true"
        ></div>
      `;
    }

    return html`
      <button
        class=${index === this._activePage ? "active" : ""}
        type="button"
        @click=${() => this._selectPage(index)}
      >
        ${page.icon ? html`<ha-icon .icon=${page.icon}></ha-icon>` : ""}
        <span>${pageTitle(page)}</span>
      </button>
    `;
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
          style.icon_active_color ? `--dashboard-layout-v2-icon-active-color: ${style.icon_active_color}` : "",
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
          style.tab_border_color ? `--dashboard-layout-v2-tab-border-color: ${style.tab_border_color}` : "",
          style.tab_shadow_frame_color ? `--dashboard-layout-v2-tab-shadow-frame-color: ${style.tab_shadow_frame_color}` : "",
          style.shadow_frame_offset ? `--dashboard-layout-v2-shadow-frame-offset: ${style.shadow_frame_offset}` : "",
          style.clock_size ? `--dashboard-layout-v2-clock-size: ${style.clock_size}` : "",
          style.date_size ? `--dashboard-layout-v2-date-size: ${style.date_size}` : "",
          background ? `--dashboard-layout-v2-menu-background: ${background}` : "",
        ].filter(Boolean).join(";")}
      >
        <header class="menu-header">
          ${menu.title ? html`<span class="menu-title">${menu.title}</span>` : ""}
          ${this._renderClock(menu)}
          ${this._renderDate(menu)}
        </header>
        <div class="menu-pages">
          ${this._pages.map((page, index) => this._renderMenuItem(page, index))}
        </div>
        <div class="menu-bottom">
          ${this._renderNotify(menu)}
          ${this._renderStatus(menu)}
        </div>
      </nav>
    `;
  }

  _contentStyle(menu: DashboardLayoutMenuConfig) {
    const style = menu.style ?? {};
    return [
      style.card_border_color ? `--dashboard-layout-v2-card-border-color: ${style.card_border_color}` : "",
      style.card_border_color ? `--ha-card-border-color: ${style.card_border_color}` : "",
      style.card_border_color ? "--ha-card-border-width: 1px" : "",
      style.shadow_frame_color ? `--dashboard-layout-v2-shadow-frame-color: ${style.shadow_frame_color}` : "",
      style.shadow_frame_offset ? `--dashboard-layout-v2-shadow-frame-offset: ${style.shadow_frame_offset}` : "",
      style.shadow_frame_color
        ? `--ha-card-box-shadow: var(--dashboard-layout-v2-shadow-frame-offset, 4px) var(--dashboard-layout-v2-shadow-frame-offset, 4px) 0 0 ${style.shadow_frame_color}`
        : "",
    ].filter(Boolean).join(";");
  }

  render() {
    if (!this._config) return html``;
    const menu = normalizeMenu(this._config.menu);
    const position = this._menuPosition(menu);
    return html`
      <ha-card class=${`dashboard-layout-card menu-${position}`} style=${this._contentStyle(menu)}>
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
        weekday: "none",
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

      .menu-date.two-line {
        display: grid;
        justify-items: center;
        line-height: 1.12;
        text-align: center;
      }

      .analog-clock {
        position: relative;
        width: var(--dashboard-layout-v2-clock-size, 42px);
        height: var(--dashboard-layout-v2-clock-size, 42px);
        border: 2px solid var(--dashboard-layout-v2-icon-color, var(--primary-color));
        border-radius: 50%;
      }

      .analog-clock .mark {
        position: absolute;
        top: 4px;
        left: calc(50% - 1px);
        width: 2px;
        height: 6px;
        transform-origin: 1px calc((var(--dashboard-layout-v2-clock-size, 42px) / 2) - 4px);
        background: var(--primary-text-color);
        z-index: 1;
      }

      .analog-clock .minute-mark {
        position: absolute;
        top: 5px;
        left: calc(50% - 0.5px);
        width: 1px;
        height: 3px;
        transform-origin: 0.5px calc((var(--dashboard-layout-v2-clock-size, 42px) / 2) - 5px);
        background: var(--primary-text-color);
        opacity: 0.55;
        z-index: 0;
      }

      .hand {
        position: absolute;
        bottom: 50%;
        left: calc(50% - 1px);
        width: 2px;
        transform-origin: bottom center;
        background: var(--primary-text-color);
        z-index: 2;
      }

      .hand.hour {
        height: calc(var(--dashboard-layout-v2-clock-size, 42px) * 0.29);
      }

      .hand.minute {
        height: calc(var(--dashboard-layout-v2-clock-size, 42px) * 0.4);
      }

      .hand.second {
        left: calc(50% - 0.5px);
        width: 1px;
        height: calc(var(--dashboard-layout-v2-clock-size, 42px) * 0.43);
        background: var(--dashboard-layout-v2-icon-color, var(--primary-color));
      }

      .menu-pages {
        display: grid;
        gap: 6px;
      }

      .menu-spacer {
        height: 18px;
      }

      .menu-divider {
        height: 4px;
        margin: 10px 4px;
        border-radius: 999px;
        background: var(--dashboard-layout-v2-divider-color, #ffffff);
        box-shadow: var(--dashboard-layout-v2-shadow-frame-offset, 4px) var(--dashboard-layout-v2-shadow-frame-offset, 4px) 0 0 var(--dashboard-layout-v2-divider-shadow-frame-color, transparent);
      }

      .menu-pages button {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 40px;
        border: 1px solid var(--dashboard-layout-v2-tab-border-color, transparent);
        border-radius: 8px;
        box-sizing: border-box;
        box-shadow: var(--dashboard-layout-v2-shadow-frame-offset, 4px) var(--dashboard-layout-v2-shadow-frame-offset, 4px) 0 0 var(--dashboard-layout-v2-tab-shadow-frame-color, transparent);
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

      .menu-pages button.active ha-icon {
        color: var(
          --dashboard-layout-v2-icon-active-color,
          var(--dashboard-layout-v2-icon-color, var(--primary-color))
        );
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

      .menu-bottom {
        display: grid;
        gap: 8px;
        margin-top: auto;
        min-width: 0;
        max-width: 100%;
      }

      .menu-notify {
        min-width: 0;
        max-width: 100%;
        padding: 8px;
        border: 1px solid var(--dashboard-layout-v2-notify-border-color, var(--error-color, #db4437));
        border-radius: 8px;
        box-sizing: border-box;
        color: var(--primary-text-color);
        background: color-mix(in srgb, var(--dashboard-layout-v2-notify-border-color, var(--error-color, #db4437)) 10%, transparent);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }

      .menu-status {
        display: grid;
        gap: 4px;
        min-width: 0;
        max-width: 100%;
        padding: 8px;
        border: 1px solid var(--dashboard-layout-v2-status-border-color, #ffffff);
        border-radius: 8px;
        box-sizing: border-box;
        font-size: 12px;
        line-height: 1.25;
      }

      .status-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }

      .status-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .status-value {
        flex: none;
        font-weight: 700;
        white-space: nowrap;
      }

      .page {
        min-width: 0;
        margin-right: 5px;
        padding: 8px;
        border: 1px solid var(--dashboard-layout-v2-card-border-color, transparent);
        border-radius: var(--ha-card-border-radius, 12px);
        box-shadow: var(--dashboard-layout-v2-shadow-frame-offset, 4px) var(--dashboard-layout-v2-shadow-frame-offset, 4px) 0 0 var(--dashboard-layout-v2-shadow-frame-color, transparent);
        box-sizing: border-box;
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
