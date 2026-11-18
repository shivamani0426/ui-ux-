# Frontline UX/UI — Editable Figma handoff plugin

This is a companion **development plugin**, not a hosted OAuth integration.
It creates new editable Figma frames, text layers, swatches and approved
design-decision cards in the *current* Figma file. No network access is allowed
by the plugin manifest. It does not clone external sites or recreate a complete
working application.

## Setup in Figma Desktop

1. Create a new Figma development plugin using the Figma UI. Figma assigns a
   unique numeric plugin ID in its generated manifest; **do not use the
   placeholder ID in manifest.example.json**.
2. Copy `code.js` and `ui.html` from this folder into your plugin folder.
   Set your Figma-generated manifest's `main` to `code.js`, `ui` to
   `ui.html`, `documentAccess` to `dynamic-page`, `editorType` to
   `["figma"]`, and `networkAccess.allowedDomains` to `["none"]`.
   Retain your assigned plugin ID. This requires no credentials or domain.
3. In Frontline, open a saved project → Design board → move approved cards to
   Approved → Save → Design handoff → Download JSON.
4. In the desired Figma file, run your development plugin. Select that JSON
   and click **Import editable design**.
5. Review imported elements; refine layout, responsive constraints, typography
   and accessible contrast in Figma. The imported frames are **not** verified
   production-ready components.

## Safety and limits

- Imports only the versioned `frontline-design-handoff` JSON shape.
- Maximum 24 approved cards and 3 visual directions.
- Creates new nodes only, without deleting or changing existing user layers.
- Ignores chats, feedback, credentials, and historical checkpoints.
- No remote requests, tracking, or external image downloads.
- Figma itself stores the imported text in the chosen Figma document.
- Figma Desktop/SDK interaction needs manual acceptance testing before
  considering the integration publicly published.

Official setup: https://developers.figma.com/docs/plugins/plugin-quickstart-guide/
