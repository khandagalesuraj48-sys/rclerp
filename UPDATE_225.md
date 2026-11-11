# update-225 – the Advertise Corner on the Dashboard: the Portal's posts (images, videos) shown one after the other (no SQL here) (11-11-2026)

**Asked (11-11-2026):** "Rachana Media & Celebration Hub … Super Admin kadun mi ekach veli anek Posts, Images, Animated Videos ani
Announcements upload karu shaken … he aple advertise corner asel"; "aplela fkt app nahi tr web warti pn haway … length full deu width
kami deu"; "auto play haway fkt sound mute asel but unmute krta yeil ani ya animations mule … app speed kami nako"; "he weg wegle as
watu naye". The posts are set in the Portal (rcl-portal #40: its step 8, `/api/ads`, the console's **Advertise** page). This update
only SHOWS them on Mechanical's Dashboard.

## What changes (App.html – the Dashboard's look only)
1. **A place at the top of the Dashboard** (`#adv`): one rounded card like the page's own. Its size is the post's – Strip (96 px high),
   Banner (180 px), Card (300 px, 360 px wide). A "Full screen" post shows as a Banner on the web. No post = nothing there, as before.
2. **One after the other:** an image stays its seconds; a video plays by itself, **muted**, and the next comes when it ends or its
   seconds are over; ‹ › and the dots when there is more than one; a line at the bottom shows the time left.
3. **Sound:** the 🔇 button on a video turns the sound on (and off). When the browser refuses a video with sound, it starts muted again.
4. **Speed:**
   * asked 1.5 s AFTER the Dashboard is up – never with the Dashboard's own figures; a failed ask shows nothing and says nothing;
   * one image or video in the page at a time (the next is made when its turn comes; the one before is emptied and taken out);
   * a video plays only while the Dashboard is the page seen and the tab is in front; another page or tab: it stops;
   * asked again every 10 minutes (a post's hours begin and end; a file's link works one hour) – the same posts: only the links change;
   * with "reduce motion" on: no fade, no change of height animated.
5. **Where from:** the Portal's `/api/ads` (`live`, platform `web`, this site) with the Portal's own sign-in, on the one address only
   (the same check as the modules' list). The Portal gives only the posts of this site that show now. Not linked to the Portal
   (`?local=1`): nothing is asked.

Nothing else: no server action, no table, no figure, no calculation, no access changed. No new server message (so no new help rule).

## Evidence
* `timeout 300 node --test test/unit.test.js` – all pass (the new test `update-225` among them); the page's script blocks parse.
* The rig, a browser (with the Portal's branch and its step 8 on the rig's Portal database): the Portal's `live` answer for the site
  (a video set as Banner) drawn on the Dashboard – shown, 180 px, playing, muted; the sound button: sound on; another page: paused;
  back: playing; ›: the next post (Strip, 96 px) playing; by itself after its seconds: the first again; no post: the place is hidden;
  no page error.

## Not verified
* **The ask itself on the one address** (`<main>/portal/api/ads` from this page): the rig serves the page and the Portal on two
  addresses, so there the posts were given to the page's own functions by hand. It is the same call as the modules' list
  (`/api/auth` – in use since update-184). Live is the check: the owner's first Active post.
* The live site, Safari, Firefox, a phone's browser.

## Going back
Vercel → Instant Rollback to update-224. Nothing is kept by this update anywhere.
