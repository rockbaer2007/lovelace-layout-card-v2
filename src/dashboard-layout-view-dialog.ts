import { CSSResultArray, LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import {
  DashboardLayoutV2Language,
  dashboardLayoutV2Translate,
  normalizeDashboardLayoutV2Language,
  resolveDashboardLayoutV2Language,
  translateDashboardLayoutV2Dom,
} from "./i18n";

type DashboardLayoutV2DialogParams = {
  hass: any;
  lovelace: any;
  viewIndex: number;
  viewConfig: any;
};

const DEFAULT_NOTIFY_ENTITY = "input_text.dashboard_notification";
const DEFAULT_HOLIDAY_ENTITY = "input_boolean.dashboard_holiday";
const DEFAULT_BIRTHDAY_ENTITY = "input_boolean.dashboard_birthday";
const DEFAULT_CHRISTMAS_ENTITY = "input_boolean.dashboard_christmas";

type DashboardLayoutDialogTab = "menu" | "display" | "pages" | "submenu" | "messages" | "style" | "colors" | "backup" | "advanced";

type DashboardLayoutColorPreset = {
  name?: string;
  value?: string;
};

const defaultConfig = {
  inherit_theme: true,
  menu: {
    position: "left",
    title: "House",
    show_home: true,
    icon_only: false,
    home: {},
    clock: "digital",
    analog_hour_marks: false,
    analog_minute_marks: false,
    analog_seconds: false,
    date: true,
    weekday: "none",
    day_symbol: {
      holiday_entity: DEFAULT_HOLIDAY_ENTITY,
      birthday_entity: DEFAULT_BIRTHDAY_ENTITY,
      christmas_entity: DEFAULT_CHRISTMAS_ENTITY,
      size: "32px",
    },
    notify: {
      enabled: false,
      entity: DEFAULT_NOTIFY_ENTITY,
      border_color: "",
      border_opacity: 100,
    },
    status: {
      enabled: false,
      border_color: "",
      border_opacity: 100,
      items: [],
    },
    style: {
      icon_color: "",
      icon_active_color: "",
      icon_background_color: "",
      icon_background_active_color: "",
      icon_shape: "rounded-square",
      icon_size: "20px",
      active_tab_color: "",
      inactive_tab_color: "",
      hover_tab_color: "",
      active_tab_text_color: "",
      inactive_tab_text_color: "",
      hover_tab_text_color: "",
      tab_border_color: "",
      tab_border_opacity: 100,
      tab_shadow_frame_color: "",
      card_border_color: "",
      card_border_opacity: 100,
      shadow_frame_color: "",
      shadow_frame_offset: "4px",
      clock_size: "44px",
      date_size: "12px",
      weekday_wrap_size: "21px",
      weekend_color: "",
      clock_color: "",
      analog_minute_mark_color: "",
      analog_hour_mark_color: "",
      analog_hour_hand_color: "",
      analog_minute_hand_color: "",
      analog_second_hand_color: "",
      background_mode: "none",
      background_color: "",
      background_opacity: 100,
      background_image: "",
      submenu_background_color: "",
      submenu_background_opacity: 100,
    },
  },
  chrome: {
    hide_ha_chrome: false,
    admin_always_visible: true,
    visible_users: "",
  },
  color_presets: [],
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
const STATUS_LABEL_MAX_LENGTH = 18;
const COLOR_PRESET_COUNT = 20;
const PAGE_COLOR_KEYS = [
  "icon_color",
  "icon_active_color",
  "icon_background_color",
  "icon_background_active_color",
  "tab_color",
  "active_tab_color",
];

function slugifyPath(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dashboardLayoutV2ConfigFromLayoutFallback(layout: any) {
  if (!layout || typeof layout !== "object") return undefined;
  if (layout.menu || layout.pages || layout.chrome || layout.color_presets || layout.inherit_theme !== undefined) {
    return layout;
  }
  return undefined;
}

function dashboardLayoutConfigFrom(viewConfig: any) {
  return (
    viewConfig?.layout?.dashboard_layout_v2 ??
    viewConfig?.dashboard_layout_v2 ??
    dashboardLayoutV2ConfigFromLayoutFallback(viewConfig?.layout) ??
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
      notify: {
        ...defaultConfig.menu.notify,
        ...(dashboardLayoutConfig?.menu?.notify ?? {}),
      },
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
  return (
    viewConfig?.layout?.dashboard_layout_v2 ??
    viewConfig?.dashboard_layout_v2 ??
    dashboardLayoutV2ConfigFromLayoutFallback(viewConfig?.layout)
  );
}

function dashboardLayoutV2PageContainsPath(page: any, path: string) {
  if (String(page?.path ?? "") === path) return true;
  return Array.isArray(page?.subpages)
    ? page.subpages.some((subpage: any) => String(subpage?.path ?? "") === path)
    : false;
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
    return Array.isArray(pages) && pages.some((page: any) => dashboardLayoutV2PageContainsPath(page, currentPath));
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
      divider_opacity: normalizedOpacity(page.divider_opacity),
      height: normalizedDividerHeight(page.height ?? "4px"),
    };
  }

  const metadata: any = {
    title: pageTitle(page, 0),
    path: page.path,
    ...(page.icon ? { icon: page.icon } : {}),
    ...(page.icon_color ? { icon_color: page.icon_color } : {}),
    ...(page.icon_active_color ? { icon_active_color: page.icon_active_color } : {}),
    ...(page.icon_background_color ? { icon_background_color: page.icon_background_color } : {}),
    ...(page.icon_background_active_color ? { icon_background_active_color: page.icon_background_active_color } : {}),
    ...(page.tab_color ? { tab_color: page.tab_color } : {}),
    ...(page.active_tab_color ? { active_tab_color: page.active_tab_color } : {}),
    ...(Array.isArray(page.subpages) && page.subpages.length
      ? { subpages: page.subpages.map((subpage: any) => pageNavigationMetadata(subpage)) }
      : {}),
    ...(page.hide_submenu_parent === true ? { hide_submenu_parent: true } : {}),
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

function normalizeColorPresets(presets: any[] = []): DashboardLayoutColorPreset[] {
  const source = Array.isArray(presets) ? presets : [];
  return Array.from({ length: COLOR_PRESET_COUNT }, (_, index) => ({
    name: String(source[index]?.name ?? ""),
    value: String(source[index]?.value ?? ""),
  }));
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

function yamlScalar(value: any) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const text = String(value);
  if (!text) return '""';
  if (/^[A-Za-z0-9_./:@#%+-]+$/.test(text) && !["true", "false", "null", "yes", "no", "on", "off"].includes(text.toLowerCase())) {
    return text;
  }
  return JSON.stringify(text);
}

function yamlDump(value: any, indent = 0): string {
  const space = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return `${space}[]\n`;
    return value.map((item) => {
      if (item && typeof item === "object") {
        const nested = yamlDump(item, indent + 2).trimEnd();
        return `${space}- ${nested.slice(indent + 2)}\n`;
      }
      return `${space}- ${yamlScalar(item)}\n`;
    }).join("");
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);
    if (!entries.length) return `${space}{}\n`;
    return entries.map(([key, entryValue]) => {
      if (entryValue && typeof entryValue === "object") {
        return `${space}${key}:\n${yamlDump(entryValue, indent + 2)}`;
      }
      return `${space}${key}: ${yamlScalar(entryValue)}\n`;
    }).join("");
  }
  return `${space}${yamlScalar(value)}\n`;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizedDaySymbolSize(value: string) {
  const size = Number(clockSizeInputValue(value));
  if (!Number.isFinite(size) || size <= 0) return "32px";
  return `${Math.max(24, Math.min(64, size))}px`;
}

function normalizedIconSize(value: string) {
  const size = Number(clockSizeInputValue(value));
  if (!Number.isFinite(size) || size <= 0) return "20px";
  return `${Math.max(14, Math.min(64, size))}px`;
}

function iconSizeInputValue(value: string | number | undefined) {
  const size = Number(clockSizeInputValue(String(value ?? "20px")));
  if (!Number.isFinite(size) || size <= 0) return "20";
  return String(Math.max(14, Math.min(64, size)));
}

function configIconSize(config: any) {
  return config?.menu?.style?.icon_size ?? config?.menu?.icon_size ?? "20px";
}

function normalizedOpacity(value: any) {
  const opacity = Number(String(value ?? 100).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(opacity)) return 100;
  return Math.max(0, Math.min(100, Math.round(opacity)));
}

function normalizedShadowFrameOffset(value: string) {
  const size = Number(clockSizeInputValue(value));
  if (!Number.isFinite(size) || size <= 0) return "4px";
  return `${Math.max(3, Math.min(10, size))}px`;
}

function normalizedDividerHeight(value: string) {
  const size = Number(clockSizeInputValue(value));
  if (!Number.isFinite(size) || size <= 0) return "4px";
  return `${Math.max(1, Math.min(4, size))}px`;
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

function isDefaultEmptySections(value: any) {
  return Array.isArray(value) && value.length === 1 && value[0]?.type === "grid" && Array.isArray(value[0]?.cards) && value[0].cards.length === 0;
}

function pageSectionsForSave(page: any, existingView: any) {
  if (Array.isArray(existingView?.sections) && existingView.sections.length && isDefaultEmptySections(page.sections)) {
    return existingView.sections;
  }
  if (Array.isArray(existingView?.cards) && existingView.cards.length && isDefaultEmptySections(page.sections)) {
    return [{ type: "grid", cards: existingView.cards }];
  }
  return sectionsFromExistingData(page, existingView);
}

function pageCardsForSave(page: any, existingView: any) {
  if (Array.isArray(existingView?.cards) && existingView.cards.length && Array.isArray(page.cards) && page.cards.length === 0) {
    return existingView.cards;
  }
  return Array.isArray(page.cards)
    ? page.cards
    : Array.isArray(existingView?.cards)
      ? existingView.cards
      : [];
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
  @state() private _menuTitle = "House";
  @state() private _showHome = true;
  @state() private _iconOnly = false;
  @state() private _homeTitle = "Home";
  @state() private _homePath = "home";
  @state() private _homeIcon = "mdi:home";
  @state() private _homeIconColor = "";
  @state() private _homeIconActiveColor = "";
  @state() private _homeIconBackgroundColor = "";
  @state() private _homeIconBackgroundActiveColor = "";
  @state() private _homeTabColor = "";
  @state() private _homeActiveTabColor = "";
  @state() private _homeMaxColumns = 4;
  @state() private _homeDenseSectionPlacement = false;
  @state() private _homeTopMargin = false;
  @state() private _inheritTheme = true;
  @state() private _clock = "digital";
  @state() private _analogHourMarks = false;
  @state() private _analogMinuteMarks = false;
  @state() private _analogSeconds = false;
  @state() private _date = true;
  @state() private _weekday = "none";
  @state() private _holidayEntity = DEFAULT_HOLIDAY_ENTITY;
  @state() private _birthdayEntity = DEFAULT_BIRTHDAY_ENTITY;
  @state() private _christmasEntity = DEFAULT_CHRISTMAS_ENTITY;
  @state() private _daySymbolSize = "32";
  @state() private _notifyEnabled = false;
  @state() private _notifyEntity = DEFAULT_NOTIFY_ENTITY;
  @state() private _notifyBorderColor = "";
  @state() private _notifyBorderOpacity = 100;
  @state() private _statusEnabled = false;
  @state() private _statusBorderColor = "";
  @state() private _statusBorderOpacity = 100;
  @state() private _statusItems: Array<{ entity?: string; label?: string; unit?: string }> = [];
  @state() private _iconColor = "";
  @state() private _iconActiveColor = "";
  @state() private _iconBackgroundColor = "";
  @state() private _iconBackgroundActiveColor = "";
  @state() private _iconShape = "rounded-square";
  @state() private _iconSize = "20";
  @state() private _activeTabColor = "";
  @state() private _inactiveTabColor = "";
  @state() private _hoverTabColor = "";
  @state() private _activeTabTextColor = "";
  @state() private _inactiveTabTextColor = "";
  @state() private _hoverTabTextColor = "";
  @state() private _tabBorderColor = "";
  @state() private _tabBorderOpacity = 100;
  @state() private _tabShadowFrameColor = "";
  @state() private _cardBorderColor = "";
  @state() private _cardBorderOpacity = 100;
  @state() private _shadowFrameColor = "";
  @state() private _shadowFrameOffset = "4";
  @state() private _clockSize = "44";
  @state() private _dateSize = "12";
  @state() private _weekdayWrapSize = "21";
  @state() private _weekendColor = "";
  @state() private _clockColor = "";
  @state() private _analogMinuteMarkColor = "";
  @state() private _analogHourMarkColor = "";
  @state() private _analogHourHandColor = "";
  @state() private _analogMinuteHandColor = "";
  @state() private _analogSecondHandColor = "";
  @state() private _backgroundMode = "none";
  @state() private _backgroundColor = "";
  @state() private _backgroundOpacity = 100;
  @state() private _backgroundImage = "";
  @state() private _submenuBackgroundColor = "";
  @state() private _submenuBackgroundOpacity = 100;
  @state() private _hideHaChrome = false;
  @state() private _adminAlwaysVisible = true;
  @state() private _visibleUsers = "";
  @state() private _pages: any[] = [];
  @state() private _colorPresets: DashboardLayoutColorPreset[] = normalizeColorPresets();
  private _pageSourcePaths: Array<string | undefined> = [];
  @state() private _selectedPageIndex = 0;
  @state() private _selectedSubPageIndex = 0;
  @state() private _openNotifyEntityPicker = false;
  @state() private _notifyEntitySearch = "";
  @state() private _openStatusEntityIndex = -1;
  @state() private _statusEntitySearch: Record<number, string> = {};
  @state() private _openDaySymbolEntity = "";
  @state() private _daySymbolEntitySearch: Record<string, string> = {};
  @state() private _jsonExpanded = false;
  @state() private _pagesText = "[]";
  @state() private _error = "";
  @state() private _activeTab: DashboardLayoutDialogTab = "menu";
  @state() private _wideDialog = false;
  @state() private _language: DashboardLayoutV2Language = "en";
  @state() private _debugLanguage = "";

  private _viewWithDebugLanguagePlaceholder(view: any) {
    if (view?.debug && Object.prototype.hasOwnProperty.call(view.debug, "language")) return view;
    return {
      ...view,
      debug: {
        ...(view?.debug ?? {}),
        language: "",
      },
    };
  }

  private async _ensureDebugLanguagePlaceholder(params: DashboardLayoutV2DialogParams, viewConfig: any) {
    if (viewConfig?.debug && Object.prototype.hasOwnProperty.call(viewConfig.debug, "language")) return;
    const rawConfig = params.lovelace?.rawConfig ?? params.lovelace?.config;
    const views = rawConfig?.views;
    if (!Array.isArray(views) || !views[params.viewIndex] || typeof params.lovelace?.saveConfig !== "function") return;
    const nextViews = views.map((view: any, index: number) =>
      index === params.viewIndex ? this._viewWithDebugLanguagePlaceholder(view) : view
    );
    await params.lovelace.saveConfig({
      ...rawConfig,
      views: nextViews,
    });
  }

  showDialog(params: DashboardLayoutV2DialogParams) {
    this.hass = params.hass;
    this.lovelace = params.lovelace;
    this.viewIndex = params.viewIndex;

    const rawViews = params.lovelace?.rawConfig?.views ?? params.lovelace?.config?.views ?? [];
    const originalViewConfig = rawViews?.[params.viewIndex] ?? params.viewConfig ?? {};
    const currentViewConfig = this._viewWithDebugLanguagePlaceholder(originalViewConfig);
    this.viewConfig = currentViewConfig;
    void this._ensureDebugLanguagePlaceholder(params, originalViewConfig);
    const currentDashboardLayoutV2 = dashboardLayoutV2ConfigFromView(currentViewConfig);
    this._debugLanguage = normalizeDashboardLayoutV2Language(
      currentViewConfig?.debug?.language ?? currentDashboardLayoutV2?.debug?.language
    ) ?? "";
    this._language = resolveDashboardLayoutV2Language({
      debugLanguage: this._debugLanguage,
      hass: this.hass,
    });

    const config = normalizeConfig({
      ...currentViewConfig,
      layout: {
        ...(currentViewConfig?.layout ?? {}),
        dashboard_layout_v2:
          referencedDashboardLayoutV2Config(currentViewConfig, rawViews, params.viewIndex) ??
          currentDashboardLayoutV2,
      },
    });
    this._menuPosition = config.menu.position ?? "left";
    this._menuTitle = config.menu.title ?? "House";
    this._showHome = config.menu.show_home !== false;
    this._iconOnly = config.menu.icon_only === true;
    const homeEntry = this._homeEntryFromView(config.menu.home);
    this._homeTitle = homeEntry.title;
    this._homePath = homeEntry.path;
    this._homeIcon = homeEntry.icon;
    this._homeIconColor = homeEntry.icon_color;
    this._homeIconActiveColor = homeEntry.icon_active_color;
    this._homeIconBackgroundColor = homeEntry.icon_background_color;
    this._homeIconBackgroundActiveColor = homeEntry.icon_background_active_color;
    this._homeTabColor = homeEntry.tab_color;
    this._homeActiveTabColor = homeEntry.active_tab_color;
    this._homeMaxColumns = Number(currentViewConfig?.max_columns ?? 4);
    this._homeDenseSectionPlacement = currentViewConfig?.dense_section_placement === true;
    this._homeTopMargin = currentViewConfig?.top_margin === true;
    this._inheritTheme = config.inherit_theme !== false;
    this._clock = config.menu.clock ?? "digital";
    this._analogHourMarks = config.menu.analog_hour_marks === true;
    this._analogMinuteMarks = config.menu.analog_minute_marks === true;
    this._analogSeconds = config.menu.analog_seconds === true;
    this._date = config.menu.date !== false;
    this._weekday = config.menu.weekday ?? "none";
    this._holidayEntity = config.menu.day_symbol?.holiday_entity ?? DEFAULT_HOLIDAY_ENTITY;
    this._birthdayEntity = config.menu.day_symbol?.birthday_entity ?? DEFAULT_BIRTHDAY_ENTITY;
    this._christmasEntity = config.menu.day_symbol?.christmas_entity ?? DEFAULT_CHRISTMAS_ENTITY;
    this._daySymbolSize = clockSizeInputValue(config.menu.day_symbol?.size ?? "32px");
    this._notifyEnabled = config.menu.notify?.enabled === true;
    this._notifyEntity = config.menu.notify?.entity ?? DEFAULT_NOTIFY_ENTITY;
    this._notifyBorderColor = config.menu.notify?.border_color ?? "";
    this._notifyBorderOpacity = normalizedOpacity(config.menu.notify?.border_opacity);
    this._statusEnabled = config.menu.status?.enabled === true;
    this._statusBorderColor = config.menu.status?.border_color ?? "";
    this._statusBorderOpacity = normalizedOpacity(config.menu.status?.border_opacity);
    this._statusItems = this._normalizeStatusItems(config.menu.status?.items);
    this._iconColor = config.menu.style?.icon_color ?? "";
    this._iconActiveColor = config.menu.style?.icon_active_color ?? "";
    this._iconBackgroundColor = config.menu.style?.icon_background_color ?? config.menu.style?.icon_circle_color ?? "";
    this._iconBackgroundActiveColor = config.menu.style?.icon_background_active_color ?? "";
    this._iconShape = config.menu.style?.icon_shape ?? "rounded-square";
    this._iconSize = iconSizeInputValue(configIconSize(config));
    this._activeTabColor = config.menu.style?.active_tab_color ?? "";
    this._inactiveTabColor = config.menu.style?.inactive_tab_color ?? "";
    this._hoverTabColor = config.menu.style?.hover_tab_color ?? "";
    this._activeTabTextColor = config.menu.style?.active_tab_text_color ?? "";
    this._inactiveTabTextColor = config.menu.style?.inactive_tab_text_color ?? "";
    this._hoverTabTextColor = config.menu.style?.hover_tab_text_color ?? "";
    this._tabBorderColor = config.menu.style?.tab_border_color ?? "";
    this._tabBorderOpacity = normalizedOpacity(config.menu.style?.tab_border_opacity);
    this._tabShadowFrameColor = config.menu.style?.tab_shadow_frame_color ?? "";
    this._cardBorderColor = config.menu.style?.card_border_color ?? "";
    this._cardBorderOpacity = normalizedOpacity(config.menu.style?.card_border_opacity);
    this._shadowFrameColor = config.menu.style?.shadow_frame_color ?? "";
    this._shadowFrameOffset = clockSizeInputValue(config.menu.style?.shadow_frame_offset ?? "4px");
    this._clockSize = clockSizeInputValue(config.menu.style?.clock_size ?? "44px");
    this._dateSize = clockSizeInputValue(config.menu.style?.date_size ?? "12px");
    this._weekdayWrapSize = clockSizeInputValue(config.menu.style?.weekday_wrap_size ?? "21px");
    this._weekendColor = config.menu.style?.weekend_color ?? "";
    this._clockColor = config.menu.style?.clock_color ?? "";
    this._analogMinuteMarkColor = config.menu.style?.analog_minute_mark_color ?? "";
    this._analogHourMarkColor = config.menu.style?.analog_hour_mark_color ?? "";
    this._analogHourHandColor = config.menu.style?.analog_hour_hand_color ?? "";
    this._analogMinuteHandColor = config.menu.style?.analog_minute_hand_color ?? "";
    this._analogSecondHandColor = config.menu.style?.analog_second_hand_color ?? "";
    this._backgroundMode = config.menu.style?.background_mode ?? "none";
    this._backgroundColor = config.menu.style?.background_color ?? "";
    this._backgroundOpacity = normalizedOpacity(config.menu.style?.background_opacity);
    this._backgroundImage = config.menu.style?.background_image ?? "";
    this._submenuBackgroundColor = config.menu.style?.submenu_background_color ?? "";
    this._submenuBackgroundOpacity = normalizedOpacity(config.menu.style?.submenu_background_opacity);
    this._hideHaChrome = config.chrome?.hide_ha_chrome === true;
    this._adminAlwaysVisible = config.chrome?.admin_always_visible !== false;
    this._visibleUsers = Array.isArray(config.chrome?.visible_users)
      ? config.chrome.visible_users.join(", ")
      : config.chrome?.visible_users ?? "";
    this._colorPresets = normalizeColorPresets(config.color_presets);
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
      const mergedPage = this._mergePageWithView(cleanPage, matchingView);
      if (!Array.isArray(cleanPage.subpages)) return mergedPage;

      return {
        ...mergedPage,
        subpages: cleanPage.subpages.map((subpage: any, subIndex: number) => {
          const cleanSubpage = pageWithoutRecursiveDashboardLayout(subpage);
          if (isMenuOnlyPage(cleanSubpage)) return cleanSubpage;
          const matchingSubView =
            viewsByPath.get(pagePath(cleanSubpage, subIndex)) ??
            viewsByTitle.get(normalizedTitle(cleanSubpage.title));
          return this._mergePageWithView(cleanSubpage, matchingSubView);
        }),
      };
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

  private _setIconSizeEvent(ev: Event) {
    ev.stopPropagation();
    this._setValue("iconSize", (ev.currentTarget as HTMLInputElement).value);
  }

  private _setValue(key: string, value: any) {
    if (key === "menuPosition") this._menuPosition = value;
    if (key === "menuTitle") this._menuTitle = value;
    if (key === "showHome") this._showHome = value;
    if (key === "iconOnly") this._iconOnly = value;
    if (key === "homeTitle") this._homeTitle = value;
    if (key === "homePath") this._homePath = value;
    if (key === "homeIcon") this._homeIcon = value;
    if (key === "homeIconColor") this._homeIconColor = value;
    if (key === "homeIconActiveColor") this._homeIconActiveColor = value;
    if (key === "homeIconBackgroundColor") this._homeIconBackgroundColor = value;
    if (key === "homeIconBackgroundActiveColor") this._homeIconBackgroundActiveColor = value;
    if (key === "homeTabColor") this._homeTabColor = value;
    if (key === "homeActiveTabColor") this._homeActiveTabColor = value;
    if (key === "homeMaxColumns") this._homeMaxColumns = value;
    if (key === "homeDenseSectionPlacement") this._homeDenseSectionPlacement = value;
    if (key === "homeTopMargin") this._homeTopMargin = value;
    if (key === "inheritTheme") this._inheritTheme = value;
    if (key === "clock") this._clock = value;
    if (key === "analogHourMarks") this._analogHourMarks = value;
    if (key === "analogMinuteMarks") this._analogMinuteMarks = value;
    if (key === "analogSeconds") this._analogSeconds = value;
    if (key === "date") this._date = value;
    if (key === "weekday") this._weekday = value;
    if (key === "holidayEntity") this._holidayEntity = value;
    if (key === "birthdayEntity") this._birthdayEntity = value;
    if (key === "christmasEntity") this._christmasEntity = value;
    if (key === "daySymbolSize") this._daySymbolSize = value;
    if (key === "notifyEnabled") this._notifyEnabled = value;
    if (key === "notifyEntity") this._notifyEntity = value;
    if (key === "notifyBorderColor") this._notifyBorderColor = value;
    if (key === "notifyBorderOpacity") this._notifyBorderOpacity = normalizedOpacity(value);
    if (key === "statusEnabled") this._statusEnabled = value;
    if (key === "statusBorderColor") this._statusBorderColor = value;
    if (key === "statusBorderOpacity") this._statusBorderOpacity = normalizedOpacity(value);
    if (key === "iconColor") this._iconColor = value;
    if (key === "iconActiveColor") this._iconActiveColor = value;
    if (key === "iconBackgroundColor") this._iconBackgroundColor = value;
    if (key === "iconBackgroundActiveColor") this._iconBackgroundActiveColor = value;
    if (key === "iconShape") this._iconShape = value;
    if (key === "iconSize") this._iconSize = iconSizeInputValue(value);
    if (key === "activeTabColor") this._activeTabColor = value;
    if (key === "inactiveTabColor") this._inactiveTabColor = value;
    if (key === "hoverTabColor") this._hoverTabColor = value;
    if (key === "activeTabTextColor") this._activeTabTextColor = value;
    if (key === "inactiveTabTextColor") this._inactiveTabTextColor = value;
    if (key === "hoverTabTextColor") this._hoverTabTextColor = value;
    if (key === "tabBorderColor") this._tabBorderColor = value;
    if (key === "tabBorderOpacity") this._tabBorderOpacity = normalizedOpacity(value);
    if (key === "tabShadowFrameColor") this._tabShadowFrameColor = value;
    if (key === "cardBorderColor") this._cardBorderColor = value;
    if (key === "cardBorderOpacity") this._cardBorderOpacity = normalizedOpacity(value);
    if (key === "shadowFrameColor") this._shadowFrameColor = value;
    if (key === "shadowFrameOffset") this._shadowFrameOffset = value;
    if (key === "clockSize") this._clockSize = value;
    if (key === "dateSize") this._dateSize = value;
    if (key === "weekdayWrapSize") this._weekdayWrapSize = value;
    if (key === "weekendColor") this._weekendColor = value;
    if (key === "clockColor") this._clockColor = value;
    if (key === "analogMinuteMarkColor") this._analogMinuteMarkColor = value;
    if (key === "analogHourMarkColor") this._analogHourMarkColor = value;
    if (key === "analogHourHandColor") this._analogHourHandColor = value;
    if (key === "analogMinuteHandColor") this._analogMinuteHandColor = value;
    if (key === "analogSecondHandColor") this._analogSecondHandColor = value;
    if (key === "backgroundMode") this._backgroundMode = value;
    if (key === "backgroundColor") this._backgroundColor = value;
    if (key === "backgroundOpacity") this._backgroundOpacity = normalizedOpacity(value);
    if (key === "backgroundImage") this._backgroundImage = value;
    if (key === "submenuBackgroundColor") this._submenuBackgroundColor = value;
    if (key === "submenuBackgroundOpacity") this._submenuBackgroundOpacity = normalizedOpacity(value);
    if (key === "hideHaChrome") this._hideHaChrome = value;
    if (key === "adminAlwaysVisible") this._adminAlwaysVisible = value;
    if (key === "visibleUsers") this._visibleUsers = value;
    if (key === "debugLanguage") {
      this._debugLanguage = normalizeDashboardLayoutV2Language(value) ?? "";
      this._language = resolveDashboardLayoutV2Language({ debugLanguage: this._debugLanguage, hass: this.hass });
    }
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
      const stateObj = this.hass?.states?.[value];
      nextItem.label = stateObj?.attributes?.friendly_name ?? (value.includes(".") ? value : "");
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

  private _activeColorPresets() {
    return normalizeColorPresets(this._colorPresets).filter((preset) => preset.value?.trim());
  }

  private _colorPresetsForSave() {
    return normalizeColorPresets(this._colorPresets)
      .map((preset) => ({
        name: preset.name?.trim() ?? "",
        value: preset.value?.trim() ?? "",
      }))
      .filter((preset) => preset.name || preset.value);
  }

  private _updateColorPreset(index: number, key: "name" | "value", value: string) {
    const presets = normalizeColorPresets(this._colorPresets);
    presets[index] = {
      ...presets[index],
      [key]: value,
    };
    this._colorPresets = presets;
  }

  private _renderColorPresetSelect(label: string, apply: (value: string) => void) {
    const presets = this._activeColorPresets();
    if (!presets.length) return nothing;
    return html`
      <select
        class="color-preset"
        title=${`${label}: choose color favorite`}
        .value=${""}
        @change=${(ev: Event) => {
          const select = ev.target as HTMLSelectElement;
          if (select.value) {
            apply(select.value);
            select.value = "";
          }
        }}
      >
        <option value="">Choose favorite</option>
        ${presets.map(
          (preset, index) => html`
            <option value=${preset.value ?? ""}>
              ${preset.name?.trim() || `Color ${index + 1}`} · ${preset.value}
            </option>
          `
        )}
      </select>
    `;
  }

  private _tooLongStatusLabels() {
    return this._normalizeStatusItems(this._statusItems)
      .map((item, index) => ({ index, label: item.label?.trim() ?? "" }))
      .filter((item) => item.label.length > STATUS_LABEL_MAX_LENGTH);
  }

  private _statusLabelError() {
    const labels = this._tooLongStatusLabels();
    if (!labels.length) return "";
    const rows = labels.map((item) => item.index + 1).join(", ");
    return `Status label in row ${rows} is too long. Please shorten it to at most ${STATUS_LABEL_MAX_LENGTH} characters.`;
  }

  private _statusEntityOptions() {
    return Object.keys(this.hass?.states ?? {}).sort((a, b) => a.localeCompare(b));
  }

  private _statusEntityMatches(query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    return this._statusEntityOptions()
      .filter((entityId) => {
        if (!normalizedQuery) return true;
        const friendlyName = this.hass?.states?.[entityId]?.attributes?.friendly_name ?? "";
        return entityId.toLowerCase().includes(normalizedQuery) || friendlyName.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 50);
  }

  private _selectStatusEntity(index: number, entityId: string) {
    this._updateStatusItem(index, "entity", entityId);
    this._statusEntitySearch = {
      ...this._statusEntitySearch,
      [index]: "",
    };
    this._openStatusEntityIndex = -1;
  }

  private _closeStatusEntityPicker(index: number) {
    window.setTimeout(() => {
      if (this._openStatusEntityIndex === index) {
        this._openStatusEntityIndex = -1;
      }
    }, 150);
  }

  private _selectNotifyEntity(entityId: string) {
    this._notifyEntity = entityId;
    this._notifyEntitySearch = "";
    this._openNotifyEntityPicker = false;
  }

  private _closeNotifyEntityPicker() {
    window.setTimeout(() => {
      this._openNotifyEntityPicker = false;
    }, 150);
  }

  private _daySymbolEntityValue(key: string) {
    if (key === "holiday") return this._holidayEntity;
    if (key === "birthday") return this._birthdayEntity;
    return this._christmasEntity;
  }

  private _defaultDaySymbolEntity(key: string) {
    if (key === "holiday") return DEFAULT_HOLIDAY_ENTITY;
    if (key === "birthday") return DEFAULT_BIRTHDAY_ENTITY;
    return DEFAULT_CHRISTMAS_ENTITY;
  }

  private _setDaySymbolEntity(key: string, value: string) {
    if (key === "holiday") this._holidayEntity = value;
    if (key === "birthday") this._birthdayEntity = value;
    if (key === "christmas") this._christmasEntity = value;
  }

  private _selectDaySymbolEntity(key: string, entityId: string) {
    this._setDaySymbolEntity(key, entityId);
    this._daySymbolEntitySearch = {
      ...this._daySymbolEntitySearch,
      [key]: "",
    };
    this._openDaySymbolEntity = "";
  }

  private _closeDaySymbolEntityPicker(key: string) {
    window.setTimeout(() => {
      if (this._openDaySymbolEntity === key) {
        this._openDaySymbolEntity = "";
      }
    }, 150);
  }

  private _renderDaySymbolEntityPicker(key: string) {
    const value = this._daySymbolEntityValue(key);
    const searchValue = this._openDaySymbolEntity === key ? this._daySymbolEntitySearch[key] ?? "" : value;
    const matches = this._statusEntityMatches(searchValue);

    return html`
      <div class="entity-picker">
        <input
          class="entity-input"
          placeholder=${this._defaultDaySymbolEntity(key)}
          .value=${searchValue}
          @focus=${() => {
            this._openDaySymbolEntity = key;
            this._daySymbolEntitySearch = {
              ...this._daySymbolEntitySearch,
              [key]: "",
            };
          }}
          @blur=${() => {
            if (this._daySymbolEntitySearch[key]?.trim()) {
              this._setDaySymbolEntity(key, this._daySymbolEntitySearch[key].trim());
            }
            this._closeDaySymbolEntityPicker(key);
          }}
          @input=${(ev: Event) => {
            this._openDaySymbolEntity = key;
            const nextValue = (ev.target as HTMLInputElement).value;
            this._daySymbolEntitySearch = {
              ...this._daySymbolEntitySearch,
              [key]: nextValue,
            };
            if (!nextValue.trim()) {
              this._setDaySymbolEntity(key, "");
            }
          }}
        />
        <span class="entity-arrow" aria-hidden="true">▾</span>
        ${this._openDaySymbolEntity === key
          ? html`
              <div class="entity-menu">
                ${matches.length
                  ? matches.map((entityId) => {
                      const stateObj = this.hass?.states?.[entityId];
                      const friendlyName = stateObj?.attributes?.friendly_name ?? entityId;
                      return html`
                        <button
                          type="button"
                          @mousedown=${(ev: MouseEvent) => ev.preventDefault()}
                          @click=${() => this._selectDaySymbolEntity(key, entityId)}
                        >
                          <span>${friendlyName}</span>
                          <small>${entityId}</small>
                        </button>
                      `;
                    })
                  : html`<p>No entity found</p>`}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _notifyEntityMissing() {
    const entityId = (this._notifyEntity || DEFAULT_NOTIFY_ENTITY).trim();
    return this._notifyEnabled && entityId && !this.hass?.states?.[entityId];
  }

  private _renderNotifyEntityPicker() {
    const value = this._notifyEntity || DEFAULT_NOTIFY_ENTITY;
    const searchValue = this._openNotifyEntityPicker ? this._notifyEntitySearch : value;
    const matches = this._statusEntityMatches(searchValue);

    return html`
      <div class="entity-picker">
        <input
          class="entity-input"
          placeholder=${DEFAULT_NOTIFY_ENTITY}
          .value=${searchValue}
          @focus=${() => {
            this._openNotifyEntityPicker = true;
            this._notifyEntitySearch = "";
          }}
          @blur=${() => {
            if (this._notifyEntitySearch.trim()) {
              this._notifyEntity = this._notifyEntitySearch.trim();
            }
            this._closeNotifyEntityPicker();
          }}
          @input=${(ev: Event) => {
            this._openNotifyEntityPicker = true;
            const nextValue = (ev.target as HTMLInputElement).value;
            this._notifyEntitySearch = nextValue;
            if (!nextValue.trim()) {
              this._notifyEntity = "";
            }
          }}
        />
        <span class="entity-arrow" aria-hidden="true">▾</span>
        ${this._openNotifyEntityPicker
          ? html`
              <div class="entity-menu">
                ${matches.length
                  ? matches.map((entityId) => {
                      const stateObj = this.hass?.states?.[entityId];
                      const friendlyName = stateObj?.attributes?.friendly_name ?? entityId;
                      return html`
                        <button
                          type="button"
                          @mousedown=${(ev: MouseEvent) => ev.preventDefault()}
                          @click=${() => this._selectNotifyEntity(entityId)}
                        >
                          <span>${friendlyName}</span>
                          <small>${entityId}</small>
                        </button>
                      `;
                    })
                  : html`<p>No entity found</p>`}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _renderStatusEntityPicker(item: { entity?: string }, index: number) {
    const value = item.entity ?? "";
    const searchValue = this._openStatusEntityIndex === index ? this._statusEntitySearch[index] ?? "" : value;
    const matches = this._statusEntityMatches(searchValue);

    return html`
      <div class="entity-picker">
        <input
          class="entity-input"
          placeholder=${`sensor.status_${index + 1}`}
          .value=${searchValue}
          @focus=${() => {
            this._openStatusEntityIndex = index;
            this._statusEntitySearch = {
              ...this._statusEntitySearch,
              [index]: "",
            };
          }}
          @blur=${() => this._closeStatusEntityPicker(index)}
          @input=${(ev: Event) => {
            this._openStatusEntityIndex = index;
            const nextValue = (ev.target as HTMLInputElement).value;
            this._statusEntitySearch = {
              ...this._statusEntitySearch,
              [index]: nextValue,
            };
          }}
        />
        <span class="entity-arrow" aria-hidden="true">▾</span>
        ${this._openStatusEntityIndex === index
          ? html`
              <div class="entity-menu">
                ${matches.length
                  ? matches.map((entityId) => {
                      const stateObj = this.hass?.states?.[entityId];
                      const friendlyName = stateObj?.attributes?.friendly_name ?? entityId;
                      return html`
                        <button
                          type="button"
                          @mousedown=${(ev: MouseEvent) => ev.preventDefault()}
                          @click=${() => this._selectStatusEntity(index, entityId)}
                        >
                          <span>${friendlyName}</span>
                          <small>${entityId}</small>
                        </button>
                      `;
                    })
                  : html`<p>No entity found</p>`}
              </div>
            `
          : nothing}
      </div>
    `;
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
      icon_color: String(source?.icon_color ?? ""),
      icon_active_color: String(source?.icon_active_color ?? ""),
      icon_background_color: String(source?.icon_background_color ?? ""),
      icon_background_active_color: String(source?.icon_background_active_color ?? ""),
      tab_color: String(source?.tab_color ?? ""),
      active_tab_color: String(source?.active_tab_color ?? ""),
    };
  }

  private _renderColorField(label: string, key: string, value: string, placeholder: string) {
    const apply = (nextValue: string) => this._setValue(key, nextValue);
    return html`
      <label>
        ${label}
        <div class=${`color-row${this._activeColorPresets().length ? " has-presets" : ""}`}>
          <input
            class="text"
            placeholder=${placeholder}
            .value=${value}
            @input=${(ev: Event) => apply((ev.target as HTMLInputElement).value)}
          />
          <input
            class="color"
            type="color"
            .value=${colorPickerValue(value)}
            title=${`Choose ${label}`}
            @input=${(ev: Event) => apply((ev.target as HTMLInputElement).value)}
          />
          ${this._renderColorPresetSelect(label, apply)}
        </div>
      </label>
    `;
  }

  private _renderPageColorField(label: string, page: any, key: string, update: (value: string) => void, placeholder = "Global") {
    const value = String(page?.[key] ?? "");
    return html`
      <label>
        ${label}
        <div class=${`color-row${this._activeColorPresets().length ? " has-presets" : ""}`}>
          <input
            class="text"
            placeholder=${placeholder}
            .value=${value}
            @input=${(ev: Event) => update((ev.target as HTMLInputElement).value)}
          />
          <input
            class="color"
            type="color"
            .value=${colorPickerValue(value)}
            title=${`Choose ${label}`}
            @input=${(ev: Event) => update((ev.target as HTMLInputElement).value)}
          />
          ${this._renderColorPresetSelect(label, update)}
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

  private _defaultPage(index: number, titlePrefix = "Unterseite") {
    const nextIndex = index + 1;
    return {
      title: `${titlePrefix} ${nextIndex}`,
      path: `${slugifyPath(titlePrefix) || "subpage"}-${nextIndex}`,
      icon: "mdi:view-dashboard",
      type: SECTIONS_LAYOUT_V2,
      layout_type: SECTIONS_LAYOUT_V2,
      max_columns: 4,
      sections: defaultSections(),
    };
  }

  private _normalizeSubPage(page: any, index: number) {
    return this._normalizePage(page, index);
  }

  private _normalizePage(page: any, index: number) {
    if (page?.type === "spacer") return { type: "spacer" };
    if (page?.type === "divider") {
      return {
        type: "divider",
        color: page.color || "#ffffff",
        shadow_frame_color: page.shadow_frame_color || "transparent",
        divider_opacity: normalizedOpacity(page.divider_opacity),
        height: normalizedDividerHeight(page.height ?? "4px"),
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
      ...(Array.isArray(cleanPage.subpages) && cleanPage.subpages.length
        ? { subpages: cleanPage.subpages.map((subpage: any, subIndex: number) => this._normalizeSubPage(subpage, subIndex)) }
        : {}),
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
          if (Array.isArray(page?.subpages)) {
            page.subpages.forEach((subpage: any) => {
              changed = addPath(subpage?.path) || changed;
            });
          }
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
          ? config.pages.flatMap((page: any) => [
              String(page?.path ?? ""),
              ...(Array.isArray(page?.subpages) ? page.subpages.map((subpage: any) => String(subpage?.path ?? "")) : []),
            ])
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

  private _resetHomeColors() {
    if (!window.confirm("Reset the home button colors to global values?")) return;
    this._homeIconColor = "";
    this._homeIconActiveColor = "";
    this._homeIconBackgroundColor = "";
    this._homeIconBackgroundActiveColor = "";
    this._homeTabColor = "";
    this._homeActiveTabColor = "";
  }

  private _resetPageColors(index: number) {
    if (!window.confirm("Reset this button colors to global values?")) return;
    this._pages = this._pages.map((page, pageIndex) => {
      if (pageIndex !== index) return page;
      const next = { ...page };
      PAGE_COLOR_KEYS.forEach((key) => delete next[key]);
      return next;
    });
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
          divider_opacity: normalizedOpacity(page.divider_opacity ?? colors.divider_opacity),
          height: normalizedDividerHeight(page.height ?? colors.height),
        };
      }
      if (!isMenuOnlyPage(page)) return page;

      const nextIndex = index + 1;
      return {
        title: `Unterseite ${nextIndex}`,
        path: `subpage-${nextIndex}`,
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
      path: `subpage-${nextIndex}`,
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
      divider_opacity: normalizedOpacity(source?.page?.divider_opacity),
      height: normalizedDividerHeight(source?.page?.height ?? "4px"),
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
            path: `${page.path ?? "subpage"}-copy`,
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

  private _selectedSubpages() {
    const page = this._pages[this._selectedPageIndex];
    return Array.isArray(page?.subpages) ? page.subpages : [];
  }

  private _setSelectedSubpages(subpages: any[]) {
    this._pages = this._pages.map((page, index) =>
      index === this._selectedPageIndex
        ? {
            ...page,
            ...(subpages.length ? { subpages } : { subpages: undefined }),
          }
        : page
    );
    this._selectedSubPageIndex = Math.min(this._selectedSubPageIndex, subpages.length - 1);
    if (this._selectedSubPageIndex < 0 && subpages.length) this._selectedSubPageIndex = 0;
    if (!subpages.length && this._activeTab === "submenu") this._activeTab = "pages";
    this._syncJsonFromPages();
  }

  private _setPageSubmenuEnabled(enabled: boolean) {
    const page = this._pages[this._selectedPageIndex];
    if (!page || isMenuOnlyPage(page)) return;
    const subpages = enabled
      ? Array.isArray(page.subpages) && page.subpages.length
        ? page.subpages
        : [this._defaultPage(0, "Subseite")]
      : [];
    this._pages = this._pages.map((entry, index) =>
      index === this._selectedPageIndex
        ? {
            ...entry,
            ...(subpages.length ? { subpages } : { subpages: undefined }),
          }
        : entry
    );
    this._selectedSubPageIndex = subpages.length ? 0 : -1;
    this._activeTab = enabled ? "submenu" : "pages";
    this._syncJsonFromPages();
  }

  private _updateSubPage(index: number, key: string, value: any) {
    const subpages = this._selectedSubpages().map((page, pageIndex) =>
      pageIndex === index ? { ...page, [key]: value } : page
    );
    this._setSelectedSubpages(subpages);
  }

  private _resetSubPageColors(index: number) {
    if (!window.confirm("Reset this subbutton colors to global values?")) return;
    this._pages = this._pages.map((page, pageIndex) => {
      if (pageIndex !== this._selectedPageIndex || !Array.isArray(page?.subpages)) return page;
      return {
        ...page,
        subpages: page.subpages.map((subpage: any, subpageIndex: number) => {
          if (subpageIndex !== index) return subpage;
          const next = { ...subpage };
          PAGE_COLOR_KEYS.forEach((key) => delete next[key]);
          return next;
        }),
      };
    });
    this._syncJsonFromPages();
  }

  private _updateSubPageLayout(index: number, value: string) {
    const subpages = this._selectedSubpages().map((page, pageIndex) => {
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
    this._setSelectedSubpages(subpages);
  }

  private _addSubPage() {
    const subpages = this._selectedSubpages();
    this._setSelectedSubpages([...subpages, this._defaultPage(subpages.length, "Subseite")]);
    this._selectedSubPageIndex = subpages.length;
  }

  private _duplicateSubPage() {
    const subpages = this._selectedSubpages();
    const page = subpages[this._selectedSubPageIndex];
    if (!page) return;
    const copy = {
      ...page,
      title: `${page.title ?? "Subseite"} Kopie`,
      path: `${page.path ?? "subseite"}-copy`,
    };
    const next = [
      ...subpages.slice(0, this._selectedSubPageIndex + 1),
      copy,
      ...subpages.slice(this._selectedSubPageIndex + 1),
    ];
    this._setSelectedSubpages(next);
    this._selectedSubPageIndex += 1;
  }

  private _deleteSubPage() {
    const subpages = this._selectedSubpages();
    if (this._selectedSubPageIndex < 0) return;
    this._setSelectedSubpages(subpages.filter((_, index) => index !== this._selectedSubPageIndex));
  }

  private _moveSubPage(direction: -1 | 1) {
    const subpages = [...this._selectedSubpages()];
    const targetIndex = this._selectedSubPageIndex + direction;
    if (targetIndex < 0 || targetIndex >= subpages.length) return;
    const [page] = subpages.splice(this._selectedSubPageIndex, 1);
    subpages.splice(targetIndex, 0, page);
    this._setSelectedSubpages(subpages);
    this._selectedSubPageIndex = targetIndex;
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
      this._error = err?.message || "Pages could not be read.";
    }
  }

  private _pagesForCurrentEditorState() {
    let pagesForSave = this._pages;
    try {
      const parsed = JSON.parse(this._pagesText || "[]");
      if (this._jsonExpanded) {
        if (!Array.isArray(parsed)) throw new Error("Pages muss eine Liste sein.");
        pagesForSave = parsed;
      }
    } catch (err: any) {
      throw new Error(err?.message || "Pages could not be read.");
    }
    return pagesForSave;
  }

  private _debugConfigForSave(view: any = {}) {
    return {
      ...(view?.debug ?? {}),
      language: this._debugLanguage,
    };
  }

  private _buildExportConfig(pagesForSave = this._pages) {
    const rawConfig = this.lovelace?.rawConfig ?? this.lovelace?.config;
    const views = rawConfig?.views;
    if (!Array.isArray(views) || !views[this.viewIndex]) {
      throw new Error("Current view could not be found.");
    }

    const normalizedPages = pagesForSave.map((page, index) => this._normalizePage(page, index));
    const homeEntry = {
      title: this._homeTitle,
      path: this._homePath,
      icon: this._homeIcon,
      ...(this._homeIconColor ? { icon_color: this._homeIconColor } : {}),
      ...(this._homeIconActiveColor ? { icon_active_color: this._homeIconActiveColor } : {}),
      ...(this._homeIconBackgroundColor ? { icon_background_color: this._homeIconBackgroundColor } : {}),
      ...(this._homeIconBackgroundActiveColor ? { icon_background_active_color: this._homeIconBackgroundActiveColor } : {}),
      ...(this._homeTabColor ? { tab_color: this._homeTabColor } : {}),
      ...(this._homeActiveTabColor ? { active_tab_color: this._homeActiveTabColor } : {}),
    };

    const dashboardLayoutV2 = {
      inherit_theme: this._inheritTheme,
      menu: {
        position: this._menuPosition,
        title: this._menuTitle,
        show_home: this._showHome,
        icon_only: this._iconOnly,
        home: homeEntry,
        clock: this._clock,
        analog_hour_marks: this._analogHourMarks,
        analog_minute_marks: this._analogMinuteMarks,
        analog_seconds: this._analogSeconds,
        date: this._date,
        weekday: this._weekday,
        day_symbol: {
          holiday_entity: (this._holidayEntity || DEFAULT_HOLIDAY_ENTITY).trim(),
          birthday_entity: (this._birthdayEntity || DEFAULT_BIRTHDAY_ENTITY).trim(),
          christmas_entity: (this._christmasEntity || DEFAULT_CHRISTMAS_ENTITY).trim(),
          size: normalizedDaySymbolSize(this._daySymbolSize),
        },
        notify: {
          enabled: this._notifyEnabled,
          entity: (this._notifyEntity || DEFAULT_NOTIFY_ENTITY).trim(),
          border_color: this._notifyBorderColor,
          border_opacity: this._notifyBorderOpacity,
        },
        status: {
          enabled: this._statusEnabled,
          border_color: this._statusBorderColor,
          border_opacity: this._statusBorderOpacity,
          items: this._statusItemsForSave(),
        },
        style: {
          icon_color: this._iconColor,
          icon_active_color: this._iconActiveColor,
          icon_background_color: this._iconBackgroundColor,
          icon_background_active_color: this._iconBackgroundActiveColor,
          icon_shape: this._iconShape,
          icon_size: normalizedIconSize(this._iconSize),
          active_tab_color: this._activeTabColor,
          inactive_tab_color: this._inactiveTabColor,
          hover_tab_color: this._hoverTabColor,
          active_tab_text_color: this._activeTabTextColor,
          inactive_tab_text_color: this._inactiveTabTextColor,
          hover_tab_text_color: this._hoverTabTextColor,
          tab_border_color: this._tabBorderColor,
          tab_border_opacity: this._tabBorderOpacity,
          tab_shadow_frame_color: this._tabShadowFrameColor,
          card_border_color: this._cardBorderColor,
          card_border_opacity: this._cardBorderOpacity,
          shadow_frame_color: this._shadowFrameColor,
          shadow_frame_offset: normalizedShadowFrameOffset(this._shadowFrameOffset),
          clock_size: normalizedClockSize(this._clockSize),
          date_size: normalizedDateSize(this._dateSize),
          weekday_wrap_size: normalizedDateSize(this._weekdayWrapSize),
          weekend_color: this._weekendColor,
          clock_color: this._clockColor,
          analog_minute_mark_color: this._analogMinuteMarkColor,
          analog_hour_mark_color: this._analogHourMarkColor,
          analog_hour_hand_color: this._analogHourHandColor,
          analog_minute_hand_color: this._analogMinuteHandColor,
          analog_second_hand_color: this._analogSecondHandColor,
          background_mode: this._backgroundMode,
          background_color: this._backgroundColor,
          background_opacity: this._backgroundOpacity,
          background_image: this._backgroundImage,
          submenu_background_color: this._submenuBackgroundColor,
          submenu_background_opacity: this._submenuBackgroundOpacity,
        },
      },
      chrome: {
        hide_ha_chrome: this._hideHaChrome,
        admin_always_visible: this._adminAlwaysVisible,
        visible_users: this._visibleUsers,
      },
      color_presets: this._colorPresetsForSave(),
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
    const applyHomeSectionsOptions = (view: any, isHomeView: boolean) => {
      if (!isHomeView || pageLayoutType(view) !== SECTIONS_LAYOUT_V2) return view;
      return {
        ...view,
        max_columns: this._homeMaxColumns,
        dense_section_placement: this._homeDenseSectionPlacement,
        top_margin: this._homeTopMargin,
      };
    };
    const relatedPaths = this._collectRelatedDashboardLayoutV2Paths(views, currentPath, dashboardLayoutV2);
    normalizedPages.forEach((page, index) => {
      if (!isMenuOnlyPage(page)) relatedPaths.add(String(page.path));
      const sourcePath = this._pageSourcePaths[index];
      if (sourcePath) relatedPaths.add(sourcePath);
    });
    const normalizedPageEntries = normalizedPages.flatMap((page, pageIndex) => {
      const entries = [{ page, pageIndex, sourcePath: this._pageSourcePaths[pageIndex] }];
      if (Array.isArray(page.subpages)) {
        page.subpages.forEach((subpage: any) => {
          entries.push({ page: subpage, pageIndex, sourcePath: undefined });
          if (!isMenuOnlyPage(subpage)) relatedPaths.add(String(subpage.path));
        });
      }
      return entries;
    });
    const nextViews = views.map((view, index) => {
      const viewPath = String(view.path ?? index);
      const isHomeView = viewPath === currentPath || viewPath === homePath || (index === this.viewIndex && !view.subview);
      const isRelatedDashboardLayoutV2View =
        relatedPaths.has(viewPath) && isDashboardLayoutV2View(view);
      if (!isRelatedDashboardLayoutV2View) return view;
      const nextDashboardLayoutV2 =
        isHomeView
          ? dashboardLayoutV2
          : dashboardLayoutV2Reference(homePath);
      const nextView = {
        ...view,
        ...(isHomeView
          ? {
              title: homeEntry.title,
              path: homePath,
              icon: homeEntry.icon,
            }
          : {}),
        ...stableViewEditorChrome(view),
        ...(isHomeView ? { debug: this._debugConfigForSave(view) } : {}),
        layout: {
          ...(layoutWithoutDashboardLayoutV2(view.layout) ?? {}),
          dashboard_layout_v2: nextDashboardLayoutV2,
        },
      };
      return applyHomeSectionsOptions(applyInheritedTheme(nextView, isHomeView ? homePath : viewPath), isHomeView);
    });

    for (const { page, sourcePath } of normalizedPageEntries) {
      if (isMenuOnlyPage(page)) continue;

      const pagePath = String(page.path);
      const existing = sourcePath
        ? existingViewsByPath.get(sourcePath) ?? existingViewsByPath.get(pagePath)
        : existingViewsByPath.get(pagePath);
      const isCurrentView = (sourcePath ?? pagePath) === currentPath;
      const pageLayout = {
        ...(layoutWithoutDashboardLayoutV2(existing?.view.layout ?? page.layout) ?? {}),
        dashboard_layout_v2: dashboardLayoutV2Reference(homePath),
      };
      const type = pageLayoutType(page);
      const sections = pageSectionsForSave(page, existing?.view);
      const cards = pageCardsForSave(page, existing?.view);

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

    return {
      ...rawConfig,
      views: nextViews,
    };
  }

  private async _save() {
    let nextConfig;
    try {
      nextConfig = this._buildExportConfig(this._pagesForCurrentEditorState());
    } catch (err: any) {
      this._error = err?.message || "Dashboard could not be prepared.";
      return;
    }

    await this.lovelace.saveConfig(nextConfig);
    this._close();
  }

  private async _saveColorPresets() {
    const rawConfig = this.lovelace?.rawConfig ?? this.lovelace?.config;
    const views = rawConfig?.views;
    if (!Array.isArray(views) || !views[this.viewIndex]) {
      this._error = "Colors could not be saved: current view not found.";
      return;
    }

    const currentView = views[this.viewIndex];
    const currentLayoutConfig = currentView?.layout?.dashboard_layout_v2 ?? currentView?.dashboard_layout_v2;
    const targetPath = currentLayoutConfig?.inherits_from ?? this._homePath ?? currentView?.path ?? this.viewIndex;
    const targetIndex = views.findIndex((view: any, index: number) => String(view?.path ?? index) === String(targetPath));
    const saveIndex = targetIndex >= 0 ? targetIndex : this.viewIndex;
    const targetView = views[saveIndex];
    const existingDashboardLayoutV2 =
      targetView?.layout?.dashboard_layout_v2 ??
      targetView?.dashboard_layout_v2 ??
      currentLayoutConfig ??
      {};
    const nextDashboardLayoutV2 = {
      ...existingDashboardLayoutV2,
      color_presets: this._colorPresetsForSave(),
    };
    const nextViews = views.map((view: any, index: number) => {
      if (index !== saveIndex) return view;
      return {
        ...view,
        layout: {
          ...(view.layout ?? {}),
          dashboard_layout_v2: nextDashboardLayoutV2,
        },
      };
    });

    await this.lovelace.saveConfig({
      ...rawConfig,
      views: nextViews,
    });
    this._error = "Colors saved.";
  }

  private _exportDashboardYaml() {
    try {
      const exportConfig = this._buildExportConfig(this._pagesForCurrentEditorState());
      const now = new Date();
      const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
      ].join("-");
      const homePath = slugifyPath(this._homePath || "dashboard") || "dashboard";
      const filename = `dashboard-layout-v2-${homePath}-backup-${stamp}.yaml`;
      downloadTextFile(filename, yamlDump(exportConfig), "application/x-yaml;charset=utf-8");
      this._error = "";
    } catch (err: any) {
      this._error = err?.message || "Dashboard YAML could not be exported.";
    }
  }

  private _selectTab(tab: DashboardLayoutDialogTab) {
    this._activeTab = tab;
  }

  private _toggleDialogWidth() {
    this._wideDialog = !this._wideDialog;
  }

  private _tr(value: string) {
    return dashboardLayoutV2Translate(this._language, value);
  }

  updated() {
    translateDashboardLayoutV2Dom(this.shadowRoot, this._language);
  }

  private _renderTabButton(tab: DashboardLayoutDialogTab, label: string) {
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

  render() {
    if (!this.viewConfig) return nothing;
    const selectedPage = this._pages[this._selectedPageIndex];
    const selectedPageLayout = selectedPage ? pageLayoutType(selectedPage) : "";
    const selectedPageItemType = selectedPage ? pageItemType(selectedPage) : "page";
    const selectedSubpages = Array.isArray(selectedPage?.subpages) ? selectedPage.subpages : [];
    const selectedSubPage = selectedSubpages[this._selectedSubPageIndex];
    const selectedSubPageLayout = selectedSubPage ? pageLayoutType(selectedSubPage) : "";
    const statusLabelError = this._statusLabelError();

    return keyed(this._language, html`
      <div class="scrim" @click=${this._close}></div>
      <section class=${`dialog${this._wideDialog ? " wide-dialog" : ""}`} role="dialog" aria-modal="true">
        <header @dblclick=${this._toggleDialogWidth} title="Double-click: toggle dialog width">
          <h2>Dashboard Layout V2</h2>
          <button class="icon" @click=${this._close} title="Close">×</button>
        </header>

        <nav class="settings-tabs" role="tablist" aria-label="Dashboard Layout V2 settings">
          ${this._renderTabButton("menu", "Menu")}
          ${this._renderTabButton("display", "Display")}
          ${this._renderTabButton("pages", "Pages")}
          ${selectedSubpages.length ? this._renderTabButton("submenu", "Submenu") : nothing}
          ${this._renderTabButton("messages", "Messages")}
          ${this._renderTabButton("style", "Styles Global")}
          ${this._renderTabButton("colors", "Colors")}
          ${this._renderTabButton("backup", "Backup")}
          ${this._renderTabButton("advanced", "Advanced")}
        </nav>

        <div class="content" data-active-tab=${this._activeTab}>
          <details class="wide collapsible-group settings-panel" data-tab="menu" open>
            <summary>Menu</summary>
            <div class="section-grid">
              <label>
                Menu position
                <select
                  .value=${this._menuPosition}
                  @change=${(ev: Event) => this._setValue("menuPosition", (ev.target as HTMLSelectElement).value)}
                >
                  <option value="left">Left</option>
                  <option value="none">None</option>
                  <option value="right">Right</option>
                </select>
              </label>

              <label>
                Menu title
                <input
                  .value=${this._menuTitle}
                  @input=${(ev: Event) => this._setValue("menuTitle", (ev.target as HTMLInputElement).value)}
                />
              </label>

              <label class="check">
                <input
                  type="checkbox"
                  .checked=${this._iconOnly}
                  @change=${(ev: Event) => this._setValue("iconOnly", (ev.target as HTMLInputElement).checked)}
                />
                Show only icons in the menu
              </label>
            </div>
          </details>

          <details class="wide collapsible-group settings-panel" data-tab="menu" open>
            <summary>Home page</summary>
            <div class="section-grid">
              <label class="check">
                <input
                  type="checkbox"
                  .checked=${this._showHome}
                  @change=${(ev: Event) => this._setValue("showHome", (ev.target as HTMLInputElement).checked)}
                />
                Show home page as first menu item
              </label>

              <fieldset class="home-entry group wide">
                <legend>Home pagefeld</legend>
                <label>
                  Title
                  <input
                    .value=${this._homeTitle}
                    @input=${(ev: Event) => this._setValue("homeTitle", (ev.target as HTMLInputElement).value)}
                  />
                </label>
                <label>
                  Path
                  <input
                    .value=${this._homePath}
                    @input=${(ev: Event) => this._setValue("homePath", (ev.target as HTMLInputElement).value)}
                  />
                </label>
                <label>
                  Icon
                  <input
                    .value=${this._homeIcon}
                    @input=${(ev: Event) => this._setValue("homeIcon", (ev.target as HTMLInputElement).value)}
                  />
                </label>
                ${this._renderColorField("Icon color", "homeIconColor", this._homeIconColor, "Global")}
                ${this._renderColorField("Active icon color", "homeIconActiveColor", this._homeIconActiveColor, "Global")}
                ${this._renderColorField("Icon background", "homeIconBackgroundColor", this._homeIconBackgroundColor, "Global")}
                ${this._renderColorField(
                  "Icon background aktiv",
                  "homeIconBackgroundActiveColor",
                  this._homeIconBackgroundActiveColor,
                  "Global"
                )}
                ${this._renderColorField("Button color", "homeTabColor", this._homeTabColor, "Global")}
                ${this._renderColorField("Active button color", "homeActiveTabColor", this._homeActiveTabColor, "Global")}
                <div class="wide-style color-reset-row">
                  <button type="button" @click=${this._resetHomeColors}>Use global colors</button>
                </div>
              </fieldset>

              <fieldset class="home-entry group wide">
                <legend>Sections view</legend>
                <label>
                  Maximum number of sections in width
                  <input
                    type="number"
                    min="1"
                    max="10"
                    .value=${String(this._homeMaxColumns)}
                    @input=${(ev: Event) =>
                      this._setValue("homeMaxColumns", Number((ev.target as HTMLInputElement).value))}
                  />
                </label>
                <label class="check">
                  <input
                    type="checkbox"
                    .checked=${this._homeDenseSectionPlacement}
                    @change=${(ev: Event) =>
                      this._setValue("homeDenseSectionPlacement", (ev.target as HTMLInputElement).checked)}
                  />
                  Dense section placement
                </label>
                <label class="check">
                  <input
                    type="checkbox"
                    .checked=${this._homeTopMargin}
                    @change=${(ev: Event) => this._setValue("homeTopMargin", (ev.target as HTMLInputElement).checked)}
                  />
                  Add extra top spacing
                </label>
              </fieldset>

              <label class="check">
                <input
                  type="checkbox"
                  .checked=${this._inheritTheme}
                  @change=${(ev: Event) => this._setValue("inheritTheme", (ev.target as HTMLInputElement).checked)}
                />
                Inherit theme from home view
              </label>
            </div>
          </details>

          <details class="wide collapsible-group settings-panel" data-tab="display" open>
            <summary>Clock</summary>
            <div class="section-grid">
              <label>
                Clock
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
                <legend>Display selection</legend>
                ${this._clock === "analog"
                  ? html`
                    <label class="check compact-check">
                      <input
                        type="checkbox"
                        .checked=${this._analogHourMarks}
                        @change=${(ev: Event) =>
                          this._setValue("analogHourMarks", (ev.target as HTMLInputElement).checked)}
                      />
                      Hours
                    </label>
                    <label class="check compact-check">
                      <input
                        type="checkbox"
                        .checked=${this._analogMinuteMarks}
                        @change=${(ev: Event) =>
                          this._setValue("analogMinuteMarks", (ev.target as HTMLInputElement).checked)}
                      />
                      Minutes
                    </label>
                    <label class="check compact-check">
                      <input
                        type="checkbox"
                        .checked=${this._analogSeconds}
                        @change=${(ev: Event) =>
                          this._setValue("analogSeconds", (ev.target as HTMLInputElement).checked)}
                      />
                      Seconds hand
                    </label>
                  `
                  : nothing}

                <label class="check compact-check">
                  <input
                    type="checkbox"
                    .checked=${this._date}
                    @change=${(ev: Event) => this._setValue("date", (ev.target as HTMLInputElement).checked)}
                  />
                  Date
                </label>
              </fieldset>

              <fieldset class="weekday-options group wide">
                <legend>Weekday</legend>
                <label class="check">
                  <input
                    type="radio"
                    name="dashboard-layout-v2-weekday"
                    value="none"
                    .checked=${this._weekday === "none"}
                    @change=${() => this._setValue("weekday", "none")}
                  />
                  None
                </label>
                <label class="check">
                  <input
                    type="radio"
                    name="dashboard-layout-v2-weekday"
                    value="short"
                    .checked=${this._weekday === "short"}
                    @change=${() => this._setValue("weekday", "short")}
                  />
                  Short label
                </label>
                <label class="check">
                  <input
                    type="radio"
                    name="dashboard-layout-v2-weekday"
                    value="long"
                    .checked=${this._weekday === "long"}
                    @change=${() => this._setValue("weekday", "long")}
                  />
                  Long label
                </label>
                ${this._renderColorField("Sat / Sun color", "weekendColor", this._weekendColor, "Default")}
              </fieldset>
              ${this._renderColorField("Clock/ring color", "clockColor", this._clockColor, "Default")}
              ${this._renderColorField("Minute mark color", "analogMinuteMarkColor", this._analogMinuteMarkColor, "Default")}
              ${this._renderColorField("Hour mark color", "analogHourMarkColor", this._analogHourMarkColor, "Default")}
              ${this._renderColorField("Hour hand color", "analogHourHandColor", this._analogHourHandColor, "Default")}
              ${this._renderColorField("Minute hand color", "analogMinuteHandColor", this._analogMinuteHandColor, "Default")}
              ${this._renderColorField("Second hand color", "analogSecondHandColor", this._analogSecondHandColor, "Default")}
              <fieldset class="day-symbol-options group wide">
                <legend>Day symbol</legend>
                <label>
                  Holiday helper
                  ${this._renderDaySymbolEntityPicker("holiday")}
                </label>
                <label>
                  Birthday helper
                  ${this._renderDaySymbolEntityPicker("birthday")}
                </label>
                <label>
                  Christmas/Advent helper
                  ${this._renderDaySymbolEntityPicker("christmas")}
                </label>
                <label class="wide-style">
                  Symbol size
                  <div class="range-row">
                    <input
                      type="range"
                      min="24"
                      max="64"
                      step="1"
                      .value=${this._daySymbolSize}
                      @input=${(ev: Event) => this._setValue("daySymbolSize", (ev.target as HTMLInputElement).value)}
                    />
                    <span>${normalizedDaySymbolSize(this._daySymbolSize)}</span>
                  </div>
                </label>
                <p class="hint">
                  Priority: birthday before Christmas/Advent before holiday. Empty or inactive helpers show no symbol.
                </p>
              </fieldset>
            </div>
          </details>

          <details class="wide collapsible-group settings-panel" data-tab="advanced" open>
            <summary>HA Setting</summary>
            <div class="section-grid">
              <label class="check">
                <input
                  type="checkbox"
                  .checked=${this._hideHaChrome}
                  @change=${(ev: Event) => this._setValue("hideHaChrome", (ev.target as HTMLInputElement).checked)}
                />
                Hide HA sidebar and HA header for users that are not allowed
              </label>
              <label class="check">
                <input
                  type="checkbox"
                  .checked=${this._adminAlwaysVisible}
                  @change=${(ev: Event) => this._setValue("adminAlwaysVisible", (ev.target as HTMLInputElement).checked)}
                />
                Keep admin always visible
              </label>
              <label class="wide">
                Visible users
                <input
                  placeholder="Name or user ID, separated by comma"
                  .value=${this._visibleUsers}
                  @input=${(ev: Event) => this._setValue("visibleUsers", (ev.target as HTMLInputElement).value)}
                />
              </label>
              <p class="hint">
                An empty list hides the HA interface for all non-admins once the option is active.
              </p>
            </div>
          </details>

          <details class="wide collapsible-group settings-panel" data-tab="pages" open>
            <summary>Tabs / Subpages</summary>
            <div class="page-editor">
              <div class="page-list">
                ${this._pages.map(
                  (page, index) => html`
                    <button
                      class=${index === this._selectedPageIndex ? "selected" : ""}
                      @click=${() => { this._selectedPageIndex = index; this._selectedSubPageIndex = 0; }}
                    >
                      <span>
                        ${page.type === "spacer"
                          ? "Spacer"
                          : page.type === "divider"
                            ? "Divider"
                            : pageTitle(page, index)}
                      </span>
                      ${page.type === "divider"
                        ? nothing
                        : html`<small>${page.type === "spacer" ? "empty" : page.path ?? ""}</small>`}
                    </button>
                  `
                )}
              </div>

              <div class="page-form">
                ${selectedPage
                  ? html`
                      <label>
                        Type
                        <select
                          .value=${selectedPageItemType}
                          @change=${(ev: Event) =>
                            this._updatePageItemType(this._selectedPageIndex, (ev.target as HTMLSelectElement).value)}
                        >
                          <option value="page" ?selected=${selectedPageItemType === "page"}>Page</option>
                          <option value="spacer" ?selected=${selectedPageItemType === "spacer"}>Spacer</option>
                          <option value="divider" ?selected=${selectedPageItemType === "divider"}>Divider</option>
                        </select>
                      </label>
                      ${selectedPageItemType === "divider"
                        ? html`
                            <label class="divider-color-field">
                              Dividerfarbe
                              <div class=${`color-row${this._activeColorPresets().length ? " has-presets" : ""}`}>
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
                                  title="Dividerfarbe choose"
                                  @input=${(ev: Event) =>
                                    this._updatePage(this._selectedPageIndex, "color", (ev.target as HTMLInputElement).value)}
                                />
                                ${this._renderColorPresetSelect("Dividerfarbe", (value) =>
                                  this._updatePage(this._selectedPageIndex, "color", value)
                                )}
                              </div>
                            </label>
                            <label class="divider-color-field">
                              Divider 3D effect
                              <div class=${`color-row${this._activeColorPresets().length ? " has-presets" : ""}`}>
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
                                  title="Divider 3D effect choose"
                                  @input=${(ev: Event) =>
                                    this._updatePage(
                                      this._selectedPageIndex,
                                      "shadow_frame_color",
                                      (ev.target as HTMLInputElement).value
                                    )}
                                />
                                ${this._renderColorPresetSelect("Divider 3D effect", (value) =>
                                  this._updatePage(this._selectedPageIndex, "shadow_frame_color", value)
                                )}
                              </div>
                            </label>
                            <label class="wide-style">
                              Divider Opacity
                              <div class="range-row">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="1"
                                  .value=${String(normalizedOpacity(selectedPage.divider_opacity))}
                                  @input=${(ev: Event) =>
                                    this._updatePage(
                                      this._selectedPageIndex,
                                      "divider_opacity",
                                      normalizedOpacity((ev.target as HTMLInputElement).value)
                                    )}
                                />
                                <span>${normalizedOpacity(selectedPage.divider_opacity)}%</span>
                              </div>
                            </label>
                            <label class="wide-style">
                              Divider height
                              <div class="range-row">
                                <input
                                  type="range"
                                  min="1"
                                  max="4"
                                  step="1"
                                  .value=${clockSizeInputValue(selectedPage.height ?? "4px")}
                                  @input=${(ev: Event) =>
                                    this._updatePage(
                                      this._selectedPageIndex,
                                      "height",
                                      normalizedDividerHeight(`${(ev.target as HTMLInputElement).value}px`)
                                    )}
                                />
                                <span>${normalizedDividerHeight(selectedPage.height ?? "4px")}</span>
                              </div>
                            </label>
                          `
                        : nothing}
                      ${selectedPageItemType === "page"
                        ? html`
                      <label>
                        Title
                        <input
                          .value=${selectedPage.title ?? ""}
                          @input=${(ev: Event) =>
                            this._updatePage(this._selectedPageIndex, "title", (ev.target as HTMLInputElement).value)}
                        />
                      </label>
                      <label>
                        Path
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
                      ${this._renderPageColorField("Icon color", selectedPage, "icon_color", (value) =>
                        this._updatePage(this._selectedPageIndex, "icon_color", value)
                      )}
                      ${this._renderPageColorField("Active icon color", selectedPage, "icon_active_color", (value) =>
                        this._updatePage(this._selectedPageIndex, "icon_active_color", value)
                      )}
                      ${this._renderPageColorField("Icon background", selectedPage, "icon_background_color", (value) =>
                        this._updatePage(this._selectedPageIndex, "icon_background_color", value)
                      )}
                      ${this._renderPageColorField("Icon background aktiv", selectedPage, "icon_background_active_color", (value) =>
                        this._updatePage(this._selectedPageIndex, "icon_background_active_color", value)
                      )}
                      ${this._renderPageColorField("Button color", selectedPage, "tab_color", (value) =>
                        this._updatePage(this._selectedPageIndex, "tab_color", value)
                      )}
                      ${this._renderPageColorField("Active button color", selectedPage, "active_tab_color", (value) =>
                        this._updatePage(this._selectedPageIndex, "active_tab_color", value)
                      )}
                      <div class="wide-style color-reset-row">
                        <button type="button" @click=${() => this._resetPageColors(this._selectedPageIndex)}>
                          Use global colors
                        </button>
                      </div>
                      <label>
                        Layout
                        <select
                          .value=${pageLayoutType(selectedPage)}
                          @change=${(ev: Event) =>
                            this._updatePageLayout(this._selectedPageIndex, (ev.target as HTMLSelectElement).value)}
                        >
                          <option value=${SECTIONS_LAYOUT_V2} ?selected=${selectedPageLayout === SECTIONS_LAYOUT_V2}>
                            Sections V2
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
                              Max. columns
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
                      <label class="check">
                        <input
                          type="checkbox"
                          .checked=${selectedSubpages.length > 0}
                          @change=${(ev: Event) => this._setPageSubmenuEnabled((ev.target as HTMLInputElement).checked)}
                        />
                        Hat Submenu
                      </label>
                      ${selectedSubpages.length
                        ? html`
                            <label class="check">
                              <input
                                type="checkbox"
                                .checked=${selectedPage.hide_submenu_parent === true}
                                @change=${(ev: Event) =>
                                  this._updatePage(
                                    this._selectedPageIndex,
                                    "hide_submenu_parent",
                                    (ev.target as HTMLInputElement).checked
                                  )}
                              />
                              Do not show home page as first subbutton
                            </label>
                          `
                        : nothing}
                      ${selectedSubpages.length
                        ? html`<button type="button" @click=${() => this._selectTab("submenu")}>Edit submenu</button>`
                        : nothing}
                        `
                        : nothing}
                    `
                  : html`<p class="empty">Noch keine Unterseite angelegt.</p>`}
              </div>
            </div>

            <div class="actions">
              <button @click=${this._addPage}>Add</button>
              <button @click=${this._addSpacer}>Spacer</button>
              <button @click=${this._addDivider}>Divider</button>
              <button @click=${this._duplicatePage} ?disabled=${!selectedPage}>Duplicate</button>
              <button @click=${() => this._movePage(-1)} ?disabled=${this._selectedPageIndex <= 0}>Up</button>
              <button @click=${() => this._movePage(1)} ?disabled=${this._selectedPageIndex >= this._pages.length - 1}>Down</button>
              <button class="danger" @click=${this._deletePage} ?disabled=${!selectedPage}>Delete</button>
            </div>
          </details>

          <details class="wide collapsible-group settings-panel" data-tab="submenu" open>
            <summary>Submenu</summary>
            ${selectedPage && selectedSubpages.length
              ? html`
                  <p class="hint">Subbuttons inherit colors and style from the selected main button.</p>
                  <div class="page-editor">
                    <div class="page-list">
                      ${selectedSubpages.map(
                        (page, index) => html`
                          <button
                            class=${index === this._selectedSubPageIndex ? "selected" : ""}
                            @click=${() => (this._selectedSubPageIndex = index)}
                          >
                            <span>${pageTitle(page, index)}</span>
                            <small>${page.path ?? ""}</small>
                          </button>
                        `
                      )}
                    </div>

                    <div class="page-form">
                      ${selectedSubPage
                        ? html`
                            <label>
                              Title
                              <input
                                .value=${selectedSubPage.title ?? ""}
                                @input=${(ev: Event) =>
                                  this._updateSubPage(this._selectedSubPageIndex, "title", (ev.target as HTMLInputElement).value)}
                              />
                            </label>
                            <label>
                              Path
                              <input
                                .value=${selectedSubPage.path ?? ""}
                                @input=${(ev: Event) =>
                                  this._updateSubPage(this._selectedSubPageIndex, "path", (ev.target as HTMLInputElement).value)}
                              />
                            </label>
                            <label>
                              Icon
                              <input
                                .value=${selectedSubPage.icon ?? ""}
                                @input=${(ev: Event) =>
                                  this._updateSubPage(this._selectedSubPageIndex, "icon", (ev.target as HTMLInputElement).value)}
                              />
                            </label>
                            ${this._renderPageColorField("Icon color", selectedSubPage, "icon_color", (value) =>
                              this._updateSubPage(this._selectedSubPageIndex, "icon_color", value)
                            )}
                            ${this._renderPageColorField("Active icon color", selectedSubPage, "icon_active_color", (value) =>
                              this._updateSubPage(this._selectedSubPageIndex, "icon_active_color", value)
                            )}
                            ${this._renderPageColorField("Icon background", selectedSubPage, "icon_background_color", (value) =>
                              this._updateSubPage(this._selectedSubPageIndex, "icon_background_color", value)
                            )}
                            ${this._renderPageColorField("Icon background aktiv", selectedSubPage, "icon_background_active_color", (value) =>
                              this._updateSubPage(this._selectedSubPageIndex, "icon_background_active_color", value)
                            )}
                            ${this._renderPageColorField("Button color", selectedSubPage, "tab_color", (value) =>
                              this._updateSubPage(this._selectedSubPageIndex, "tab_color", value)
                            )}
                            ${this._renderPageColorField("Active button color", selectedSubPage, "active_tab_color", (value) =>
                              this._updateSubPage(this._selectedSubPageIndex, "active_tab_color", value)
                            )}
                            <div class="wide-style color-reset-row">
                              <button type="button" @click=${() => this._resetSubPageColors(this._selectedSubPageIndex)}>
                                Use global colors
                              </button>
                            </div>
                            <label>
                              Layout
                              <select
                                .value=${pageLayoutType(selectedSubPage)}
                                @change=${(ev: Event) =>
                                  this._updateSubPageLayout(this._selectedSubPageIndex, (ev.target as HTMLSelectElement).value)}
                              >
                                <option value=${SECTIONS_LAYOUT_V2} ?selected=${selectedSubPageLayout === SECTIONS_LAYOUT_V2}>
                                  Sections V2
                                </option>
                                <option value="custom:masonry-layout-v2" ?selected=${selectedSubPageLayout === "custom:masonry-layout-v2"}>
                                  Masonry V2
                                </option>
                                <option value="custom:horizontal-layout-v2" ?selected=${selectedSubPageLayout === "custom:horizontal-layout-v2"}>
                                  Horizontal V2
                                </option>
                                <option value="custom:vertical-layout-v2" ?selected=${selectedSubPageLayout === "custom:vertical-layout-v2"}>
                                  Vertical V2
                                </option>
                                <option value="custom:grid-layout-v2" ?selected=${selectedSubPageLayout === "custom:grid-layout-v2"}>
                                  Grid V2
                                </option>
                              </select>
                            </label>
                            ${isSectionsPage(selectedSubPage)
                              ? html`
                                  <label>
                                    Max. columns
                                    <input
                                      type="number"
                                      min="1"
                                      max="10"
                                      .value=${String(selectedSubPage.max_columns ?? 4)}
                                      @input=${(ev: Event) =>
                                        this._updateSubPage(
                                          this._selectedSubPageIndex,
                                          "max_columns",
                                          Number((ev.target as HTMLInputElement).value)
                                        )}
                                    />
                                  </label>
                                `
                              : nothing}
                          `
                        : html`<p class="empty">Noch kein Subbutton angelegt.</p>`}
                    </div>
                  </div>

                  <div class="actions">
                    <button @click=${this._addSubPage}>Add</button>
                    <button @click=${this._duplicateSubPage} ?disabled=${!selectedSubPage}>Duplicate</button>
                    <button @click=${() => this._moveSubPage(-1)} ?disabled=${this._selectedSubPageIndex <= 0}>Up</button>
                    <button
                      @click=${() => this._moveSubPage(1)}
                      ?disabled=${this._selectedSubPageIndex >= selectedSubpages.length - 1}
                    >
                      Down
                    </button>
                    <button class="danger" @click=${this._deleteSubPage} ?disabled=${!selectedSubPage}>Delete</button>
                  </div>
                `
              : html`<p class="empty">Enable “Has submenu” on a page to create subbuttons.</p>`}
          </details>

          <details class="wide collapsible-group settings-panel" data-tab="messages" open>
            <summary>Notification</summary>
            <div class="notify-editor">
              <label class="check">
                <input
                  type="checkbox"
                  .checked=${this._notifyEnabled}
                  @change=${(ev: Event) => this._setValue("notifyEnabled", (ev.target as HTMLInputElement).checked)}
                />
                Show notification
              </label>
              ${this._notifyEnabled
                ? html`
                    <label>
                      Entity
                      ${this._renderNotifyEntityPicker()}
                    </label>
                    ${this._renderColorField(
                      "Border color",
                      "notifyBorderColor",
                      this._notifyBorderColor,
                      "empty = red"
                    )}
                    <label class="wide-style">
                      Border opacity
                      <div class="range-row">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          .value=${String(this._notifyBorderOpacity)}
                          @input=${(ev: Event) =>
                            this._setValue("notifyBorderOpacity", (ev.target as HTMLInputElement).value)}
                        />
                        <span>${this._notifyBorderOpacity}%</span>
                      </div>
                    </label>
                    ${this._notifyEntityMissing()
                      ? html`
                          <div class="helper-hint">
                            <strong>Helper not found</strong>
                            <p>
                              Create a text helper in Home Assistant with the entity
                              <code>${this._notifyEntity || DEFAULT_NOTIFY_ENTITY}</code>.
                            </p>
                            <p>
                              Path: Settings &gt; Devices &amp; services &gt; Helpers &gt; Create helper &gt; Text.
                              If the text stays empty, the notification is hidden.
                            </p>
                          </div>
                        `
                      : html`
                          <p class="hint">
                            The box only appears when the entity contains text. Empty, unknown and unavailable
                            are hidden.
                          </p>
                        `}
                  `
                : nothing}
            </div>
          </details>

          <details class="wide collapsible-group settings-panel" data-tab="messages" open>
            <summary>Status values</summary>
            <div class="status-editor">
              <label class="check">
                <input
                  type="checkbox"
                  .checked=${this._statusEnabled}
                  @change=${(ev: Event) => this._setValue("statusEnabled", (ev.target as HTMLInputElement).checked)}
                />
                Show status values
              </label>
              ${this._statusEnabled
                ? html`
                    ${this._renderColorField(
                      "Border color",
                      "statusBorderColor",
                      this._statusBorderColor,
                      "empty = tab border, otherwise #ffffff"
                    )}
                    <label class="wide-style">
                      Border opacity
                      <div class="range-row">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          .value=${String(this._statusBorderOpacity)}
                          @input=${(ev: Event) =>
                            this._setValue("statusBorderOpacity", (ev.target as HTMLInputElement).value)}
                        />
                        <span>${this._statusBorderOpacity}%</span>
                      </div>
                    </label>
                    <div class="status-items">
                      <span>Entity</span>
                      <span>Label</span>
                      <span>Einheit</span>
                      ${this._normalizeStatusItems(this._statusItems).map(
                        (item, index) => html`
                          ${this._renderStatusEntityPicker(item, index)}
                          <input
                            class=${(item.label ?? "").length > STATUS_LABEL_MAX_LENGTH ? "invalid" : ""}
                            placeholder="Optional"
                            .value=${item.label ?? ""}
                            maxlength=${String(STATUS_LABEL_MAX_LENGTH + 20)}
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
                    ${statusLabelError ? html`<p class="error">${statusLabelError}</p>` : nothing}
                  `
                : nothing}
            </div>
          </details>

          <details class="wide collapsible-group settings-panel" data-tab="style" open>
            <summary>Styles Global</summary>
            <div class="style-grid">
              <label>
                Clock size
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
                Date size
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
                      Line break from
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
              ${this._renderColorField("Active tab", "activeTabColor", this._activeTabColor, "var(--primary-color)")}
              ${this._renderColorField("Active text", "activeTabTextColor", this._activeTabTextColor, "var(--text-primary-color)")}
              ${this._renderColorField("Inactive tab", "inactiveTabColor", this._inactiveTabColor, "transparent")}
              ${this._renderColorField("Inactive text", "inactiveTabTextColor", this._inactiveTabTextColor, "var(--primary-text-color)")}
              ${this._renderColorField("Hover color", "hoverTabColor", this._hoverTabColor, "var(--secondary-background-color)")}
              ${this._renderColorField("Hover Text", "hoverTabTextColor", this._hoverTabTextColor, "var(--primary-text-color)")}
              ${this._renderColorField("Tab border", "tabBorderColor", this._tabBorderColor, "transparent")}
              <label class="wide-style">
                Menu-Border opacity
                <div class="range-row">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    .value=${String(this._tabBorderOpacity)}
                    @input=${(ev: Event) => this._setValue("tabBorderOpacity", (ev.target as HTMLInputElement).value)}
                  />
                  <span>${this._tabBorderOpacity}%</span>
                </div>
              </label>
              ${this._renderColorField("Tab 3D effect", "tabShadowFrameColor", this._tabShadowFrameColor, "transparent")}
              ${this._renderColorField("Card border", "cardBorderColor", this._cardBorderColor, "transparent")}
              <label class="wide-style">
                Card/content border opacity
                <div class="range-row">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    .value=${String(this._cardBorderOpacity)}
                    @input=${(ev: Event) => this._setValue("cardBorderOpacity", (ev.target as HTMLInputElement).value)}
                  />
                  <span>${this._cardBorderOpacity}%</span>
                </div>
              </label>
              ${this._renderColorField("Card 3D effect", "shadowFrameColor", this._shadowFrameColor, "transparent")}
              <label class="wide-style">
                3D offset
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
                  ${this._renderColorField("Icon color", "iconColor", this._iconColor, "var(--primary-color)")}
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
                  <label class="wide-style">
                    Icon size
                    <div class="range-row icon-size-row" @input=${(ev: Event) => ev.stopPropagation()} @change=${(ev: Event) => ev.stopPropagation()}>
                      <input
                        type="range"
                        min="14"
                        max="64"
                        step="1"
                        value=${this._iconSize}
                        .value=${this._iconSize}
                        @input=${this._setIconSizeEvent}
                        @change=${this._setIconSizeEvent}
                      />
                      <input
                        class="number-input"
                        type="number"
                        min="14"
                        max="64"
                        step="1"
                        value=${this._iconSize}
                        .value=${this._iconSize}
                        @input=${this._setIconSizeEvent}
                        @change=${this._setIconSizeEvent}
                      />
                      <span>${normalizedIconSize(this._iconSize)}</span>
                    </div>
                  </label>
                </div>
                <div class="icon-style-column">
                  ${this._renderColorField("Active icon color", "iconActiveColor", this._iconActiveColor, "Icon color")}
                  ${this._renderColorField("Icon field color", "iconBackgroundColor", this._iconBackgroundColor, "transparent")}
                  ${this._renderColorField(
                    "Active icon field color",
                    "iconBackgroundActiveColor",
                    this._iconBackgroundActiveColor,
                    "Icon field color"
                  )}
                </div>
              </div>
              <label>
                Background
                <select
                  .value=${this._backgroundMode}
                  @change=${(ev: Event) => this._setValue("backgroundMode", (ev.target as HTMLSelectElement).value)}
                >
                  <option value="none">None</option>
                  <option value="color">Color</option>
                  <option value="image">Image</option>
                </select>
              </label>
              ${this._backgroundMode === "color"
                ? html`
                    ${this._renderColorField(
                      "Backgroundfarbe",
                      "backgroundColor",
                      this._backgroundColor,
                      "rgba(0,0,0,0.18)"
                    )}
                    <label class="wide-style">
                      Backgroundfarbe Opacity
                      <div class="range-row">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          .value=${String(this._backgroundOpacity)}
                          @input=${(ev: Event) =>
                            this._setValue("backgroundOpacity", (ev.target as HTMLInputElement).value)}
                        />
                        <span>${this._backgroundOpacity}%</span>
                      </div>
                    </label>
                  `
                : nothing}
              ${this._backgroundMode === "image"
                ? html`
                    <label>
                      Image
                      <input
                        placeholder="/local/background.jpg"
                        .value=${this._backgroundImage}
                        @input=${(ev: Event) => this._setValue("backgroundImage", (ev.target as HTMLInputElement).value)}
                      />
                    </label>
                  `
                : nothing}
              ${this._renderColorField(
                "Submenu Background",
                "submenuBackgroundColor",
                this._submenuBackgroundColor,
                "like menu"
              )}
              <label class="wide-style">
                Submenu Background Opacity
                <div class="range-row">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    .value=${String(this._submenuBackgroundOpacity)}
                    @input=${(ev: Event) =>
                      this._setValue("submenuBackgroundOpacity", (ev.target as HTMLInputElement).value)}
                  />
                  <span>${this._submenuBackgroundOpacity}%</span>
                </div>
              </label>
            </div>
          </details>

          <details class="wide collapsible-group settings-panel" data-tab="colors" open>
            <summary>Colors</summary>
            <p class="hint">
              Up to 20 color favorites for all color fields. Empty slots are not saved.
            </p>
            <div class="colors-actions">
              <button type="button" class="primary" @click=${this._saveColorPresets}>Save colors</button>
            </div>
            <div class="color-presets-grid">
              <span>Nr.</span>
              <span>Name</span>
              <span>Color</span>
              <span>Picker</span>
              ${normalizeColorPresets(this._colorPresets).map(
                (preset, index) => html`
                  <span class="preset-index">${index + 1}</span>
                  <input
                    placeholder=${`Color ${index + 1}`}
                    .value=${preset.name ?? ""}
                    @input=${(ev: Event) =>
                      this._updateColorPreset(index, "name", (ev.target as HTMLInputElement).value)}
                  />
                  <input
                    class="text"
                    placeholder="#33ffe7"
                    .value=${preset.value ?? ""}
                    @input=${(ev: Event) =>
                      this._updateColorPreset(index, "value", (ev.target as HTMLInputElement).value)}
                  />
                  <input
                    class="color"
                    type="color"
                    .value=${colorPickerValue(preset.value ?? "")}
                    title=${`Color ${index + 1} choose`}
                    @input=${(ev: Event) =>
                      this._updateColorPreset(index, "value", (ev.target as HTMLInputElement).value)}
                  />
                `
              )}
            </div>
          </details>

          <details class="wide json-box settings-panel" data-tab="backup" open>
            <summary>Backup</summary>
            <p class="hint">
              Exports the current editor state as a YAML file to your PC. Home Assistant is not changed.
            </p>
            <button type="button" @click=${this._exportDashboardYaml}>Dashboard YAML exportieren</button>
            <p class="hint">A YAML import can be added here later.</p>
          </details>

          <details class="wide json-box settings-panel" data-tab="advanced" ?open=${this._jsonExpanded} @toggle=${(ev: Event) => (this._jsonExpanded = (ev.target as HTMLDetailsElement).open)}>
            <summary>Special options / edit JSON</summary>
            <fieldset class="group wide debug-language-options">
              <legend>Debug</legend>
              <span class="field-label">Language</span>
              <div class="radio-grid">
                <label class="check compact-check">
                  <input
                    type="radio"
                    name="dashboard-layout-v2-debug-language"
                    value=""
                    .checked=${!this._debugLanguage}
                    @change=${() => this._setValue("debugLanguage", "")}
                  />
                  Default (automatic like browser)
                </label>
                <label class="check compact-check">
                  <input
                    type="radio"
                    name="dashboard-layout-v2-debug-language"
                    value="de"
                    .checked=${this._debugLanguage === "de"}
                    @change=${() => this._setValue("debugLanguage", "de")}
                  />
                  German
                </label>
                <label class="check compact-check">
                  <input
                    type="radio"
                    name="dashboard-layout-v2-debug-language"
                    value="en"
                    .checked=${this._debugLanguage === "en"}
                    @change=${() => this._setValue("debugLanguage", "en")}
                  />
                  English
                </label>
                <label class="check compact-check">
                  <input
                    type="radio"
                    name="dashboard-layout-v2-debug-language"
                    value="fr"
                    .checked=${this._debugLanguage === "fr"}
                    @change=${() => this._setValue("debugLanguage", "fr")}
                  />
                  French
                </label>
              </div>
              <p class="hint">Writes debug.language for test screenshots. Default keeps automatic detection.</p>
            </fieldset>
            <textarea
              .value=${this._pagesText}
              @input=${(ev: Event) => this._setValue("pagesText", (ev.target as HTMLTextAreaElement).value)}
            ></textarea>
            <button @click=${this._applyJson}>Apply JSON</button>
          </details>

          ${this._error ? html`<p class="error">${this._error}</p>` : nothing}
        </div>

        <footer>
          <button @click=${this._close}>Cancel</button>
          <button class="primary" @click=${this._save} ?disabled=${Boolean(statusLabelError)}>Save</button>
        </footer>
      </section>
    `);
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
          width: min(80vw, 1180px);
          height: min(920px, calc(100vh - 32px));
          transition: width 160ms ease;
          display: grid;
          grid-template-rows: auto auto 1fr auto;
          background: var(--card-background-color, #1c1c1c);
          border: 1px solid var(--divider-color, #333);
          border-radius: 12px;
          box-shadow: var(--ha-card-box-shadow, 0 8px 24px rgba(0, 0, 0, 0.4));
          overflow: hidden;
        }

        .dialog.wide-dialog {
          width: min(95vw, 1500px);
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

        header {
          cursor: ew-resize;
          user-select: none;
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

        .settings-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px 16px 0;
          border-bottom: 1px solid var(--divider-color, #333);
        }

        .settings-tabs button {
          min-width: 0;
          height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          color: var(--secondary-text-color);
          background: transparent;
        }

        .settings-tabs button.active {
          color: var(--text-primary-color, #fff);
          border-color: var(--primary-color, #03a9f4);
          background: color-mix(in srgb, var(--primary-color, #03a9f4) 28%, transparent);
        }

        .content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          padding: 16px;
          overflow: auto;
        }

        .content[data-active-tab="menu"] .settings-panel:not([data-tab="menu"]),
        .content[data-active-tab="display"] .settings-panel:not([data-tab="display"]),
        .content[data-active-tab="pages"] .settings-panel:not([data-tab="pages"]),
        .content[data-active-tab="submenu"] .settings-panel:not([data-tab="submenu"]),
        .content[data-active-tab="messages"] .settings-panel:not([data-tab="messages"]),
        .content[data-active-tab="style"] .settings-panel:not([data-tab="style"]),
        .content[data-active-tab="colors"] .settings-panel:not([data-tab="colors"]),
        .content[data-active-tab="backup"] .settings-panel:not([data-tab="backup"]),
        .content[data-active-tab="advanced"] .settings-panel:not([data-tab="advanced"]) {
          display: none;
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

        .color-row.has-presets {
          grid-template-columns: minmax(0, 1fr) 48px minmax(120px, 0.65fr);
        }

        .color-row .text,
        .color-row .color-preset {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .colors-actions {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 12px;
        }

        .colors-actions button {
          width: auto;
        }

        .color-presets-grid {
          display: grid;
          grid-template-columns: 44px minmax(120px, 1fr) minmax(120px, 1fr) 56px;
          gap: 8px;
          align-items: center;
        }

        .color-presets-grid > span {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 700;
        }

        .color-presets-grid .preset-index {
          text-align: center;
          font-size: 14px;
        }

        .color-presets-grid input {
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

        .weekday-options {
          grid-template-columns: repeat(3, minmax(120px, 1fr)) minmax(220px, 1.1fr);
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
          min-height: min(620px, calc(100vh - 330px));
        }

        .page-list {
          display: grid;
          align-content: start;
          gap: 6px;
          max-height: clamp(420px, calc(100vh - 330px), 720px);
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

        .notify-editor,
        .status-editor {
          display: grid;
          gap: 12px;
        }

        .status-items {
          display: grid;
          grid-template-columns: minmax(240px, 1.6fr) minmax(160px, 1fr) minmax(72px, 0.45fr);
          gap: 8px;
          align-items: center;
        }

        .status-items span {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 800;
        }

        .entity-picker {
          position: relative;
          min-width: 0;
        }

        .entity-input {
          min-width: 0;
          width: 100%;
          padding-right: 28px;
          box-sizing: border-box;
        }

        .entity-arrow {
          position: absolute;
          top: 50%;
          right: 9px;
          transform: translateY(-50%);
          color: var(--secondary-text-color);
          pointer-events: none;
        }

        input.invalid {
          border-color: var(--error-color, #db4437);
        }

        .entity-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 5;
          display: grid;
          max-height: 260px;
          overflow: auto;
          padding: 6px;
          border: 1px solid var(--divider-color, #333);
          border-radius: 8px;
          background: var(--card-background-color, #1c1c1c);
          box-shadow: var(--ha-card-box-shadow, 0 8px 24px rgba(0, 0, 0, 0.35));
        }

        .entity-menu button {
          display: grid;
          justify-items: start;
          min-width: 0;
          width: 100%;
          height: auto;
          min-height: 44px;
          padding: 6px 8px;
          border: 0;
          background: transparent;
          font-weight: 400;
          text-align: left;
        }

        .entity-menu button:hover {
          background: color-mix(in srgb, var(--primary-color, #03a9f4) 18%, transparent);
        }

        .entity-menu small,
        .entity-menu p {
          margin: 0;
          color: var(--secondary-text-color);
          font-size: 12px;
        }

        .helper-hint {
          display: grid;
          gap: 6px;
          padding: 10px 12px;
          border: 1px solid var(--warning-color, #ffa600);
          border-radius: 8px;
          color: var(--primary-text-color);
          background: color-mix(in srgb, var(--warning-color, #ffa600) 10%, transparent);
        }

        .helper-hint p {
          margin: 0;
          color: var(--secondary-text-color);
          font-size: 12px;
          line-height: 1.4;
        }

        .helper-hint code {
          color: var(--primary-text-color);
          font-size: 12px;
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

        .icon-size-row {
          grid-template-columns: minmax(0, 1fr) 76px 48px;
        }

        .number-input {
          min-width: 0;
          text-align: center;
        }

        .range-row span {
          text-align: right;
          color: var(--secondary-text-color);
          font-weight: 700;
        }

        .wide-style {
          grid-column: 1 / -1;
        }

        .color-reset-row {
          display: flex;
          justify-content: flex-end;
        }

        .color-reset-row button {
          width: auto;
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
