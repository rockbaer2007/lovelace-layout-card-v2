import { CSSResultArray, LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";

type DashboardLayoutV2DialogParams = {
  hass: any;
  lovelace: any;
  viewIndex: number;
  viewConfig: any;
};

const defaultConfig = {
  menu: {
    position: "left",
    title: "Haus",
    show_home: true,
    home: {},
    clock: "digital",
    date: true,
    style: {
      icon_color: "",
      active_tab_color: "",
      inactive_tab_color: "",
      hover_tab_color: "",
      active_tab_text_color: "",
      inactive_tab_text_color: "",
      hover_tab_text_color: "",
      clock_size: "44px",
      background_mode: "none",
      background_color: "",
      background_image: "",
    },
  },
  chrome: {
    hide_ha_chrome: false,
    admin_always_visible: true,
    visible_users: "",
  },
  pages: [],
};

const SECTIONS_LAYOUT_V2 = "custom:sections-layout-v2";
const DASHBOARD_LAYOUT_V2_VIEW_TYPES = new Set([
  "custom:masonry-layout-v2",
  SECTIONS_LAYOUT_V2,
  "custom:horizontal-layout-v2",
  "custom:vertical-layout-v2",
  "custom:grid-layout-v2",
]);

function slugifyPath(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dashboardLayoutConfigFrom(viewConfig: any) {
  return (
    viewConfig?.layout?.dashboard_layout_v2 ??
    viewConfig?.dashboard_layout_v2 ??
    viewConfig?.layout ??
    {}
  );
}

function normalizeConfig(viewConfig: any) {
  const dashboardLayoutConfig = dashboardLayoutConfigFrom(viewConfig);
  return {
    ...defaultConfig,
    ...dashboardLayoutConfig,
    menu: {
      ...defaultConfig.menu,
      ...(dashboardLayoutConfig?.menu ?? {}),
      style: {
        ...defaultConfig.menu.style,
        ...(dashboardLayoutConfig?.menu?.style ?? {}),
      },
    },
  };
}

function pageLayoutType(page: any) {
  const type = page.type ?? page.layout_type ?? "custom:masonry-layout-v2";
  return type === "sections" ? SECTIONS_LAYOUT_V2 : type;
}

function isSectionsPage(page: any) {
  return pageLayoutType(page) === SECTIONS_LAYOUT_V2;
}

function defaultSections() {
  return [
    {
      type: "grid",
      cards: [],
    },
  ];
}

function pagePath(page: any, index: number) {
  return String(page.path ?? (slugifyPath(page.title ?? "") || `dashboard-v2-${index + 1}`));
}

function layoutWithoutDashboardLayoutV2(layout: any) {
  if (!layout || typeof layout !== "object") return undefined;
  const { dashboard_layout_v2: _dashboardLayoutV2, ...rest } = layout;
  return Object.keys(rest).length ? rest : undefined;
}

function pageWithoutRecursiveDashboardLayout(page: any) {
  if (!page || typeof page !== "object") return page;
  const layout = layoutWithoutDashboardLayoutV2(page.layout);
  const cleanPage = { ...page, ...(layout ? { layout } : {}) };
  if (!layout) delete cleanPage.layout;
  return cleanPage;
}

function pageNavigationMetadata(page: any) {
  const metadata: any = {
    title: page.title,
    path: page.path,
    ...(page.icon ? { icon: page.icon } : {}),
    type: page.type,
    layout_type: page.layout_type ?? page.type,
  };
  if (page.type === SECTIONS_LAYOUT_V2) {
    metadata.max_columns = page.max_columns ?? 4;
  }
  return metadata;
}

function colorPickerValue(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
}

function normalizedTitle(value: any) {
  return String(value ?? "").trim().toLowerCase();
}

function clockSizeInputValue(value: string) {
  const match = String(value ?? "").match(/^(\d+(?:\.\d+)?)px$/);
  return match ? match[1] : String(value ?? "").replace(/[^\d.]/g, "") || "44";
}

function normalizedClockSize(value: string) {
  const size = Number(clockSizeInputValue(value));
  if (!Number.isFinite(size) || size <= 0) return "44px";
  return `${Math.max(24, Math.min(120, size))}px`;
}

function sectionsFromExistingData(page: any, existingView: any) {
  if (Array.isArray(page.sections)) return page.sections;
  if (Array.isArray(existingView?.sections)) return existingView.sections;
  const cards = Array.isArray(page.cards)
    ? page.cards
    : Array.isArray(existingView?.cards)
      ? existingView.cards
      : [];
  return cards.length ? [{ type: "grid", cards }] : defaultSections();
}

class DashboardLayoutV2ViewDialog extends LitElement {
  @property({ attribute: false }) hass: any;
  @property({ attribute: false }) lovelace: any;
  @property({ type: Number }) viewIndex = 0;
  @property({ attribute: false }) viewConfig: any;

  @state() private _menuPosition = "left";
  @state() private _menuTitle = "Haus";
  @state() private _showHome = true;
  @state() private _homeTitle = "Home";
  @state() private _homePath = "home";
  @state() private _homeIcon = "mdi:home";
  @state() private _clock = "digital";
  @state() private _date = true;
  @state() private _iconColor = "";
  @state() private _activeTabColor = "";
  @state() private _inactiveTabColor = "";
  @state() private _hoverTabColor = "";
  @state() private _activeTabTextColor = "";
  @state() private _inactiveTabTextColor = "";
  @state() private _hoverTabTextColor = "";
  @state() private _clockSize = "44";
  @state() private _backgroundMode = "none";
  @state() private _backgroundColor = "";
  @state() private _backgroundImage = "";
  @state() private _hideHaChrome = false;
  @state() private _adminAlwaysVisible = true;
  @state() private _visibleUsers = "";
  @state() private _pages: any[] = [];
  private _pageSourcePaths: Array<string | undefined> = [];
  @state() private _selectedPageIndex = 0;
  @state() private _jsonExpanded = false;
  @state() private _pagesText = "[]";
  @state() private _error = "";

  showDialog(params: DashboardLayoutV2DialogParams) {
    this.hass = params.hass;
    this.lovelace = params.lovelace;
    this.viewIndex = params.viewIndex;
    this.viewConfig = params.viewConfig;

    const config = normalizeConfig(params.viewConfig);
    this._menuPosition = config.menu.position ?? "left";
    this._menuTitle = config.menu.title ?? "Haus";
    this._showHome = config.menu.show_home !== false;
    const homeEntry = this._homeEntryFromView(config.menu.home);
    this._homeTitle = homeEntry.title;
    this._homePath = homeEntry.path;
    this._homeIcon = homeEntry.icon;
    this._clock = config.menu.clock ?? "digital";
    this._date = config.menu.date !== false;
    this._iconColor = config.menu.style?.icon_color ?? "";
    this._activeTabColor = config.menu.style?.active_tab_color ?? "";
    this._inactiveTabColor = config.menu.style?.inactive_tab_color ?? "";
    this._hoverTabColor = config.menu.style?.hover_tab_color ?? "";
    this._activeTabTextColor = config.menu.style?.active_tab_text_color ?? "";
    this._inactiveTabTextColor = config.menu.style?.inactive_tab_text_color ?? "";
    this._hoverTabTextColor = config.menu.style?.hover_tab_text_color ?? "";
    this._clockSize = clockSizeInputValue(config.menu.style?.clock_size ?? "44px");
    this._backgroundMode = config.menu.style?.background_mode ?? "none";
    this._backgroundColor = config.menu.style?.background_color ?? "";
    this._backgroundImage = config.menu.style?.background_image ?? "";
    this._hideHaChrome = config.chrome?.hide_ha_chrome === true;
    this._adminAlwaysVisible = config.chrome?.admin_always_visible !== false;
    this._visibleUsers = Array.isArray(config.chrome?.visible_users)
      ? config.chrome.visible_users.join(", ")
      : config.chrome?.visible_users ?? "";
    const rawViews = params.lovelace?.rawConfig?.views ?? params.lovelace?.config?.views ?? [];
    const viewsByPath = new Map(
      Array.isArray(rawViews)
        ? rawViews.map((view, index) => [String(view.path ?? index), view])
        : []
    );
    const viewsByTitle = new Map(
      Array.isArray(rawViews)
        ? rawViews
            .filter((view) => view?.title)
            .map((view) => [normalizedTitle(view.title), view])
        : []
    );
    const pagesSource =
      Array.isArray(config.pages) && config.pages.length
        ? config.pages
        : rawViews
            .filter(
              (view: any, index: number) =>
                index !== this.viewIndex && view?.subview && DASHBOARD_LAYOUT_V2_VIEW_TYPES.has(view?.type)
            )
            .map((view: any) =>
              pageNavigationMetadata({
                title: view.title,
                path: view.path,
                icon: view.icon,
                type: pageLayoutType(view),
                layout_type: pageLayoutType(view),
                max_columns: view.max_columns,
              })
            );
    this._pages = [...pagesSource].map((page, index) => {
      const cleanPage = pageWithoutRecursiveDashboardLayout(page);
      const matchingView =
        viewsByPath.get(pagePath(cleanPage, index)) ??
        viewsByTitle.get(normalizedTitle(cleanPage.title)) ??
        rawViews[index + 1];
      return this._mergePageWithView(cleanPage, matchingView);
    });
    this._pageSourcePaths = this._pages.map((page, index) => pagePath(page, index));
    this._selectedPageIndex = this._pages.length ? 0 : -1;
    this._syncJsonFromPages();
    this._error = "";
  }

  private _close() {
    this.dispatchEvent(new CustomEvent("dialog-closed", { bubbles: true, composed: true }));
    this.remove();
  }

  private _setValue(key: string, value: any) {
    if (key === "menuPosition") this._menuPosition = value;
    if (key === "menuTitle") this._menuTitle = value;
    if (key === "showHome") this._showHome = value;
    if (key === "clock") this._clock = value;
    if (key === "date") this._date = value;
    if (key === "iconColor") this._iconColor = value;
    if (key === "activeTabColor") this._activeTabColor = value;
    if (key === "inactiveTabColor") this._inactiveTabColor = value;
    if (key === "hoverTabColor") this._hoverTabColor = value;
    if (key === "activeTabTextColor") this._activeTabTextColor = value;
    if (key === "inactiveTabTextColor") this._inactiveTabTextColor = value;
    if (key === "hoverTabTextColor") this._hoverTabTextColor = value;
    if (key === "clockSize") this._clockSize = value;
    if (key === "backgroundMode") this._backgroundMode = value;
    if (key === "backgroundColor") this._backgroundColor = value;
    if (key === "backgroundImage") this._backgroundImage = value;
    if (key === "hideHaChrome") this._hideHaChrome = value;
    if (key === "adminAlwaysVisible") this._adminAlwaysVisible = value;
    if (key === "visibleUsers") this._visibleUsers = value;
    if (key === "pagesText") this._pagesText = value;
  }

  private _homeEntryFromView(configHome?: any) {
    const rawViews = this.lovelace?.rawConfig?.views ?? this.lovelace?.config?.views ?? [];
    const currentView = rawViews?.[this.viewIndex] ?? this.viewConfig ?? {};
    const currentPath = String(currentView.path ?? this.viewIndex ?? "");
    const parentView = Array.isArray(rawViews)
      ? rawViews.find((view: any, index: number) => {
          if (index === this.viewIndex || view?.subview) return false;
          const pages = view?.layout?.dashboard_layout_v2?.pages ?? view?.dashboard_layout_v2?.pages ?? [];
          return Array.isArray(pages) && pages.some((page: any) => String(page?.path ?? "") === currentPath);
        })
      : undefined;
    const parentMenu = parentView?.layout?.dashboard_layout_v2?.menu ?? parentView?.dashboard_layout_v2?.menu;
    const parentHome = parentMenu?.home;
    const source = configHome?.path ? configHome : parentHome?.path ? parentHome : parentView ?? currentView;

    return {
      title: String(source?.title ?? source?.path ?? "Home"),
      path: String(source?.path ?? "home"),
      icon: String(source?.icon ?? "mdi:home"),
    };
  }

  private _renderColorField(label: string, key: string, value: string, placeholder: string) {
    return html`
      <label>
        ${label}
        <div class="color-row">
          <input
            class="text"
            placeholder=${placeholder}
            .value=${value}
            @input=${(ev: Event) => this._setValue(key, (ev.target as HTMLInputElement).value)}
          />
          <input
            class="color"
            type="color"
            .value=${colorPickerValue(value)}
            title=${`${label} auswählen`}
            @input=${(ev: Event) => this._setValue(key, (ev.target as HTMLInputElement).value)}
          />
        </div>
      </label>
    `;
  }

  private _syncJsonFromPages() {
    this._pagesText = JSON.stringify(this._pages, null, 2);
  }

  private _mergePageWithView(page: any, view: any) {
    if (!view) {
      return pageWithoutRecursiveDashboardLayout(page);
    }

    const type = pageLayoutType(view);
    const mergedPage = {
      ...page,
      title: view.title ?? page.title,
      path: view.path ?? page.path,
      icon: view.icon ?? page.icon,
      type,
      layout_type: type,
      layout: layoutWithoutDashboardLayoutV2(view.layout ?? page.layout),
    };

    if (type === SECTIONS_LAYOUT_V2) {
      const { cards: _cards, ...rest } = mergedPage;
      return {
        ...rest,
        sections: Array.isArray(view.sections)
          ? view.sections
          : Array.isArray(page.sections)
            ? page.sections
            : Array.isArray(view.cards) && view.cards.length
              ? [{ type: "grid", cards: view.cards }]
              : defaultSections(),
        max_columns: view.max_columns ?? page.max_columns ?? 4,
      };
    }

    const { sections: _sections, max_columns: _maxColumns, ...rest } = mergedPage;
    return {
      ...rest,
      cards: Array.isArray(view.cards) ? view.cards : Array.isArray(page.cards) ? page.cards : [],
    };
  }

  private _normalizePage(page: any, index: number) {
    const title = String(page.title ?? page.name ?? `Unterseite ${index + 1}`);
    const path = page.path ?? (slugifyPath(title) || `dashboard-v2-${index + 1}`);
    const type = pageLayoutType(page);
    const cleanPage = pageWithoutRecursiveDashboardLayout(page);
    const layout = cleanPage.layout;
    const normalizedPage = {
      ...cleanPage,
      title,
      path: String(path),
      type,
      layout_type: type,
      ...(layout ? { layout } : {}),
    };
    if (!layout) delete normalizedPage.layout;

    if (isSectionsPage(normalizedPage)) {
      return {
        ...normalizedPage,
        sections: Array.isArray(cleanPage.sections) ? cleanPage.sections : defaultSections(),
        max_columns: cleanPage.max_columns ?? 4,
      };
    }

    return {
      ...normalizedPage,
      cards: Array.isArray(cleanPage.cards) ? cleanPage.cards : [],
    };
  }

  private _updatePage(index: number, key: string, value: any) {
    this._pages = this._pages.map((page, pageIndex) =>
      pageIndex === index ? { ...page, [key]: value } : page
    );
    this._syncJsonFromPages();
  }

  private _updatePageLayout(index: number, value: string) {
    this._pages = this._pages.map((page, pageIndex) => {
      if (pageIndex !== index) return page;
      if (value === "sections" || value === SECTIONS_LAYOUT_V2) {
        const { cards: _cards, ...rest } = page;
        return {
          ...rest,
          type: SECTIONS_LAYOUT_V2,
          layout_type: SECTIONS_LAYOUT_V2,
          sections: Array.isArray(page.sections) ? page.sections : defaultSections(),
          max_columns: page.max_columns ?? 4,
        };
      }

      const { sections: _sections, max_columns: _maxColumns, ...rest } = page;
      return {
        ...rest,
        type: value,
        layout_type: value,
        cards: Array.isArray(page.cards) ? page.cards : [],
      };
    });
    this._syncJsonFromPages();
  }

  private _addPage() {
    const nextIndex = this._pages.length + 1;
    const page = {
      title: `Unterseite ${nextIndex}`,
      path: `unterseite-${nextIndex}`,
      icon: "mdi:view-dashboard",
      layout_type: "custom:masonry-layout-v2",
    };
    this._pages = [...this._pages, page];
    this._pageSourcePaths = [...this._pageSourcePaths, undefined];
    this._selectedPageIndex = this._pages.length - 1;
    this._syncJsonFromPages();
  }

  private _duplicatePage() {
    const page = this._pages[this._selectedPageIndex];
    if (!page) return;
    const copy = {
      ...page,
      title: `${page.title ?? "Unterseite"} Kopie`,
      path: `${page.path ?? "unterseite"}-kopie`,
    };
    this._pages = [
      ...this._pages.slice(0, this._selectedPageIndex + 1),
      copy,
      ...this._pages.slice(this._selectedPageIndex + 1),
    ];
    this._pageSourcePaths = [
      ...this._pageSourcePaths.slice(0, this._selectedPageIndex + 1),
      undefined,
      ...this._pageSourcePaths.slice(this._selectedPageIndex + 1),
    ];
    this._selectedPageIndex += 1;
    this._syncJsonFromPages();
  }

  private _deletePage() {
    if (this._selectedPageIndex < 0) return;
    this._pages = this._pages.filter((_, index) => index !== this._selectedPageIndex);
    this._pageSourcePaths = this._pageSourcePaths.filter((_, index) => index !== this._selectedPageIndex);
    this._selectedPageIndex = Math.min(this._selectedPageIndex, this._pages.length - 1);
    this._syncJsonFromPages();
  }

  private _movePage(direction: -1 | 1) {
    const targetIndex = this._selectedPageIndex + direction;
    if (targetIndex < 0 || targetIndex >= this._pages.length) return;
    const pages = [...this._pages];
    const sourcePaths = [...this._pageSourcePaths];
    const [page] = pages.splice(this._selectedPageIndex, 1);
    const [sourcePath] = sourcePaths.splice(this._selectedPageIndex, 1);
    pages.splice(targetIndex, 0, page);
    sourcePaths.splice(targetIndex, 0, sourcePath);
    this._pages = pages;
    this._pageSourcePaths = sourcePaths;
    this._selectedPageIndex = targetIndex;
    this._syncJsonFromPages();
  }

  private _applyJson() {
    try {
      const parsed = JSON.parse(this._pagesText || "[]");
      if (!Array.isArray(parsed)) throw new Error("Pages muss eine Liste sein.");
      this._pages = parsed.map((page) => pageWithoutRecursiveDashboardLayout(page));
      this._pageSourcePaths = parsed.map((page, index) => pagePath(page, index));
      this._selectedPageIndex = this._pages.length ? 0 : -1;
      this._syncJsonFromPages();
      this._error = "";
    } catch (err: any) {
      this._error = err?.message || "Pages konnten nicht gelesen werden.";
    }
  }

  private async _save() {
    let pagesForSave = this._pages;
    try {
      const parsed = JSON.parse(this._pagesText || "[]");
      if (this._jsonExpanded) {
        if (!Array.isArray(parsed)) throw new Error("Pages muss eine Liste sein.");
        pagesForSave = parsed;
      }
    } catch (err: any) {
      this._error = err?.message || "Pages konnten nicht gelesen werden.";
      return;
    }

    const rawConfig = this.lovelace?.rawConfig ?? this.lovelace?.config;
    const views = rawConfig?.views;
    if (!Array.isArray(views) || !views[this.viewIndex]) {
      this._error = "Aktuelle View konnte nicht gefunden werden.";
      return;
    }

    const normalizedPages = pagesForSave.map((page, index) => this._normalizePage(page, index));
    const homeEntry = {
      title: this._homeTitle,
      path: this._homePath,
      icon: this._homeIcon,
    };

    const dashboardLayoutV2 = {
      menu: {
        position: this._menuPosition,
        title: this._menuTitle,
        show_home: this._showHome,
        home: homeEntry,
        clock: this._clock,
        date: this._date,
        style: {
          icon_color: this._iconColor,
          active_tab_color: this._activeTabColor,
          inactive_tab_color: this._inactiveTabColor,
          hover_tab_color: this._hoverTabColor,
          active_tab_text_color: this._activeTabTextColor,
          inactive_tab_text_color: this._inactiveTabTextColor,
          hover_tab_text_color: this._hoverTabTextColor,
          clock_size: normalizedClockSize(this._clockSize),
          background_mode: this._backgroundMode,
          background_color: this._backgroundColor,
          background_image: this._backgroundImage,
        },
      },
      chrome: {
        hide_ha_chrome: this._hideHaChrome,
        admin_always_visible: this._adminAlwaysVisible,
        visible_users: this._visibleUsers,
      },
      pages: normalizedPages.map((page) => pageNavigationMetadata(page)),
    };

    const currentPath = String(views[this.viewIndex].path ?? this.viewIndex);
    const existingViewsByPath = new Map(
      views.map((view, index) => [String(view.path ?? index), { view, index }])
    );
    const relatedPaths = new Set<string>([currentPath]);
    normalizedPages.forEach((page, index) => {
      relatedPaths.add(String(page.path));
      const sourcePath = this._pageSourcePaths[index];
      if (sourcePath) relatedPaths.add(sourcePath);
    });
    const nextViews = views.map((view, index) => {
      const viewPath = String(view.path ?? index);
      const isRelatedDashboardLayoutV2View =
        relatedPaths.has(viewPath) && String(view.type ?? "").endsWith("-layout-v2");
      if (!isRelatedDashboardLayoutV2View) return view;
      return {
        ...view,
        layout: {
          ...(layoutWithoutDashboardLayoutV2(view.layout) ?? {}),
          dashboard_layout_v2: dashboardLayoutV2,
        },
      };
    });

    for (const [pageIndex, page] of normalizedPages.entries()) {
      const pagePath = String(page.path);
      const sourcePath = this._pageSourcePaths[pageIndex];
      const existing = sourcePath
        ? existingViewsByPath.get(sourcePath) ?? existingViewsByPath.get(pagePath)
        : existingViewsByPath.get(pagePath);
      const isCurrentView = (sourcePath ?? pagePath) === currentPath;
      const pageLayout = {
        ...(layoutWithoutDashboardLayoutV2(existing?.view.layout ?? page.layout) ?? {}),
        dashboard_layout_v2: dashboardLayoutV2,
      };
      const type = pageLayoutType(page);
      const sections = Array.isArray(page.sections)
        ? page.sections
        : sectionsFromExistingData(page, existing?.view);
      const cards = Array.isArray(page.cards)
        ? page.cards
        : Array.isArray(existing?.view.cards)
          ? existing.view.cards
          : [];

      if (existing) {
        const updatedView = {
          ...existing.view,
          title: page.title,
          path: pagePath,
          ...(page.icon ? { icon: page.icon } : {}),
          type,
          subview: isCurrentView ? existing.view.subview : true,
          layout: pageLayout,
        };
        if (type === SECTIONS_LAYOUT_V2) {
          delete updatedView.cards;
          updatedView.sections = sections;
          updatedView.max_columns = page.max_columns ?? existing.view.max_columns ?? 4;
        } else {
          delete updatedView.sections;
          delete updatedView.max_columns;
          updatedView.cards = cards;
        }
        nextViews[existing.index] = updatedView;
        continue;
      }

      const newView = {
        title: page.title,
        path: pagePath,
        ...(page.icon ? { icon: page.icon } : {}),
        type,
        subview: true,
        layout: pageLayout,
      };
      if (type === SECTIONS_LAYOUT_V2) {
        nextViews.push({
          ...newView,
          max_columns: page.max_columns ?? 4,
          sections,
        });
      } else {
        nextViews.push({
          ...newView,
          cards,
        });
      }
    }

    const nextConfig = {
      ...rawConfig,
      views: nextViews,
    };

    await this.lovelace.saveConfig(nextConfig);
    this._close();
  }

  render() {
    if (!this.viewConfig) return nothing;
    const selectedPage = this._pages[this._selectedPageIndex];
    const selectedPageLayout = selectedPage ? pageLayoutType(selectedPage) : "";

    return html`
      <div class="scrim" @click=${this._close}></div>
      <section class="dialog" role="dialog" aria-modal="true">
        <header>
          <h2>Dashboard Layout V2</h2>
          <button class="icon" @click=${this._close} title="Schließen">×</button>
        </header>

        <div class="content">
          <label>
            Menüposition
            <select
              .value=${this._menuPosition}
              @change=${(ev: Event) => this._setValue("menuPosition", (ev.target as HTMLSelectElement).value)}
            >
              <option value="left">Links</option>
              <option value="none">Keine</option>
              <option value="right">Rechts</option>
            </select>
          </label>

          <label>
            Menütitel
            <input
              .value=${this._menuTitle}
              @input=${(ev: Event) => this._setValue("menuTitle", (ev.target as HTMLInputElement).value)}
            />
          </label>

          <label class="check">
            <input
              type="checkbox"
              .checked=${this._showHome}
              @change=${(ev: Event) => this._setValue("showHome", (ev.target as HTMLInputElement).checked)}
            />
            Hauptseite als ersten Menüpunkt anzeigen
          </label>

          <fieldset class="home-entry group">
            <legend>Hauptseite</legend>
            <span>
              <ha-icon .icon=${this._homeIcon}></ha-icon>
              ${this._homeTitle}
            </span>
            <small>${this._homePath}</small>
          </fieldset>

          <label>
            Uhr
            <select
              .value=${this._clock}
              @change=${(ev: Event) => this._setValue("clock", (ev.target as HTMLSelectElement).value)}
            >
              <option value="none">Aus</option>
              <option value="digital">Digital</option>
              <option value="analog">Analog</option>
            </select>
          </label>

          <label class="check">
            <input
              type="checkbox"
              .checked=${this._date}
              @change=${(ev: Event) => this._setValue("date", (ev.target as HTMLInputElement).checked)}
            />
            Datum anzeigen
          </label>

          <fieldset class="wide group">
            <legend>HA-Oberfläche</legend>
            <label class="check">
              <input
                type="checkbox"
                .checked=${this._hideHaChrome}
                @change=${(ev: Event) => this._setValue("hideHaChrome", (ev.target as HTMLInputElement).checked)}
              />
              HA-Sidebar und HA-Header für nicht erlaubte Benutzer ausblenden
            </label>
            <label class="check">
              <input
                type="checkbox"
                .checked=${this._adminAlwaysVisible}
                @change=${(ev: Event) => this._setValue("adminAlwaysVisible", (ev.target as HTMLInputElement).checked)}
              />
              Admin immer sichtbar lassen
            </label>
            <label>
              Sichtbare Benutzer
              <input
                placeholder="Name oder User-ID, getrennt mit Komma"
                .value=${this._visibleUsers}
                @input=${(ev: Event) => this._setValue("visibleUsers", (ev.target as HTMLInputElement).value)}
              />
            </label>
            <p class="hint">
              Leere Liste blendet die HA-Oberfläche für alle Nicht-Admins aus, sobald die Option aktiv ist.
            </p>
          </fieldset>

          <fieldset class="wide group">
            <legend>Tabs / Unterseiten</legend>
            <div class="page-editor">
              <div class="page-list">
                ${this._pages.map(
                  (page, index) => html`
                    <button
                      class=${index === this._selectedPageIndex ? "selected" : ""}
                      @click=${() => (this._selectedPageIndex = index)}
                    >
                      <span>${page.title ?? page.path ?? `Unterseite ${index + 1}`}</span>
                      <small>${page.path ?? ""}</small>
                    </button>
                  `
                )}
              </div>

              <div class="page-form">
                ${selectedPage
                  ? html`
                      <label>
                        Titel
                        <input
                          .value=${selectedPage.title ?? ""}
                          @input=${(ev: Event) =>
                            this._updatePage(this._selectedPageIndex, "title", (ev.target as HTMLInputElement).value)}
                        />
                      </label>
                      <label>
                        Pfad
                        <input
                          .value=${selectedPage.path ?? ""}
                          @input=${(ev: Event) =>
                            this._updatePage(this._selectedPageIndex, "path", (ev.target as HTMLInputElement).value)}
                        />
                      </label>
                      <label>
                        Icon
                        <input
                          .value=${selectedPage.icon ?? ""}
                          @input=${(ev: Event) =>
                            this._updatePage(this._selectedPageIndex, "icon", (ev.target as HTMLInputElement).value)}
                        />
                      </label>
                      <label>
                        Layout
                        <select
                          .value=${pageLayoutType(selectedPage)}
                          @change=${(ev: Event) =>
                            this._updatePageLayout(this._selectedPageIndex, (ev.target as HTMLSelectElement).value)}
                        >
                          <option value=${SECTIONS_LAYOUT_V2} ?selected=${selectedPageLayout === SECTIONS_LAYOUT_V2}>
                            Abschnitte V2
                          </option>
                          <option value="custom:masonry-layout-v2" ?selected=${selectedPageLayout === "custom:masonry-layout-v2"}>
                            Masonry V2
                          </option>
                          <option value="custom:horizontal-layout-v2" ?selected=${selectedPageLayout === "custom:horizontal-layout-v2"}>
                            Horizontal V2
                          </option>
                          <option value="custom:vertical-layout-v2" ?selected=${selectedPageLayout === "custom:vertical-layout-v2"}>
                            Vertical V2
                          </option>
                          <option value="custom:grid-layout-v2" ?selected=${selectedPageLayout === "custom:grid-layout-v2"}>
                            Grid V2
                          </option>
                        </select>
                      </label>
                      ${isSectionsPage(selectedPage)
                        ? html`
                            <label>
                              Max. Spalten
                              <input
                                type="number"
                                min="1"
                                max="10"
                                .value=${String(selectedPage.max_columns ?? 4)}
                                @input=${(ev: Event) =>
                                  this._updatePage(
                                    this._selectedPageIndex,
                                    "max_columns",
                                    Number((ev.target as HTMLInputElement).value)
                                  )}
                              />
                            </label>
                          `
                        : nothing}
                    `
                  : html`<p class="empty">Noch keine Unterseite angelegt.</p>`}
              </div>
            </div>

            <div class="actions">
              <button @click=${this._addPage}>Hinzufügen</button>
              <button @click=${this._duplicatePage} ?disabled=${!selectedPage}>Duplizieren</button>
              <button @click=${() => this._movePage(-1)} ?disabled=${this._selectedPageIndex <= 0}>Hoch</button>
              <button @click=${() => this._movePage(1)} ?disabled=${this._selectedPageIndex >= this._pages.length - 1}>Runter</button>
              <button class="danger" @click=${this._deletePage} ?disabled=${!selectedPage}>Löschen</button>
            </div>
          </fieldset>

          <fieldset class="wide group">
            <legend>Style</legend>
            <div class="style-grid">
              ${this._renderColorField("Iconfarbe", "iconColor", this._iconColor, "var(--primary-color)")}
              ${this._renderColorField("Tabfarbe aktiv", "activeTabColor", this._activeTabColor, "var(--primary-color)")}
              ${this._renderColorField("Tabfarbe inaktiv", "inactiveTabColor", this._inactiveTabColor, "transparent")}
              ${this._renderColorField("Tabfarbe Hover", "hoverTabColor", this._hoverTabColor, "var(--secondary-background-color)")}
              ${this._renderColorField("Textfarbe aktiv", "activeTabTextColor", this._activeTabTextColor, "var(--text-primary-color)")}
              ${this._renderColorField("Textfarbe inaktiv", "inactiveTabTextColor", this._inactiveTabTextColor, "var(--primary-text-color)")}
              ${this._renderColorField("Textfarbe Hover", "hoverTabTextColor", this._hoverTabTextColor, "var(--primary-text-color)")}
              <label>
                Uhrgröße
                <input
                  type="number"
                  min="24"
                  max="120"
                  step="1"
                  .value=${this._clockSize}
                  @input=${(ev: Event) => this._setValue("clockSize", (ev.target as HTMLInputElement).value)}
                />
              </label>
              <label>
                Hintergrund
                <select
                  .value=${this._backgroundMode}
                  @change=${(ev: Event) => this._setValue("backgroundMode", (ev.target as HTMLSelectElement).value)}
                >
                  <option value="none">Keine</option>
                  <option value="color">Farbe</option>
                  <option value="image">Bild</option>
                </select>
              </label>
              ${this._backgroundMode === "color"
                ? html`
                    ${this._renderColorField(
                      "Hintergrundfarbe",
                      "backgroundColor",
                      this._backgroundColor,
                      "rgba(0,0,0,0.18)"
                    )}
                  `
                : nothing}
              ${this._backgroundMode === "image"
                ? html`
                    <label>
                      Hintergrundbild
                      <input
                        placeholder="/local/background.jpg"
                        .value=${this._backgroundImage}
                        @input=${(ev: Event) => this._setValue("backgroundImage", (ev.target as HTMLInputElement).value)}
                      />
                    </label>
                  `
                : nothing}
            </div>
          </fieldset>

          <details class="wide json-box" ?open=${this._jsonExpanded} @toggle=${(ev: Event) => (this._jsonExpanded = (ev.target as HTMLDetailsElement).open)}>
            <summary>Spezialoptionen / JSON bearbeiten</summary>
            <textarea
              .value=${this._pagesText}
              @input=${(ev: Event) => this._setValue("pagesText", (ev.target as HTMLTextAreaElement).value)}
            ></textarea>
            <button @click=${this._applyJson}>JSON übernehmen</button>
          </details>

          ${this._error ? html`<p class="error">${this._error}</p>` : nothing}
        </div>

        <footer>
          <button @click=${this._close}>Abbrechen</button>
          <button class="primary" @click=${this._save}>Speichern</button>
        </footer>
      </section>
    `;
  }

  static get styles(): CSSResultArray {
    return [
      css`
        :host {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          color: var(--primary-text-color, #fff);
          font-family: var(--primary-font-family, sans-serif);
        }

        .scrim {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
        }

        .dialog {
          position: absolute;
          top: 48px;
          left: 50%;
          transform: translateX(-50%);
          width: min(760px, calc(100vw - 32px));
          height: min(760px, calc(100vh - 96px));
          display: grid;
          grid-template-rows: auto 1fr auto;
          background: var(--card-background-color, #1c1c1c);
          border: 1px solid var(--divider-color, #333);
          border-radius: 12px;
          box-shadow: var(--ha-card-box-shadow, 0 8px 24px rgba(0, 0, 0, 0.4));
          overflow: hidden;
        }

        header,
        footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid var(--divider-color, #333);
        }

        footer {
          border-top: 1px solid var(--divider-color, #333);
          border-bottom: 0;
          justify-content: flex-end;
        }

        h2 {
          margin: 0;
          font-size: 20px;
        }

        .content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          padding: 16px;
          overflow: auto;
        }

        label {
          display: grid;
          gap: 6px;
          font-weight: 700;
        }

        .wide,
        .check,
        .error,
        .hint {
          grid-column: 1 / -1;
        }

        .check {
          display: flex;
          align-items: center;
        }

        input,
        select,
        textarea,
        button {
          color: var(--primary-text-color, #fff);
          background: var(--secondary-background-color, #111);
          border: 1px solid var(--divider-color, #333);
          border-radius: 6px;
          font: inherit;
        }

        input,
        select {
          height: 40px;
          padding: 0 10px;
        }

        input.color {
          width: 48px;
          min-width: 48px;
          padding: 3px;
        }

        .color-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 48px;
          gap: 8px;
          align-items: center;
        }

        .color-row .text {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        textarea {
          min-height: 300px;
          padding: 10px;
          font-family: var(--code-font-family, monospace);
          resize: vertical;
        }

        button {
          min-width: 112px;
          height: 40px;
          cursor: pointer;
        }

        .icon {
          min-width: 40px;
          font-size: 24px;
          border: 0;
          background: transparent;
        }

        .primary {
          color: var(--text-primary-color, #fff);
          background: var(--primary-color, #03a9f4);
          border-color: var(--primary-color, #03a9f4);
        }

        .error {
          margin: 0;
          color: var(--error-color, #db4437);
          font-weight: 700;
        }

        .group {
          display: grid;
          gap: 12px;
          margin: 0;
          padding: 12px;
          border: 1px solid var(--divider-color, #333);
          border-radius: 8px;
        }

        legend {
          padding: 0 6px;
          font-weight: 800;
        }

        .home-entry {
          align-content: center;
          gap: 6px;
        }

        .home-entry span {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
        }

        .home-entry small {
          color: var(--secondary-text-color);
        }

        .page-editor {
          display: grid;
          grid-template-columns: minmax(180px, 240px) 1fr;
          gap: 12px;
          min-height: 220px;
        }

        .page-list {
          display: grid;
          align-content: start;
          gap: 6px;
          max-height: 300px;
          overflow: auto;
        }

        .page-list button {
          width: 100%;
          height: auto;
          min-height: 48px;
          display: grid;
          justify-items: start;
          text-align: left;
        }

        .page-list button.selected {
          border-color: var(--primary-color, #03a9f4);
          background: color-mix(in srgb, var(--primary-color, #03a9f4) 24%, transparent);
        }

        .page-list small {
          color: var(--secondary-text-color);
        }

        .page-form,
        .style-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          align-content: start;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }

        .actions button,
        .json-box button {
          width: 100%;
          min-width: 0;
        }

        button.danger {
          color: #fff;
          background: var(--error-color, #db4437);
          border-color: var(--error-color, #db4437);
        }

        button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .json-box {
          display: grid;
          gap: 10px;
        }

        summary {
          cursor: pointer;
          font-weight: 800;
        }

        .empty {
          margin: 0;
          color: var(--secondary-text-color);
        }

        .hint {
          margin: 0;
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.4;
        }
      `,
    ];
  }
}

customElements.define("dashboard-layout-v2-view-dialog", DashboardLayoutV2ViewDialog);

export function showDashboardLayoutV2ViewDialog(element: HTMLElement, params: DashboardLayoutV2DialogParams) {
  const dialog = document.createElement("dashboard-layout-v2-view-dialog") as DashboardLayoutV2ViewDialog;
  document.body.appendChild(dialog);
  dialog.showDialog(params);
}
