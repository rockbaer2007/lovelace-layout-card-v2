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
    const localMenu = this._config.layout?.dashboard_layout_v2?.menu ?? {};
    const parentMenu = this._dashboardLayoutV2ParentConfig()?.menu ?? {};

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
    return this._config.layout?.dashboard_layout_v2?.chrome ?? this._dashboardLayoutV2ParentConfig()?.chrome;
  }

  _dashboardLayoutV2Pages() {
    const configuredPages =
      this._config.layout?.dashboard_layout_v2?.pages ?? this._dashboardLayoutV2ParentConfig()?.pages;
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

  _renderDashboardLayoutV2Clock(menu: DashboardLayoutMenuConfig) {
    if (menu.clock === "none") return html``;
    if (menu.clock === "analog") {
      const now = new Date();
      const seconds = now.getSeconds();
      const minutes = now.getMinutes() + seconds / 60;
      const hours = (now.getHours() % 12) + minutes / 60;
      return html`
        <div class="dashboard-layout-v2-analog-clock" aria-label="Analoge Uhr">
          <span class="hand hour" style=${`transform: rotate(${hours * 30}deg)`}></span>
          <span class="hand minute" style=${`transform: rotate(${minutes * 6}deg)`}></span>
        </div>
      `;
    }
    return html`<span>${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>`;
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
          style.active_tab_color ? `--dashboard-layout-v2-active-tab-color: ${style.active_tab_color}` : "",
          style.inactive_tab_color ? `--dashboard-layout-v2-inactive-tab-color: ${style.inactive_tab_color}` : "",
          style.hover_tab_color ? `--dashboard-layout-v2-hover-tab-color: ${style.hover_tab_color}` : "",
          style.active_tab_text_color ? `--dashboard-layout-v2-active-tab-text-color: ${style.active_tab_text_color}` : "",
          style.inactive_tab_text_color ? `--dashboard-layout-v2-inactive-tab-text-color: ${style.inactive_tab_text_color}` : "",
          style.hover_tab_text_color ? `--dashboard-layout-v2-hover-tab-text-color: ${style.hover_tab_text_color}` : "",
          style.clock_size ? `--dashboard-layout-v2-clock-size: ${style.clock_size}` : "",
          background ? `--dashboard-layout-v2-menu-background: ${background}` : "",
        ].filter(Boolean).join(";")}
      >
        <header>
          ${menu.title ? html`<strong>${menu.title}</strong>` : ""}
          ${this._renderDashboardLayoutV2Clock(menu)}
          ${menu.date !== false ? html`<small>${new Date().toLocaleDateString()}</small>` : ""}
        </header>
        <nav>
          ${pages.map(
            (page) => html`
              <button
                class=${location.pathname.endsWith(`/${page.path}`) ? "active" : ""}
                @click=${() => this._navigateDashboardLayoutV2Page(page.path)}
              >
                ${page.icon ? html`<ha-icon .icon=${page.icon}></ha-icon>` : ""}
                <span>${page.title}</span>
              </button>
            `
          )}
        </nav>
      </aside>
    `;
  }

  _renderDashboardLayoutV2Shell(content) {
    const menu = this._dashboardLayoutV2Menu();
    if (menu.position === "none") return content;

    return html`
      <section class=${`dashboard-layout-v2-shell menu-${menu.position}`}>
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
      }

      .dashboard-layout-v2-analog-clock {
        position: relative;
        width: var(--dashboard-layout-v2-clock-size, 44px);
        height: var(--dashboard-layout-v2-clock-size, 44px);
        border: 2px solid var(--dashboard-layout-v2-icon-color, var(--primary-color));
        border-radius: 50%;
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
      }

      .dashboard-layout-v2-analog-clock .hand {
        position: absolute;
        bottom: 50%;
        left: calc(50% - 1px);
        width: 2px;
        transform-origin: bottom center;
        background: var(--primary-text-color);
      }

      .dashboard-layout-v2-analog-clock .hand.hour {
        height: calc(var(--dashboard-layout-v2-clock-size, 44px) * 0.3);
      }

      .dashboard-layout-v2-analog-clock .hand.minute {
        height: calc(var(--dashboard-layout-v2-clock-size, 44px) * 0.41);
      }

      .dashboard-layout-v2-menu nav {
        display: grid;
        gap: 6px;
      }

      .dashboard-layout-v2-menu button {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        padding: 8px 10px;
        border: 0;
        border-radius: 8px;
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
        color: var(--dashboard-layout-v2-icon-color, var(--primary-color));
      }
    `;
  }
}
