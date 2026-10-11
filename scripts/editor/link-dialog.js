import { DEFAULT_LABELS, IMAGE_EXTENSIONS, LINK_TYPES, getImageFolder } from "../constants.js";
import { escapeHtml } from "../utils/html.js";

export function openLinkDialog(editor) {
  const scenes = game.scenes.contents;
  const playlists = game.playlists.contents;
  const imageFolder = getImageFolder();

  const content = `
    <form>
      <div class="form-group"><label>Тип ссылки</label>
        <select name="type">
          <option value="scene">Активация сцены</option>
          <option value="track">Запуск музыкального трека</option>
          <option value="images">Показ изображений игрокам</option>
        </select>
      </div>
      <div class="form-group scene-field"><label>Сцена</label><select name="scene">
        ${scenes.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join("")}
      </select></div>
      <div class="form-group track-field" style="display:none"><label>Плейлист</label><select name="playlist">
        ${playlists.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("")}
      </select></div>
      <div class="form-group track-field" style="display:none"><label>Трек</label><select name="sound"></select></div>
      <div class="form-group images-field" style="display:none">
        <label>Изображения (можно выбрать несколько)</label>
        <select name="images" multiple size="8" style="width:100%;min-height:150px"></select>
        <p class="notes">Папка: ${escapeHtml(imageFolder)}</p>
        <label>Загрузить новые изображения</label><input name="uploadFiles" type="file" accept="image/*" multiple />
        <button type="button" name="uploadButton" style="margin-top:6px">Загрузить выбранные файлы</button>
        <p class="notes">После загрузки выбери файлы в списке выше.</p>
      </div>
      <div class="form-group"><label>Текст ссылки</label><input name="label" type="text" value="${DEFAULT_LABELS[LINK_TYPES.SCENE]}" /></div>
    </form>`;

  new Dialog({
    title: "Создать ссылку",
    content,
    buttons: {
      insert: {
        label: "Вставить в редактор",
        callback: (html) => {
          const form = html[0].querySelector("form");
          const type = form.elements.type.value;
          const label = form.elements.label.value.trim() || DEFAULT_LABELS[type];
          let linkText;

          if (type === LINK_TYPES.SCENE) {
            const sceneId = form.elements.scene.value;
            if (!sceneId) return ui.notifications.warn("Выбери сцену.");
            linkText = `@ActivateScene[Scene.${sceneId}]{${label}}`;
          } else if (type === LINK_TYPES.TRACK) {
            const playlistId = form.elements.playlist.value;
            const soundId = form.elements.sound.value;
            if (!playlistId || !soundId) return ui.notifications.warn("Выбери плейлист и трек.");
            linkText = `@PlayTrack[Playlist.${playlistId}.PlaylistSound.${soundId}]{${label}}`;
          } else {
            const paths = Array.from(form.elements.images.selectedOptions)
              .map(option => option.value).filter(Boolean);
            if (!paths.length) return ui.notifications.warn("Выбери хотя бы одно изображение.");
            linkText = "@ShowImages[" + paths.map(encodeURIComponent).join("|") + "]{" + label + "}";
          }

          const contentElement = editor?.querySelector(".editor-content");
          if (!contentElement) return ui.notifications.error("Редактор не найден.");
          contentElement.focus();
          if (document.execCommand("insertText", false, linkText)) ui.notifications.info("Ссылка вставлена в редактор.");
          else ui.notifications.error("Не удалось вставить ссылку. Попробуй снова.");
        }
      },
      close: { label: "Закрыть" }
    },
    render: (html) => {
      const form = html[0].querySelector("form");
      const type = form.elements.type;
      const playlist = form.elements.playlist;
      const sound = form.elements.sound;
      const label = form.elements.label;
      const images = form.elements.images;
      const uploadFiles = form.elements.uploadFiles;
      const uploadButton = form.elements.uploadButton;

      const updateSounds = () => {
        const sounds = game.playlists.get(playlist.value)?.sounds.contents ?? [];
        sound.innerHTML = sounds.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join("");
      };
      const updateType = () => {
        const selectedType = type.value;
        form.querySelectorAll(".scene-field").forEach(el => el.style.display = selectedType === LINK_TYPES.SCENE ? "" : "none");
        form.querySelectorAll(".track-field").forEach(el => el.style.display = selectedType === LINK_TYPES.TRACK ? "" : "none");
        form.querySelectorAll(".images-field").forEach(el => el.style.display = selectedType === LINK_TYPES.IMAGES ? "" : "none");
        label.value = DEFAULT_LABELS[selectedType];
      };

      async function ensureImageFolder() {
        let current = "";
        for (const part of imageFolder.split("/")) {
          current = current ? `${current}/${part}` : part;
          try { await FilePicker.createDirectory("data", current); }
          catch (error) { console.debug("Journal Track Links | Каталог уже существует или не создан:", current, error); }
        }
      }

      async function refreshImages() {
        const previous = new Set(Array.from(images.selectedOptions).map(option => option.value));
        try {
          const result = await FilePicker.browse("data", imageFolder);
          const files = (result.files ?? []).filter(path => IMAGE_EXTENSIONS.test(path));
          images.innerHTML = files.sort((a, b) => a.localeCompare(b)).map(path =>
            `<option value="${escapeHtml(path)}">${escapeHtml(path.split("/").pop())}</option>`
          ).join("");
          for (const option of images.options) option.selected = previous.has(option.value);
          if (!files.length) ui.notifications.info("В папке пока нет изображений. Можно загрузить их здесь.");
        } catch (error) {
          console.error("Journal Track Links | Не удалось прочитать папку изображений:", error);
          ui.notifications.warn("Не удалось прочитать папку изображений. Проверь доступ к каталогу assets.");
        }
      }

      uploadButton.addEventListener("click", async () => {
        const files = Array.from(uploadFiles.files ?? []);
        if (!files.length) return ui.notifications.warn("Сначала выбери файлы для загрузки.");
        uploadButton.disabled = true;
        uploadButton.textContent = "Загрузка…";
        try {
          await ensureImageFolder();
          for (const file of files) {
            if (!file.type.startsWith("image/")) {
              ui.notifications.warn(`Пропущен не графический файл: ${file.name}`);
              continue;
            }
            await FilePicker.upload("data", imageFolder, file, {}, { notify: false });
          }
          uploadFiles.value = "";
          await refreshImages();
          ui.notifications.info("Загрузка изображений завершена.");
        } catch (error) {
          console.error("Journal Track Links | Ошибка загрузки изображений:", error);
          ui.notifications.error("Не удалось загрузить изображения. Проверь права доступа к папке данных Foundry.");
        } finally {
          uploadButton.disabled = false;
          uploadButton.textContent = "Загрузить выбранные файлы";
        }
      });

      type.addEventListener("change", updateType);
      playlist.addEventListener("change", updateSounds);
      updateSounds();
      updateType();
      refreshImages();
    }
  }, { width: 600 }).render(true);
}
