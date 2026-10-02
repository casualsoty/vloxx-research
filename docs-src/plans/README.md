# Shared raid-planner templates

Every `*.json` file in this folder is a template in the planner's **Templates** tab. It is available to everyone who opens the page.
The page is rebuilt by `node scripts/build_docs.js` locally, or by the GitHub Actions workflow on push.

How to add one:
1. Build the plan in the planner.
2. In the Templates tab, click **Download for repo**. Exporting with **Export JSON** also works.
3. Put the `.json` file here. The file name becomes the template id: `#planner=t.<file-name>` opens it directly.
4. Rebuild or push.

The file is validated at build time. An invalid file fails the build and the error names the file, step and object.

Hand-written files may use position references instead of x/y. These are resolved against `data/arena.json`, so they follow the measured geometry:
`"at": "centre" | "entrance" | "spawn:Staff" | "spawn:Spear" | "spawn:Sword" | "cosmic:0".."cosmic:7"`
The reference can be combined with `"atR"` + `"atDeg"` (polar offset) or `"dx"`/`"dy"`.
Lines, arrows and beams take `"from"`/`"to"` with the same references. `"attach": 0..9` attaches a circle or text to player 1..10.
