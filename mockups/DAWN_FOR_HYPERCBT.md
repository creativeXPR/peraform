# Dawn in HyperCBT: handoff from PeraForm

Quality Tools' AI is now called **Dawn**. It's live in PeraForm (commit 84f8774), and HyperCBT's AI windows should match it.

## Decisions (owner-approved)
- **Name:** use "Dawn" inside the apps. In stores and on the site, use "QT Dawn" or "Dawn by Quality Tools" until a trademark check is done, because an app called "Dawn AI" already exists.
- **Logo:** the Sunburst inside a semi-clear ice orb. Dawn is a light, not a character, so give it no face and no gender.
- **Look:** the Dawn style is only for AI windows. Ordinary windows use the shared family style without the glow (see `qt-modals-mockup.html`).

## Files to copy from peraform
- `src/features/ai/DawnOrb.jsx`: the logo as a React SVG, with no dependencies.
- `src/features/ai/dawn.js`: `dawnGreeting(name)`, a time-of-day greeting ("Still up, {name}?" late at night).
- `src/features/ai/AiStudio.jsx`: the shared AI window frame. Its props are documented at the top of the file.
- `src/features/ai/ai.css`: copy the block from `/* ── Dawn: Quality Tools' AI` to the end. It also relies on the older `.ai-create*`, `.ai-ideas`, `.ai-idea`, `.ai-shuffle`, `.ai-prompt`, `.ai-create-options`, `.ai-create-note` and `.ai-create-actions` rules in the same file.
- `src/features/ai/IdeaArt.jsx`: the illustrated idea-card art, which stays as part of the Quality Tools identity.

## What each AI window shows
1. **Header:** the orb and "Dawn · {task}", for example "Create a test" or "Review this test". Under it, a context line such as "Biology mock · 40 questions · saved".
2. **Greeting:** the time-of-day greeting in a sunrise gradient, then the question, for example "What should we create?".
3. **Idea cards:** the illustrated cards with a shuffle button. Hovering sweeps a band of light across a card, and the picked card gets a peach halo.
4. **Input:** a clean field with the sun-gradient "Ask Dawn" button, which has the orb inside it.
5. **While working:** the horizon glow rises, Dawn's colours circle the window's edge, and the orb's rays light up in turn. When the work lands, the glow brightens once.
6. **Reduced motion:** everything holds still.
7. **Copy:** say "Dawn can make mistakes…", not "AI can make mistakes…".

## Mockups (open in a browser)
- `mockups/dawn-ai-window-mockup.html`: the approved AI window.
- `mockups/dawn-ice-logo.html`: the logo. Use the "Ice orb" option with "Semi-clear" turned on.
- `mockups/qt-modals-mockup.html`: the approved style for non-AI windows (Import, Keep, Share, confirms).
