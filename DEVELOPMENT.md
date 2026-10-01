# Development notes

## Architecture

- `src/core/Game.ts`: lifecycle, UI, versioned saves, fixed physics steps, and subsystem coordination.
- `src/core/Input.ts`: keyboard, pointer lock, drag orbit fallback, click versus drag detection, and zoom.
- `src/world/World.ts`: procedural garden, surfaces, instanced vegetation, shader wind, water, lighting, and atmosphere.
- `src/world/Terrain.ts`: grid traversal for terrain raycasting, preserving the rendered triangle intersections.
- `src/world/FarGarden.ts`: reedwater, hollow trunk, hedge lattice, fern valley, distant trees, connecting routes, and ground cover.
- `src/world/ExpandedGarden.ts`: outer trees, arch, broken pot, paths, flowers, culled grass patches, ground cover, and rocks.
- `src/world/WorldLayout.ts`: shared terrain dimensions, continuous height function, outer landmarks, and save bounds.
- `src/world/Exploration.ts`: fifteen habitats, visit conditions, discoveries, and exploration hints.
- `src/player/Spider.ts`: articulated procedural character.
- `src/player/SurfaceMath.ts`: interpolated vertex normals, correct normal transforms, and tangent frame rotation.
- `src/player/SpiderController.ts`: surface probes, corner traversal, leaping, silk travel, and pose smoothing.
- `src/camera/SpiderCamera.ts`: transported orbit frame, pitch, distance, look sensitivity, anticipation, and collision sweeps.
- `src/web/SilkLauncher.ts`: projectile travel, first contact, range, trailing silk, pending anchor, and span obstruction checks.
- `src/web/WebInteraction.ts`: reachable cutting selection, nearby tolerance, underfoot priority, and occlusion.
- `src/web/WebPath.ts`: shared strand sag and tangent functions used by rendering, picking, insects, and traversal.
- `src/web/WebManager.ts`: graph, connected components, silk rendering, vibration propagation, and serialization.
- `src/creatures/Species.ts`: movement, size, net requirements, and hold duration for eight species.
- `src/creatures/CreatureModel.ts`: shared procedural geometry, distinct animal silhouettes, legs, wings, tails, and animation.
- `src/web/NetAssessment.ts`: physical contact, local connected components, cycles, crossing angles, and capture strength.
- `src/creatures/InsectManager.ts`: flying and ground movement, obstacle steering, capture, support revalidation, bindings, release, and distant sleeping.
- `src/audio/AudioManager.ts`: generated wind, movement, attachment, and vibration sounds.

## Controls and camera

Mouse motion orbits while pointer lock is available. If the browser rejects pointer lock, dragging either mouse button orbits; a left click fires only if the press did not become a drag. The fallback reticle follows the actual cursor. Mouse wheel changes orbit distance, Q recenters, and the pause menu exposes sensitivity. Losing a previously active pointer lock pauses safely.

The orbit frame follows surface orientation through quaternion interpolation, including ceilings. Pitch permits looking up and down. A five-ray camera sweep accounts for lens clearance and is repeated after follow smoothing to prevent interpolation through obstacles. If bark or a mushroom cap compresses the requested orbit below .85 units, the camera tries the clear side of the supporting face before collapsing into the spider. Camera controls do not alter the spider's heading until movement is requested.

## Movement

Physics runs at 120 fixed steps per second, decoupled from rendering. Support probes blend nearby compatible normals, and triangle barycentric interpolation avoids the visible steps of cylinder face normals. Normal transformation supports scaled meshes and the inside of the pipe. Forward contact probes turn onto concave surfaces; probes beyond a lip can wrap convex edges. The controller preserves tangential movement and smooths support height, preventing idle sliding and the old reduction in walking speed. The body orientation interpolates separately. Fall recovery is relative to local terrain height, so jumping in the below-zero wetland does not reset the player.

Tree roots, higher branches, the lantern rock, and the fence form a traversal loop. The 320-unit terrain preserves the original height function in the starting garden and adds gentle outer hills. A fence opening, orchard route, eastern grove, stone arch, pot passage, and meadow give ground and elevated alternatives. Vegetation reaches ±145 units, and player saves accept positions out to ±158 units. The four additional habitats are reedwater (86,73), hollow trunk (-95,-73), berry thicket (101,-81), and fern valley (-95,86). Logs, roots, lattice beams, and permanent reeds provide climbable surfaces and net anchors. Far terrain adds hills and a wetland depression while preserving the original landmarks and starting garden heights. The world is finite, not infinite or streamed. Other paths include the low branch, fallen log, pool bank, seed tray underside, and pipe passage. Narrow gaps can be bridged with silk or crossed with a leap.

## Silk and encounters

Silk launches from the spider at 21 world units/second with a maximum shot range of 12 units. A swept ray over each simulation interval checks the first actual contact; camera aiming does not bypass obstacles between the spider and the target. A missed shot creates no nodes. Two landed shots form a maximum 18-unit span only if the sagged path is clear. The pending anchor keeps a visible loose thread to the spider and is released if the player exceeds its length. R first cuts reachable completed silk within 1.25 units, preferring the ridden strand and then a nearby aimed strand. Without a nearby strand it cancels the shot/loose anchor, or cuts aimed silk. Selection uses the same query for the warm glint and the action, and rays prevent cutting through solid obstacles. Removing a segment cleans orphan nodes and immediately saves the graph.

Silk also collides with other strands. Camera picking provides a modest tolerance and a glint, while the projectile still checks first contact from the spider. An interior attachment becomes a shared graph node when the second anchor lands. Splitting restricts the original sag parabola to each child interval, preserving shape exactly. Riders and caught insects remap to child strands; vibration and outgoing-path selection use the new topology. Capacity, duplicate, and invalid-reference rejection happen before graph mutation. Threads that merely overlap do not automatically knot.

Rendering, nearest-point queries, cutting, insect targets, and player traversal share the same curve. At a junction, camera direction and A/D bias choose the outgoing strand. The spider returns to the surface supporting an endpoint or falls if it has no support. Cutting the strand being ridden detaches the spider. Species remain caught for 18–32 seconds, or until released with E or their net loses its necessary support. Web sense audio and text occur when the spider is near the disturbed network.

F toggles a pull toward the first fired anchor. The controller accelerates to at most 6 units/second, brakes near the anchor, and sweeps five body probes against solids. Surface arrival transports orientation and resumes adhesion; silk arrival attaches to that curve. Intervening obstacles stop the pull, and missing anchors release it. F releases with bounded momentum; Space leaps; firing a second shot releases the pull and continues normal construction. The first anchor remains on arrival. Pull state and loose anchors are temporary and do not change the save format. Losing window focus pauses movement.

Exploration records fifteen actual visited habitats rather than floating items. Progress and encountered insects are shown in the pause menu; discoveries briefly describe the place. No mandatory route is imposed.

## Wildlife and net strength

There are 78 creatures: 54 flying insects and 24 ground visitors, across eight species. Shared mesh geometry supplies flies, patterned moths/butterflies, four-winged dragonflies, iridescent beetles, spiral-shell snails, frogs, and mice. Ground animals follow the height function, orient to its gradient, and steer away from forward solid contacts. Frogs hop visually, mice trot and move their tails, beetles move six legs, snails crawl, and wing speeds differ. Ambient behavior is bounded to each habitat.

`assessNet` measures sagged strands in a species-sized neighborhood. It starts from threads physically touching the body, traverses only connected nearby edges, and checks thread count, independent cycles (E − V + 1), simultaneous body contacts, and a nonparallel crossing angle. Required threads increase from 1 for a fly to 12 for a mouse; loops increase from 0 to 3. Counts in remote components, disconnected crossings, and subdivided straight chains cannot manufacture strength. Collision checks sample movement; inadequate nets vibrate and the creature keeps moving.

Captured wildlife retains its position, struggles with size-dependent vibration, and draws a small bounded binding buffer to existing support threads. These bindings add no graph edges. The patch is revalidated every .18 seconds, and strand splitting remaps references. Weakening the net releases the creature. E release adds a per-species encounter count to the save. Released animals resume wandering with a cooldown, without teleporting or being removed. Looking at wildlife gives a minimal species/requirements hint; failure feedback is rate limited.

## Rendering and performance

PBR materials, procedural surface relief and leaf veins, one shadow casting sun, fill and hemisphere lighting, exponential fog, instanced grass/ferns/foliage, shader wind, and restrained bloom form the garden. Canopy leaves fade with alpha hashing when close to the lens. Stone vertices now use a coordinate-based displacement so duplicate vertices remain connected. A small lantern light adds a recognizable destination.

Terrain rays traverse only crossed cells instead of testing the 204,800 ground triangles. Static collision geometry has bounding boxes. Outer grass is divided into separately culled instanced patches; patches beyond 90 units are hidden, and outer density is reduced. Ground cover is also patched. Geometry and textures are shared. Wildlife beyond 75 units sleeps unless caught, and contact probes run at staggered intervals. The sky and pollen follow the player. The sun shadow volume follows the player, and additional insects wander around the new habitats. Silk uses one dynamic line buffer and a lightweight oscillation/graph pulse model. A cap of 240 strands bounds work. Low quality reduces pixel ratio and turns off bloom and shadows.

## Saves

The existing `spiderweb-garden-v2` localStorage key is retained to migrate existing progress. Format version 5 widens player and web position bounds and adds validated per-species encounter counts. Format version 4 adds preserved sag for subdivided strands and expanded position bounds. Version 3 added surface normal, heading, sensitivity, visited habitats, and encounter count. Version 2, 3, and 4 saves are accepted; surface orientation is inferred from nearby geometry when absent. Web restores validate an entire graph before replacing the current graph. Invalid values, outdated formats, and unavailable storage do not block startup. An in-flight shot, loose anchor, and ambient wildlife positions/capture state are intentionally temporary; the net and recorded encounters persist.

## Verification

`npm test` uses the existing TypeScript compiler and Node's test runner; it adds no dependencies. Regression checks cover travel before impact, first obstruction, range misses, connected shots, obstructed spans, curve agreement, junction choice, terrain ray equivalence, cylinder seams, ground/wall/ceiling transitions, camera rotations, discovery conditions, corrupt saves, restored surface orientation, idle stability, physical strand-to-strand shots, preserved split geometry and riders, connected vibration, capacity atomicity, outer terrain traversal and saves, nearby cut selection and occlusion, deletion persistence, gradual pulling, wall/ceiling arrival, obstruction stopping, missing anchors, leap cancellation, post-pull building, cutting ridden silk, weak versus dense nets, disconnected/subdivided/remote silk rejection, support removal, enlarged bounds, wetland jumping, and the real hollow interior ceiling. GitHub Actions runs these before type checking and building.

The development HUD exposes position, normal, graph, encounters, traversal mode, projectile state, and FPS. Local `?qa=wall`, `?qa=ceiling`, `?qa=insect`, `?qa=ride`, `?qa=stress`, and `?qa=fresh`, `?qa=orchard`, `?qa=arch`, `?qa=meadow`, `?qa=pot`, and `?qa=outer`, `?qa=cut`, and `?qa=pull`, `?qa=marsh`, `?qa=hollow`, `?qa=hedge`, `?qa=fern`, `?qa=weaknet`, and `?qa=strongnet` scenarios exercise the main systems. These routes and the debug HUD are removed from production and use no normal save slot.

## Known limitations and next improvements

- Movement uses a custom adhesion controller, not rigid body physics. Very thin disconnected surfaces and gaps still require a leap.
- Silk uses a visible spring approximation; the loose tether does not simulate wrapping around obstacles. Permanent spans are checked for obstructions.
- Flexible grass and detached canopy leaves are visual foliage rather than permanent silk supports.
- Wildlife uses lightweight steering rather than rigid body physics. Ground species follow terrain and avoid solids; they do not climb arbitrary player surfaces. Frog jumps are visual rather than ballistic.
- Nets use a species threshold and graph/geometry assessment rather than material mass simulation. Captures are temporary; there is no combat or full food economy.
- The puddle uses stylized ripple and color reflection, without real time planar reflection.
- Touch controls and free pendulum swinging are future additions; anchored silk pulling is implemented. Desktop keyboard and mouse remain the target.
- Leg contact animation, further material detail, spatial audio, and richer insect behavior are worthwhile next passes.
