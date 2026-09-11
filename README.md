# Dashboard Layout Card V2

Parallel installable V2 fork of
[thomasloven/lovelace-layout-card](https://github.com/thomasloven/lovelace-layout-card)
with additional dashboard-view features for Home Assistant.

The original project is MIT licensed. This fork keeps attribution and registers
separate `*-v2` custom elements so it can be installed next to the original
layout-card without overwriting it.

## Features

- Adds V2 view layouts for Masonry, Sections, Horizontal, Vertical and Grid.
- Adds an optional left or right dashboard tab menu for view navigation.
- Supports non-clickable menu spacers and divider lines.
- Supports Home Assistant-style Sections views through `custom:sections-layout-v2`.
- Keeps the menu visible while switching between linked dashboard subviews.
- Stores shared dashboard menu settings once on the home view.
- Lets linked subviews inherit menu style through `inherits_from`.
- Supports configurable tab colors, text colors, hover colors, icon color, icon
  background color, icon shape, tab border, view card border, optional 3D
  frame, menu background, digital or analog clock, date display, weekday
  display, clock size and date text size.
- Can optionally hide the Home Assistant sidebar/header for selected dashboard
  users while keeping it visible for admins.

## Installation

Install this repository as a custom frontend repository in HACS:

```text
https://github.com/rockbaer2007/lovelace-layout-card-v2
```

After installation, make sure Home Assistant loads:

```text
/hacsfiles/lovelace-layout-card-v2/dashboard-layout-card-v2.js
```

If Home Assistant still shows an older version, refresh HACS repositories,
clear the browser cache and reload the dashboard.

## Registered Types

Views:

- `custom:sections-layout-v2`
- `custom:masonry-layout-v2`
- `custom:horizontal-layout-v2`
- `custom:vertical-layout-v2`
- `custom:grid-layout-v2`

Cards and helpers:

- `custom:dashboard-layout-card-v2`
- `custom:layout-card-v2`
- `custom:layout-break-v2`
- `custom:gap-card-v2`

## Dashboard View Example

The home view stores the shared dashboard configuration. Linked subviews only
reference the home view with `inherits_from`.

```yaml
views:
  - type: custom:sections-layout-v2
    path: home
    title: Home
    icon: mdi:home
    layout:
      dashboard_layout_v2:
        menu:
          position: left
          title: Haus
          show_home: true
          home:
            title: Home
            path: home
            icon: mdi:home
          clock: analog
          date: true
          weekday: long
          style:
            icon_color: "#fbff00"
            icon_background_color: "#ffffff"
            icon_shape: circle
            active_tab_color: "#333aff"
            inactive_tab_color: "#bfbfbf"
            hover_tab_color: "#33ffe7"
            active_tab_text_color: "#ffffff"
            inactive_tab_text_color: "#000000"
            hover_tab_text_color: "#000000"
            tab_border_color: "transparent"
            card_border_color: "transparent"
            shadow_frame_color: "transparent"
            clock_size: 96px
            date_size: 12px
            weekday_wrap_size: 21px
            background_mode: none
            background_color: ""
            background_image: ""
        chrome:
          hide_ha_chrome: true
          admin_always_visible: true
          visible_users: Uwe
        pages:
          - title: Kellergeschoss
            path: keller
            icon: mdi:view-dashboard
            type: custom:sections-layout-v2
            layout_type: custom:sections-layout-v2
            max_columns: 6
          - type: spacer
          - type: divider
            color: "#ffffff"
          - title: Erdgeschoss
            path: erdgeschoss
            icon: mdi:view-dashboard
            type: custom:sections-layout-v2
            layout_type: custom:sections-layout-v2
            max_columns: 4
    sections:
      - type: grid
        cards: []

  - type: custom:sections-layout-v2
    title: Kellergeschoss
    path: keller
    icon: mdi:view-dashboard
    subview: true
    layout:
      dashboard_layout_v2:
        inherits_from: home
    max_columns: 6
    sections:
      - type: grid
        cards: []

  - type: custom:sections-layout-v2
    title: Erdgeschoss
    path: erdgeschoss
    icon: mdi:view-dashboard
    subview: true
    layout:
      dashboard_layout_v2:
        inherits_from: home
    max_columns: 4
    sections:
      - type: grid
        cards: []
```

## Editor

Open the normal Home Assistant view editor and choose a V2 layout type. The V2
dashboard settings are available from the view editor and allow editing:

- menu position: left, none or right
- home entry
- tab pages and their layouts
- tab, text, hover, icon and background colors
- digital or analog clock
- weekday display: none, short or long
- clock size from `24px` to `128px`
- date text size from `8px` to `48px`
- long weekday line break threshold from `12px` to `48px`
- Home Assistant sidebar/header visibility behavior

The JSON section in the editor is optional and meant for advanced page edits.
Normal tab changes should be done through the form fields.

## Menu Settings

`dashboard_layout_v2.menu` is only needed on the home view. Subviews should use:

```yaml
layout:
  dashboard_layout_v2:
    inherits_from: home
```

This avoids duplicated style blocks and keeps tab colors consistent across all
linked dashboard pages.

## Layout Notes

The original layout-card behavior is still available through the V2 names:

```yaml
views:
  - title: Example
    type: custom:masonry-layout-v2
    layout:
      width: 300
      max_cols: 4
    cards: []
```

Inside a card:

```yaml
type: custom:layout-card-v2
layout_type: custom:grid-layout-v2
layout:
  grid-template-columns: repeat(3, minmax(0, 1fr))
  gap: 8px
cards: []
```

`view_layout` options from the original layout-card are still supported where
the inherited layout engine supports them.

## Status

This is an active V2 fork focused on dashboard-style Home Assistant views. The
API can still change while the V2 feature set is being refined.

## Attribution

Based on [thomasloven/lovelace-layout-card](https://github.com/thomasloven/lovelace-layout-card),
licensed under the MIT License.
