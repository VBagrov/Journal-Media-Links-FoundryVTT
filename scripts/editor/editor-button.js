import { openLinkDialog } from "./link-dialog.js";

export function registerEditorButton() {
  if (!game.user.isGM) return;

  const addEditorButton = (root) => {
    if (!root) return;
    const menus = [];
    if (root.matches?.("prose-mirror")) {
      const menu = root.querySelector(".editor-menu");
      if (menu) menus.push(menu);
    }
    menus.push(...root.querySelectorAll("prose-mirror .editor-menu"));

    for (const menu of new Set(menus)) {
      if (menu.querySelector(".jml-create-link")) continue;
      const linkButton = menu.querySelector('button[data-action="link"]');
      if (!linkButton) continue;

      const item = document.createElement("li");
      item.className = "text";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "jml-create-link";
      button.title = "Journal Media Links — создать ссылку";
      button.setAttribute("aria-label", "Journal Media Links — создать ссылку");
      button.textContent = "ϟ";
      Object.assign(button.style, { fontSize: "18px", fontWeight: "bold", lineHeight: "1" });
      button.addEventListener("click", () => openLinkDialog(button.closest("prose-mirror")));
      item.appendChild(button);
      linkButton.closest("li")?.after(item);
    }
  };

  const refresh = () => document.querySelectorAll("prose-mirror").forEach(addEditorButton);
  Hooks.on("renderJournalEntryPageSheet", () => requestAnimationFrame(refresh));
  Hooks.on("renderApplication", () => requestAnimationFrame(refresh));

  const observer = new MutationObserver(refresh);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("focusin", (event) => {
    const editor = event.target.closest?.("prose-mirror");
    if (editor) addEditorButton(editor);
  });
  refresh();
}
