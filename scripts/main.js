import { registerTextEnrichers } from "./links/enrichers.js";
import { registerLinkClickHandler } from "./links/link-handler.js";
import { registerImageSocketHandlers } from "./images/image-overlay.js";
import { registerEditorButton } from "./editor/editor-button.js";

Hooks.once("init", () => {
  registerTextEnrichers();
});

Hooks.once("ready", () => {
  console.log("Journal Track Links | Ready");
  registerImageSocketHandlers();
  registerLinkClickHandler();
  registerEditorButton();
});
