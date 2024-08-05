# Changelog

## 4.7.0 - 2024/08/05

### Added

- Add functionality for hexagonal and gridless scenes
- Draw walls only if visible

### Fixed

- Fix overlay not updating if token vision is enabled or disabled
- Fix overlay not updating in certain circumstances

## 4.6.1 - 2024/07/18

### Fixed

- Fallback to no masking if vision not enabled
- Fix some Foundry v10 errors
- Fix masking breaking if Terrain Mapper not active or Foundry older than v12 (Polygon area methods not present)
- Fix overlay not updating on terrain change if Terrain Mapper older than v0.3.0
- Fix visibility on diagonals

### Added

- Add setting to determine supported actor types. This prevents error notifications on things like loot actors
- Add color picker implementation so no longer needs external modules for this
- Localize more text

## 4.6.0 - 2024/07/03

### Fixed

- Fix minor bugs

### Added

- Add vision masking options

## 4.5.0 - 2024/07/01

### Fixed

- Fix changing weapons not refreshing the overlay

### Added

- Make token visibility be respected

## 4.4.0 - 2024/06/30

### Fixed

- Fix some minor bugs

### Added

- Add compatibility for Terrain Mapper > v0.2.0

## 4.3.2 - 2024/06/23

### Fixed

- Stop-gap fix for when using Terrain Mapper > v0.2.0. Not compatible yet (won't use terrain data) but won't break.
- Prevent overlay attempting to draw when not initialized

### Changes

- Update overlay at start as well as end of turn to account for off turn movement

## 4.3.1 - 2024/06/19

### Fixed

- Fix error if token deleted while in combat
- Optimize some async code
- Fix some conflict with other keybinds

## 4.3.0 - 2024/06/16

### Fixed

- Prevent overlay stacking by checking if an overlay is already being drawn before starting to draw another closes [elpossum/fvtt-combat-range-overlay#9](https://github.com/elpossum/fvtt-combat-range-overlay/issues/9)

### Added

- Add an initialized property (`combatRangeOverlay.initialized`) and hook (`combat-range-overlay.ready`) that triggers when the module is ready

## 4.2.1 - 2024/06/11

### Fixed

- Re-enable Terrain Mapper compatibility in Foundry v12

## 4.2.0 - 2024/06/01

### Added

- Add Foundry v12 compatibility
- Add another color picker

### Changed

- Allow colors to be changed without a picker
- Change keyboard listeners to be handled by Foundry
- Block Terrain Mapper on v12 as not yet compatible

### Fixed

- Allow overlay to show only if a single token is controlled
- Fix overlay not showing if multiple tokens targeted

## 4.1.1 - 2024/03/14

### Added

- Add setting so the overlay only shows if the controlled token is the active combatant

### Fixed

- Fix incorrect default colors

## 4.1.0 - 2024/01/30

### Changed

- Update for Terrain Mapper v0.1.2

## 4.0.1 - 2024/01/04

### Fixed

- Fix all terrains being considered impassable

## 4.0.0 - 2023/12/05

### Added

- Add compatibility for Terrain Mapper (GM only at the moment), closes [elpossum/fvtt-combat-range-overlay#7](https://github.com/elpossum/fvtt-combat-range-overlay/issues/7)

### Changed

- **Breaking** Make drawCosts() and calculateMovementCosts() async

### Fixed

- Fix overlays staying rendered, closes [elpossum/fvtt-combat-range-overlay#8](https://github.com/elpossum/fvtt-combat-range-overlay/issues/8)

## 3.0.0 - 2023/11/16

### Added

- Add compatibility for Pathfinder 1e, DnD3.5e, SWADE, WFRP4e and DnD5e
- Add speed and range prompt for unsupported systems
- Add grid scale autodetection

### Changed

- **Breaking** Make getWeaponRangeColor() async

## 2.4.5 - 2023/09/11

### Fixed

- Fix range for ranged weapons

## 2.4.4 - 2023/07/01

### Fixed

- Fix colorsettings notification

## 2.4.3 - 2023/07/01

### Fixed

- Fix v10 backwards compatibility

## 2.4.2 - 2023/06/28

### Fixed

- Fix typos preventing function

## 2.4.1 - 2023/06/27

### Added

- Add v11 compatibility
- Add notification if color settings module not present

## 2.4.0 - 2023/06/27

### Added

- Add colour picker
- Add setting for max actions shown

### Fixed

- Fix range setting dialog

## 2.3.0 - 2023/06/26

### Added

- Make weapons show in different colours when targeting

## 2.2.3 - 2023/06/20

### Added

- Add changelog

## 2.2.2 - 2023/06/19

### Fixed

- Fix typo preventing position toggle setting from working

## 2.2.1 - 2023/06/19

### Fixed

- Fix localization typos
- Fix position toggle setting

## 2.2.0 - 2023/06/19

### Added

- Add setting to toggle if position is updated during combat

## 2.1.0 - 2023/06/18

### Fixed

- Make keybindings do something

## 2.0.0 - 2023/06/18

### Added

- Add configurable hotkeys

### Fixed

- Prevent hotkey from causing overlay to lag when held

### Removed

- **Breaking** Remove old keyboard listener

## 1.0.0 - 2023/06/16

_Initial release._

### Fixed

- **Breaking** Add Foundry v10 combatibility
