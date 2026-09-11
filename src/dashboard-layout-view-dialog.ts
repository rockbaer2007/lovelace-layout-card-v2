import { CSSResultArray, LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";

type DashboardLayoutV2DialogParams = {
  hass: any;
  lovelace: any;
  viewIndex: number;
  viewConfig: any;
};

const defaultConfig = {
  inherit_theme: true,
  menu: {
    position: "left",
    title: "Haus",
    show_home: true,
    home: {},
    clock: "digital",
    analog_hour_marks: false,
    analog_minute_marks: false,
    analog_seconds: false,
    date: true,
    weekday: "none",
    status: {
      enabled: false,
      border_color: "",
      items: [],
    },
    style: {
      icon_color: "",
      icon_active_color: "",
      icon_background_color: "",
      icon_shape: "circle",
      active_tab_color: "",
      inactive_tab_color: "",
      hover_tab_color: "",
      active_tab_text_color: "",
      inactive_tab_text_color: "",
      hover_tab_text_color: "",
      tab_border_color: "",
      tab_shadow_frame_color: "",
      card_border_color: "",
      shadow_frame_color: "",
      shadow_frame_offset: "4px",
      clock_size: "44px",
      date_size: "12px",
      weekday_wrap_size: "21px",
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
const MENU_ONLY_PAGE_TYPES = new Set(["spacer", "divider"]);

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
      status: {
        ...defaultConfig.menu.status,
        ...(dashboardLayoutConfig?.menu?.status ?? {}),
      },
      style: {
        ...defaultConfig.menu.style,
        ...(dashboardLayoutConfig?.menu?.style ?? {}),
      },
    },
  };
}

function dashboardLayoutV2ConfigFromView(viewConfig: any) {
  return viewConfig?.layout?.dashboard_layout_v2 ?? viewConfig?.dashboard_layout_v2;
}

function parentDashboardLayoutV2Config(viewConfig: any, views: any[], viewIndex?: number) {
  if (!Array.isArray(views)) return undefined;
  const currentPath = String(viewConfig?.path ?? viewIndex ?? "");
  const localConfig = dashboardLayoutV2ConfigFromView(viewConfig);
  const inheritedPath = localConfig?.inherits_from;
  const referencedParent = inheritedPath
    ? views.find((view, index) => String(view?.path ?? index) === String(inheritedPath))
    : undefined;
  if (referencedParent) return dashboardLayoutV2ConfigFromView(referencedParent);

  const parentView = views.find((view, index) => {
    if (index === viewIndex || view?.subview) return false;
    const pages = dashboardLayoutV2ConfigFromView(view)?.pages ?? [];
    return Array.isArray(pages) && pages.some((page: any) => String(page?.path ?? "") === currentPath);
  });
  return dashboardLayoutV2ConfigFromView(parentView);
}

function referencedDashboardLayoutV2Config(viewConfig: any, views: any[], viewIndex?: number) {
  const localConfig = dashboardLayoutV2ConfigFromView(viewConfig);
  const parentConfig = parentDashboardLayoutV2Config(viewConfig, views, viewIndex);
  if (!parentConfig) return localConfig;

  if (viewConfig?.subview || localConfig?.inherits_from) {
    return parentConfig;
  }

  return {
    ...parentConfig,
    ...localConfig,
    menu: {
      ...(parentConfig.menu ?? {}),
      ...(localConfig.menu ?? {}),
      home: {
        ...(parentConfig.menu?.home ?? {}),
        ...(localConfig.menu?.home ?? {}),
      },
      style: {
        ...(parentConfig.menu?.style ?? {}),
        ...(localConfig.menu?.style ?? {}),
      },
    },
    chrome: {
      ...(parentConfig.chrome ?? {}),
      ...(localConfig.chrome ?? {}),
    },
    pages: localConfig.pages ?? parentConfig.pages,
  };
}

function isDashboardLayoutV2View(viewConfig: any) {
  return DASHBOARD_LAYOUT_V2_VIEW_TYPES.has(viewConfig?.type) || String(viewConfig?.type ?? "").endsWith("-layout-v2");
}

function pageLayoutType(page: any) {
  if (MENU_ONLY_PAGE_TYPES.has(page?.type)) return page.type;
  const type = page.type ?? page.layout_type ?? SECTIONS_LAYOUT_V2;
  return type === "sections" ? SECTIONS_LAYOUT_V2 : type;
}

function pageItemType(page: any) {
  return MENU_ONLY_PAGE_TYPES.has(page?.type) ? page.type : "page";
}

function isMenuOnlyPage(page: any) {
  return MENU_ONLY_PAGE_TYPES.has(page?.type);
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

function pageTitle(page: any, index: number) {
  return String(page?.title ?? page?.name ?? page?.path ?? `Unterseite ${index + 1}`);
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

function dashboardLayoutV2Reference(path: string) {
  return {
    inherits_from: path,
  };
}

function pageNavigationMetadata(page: any) {
  if (page?.type === "spacer") return { type: "spacer" };
  if (page?.type === "divider") {
    return {
      type: "divider",
      color: page.color || "#ffffff",
      shadow_frame_color: page.shadow_frame_color || "transparent",
    };
  }

  const metadata: any = {
    title: pageTitle(page, 0),
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
  return `${Math.max(24, Math.min(128, size))}px`;
}

function normalizedDateSize(value: string) {
  const size = Number(clockSizeInputValue(value));
  if (!Number.isFinite(size) || size <= 0) return "12px";
  return `${Math.max(8, Math.min(48, size))}px`;
}

function normalizedShadowFrameOffset(value: string) {
  const size = Number(clockSizeInputValue(value));
  if (!Number.isFinite(size) || size <= 0) return "4px";
  return `${Math.max(3, Math.min(10, size))}px`;
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

function stableViewEditorChrome(view: any) {
  const header = view?.header ?? {};
  const footer = view?.footer ?? {};

  return {
    header: {
      layout: "center",
      badges_position: "bottom",
      badges_wrap: "wrap",
      ...header,
    },
    footer: footer.card
      ? footer
      : {
          ...footer,
          card: {
            type: "markdown",
            text_only: true,
            content: " ",
          },
        },
  };
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
  @state() private _inheritTheme = true;
  @state() private _clock = "digital";
  @state() private _analogHourMarks = false;
  @state() private _analogMinuteMarks = false;
  @state() private _analogSeconds = false;
  @state() private _date = true;
  @state() private _weekday = "none";
  @state() private _statusEnabled = false;
  @state() private _statusBorderColor = "";
  @state() private _statusItems: Array<{ entity?: string; label?: string; unit?: string }> = [];
  @state() private _iconColor = "";
  @state() private _iconActiveColor = "";
  @state() private _iconBackgroundColor = "";
  @state() private _iconShape = "circle";
  @state() private _activeTabColor = "";
  @state() private _inactiveTabColor = "";
  @state() private _hoverTabColor = "";
  @state() private _activeTabTextColor = "";
  @state() private _inactiveTabTextColor = "";
  @state() private _hoverTabTextColor = "";
  @state() private _tabBorderColor = "";
  @state() private _tabShadowFrameColor = "";
  @state() private _cardBorderColor = "";
  @state() private _shadowFrameColor = "";
  @state() private _shadowFrameOffset = "4";
  @state() private _clockSize = "44";
  @state() private _dateSize = "12";
  @state() private _weekdayWrapSize = "21";
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

  connectedCallback() {
    super.connectedCallback();
    Promise.all([customElements.whenDefined("ha-form"), customElements.whenDefined("ha-selector")]).then(() =>
      this.requestUpdate()
    );
  }

  showDialog(params: DashboardLayoutV2DialogParams) {
    this.hass = params.hass;
    this.lovelace = params.lovelace;
    this.viewIndex = params.viewIndex;
    this.viewConfig = params.viewConfig;

    const rawViews = params.lovelace?.rawConfig?.views ?? params.lovelace?.config?.views ?? [];
    const config = normalizeConfig({
      ...params.viewConfig,
      layout: {
        ...(params.viewConfig?.layout ?? {}),
        dashboard_layout_v2:
          referencedDashboardLayoutV2Config(params.viewConfig, rawViews, params.viewIndex) ??
          params.viewConfig?.layout?.dashboard_layout_v2,
      },
    });
    this._menuPosition = config.menu.position ?? "left";
    this._menuTitle = config.menu.title ?? "Haus";
    this._showHome = config.menu.show_home !== false;
    const homeEntry = this._homeEntryFromView(config.menu.home);
    this._homeTitle = homeEntry.title;
    this._homePath = homeEntry.path;
    this._homeIcon = homeEntry.icon;
    this._inheritTheme = config.inherit_theme !== false;
    this._clock = config.menu.clock ?? "digital";
    this._analogHourMarks = config.menu.analog_hour_marks === true;
    this._analogMinuteMarks = config.menu.analog_minute_marks === true;
    this._analogSeconds = config.menu.analog_seconds === true;
    this._date = config.menu.date !== false;
    this._weekday = config.menu.weekday ?? "none";
    this._statusEnabled = config.menu.status?.enabled === true;
    this._statusBorderColor = config.menu.status?.border_color ?? "";
    this._statusItems = this._normalizeStatusItems(config.menu.status?.items);
    this._iconColor = config.menu.style?.icon_color ?? "";
    this._iconActiveColor = config.menu.style?.icon_active_color ?? "";
    this._iconBackgroundColor = config.menu.style?.icon_background_color ?? config.menu.style?.icon_circle_color ?? "";
    this._iconShape = config.menu.style?.icon_shape ?? "circle";
    this._activeTabColor = config.menu.style?.active_tab_color ?? "";
    this._inactiveTabColor = config.menu.style?.inactive_tab_color ?? "";
    this._hoverTabColor = config.menu.style?.hover_tab_color ?? "";
    this._activeTabTextColor = config.menu.style?.active_tab_text_color ?? "";
    this._inactiveTabTextColor = config.menu.style?.inactive_tab_text_color ?? "";
    this._hoverTabTextColor = config.menu.style?.hover_tab_text_color ?? "";
    this._tabBorderColor = config.menu.style?.tab_border_color ?? "";
    this._tabShadowFrameColor = config.menu.style?.tab_shadow_frame_color ?? "";
    this._cardBorderColor = config.menu.style?.card_border_color ?? "";
    this._shadowFrameColor = config.menu.style?.shadow_frame_color ?? "";
    this._shadowFrameOffset = clockSizeInputValue(config.menu.style?.shadow_frame_offset ?? "4px");
    this._clockSize = clockSizeInputValue(config.menu.style?.clock_size ?? "44px");
    this._dateSize = clockSizeInputValue(config.menu.style?.date_size ?? "12px");
    this._weekdayWrapSize = clockSizeInputValue(config.menu.style?.weekday_wrap_size ?? "21px");
    this._backgroundMode = config.menu.style?.background_mode ?? "none";
    this._backgroundColor = config.menu.style?.background_color ?? "";
    this._backgroundImage = config.menu.style?.background_image ?? "";
    this._hideHaChrome = config.chrome?.hide_ha_chrome === true;
    this._adminAlwaysVisible = config.chrome?.admin_always_visible !== false;
    this._visibleUsers = Array.isArray(config.chrome?.visible_users)
      ? config.chrome.visible_users.join(", ")
      : config.chrome?.visible_users ?? "";
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
                index !== this.viewIndex && view?.subview && isDashboardLayoutV2View(view)
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
      if (isMenuOnlyPage(cleanPage)) return cleanPage;

      const matchingView =
        viewsByPath.get(pagePath(cleanPage, index)) ??
        viewsByTitle.get(normalizedTitle(cleanPage.title)) ??
        rawViews[index + 1];
      return this._mergePageWithView(cleanPage, matchingView);
    });
    this._pageSourcePaths = this._pages.map((page, index) =>
      isMenuOnlyPage(page) ? undefined : pagePath(page, index)
    );
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
    if (key === "inheritTheme") this._inheritTheme = value;
    if (key === "clock") this._clock = value;
    if (key === "analogHourMarks") this._analogHourMarks = value;
    if (key === "analogMinuteMarks") this._analogMinuteMarks = value;
    if (key === "analogSeconds") this._analogSeconds = value;
    if (key === "date") this._date = value;
    if (key === "weekday") this._weekday = value;
    if (key === "statusEnabled") this._statusEnabled = value;
    if (key === "statusBorderColor") this._statusBorderColor = value;
    if (key === "iconColor") this._iconColor = value;
    if (key === "iconActiveColor") this._iconActiveColor = value;
    if (key === "iconBackgroundColor") this._iconBackgroundColor = value;
    if (key === "iconShape") this._iconShape = value;
    if (key === "activeTabColor") this._activeTabColor = value;
    if (key === "inactiveTabColor") this._inactiveTabColor = value;
    if (key === "hoverTabColor") this._hoverTabColor = value;
    if (key === "activeTabTextColor") this._activeTabTextColor = value;
    if (key === "inactiveTabTextColor") this._inactiveTabTextColor = value;
    if (key === "hoverTabTextColor") this._hoverTabTextColor = value;
    if (key === "tabBorderColor") this._tabBorderColor = value;
    if (key === "tabShadowFrameColor") this._tabShadowFrameColor = value;
    if (key === "cardBorderColor") this._cardBorderColor = value;
    if (key === "shadowFrameColor") this._shadowFrameColor = value;
    if (key === "shadowFrameOffset") this._shadowFrameOffset = value;
    if (key === "clockSize") this._clockSize = value;
    if (key === "dateSize") this._dateSize = value;
    if (key === "weekdayWrapSize") this._weekdayWrapSize = value;
    if (key === "backgroundMode") this._backgroundMode = value;
    if (key === "backgroundColor") this._backgroundColor = value;
    if (key === "backgroundImage") this._backgroundImage = value;
    if (key === "hideHaChrome") this._hideHaChrome = value;
    if (key === "adminAlwaysVisible") this._adminAlwaysVisible = value;
    if (key === "visibleUsers") this._visibleUsers = value;
    if (key === "pagesText") this._pagesText = value;
  }

  private _normalizeStatusItems(items: any[] = []) {
    const sourceItems = Array.isArray(items) ? items : [];
    const normalized = Array.from({ length: 4 }, (_, index) => ({
      entity: sourceItems[index]?.entity ?? "",
      label: sourceItems[index]?.label ?? "",
      unit: sourceItems[index]?.unit ?? "",
    }));
    return normalized;
  }

  private _updateStatusItem(index: number, key: "entity" | "label" | "unit", value: string) {
    const items = this._normalizeStatusItems(this._statusItems);
    const nextItem = {
      ...items[index],
      [key]: value,
    };
    if (key === "entity" && !items[index]?.label?.trim()) {
      nextItem.label = this.hass?.states?.[value]?.attributes?.friendly_name ?? value;
    }
    items[index] = {
      ...nextItem,
    };
    this._statusItems = items;
  }

  private _statusItemsForSave() {
    return this._normalizeStatusItems(this._statusItems)
      .map((item) => ({
        entity: item.entity?.trim() ?? "",
        label: item.label?.trim() ?? "",
        unit: item.unit?.trim() ?? "",
      }))
      .filter((item) => item.entity);
  }

  private _statusEntityOptions() {
    return Object.keys(this.hass?.states ?? {}).sort((a, b) => a.localeCompare(b));
  }

  private _canUseNativeStatusEntitySelector() {
    return Boolean(customElements.get("ha-form") && customElements.get("ha-selector"));
  }

  private _statusEntitySchema = [
    {
      name: "entity",
      selector: {
        entity: {},
      },
    },
  ];

  private _statusEntityLabel = () => "";

  private _updateStatusEntityFromForm(index: number, ev: CustomEvent) {
    const value = ev.detail?.value?.entity ?? "";
    this._updateStatusItem(index, "entity", value);
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
    if (page?.type === "spacer") return { type: "spacer" };
    if (page?.type === "divider") {
      return {
        type: "divider",
        color: page.color || "#ffffff",
        shadow_frame_color: page.shadow_frame_color || "transparent",
      };
    }

    const title = pageTitle(page, index);
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

  private _collectRelatedDashboardLayoutV2Paths(views: any[], currentPath: string, dashboardLayoutV2: any) {
    const relatedPaths = new Set<string>([currentPath]);

    const addPath = (path: any) => {
      if (path === undefined || path === null || path === "") return false;
      const size = relatedPaths.size;
      relatedPaths.add(String(path));
      return relatedPaths.size !== size;
    };

    const addConfigPaths = (config: any) => {
      let changed = false;
      changed = addPath(config?.inherits_from) || changed;
      changed = addPath(config?.menu?.home?.path) || changed;
      if (Array.isArray(config?.pages)) {
        config.pages.forEach((page: any) => {
          changed = addPath(page?.path) || changed;
        });
      }
      return changed;
    };

    addConfigPaths(dashboardLayoutV2);

    let changed = true;
    while (changed) {
      changed = false;
      views.forEach((view, index) => {
        const viewPath = String(view?.path ?? index);
        const config = dashboardLayoutV2ConfigFromView(view);
        if (!config) return;

        const pagePaths = Array.isArray(config.pages)
          ? config.pages.map((page: any) => String(page?.path ?? ""))
          : [];
        const homePath = config.menu?.home?.path ? String(config.menu.home.path) : "";
        const isConnected =
          relatedPaths.has(viewPath) ||
          (homePath && relatedPaths.has(homePath)) ||
          pagePaths.some((path: string) => relatedPaths.has(path));

        if (!isConnected) return;
        changed = addPath(viewPath) || changed;
        changed = addConfigPaths(config) || changed;
      });
    }

    return relatedPaths;
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

  private _updatePageItemType(index: number, value: string) {
    this._pages = this._pages.map((page, pageIndex) => {
      if (pageIndex !== index) return page;
      if (value === "spacer") return { type: "spacer" };
      if (value === "divider") {
        const colors = this._lastDividerColors(index);
        return {
          type: "divider",
          color: page.color || colors.color,
          shadow_frame_color: page.shadow_frame_color || colors.shadow_frame_color,
        };
      }
      if (!isMenuOnlyPage(page)) return page;

      const nextIndex = index + 1;
      return {
        title: `Unterseite ${nextIndex}`,
        path: `unterseite-${nextIndex}`,
        icon: "mdi:view-dashboard",
        type: SECTIONS_LAYOUT_V2,
        layout_type: SECTIONS_LAYOUT_V2,
        max_columns: 4,
        sections: defaultSections(),
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
      type: SECTIONS_LAYOUT_V2,
      layout_type: SECTIONS_LAYOUT_V2,
      max_columns: 4,
      sections: defaultSections(),
    };
    this._pages = [...this._pages, page];
    this._pageSourcePaths = [...this._pageSourcePaths, undefined];
    this._selectedPageIndex = this._pages.length - 1;
    this._syncJsonFromPages();
  }

  private _addSpacer() {
    this._pages = [...this._pages, { type: "spacer" }];
    this._pageSourcePaths = [...this._pageSourcePaths, undefined];
    this._selectedPageIndex = this._pages.length - 1;
    this._syncJsonFromPages();
  }

  private _lastDividerColors(skipIndex = -1) {
    const source = [...this._pages]
      .map((page, index) => ({ page, index }))
      .reverse()
      .find(({ page, index }) => index !== skipIndex && page?.type === "divider");
    return {
      color: source?.page?.color || "#ffffff",
      shadow_frame_color: source?.page?.shadow_frame_color || "transparent",
    };
  }

  private _addDivider() {
    this._pages = [...this._pages, { type: "divider", ...this._lastDividerColors() }];
    this._pageSourcePaths = [...this._pageSourcePaths, undefined];
    this._selectedPageIndex = this._pages.length - 1;
    this._syncJsonFromPages();
  }

  private _duplicatePage() {
    const page = this._pages[this._selectedPageIndex];
    if (!page) return;
    const copy = {
      ...page,
      ...(isMenuOnlyPage(page)
        ? {}
        : {
            title: `${page.title ?? "Unterseite"} Kopie`,
            path: `${page.path ?? "unterseite"}-kopie`,
          }),
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
      inherit_theme: this._inheritTheme,
      menu: {
        position: this._menuPosition,
        title: this._menuTitle,
        show_home: this._showHome,
        home: homeEntry,
        clock: this._clock,
        analog_hour_marks: this._analogHourMarks,
        analog_minute_marks: this._analogMinuteMarks,
        analog_seconds: this._analogSeconds,
        date: this._date,
        weekday: this._weekday,
        status: {
          enabled: this._statusEnabled,
          border_color: this._statusBorderColor,
          items: this._statusItemsForSave(),
        },
        style: {
          icon_color: this._iconColor,
          icon_active_color: this._iconActiveColor,
          icon_background_color: this._iconBackgroundColor,
          icon_shape: this._iconShape,
          active_tab_color: this._activeTabColor,
          inactive_tab_color: this._inactiveTabColor,
          hover_tab_color: this._hoverTabColor,
          active_tab_text_color: this._activeTabTextColor,
          inactive_tab_text_color: this._inactiveTabTextColor,
          hover_tab_text_color: this._hoverTabTextColor,
          tab_border_color: this._tabBorderColor,
          tab_shadow_frame_color: this._tabShadowFrameColor,
          card_border_color: this._cardBorderColor,
          shadow_frame_color: this._shadowFrameColor,
          shadow_frame_offset: normalizedShadowFrameOffset(this._shadowFrameOffset),
          clock_size: normalizedClockSize(this._clockSize),
          date_size: normalizedDateSize(this._dateSize),
          weekday_wrap_size: normalizedDateSize(this._weekdayWrapSize),
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
    const homePath = String(homeEntry.path);
    const existingViewsByPath = new Map(
      views.map((view, index) => [String(view.path ?? index), { view, index }])
    );
    const homeTheme = existingViewsByPath.get(homePath)?.view.theme ?? views[this.viewIndex].theme;
    const applyInheritedTheme = (view: any, viewPath: string) => {
      if (!this._inheritTheme || viewPath === homePath) return view;
      if (homeTheme) return { ...view, theme: homeTheme };
      const { theme: _theme, ...viewWithoutTheme } = view;
      return viewWithoutTheme;
    };
    const relatedPaths = this._collectRelatedDashboardLayoutV2Paths(views, currentPath, dashboardLayoutV2);
    normalizedPages.forEach((page, index) => {
      if (!isMenuOnlyPage(page)) relatedPaths.add(String(page.path));
      const sourcePath = this._pageSourcePaths[index];
      if (sourcePath) relatedPaths.add(sourcePath);
    });
    const nextViews = views.map((view, index) => {
      const viewPath = String(view.path ?? index);
      const isRelatedDashboardLayoutV2View =
        relatedPaths.has(viewPath) && isDashboardLayoutV2View(view);
      if (!isRelatedDashboardLayoutV2View) return view;
      const nextDashboardLayoutV2 =
        viewPath === homePath || (index === this.viewIndex && !view.subview)
          ? dashboardLayoutV2
          : dashboardLayoutV2Reference(homePath);
      return applyInheritedTheme({
        ...view,
        ...stableViewEditorChrome(view),
        layout: {
          ...(layoutWithoutDashboardLayoutV2(view.layout) ?? {}),
          dashboard_layout_v2: nextDashboardLayoutV2,
        },
      }, viewPath);
    });

    for (const [pageIndex, page] of normalizedPages.entries()) {
      if (isMenuOnlyPage(page)) continue;

      const pagePath = String(page.path);
      const sourcePath = this._pageSourcePaths[pageIndex];
      const existing = sourcePath
        ? existingViewsByPath.get(sourcePath) ?? existingViewsByPath.get(pagePath)
        : existingViewsByPath.get(pagePath);
      const isCurrentView = (sourcePath ?? pagePath) === currentPath;
      const pageLayout = {
        ...(layoutWithoutDashboardLayoutV2(existing?.view.layout ?? page.layout) ?? {}),
        dashboard_layout_v2: dashboardLayoutV2Reference(homePath),
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
        const updatedView = applyInheritedTheme({
          ...existing.view,
          title: page.title,
          path: pagePath,
          ...(page.icon ? { icon: page.icon } : {}),
          type,
          subview: isCurrentView ? existing.view.subview : true,
          layout: pageLayout,
        }, pagePath);
        Object.assign(updatedView, stableViewEditorChrome(updatedView));
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

      const newView = applyInheritedTheme({
        title: page.title,
        path: pagePath,
        ...(page.icon ? { icon: page.icon } : {}),
        type,
        subview: true,
        layout: pageLayout,
      }, pagePath);
      Object.assign(newView, stableViewEditorChrome(newView));
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
    const selectedPageItemType = selectedPage ? pageItemType(selectedPage) : "page";

    return html`
      <div class="scrim" @click=${this._close}></div>
      <section class="dialog" role="dialog" aria-modal="true">
        <header>
          <h2>Dashboard Layout V2</h2>
          <button class="icon" @click=${this._close} title="Schließen">×</button>
        </header>

        <div class="content">
          <details class="wide collapsible-group">
            <summary>Menü</summary>
            <div class="section-grid">
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
            </div>
          </details>

          <details class="wide collapsible-group">
            <summary>Hauptseite</summary>
            <div class="section-grid">
              <label class="check">
                <input
                  type="checkbox"
                  .checked=${this._showHome}
                  @change=${(ev: Event) => this._setValue("showHome", (ev.target as HTMLInputElement).checked)}
                />
                Hauptseite als ersten Menüpunkt anzeigen
              </label>

              <fieldset class="home-entry group">
                <legend>Hauptseitefeld</legend>
                <span>
                  <ha-icon .icon=${this._homeIcon}></ha-icon>
                  ${this._homeTitle}
                </span>
                <small>${this._homePath}</small>
              </fieldset>

              <label class="check">
                <input
                  type="checkbox"
                  .checked=${this._inheritTheme}
                  @change=${(ev: Event) => this._setValue("inheritTheme", (ev.target as HTMLInputElement).checked)}
                />
                Theme von Hauptansicht übernehmen
              </label>
            </div>
          </details>

          <details class="wide collapsible-group">
            <summary>Uhr</summary>
            <div class="section-grid">
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

              <fieldset class="display-options group">
                <legend>Anzeigeauswahl</legend>
                ${this._clock === "analog"
                  ? html`
                    <label class="check compact-check">
                      <input
                        type="checkbox"
                        .checked=${this._analogHourMarks}
                        @change=${(ev: Event) =>
                          this._setValue("analogHourMarks", (ev.target as HTMLInputElement).checked)}
                      />
                      Stunden
                    </label>
                    <label class="check compact-check">
                      <input
                        type="checkbox"
                        .checked=${this._analogMinuteMarks}
                        @change=${(ev: Event) =>
                          this._setValue("analogMinuteMarks", (ev.target as HTMLInputElement).checked)}
                      />
                      Minuten
                    </label>
                    <label class="check compact-check">
                      <input
                        type="checkbox"
                        .checked=${this._analogSeconds}
                        @change=${(ev: Event) =>
                          this._setValue("analogSeconds", (ev.target as HTMLInputElement).checked)}
                      />
                      Sekundenzeiger
                    </label>
                  `
                  : nothing}

                <label class="check compact-check">
                  <input
                    type="checkbox"
                    .checked=${this._date}
                    @change=${(ev: Event) => this._setValue("date", (ev.target as HTMLInputElement).checked)}
                  />
                  Datum
                </label>
              </fieldset>

              <fieldset class="weekday-options group">
                <legend>Wochentag</legend>
                <label class="check">
                  <input
                    type="radio"
                    name="dashboard-layout-v2-weekday"
                    value="none"
                    .checked=${this._weekday === "none"}
                    @change=${() => this._setValue("weekday", "none")}
                  />
                  Kein
                </label>
                <label class="check">
                  <input
                    type="radio"
                    name="dashboard-layout-v2-weekday"
                    value="short"
                    .checked=${this._weekday === "short"}
                    @change=${() => this._setValue("weekday", "short")}
                  />
                  Kürzel
                </label>
                <label class="check">
                  <input
                    type="radio"
                    name="dashboard-layout-v2-weekday"
                    value="long"
                    .checked=${this._weekday === "long"}
                    @change=${() => this._setValue("weekday", "long")}
                  />
                  Ausgeschrieben
                </label>
              </fieldset>
            </div>
          </details>

          <details class="wide collapsible-group">
            <summary>HA Setting</summary>
            <div class="section-grid">
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
              <label class="wide">
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
            </div>
          </details>

          <details class="wide collapsible-group" open>
            <summary>Tabs / Unterseiten</summary>
            <div class="page-editor">
              <div class="page-list">
                ${this._pages.map(
                  (page, index) => html`
                    <button
                      class=${index === this._selectedPageIndex ? "selected" : ""}
                      @click=${() => (this._selectedPageIndex = index)}
                    >
                      <span>
                        ${page.type === "spacer"
                          ? "Abstand"
                          : page.type === "divider"
                            ? "Trenner"
                            : pageTitle(page, index)}
                      </span>
                      ${page.type === "divider"
                        ? nothing
                        : html`<small>${page.type === "spacer" ? "leer" : page.path ?? ""}</small>`}
                    </button>
                  `
                )}
              </div>

              <div class="page-form">
                ${selectedPage
                  ? html`
                      <label>
                        Typ
                        <select
                          .value=${selectedPageItemType}
                          @change=${(ev: Event) =>
                            this._updatePageItemType(this._selectedPageIndex, (ev.target as HTMLSelectElement).value)}
                        >
                          <option value="page" ?selected=${selectedPageItemType === "page"}>Seite</option>
                          <option value="spacer" ?selected=${selectedPageItemType === "spacer"}>Abstand</option>
                          <option value="divider" ?selected=${selectedPageItemType === "divider"}>Trenner</option>
                        </select>
                      </label>
                      ${selectedPageItemType === "divider"
                        ? html`
                            <label class="divider-color-field">
                              Trennerfarbe
                              <div class="color-row">
                                <input
                                  class="text"
                                  .value=${selectedPage.color ?? "#ffffff"}
                                  placeholder="#ffffff"
                                  @input=${(ev: Event) =>
                                    this._updatePage(this._selectedPageIndex, "color", (ev.target as HTMLInputElement).value)}
                                />
                                <input
                                  class="color"
                                  type="color"
                                  .value=${colorPickerValue(selectedPage.color ?? "#ffffff")}
                                  title="Trennerfarbe auswählen"
                                  @input=${(ev: Event) =>
                                    this._updatePage(this._selectedPageIndex, "color", (ev.target as HTMLInputElement).value)}
                                />
                              </div>
                            </label>
                            <label class="divider-color-field">
                              3D-Effekt Trenner
                              <div class="color-row">
                                <input
                                  class="text"
                                  .value=${selectedPage.shadow_frame_color ?? "transparent"}
                                  placeholder="transparent"
                                  @input=${(ev: Event) =>
                                    this._updatePage(
                                      this._selectedPageIndex,
                                      "shadow_frame_color",
                                      (ev.target as HTMLInputElement).value
                                    )}
                                />
                                <input
                                  class="color"
                                  type="color"
                                  .value=${colorPickerValue(selectedPage.shadow_frame_color ?? "transparent")}
                                  title="3D-Effekt Trenner auswählen"
                                  @input=${(ev: Event) =>
                                    this._updatePage(
                                      this._selectedPageIndex,
                                      "shadow_frame_color",
                                      (ev.target as HTMLInputElement).value
                                    )}
                                />
                              </div>
                            </label>
                          `
                        : nothing}
                      ${selectedPageItemType === "page"
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
                        : nothing}
                    `
                  : html`<p class="empty">Noch keine Unterseite angelegt.</p>`}
              </div>
            </div>

            <div class="actions">
              <button @click=${this._addPage}>Hinzufügen</button>
              <button @click=${this._addSpacer}>Abstand</button>
              <button @click=${this._addDivider}>Trenner</button>
              <button @click=${this._duplicatePage} ?disabled=${!selectedPage}>Duplizieren</button>
              <button @click=${() => this._movePage(-1)} ?disabled=${this._selectedPageIndex <= 0}>Hoch</button>
              <button @click=${() => this._movePage(1)} ?disabled=${this._selectedPageIndex >= this._pages.length - 1}>Runter</button>
              <button class="danger" @click=${this._deletePage} ?disabled=${!selectedPage}>Löschen</button>
            </div>
          </details>

          <details class="wide collapsible-group">
            <summary>Statuswerte</summary>
            <div class="status-editor">
              <label class="check">
                <input
                  type="checkbox"
                  .checked=${this._statusEnabled}
                  @change=${(ev: Event) => this._setValue("statusEnabled", (ev.target as HTMLInputElement).checked)}
                />
                Statuswerte anzeigen
              </label>
              ${this._statusEnabled
                ? html`
                    ${this._renderColorField(
                      "Rahmenfarbe",
                      "statusBorderColor",
                      this._statusBorderColor,
                      "leer = Tabumrandung, sonst #ffffff"
                    )}
                    <div class="status-items">
                      <span>Entity</span>
                      <span>Label</span>
                      <span>Einheit</span>
                      ${this._normalizeStatusItems(this._statusItems).map(
                        (item, index) => html`
                          ${this._canUseNativeStatusEntitySelector()
                            ? html`
                                <ha-form
                                  class="status-entity-form"
                                  .hass=${this.hass}
                                  .schema=${this._statusEntitySchema}
                                  .data=${{ entity: item.entity ?? "" }}
                                  .computeLabel=${this._statusEntityLabel}
                                  @value-changed=${(ev: CustomEvent) => this._updateStatusEntityFromForm(index, ev)}
                                ></ha-form>
                              `
                            : html`
                                <input
                                  class="entity-input"
                                  list="dashboard-layout-v2-status-entities"
                                  placeholder=${`sensor.status_${index + 1}`}
                                  .value=${item.entity ?? ""}
                                  @input=${(ev: Event) =>
                                    this._updateStatusItem(index, "entity", (ev.target as HTMLInputElement).value)}
                                />
                              `}
                          <input
                            placeholder="Optional"
                            .value=${item.label ?? ""}
                            @input=${(ev: Event) =>
                              this._updateStatusItem(index, "label", (ev.target as HTMLInputElement).value)}
                          />
                          <input
                            placeholder="Optional"
                            .value=${item.unit ?? ""}
                            @input=${(ev: Event) =>
                              this._updateStatusItem(index, "unit", (ev.target as HTMLInputElement).value)}
                          />
                        `
                      )}
                    </div>
                    <datalist id="dashboard-layout-v2-status-entities">
                      ${this._statusEntityOptions().map((entityId) => {
                        const friendlyName = this.hass?.states?.[entityId]?.attributes?.friendly_name;
                        return html`<option value=${entityId} label=${friendlyName ?? entityId}></option>`;
                      })}
                    </datalist>
                  `
                : nothing}
            </div>
          </details>

          <details class="wide collapsible-group">
            <summary>Style</summary>
            <div class="style-grid">
              <label>
                Größe Uhr
                <input
                  type="number"
                  min="24"
                  max="128"
                  step="1"
                  .value=${this._clockSize}
                  @input=${(ev: Event) => this._setValue("clockSize", (ev.target as HTMLInputElement).value)}
                />
              </label>
              <label>
                Größe Datum
                <input
                  type="number"
                  min="8"
                  max="48"
                  step="1"
                  .value=${this._dateSize}
                  @input=${(ev: Event) => this._setValue("dateSize", (ev.target as HTMLInputElement).value)}
                />
              </label>
              ${this._weekday === "long"
                ? html`
                    <label>
                      Zeilenumbruch ab
                      <input
                        type="number"
                        min="12"
                        max="48"
                        step="1"
                        .value=${this._weekdayWrapSize}
                        @input=${(ev: Event) =>
                          this._setValue("weekdayWrapSize", (ev.target as HTMLInputElement).value)}
                      />
                    </label>
                    <span class="style-empty" aria-hidden="true"></span>
                  `
                : nothing}
              ${this._renderColorField("Tab aktiv", "activeTabColor", this._activeTabColor, "var(--primary-color)")}
              ${this._renderColorField("Text aktiv", "activeTabTextColor", this._activeTabTextColor, "var(--text-primary-color)")}
              ${this._renderColorField("Tab inaktiv", "inactiveTabColor", this._inactiveTabColor, "transparent")}
              ${this._renderColorField("Text inaktiv", "inactiveTabTextColor", this._inactiveTabTextColor, "var(--primary-text-color)")}
              ${this._renderColorField("Hover Farbe", "hoverTabColor", this._hoverTabColor, "var(--secondary-background-color)")}
              ${this._renderColorField("Hover Text", "hoverTabTextColor", this._hoverTabTextColor, "var(--primary-text-color)")}
              ${this._renderColorField("Tabumrandung", "tabBorderColor", this._tabBorderColor, "transparent")}
              ${this._renderColorField("3D-Effekt Tab", "tabShadowFrameColor", this._tabShadowFrameColor, "transparent")}
              ${this._renderColorField("Cardumrandung", "cardBorderColor", this._cardBorderColor, "transparent")}
              ${this._renderColorField("3D-Effekt Card", "shadowFrameColor", this._shadowFrameColor, "transparent")}
              <label class="wide-style">
                3D-Versatz
                <div class="range-row">
                  <input
                    type="range"
                    min="3"
                    max="10"
                    step="1"
                    .value=${this._shadowFrameOffset}
                    @input=${(ev: Event) => this._setValue("shadowFrameOffset", (ev.target as HTMLInputElement).value)}
                  />
                  <span>${this._shadowFrameOffset}px</span>
                </div>
              </label>
              <div class="icon-style-grid wide">
                <div class="icon-style-column">
                  ${this._renderColorField("Icon Farbe", "iconColor", this._iconColor, "var(--primary-color)")}
                  <label>
                    Icon-Form
                    <div class="shape-options">
                      <button
                        class=${this._iconShape === "circle" ? "selected" : ""}
                        type="button"
                        title="Kreis"
                        @click=${() => this._setValue("iconShape", "circle")}
                      >
                        <span class="shape-preview circle"></span>
                      </button>
                      <button
                        class=${this._iconShape === "rounded-square" ? "selected" : ""}
                        type="button"
                        title="Abgerundetes Quadrat"
                        @click=${() => this._setValue("iconShape", "rounded-square")}
                      >
                        <span class="shape-preview rounded-square"></span>
                      </button>
                    </div>
                  </label>
                </div>
                <div class="icon-style-column">
                  ${this._renderColorField("Icon aktiv Farbe", "iconActiveColor", this._iconActiveColor, "Icon Farbe")}
                  ${this._renderColorField("Icon-Feld Farbe", "iconBackgroundColor", this._iconBackgroundColor, "transparent")}
                </div>
              </div>
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
                      Bild
                      <input
                        placeholder="/local/background.jpg"
                        .value=${this._backgroundImage}
                        @input=${(ev: Event) => this._setValue("backgroundImage", (ev.target as HTMLInputElement).value)}
                      />
                    </label>
                  `
                : nothing}
            </div>
          </details>

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
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          width: min(760px, calc(100vw - 32px));
          height: min(920px, calc(100vh - 32px));
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
        .divider-color-field,
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

        .collapsible-group {
          display: grid;
          gap: 12px;
          padding: 12px;
          border: 1px solid var(--divider-color, #333);
          border-radius: 8px;
        }

        .collapsible-group:not([open]) {
          gap: 0;
        }

        .section-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          align-content: start;
        }

        legend {
          padding: 0 6px;
          font-weight: 800;
        }

        .home-entry {
          align-content: center;
          gap: 6px;
        }

        .weekday-options,
        .display-options {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .weekday-options .check,
        .display-options .check {
          grid-column: auto;
        }

        .display-options {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px 18px;
        }

        .compact-check {
          min-height: 24px;
          gap: 6px;
          white-space: nowrap;
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

        .style-empty {
          min-height: 40px;
        }

        .icon-style-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 16px;
          align-items: start;
        }

        .icon-style-column {
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .status-editor {
          display: grid;
          gap: 12px;
        }

        .status-items {
          display: grid;
          grid-template-columns: minmax(180px, 1.4fr) minmax(120px, 1fr) minmax(80px, 0.7fr);
          gap: 8px;
          align-items: center;
        }

        .status-items span {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 800;
        }

        .status-items .status-entity-form,
        .status-items .entity-input {
          min-width: 0;
          width: 100%;
        }

        .shape-options {
          display: grid;
          grid-template-columns: repeat(2, 48px);
          gap: 8px;
        }

        .shape-options button {
          display: grid;
          place-items: center;
          min-width: 0;
          width: 48px;
          height: 40px;
          padding: 0;
        }

        .shape-options button.selected {
          border-color: var(--primary-color, #03a9f4);
          background: color-mix(in srgb, var(--primary-color, #03a9f4) 24%, transparent);
        }

        .shape-preview {
          width: 24px;
          height: 24px;
          border: 2px solid var(--primary-text-color, #fff);
          background: var(--primary-color, #03a9f4);
        }

        .shape-preview.circle {
          border-radius: 50%;
        }

        .shape-preview.rounded-square {
          border-radius: 7px;
        }

        .range-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 48px;
          align-items: center;
          gap: 10px;
        }

        .range-row span {
          text-align: right;
          color: var(--secondary-text-color);
          font-weight: 700;
        }

        .wide-style {
          grid-column: 1 / -1;
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
