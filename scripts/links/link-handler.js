import { showImagesForEveryone } from "../images/image-overlay.js";

async function handleTrackLink(link) {
  const parts = link.dataset.trackUuid.split(".");
  const playlist = parts[0] === "Playlist" ? game.playlists.get(parts[1]) : null;
  const sound = parts[2] === "PlaylistSound" ? playlist?.sounds.get(parts[3]) : null;

  if (!playlist || !sound) {
    console.error("Journal Track Links | Плейлист или трек не найден", link.dataset.trackUuid);
    ui.notifications.error("Плейлист или трек не найден.");
    return;
  }
  try {
    await playlist.playSound(sound);
    console.log("Journal Track Links | Playing:", sound.name);
  } catch (error) {
    console.error("Journal Track Links | Ошибка запуска трека:", error);
    ui.notifications.error("Не удалось запустить трек.");
  }
}

async function handleSceneLink(link) {
  const uuid = link.dataset.sceneUuid.trim();
  const sceneId = uuid.startsWith("Scene.") ? uuid.slice("Scene.".length) : uuid;
  const scene = game.scenes.get(sceneId);
  if (!scene) {
    console.error("Journal Track Links | Сцена не найдена:", uuid);
    ui.notifications.error(`Сцена не найдена: ${uuid}`);
    return;
  }
  try {
    await scene.activate();
    console.log("Journal Track Links | Scene activated:", scene.name);
  } catch (error) {
    console.error("Journal Track Links | Ошибка активации сцены:", error);
    ui.notifications.error("Не удалось активировать сцену.");
  }
}

function handleImagesLink(link) {
  try {
    const paths = link.dataset.imagePaths.split("|")
      .map((path) => decodeURIComponent(path.trim()))
      .filter(Boolean);
    if (!paths.length) {
      ui.notifications.warn("В ссылке нет изображений.");
      return;
    }
    showImagesForEveryone(paths);
  } catch (error) {
    console.error("Journal Track Links | Ошибка показа изображений:", error);
    ui.notifications.error("Не удалось показать изображения.");
  }
}

export function registerLinkClickHandler() {
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const trackLink = target.closest("a.journal-track-link");
    const sceneLink = target.closest("a.journal-scene-link");
    const imagesLink = target.closest("a.journal-images-link");
    if (!trackLink && !sceneLink && !imagesLink) return;

    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM) {
      ui.notifications.warn("Это действие доступно только Мастеру.");
      return;
    }

    if (trackLink) await handleTrackLink(trackLink);
    else if (sceneLink) await handleSceneLink(sceneLink);
    else if (imagesLink) handleImagesLink(imagesLink);
  }, true);
}
