# Development notes

## Architecture

- `src/core/Game.ts`: lifecycle, UI, versioned saves, fixed physics steps, and subsystem coordination.
- `src/core/Input.ts`: keyboard, pointer lock, drag orbit fallback, click versus drag detection, and zoom.
- `src/world/World.ts`: procedural garden, surfaces, instanced vegetation, shader wind, water, lighting, and atmosphere.
- `src/world/Terrain.ts`: grid traversal for terrain raycasting, preserving the rendered triangle intersections.
- `src/world/ExpandedGarden.ts`: outer trees, arch, broken pot, paths, flowers, culled grass patches, ground cover, and rocks.
- `src/world/WorldLayout.ts`: shared terrain dimensions, continuous height function, outer landmarks, and save bounds.
- `src/world/Exploration.ts`: eleven habitats, visit conditions, discoveries, and exploration hints.
- `src/player/Spider.ts`: articulated procedural character.
- `src/player/SurfaceMath.ts`: interpolated vertex normals, correct normal transforms, and tangent frame rotation.
- `src/player/SpiderController.ts`: surface probes, corner traversal, leaping, silk travel, and pose smoothing.
- `src/camera/SpiderCamera.ts`: transported orbit frame, pitch, distance, look sensitivity, anticipation, and collision sweeps.
- `src/web/SilkLauncher.ts`: projectile travel, first contact, range, trailing silk, pending anchor, and span obstruction checks.
- `src/web/WebInteraction.ts`: reachable cutting selection, nearby tolerance, underfoot priority, and occlusion.
- `src/web/WebPath.ts`: shared strand sag and tangent functions used by rendering, picking, insects, and traversal.
- `src/web/WebManager.ts`: graph, connected components, silk rendering, vibration propagation, and serialization.
- `src/creatures/InsectManager.ts`: wandering, web contact, temporary entanglement, and close interaction.
- `src/audio/AudioManager.ts`: generated wind, movement, attachment, and vibration sounds.

## Controls and camera

Mouse motion orbits while pointer lock is available. If the browser rejects pointer lock, dragging either mouse button orbits; a left click fires only if the press did not become a drag. The fallback reticle follows the actual cursor. Mouse wheel changes orbit distance, Q recenters, and the pause menu exposes sensitivity. Losing a previously active pointer lock pauses safely.

The orbit frame follows surface orientation through quaternion interpolation, including ceilings. Pitch permits looking up and down. A five-ray camera sweep accounts for lens clearance and is repeated after follow smoothing to prevent interpolation through obstacles. If bark or a mushroom cap compresses the requested orbit below .85 units, the camera tries the clear side of the supporting face before collapsing into the spider. Camera controls do not alter the spider's heading until movement is requested.

## Movement

Physics runs at 120 fixed steps per second, decoupled from rendering. Support probes blend nearby compatible normals, and triangle barycentric interpolation avoids the visible steps of cylinder face normals. Normal transformation supports scaled meshes and the inside of the pipe. Forward contact probes turn onto concave surfaces; probes beyond a lip can wrap convex edges. The controller preserves tangential movement and smooths support height, preventing idle sliding and the old reduction in walking speed. The body orientation interpolates separately.

Tree roots, higher branches, the lantern rock, and the fence form a traversal loop. The 180-unit terrain preserves the original height function in the starting garden and adds gentle outer hills. A fence opening, orchard route, eastern grove, stone arch, pot passage, and meadow give ground and elevated alternatives. Vegetation reaches ±78 units, and player saves accept positions out to ±88 units. The world is finite, not infinite or streamed. Other paths include the low branch, fallen log, pool bank, seed tray underside, and pipe passage. Narrow gaps can be bridged with silk or crossed with a leap.

## Silk and encounters

Silk launches from the spider at 21 world units/second with a maximum shot range of 12 units. A swept ray over each simulation interval checks the first actual contact; camera aiming does not bypass obstacles between the spider and the target. A missed shot creates no nodes. Two landed shots form a maximum 18-unit span only if the sagged path is clear. The pending anchor keeps a visible loose thread to the spider and is released if the player exceeds its length. R first cuts reachable completed silk within 1.25 units, preferring the ridden strand and then a nearby aimed strand. Without a nearby strand it cancels the shot/loose anchor, or cuts aimed silk. Selection uses the same query for the warm glint and the action, and rays prevent cutting through solid obstacles. Removing a segment cleans orphan nodes and immediately saves the graph.

Silk also collides with other strands. Camera picking provides a modest tolerance and a glint, while the projectile still checks first contact from the spider. An interior attachment becomes a shared graph node when the second anchor lands. Splitting restricts the original sag parabola to each child interval, preserving shape exactly. Riders and caught insects remap to child strands; vibration and outgoing-path selection use the new topology. Capacity, duplicate, and invalid-reference rejection happen before graph mutation. Threads that merely overlap do not automatically knot.

Rendering, nearest-point queries, cutting, insect targets, and player traversal share the same curve. At a junction, camera direction and A/D bias choose the outgoing strand. The spider returns to the surface supporting an endpoint or falls if it has no support. Cutting the strand being ridden detaches the spider. Insects remain caught up to 18 seconds and are released by a cut. Web sense audio and text occur when the spider is near the disturbed network.

F toggles a pull toward the first fired anchor. The controller accelerates to at most 6 units/second, brakes near the anchor, and sweeps five body probes against solids. Surface arrival transports orientation and resumes adhesion; silk arrival attaches to that curve. Intervening obstacles stop the pull, and missing anchors release it. F releases with bounded momentum; Space leaps; firing a second shot releases the pull and continues normal construction. The first anchor remains on arrival. Pull state and loose anchors are temporary and do not change the save format. Losing window focus pauses movement.

Exploration records eleven actual visited habitats rather than floating items. Progress and encountered insects are shown in the pause menu; discoveries briefly describe the place. No mandatory route is imposed.

## Rendering and performance

PBR materials, procedural surface relief and leaf veins, one shadow casting sun, fill and hemisphere lighting, exponential fog, instanced grass/ferns/foliage, shader wind, and restrained bloom form the garden. Canopy leaves fade with alpha hashing when close to the lens. Stone vertices now use a coordinate-based displacement so duplicate vertices remain connected. A small lantern light adds a recognizable destination.

Terrain rays traverse only crossed cells instead of testing all 20,000 ground triangles. Static collision geometry has bounding boxes. Outer grass is divided into separately culled instanced patches; geometry and textures are shared. The sun shadow volume follows the player, and additional insects wander around the new habitats. Silk uses one dynamic line buffer and a lightweight oscillation/graph pulse model. A cap of 240 strands bounds work. Low quality reduces pixel ratio and turns off bloom and shadows.

## Saves

The existing `spiderweb-garden-v2` localStorage key is retained to migrate existing progress. Format version 4 adds preserved sag for subdivided strands and expanded position bounds. Version 3 added surface normal, heading, sensitivity, visited habitats, and encounter count. Version 2 and 3 saves are accepted; surface orientation is inferred from nearby geometry when absent. Web restores validate an entire graph before replacing the current graph. Invalid values, outdated formats, and unavailable storage do not block startup. An in-flight shot and loose anchor are intentionally temporary.

## Verification

`npm test` uses the existing TypeScript compiler and Node's test runner; it adds no dependencies. Regression checks cover travel before impact, first obstruction, range misses, connected shots, obstructed spans, curve agreement, junction choice, terrain ray equivalence, cylinder seams, ground/wall/ceiling transitions, camera rotations, discovery conditions, corrupt saves, restored surface orientation, idle stability, physical strand-to-strand shots, preserved split geometry and riders, connected vibration, capacity atomicity, outer terrain traversal and saves, nearby cut selection and occlusion, deletion persistence, gradual pulling, wall/ceiling arrival, obstruction stopping, missing anchors, leap cancellation, post-pull building, and cutting ridden silk. GitHub Actions runs these before type checking and building.

The development HUD exposes position, normal, graph, encounters, traversal mode, projectile state, and FPS. Local `?qa=wall`, `?qa=ceiling`, `?qa=insect`, `?qa=ride`, `?qa=stress`, and `?qa=fresh`, `?qa=orchard`, `?qa=arch`, `?qa=meadow`, `?qa=pot`, and `?qa=outer`, `?qa=cut`, and `?qa=pull` scenarios exercise the main systems. These routes and the debug HUD are removed from production and use no normal save slot.

## Known limitations and next improvements

- Movement uses a custom adhesion controller, not rigid body physics. Very thin disconnected surfaces and gaps still require a leap.
- Silk uses a visible spring approximation; the loose tether does not simulate wrapping around obstacles. Permanent spans are checked for obstructions.
- Flexible grass and detached canopy leaves are visual foliage rather than permanent silk supports.
- Insects have lightweight steering and encounters, without combat or a full food economy.
- The puddle uses stylized ripple and color reflection, without real time planar reflection.
- Touch controls and free pendulum swinging are future additions; anchored silk pulling is implemented. Desktop keyboard and mouse remain the target.
- Leg contact animation, further material detail, spatial audio, and richer insect behavior are worthwhile next passes.
