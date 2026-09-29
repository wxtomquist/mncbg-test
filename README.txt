Minnesota Craft Brewers Guild Events - Unified PWA v2.0.8

Production origin:
  https://mncbg.netlify.app/

Structure:
  /           Guild event selector / installed-PWA entry point
  /mbc/      Minnesota Brewers Conference
  /apn/      All Pints North
  /abr/      Autumn Brew Review

Architecture:
- One root manifest, update system, theme preference, and service worker control the entire app.
- MBC, APN, and ABR are fully contained under their own directories.
- No event depends on the former APN or MBC Netlify deployments for application assets or data.
- APN localStorage keys remain apn-v1.
- ABR uses abr-v1 and cannot collide with APN data.
- MBC saved sessions use mbc-favorites-v1.
- Dark mode is the default. The shared sun/moon control stores the user's preference in mncbg-theme.

Compatibility:
- Former APN root routes (apn.html, list.html, guide.html, map.html, sample-list.html, print.html, beverages) redirect into /apn/.
- The MBC application uses the root /sw.js rather than registering a second event-scoped service worker.

v2.0.8 ABR update
-----------------
- Autumn Brew Review is now active on the root Events selector.
- ABR information copy and October 10, 2026 event time are event-specific.
- The cloned All Pints North hero photography was removed; ABR uses an event-neutral autumn treatment until a dedicated hero image is supplied.
- The ABR map uses the new two-page image carousel and downloadable PDF.
- The ABR Festival Guide displays Coming Soon until the 2026 guide is supplied.
- ABR navigation points to the official Autumn Brew Review festival page.
- Privacy & Storage cards were removed from the APN and ABR information pages.
- The existing ABR beverage data/list functionality was intentionally left unchanged for the upcoming beverage-list update.
