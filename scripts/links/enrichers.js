export function registerTextEnrichers() {
  const enrichers = [...(CONFIG.TextEditor.enrichers ?? [])];

  const definitions = [
    {
      pattern: /@PlayTrack\[([^\]]+)\](?:\{([^}]+)\})?/g,
      className: "journal-track-link",
      dataAttribute: "trackUuid",
      fallback: "▶ Включить музыку"
    },
    {
      pattern: /@ActivateScene\[([^\]]+)\](?:\{([^}]+)\})?/g,
      className: "journal-scene-link",
      dataAttribute: "sceneUuid",
      fallback: "Открыть сцену"
    },
    {
      pattern: /@ShowImages\[([^\]]+)\](?:\{([^}]+)\})?/g,
      className: "journal-images-link",
      dataAttribute: "imagePaths",
      fallback: "Показать изображения"
    }
  ];

  for (const definition of definitions) {
    enrichers.push({
      pattern: definition.pattern,
      enricher: async (match) => {
        const link = document.createElement("a");
        link.classList.add(definition.className);
        link.dataset[definition.dataAttribute] = match[1].trim();
        link.textContent = match[2] || definition.fallback;
        link.setAttribute("role", "button");
        return link;
      }
    });
  }

  CONFIG.TextEditor.enrichers = enrichers;
}
