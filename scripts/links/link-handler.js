import { showImagesForEveryone } from "../images/image-overlay.js";
import { escapeHtml } from "../utils/html.js";

function askChoice({ title, content, choices, width = 420 }) {
  return new Promise((resolve) => {
    const buttons = {};
    for (const choice of choices) {
      buttons[choice.id] = {
        label: choice.label,
        ...(choice.cssClass ? { class: choice.cssClass } : {}),
        callback: () => resolve(choice.id)
      };
    }
    new Dialog({
      title,
      content: `<div class="jml-choice-dialog">${content}</div>`,
      buttons,
      default: choices[0]?.id,
      close: () => resolve(null)
    }, { width: Math.min(width, Math.max(300, window.innerWidth - 24)), height: "auto", resizable: true }).render(true);
  });
}

async function handleTrackLink(link) {
  const parts = link.dataset.trackUuid.split(".");
  const playlist = parts[0] === "Playlist" ? game.playlists.get(parts[1]) : null;
  const sound = parts[2] === "PlaylistSound" ? playlist?.sounds.get(parts[3]) : null;

  if (!playlist || !sound) {
    console.error("Journal Media Links | Плейлист или трек не найден", link.dataset.trackUuid);
    ui.notifications.error("Плейлист или трек не найден.");
    return;
  }

  const choice = await askChoice({
    title: "Запуск музыкального трека",
    content: `<p>Как запустить <strong>${escapeHtml(sound.name)}</strong>?</p><p class="notes">Можно оставить текущую музыку или заменить её новым треком. Для микса нескольких треков из одного плейлиста нужен режим одновременного воспроизведения в настройках этого плейлиста.</p>`,
    choices: [
      { id: "mix", label: "Добавить к текущей музыке" },
      { id: "replace", label: "Заменить текущую музыку", cssClass: "jml-primary" }
    ]
  });
  if (!choice) return;

  try {
    if (choice === "replace") {
      for (const currentPlaylist of game.playlists.contents) {
        for (const currentSound of currentPlaylist.sounds.contents) {
          if (!currentSound.playing) continue;
          if (typeof currentPlaylist.stopSound === "function") {
            await currentPlaylist.stopSound(currentSound);
          } else if (typeof currentSound.update === "function") {
            await currentSound.update({ playing: false });
          }
        }
      }
    }
    await playlist.playSound(sound);
    console.log("Journal Media Links | Playing:", sound.name, `(${choice})`);
  } catch (error) {
    console.error("Journal Media Links | Ошибка запуска трека:", error);
    ui.notifications.error("Не удалось запустить трек.");
  }
}

async function handleSceneLink(link) {
  const uuid = link.dataset.sceneUuid.trim();
  const sceneId = uuid.startsWith("Scene.") ? uuid.slice("Scene.".length) : uuid;
  const scene = game.scenes.get(sceneId);
  if (!scene) {
    console.error("Journal Media Links | Сцена не найдена:", uuid);
    ui.notifications.error(`Сцена не найдена: ${uuid}`);
    return;
  }

  const choice = await askChoice({
    title: "Переход к сцене",
    content: `<p>Что сделать со сценой <strong>${escapeHtml(scene.name)}</strong>?</p><p class="notes">Просмотр сцены изменит вид только у Мастера. Активация сделает её активной для игрового стола.</p>`,
    choices: [
      { id: "view", label: "Просто перейти к сцене" },
      { id: "activate", label: "Активировать сцену", cssClass: "jml-primary" }
    ]
  });
  if (!choice) return;

  try {
    if (choice === "activate") await scene.activate();
    else if (typeof scene.view === "function") await scene.view();
    else {
      ui.notifications.error("В этой версии Foundry переход к сцене без активации недоступен.");
      return;
    }
    console.log(`Journal Media Links | Scene ${choice}:`, scene.name);
  } catch (error) {
    console.error("Journal Media Links | Ошибка перехода к сцене:", error);
    ui.notifications.error(choice === "activate" ? "Не удалось активировать сцену." : "Не удалось перейти к сцене.");
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
    console.error("Journal Media Links | Ошибка показа изображений:", error);
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
    if (!game.user.isGM && !imagesLink) {
    ui.notifications.warn("Это действие доступно только Мастеру.");
    return;
  }

    if (trackLink) await handleTrackLink(trackLink);
    else if (sceneLink) await handleSceneLink(sceneLink);
    else if (imagesLink) handleImagesLink(imagesLink);
  }, true);
}
