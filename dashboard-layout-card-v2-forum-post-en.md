# Dashboard Layout Card V2 for Home Assistant

I created a V2 fork of the well-known `lovelace-layout-card`:

GitHub: <https://github.com/rockbaer2007/lovelace-layout-card-v2>

The card can be installed next to the original `layout-card` and does not overwrite it. All new elements use their own `*-v2` names.

## What is it?

**Dashboard Layout Card V2** is less a single card and more a dashboard/view extension for Home Assistant. The goal is a flexible dashboard with a side menu, subpages, submenus and extended layout/style options, especially for tablet, kiosk and wall-display setups.

## Current state

The project is still experimental, but already usable. Many settings are now available directly in the editor. Feedback, tests, bug reports and practical ideas are very welcome.

## Features

- dedicated V2 layout types:
  - `custom:sections-layout-v2`
  - `custom:masonry-layout-v2`
  - `custom:horizontal-layout-v2`
  - `custom:vertical-layout-v2`
  - `custom:grid-layout-v2`
- installable in parallel with the original `layout-card`
- side tab menu on the left or right
- menu can be disabled
- home entry in the menu
- global icon-only mode and automatic mobile icon mode up to 600 px
- icon-only mode is useful for kiosk/tablet views
- submenu column next to the main menu
- submenus show only the subpages of the selected main menu entry
- first submenu button can act as the main entry home page or be disabled
- subviews with shared menu
- new subviews default to Sections V2
- support for Home Assistant sections
- moving Sections V2 sections in edit mode
- digital or analog clock
- date and weekday
- configurable clock, date and icon size
- saved values such as `icon_size: 48px` are loaded back into slider and number field
- optional analog hour marks, minute marks and seconds hand
- day symbol through helpers for holidays, birthday and Advent/Christmas
- colors for active/inactive tabs
- text colors for active/inactive tabs
- hover colors
- icon color, active icon color, icon background and active icon background
- icon shape: circle or rounded square
- individual colors per home, main menu and submenu entry
- color favorites: up to 20 colors selectable in all color fields
- individual entry colors can be reset to global colors
- tab/menu border with opacity
- view/card border with opacity
- status and notification border with opacity
- 3D effect for tabs, card/view and dividers
- spacers and dividers in the menu
- divider color, height, opacity and optional 3D effect
- menu background as color or image
- submenu background separately configurable
- notification box through a text helper
- in icon-only mode the notification is available through a popup button
- up to four status values in the menu
- optional hiding of the Home Assistant header and sidebar
- visible users configurable
- YAML backup export directly from the editor
- wider editor window with double-click expansion on the top bar

## Editor tabs

The editor is split into tabs:

| Tab | Content |
| --- | --- |
| Menu | Menu position, menu title, global icon-only mode |
| Home page | Home entry, title, path, icon, colors, Sections V2 columns, dense placement, extra top spacing, theme inheritance |
| Display | Clock, date, weekday, analog clock options, day symbol and helpers |
| Pages | Main menu pages, spacers, dividers, layout type, colors, reset to global colors, submenu behavior |
| Submenu | Subpages of the selected main page |
| Messages | Notification, popup, status values, border colors and opacity |
| Styles Global | Global colors, borders, 3D effects, icon size, icon shape, backgrounds, submenu background |
| Colors | Up to 20 color favorites with a dedicated save button |
| Backup | YAML export of the current dashboard state |
| Advanced | HA chrome, visible users and JSON special options |

## Helpers

Only the features you enable need helpers:

| Entity | Helper type | Purpose |
| --- | --- | --- |
| `input_text.dashboard_notification` | Text | Optional dashboard notification text |
| `input_boolean.dashboard_holiday` | Toggle | Optional holiday day symbol |
| `input_boolean.dashboard_birthday` | Toggle | Optional birthday day symbol |
| `input_boolean.dashboard_christmas` | Toggle | Optional Advent/Christmas day symbol |

Status values do not require special helpers. They can use any readable Home Assistant entity, for example sensors, binary sensors or template sensors.

## Background images

Portrait images work especially well for menu backgrounds. A useful aspect ratio is about:

```text
1:2.5
```

Other formats work too, but may be cropped because the menu uses `cover`.

Images must be stored in Home Assistant under `www`, for example:

```text
/config/www/image/back2.jpg
```

Use this path in the editor:

```text
/local/image/back2.jpg
```

Please only use your own images or images with a compatible free/open-source license.

## Installation through HACS

Add the repository as a custom frontend repository:

```text
https://github.com/rockbaer2007/lovelace-layout-card-v2
```

Home Assistant should then load this resource:

```text
/hacsfiles/lovelace-layout-card-v2/dashboard-layout-card-v2.js
```

If an old version is still shown:

- refresh HACS repositories
- clear the browser cache
- hard-reload the dashboard
- if needed, reload the resource with a version parameter such as `?v=0.1.165`

## Screenshot and video

A screenshot and a short video are available in the open-source documentation:

<https://opensource.ugso-software.de/sammlung/ha-dashboard>

## Links

GitHub:

<https://github.com/rockbaer2007/lovelace-layout-card-v2>

Open-source documentation:

<https://opensource.ugso-software.de/sammlung/ha-dashboard>
