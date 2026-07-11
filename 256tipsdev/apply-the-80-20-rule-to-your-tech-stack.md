---
layout: tip.vto
title: "Apply the 80/20 Rule to Your Tech Stack"
tip_number: 144
date: 2026-05-17 12:00:00
description: "80% of your work should use tools you trust, 20% should use tools you're learning. The 80% keeps you employable, the 20% keeps you growing."
tags:
- tip
- career
- learning
- tech-stack
- junior-devs
youtube_url: "https://youtube.com/shorts/OMkQS1uy4Ew"
url: /256tipsdev/apply-the-80-20-rule-to-your-tech-stack/
---

"I know Java well, so I should build all my projects in Java." Or: "Choose a new language for every new project!" What's right?

I've done both. And I think that the universal 80/20 rule actually applies here. My rule of thumb now: *80% of your work should use tools you trust, 20% should use tools you're learning.*

The language I know best is Python (yes, I read the second edition of "Fluent Python," and I highly recommend it). So, when I need a reliable, stable (boring!) choice for something that "needs to work," I choose Python and, likely, FastAPI.

But then, if *all* of my projects are Python and FastAPI, how would I grow?

So, for many side projects, I go wild and expose myself to something that teaches me a new paradigm (functional vs OO), a new ecosystem (Node vs PyPI), a new data model (relational vs NoSQL).

Recently, I was rebuilding my personal website. Staying "reliable" would mean Python, so Pelican as a static site generator -- but in this case, that feels like "bad boring == no learning," not "good boring == stable results."

So, I deliberately went for something I'd *never* used before -- Deno (not even Node!) + Lume as the SSG.

A personal site is the kind of project that is "safe" for this kind of choice -- even if things don't go as planned, you still keep the upside ("learning") and the downside is small (easy to rebuild if needed).

The 80% keeps you employable, the 20% keeps you growing.
