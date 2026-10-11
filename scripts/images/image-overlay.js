import { IMAGE_OVERLAY_ID, MODULE_ID, SOCKET_NAME } from "../constants.js";

export function closeImageOverlay() {
  document.getElementById(IMAGE_OVERLAY_ID)?.remove();
}

export function showImageOverlay(paths) {
  closeImageOverlay();
  if (!Array.isArray(paths) || paths.length === 0) return;

  const overlay = document.createElement("div");
  overlay.id = IMAGE_OVERLAY_ID;
  Object.assign(overlay.style, {
    position: "fixed", left: "10%", top: "10%", width: "80vw", height: "75vh",
    minWidth: "280px", minHeight: "220px", maxWidth: "98vw", maxHeight: "95vh",
    zIndex: "100000", display: "flex", flexDirection: "column", background: "#171717",
    color: "#fff", border: "1px solid #777", borderRadius: "8px", boxShadow: "0 8px 32px #000a",
    overflow: "hidden", resize: "both", boxSizing: "border-box"
  });

  const header = document.createElement("div");
  header.textContent = `Изображения (${paths.length})`;
  Object.assign(header.style, {
    flex: "0 0 auto", display: "flex", alignItems: "center", minHeight: "38px",
    padding: "5px 8px 5px 12px", background: "#292929", borderBottom: "1px solid #555",
    cursor: "move", userSelect: "none", touchAction: "none", fontWeight: "bold", gap: "8px"
  });

  const spacer = document.createElement("span");
  spacer.style.flex = "1";

  const closeLocal = document.createElement("button");
  closeLocal.type = "button";
  closeLocal.textContent = "✕";
  closeLocal.title = "Закрыть только у себя";
  Object.assign(closeLocal.style, {
    flex: "0 0 auto", color: "#fff", background: "#444", border: "1px solid #777",
    borderRadius: "4px", padding: "4px 10px", cursor: "pointer"
  });
  closeLocal.addEventListener("click", closeImageOverlay);
  header.append(spacer, closeLocal);

  if (game.user.isGM) {
    const closeAll = document.createElement("button");
    closeAll.type = "button";
    closeAll.textContent = "Закрыть у всех";
    closeAll.title = "Завершить показ для всех игроков";
    Object.assign(closeAll.style, {
      flex: "0 0 auto", color: "#fff", background: "#762e2e", border: "1px solid #a55",
      borderRadius: "4px", padding: "4px 8px", cursor: "pointer"
    });
    closeAll.addEventListener("click", () => {
      closeImageOverlay();
      game.socket.emit(SOCKET_NAME, { action: "close", userId: game.user.id });
    });
    header.appendChild(closeAll);
  }

  const grid = document.createElement("div");
  Object.assign(grid.style, {
    flex: "1 1 auto", minWidth: "0", minHeight: "0", padding: "10px", display: "grid",
    gridTemplateColumns: paths.length === 1 ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gridTemplateRows: paths.length <= 2 ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(0, 1fr))",
    gap: "10px", overflow: "auto", boxSizing: "border-box"
  });

  for (const path of paths) {
    const cell = document.createElement("div");
    Object.assign(cell.style, {
      minWidth: "0", minHeight: "0", display: "flex", alignItems: "center",
      justifyContent: "center", overflow: "hidden"
    });

    const image = document.createElement("img");
    image.src = path;
    image.alt = "Изображение из журнала";
    image.draggable = false;
    Object.assign(image.style, {
      display: "block", width: "100%", height: "100%", minWidth: "0", minHeight: "0",
      objectFit: "contain", objectPosition: "center"
    });
    image.addEventListener("error", () => {
      image.alt = "Не удалось загрузить изображение";
      console.error("Journal Track Links | Ошибка изображения:", path);
    });
    cell.appendChild(image);
    grid.appendChild(cell);
  }

  header.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button") || event.button !== 0) return;
    const rect = overlay.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = rect.left;
    const startTop = rect.top;
    header.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      overlay.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, startLeft + moveEvent.clientX - startX))}px`;
      overlay.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, startTop + moveEvent.clientY - startY))}px`;
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

  overlay.append(header, grid);
  document.body.appendChild(overlay);
}

export function showImagesForEveryone(paths) {
  if (!game.user.isGM) {
    ui.notifications.warn("Показывать изображения может только Мастер.");
    return;
  }
  showImageOverlay(paths);
  game.socket.emit(SOCKET_NAME, { action: "show", paths, userId: game.user.id });
}

export function registerImageSocketHandlers() {
  game.socket.on(SOCKET_NAME, (data) => {
    if (!data || typeof data !== "object") return;
    const sender = game.users.get(data.userId);
    if (!sender?.isGM) return;

    if (data.action === "show" && Array.isArray(data.paths) && data.paths.length > 0) {
      showImageOverlay(data.paths);
      console.log("Journal Track Links | Получена команда показа изображений");
    } else if (data.action === "close") {
      closeImageOverlay();
    }
  });
}
