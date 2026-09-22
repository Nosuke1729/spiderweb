# Spiderweb

A browser based 3D exploration game about a small spider in an overgrown garden. Climb the tree and fence, move under the seed tray, and build your own routes by attaching silk to surfaces. Strands form a connected network that carries vibrations when insects touch it.

The entire game is static. It runs in the browser with WebGL and stores progress locally. No server, account, or Node.js runtime is needed after build.

## Play

The published game is intended for `https://Nosuke1729.github.io/spiderweb/`. Desktop keyboard and mouse are required for gameplay. Mobile visitors see a support notice.

| Control | Action |
| --- | --- |
| WASD | Move relative to the camera |
| Mouse | Look around after entering the garden |
| Shift | Scurry |
| Space | Leap from a surface or strand |
| Left click | Place the first silk anchor, then place its second endpoint |
| Right mouse | Aim closer; drag to orbit if pointer lock is unavailable |
| E | Climb onto nearby silk or investigate a caught insect |
| R | Cut the aimed strand or cancel the loose anchor |
| Escape | Pause |

Aim at any solid world surface and click, then aim elsewhere and click again. Click near an existing node to add another connected strand. Silk can bridge terrain, wood, stone, flowers, leaves, and grass. Approach a strand and press **E** to travel along it. When an insect catches, connected silk shivers and brightens.

## Develop

```sh
npm install
npm run dev
```

Vite serves the game at `http://localhost:5173/spiderweb/`. Other commands:

```sh
npm run typecheck
npm run build
npm run preview
```

The build output is `dist/`. Vite's base path is `/spiderweb/`, including in local preview.

## Deploy to GitHub Pages

The [deployment workflow](.github/workflows/deploy.yml) runs on pushes to `main` and can also be started manually. It installs the lockfile dependencies, checks TypeScript, builds, and publishes `dist/` with GitHub Pages Actions. In repository Settings → Pages, select **GitHub Actions** as the build and deployment source. The workflow needs the standard `pages: write` and `id-token: write` permissions supplied in the YAML.

Once the workflow succeeds, load and refresh `https://Nosuke1729.github.io/spiderweb/` to verify the site and its assets.

## Assets and progress

The world, spider, insects, textures, ambient audio, and effects are procedural. See [ASSETS.md](ASSETS.md). Position, webs, and quality and sound settings save to browser localStorage. See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture and current limitations.
