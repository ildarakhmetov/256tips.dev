---
layout: tip.vto
title: "Buy Junk from Facebook Marketplace"
tip_number: 128
date: 2026-04-20 12:00:00
description: "The best way to understand how infrastructure works is to actually set it up physically, at home — on old machines you tinker with."
tags:
- tip
- infrastructure
- hardware
- junior-devs
youtube_url: "https://youtube.com/shorts/w0knYlDo9n8"
url: /256tipsdev/buy-junk-from-facebook-marketplace/
---

Or Craigslist, Kijiji, your local thrift shop, or a garage sale. Can even be a dusty box in your own basement!

And of course I don't mean any junk. I mean old computers to tinker with.

Here is my point here: NOT everything can de deployed on Railway or Vercel with a single CLI command. Toy apps and MVPs certainly can, and should. For anything more serious, there must be serious infrastructure. And the best way to understand how infrastructure works is to actually set it up physically, at home.

Just recently, I took an old laptop that was collecting dust for years and installed NetBSD on it. Even connecting to wifi required a steep learning curve. Then, making the connection persistent. Setting up DNS, DHCP, SSH, maybe SMB to have a home file server, or Nginx to serve something over HTTP.

And you don't need to stop with one machine. What if you have multiple machines and try setting up NFS?

Or even something more complex. How about implementing a distributed file storage system, compatible with S3? Surprisingly, it's not that hard, and to make it more fun, you can have a mix of different operating systems -- think Linux, NetBSD, FreeBSD and maybe more if you feel adventurous.

Doing this with your own hardware makes it real, and playing with "hardware junk" not just makes it cheap -- it adds a layer of friction that you'll never get with a fleet of predictable EC2 instances.
