import { css, html } from "lit";
import { state } from "lit/decorators.js";
import { BaseLayout } from "./base-layout";
import { CardConfig, HuiCard, LovelaceCard, ViewConfig } from "../types";

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
  private _headerCard?: LovelaceCard | HuiCard;
  private _headerCardKey = "";
  private _footerCard?: LovelaceCard | HuiCard;
  private _footerCardKey = "";
  @state() private _nativeChromeReady = false;
  @state() private _showHeaderCardFallback = false;
  @state() private _showFooterCardFallback = false;

  async setConfig(config: SectionsViewConfig) {
    await super.setConfig({
      ...config,
      type: "custom:sections-layout-v2",
      sections: sectionsFromConfig(config),
    });
  }

  async updated(changedProperties: Map<string, any>) {
    await super.updated(changedProperties);
    this._warmupNativeSectionsView();
    this._updateNativeChromeReady();
    this._patchNativeEditorSaves();
    await this._syncChromeCards();
    this._updateChromeFallbackVisibility();
  }

  private async _addSection() {
    const viewIndex = this._resolvedViewIndex();
    if (viewIndex === undefined || !this.lovelace?.config?.views?.[viewIndex]) return;
    const nextConfig = JSON.parse(JSON.stringify(this.lovelace.config));
    const view = nextConfig.views[viewIndex];
    view.sections = [...sectionsFromConfig(view), ...DEFAULT_SECTIONS];
    delete view.cards;
    await this.lovelace.saveConfig(nextConfig);
  }

  private async _warmupNativeSectionsView() {
    if (!this.lovelace?.editMode || (this as any).__dashboardLayoutV2SectionsEditorsLoaded) return;
    (this as any).__dashboardLayoutV2SectionsEditorsLoaded = true;

    try {
      const warmupView = {
        title: "tr",
        path: "tr",
        sections: [
          {
            type: "grid",
            cards: [],
          },
        ],
      };
      const warmupConfig = { views: [warmupView] };
      const loader = document.createElement("hui-sections-view") as any;
      loader.hass = this.hass;
      loader.index = 0;
      loader.narrow = this.narrow;
      loader.lovelace = {
        ...this.lovelace,
        editMode: true,
        config: warmupConfig,
        rawConfig: warmupConfig,
        saveConfig: undefined,
      };
      loader.style.cssText = [
        "position:absolute",
        "width:1px",
        "height:1px",
        "overflow:hidden",
        "opacity:0",
        "pointer-events:none",
        "left:-10000px",
        "top:-10000px",
      ].join(";");
      this.renderRoot.appendChild(loader);
      loader.willUpdate?.(new Map([["lovelace", undefined]]));
      await this._waitForNativeSectionsElements();
      this._updateNativeChromeReady();
      this.requestUpdate();
      window.setTimeout(() => loader.remove(), 1200);
    } catch (err) {
      console.warn("Dashboard Layout Card V2: native sections warmup failed", err);
    }
  }

  private async _waitForNativeSectionsElements() {
    const names = [
      "hui-sections-view",
      "hui-view-header",
      "hui-view-footer",
      "hui-view-badges",
      "hui-card-edit-mode",
      "hui-section",
      "hui-section-edit-mode",
    ];
    await Promise.race([
      Promise.all(names.map((name) => customElements.whenDefined(name))),
      new Promise((resolve) => window.setTimeout(resolve, 2000)),
    ]);
  }

  private _hasNativeChromeElements() {
    return Boolean(
      customElements.get("hui-view-header")
        && customElements.get("hui-view-footer")
        && customElements.get("hui-view-badges")
    );
  }

  private _updateNativeChromeReady() {
    const ready = this._hasNativeChromeElements();
    if (this._nativeChromeReady !== ready) {
      this._nativeChromeReady = ready;
    }
  }

  private _nativeHeaderEditor() {
    return this.shadowRoot?.getElementById("native-header-editor") as any;
  }

  private _nativeFooterEditor() {
    return this.shadowRoot?.getElementById("native-footer-editor") as any;
  }

  private _sourceLovelaceConfig() {
    return this.lovelace?.rawConfig ?? this.lovelace?.config;
  }

  private _resolvedViewIndex() {
    if (Number.isInteger(Number(this.index))) return Number(this.index);

    const views = this.lovelace?.rawConfig?.views ?? this.lovelace?.config?.views ?? [];
    if (!Array.isArray(views)) return undefined;

    const configPath = this._config?.path;
    if (configPath) {
      const byConfigPath = views.findIndex((view) => String(view?.path ?? "") === String(configPath));
      if (byConfigPath >= 0) return byConfigPath;
    }

    const urlPath = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() ?? "");
    if (urlPath) {
      const byUrlPath = views.findIndex((view) => String(view?.path ?? "") === urlPath);
      if (byUrlPath >= 0) return byUrlPath;
    }

    return undefined;
  }

  private _currentViewConfig(): SectionsViewConfig {
    const viewIndex = this._resolvedViewIndex();
    const rawView = viewIndex === undefined ? undefined : this.lovelace?.rawConfig?.views?.[viewIndex];
    const configView = viewIndex === undefined ? undefined : this.lovelace?.config?.views?.[viewIndex];
    return {
      ...this._config,
      ...(configView ?? {}),
      ...(rawView ?? {}),
    };
  }

  private async _createChromeCard(config: CardConfig) {
    const helpers = await (window as any).loadCardHelpers?.();
    if (!helpers?.createCardElement) return undefined;
    const card = helpers.createCardElement(config) as LovelaceCard | HuiCard;
    card.hass = this.hass;
    card.editMode = this.lovelace?.editMode;
    return card;
  }

  private async _syncChromeCards() {
    const viewConfig = this._currentViewConfig();
    const headerCardConfig = viewConfig.header?.card as CardConfig | undefined;
    const footerCardConfig = viewConfig.footer?.card as CardConfig | undefined;
    const headerKey = headerCardConfig ? JSON.stringify(headerCardConfig) : "";
    const footerKey = footerCardConfig ? JSON.stringify(footerCardConfig) : "";

    if (headerKey !== this._headerCardKey) {
      this._headerCardKey = headerKey;
      this._headerCard = headerCardConfig
        ? await this._createChromeCard(headerCardConfig)
        : undefined;
      this.requestUpdate();
    }

    if (footerKey !== this._footerCardKey) {
      this._footerCardKey = footerKey;
      this._footerCard = footerCardConfig
        ? await this._createChromeCard(footerCardConfig)
        : undefined;
      this.requestUpdate();
    }

    if (this._headerCard) {
      this._headerCard.hass = this.hass;
      this._headerCard.editMode = this.lovelace?.editMode;
    }
    if (this._footerCard) {
      this._footerCard.hass = this.hass;
      this._footerCard.editMode = this.lovelace?.editMode;
    }
  }

  private _nativeChromeShowsCard(element?: any) {
    const root = element?.shadowRoot;
    if (!root) return false;
    return Boolean(
      root.querySelector("hui-card, hui-card-options, ha-card, hui-warning")
        ?? root.querySelector("[card], .card")
    );
  }

  private _updateChromeFallbackVisibility() {
    const viewConfig = this._currentViewConfig();
    const shouldShowHeaderFallback = Boolean(viewConfig.header?.card)
      && !this._nativeChromeShowsCard(this._nativeHeaderEditor());
    const shouldShowFooterFallback = Boolean(viewConfig.footer?.card)
      && !this._nativeChromeShowsCard(this._nativeFooterEditor());

    if (this._showHeaderCardFallback !== shouldShowHeaderFallback) {
      this._showHeaderCardFallback = shouldShowHeaderFallback;
    }
    if (this._showFooterCardFallback !== shouldShowFooterFallback) {
      this._showFooterCardFallback = shouldShowFooterFallback;
    }
  }

  private _configureHeader(ev: Event) {
    ev.stopPropagation();
    this._patchNativeEditorSaves();
    if (!this._clickNativeConfigure(this._nativeHeaderEditor())) {
      this._showNativeHeaderDialog();
    }
  }

  private _configureFooter(ev: Event) {
    ev.stopPropagation();
    this._patchNativeEditorSaves();
    if (!this._clickNativeConfigure(this._nativeFooterEditor())) {
      this._showNativeFooterDialog();
    }
  }

  private _clickNativeConfigure(editor?: any) {
    const nativeButton = editor?.shadowRoot?.querySelector(".actions ha-icon-button") as HTMLElement | undefined;
    if (nativeButton) {
      nativeButton.click();
      return true;
    }
    editor?._configure?.();
    return typeof editor?._configure === "function";
  }

  private _showNativeHeaderDialog() {
    const viewConfig = this._currentViewConfig();
    this.dispatchEvent(new CustomEvent("show-dialog", {
      bubbles: true,
      composed: true,
      detail: {
        dialogTag: "hui-dialog-edit-view-header",
        dialogParams: {
          config: viewConfig.header ?? {},
          saveConfig: (config: Record<string, any>) => this._saveViewPatch({ header: config }),
        },
      },
    }));
  }

  private _showNativeFooterDialog() {
    const viewConfig = this._currentViewConfig();
    this.dispatchEvent(new CustomEvent("show-dialog", {
      bubbles: true,
      composed: true,
      detail: {
        dialogTag: "hui-dialog-edit-view-footer",
        dialogParams: {
          config: viewConfig.footer ?? {},
          saveConfig: (config: Record<string, any>) => this._saveViewPatch({ footer: config }),
        },
      },
    }));
  }

  private async _addHeaderCard(ev: Event) {
    ev.stopPropagation();
    const viewConfig = this._currentViewConfig();
    await this._saveViewPatch({
      header: {
        ...(viewConfig.header ?? {}),
        card: {
          type: "markdown",
          text_only: true,
          content: `# ${viewConfig.title ?? "Titel"}`,
        },
      },
    });
  }

  private async _addFooterCard(ev: Event) {
    ev.stopPropagation();
    const viewConfig = this._currentViewConfig();
    await this._saveViewPatch({
      footer: {
        ...(viewConfig.footer ?? {}),
        card: {
          type: "markdown",
          text_only: true,
          content: "Fußzeile",
        },
      },
    });
  }

  private _editHeaderCard(ev: Event) {
    this._patchNativeEditorSaves();
    this._nativeHeaderEditor()?._editCard?.(ev);
  }

  private _deleteHeaderCard(ev: Event) {
    this._patchNativeEditorSaves();
    this._nativeHeaderEditor()?._deleteCard?.(ev);
  }

  private _editFooterCard(ev: Event) {
    this._patchNativeEditorSaves();
    this._nativeFooterEditor()?._editCard?.(ev);
  }

  private _deleteFooterCard(ev: Event) {
    this._patchNativeEditorSaves();
    this._nativeFooterEditor()?._deleteCard?.(ev);
  }

  private _renderFallbackCardEditor(
    card: LovelaceCard | HuiCard,
    editCard: (ev: Event) => void,
    deleteCard: (ev: Event) => void
  ) {
    if (!this.lovelace?.editMode) return card;

    return html`
      <hui-card-edit-mode
        @ll-edit-card=${editCard}
        @ll-delete-card=${deleteCard}
        .lovelace=${this.lovelace}
        .path=${[0]}
        no-duplicate
        no-move
      >
        ${card}
      </hui-card-edit-mode>
    `;
  }

  private _renderHeaderCardFallback(card?: LovelaceCard | HuiCard) {
    return card
      ? html`
          <div class=${this.lovelace?.editMode ? "chrome-card-fallback header edit-mode" : "chrome-card-fallback header"}>
            ${this.lovelace?.editMode
              ? html`
                  <button class="chrome-configure" @click=${this._configureHeader} title="Kopfzeilen-Einstellungen">
                    <ha-icon .icon=${"mdi:pencil"}></ha-icon>
                  </button>
                `
              : ""}
            ${this._renderFallbackCardEditor(card, this._editHeaderCard, this._deleteHeaderCard)}
          </div>
        `
      : "";
  }

  private _renderFooterCardFallback(card?: LovelaceCard | HuiCard) {
    return card
      ? html`
          <div class=${this.lovelace?.editMode ? "chrome-card-fallback footer edit-mode" : "chrome-card-fallback footer"}>
            ${this.lovelace?.editMode
              ? html`
                  <button class="chrome-configure" @click=${this._configureFooter} title="Fußzeilen-Einstellungen">
                    <ha-icon .icon=${"mdi:pencil"}></ha-icon>
                  </button>
                `
              : ""}
            ${this._renderFallbackCardEditor(card, this._editFooterCard, this._deleteFooterCard)}
          </div>
        `
      : "";
  }

  private _renderDirectHeaderChrome(card?: LovelaceCard | HuiCard) {
    const editMode = Boolean(this.lovelace?.editMode);
    return html`
      <div class=${editMode ? "direct-chrome header edit-mode" : "direct-chrome header"}>
        ${editMode
          ? html`
              <button class="chrome-configure" @click=${this._configureHeader} title="Kopfzeilen-Einstellungen">
                <ha-icon .icon=${"mdi:pencil"}></ha-icon>
              </button>
            `
          : ""}
        <div class="direct-heading">
          ${card
            ? this._renderFallbackCardEditor(card, this._editHeaderCard, this._deleteHeaderCard)
            : editMode
              ? html`
                  <button class="direct-add" @click=${this._addHeaderCard}>
                    <ha-icon .icon=${"mdi:plus"}></ha-icon>
                    Titel hinzufügen
                  </button>
                `
              : ""}
        </div>
        ${editMode
          ? html`
              <button class="direct-add badge-placeholder" type="button">
                <ha-icon .icon=${"mdi:plus"}></ha-icon>
                Badge hinzufügen
              </button>
            `
          : ""}
      </div>
    `;
  }

  private _renderDirectFooterChrome(card?: LovelaceCard | HuiCard) {
    const editMode = Boolean(this.lovelace?.editMode);
    if (!editMode && !card) return "";

    return html`
      <div class=${editMode ? "direct-chrome footer edit-mode" : "direct-chrome footer"}>
        ${editMode
          ? html`
              <button class="chrome-configure" @click=${this._configureFooter} title="Fußzeilen-Einstellungen">
                <ha-icon .icon=${"mdi:pencil"}></ha-icon>
              </button>
            `
          : ""}
        ${card
          ? this._renderFallbackCardEditor(card, this._editFooterCard, this._deleteFooterCard)
          : html`
              <button class="direct-add" @click=${this._addFooterCard}>
                <ha-icon .icon=${"mdi:plus"}></ha-icon>
                Fußzeile hinzufügen
              </button>
            `}
      </div>
    `;
  }

  private async _saveViewPatch(patch: Partial<SectionsViewConfig>) {
    const sourceConfig = this._sourceLovelaceConfig();
    const viewIndex = this._resolvedViewIndex();
    if (viewIndex === undefined) return;
    if (!sourceConfig?.views?.[viewIndex] || !this.lovelace?.saveConfig) return;

    const nextConfig = JSON.parse(JSON.stringify(sourceConfig));
    const currentView = nextConfig.views[viewIndex];
    const currentPath = String(currentView?.path ?? "");
    const targetIndex = currentPath
      ? nextConfig.views.findIndex((view) => String(view?.path ?? "") === currentPath)
      : viewIndex;
    const saveIndex = targetIndex >= 0 ? targetIndex : viewIndex;

    nextConfig.views[saveIndex] = {
      ...nextConfig.views[saveIndex],
      ...patch,
    };

    await this.lovelace.saveConfig(nextConfig);
    if (this.lovelace.config?.views?.[saveIndex]) {
      this.lovelace.config.views[saveIndex] = nextConfig.views[saveIndex];
    }
    if (this.lovelace.rawConfig?.views?.[saveIndex]) {
      this.lovelace.rawConfig.views[saveIndex] = nextConfig.views[saveIndex];
    }
    this._config = {
      ...this._config,
      ...patch,
    };
    this.requestUpdate();
  }

  private _patchNativeEditorSaves() {
    const header = this._nativeHeaderEditor();
    if (header && !header.__dashboardLayoutV2SavePatched) {
      header._saveHeaderConfig = (headerConfig: Record<string, any>) =>
        this._saveViewPatch({ header: headerConfig });
      header.__dashboardLayoutV2SavePatched = true;
    }

    const footer = this._nativeFooterEditor();
    if (footer && !footer.__dashboardLayoutV2SavePatched) {
      footer._saveFooterConfig = (footerConfig: Record<string, any>) =>
        this._saveViewPatch({ footer: footerConfig });
      footer.__dashboardLayoutV2SavePatched = true;
    }
  }

  render() {
    const viewConfig = this._currentViewConfig();
    const sections = sectionsFromConfig(viewConfig);
    const maxColumns = viewConfig?.max_columns ?? 4;
    const editMode = Boolean(this.lovelace?.editMode);
    const badges = (this as any).badges ?? [];
    return this._renderDashboardLayoutV2Shell(html`
      <div class="sections-wrapper" style=${`--sections-max-columns: ${maxColumns}`}>
        ${this._nativeChromeReady
          ? html`
              <hui-view-header
                id="native-header-editor"
                .hass=${this.hass}
                .badges=${badges}
                .lovelace=${this.lovelace}
                .viewIndex=${this._resolvedViewIndex()}
                .config=${viewConfig?.header ?? {}}
              ></hui-view-header>
              ${this._showHeaderCardFallback ? this._renderHeaderCardFallback(this._headerCard) : ""}
            `
          : this._renderDirectHeaderChrome(this._headerCard)}
        <div class="sections-view">
          ${sections.map((sectionConfig, index) => html`
            <div
              class=${editMode ? "section edit-mode" : "section"}
              style=${[
                sectionConfig.column_span
                  ? `--column-span: ${Math.min(Number(sectionConfig.column_span), maxColumns)}`
                  : "",
                sectionConfig.row_span ? `--row-span: ${sectionConfig.row_span}` : "",
              ].filter(Boolean).join(";")}
            >
              ${editMode
                ? html`
                    <hui-section-edit-mode
                      .hass=${this.hass}
                      .lovelace=${this.lovelace}
                      .index=${index}
                      .viewIndex=${this._resolvedViewIndex()}
                    >
                      <hui-section
                        .hass=${this.hass}
                        .lovelace=${this.lovelace}
                        .config=${sectionConfig}
                        .viewIndex=${this._resolvedViewIndex()}
                        .index=${index}
                        ?preview=${editMode}
                      ></hui-section>
                    </hui-section-edit-mode>
                  `
                : html`
                    <hui-section
                      .hass=${this.hass}
                      .lovelace=${this.lovelace}
                      .config=${sectionConfig}
                      .viewIndex=${this._resolvedViewIndex()}
                      .index=${index}
                    ></hui-section>
                  `}
            </div>
          `)}
          ${editMode
            ? html`
                <button class="create-section" @click=${this._addSection} title="Abschnitt hinzufügen">
                  <ha-icon .icon=${"mdi:view-grid-plus"}></ha-icon>
                </button>
              `
            : ""}
        </div>
        ${this._nativeChromeReady
          ? html`
              <hui-view-footer
                id="native-footer-editor"
                .hass=${this.hass}
                .lovelace=${this.lovelace}
                .viewIndex=${this._resolvedViewIndex()}
                .config=${viewConfig?.footer ?? {}}
              ></hui-view-footer>
              ${this._showFooterCardFallback ? this._renderFooterCardFallback(this._footerCard) : ""}
            `
          : this._renderDirectFooterChrome(this._footerCard)}
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
          min-height: calc(100vh - 96px);
          grid-template-rows: auto auto 1fr;
        }

        .sections-view {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(min(100%, var(--column-min-width)), 1fr)
          );
          gap: var(--column-gap);
          align-items: start;
          width: 100%;
          min-width: 0;
        }

        .section {
          position: relative;
          align-self: start;
          grid-column: span var(--column-span, 1);
          grid-row: span var(--row-span, 1);
        }

        .section.edit-mode {
          min-height: 112px;
        }

        .create-section {
          align-self: start;
          height: 112px;
          min-height: 112px;
          border: 2px dashed var(--primary-color);
          border-radius: 16px;
          background: transparent;
          color: var(--primary-text-color);
          cursor: pointer;
        }

        hui-view-header {
          display: block;
          padding-top: var(--column-gap);
        }

        hui-view-footer {
          display: block;
          align-self: end;
          margin-bottom: 8px;
        }

        .chrome-card-fallback {
          display: block;
          min-width: 0;
          text-align: center;
        }

        .chrome-card-fallback.header.edit-mode,
        .chrome-card-fallback.footer.edit-mode {
          position: relative;
          display: grid;
          place-items: center;
          min-height: 120px;
          border: 2px dashed var(--divider-color);
          border-radius: 12px;
          box-sizing: border-box;
        }

        .chrome-card-fallback.header {
          padding-top: var(--column-gap);
        }

        .chrome-card-fallback.header.edit-mode {
          padding: 16px;
        }

        .chrome-card-fallback.footer.edit-mode {
          align-self: end;
          min-height: 76px;
          margin-bottom: 8px;
          padding: 12px 16px;
        }

        .chrome-card-fallback hui-markdown-card,
        .chrome-card-fallback hui-markdown-card ha-card {
          width: 100%;
          max-width: 100%;
        }

        .chrome-card-fallback hui-card-edit-mode {
          width: min(700px, 100%);
        }

        .direct-chrome {
          position: relative;
          display: grid;
          justify-items: center;
          gap: 12px;
          min-width: 0;
          box-sizing: border-box;
        }

        .direct-chrome.header {
          padding-top: var(--column-gap);
        }

        .direct-chrome.edit-mode {
          min-height: 120px;
          padding: 16px;
          border: 2px dashed var(--divider-color);
          border-radius: 12px;
        }

        .direct-chrome.footer.edit-mode {
          align-self: end;
          min-height: 76px;
          margin-bottom: 8px;
          padding: 12px 16px;
        }

        .direct-heading {
          width: min(700px, 100%);
          text-align: center;
        }

        .direct-heading hui-card-edit-mode {
          display: block;
          width: 100%;
        }

        .direct-add {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 36px;
          padding: 6px 20px;
          border: 2px dashed var(--primary-color);
          border-radius: var(--ha-section-border-radius, var(--ha-border-radius-xl));
          background: transparent;
          color: var(--primary-text-color);
          font: inherit;
          cursor: pointer;
        }

        .direct-add ha-icon {
          --mdc-icon-size: 18px;
        }

        .badge-placeholder {
          margin-top: -2px;
        }

        .chrome-configure {
          position: absolute;
          top: -36px;
          right: -2px;
          z-index: 1;
          display: inline-grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: var(--ha-section-border-radius, var(--ha-border-radius-xl));
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          cursor: pointer;
        }

        .chrome-configure ha-icon {
          --mdc-icon-size: 20px;
        }
      `,
    ];
  }
}

customElements.define("sections-layout-v2", SectionsLayout);
