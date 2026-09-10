import "./layouts/masonry";
import "./layouts/horizontal";
import "./layouts/vertical";
import "./layout-break";
import "./layouts/grid";
import "./layout-card";
import "./layout-card-editor";
import "./dashboard-layout-card";
import "./dashboard-layout-card-editor";
import "./patches/hui-card-element-editor";
import "./patches/hui-view-editor";
import "./gap-card.ts";
import pjson from "../package.json";

console.groupCollapsed(
  `%cDASHBOARD-LAYOUT-CARD-V2 ${pjson.version} IS INSTALLED`,
  "color: green; font-weight: bold"
);
console.log("Original:", "https://github.com/thomasloven/lovelace-layout-card");
console.groupEnd();
