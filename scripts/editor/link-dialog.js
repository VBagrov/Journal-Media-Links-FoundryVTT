import { DEFAULT_LABELS, IMAGE_EXTENSIONS, LINK_TYPES, getImageFolder } from "../constants.js";
import { escapeHtml } from "../utils/html.js";

function compareBySortMode(mode) {
  return (a, b) => {
    if (mode === "m") return (a.sort - b.sort) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  };
}

function buildSceneTreeItems() {
  const items = [];
  const nodes = new Map(game.folders
    .filter(folder => folder.type === "Scene")
    .map(folder => [folder.id, { folder, childFolders: [], scenes: [] }]));
  const root = { childFolders: [], scenes: [] };

  for (const node of nodes.values()) {
    const parent = node.folder.parentFolder;
    const parentNode = parent ? nodes.get(parent.id) : null;
    (parentNode ? parentNode.childFolders : root.childFolders).push(node);
  }
  for (const scene of game.scenes.contents) {
    const node = scene.folder ? nodes.get(scene.folder.id) : null;
    (node ? node.scenes : root.scenes).push(scene);
  }

  const walk = (node, depth, mode, ancestors) => {
    const byMode = compareBySortMode(mode);
    node.childFolders.sort((a, b) => byMode(a.folder, b.folder));
    node.scenes.sort(byMode);
    for (const child of node.childFolders) {
      items.push({ kind: "folder", folder: child.folder, depth, ancestors });
      walk(child, depth + 1, child.folder.sorting, [...ancestors, child.folder.id]);
    }
    for (const scene of node.scenes) items.push({ kind: "scene", scene, depth, ancestors });
  };
  walk(root, 0, "a", []);
  return items;
}

function renderScenePickerItems(items) {
  if (!items.length) return '<p class="notes jml-scene-empty">В мире нет ни одной сцены.</p>';
  return items.map(item => {
    const ancestors = (item.ancestors ?? []).map(id => escapeHtml(id)).join(",");
    if (item.kind === "folder") {
      return `<button type="button" class="jml-scene-folder" style="--jml-depth:${item.depth}" data-folder-id="${escapeHtml(item.folder.id)}" data-ancestors="${ancestors}" aria-expanded="true"><span class="jml-folder-toggle" aria-hidden="true"></span>${escapeHtml(item.folder.name)}</button>`;
    }
    return `<button type="button" class="jml-scene-option" role="option" aria-selected="false" style="--jml-depth:${item.depth}" data-scene-id="${escapeHtml(item.scene.id)}" data-ancestors="${ancestors}"><span class="jml-scene-name">${escapeHtml(item.scene.name)}</span></button>`;
  }).join("");
}

function decodeFileName(path) {
  const raw = String(path).split("/").pop();
  try { return decodeURIComponent(raw); } catch { return raw; }
}

export function openLinkDialog(editor) {
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
      <div class="form-group scene-field">
        <div class="jml-scene-layout">
          <div class="jml-scene-picker" role="listbox" aria-label="Сцена">
            ${renderScenePickerItems(buildSceneTreeItems())}
          </div>
          <div class="jml-scene-preview" aria-live="polite"></div>
        </div>
        <input type="hidden" name="scene" value="" />
      </div>
      <div class="form-group track-field" style="display:none"><label>Плейлист</label><select name="playlist">
        ${playlists.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("")}
      </select></div>
      <div class="form-group track-field" style="display:none"><label>Трек</label><select name="sound"></select></div>
      <div class="form-group images-field" style="display:none">
        <label>Изображения (можно выбрать несколько)</label>
        <select name="images" multiple size="5" class="jml-image-select"></select>
        <div class="jml-image-preview" aria-live="polite"><p class="notes">Выбери изображение для предпросмотра.</p></div>
        <p class="notes">Папка: ${escapeHtml(imageFolder)}</p>
        <label>Загрузить новые изображения</label><input name="uploadFiles" type="file" accept="image/*" multiple />
        <div class="jml-upload-preview"><p class="notes">Выбранные для загрузки изображения и их имена появятся здесь.</p></div>
        <button type="button" name="uploadButton" style="margin-top:6px">Загрузить выбранные файлы</button>
        <p class="notes">Перед загрузкой можно изменить имя каждого файла.</p>
      </div>
      <div class="form-group"><label>Текст ссылки</label><input name="label" type="text" value="${DEFAULT_LABELS[LINK_TYPES.SCENE]}" /></div>
    </form>`;

  let dialog;
  dialog = new Dialog({
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
      const imagePreview = form.querySelector(".jml-image-preview");
      const uploadPreview = form.querySelector(".jml-upload-preview");
      const sceneInput = form.elements.scene;
      const scenePicker = form.querySelector(".jml-scene-picker");
      const scenePreview = form.querySelector(".jml-scene-preview");
      const collapsedFolders = new Set();

      const updateSceneVisibility = () => {
        scenePicker.querySelectorAll("[data-ancestors]").forEach(el => {
          const ancestors = el.dataset.ancestors.split(",").filter(Boolean);
          el.classList.toggle("hidden", ancestors.some(id => collapsedFolders.has(id)));
        });
      };

      const updateScenePreview = () => {
        const scene = game.scenes.get(sceneInput.value);
        if (!scene) {
          scenePreview.innerHTML = '<p class="notes">Выбери сцену, чтобы увидеть превью.</p>';
        } else if (scene.thumb) {
          scenePreview.innerHTML = `<figure class="jml-preview-item"><img src="${escapeHtml(scene.thumb)}" alt="${escapeHtml(scene.name)}"><figcaption>${escapeHtml(scene.name)}</figcaption></figure>`;
        } else {
          scenePreview.innerHTML = `<p class="notes">У сцены «${escapeHtml(scene.name)}» нет превью.</p>`;
        }
        resizeDialog();
      };

      const selectSceneOption = (option) => {
        scenePicker.querySelectorAll(".jml-scene-option.selected").forEach(el => {
          el.classList.remove("selected");
          el.setAttribute("aria-selected", "false");
        });
        option.classList.add("selected");
        option.setAttribute("aria-selected", "true");
        sceneInput.value = option.dataset.sceneId;
        updateScenePreview();
      };

      scenePicker.addEventListener("click", (event) => {
        const folderToggle = event.target.closest(".jml-scene-folder");
        if (folderToggle) {
          const folderId = folderToggle.dataset.folderId;
          if (collapsedFolders.has(folderId)) collapsedFolders.delete(folderId);
          else collapsedFolders.add(folderId);
          folderToggle.classList.toggle("collapsed", collapsedFolders.has(folderId));
          folderToggle.setAttribute("aria-expanded", String(!collapsedFolders.has(folderId)));
          updateSceneVisibility();
          resizeDialog();
          return;
        }
        const option = event.target.closest(".jml-scene-option");
        if (option) selectSceneOption(option);
      });

      const resizeDialog = () => {
        requestAnimationFrame(() => {
          const app = form.closest(".window-app, .app");
          if (app) {
            app.style.height = "auto";
            app.style.maxHeight = `${Math.max(240, window.innerHeight - 32)}px`;
          }
          dialog?.setPosition?.({
            width: Math.min(800, Math.max(320, window.innerWidth - 32)),
            height: "auto"
          });
        });
      };

      const updateImagePreview = () => {
        const selected = Array.from(images.selectedOptions).map(option => option.value).filter(Boolean);
        if (!selected.length) {
          imagePreview.innerHTML = '<p class="notes">Выбери изображение для предпросмотра.</p>';
        } else {
          imagePreview.innerHTML = selected.map(path => `
            <figure class="jml-preview-item">
              <img src="${escapeHtml(path)}" alt="${escapeHtml(decodeFileName(path))}">
            </figure>`).join("");
        }
        resizeDialog();
      };

      const renderUploadPreview = () => {
        const files = Array.from(uploadFiles.files ?? []);
        uploadPreview.innerHTML = "";
        if (!files.length) {
          uploadPreview.innerHTML = '<p class="notes">Выбранные для загрузки изображения и их имена появятся здесь.</p>';
          resizeDialog();
          return;
        }
        files.forEach((file, index) => {
          const row = document.createElement("div");
          row.className = "jml-upload-item";
          const img = document.createElement("img");
          img.alt = file.name;
          img.src = URL.createObjectURL(file);
          img.addEventListener("load", () => URL.revokeObjectURL(img.src), { once: true });
          const fields = document.createElement("div");
          fields.className = "jml-upload-fields";
          const caption = document.createElement("span");
          caption.textContent = file.name;
          caption.className = "jml-upload-original-name";
          const input = document.createElement("input");
          input.type = "text";
          input.className = "jml-upload-name";
          input.dataset.fileIndex = String(index);
          input.value = file.name.replace(/\\.[^.]+$/, "");
          input.setAttribute("aria-label", `Новое имя файла ${file.name}`);
          fields.append(caption, input);
          row.append(img, fields);
          uploadPreview.append(row);
        });
        resizeDialog();
      };

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
        resizeDialog();
      };

      async function ensureImageFolder() {
        let current = "";
        for (const part of imageFolder.split("/")) {
          current = current ? `${current}/${part}` : part;
          try { await FilePicker.createDirectory("data", current); }
          catch (error) { console.debug("Journal Media Links | Каталог уже существует или не создан:", current, error); }
        }
      }

      async function refreshImages() {
        const previous = new Set(Array.from(images.selectedOptions).map(option => option.value));
        try {
          const result = await FilePicker.browse("data", imageFolder);
          const files = (result.files ?? []).filter(path => IMAGE_EXTENSIONS.test(path));
          images.innerHTML = files.sort((a, b) => decodeFileName(a).localeCompare(decodeFileName(b))).map(path =>
            `<option value="${escapeHtml(path)}">${escapeHtml(decodeFileName(path))}</option>`
          ).join("");
          for (const option of images.options) option.selected = previous.has(option.value);
          updateImagePreview();
          if (!files.length) ui.notifications.info("В папке пока нет изображений. Можно загрузить их здесь.");
        } catch (error) {
          console.error("Journal Media Links | Не удалось прочитать папку изображений:", error);
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
          const nameInputs = Array.from(uploadPreview.querySelectorAll(".jml-upload-name"));
          for (const [index, file] of files.entries()) {
            if (!file.type.startsWith("image/")) {
              ui.notifications.warn(`Пропущен не графический файл: ${file.name}`);
              continue;
            }
            const editedBase = (nameInputs[index]?.value ?? file.name.replace(/\\.[^.]+$/, ""))
              .trim().replace(/[<>:"/\\\\|?*\\x00-\\x1F]/g, "_");
            const extension = file.name.match(/\\.[^.]+$/)?.[0] ?? "";
            const safeName = `${editedBase || file.name.replace(/\\.[^.]+$/, "")}${extension}`;
            const renamedFile = new File([file], safeName, { type: file.type, lastModified: file.lastModified });
            await FilePicker.upload("data", imageFolder, renamedFile, {}, { notify: false });
          }
          uploadFiles.value = "";
          renderUploadPreview();
          await refreshImages();
          ui.notifications.info("Загрузка изображений завершена.");
        } catch (error) {
          console.error("Journal Media Links | Ошибка загрузки изображений:", error);
          ui.notifications.error("Не удалось загрузить изображения. Проверь права доступа к папке данных Foundry.");
        } finally {
          uploadButton.disabled = false;
          uploadButton.textContent = "Загрузить выбранные файлы";
        }
      });

      type.addEventListener("change", updateType);
      playlist.addEventListener("change", updateSounds);
      images.addEventListener("change", updateImagePreview);
      uploadFiles.addEventListener("change", renderUploadPreview);
      window.addEventListener("resize", resizeDialog);
      scenePicker.querySelectorAll(".jml-scene-folder").forEach(el => {
        collapsedFolders.add(el.dataset.folderId);
        el.classList.add("collapsed");
        el.setAttribute("aria-expanded", "false");
      });
      updateSceneVisibility();
      const firstSceneOption = scenePicker.querySelector(".jml-scene-option:not(.hidden)");
      if (firstSceneOption) selectSceneOption(firstSceneOption);
      else updateScenePreview();
      updateSounds();
      updateType();
      refreshImages();
      renderUploadPreview();
      resizeDialog();
    }
  }, { width: Math.min(800, Math.max(320, window.innerWidth - 32)), height: "auto", resizable: true });
  dialog.render(true);
}
