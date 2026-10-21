
import { IMAGE_OVERLAY_ID, SOCKET_NAME } from "../constants.js";

const MIN_IMAGE_SCALE = 0.25;
const MAX_IMAGE_SCALE = 5;
const IMAGE_SCALE_STEP = 1.15;
const CANVAS_PADDING = 10;
const IMAGE_GAP = 10;

export function closeImageOverlay() {
  document.getElementById(IMAGE_OVERLAY_ID)?.remove();
}

export function showImageOverlay(paths) {
  closeImageOverlay();

  if (!Array.isArray(paths) || paths.length === 0) return;

  const validPaths = paths.filter(
    (path) => typeof path === "string" && path.trim().length > 0
  );

  if (validPaths.length === 0) return;

  const singleImage = validPaths.length === 1;
  const columns = singleImage
    ? 1
    : Math.min(4, Math.ceil(Math.sqrt(validPaths.length * 1.35)));
  const rows = Math.ceil(validPaths.length / columns);

  const initialWidth = singleImage
    ? Math.min(window.innerWidth * 0.9, Math.max(320, window.innerWidth * 0.62))
    : Math.min(window.innerWidth * 0.92, Math.max(300, columns * 250 + 24));

  const initialHeight = singleImage
    ? Math.min(window.innerHeight * 0.88, Math.max(240, window.innerHeight * 0.78))
    : Math.min(window.innerHeight * 0.9, Math.max(220, rows * 180 + 54));

  const overlay = document.createElement("div");
  overlay.id = IMAGE_OVERLAY_ID;

  Object.assign(overlay.style, {
    position: "fixed",
    left: `${Math.max(4, (window.innerWidth - initialWidth) / 2)}px`,
    top: `${Math.max(4, (window.innerHeight - initialHeight) / 2)}px`,
    width: `${initialWidth}px`,
    height: `${initialHeight}px`,
    minWidth: "280px",
    minHeight: "180px",
    maxWidth: "98vw",
    maxHeight: "95vh",
    zIndex: "100000",
    display: "flex",
    flexDirection: "column",
    background: "#171717",
    color: "#fff",
    border: "1px solid #777",
    borderRadius: "8px",
    boxShadow: "0 8px 32px #000a",
    overflow: "hidden",
    resize: "none",
    boxSizing: "border-box"
  });

  // Заголовок окна.
  const header = document.createElement("div");

  Object.assign(header.style, {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    minHeight: "38px",
    padding: "5px 8px 5px 12px",
    background: "#292929",
    borderBottom: "1px solid #555",
    cursor: "move",
    userSelect: "none",
    touchAction: "none",
    fontWeight: "bold",
    gap: "8px",
    boxSizing: "border-box"
  });

  const title = document.createElement("span");
  title.textContent = `Изображения (${validPaths.length})`;
  title.style.pointerEvents = "none";

  const spacer = document.createElement("span");
  spacer.style.flex = "1";

  const closeLocal = document.createElement("button");
  closeLocal.type = "button";
  closeLocal.textContent = "✕";
  closeLocal.title = "Закрыть только у себя";

  Object.assign(closeLocal.style, {
    flex: "0 0 auto",
    color: "#fff",
    background: "#444",
    border: "1px solid #777",
    borderRadius: "4px",
    padding: "4px 10px",
    cursor: "pointer"
  });

  closeLocal.addEventListener("click", closeImageOverlay);
  header.append(title, spacer, closeLocal);

  // Кнопка глобального закрытия доступна только Мастеру.
  if (game.user.isGM) {
    const closeAll = document.createElement("button");
    closeAll.type = "button";
    closeAll.textContent = "Закрыть у всех";
    closeAll.title = "Завершить показ для всех игроков";

    Object.assign(closeAll.style, {
      flex: "0 0 auto",
      color: "#fff",
      background: "#762e2e",
      border: "1px solid #a55",
      borderRadius: "4px",
      padding: "4px 8px",
      cursor: "pointer"
    });

    closeAll.addEventListener("click", () => {
      closeImageOverlay();

      game.socket.emit(SOCKET_NAME, {
        action: "close",
        userId: game.user.id
      });
    });

    header.appendChild(closeAll);
  }

  // Холст, внутри которого размещаются изображения.
  const canvas = document.createElement("div");

  Object.assign(canvas.style, {
    position: "relative",
    flex: "1 1 auto",
    minWidth: "0",
    minHeight: "0",
    margin: "0",
    padding: "0",
    overflow: "hidden",
    boxSizing: "border-box",
    background: "#171717",
    touchAction: "none"
  });

  const imageItems = [];

  // Удерживаем контейнеры изображений в пределах холста.
  function clampItem(item) {
    const canvasRect = canvas.getBoundingClientRect();
    const itemWidth = item.element.offsetWidth;
    const itemHeight = item.element.offsetHeight;

    // Дополнительная область перемещения за границами холста.
    const EXTRA_BOUNDS = 300;

    const minX = -canvasRect.left - EXTRA_BOUNDS;
    const minY = -canvasRect.top - EXTRA_BOUNDS;

    const maxX =
      window.innerWidth - canvasRect.left - itemWidth + EXTRA_BOUNDS;
    const maxY =
      window.innerHeight - canvasRect.top - itemHeight + EXTRA_BOUNDS;

    item.x = Math.max(minX, Math.min(maxX, item.x));
    item.y = Math.max(minY, Math.min(maxY, item.y));

    item.element.style.left = `${item.x}px`;
    item.element.style.top = `${item.y}px`;
  }

  function clampAllItems() {
    for (const item of imageItems) {
      clampItem(item);
    }
  }

  // Перетаскивание окна за заголовок.
  header.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button") || event.button !== 0) return;

    const rect = overlay.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = rect.left;
    const startTop = rect.top;

    header.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      const maxLeft = Math.max(
        0,
        window.innerWidth - overlay.offsetWidth
      );

      const maxTop = Math.max(
        0,
        window.innerHeight - 40
      );

      overlay.style.left = `${Math.max(
        0,
        Math.min(
          maxLeft,
          startLeft + moveEvent.clientX - startX
        )
      )}px`;

      overlay.style.top = `${Math.max(
        0,
        Math.min(
          maxTop,
          startTop + moveEvent.clientY - startY
        )
      )}px`;
    };

    const stop = () => {
      header.removeEventListener("pointermove", move);
      header.removeEventListener("pointerup", stop);
      header.removeEventListener("pointercancel", stop);
    };

    header.addEventListener("pointermove", move);
    header.addEventListener("pointerup", stop);
    header.addEventListener("pointercancel", stop);
  });

  // Собственная ручка изменения размеров окна.
  const resizeHandle = document.createElement("div");
  resizeHandle.title = "Изменить размер окна";

  Object.assign(resizeHandle.style, {
    position: "absolute",
    right: "0",
    bottom: "0",
    width: "22px",
    height: "22px",
    cursor: "nwse-resize",
    zIndex: "100",
    touchAction: "none",
    background:
      "linear-gradient(135deg, transparent 50%, #aaa 50%, #aaa 58%, transparent 58%, transparent 68%, #aaa 68%, #aaa 76%, transparent 76%)"
  });

  resizeHandle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = overlay.offsetWidth;
    const startHeight = overlay.offsetHeight;

    resizeHandle.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      const maxWidth = Math.max(
        280,
        window.innerWidth * 0.98
      );

      const maxHeight = Math.max(
        180,
        window.innerHeight * 0.95
      );

      const width = Math.max(
        280,
        Math.min(
          maxWidth,
          startWidth + moveEvent.clientX - startX
        )
      );

      const height = Math.max(
        180,
        Math.min(
          maxHeight,
          startHeight + moveEvent.clientY - startY
        )
      );

      overlay.style.width = `${width}px`;
      overlay.style.height = `${height}px`;
    };

    const stop = () => {
      resizeHandle.removeEventListener("pointermove", move);
      resizeHandle.removeEventListener("pointerup", stop);
      resizeHandle.removeEventListener("pointercancel", stop);
    };

    resizeHandle.addEventListener("pointermove", move);
    resizeHandle.addEventListener("pointerup", stop);
    resizeHandle.addEventListener("pointercancel", stop);
  });

  overlay.append(header, canvas, resizeHandle);
  document.body.appendChild(overlay);

  // Начальная сетка изображений.
  const canvasWidth = canvas.clientWidth;
  const canvasHeight = canvas.clientHeight;

  const innerWidth = Math.max(
    1,
    canvasWidth -
      CANVAS_PADDING * 2 -
      IMAGE_GAP * (columns - 1)
  );

  const innerHeight = Math.max(
    1,
    canvasHeight -
      CANVAS_PADDING * 2 -
      IMAGE_GAP * (rows - 1)
  );

  const cellWidth = innerWidth / columns;
  const cellHeight = innerHeight / rows;

  validPaths.forEach((path, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    const itemElement = document.createElement("div");

    const initialX =
      CANVAS_PADDING + column * (cellWidth + IMAGE_GAP);

    const initialY =
      CANVAS_PADDING + row * (cellHeight + IMAGE_GAP);

    Object.assign(itemElement.style, {
      position: "absolute",
      left: `${initialX}px`,
      top: `${initialY}px`,
      width: `${cellWidth}px`,
      height: `${cellHeight}px`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
      boxSizing: "border-box",
      cursor: "grab",
      touchAction: "none",
      userSelect: "none",
      zIndex: "1"
    });

    const image = document.createElement("img");
    image.src = path;
    image.alt = "Изображение из журнала";
    image.draggable = false;

    Object.assign(image.style, {
      display: "block",
      width: "100%",
      height: "100%",
      minWidth: "0",
      minHeight: "0",
      objectFit: "contain",
      objectPosition: "center",
      transform: "scale(1)",
      transformOrigin: "center center",
      pointerEvents: "auto",
      userSelect: "none",
      WebkitUserDrag: "none"
    });

    const item = {
      element: itemElement,
      image,
      x: initialX,
      y: initialY,
      scale: 1,
      dragging: false
    };

    imageItems.push(item);

    image.addEventListener("error", () => {
      image.alt = "Не удалось загрузить изображение";
      console.error(
        "Journal Media Links | Ошибка изображения:",
        path
      );
    });

    // Масштабирование относительно позиции курсора.
    image.addEventListener("wheel", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const oldScale = item.scale;

      const factor = event.deltaY < 0
        ? IMAGE_SCALE_STEP
        : 1 / IMAGE_SCALE_STEP;

      const newScale = Math.max(
        MIN_IMAGE_SCALE,
        Math.min(MAX_IMAGE_SCALE, oldScale * factor)
      );

      if (newScale === oldScale) return;

      const rect = image.getBoundingClientRect();

      const cursorX =
        event.clientX - (rect.left + rect.width / 2);

      const cursorY =
        event.clientY - (rect.top + rect.height / 2);

      const ratio = newScale / oldScale;

      item.x -= cursorX * (ratio - 1);
      item.y -= cursorY * (ratio - 1);

      item.scale = newScale;
      image.style.transform = `scale(${newScale})`;

      clampItem(item);
    }, { passive: false });

    // Двойной щелчок сбрасывает масштаб и положение.
    image.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();

      item.scale = 1;
      image.style.transform = "scale(1)";

      item.x = initialX;
      item.y = initialY;

      clampItem(item);
    });

    // Перетаскивание изображения по холсту.
    itemElement.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      item.dragging = true;
      itemElement.style.cursor = "grabbing";

      const highestZ = Math.max(
        1,
        ...imageItems.map(
          (entry) => Number(entry.element.style.zIndex) || 1
        )
      );

      itemElement.style.zIndex = String(highestZ + 1);

      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = item.x;
      const startTop = item.y;

      itemElement.setPointerCapture(event.pointerId);

      const move = (moveEvent) => {
        if (!item.dragging) return;

        item.x =
          startLeft + moveEvent.clientX - startX;

        item.y =
          startTop + moveEvent.clientY - startY;

        clampItem(item);
      };

      const stop = () => {
        item.dragging = false;
        itemElement.style.cursor = "grab";

        itemElement.removeEventListener("pointermove", move);
        itemElement.removeEventListener("pointerup", stop);
        itemElement.removeEventListener("pointercancel", stop);
      };

      itemElement.addEventListener("pointermove", move);
      itemElement.addEventListener("pointerup", stop);
      itemElement.addEventListener("pointercancel", stop);
    });

    itemElement.appendChild(image);
    canvas.appendChild(itemElement);
  });

  // Пересчёт ограничений при изменении размеров холста.
  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(() => {
      clampAllItems();
    });

    resizeObserver.observe(canvas);

    // Отключаем наблюдатель после удаления окна.
    const removalObserver = new MutationObserver(() => {
      if (!overlay.isConnected) {
        resizeObserver.disconnect();
        removalObserver.disconnect();
      }
    });

    removalObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

export function showImagesForEveryone(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return;

  // Открываем окно локально у пользователя.
  showImageOverlay(paths);

  // Глобальный показ инициирует только Мастер.
  if (game.user.isGM) {
    game.socket.emit(SOCKET_NAME, {
      action: "show",
      paths,
      userId: game.user.id
    });
  }
}

export function registerImageSocketHandlers() {
  game.socket.on(SOCKET_NAME, (data) => {
    if (!data || typeof data !== "object") return;

    const sender = game.users.get(data.userId);
    if (!sender?.isGM) return;

    if (
      data.action === "show" &&
      Array.isArray(data.paths) &&
      data.paths.length > 0
    ) {
      showImageOverlay(data.paths);

      console.log(
        "Journal Media Links | Получена команда показа изображений"
      );
    } else if (data.action === "close") {
      closeImageOverlay();
    }
  });
}
