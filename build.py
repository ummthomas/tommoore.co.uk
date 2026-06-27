#!/usr/bin/env python3
import os
import shutil
from jinja2 import Environment, FileSystemLoader

ROOT = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(ROOT, 'templates')
DIST_DIR = os.path.join(ROOT, 'dist')
RESOURCES_SRC = os.path.join(ROOT, 'resources')
RESOURCES_DST = os.path.join(DIST_DIR, 'resources')

def build():
    os.makedirs(DIST_DIR, exist_ok=True)

    # Sync resources/ into dist/resources/
    if os.path.exists(RESOURCES_DST):
        shutil.rmtree(RESOURCES_DST)
    shutil.copytree(RESOURCES_SRC, RESOURCES_DST)

    # Copy favicon and other standalone files
    for filename in ('favicon.ico', 'installation-deck.html'):
        src = os.path.join(ROOT, filename)
        if os.path.exists(src):
            shutil.copy2(src, DIST_DIR)

    # Copy deck/ directory (linked from installation-deck.html)
    deck_src = os.path.join(ROOT, 'deck')
    deck_dst = os.path.join(DIST_DIR, 'deck')
    if os.path.exists(deck_src):
        if os.path.exists(deck_dst):
            shutil.rmtree(deck_dst)
        shutil.copytree(deck_src, deck_dst)

    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR), autoescape=False)

    built = []
    for name in sorted(os.listdir(TEMPLATES_DIR)):
        if name.startswith('_') or not name.endswith('.html'):
            continue
        template = env.get_template(name)
        output = template.render()
        dest = os.path.join(DIST_DIR, name)
        with open(dest, 'w') as f:
            f.write(output)
        built.append(name)

    print(f'Built {len(built)} pages → dist/')
    for name in built:
        src_lines = sum(1 for _ in open(os.path.join(TEMPLATES_DIR, name)))
        dst_lines = sum(1 for _ in open(os.path.join(DIST_DIR, name)))
        print(f'  {name}: {src_lines} template lines → {dst_lines} output lines')

if __name__ == '__main__':
    build()
