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
    clock: "digital",
    date: true,
  },
  pages: [],
};

function slugifyPath(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeConfig(viewConfig: any) {
  return {
    ...defaultConfig,
    ...(viewConfig?.layout?.dashboard_layout_v2 ?? {}),
    menu: {
      ...defaultConfig.menu,
      ...(viewConfig?.layout?.dashboard_layout_v2?.menu ?? {}),
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
  @state() private _clock = "digital";
  @state() private _date = true;
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
    this._clock = config.menu.clock ?? "digital";
    this._date = config.menu.date !== false;
    this._pagesText = JSON.stringify(config.pages ?? [], null, 2);
    this._error = "";
  }

  private _close() {
    this.dispatchEvent(new CustomEvent("dialog-closed", { bubbles: true, composed: true }));
    this.remove();
  }

  private _setValue(key: string, value: any) {
    if (key === "menuPosition") this._menuPosition = value;
    if (key === "menuTitle") this._menuTitle = value;
    if (key === "clock") this._clock = value;
    if (key === "date") this._date = value;
    if (key === "pagesText") this._pagesText = value;
  }

  private async _save() {
    let pages: any[];
    try {
      const parsed = JSON.parse(this._pagesText || "[]");
      if (!Array.isArray(parsed)) throw new Error("Pages muss eine Liste sein.");
      pages = parsed;
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

    const normalizedPages = pages.map((page, index) => {
      const title = String(page.title ?? page.name ?? `Unterseite ${index + 1}`);
      return {
        ...page,
        title,
        path: String(page.path ?? slugifyPath(title) ?? `dashboard-v2-${index + 1}`),
      };
    });

    const dashboardLayoutV2 = {
      menu: {
        position: this._menuPosition,
        title: this._menuTitle,
        clock: this._clock,
        date: this._date,
      },
      pages: normalizedPages,
    };

    const currentPath = String(views[this.viewIndex].path ?? this.viewIndex);
    const existingViewsByPath = new Map(
      views.map((view, index) => [String(view.path ?? index), { view, index }])
    );
    const nextViews = views.map((view, index) => {
      if (index !== this.viewIndex) return view;
      return {
        ...view,
        layout: {
          ...(view.layout ?? {}),
          dashboard_layout_v2: dashboardLayoutV2,
        },
      };
    });

    for (const page of normalizedPages) {
      const pagePath = String(page.path);
      const existing = existingViewsByPath.get(pagePath);
      const isCurrentView = pagePath === currentPath;
      const pageLayout = {
        ...((existing?.view.layout ?? page.layout) ?? {}),
        dashboard_layout_v2: dashboardLayoutV2,
      };

      if (existing) {
        nextViews[existing.index] = {
          ...existing.view,
          title: page.title,
          ...(page.icon ? { icon: page.icon } : {}),
          type: page.type ?? page.layout_type ?? existing.view.type ?? "custom:masonry-layout-v2",
          subview: isCurrentView ? existing.view.subview : true,
          layout: pageLayout,
        };
        continue;
      }

      nextViews.push({
        title: page.title,
        path: pagePath,
        ...(page.icon ? { icon: page.icon } : {}),
        type: page.type ?? page.layout_type ?? "custom:masonry-layout-v2",
        subview: true,
        layout: pageLayout,
        cards: Array.isArray(page.cards) ? page.cards : [],
      });
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

          <label class="wide">
            Tabs / Unterseiten als JSON
            <textarea
              .value=${this._pagesText}
              @input=${(ev: Event) => this._setValue("pagesText", (ev.target as HTMLTextAreaElement).value)}
            ></textarea>
          </label>

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
        .error {
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
