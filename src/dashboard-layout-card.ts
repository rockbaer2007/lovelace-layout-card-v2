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

function helperActive(hass: any, entityId?: string) {
  const id = String(entityId ?? "").trim();
  if (!id) return false;
  const value = String(hass?.states?.[id]?.state ?? "").trim().toLowerCase();
  return Boolean(value) && !["off", "false", "0", "unknown", "unavailable", "none"].includes(value);
}

function colorWithOpacity(color?: string, opacity?: number) {
  const value = String(color ?? "").trim();
  if (!value || value === "transparent") return value;
  const percent = Math.max(0, Math.min(100, Number(opacity ?? 100)));
  return `color-mix(in srgb, ${value} ${percent}%, transparent)`;
}

function iconSizeValue(value?: string | number) {
  const rawValue = String(value ?? "").trim();
  const numericValue = Number(rawValue.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numericValue) || numericValue <= 0) return "20px";
  return `${Math.max(14, Math.min(64, numericValue))}px`;
}

class DashboardLayoutCardV2 extends LitElement {
  @property() hass;
  @property() editMode = false;
  @property() lovelace;
  @property() _config: DashboardLayoutCardConfig;
  @property() _cards: Array<LovelaceCard> = [];
  @property() _layoutElement?: HTMLElement;
  @state() _activePage = 0;
  @state() _activeSubPage = -1;
  @state() _now = new Date();
  @state() _notifyOpen = false;

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
        subpages: Array.isArray(page.subpages)
          ? page.subpages.map((subpage) => ({
              ...subpage,
              cards: subpage.cards ?? [],
            }))
          : undefined,
      })),
    };
    this._activePage = Math.min(this._activePage, this._config.pages.length - 1);
    if (isMenuOnlyPage(this._config.pages[this._activePage])) {
      this._activePage = this._config.pages.findIndex((page) => !isMenuOnlyPage(page));
    }
    if (this._activePage < 0) this._activePage = 0;
    const activeSubpages = this._config.pages[this._activePage]?.subpages;
    if (!Array.isArray(activeSubpages) || this._activeSubPage >= activeSubpages.length) this._activeSubPage = -1;
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
    const page = this._pages[this._activePage] ?? this._pages[0];
    if (this._activeSubPage >= 0 && Array.isArray(page?.subpages)) {
      return page.subpages[this._activeSubPage] ?? page;
    }
    return page;
  }

  get _activeMainPageConfig(): DashboardLayoutPageConfig {
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
    if (isMenuOnlyPage(this._config.pages[index])) return;
    const page = this._config.pages[index];
    if (page?.hide_submenu_parent === true && Array.isArray(page.subpages)) {
      const firstSubpageIndex = page.subpages.findIndex((subpage) => !isMenuOnlyPage(subpage));
      if (firstSubpageIndex >= 0) {
        this._activePage = index;
        this._activeSubPage = firstSubpageIndex;
        await this._createActivePageLayout();
        return;
      }
    }
    if (index === this._activePage && this._activeSubPage < 0) return;
    this._activePage = index;
    this._activeSubPage = -1;
    await this._createActivePageLayout();
  }

  async _selectSubPage(index: number) {
    const mainPage = this._activeMainPageConfig;
    if (!Array.isArray(mainPage?.subpages) || isMenuOnlyPage(mainPage.subpages[index])) return;
    if (index === this._activeSubPage) return;
    this._activeSubPage = index;
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

  _activeDaySymbol(menu: DashboardLayoutMenuConfig) {
    const config = menu.day_symbol ?? {};
    if (helperActive(this.hass, config.birthday_entity)) {
      return { icon: "mdi:cake-variant", color: "#ff80ab", label: "Geburtstag" };
    }
    if (helperActive(this.hass, config.christmas_entity)) {
      return { icon: "mdi:pine-tree", color: "#1faa59", label: "Weihnachten/Advent" };
    }
    if (helperActive(this.hass, config.holiday_entity)) {
      return { icon: "mdi:calendar-star", color: "#ffd600", label: "Feiertag" };
    }
    return undefined;
  }

  _renderDaySymbol(menu: DashboardLayoutMenuConfig) {
    const symbol = this._activeDaySymbol(menu);
    if (!symbol) return html``;
    const size = menu.day_symbol?.size ?? "32px";
    return html`
      <ha-icon
        class="day-symbol"
        .icon=${symbol.icon}
        style=${`--dashboard-layout-v2-day-symbol-size: ${size}; --dashboard-layout-v2-day-symbol-color: ${symbol.color}`}
        title=${symbol.label}
      ></ha-icon>
    `;
  }

  _renderDate(menu: DashboardLayoutMenuConfig) {
    if (menu.date === false) return html``;
    const style = menu.style ?? {};
    const dateSize = Number(String(style.date_size ?? "12px").replace(/[^\d.]/g, "")) || 12;
    const wrapSize = Number(String(style.weekday_wrap_size ?? "21px").replace(/[^\d.]/g, "")) || 21;
    const isWeekend = [0, 6].includes(this._now.getDay());
    const weekendColor = isWeekend && menu.weekday !== "none" ? style.weekend_color?.trim() : "";
    const weekdayStyle = weekendColor ? `color: ${weekendColor}` : "";
    const date = this._now.toLocaleDateString();
    if (menu.weekday === "short") {
      const weekday = this._now.toLocaleDateString([], { weekday: "short" }).replace(/\.$/, "");
      return html`<span class="menu-date"><span style=${weekdayStyle}>${weekday}.</span> ${date}</span>`;
    }
    if (menu.weekday === "long") {
      const weekday = this._now.toLocaleDateString([], { weekday: "long" });
      return dateSize >= wrapSize
        ? html`<span class="menu-date two-line"><span style=${weekdayStyle}>${weekday}</span><span>${date}</span></span>`
        : html`<span class="menu-date"><span style=${weekdayStyle}>${weekday}</span> ${date}</span>`;
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

    const borderColor = colorWithOpacity(this._notifyBorderColor(menu), notify.border_opacity);
    return html`
      <div class="menu-notify" style=${`--dashboard-layout-v2-notify-border-color: ${borderColor}`}>
        ${message}
      </div>
    `;
  }

  _renderNotifyPopup(menu: DashboardLayoutMenuConfig) {
    const notify = menu.notify;
    if (notify?.enabled !== true) return html``;
    const entityId = notify.entity?.trim() || "input_text.dashboard_notification";
    const stateObj = this.hass?.states?.[entityId];
    const message = notifyMessage(stateObj?.state);
    if (!message) return html``;
    const borderColor = colorWithOpacity(this._notifyBorderColor(menu), notify.border_opacity);

    return html`
      <div class="notify-popup-wrap" style=${`--dashboard-layout-v2-notify-border-color: ${borderColor}`}>
        <button
          class=${`notify-popup-button${this._notifyOpen ? " active" : ""}`}
          type="button"
          aria-label="Meldungen anzeigen"
          title="Meldungen"
          @click=${(ev: Event) => {
            ev.stopPropagation();
            this._notifyOpen = !this._notifyOpen;
          }}
        >
          <ha-icon .icon=${"mdi:alert-circle-outline"}></ha-icon>
        </button>
        ${this._notifyOpen
          ? html`
              <div class="notify-popup" role="dialog" aria-label="Meldungen">
                <strong>Meldung</strong>
                <p>${message}</p>
                <button
                  type="button"
                  @click=${(ev: Event) => {
                    ev.stopPropagation();
                    this._notifyOpen = false;
                  }}
                >
                  Schließen
                </button>
              </div>
            `
          : html``}
      </div>
    `;
  }

  _renderStatus(menu: DashboardLayoutMenuConfig) {
    const status = menu.status;
    if (status?.enabled !== true) return html``;
    const items = (status.items ?? []).filter((item) => item?.entity);
    if (!items.length) return html``;

    const borderColor = colorWithOpacity(this._statusBorderColor(menu), status.border_opacity);
    return html`
      <div class="menu-status" style=${`--dashboard-layout-v2-status-border-color: ${borderColor}`}>
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

  _pageStyle(page: DashboardLayoutPageConfig) {
    return [
      page.tab_color ? `--dashboard-layout-v2-inactive-tab-color: ${page.tab_color}` : "",
      page.active_tab_color ? `--dashboard-layout-v2-active-tab-color: ${page.active_tab_color}` : "",
      page.icon_color ? `--dashboard-layout-v2-icon-color: ${page.icon_color}` : "",
      page.icon_active_color ? `--dashboard-layout-v2-icon-active-color: ${page.icon_active_color}` : "",
      page.icon_background_color ? `--dashboard-layout-v2-icon-background-color: ${page.icon_background_color}` : "",
      page.icon_background_active_color ? `--dashboard-layout-v2-icon-background-active-color: ${page.icon_background_active_color}` : "",
    ].filter(Boolean).join(";");
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
            `--dashboard-layout-v2-divider-color: ${colorWithOpacity(page.color || "#ffffff", page.divider_opacity)}`,
            `--dashboard-layout-v2-divider-shadow-frame-color: ${colorWithOpacity(page.shadow_frame_color || "transparent", page.divider_opacity)}`,
            `--dashboard-layout-v2-divider-height: ${page.height || "4px"}`,
          ].join(";")}
          aria-hidden="true"
        ></div>
      `;
    }

    return html`
      <button
        class=${index === this._activePage && this._activeSubPage < 0 ? "active" : ""}
        style=${this._pageStyle(page)}
        type="button"
        aria-label=${pageTitle(page)}
        title=${pageTitle(page)}
        @click=${() => this._selectPage(index)}
      >
        ${page.icon
          ? html`<span class="menu-icon-field"><ha-icon class="menu-icon" style=${this._iconInlineStyle()} .icon=${page.icon}></ha-icon></span>`
          : html`<span class="menu-icon-field mobile-fallback-icon"><ha-icon class="menu-icon" style=${this._iconInlineStyle()} .icon=${"mdi:view-dashboard"}></ha-icon></span>`}
        <span class="menu-page-label">${pageTitle(page)}</span>
      </button>
    `;
  }

  _activeSubPages() {
    const mainPage = this._activeMainPageConfig;
    return Array.isArray(mainPage?.subpages)
      ? [...(mainPage.hide_submenu_parent === true ? [] : [mainPage]), ...mainPage.subpages]
      : [];
  }

  _subMenuOffset() {
    const menu = normalizeMenu(this._config.menu);
    if (menu.icon_only === true) return 50;
    const hasClock = menu.clock !== "none";
    const hasDate = menu.date !== false;
    if (hasClock && hasDate) return 250;
    if (hasClock) return 200;
    if (hasDate) return 150;
    return 50;
  }

  _iconInlineStyle() {
    const menu = normalizeMenu(this._config.menu);
    const size = iconSizeValue(menu.style?.icon_size);
    const numericSize = Number(size.replace(/[^\d.]/g, "")) || 20;
    const scale = Math.max(0.58, Math.min(2.67, numericSize / 24));
    return [
      `--dashboard-layout-v2-icon-size: ${size}`,
      "--mdc-icon-size: 24px",
      "--ha-icon-size: 24px",
      "--iron-icon-width: 24px",
      "--iron-icon-height: 24px",
      "width: 24px !important",
      "height: 24px !important",
      "min-width: 24px !important",
      "font-size: 24px",
      `transform: scale(${scale})`,
      "transform-origin: center",
    ].join(";");
  }

  _renderSubMenu() {
    const menu = normalizeMenu(this._config.menu);
    const style = menu.style ?? {};
    const mainPage = this._activeMainPageConfig;
    const subpages = this._activeSubPages();
    const submenuBackground = style.submenu_background_color
      ? colorWithOpacity(style.submenu_background_color, style.submenu_background_opacity)
      : "";
    return html`
      <nav
        class="submenu"
        aria-label=${`${pageTitle(mainPage)} Untermenü`}
        style=${[
          `--dashboard-layout-v2-submenu-offset: ${this._subMenuOffset()}px`,
          submenuBackground ? `--dashboard-layout-v2-menu-background: ${submenuBackground}` : "",
        ].filter(Boolean).join(";")}
      >
        ${subpages.length
          ? html`
              <div class="submenu-pages">
                ${subpages.map((page, index) => this._renderSubMenuItem(page, index))}
              </div>
            `
          : html`<div class="submenu-pages" aria-hidden="true"></div>`}
      </nav>
    `;
  }

  _renderSubMenuItem(page: DashboardLayoutPageConfig, index: number) {
    if (isMenuOnlyPage(page)) return html``;
    return html`
      <button
        class=${(index === 0 && this._activeSubPage < 0) || index - 1 === this._activeSubPage ? "active" : ""}
        style=${this._pageStyle(page)}
        type="button"
        aria-label=${pageTitle(page)}
        title=${pageTitle(page)}
        @click=${() => (index === 0 ? this._selectPage(this._activePage) : this._selectSubPage(index - 1))}
      >
        ${page.icon
          ? html`<span class="menu-icon-field"><ha-icon class="menu-icon" style=${this._iconInlineStyle()} .icon=${page.icon}></ha-icon></span>`
          : html`<span class="menu-icon-field mobile-fallback-icon"><ha-icon class="menu-icon" style=${this._iconInlineStyle()} .icon=${"mdi:view-dashboard"}></ha-icon></span>`}
        <span class="menu-page-label">${pageTitle(page)}</span>
      </button>
    `;
  }

  _renderMenu(menu: DashboardLayoutMenuConfig) {
    if (this._menuPosition(menu) === "none") return html``;
    const style = menu.style ?? {};
    const iconOnly = menu.icon_only === true;
    const background =
      style.background_mode === "color" && style.background_color
        ? colorWithOpacity(style.background_color, style.background_opacity)
        : style.background_mode === "image" && style.background_image
          ? `center / cover no-repeat url("${style.background_image}")`
          : "";
    return html`
      <nav
        class=${`menu${iconOnly ? " icon-only" : ""}`}
        aria-label="Dashboard pages"
        style=${[
          style.icon_color ? `--dashboard-layout-v2-icon-color: ${style.icon_color}` : "",
          style.icon_active_color ? `--dashboard-layout-v2-icon-active-color: ${style.icon_active_color}` : "",
          style.icon_background_color || style.icon_circle_color
            ? `--dashboard-layout-v2-icon-background-color: ${style.icon_background_color ?? style.icon_circle_color}`
            : "",
          style.icon_background_active_color ? `--dashboard-layout-v2-icon-background-active-color: ${style.icon_background_active_color}` : "",
          style.icon_shape === "circle" ? "--dashboard-layout-v2-icon-radius: 50%" : "--dashboard-layout-v2-icon-radius: 8px",
          style.icon_size ? `--dashboard-layout-v2-icon-size: ${iconSizeValue(style.icon_size)}` : "",
          "--dashboard-layout-v2-icon-column-width: max(64px, calc(var(--dashboard-layout-v2-icon-size, 20px) + 36px))",
          style.active_tab_color ? `--dashboard-layout-v2-active-tab-color: ${style.active_tab_color}` : "",
          style.inactive_tab_color ? `--dashboard-layout-v2-inactive-tab-color: ${style.inactive_tab_color}` : "",
          style.hover_tab_color ? `--dashboard-layout-v2-hover-tab-color: ${style.hover_tab_color}` : "",
          style.active_tab_text_color ? `--dashboard-layout-v2-active-tab-text-color: ${style.active_tab_text_color}` : "",
          style.inactive_tab_text_color ? `--dashboard-layout-v2-inactive-tab-text-color: ${style.inactive_tab_text_color}` : "",
          style.hover_tab_text_color ? `--dashboard-layout-v2-hover-tab-text-color: ${style.hover_tab_text_color}` : "",
          style.tab_border_color ? `--dashboard-layout-v2-tab-border-color: ${colorWithOpacity(style.tab_border_color, style.tab_border_opacity)}` : "",
          style.tab_shadow_frame_color ? `--dashboard-layout-v2-tab-shadow-frame-color: ${style.tab_shadow_frame_color}` : "",
          style.shadow_frame_offset ? `--dashboard-layout-v2-shadow-frame-offset: ${style.shadow_frame_offset}` : "",
          style.clock_size ? `--dashboard-layout-v2-clock-size: ${style.clock_size}` : "",
          style.date_size ? `--dashboard-layout-v2-date-size: ${style.date_size}` : "",
          style.clock_color ? `--dashboard-layout-v2-clock-color: ${style.clock_color}` : "",
          style.analog_minute_mark_color ? `--dashboard-layout-v2-analog-minute-mark-color: ${style.analog_minute_mark_color}` : "",
          style.analog_hour_mark_color ? `--dashboard-layout-v2-analog-hour-mark-color: ${style.analog_hour_mark_color}` : "",
          style.analog_hour_hand_color ? `--dashboard-layout-v2-analog-hour-hand-color: ${style.analog_hour_hand_color}` : "",
          style.analog_minute_hand_color ? `--dashboard-layout-v2-analog-minute-hand-color: ${style.analog_minute_hand_color}` : "",
          style.analog_second_hand_color ? `--dashboard-layout-v2-analog-second-hand-color: ${style.analog_second_hand_color}` : "",
          background ? `--dashboard-layout-v2-menu-background: ${background}` : "",
        ].filter(Boolean).join(";")}
      >
        <header class="menu-header">
          ${menu.title ? html`<span class="menu-title">${menu.title}</span>` : ""}
          ${this._renderClock(menu)}
          ${this._renderDaySymbol(menu)}
          ${this._renderDate(menu)}
        </header>
        ${this._renderNotifyPopup(menu)}
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
      style.card_border_color ? `--dashboard-layout-v2-card-border-color: ${colorWithOpacity(style.card_border_color, style.card_border_opacity)}` : "",
      style.card_border_color ? `--ha-card-border-color: ${colorWithOpacity(style.card_border_color, style.card_border_opacity)}` : "",
      style.card_border_color ? "--ha-card-border-width: 1px" : "",
      "--dashboard-layout-v2-icon-column-width: max(64px, calc(var(--dashboard-layout-v2-icon-size, 20px) + 36px))",
      style.icon_size ? `--dashboard-layout-v2-icon-size: ${iconSizeValue(style.icon_size)}` : "",
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
    const iconOnly = menu.icon_only === true;
    return html`
      <ha-card
        class=${`dashboard-layout-card menu-${position}${iconOnly ? " menu-icon-only" : ""}`}
        style=${this._contentStyle(menu)}
      >
        ${position === "left" ? this._renderMenu(menu) : ""}
        ${position === "left" ? this._renderSubMenu() : ""}
        <main class="page">${this._layoutElement}</main>
        ${position === "right" ? this._renderSubMenu() : ""}
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
        icon_only: false,
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
        grid-template-columns: minmax(132px, 196px) var(--dashboard-layout-v2-icon-column-width, 64px) minmax(0, 1fr);
        min-height: 320px;
        overflow: hidden;
      }

      ha-card.menu-right {
        grid-template-columns: minmax(0, 1fr) var(--dashboard-layout-v2-icon-column-width, 64px) minmax(132px, 196px);
      }

      ha-card.menu-icon-only {
        grid-template-columns: var(--dashboard-layout-v2-icon-column-width, 64px) var(--dashboard-layout-v2-icon-column-width, 64px) minmax(0, 1fr);
      }

      ha-card.menu-right.menu-icon-only {
        grid-template-columns: minmax(0, 1fr) var(--dashboard-layout-v2-icon-column-width, 64px) var(--dashboard-layout-v2-icon-column-width, 64px);
      }

      ha-card.menu-none {
        display: block;
      }

      .menu,
      .submenu {
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

      .submenu {
        border-right: 1px solid var(--divider-color);
        border-left: 0;
        padding-inline: 8px;
      }

      .submenu-pages {
        margin-top: var(--dashboard-layout-v2-submenu-offset, 0px);
      }

      ha-card.menu-right .submenu {
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
        color: var(--dashboard-layout-v2-clock-color, var(--primary-text-color));
        font-size: 28px;
        line-height: 1;
      }

      .menu-date {
        color: var(--secondary-text-color);
        font-size: var(--dashboard-layout-v2-date-size, 12px);
      }

      .day-symbol {
        color: var(--dashboard-layout-v2-day-symbol-color, var(--primary-color));
        width: var(--dashboard-layout-v2-day-symbol-size, 32px);
        height: var(--dashboard-layout-v2-day-symbol-size, 32px);
        --mdc-icon-size: var(--dashboard-layout-v2-day-symbol-size, 32px);
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
        border: 2px solid var(--dashboard-layout-v2-clock-color, var(--dashboard-layout-v2-icon-color, var(--primary-color)));
        border-radius: 50%;
      }

      .analog-clock .mark {
        position: absolute;
        top: 4px;
        left: calc(50% - 1px);
        width: 2px;
        height: 6px;
        transform-origin: 1px calc((var(--dashboard-layout-v2-clock-size, 42px) / 2) - 4px);
        background: var(--dashboard-layout-v2-analog-hour-mark-color, var(--primary-text-color));
        z-index: 1;
      }

      .analog-clock .minute-mark {
        position: absolute;
        top: 5px;
        left: calc(50% - 0.5px);
        width: 1px;
        height: 3px;
        transform-origin: 0.5px calc((var(--dashboard-layout-v2-clock-size, 42px) / 2) - 5px);
        background: var(--dashboard-layout-v2-analog-minute-mark-color, var(--primary-text-color));
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
        background: var(--dashboard-layout-v2-analog-hour-hand-color, var(--primary-text-color));
      }

      .hand.minute {
        height: calc(var(--dashboard-layout-v2-clock-size, 42px) * 0.4);
        background: var(--dashboard-layout-v2-analog-minute-hand-color, var(--primary-text-color));
      }

      .hand.second {
        left: calc(50% - 0.5px);
        width: 1px;
        height: calc(var(--dashboard-layout-v2-clock-size, 42px) * 0.43);
        background: var(--dashboard-layout-v2-analog-second-hand-color, var(--dashboard-layout-v2-icon-color, var(--primary-color)));
      }

      .menu-pages,
      .submenu-pages {
        display: grid;
        gap: 6px;
      }

      .submenu-pages {
        align-content: start;
      }

      .menu-spacer {
        height: 18px;
      }

      .menu-divider {
        height: var(--dashboard-layout-v2-divider-height, 4px);
        margin: 10px 4px;
        border-radius: 999px;
        background: var(--dashboard-layout-v2-divider-color, #ffffff);
        box-shadow: var(--dashboard-layout-v2-divider-height, 4px) var(--dashboard-layout-v2-divider-height, 4px) 0 0 var(--dashboard-layout-v2-divider-shadow-frame-color, transparent);
      }

      .menu-pages button,
      .submenu-pages button {
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

      .menu-pages button:hover,
      .submenu-pages button:hover {
        color: var(--dashboard-layout-v2-hover-tab-text-color, var(--dashboard-layout-v2-inactive-tab-text-color, var(--primary-text-color)));
        background: var(--dashboard-layout-v2-hover-tab-color, transparent);
      }

      .menu-pages button.active,
      .submenu-pages button.active {
        color: var(--dashboard-layout-v2-active-tab-text-color, var(--text-primary-color, #fff));
        background: var(--dashboard-layout-v2-active-tab-color, var(--primary-color));
      }

      .menu-pages button.active .menu-icon-field,
      .submenu-pages button.active .menu-icon-field {
        color: var(
          --dashboard-layout-v2-icon-active-color,
          var(--dashboard-layout-v2-icon-color, var(--primary-color))
        );
        background: var(
          --dashboard-layout-v2-icon-background-active-color,
          var(--dashboard-layout-v2-icon-background-color, transparent)
        );
      }

      .menu-icon-field {
        --mdc-icon-size: var(--dashboard-layout-v2-icon-size, 20px);
        --ha-icon-size: var(--dashboard-layout-v2-icon-size, 20px);
        --iron-icon-width: var(--dashboard-layout-v2-icon-size, 20px);
        --iron-icon-height: var(--dashboard-layout-v2-icon-size, 20px);
        display: inline-grid;
        place-items: center;
        width: calc(var(--dashboard-layout-v2-icon-size, 20px) + 10px);
        height: calc(var(--dashboard-layout-v2-icon-size, 20px) + 10px);
        min-width: calc(var(--dashboard-layout-v2-icon-size, 20px) + 10px);
        padding: 4px;
        box-sizing: border-box;
        border-radius: var(--dashboard-layout-v2-icon-radius, 8px);
        background: var(--dashboard-layout-v2-icon-background-color, transparent);
        color: var(--dashboard-layout-v2-icon-color, var(--primary-color));
        font-size: var(--dashboard-layout-v2-icon-size, 20px);
        line-height: 1;
      }

      .menu-icon {
        --mdc-icon-size: var(--dashboard-layout-v2-icon-size, 20px);
        --ha-icon-size: var(--dashboard-layout-v2-icon-size, 20px);
        --iron-icon-width: var(--dashboard-layout-v2-icon-size, 20px);
        --iron-icon-height: var(--dashboard-layout-v2-icon-size, 20px);
        width: var(--dashboard-layout-v2-icon-size, 20px) !important;
        height: var(--dashboard-layout-v2-icon-size, 20px) !important;
        min-width: var(--dashboard-layout-v2-icon-size, 20px);
        color: currentColor;
        font-size: var(--dashboard-layout-v2-icon-size, 20px);
        line-height: 1;
      }

      .menu-bottom {
        display: grid;
        gap: 8px;
        margin-top: auto;
        min-width: 0;
        max-width: 100%;
      }

      .notify-popup-wrap {
        display: none;
        position: relative;
        justify-self: center;
      }

      .notify-popup-button {
        display: inline-grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border: 1px solid var(--dashboard-layout-v2-notify-border-color, var(--error-color, #db4437));
        border-radius: 8px;
        color: var(--dashboard-layout-v2-notify-border-color, var(--error-color, #db4437));
        background: color-mix(in srgb, var(--dashboard-layout-v2-notify-border-color, var(--error-color, #db4437)) 12%, transparent);
        cursor: pointer;
      }

      .notify-popup-button.active {
        color: var(--dashboard-layout-v2-active-tab-text-color, var(--text-primary-color, #fff));
        background: var(--dashboard-layout-v2-notify-border-color, var(--error-color, #db4437));
      }

      .notify-popup-button ha-icon {
        --mdc-icon-size: 24px;
      }

      .notify-popup {
        position: absolute;
        left: calc(100% + 10px);
        bottom: 0;
        z-index: 20;
        width: min(280px, calc(100vw - 120px));
        padding: 12px;
        border: 1px solid var(--dashboard-layout-v2-notify-border-color, var(--error-color, #db4437));
        border-radius: 12px;
        box-sizing: border-box;
        color: var(--primary-text-color);
        background: var(--card-background-color, #1c1c1c);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        text-align: left;
      }

      ha-card.menu-right .notify-popup {
        right: calc(100% + 10px);
        left: auto;
      }

      .notify-popup strong {
        display: block;
        margin-bottom: 6px;
        color: var(--dashboard-layout-v2-notify-border-color, var(--error-color, #db4437));
      }

      .notify-popup p {
        margin: 0 0 10px;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }

      .notify-popup button {
        min-height: 32px;
        padding: 6px 10px;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        color: var(--primary-text-color);
        background: var(--secondary-background-color, transparent);
      }

      .mobile-fallback-icon {
        display: none;
      }

      .menu.icon-only .menu-page-label,
      .submenu-pages .menu-page-label {
        display: none;
      }

      .menu.icon-only .menu-header,
      .menu.icon-only .menu-notify,
      .menu.icon-only .menu-status {
        display: none;
      }

      .menu.icon-only .notify-popup-wrap {
        display: block;
      }

      .menu.icon-only .menu-pages button,
      .submenu-pages button {
        justify-content: center;
        min-height: 44px;
        width: calc(var(--dashboard-layout-v2-icon-size, 20px) + 28px);
        max-width: calc(var(--dashboard-layout-v2-icon-size, 20px) + 28px);
        justify-self: center;
        gap: 0;
        padding-inline: 6px;
      }

      .menu.icon-only .mobile-fallback-icon,
      .submenu-pages .mobile-fallback-icon {
        display: inline-grid;
      }

      @media (max-width: 600px) {
        .menu-page-label {
          display: none;
        }

        .menu-pages button,
        .submenu-pages button {
          justify-content: center;
          min-height: 44px;
          gap: 0;
        }

        .menu-header,
        .menu-notify,
        .menu-status {
          display: none;
        }

        .notify-popup-wrap {
          display: block;
        }

        .mobile-fallback-icon {
          display: inline-grid;
        }

        .submenu {
          padding-inline: 8px;
        }
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
        margin-bottom: 5px;
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
