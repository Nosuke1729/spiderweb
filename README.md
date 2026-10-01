# Spiderweb

A browser based 3D exploration game about a small spider in an overgrown garden. Climb trees and the fence, move under the seed tray, explore the orchard and meadow, and build your own routes by joining silk to surfaces and other threads. Wander among flying insects, jewel beetles, snails, frogs, and wood mice. Strands form a connected network that carries vibrations when insects touch it.

The entire game is static. It runs in the browser with WebGL and stores progress locally. No server, account, or Node.js runtime is needed after build.

## Play

Play at [nosuke1729.github.io/spiderweb](https://nosuke1729.github.io/spiderweb/). Desktop keyboard and mouse are required for gameplay. Mobile visitors see a support notice.

| Control | Action |
| --- | --- |
| WASD | Move relative to the camera |
| Mouse | Look around after entering the garden; drag either mouse button if pointer lock is unavailable |
| Mouse wheel | Zoom in or out |
| Q | Center the view behind the spider |
| Shift | Scurry |
| Space | Leap from a surface or strand |
| Left click | Fire silk from the spider; two successful shots create a strand |
| Right mouse | Aim closer; drag to orbit if pointer lock is unavailable |
| E | Climb onto nearby silk or release a caught creature |
| F | Pull toward the fired anchor; press again to release |
| R | Cut nearby silk (warm highlight), or release loose silk if no strand is nearby |
| Escape | Pause |

Aim at a solid surface and click to fire silk. The projectile travels from the spider, lands on the first surface it meets, and has a limited range. Then fire at another surface to complete the strand. A span crossing wood, stone, or terrain is rejected. Moving grass and loose canopy leaves cannot hold a permanent anchor. Aim at any part of an existing thread: a small glint and **CLICK · JOIN THIS THREAD** show the attachment point. Fire there, then at another thread or surface. The original threads split at real graph junctions, allowing a frame, spokes, and cross-links to grow into your own web. Connected junctions carry vibrations and let the spider change paths. Merely overlapping threads are not automatically glued; fire at a thread to join it.

After your first shot attaches, press **F** to pull yourself toward that anchor. F again releases the pull; Space interrupts it with a leap. Wood and stone block your body. Arrival keeps the anchor and loose thread, so clicking another surface or thread still completes a permanent strand. Click during a pull to stop reeling and fire the second endpoint. Approach a completed strand and press **R** to cut it without carefully aiming: the selected strand glows warm gold. The thread underfoot has priority; among nearby threads, aiming chooses one, otherwise the closest reachable thread is selected. Walls shield threads. Cutting is saved immediately. If no completed strand is nearby, R releases the loose anchor first, or cuts an aimed completed strand when no loose silk remains.

Approach silk and press **E** to climb onto it. W/S travel along its actual sagging curve; look toward the outgoing branch at a junction, or bias the choice with A/D. Space leaps off. Follow a vibration to a caught creature and press E when close to release it. Discover fifteen habitats: the roots, canopy, fence, pipe passage, rain pool, lantern, orchard, stone arch, wildflower meadow, clay refuge, eastern grove, reedwater, hollow trunk, berry thicket, and fern valley. The terrain is 320 × 320 world units, about 3.16 times the previous area; vegetation and landmarks extend across roughly 290 × 290 units. Walk through the opening in the old fence, around either end, or over its ridge. Paths, roots, and fallen limbs create multiple routes; bridge gaps with your own silk. Discoveries and web encounters are recorded quietly in the pause menu.

Use Escape for the pause menu and the look sensitivity slider. The garden retains its minimal HUD. A brief hint explains drag controls whenever pointer lock is unavailable.

## Build nets for wildlife

A single line catches a small fly. Larger visitors need a **dense, connected local net**, with crossed strands and closed loops. Fire at existing threads to join them: overlapping disconnected silk does not count. Begin with a frame, then add cross-links to divide it into smaller cells across an animal's route. The animal must physically touch multiple threads; extra silk on the other side of the garden gives no strength here.

| Visitor | Local connected strands | Closed loops |
| --- | ---: | ---: |
| Garden fly | 1 | 0 |
| Amber moth | 3 | 1 |
| Butterfly / jewel beetle | 4 | 1 |
| Dragonfly / snail | 6 | 2 |
| Reed frog | 8 | 2 |
| Wood mouse | 12 | 3 |

Look at a creature for a quiet hint about the net it needs. An inadequate net vibrates as the creature slips through. A strong one holds the animal temporarily with visible silk bindings; removing enough supporting threads lets it escape. Approach and press **E** to release it and record the encounter in the pause menu. Each species has its own gait or wing motion. Some live near the starting garden, and others gather in the new habitats. Faraway wildlife and grass patches sleep or disappear into the fog to keep the larger world affordable.

## Develop

```sh
npm install
npm run dev
```

Vite serves the game at `http://localhost:5173/spiderweb/`. Other commands:

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

The build output is `dist/`. Vite's base path is `/spiderweb/`, including in local preview.

## Deploy to GitHub Pages

The [deployment workflow](.github/workflows/deploy.yml) runs on pushes to `main` and can also be started manually. It installs the lockfile dependencies, runs the gameplay regression tests, checks TypeScript, builds, and publishes `dist/` with GitHub Pages Actions. In repository Settings → Pages, select **GitHub Actions** as the build and deployment source. The workflow needs the standard `pages: write` and `id-token: write` permissions supplied in the YAML.

Once the workflow succeeds, load and refresh `https://Nosuke1729.github.io/spiderweb/` to verify the site and its assets.

## Assets and progress

The world, spider, insects, textures, ambient audio, and effects are procedural. See [ASSETS.md](ASSETS.md). Position and surface orientation, webs, discoveries, encounters, and camera, quality, and sound settings save to browser localStorage. See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture and current limitations.
