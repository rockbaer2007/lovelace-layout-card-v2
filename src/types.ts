export interface LovelaceCard extends HTMLElement {
  hass: any;
  editMode?: boolean;
  setConfig(config: any): void;
  getCardSize?(): Promise<number> | number;
}

export interface HuiCard extends HTMLElement {
  hass: any;
  editMode?: boolean;
  getCardSize?(): Promise<number> | number;
}

export interface CardConfig {
  type: string;
  view_layout?: {
    show?:
      | "always"
      | "never"
      | {
          mediaquery?: string;
          sidebar?: string;
        };
    column?: number;
  };
}

export interface CardConfigGroup {
  card: LovelaceCard | HuiCard;
  config: CardConfig;
  index: number;
  show?: boolean;
}

export interface ViewConfig {
  title?: string;
  path?: string;
  type?: string;
  subview?: boolean;
  cards?: Array<CardConfig>;
  sections?: Array<Record<string, any>>;
  max_columns?: number;
  badges?: Array<Record<string, any>>;
  header?: Record<string, any>;
  footer?: Record<string, any>;
  sidebar?: Record<string, any>;
  layout?: {
    margin?: string;
    padding?: string;
    height?: string;
    dashboard_layout_v2?: {
      inherits_from?: string;
      menu?: DashboardLayoutMenuConfig;
      chrome?: DashboardLayoutChromeConfig;
      pages?: Array<DashboardLayoutPageConfig & { path?: string }>;
    };
  };
  view_layout?: {};
}

export interface ColumnViewConfig extends ViewConfig {
  layout?: {
    margin?: string;
    padding?: string;
    height?: string;
    reflow?: boolean;
    width?: number;
    column_widths: string;
    max_width?: number;
    max_cols?: number;
    min_height?: number;
    rtl?: boolean;
    card_margin?: string;
  };
}

export interface GridViewConfig extends ViewConfig {
  layout?: {
    margin?: string;
    padding?: string;
    height?: string;
    mediaquery?: Array<Record<string, any>>;
  };
}

export interface LayoutCardConfig {
  cards?: Array<CardConfig>;
  entities?: Array<CardConfig>;
  layout_type?: string;
  layout?: any;
  layout_options?: any; // legacy
}

export type DashboardLayoutMenuPosition = "left" | "none" | "right";
export type DashboardLayoutClockMode = "none" | "digital" | "analog";

export interface DashboardLayoutChromeConfig {
  hide_ha_chrome?: boolean;
  admin_always_visible?: boolean;
  visible_users?: string | string[];
}

export interface DashboardLayoutMenuConfig {
  position?: DashboardLayoutMenuPosition;
  title?: string;
  show_home?: boolean;
  home?: {
    title?: string;
    path?: string;
    icon?: string;
  };
  clock?: DashboardLayoutClockMode;
  date?: boolean;
  style?: {
    icon_color?: string;
    active_tab_color?: string;
    inactive_tab_color?: string;
    hover_tab_color?: string;
    active_tab_text_color?: string;
    inactive_tab_text_color?: string;
    hover_tab_text_color?: string;
    clock_size?: string;
    background_mode?: "none" | "color" | "image";
    background_color?: string;
    background_image?: string;
  };
}

export interface DashboardLayoutPageConfig {
  title: string;
  icon?: string;
  type?: string;
  path?: string;
  layout_type?: string;
  layout?: any;
  cards?: Array<CardConfig>;
  sections?: Array<Record<string, any>>;
  max_columns?: number;
}

export interface DashboardLayoutCardConfig {
  type: "custom:dashboard-layout-card-v2";
  menu?: DashboardLayoutMenuPosition | DashboardLayoutMenuConfig;
  chrome?: DashboardLayoutChromeConfig;
  pages?: Array<DashboardLayoutPageConfig>;
}
