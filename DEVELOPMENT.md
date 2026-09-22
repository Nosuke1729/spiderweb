# Development notes

## Architecture

- `src/core/Game.ts`: lifecycle, UI events, saves, rendering, and subsystem coordination.
- `src/core/Input.ts`: keyboard, pointer lock, and cursor fallback.
- `src/world/World.ts`: procedural garden, collidable surfaces, instanced vegetation, shader wind, water, lighting, and atmosphere.
- `src/player/Spider.ts`: articulated procedural character.
- `src/player/SpiderController.ts`: support probes, normal averaging, surface transport, leap, and silk traversal.
- `src/camera/SpiderCamera.ts`: parallel transported view direction, orbit, follow smoothing, and camera collision.
- `src/web/WebManager.ts`: graph nodes and strands, connected components, silk rendering, vibration propagation, and serialization.
- `src/creatures/InsectManager.ts`: lightweight wandering and web contact.
- `src/audio/AudioManager.ts`: synthesized wind, attachment, cut, and vibration sounds.

The garden uses PBR materials, procedural canvas textures, one shadow casting sun, fill and hemisphere light, exponential fog, instancing, a low cost wind vertex deformation, and restrained bloom. Silk is one dynamic line buffer with per vertex color. Each strand has a spring inspired oscillation and a decaying graph pulse. A hard cap of 240 strands bounds work. The low quality setting reduces pixel ratio, turns off bloom, and disables shadows.

## Surface movement

The controller probes forward for a new surface and probes the current support direction from the projected next position. The center probe controls placement; nearby side probes contribute normals and catch narrow edges. Surface changes parallel transport the spider and camera heading, then interpolate the visible orientation. The leap has simple ballistic motion and can stick on contact. This is a custom movement controller, not a rigid body physics engine.

Climbable collision geometry includes terrain, tree trunk and roots, branches, rocks, fence boards and rails, log, a discarded drainage pipe, seed tray and supports, and mushroom stalks and caps. The pipe is a walk-through tunnel. The seed tray's underside is available as a ceiling route from its legs.

## Saves

`localStorage` key: `spiderweb-garden-v2`. The save format is versioned and contains world coordinates for nodes and player position, strand endpoints by node id, quality, and sound preference. Invalid or outdated saves are ignored so the scene can still load. Saves are local to the browser.

## Known limitations and next improvements

- Surface transitions work best when the spider approaches the connecting edge. Tiny disconnected gaps require a leap.
- Silk motion is a lightweight visual spring model, not full cloth simulation.
- Insects have simple steering and temporary entanglement; there is no combat or resource economy.
- Silk is currently anchored in world coordinates. Moving vegetation does not pull existing anchors with it.
- The puddle uses stylized ripples and color reflection, not real time planar reflection.
- There are no touch controls yet. Desktop performance and pointer lock are the main target.
- A future pass can add silk suspension, more insect behaviors, richer close up foliage, spatial audio, and further draw call reduction.

The development build shows a small position, surface normal, graph, pointer, and FPS readout. This is removed from production builds.

For repeatable browser checks, the development server also accepts `?qa=wall`, `?qa=ceiling`, `?qa=insect`, `?qa=ride`, `?qa=stress`, and `?qa=fresh`. These local routes exercise sustained movement, underside traversal, a web catch, connected strand traversal, a 160 strand load, and a clean start. They are excluded from the production build and do not write test state to the normal save slot.
