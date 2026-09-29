MNCBG Unified PWA — Design Preview
==================================

This package is an alternate visual/UX concept built from the current v2.0.14 production codebase.
It is intended for evaluation on a separate staging URL and is NOT presented as the next production release.

Goals
-----
- Make the Events landing page, Minnesota Brewers Conference, All Pints North, Autumn Brew Review, and Privacy Policy feel like one integrated application.
- Preserve distinct event identities through accent colors rather than separate design languages.
- Standardize typography, card radii, borders, shadows, header behavior, theme controls, buttons, navigation, and mobile spacing.
- Preserve existing functionality and event data.

Event accents
-------------
MBC: teal
APN: warm summer amber
ABR: autumn orange
Guild shell: gold

Recommended review workflow
---------------------------
Deploy this package to a SEPARATE Netlify staging site/domain so it cannot update the live installed PWA.
Test both dark and light modes on desktop and mobile, especially:
- Events landing page
- MBC schedule/tabs/dialogs
- APN and ABR beverage lists/sample lists
- APN and ABR guide/map carousels
- Mobile headers and menus

The latest ABR beverage file and all current ABR guide/map assets from the source v2.0.14 build are retained.
