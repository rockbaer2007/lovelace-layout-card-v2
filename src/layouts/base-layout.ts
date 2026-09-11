import { css, html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import {
  CardConfig,
  CardConfigGroup,
  DashboardLayoutChromeConfig,
  DashboardLayoutMenuConfig,
  HuiCard,
  LovelaceCard,
  ViewConfig,
} from "../types";
import { applyHaChromeVisibility } from "../ha-chrome";

function isDashboardLayoutV2MenuOnlyPage(page: any) {
  return page?.type === "spacer" || page?.type === "divider";
}

function dashboardLayoutV2PageTitle(page: any) {
  return String(page?.title ?? page?.name ?? page?.path ?? "");
}

export class BaseLayout extends LitElement {
  @property() cards: Array<LovelaceCard | HuiCard> = [];
  @property() index: number;
  @property() narrow: boolean;
  @property() hass;
  @property() lovelace: any;
  @property() _editMode: boolean = false;
  _editorLoaded = false;

  @property() _config: ViewConfig;

  async setConfig(config: ViewConfig) {
    this._config = { ...config };
    if (this._config.view_layout && this._config.layout === undefined) {
      // Maybe avoid a bit of confusion...
      this._config.layout = this._config.view_layout;
    }
  }

  async updated(changedProperties: Map<string, any>) {
    if (
      changedProperties.has("lovelace") &&
      this.lovelace?.editMode != changedProperties.get("lovelace")?.editMode
    ) {
      if (this.lovelace?.editMode && !this._editorLoaded) {
        this._editorLoaded = true;
        {
          // Load in editor elements
          const loader = document.createElement("hui-masonry-view");
          (loader as any).lovelace = { editMode: true };
          (loader as any).willUpdate(new Map());
        }
      }
      this.cards.forEach((c) => (c.editMode = this.lovelace?.editMode));
      this._editMode = this.lovelace?.editMode ?? false;
    }
    applyHaChromeVisibility(this.hass, this._dashboardLayoutV2Chrome());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    applyHaChromeVisibility(this.hass, undefined);
  }

  _shouldShow(card: LovelaceCard | HuiCard, config: CardConfig, index: number) {
    if (config.view_layout?.show === "always") return true;
    if (config.view_layout?.show === "never") return false;
    if (
      config.view_layout?.show?.sidebar === "shown" &&
      (this.hass?.dockedSidebar === "auto" || this.narrow)
    )
      return false;
    if (
      config.view_layout?.show?.sidebar === "hidden" &&
      this.hass?.dockedSidebar === "docked" &&
      !this.narrow
    )
      return false;
    return true;
  }

  getCardElement(card: CardConfigGroup) {
    if (!this.lovelace?.editMode) return card.card;
    const wrapper = document.createElement("hui-card-options") as any;
    wrapper.hass = this.hass;
    wrapper.lovelace = this.lovelace;
    wrapper.path = [this.index, card.index];
    card.card.editMode = true;
    wrapper.appendChild(card.card);
    if (card.show === false) wrapper.style.border = "1px solid red";
    return wrapper;
  }

  _addCard() {
    this.dispatchEvent(new CustomEvent("ll-create-card"));
  }

  _render_fab() {
    if (!this.lovelace?.editMode === true) return html``;
    return html`
      <ha-fab .label=${"Add card"} extended @click=${this._addCard}>
        <ha-icon slot="icon" .icon=${"mdi:plus"}></ha-icon>
      </ha-fab>
    `;
  }

  _dashboardLayoutV2Menu(): DashboardLayoutMenuConfig {
    const parentConfig = this._dashboardLayoutV2ParentConfig();
    const usesParentConfig = Boolean(parentConfig && this._config.subview);
    const localMenu = usesParentConfig ? {} : this._config.layout?.dashboard_layout_v2?.menu ?? {};
    const parentMenu = parentConfig?.menu ?? {};

    return {
      position: "none",
      ...parentMenu,
      ...localMenu,
      home: {
        ...(parentMenu.home ?? {}),
        ...(localMenu.home ?? {}),
      },
      style: {
        ...(parentMenu.style ?? {}),
        ...(localMenu.style ?? {}),
      },
    };
  }

  _dashboardLayoutV2ParentConfig() {
    const localConfig = this._config.layout?.dashboard_layout_v2 ?? {};
    const views = this.lovelace?.rawConfig?.views ?? this.lovelace?.config?.views ?? [];
    const currentView = this._config ?? this.lovelace?.config?.views?.[this.index];
    const currentPath = String(currentView?.path ?? this.index ?? "");
    if (!Array.isArray(views)) return undefined;
    const inheritedPath = localConfig.inherits_from;
    const referencedParent = inheritedPath
      ? views.find((view, index) => String(view?.path ?? index) === String(inheritedPath))
      : undefined;
    if (referencedParent) {
      return referencedParent?.layout?.dashboard_layout_v2 ?? referencedParent?.dashboard_layout_v2;
    }

    const parentView = Array.isArray(views)
      ? views.find((view, index) => {
          if (index === this.index || view?.subview) return false;
          const pages = view?.layout?.dashboard_layout_v2?.pages ?? view?.dashboard_layout_v2?.pages ?? [];
          return Array.isArray(pages) && pages.some((page) => String(page?.path ?? "") === currentPath);
        })
      : undefined;
    return parentView?.layout?.dashboard_layout_v2 ?? parentView?.dashboard_layout_v2;
  }

  _dashboardLayoutV2Chrome(): DashboardLayoutChromeConfig | undefined {
    const parentConfig = this._dashboardLayoutV2ParentConfig();
    if (parentConfig && this._config.subview) return parentConfig.chrome;
    return this._config.layout?.dashboard_layout_v2?.chrome ?? parentConfig?.chrome;
  }

  _dashboardLayoutV2Pages() {
    const parentConfig = this._dashboardLayoutV2ParentConfig();
    const configuredPages =
      parentConfig && this._config.subview
        ? parentConfig.pages
        : this._config.layout?.dashboard_layout_v2?.pages ?? parentConfig?.pages;
    const sourcePages = configuredPages?.length
      ? configuredPages
      : (this.lovelace?.config?.views ?? [])
      .filter((view) => String(view.type ?? "").endsWith("-layout-v2") && view.subview)
      .map((view, index) => ({
        title: view.title ?? view.path ?? `View ${index + 1}`,
        icon: view.icon,
        path: view.path ?? String(index),
      }));
    const menu = this._dashboardLayoutV2Menu();
    if (menu.show_home === false) return sourcePages;

    const views = this.lovelace?.rawConfig?.views ?? this.lovelace?.config?.views ?? [];
    const currentView = this._config ?? this.lovelace?.config?.views?.[this.index];
    const currentPath = String(currentView?.path ?? this.index ?? "");
    const parentView = Array.isArray(views)
      ? views.find((view, index) => {
          if (index === this.index || view?.subview) return false;
          const pages = view?.layout?.dashboard_layout_v2?.pages ?? view?.dashboard_layout_v2?.pages ?? [];
          return Array.isArray(pages) && pages.some((page) => String(page?.path ?? "") === currentPath);
        })
      : undefined;
    const parentMenu = parentView?.layout?.dashboard_layout_v2?.menu ?? parentView?.dashboard_layout_v2?.menu;
    const parentHome = parentMenu?.home;
    const homePath = String(
      menu.home?.path ?? parentHome?.path ?? parentView?.path ?? currentView?.path ?? this.index ?? "home"
    );
    const homePage = {
      title: menu.home?.title ?? parentHome?.title ?? parentView?.title ?? currentView?.title ?? homePath ?? "Home",
      icon: menu.home?.icon ?? parentHome?.icon ?? parentView?.icon ?? currentView?.icon ?? "mdi:home",
      path: homePath,
    };

    return [
      homePage,
      ...sourcePages.filter((page) => String(page.path ?? "") !== homePath),
    ];
  }

  _navigateDashboardLayoutV2Page(path?: string) {
    if (!path) return;
    const basePath = location.pathname.split("/").slice(0, -1).join("/");
    history.pushState(null, "", `${basePath}/${path}`);
    window.dispatchEvent(new Event("location-changed"));
  }

  _renderDashboardLayoutV2MenuItem(page: any) {
    if (page?.type === "spacer") {
      return html`<div class="dashboard-layout-v2-menu-spacer" aria-hidden="true"></div>`;
    }
    if (page?.type === "divider") {
      return html`
        <div
          class="dashboard-layout-v2-menu-divider"
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
        class=${location.pathname.endsWith(`/${page.path}`) ? "active" : ""}
        @click=${() => this._navigateDashboardLayoutV2Page(page.path)}
      >
        ${page.icon ? html`<ha-icon .icon=${page.icon}></ha-icon>` : ""}
        <span>${dashboardLayoutV2PageTitle(page)}</span>
      </button>
    `;
  }

  _renderDashboardLayoutV2Clock(menu: DashboardLayoutMenuConfig) {
    if (menu.clock === "none") return html``;
    if (menu.clock === "analog") {
      const now = new Date();
      const seconds = now.getSeconds();
      const minutes = now.getMinutes() + seconds / 60;
      const hours = (now.getHours() % 12) + minutes / 60;
      return html`
        <div class="dashboard-layout-v2-analog-clock" aria-label="Analoge Uhr">
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
    return html`<span>${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>`;
  }

  _renderDashboardLayoutV2Date(menu: DashboardLayoutMenuConfig) {
    if (menu.date === false) return html``;
    const style = menu.style ?? {};
    const dateSize = Number(String(style.date_size ?? "12px").replace(/[^\d.]/g, "")) || 12;
    const wrapSize = Number(String(style.weekday_wrap_size ?? "21px").replace(/[^\d.]/g, "")) || 21;
    const now = new Date();
    const date = now.toLocaleDateString();
    if (menu.weekday === "short") {
      const weekday = now.toLocaleDateString([], { weekday: "short" }).replace(/\.$/, "");
      return html`<small>${weekday}. ${date}</small>`;
    }
    if (menu.weekday === "long") {
      const weekday = now.toLocaleDateString([], { weekday: "long" });
      return dateSize >= wrapSize
        ? html`<small class="two-line"><span>${weekday}</span><span>${date}</span></small>`
        : html`<small>${weekday} ${date}</small>`;
    }
    return html`<small>${date}</small>`;
  }

  _renderDashboardLayoutV2Menu() {
    const menu = this._dashboardLayoutV2Menu();
    if (menu.position === "none") return html``;

    const pages = this._dashboardLayoutV2Pages();
    const style = menu.style ?? {};
    const background =
      style.background_mode === "color" && style.background_color
        ? style.background_color
        : style.background_mode === "image" && style.background_image
          ? `center / cover no-repeat url("${style.background_image}")`
          : "";

    return html`
      <aside
        class="dashboard-layout-v2-menu"
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
          style.tab_border_color ? `--dashboard-layout-v2-tab-border-color: ${style.tab_border_color}` : "",
          style.tab_shadow_frame_color ? `--dashboard-layout-v2-tab-shadow-frame-color: ${style.tab_shadow_frame_color}` : "",
          style.shadow_frame_offset ? `--dashboard-layout-v2-shadow-frame-offset: ${style.shadow_frame_offset}` : "",
          style.clock_size ? `--dashboard-layout-v2-clock-size: ${style.clock_size}` : "",
          style.date_size ? `--dashboard-layout-v2-date-size: ${style.date_size}` : "",
          background ? `--dashboard-layout-v2-menu-background: ${background}` : "",
        ].filter(Boolean).join(";")}
      >
        <header>
          ${menu.title ? html`<strong>${menu.title}</strong>` : ""}
          ${this._renderDashboardLayoutV2Clock(menu)}
          ${this._renderDashboardLayoutV2Date(menu)}
        </header>
        <nav>
          ${pages.map((page) => this._renderDashboardLayoutV2MenuItem(page))}
        </nav>
      </aside>
    `;
  }

  _dashboardLayoutV2ContentStyle(menu: DashboardLayoutMenuConfig) {
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

  _renderDashboardLayoutV2Shell(content) {
    const menu = this._dashboardLayoutV2Menu();
    if (menu.position === "none") return content;

    return html`
      <section class=${`dashboard-layout-v2-shell menu-${menu.position}`} style=${this._dashboardLayoutV2ContentStyle(menu)}>
        ${menu.position === "left" ? this._renderDashboardLayoutV2Menu() : ""}
        <div class="dashboard-layout-v2-content">${content}</div>
        ${menu.position === "right" ? this._renderDashboardLayoutV2Menu() : ""}
      </section>
    `;
  }

  static get _fab_styles() {
    return css`
      ha-fab {
        position: fixed;
        right: calc(16px + env(safe-area-inset-right));
        bottom: calc(16px + env(safe-area-inset-bottom));
        z-index: 1;
      }

      .dashboard-layout-v2-shell {
        display: grid;
        grid-template-columns: minmax(160px, 220px) minmax(0, 1fr);
        gap: 12px;
        height: 100%;
      }

      .dashboard-layout-v2-shell.menu-right {
        grid-template-columns: minmax(0, 1fr) minmax(160px, 220px);
      }

      .dashboard-layout-v2-content {
        min-width: 0;
        border: 1px solid var(--dashboard-layout-v2-card-border-color, transparent);
        border-radius: var(--ha-card-border-radius, 12px);
        box-shadow: var(--dashboard-layout-v2-shadow-frame-offset, 4px) var(--dashboard-layout-v2-shadow-frame-offset, 4px) 0 0 var(--dashboard-layout-v2-shadow-frame-color, transparent);
        box-sizing: border-box;
      }

      .dashboard-layout-v2-menu {
        display: grid;
        align-content: start;
        gap: 12px;
        padding: 8px;
        border-radius: 12px;
        background: var(
          --dashboard-layout-v2-menu-background,
          var(--card-background-color, rgba(0, 0, 0, 0.18))
        );
      }

      .dashboard-layout-v2-menu header {
        display: grid;
        justify-items: center;
        text-align: center;
        gap: 2px;
        padding: 4px 6px 8px;
      }

      .dashboard-layout-v2-menu header strong {
        color: var(--dashboard-layout-v2-inactive-tab-text-color, var(--primary-text-color));
      }

      .dashboard-layout-v2-menu small {
        color: var(--secondary-text-color);
        font-size: var(--dashboard-layout-v2-date-size, 12px);
      }

      .dashboard-layout-v2-menu small.two-line {
        display: grid;
        justify-items: center;
        line-height: 1.12;
        text-align: center;
      }

      .dashboard-layout-v2-analog-clock {
        position: relative;
        width: var(--dashboard-layout-v2-clock-size, 44px);
        height: var(--dashboard-layout-v2-clock-size, 44px);
        border: 2px solid var(--dashboard-layout-v2-icon-color, var(--primary-color));
        border-radius: 50%;
      }

      .dashboard-layout-v2-analog-clock .mark {
        position: absolute;
        top: 4px;
        left: calc(50% - 1px);
        width: 2px;
        height: 6px;
        transform-origin: 1px calc((var(--dashboard-layout-v2-clock-size, 44px) / 2) - 4px);
        background: var(--primary-text-color);
        z-index: 1;
      }

      .dashboard-layout-v2-analog-clock .minute-mark {
        position: absolute;
        top: 5px;
        left: calc(50% - 0.5px);
        width: 1px;
        height: 3px;
        transform-origin: 0.5px calc((var(--dashboard-layout-v2-clock-size, 44px) / 2) - 5px);
        background: var(--primary-text-color);
        opacity: 0.55;
        z-index: 0;
      }

      .dashboard-layout-v2-analog-clock::after {
        content: "";
        position: absolute;
        width: calc(var(--dashboard-layout-v2-clock-size, 44px) * 0.14);
        height: calc(var(--dashboard-layout-v2-clock-size, 44px) * 0.14);
        top: calc(50% - (var(--dashboard-layout-v2-clock-size, 44px) * 0.07));
        left: calc(50% - (var(--dashboard-layout-v2-clock-size, 44px) * 0.07));
        border-radius: 50%;
        background: var(--primary-text-color);
        z-index: 3;
      }

      .dashboard-layout-v2-analog-clock .hand {
        position: absolute;
        bottom: 50%;
        left: calc(50% - 1px);
        width: 2px;
        transform-origin: bottom center;
        background: var(--primary-text-color);
        z-index: 2;
      }

      .dashboard-layout-v2-analog-clock .hand.hour {
        height: calc(var(--dashboard-layout-v2-clock-size, 44px) * 0.3);
      }

      .dashboard-layout-v2-analog-clock .hand.minute {
        height: calc(var(--dashboard-layout-v2-clock-size, 44px) * 0.41);
      }

      .dashboard-layout-v2-analog-clock .hand.second {
        left: calc(50% - 0.5px);
        width: 1px;
        height: calc(var(--dashboard-layout-v2-clock-size, 44px) * 0.43);
        background: var(--dashboard-layout-v2-icon-color, var(--primary-color));
      }

      .dashboard-layout-v2-menu nav {
        display: grid;
        gap: 6px;
      }

      .dashboard-layout-v2-menu-spacer {
        height: 18px;
      }

      .dashboard-layout-v2-menu-divider {
        height: 4px;
        margin: 10px 4px;
        border-radius: 999px;
        background: var(--dashboard-layout-v2-divider-color, #ffffff);
        box-shadow: var(--dashboard-layout-v2-shadow-frame-offset, 4px) var(--dashboard-layout-v2-shadow-frame-offset, 4px) 0 0 var(--dashboard-layout-v2-divider-shadow-frame-color, transparent);
      }

      .dashboard-layout-v2-menu button {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        padding: 8px 10px;
        border: 1px solid var(--dashboard-layout-v2-tab-border-color, transparent);
        border-radius: 8px;
        box-sizing: border-box;
        box-shadow: var(--dashboard-layout-v2-shadow-frame-offset, 4px) var(--dashboard-layout-v2-shadow-frame-offset, 4px) 0 0 var(--dashboard-layout-v2-tab-shadow-frame-color, transparent);
        color: var(--primary-text-color);
        background: var(--dashboard-layout-v2-inactive-tab-color, transparent);
        text-align: left;
        font: inherit;
        cursor: pointer;
      }

      .dashboard-layout-v2-menu button:hover {
        background: var(--dashboard-layout-v2-hover-tab-color, var(--secondary-background-color));
        color: var(--dashboard-layout-v2-hover-tab-text-color, var(--dashboard-layout-v2-inactive-tab-text-color, var(--primary-text-color)));
      }

      .dashboard-layout-v2-menu button.active {
        color: var(--dashboard-layout-v2-active-tab-text-color, var(--text-primary-color, #fff));
        background: var(--dashboard-layout-v2-active-tab-color, var(--primary-color));
      }

      .dashboard-layout-v2-menu ha-icon {
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
    `;
  }
}
