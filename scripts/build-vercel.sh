#!/usr/bin/env bash
set -eu

python3 deploy/landing/build.py

mkdir -p runtime-site
cp deploy/landing/dist/index.html \
  deploy/landing/dist/site.css \
  deploy/landing/dist/site.js \
  deploy/landing/dist/robots.txt \
  deploy/landing/dist/404.html \
  deploy/landing/dist/css.css \
  deploy/landing/dist/llms.txt \
  deploy/landing/dist/llms-full.txt \
  runtime-site/
cp deploy/landing/dist/sitemap*.xml runtime-site/ 2>/dev/null || true
cp -R deploy/landing/dist/account \
  deploy/landing/dist/admin \
  deploy/landing/dist/app \
  deploy/landing/dist/assets \
  deploy/landing/dist/contact \
  deploy/landing/dist/dashboard \
  deploy/landing/dist/embed \
  deploy/landing/dist/how-it-works \
  deploy/landing/dist/js \
  deploy/landing/dist/learn \
  deploy/landing/dist/login \
  deploy/landing/dist/ops \
  deploy/landing/dist/pricing \
  deploy/landing/dist/privacy \
  deploy/landing/dist/reset \
  deploy/landing/dist/risk \
  deploy/landing/dist/sitemap \
  deploy/landing/dist/terms \
  runtime-site/
