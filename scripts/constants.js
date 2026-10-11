export const MODULE_ID = "journal-track-links";
export const SOCKET_NAME = `module.${MODULE_ID}`;
export const IMAGE_OVERLAY_ID = "jtl-image-overlay";

export const LINK_TYPES = Object.freeze({
  SCENE: "scene",
  TRACK: "track",
  IMAGES: "images"
});

export const DEFAULT_LABELS = Object.freeze({
  [LINK_TYPES.SCENE]: "Открыть сцену",
  [LINK_TYPES.TRACK]: "Включить музыку",
  [LINK_TYPES.IMAGES]: "Показать изображения"
});

export const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;

export function getImageFolder() {
  return `worlds/${game.world.id}/assets/journal-track-links`;
}
