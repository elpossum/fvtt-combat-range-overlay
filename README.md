# Combat Range Overlay

![Supported Foundry Version](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fversion%3Fstyle%3Dflat%26url%3Dhttps%3A%2F%2Fraw.githubusercontent.com%2Felpossum%2Ffvtt-combat-range-overlay%2Fmaster%2Fmodule.json)
![Github release (latestSemVer)](https://img.shields.io/github/v/release/elpossum/fvtt-combat-range-overlay)
![GitHub release downloads (latest by SemVer and asset)](https://img.shields.io/github/downloads/elpossum/fvtt-combat-range-overlay/latest/module.zip)

## Summary

This module is designed to quickly and efficiently answer questions such as "How far can I move this turn? What enemies can I reach in the fewest actions? How can I best navigate difficult terrain?" I wrote it because I (not to mention the rest of my group) was tired of my pulling out Rulers, Blasts, and other helpers to figure out "Can I do _this_? Hmm, no, but maybe if I do it _this_ way ... nope, that doesn't work either. What about ..."

## Basic Usage

Click <img alt="Button showing two figures with a horizontal double-headed arrow connecting them" src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/98317ccc-85d3-4ed5-b68b-582d75aa9916" height="50">, on the token layer controls, to toggle the Overlay on and off. Once the Overlay is enabled, it should Just Work™ with little to no interaction from you. If you are using a supported system, it should auto-detect the range of your equipped weapons; shift-click the button to change it for your currently selected token. Normally the overlay will reread your position at the end of a move; control-click the button to force the Overlay to reposition. Display preferences are available in the module's Settings page.

## Compatibility

**Maps**: This module now works with square, hex or gridless grids.

**Systems**: My table plays Pathfinder 2E, but it has been tested to some degree on PF1e, DnD3.5e, SWADE, WFRP4e and DnD5e.
It turns out that every system stores its token/actor move speeds in a different spot,
so out of the box speed autodetection will only work with Pathfinder 2e, Pathfinder 1e, DnD3.5e, SWADE, WFRP4e
and DnD5e. If you're playing with a different system, you'll be prompted to set a speed on token control. You can also [set the autodetect path](#advanced-setting-the-speed-attribute-path). Also, I believe other systems
treat diagonals differently, so there's a (GM-only) setting telling the module how to count
diagonal movement.

Weapon range is more complex so the path cannot be manually set for unsupported systems. Pathfinder 2e, Pathfinder 1e, DnD3.5e, SWADE, WFRP4e
and DnD5e are all supported to the best of my knowledge of the systems. If you are using an unsupported system, you will be prompted for weapon range when you try to bring up the overlay.

**Modules**: This module requires lib-wrapper and supports the Enhanced Terrain Layer (not updated for Foundry v11 though may have some functionality) and Terrain Mapper (requires TM >= v0.3.0 to work with PF2E) modules.

## Understanding the Overlay

<img alt="A screenshot of several tokens with the overlay active and numbers corresponding to the following legend." src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/ee2e8018-4bb2-44b8-b9f9-025c44d68342" height="400">

The overlay in this image assumes a movement speed of 15ft/action and a weapon range of 10ft.

1. Tiles tinted blue can be reached in a single action.
2. Tiles tinted yellow can be reached in 2 actions.
3. Enemies circled in white can be attacked without moving.
4. Enemies circled in blue can be attacked in a single move.
5. Enemies circled in yellow can be attacked with 2 moves.
6. Enemies circled in red require 3 or more movements to attack.
7. All tokens (other than the selected token) in combat are annotated with their initiative order relative to the current token.
8. The selected token is annotated with the currently selected weapon range.

<img alt="A close up of the previous screenshot focusing on one player and two enemies. One enemy is now targeted and the squares within both movement and weapon range are highlighted." src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/900a2659-5eca-4ae1-9aa6-3bd8c1d91251" height="400">

If a target is selected, tiles in your movement range _and_ in range of the target will be highlighted in white, and only tiles on the shortest path to the highlighted squares will remain tinted.  
If multiple targets are selected, only tiles in range of _all_ targeted enemies will be highlighted. If there's no way to hit all targeted enemies at once, the Overlay will display a warning and act as if no enemies are targeted.

## Sample Use-cases

The Overlay is useful no matter what kind of character you're playing as:

### Melee

<img alt="Screenshot showing a player and two enemies on a map with a wall" src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/42432cf4-3a9f-4bab-89a5-9bafcce1eddf" height="400">

Suppose you're trying to decide between these two enemies.

<img alt="The previous screenshot now with the possible moves highlighted, using a straight ruler, as well as difficult terrain" src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/9091f840-1cfe-4a12-b45e-4bdc0ad6182e" height="400">

Both enemies are obstructed - one by difficult terrain, one by walls - so a straight ruler won't help you.

<img alt="The same screenshot now using waypoints on the ruler to avoid the wall and difficult terrain" src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/d36ea6ce-cfb0-439a-84d8-7f22e37fd55b" height="400">

You'll need to use waypoints to get the true movement distances.

<img alt="The first screenshot now with the overlay activated. Squares reachable in one action are highlighted blue, those reachable in two actions, yellow" src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/85f19a17-4cfb-4b27-953e-a1ec141b1879" height="400">

Or you can use the Overlay to instantly see how many movement actions it'll take to attack each enemy.

### Archery

<img alt="Screenshot showing a player and a distant enemy" src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/c36dc5d4-e963-4746-a928-3f583eefe4cc" height="400">

You want to attack this enemy, and you'd like to get _just_ close enough to attack him without his being able to close the distance and attack you on his turn.

<img alt="The previous screenshot now with a blast template, placed to show range, and the player moving to the edge of it." src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/bd632616-67da-4122-84f4-5a30c1781f32" height="400">

You drop a Blast on his position and then move to a tile on the very edge of the Blast (of course, working with Blasts takes a lot of control palette switching, clicking, dragging, deleting ... it's kind of a pain).

<img alt="The first screenshot with the overlay active and the enemy targeted, showing all spaces within range bordered in white" src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/030f1763-f837-45cd-99db-70ba71c6030f" height="400">

Or you can use the Overlay to see where you can move to that's inside your attack range and move to the position that's nearest you.

### Magic

<img alt="A screenshot showing a player and two enemies" src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/ec900c22-dcde-4143-9f90-d824d9b252ea" height="400">

You want to cast Electric Arc (a 2 action, 2 target, 30ft range spell) on these two enemies. Where can you hit them both from? Are they close enough for you to hit them both? Can you reach a good spot in only one action so you'll have the two remaining actions to cast the spell?

<img alt="The previous screenshot with a blast template placed on each enemy and the player moving to the overlap" src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/173e5861-afc4-4c0c-a819-de81ad4915ab" height="400">

You could drop _two_ Blasts and then measure your distance to the overlapping tiles (with waypoints, of course - moving straight through that difficult terrain would be too much).

<img alt="The first screenshot now with the overlay active and the enemies targeted. Squares in range of both enemies are bordered in white" src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/17390c4b-a3e3-432e-a21b-1ed8b674c1b0" height="400">

Or you can use the Overlay to see where you can attack them both from and how far away the good spots are.

### Tactician

<img alt="A screenshot of two players and four identical enemies along with the combat tracker" src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/940e8cdb-ff54-4948-885f-670ee27dbfa5" height="400">

You're pretty sure you can kill any of these enemies on your turn, and you'd like to kill one that'll go before your teammate to reduce how many enemies there are to attack him (or you). Unfortunately, while the Combat Tracker shows initiative order it doesn't take positioning into account, and trying to figure out which entry in the Combat Tracker corresponds to combatant tokens can be a pain.

<img alt="The previous screenshot now with the overlay showing the number of actions needed to reach tokens, using colored rings around them, and their place in the turn order" src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/164b6e61-3b75-488e-8689-4a95f41328ea" height="400">

Or you can use the Overlay to see who's close to you _and_ going before your teammate.

## Advanced: Setting the speed attribute path

If you're using an unsupported System, you'll need to set the speed attribute path in
the module settings. Here's how to do it:

1. Select a token
2. Open your browser's dev tools (often F12) and switch to the Javascript console
3. Type in `_token.actor` and press Enter
4. Expand the result, then keep expanding children until you find the movement speed. Take note of each child
   you expand \* For instance, with Pathfinder 2E, you expand `system`, `attributes`, `speed`, and find the speed in `total` <img alt="A screenshot of the console showing expanding children to find the speed location" src="https://github.com/elpossum/fvtt-combat-range-overlay/assets/136785378/dec46190-f2d4-47f8-9b29-e1c9d656ba4f" height="800">
5. Join these names with periods to come up with your attribute path
   - For Pathfinder 2E, this would be `system.attributes.speed.total`
