# Spiderweb

A browser based 3D exploration game about a small spider in an overgrown garden. Climb the tree and fence, move under the seed tray, and build your own routes by attaching silk to surfaces. Strands form a connected network that carries vibrations when insects touch it.

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
| E | Climb onto nearby silk or investigate a caught insect |
| R | Cut the aimed strand or cancel the loose anchor |
| Escape | Pause |

Aim at a solid surface and click to fire silk. The projectile travels from the spider, lands on the first surface it meets, and has a limited range. Then fire at another surface to complete the strand. A span crossing wood, stone, or terrain is rejected. Moving grass and loose canopy leaves cannot hold a permanent anchor. Click near an existing node to extend the network.

Approach silk and press **E** to climb onto it. W/S travel along its actual sagging curve; look toward the outgoing branch at a junction, or bias the choice with A/D. Space leaps off. Follow a vibration to a caught insect and press E when close. Discover six habitats by reaching the roots, canopy, fence, pipe passage, rain pool, and lantern. Discoveries and web encounters are recorded quietly in the pause menu.

Use Escape for the pause menu and the look sensitivity slider. The garden retains its minimal HUD. A brief hint explains drag controls whenever pointer lock is unavailable.

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
