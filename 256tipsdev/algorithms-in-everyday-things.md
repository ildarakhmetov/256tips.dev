---
layout: tip.vto
title: "Find Algorithms and Data Structures in Everyday Things"
tip_number: 96
date: 2026-05-06 12:00:00
description: "You'll never write Dijkstra at work — but you do need the intuition to spot algorithms and data structures hiding in everyday things, from git history to corn mazes."
tags:
- tip
- algorithms
- data-structures
- junior-devs
youtube_url: "https://youtube.com/shorts/FUChSILK7FU"
url: /256tipsdev/algorithms-in-everyday-things/
---

You will never, ever need to implement basic graph algorithms at your job. And it's fine if you can't code Dijkstra or LCA right now (I'm not sure if I can; please don't tell anyone).

Even before LLMs, why would you need to write Dijkstra from scratch -- it's already done!

But what you need to have is the *intuition* for algorithms and data structures. They'll be hiding in unexpected places, and you need to have a good eye to notice them.

My student shared a story the other day. She took her son to a corn maze near Vancouver. We were learning graphs in class that week, so, while in the maze, she realized that she and her son were actually... using DFS! She then imagined BFS, and laughed at how ridiculous it would be (please pause and imagine BFS in a corn maze, it's *genuinely* funny).

Want a more technical example of an "everyday thing"? Git. Git history is an acyclic graph (type `git log` to see it). Since it's a graph, the graph magic is at your disposal. Merging a pull request? Least-common ancestor problem (your CS2 algorithm, hiding in every pull request merge out there).

As a developer, you're not just the user of Git and other existing systems. You will need to *design* such systems. It will be *your decision* whether to use an acyclic graph. So when you see a problem, you should intuitively see what can be used there.

This intuition comes with experience, and it's not easy to train. But like every muscle, it can be trained -- by constantly dissecting everyday things.

A long, annoying line for Richmond Night Market (where you can pay to skip it)? Priority queue.

Starbucks mobile order pickup shelf? Hash table (and watch for collision if you have a common name!).

Shared kitchen fridge in student housing? Memory allocation and (quite literal) garbage collection.

As an engineer, you should see things differently. Even if sometimes this goes too far (just last week, I found myself chitchatting about linked lists at a party; true story).
