You are running a branding job for a new personal app called **Gollabara (골라바라)**. Use the Open Design MCP tools (mcp__open-design__*). Work autonomously; do not ask questions.

## Brand brief (pass this to Open Design)
- Gollabara is a local web app + PWA that streams the *outputs* of several parallel Claude Code / Open Design sessions — screenshots, generated images, one-line turn recaps, and questions the sessions were going to ask anyway — into one stream. The user keeps it open on a side monitor or phone, watches, and only steps in (stop / reply / @mention) when needed.
- It is an **observer, not a mediator**. It never asks for approval on its own.
- Name: "골라바라" is casual Korean (Gyeongsang flavor) for "go ahead, look and pick" — a market-stall vendor's call. Tagline idea: 「골라 골라, 구경은 공짜」. The wit is a street-market stall applied to a developer tool. Latin wordmark "gollabara"; CLI command `golla`.
- Metaphor to explore: goods flowing past on a stall / a stream flowing by, you watch and pick only what you want.
- Desktop UI: images stream horizontally (column width follows image aspect ratio), chat streams vertically. Light and dark both matter (it lives on a side monitor all day).
- Deliverable: ONE self-contained HTML brand board, 1440px wide, presenting **3 distinct brand directions** side by side or stacked. Each direction: wordmark (Latin + 한글), symbol usable as a 512px PWA app icon and 32px favicon, color palette with light + dark tokens, typography pairing, 3 sample voice lines as stream messages (e.g. a recap, an image arriving, a stop), and a tiny applied mock of the app header. Korean copy must be natural Korean. No left-border accent cards. No serif on numbers.

## Steps
1. mcp__open-design__create_project with id "gollabara-brand", name "Gollabara brand".
2. mcp__open-design__start_run on that project with the brief above as the prompt (you may add the skill "design-consultation" if it helps).
3. Poll mcp__open-design__get_run every ~30s (use Bash `sleep 30` between polls) until the status is terminal. Give up after 25 minutes.
4. When it succeeds, find the entry HTML file with mcp__open-design__list_files, then take a full screenshot with headless Chrome:
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1440,4000 --screenshot=$PWD/brand-board.png "http://127.0.0.1:49263/api/projects/gollabara-brand/raw/<entry file>"
5. Use the Read tool to view brand-board.png and write a 3-line summary of the directions. Print the preview URL and the entry file name at the end.
