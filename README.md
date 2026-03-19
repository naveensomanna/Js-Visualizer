# JS Visualizer

> Understand how JavaScript really works — one concept at a time.

Most developers use JavaScript daily but never see what happens 
under the hood. JS Visualizer makes the invisible visible.

## What it does

Type any JavaScript code and instantly see:

- **Tokens** — how the lexer breaks your code into meaningful chunks
- **AST** — the syntax tree your code becomes before execution
- **Scope Chain** — how JavaScript resolves variable lookups
- **Hoisting** — what V8 does to your code before running it
- **TDZ** — exactly which lines would throw a ReferenceError and why
- **Closures** — which variables are captured and from where
- **Call Stack** — how function calls stack up during execution

## Why I built this

Learning JavaScript internals is hard. Tools like astexplorer.net 
show raw JSON that overwhelms beginners. Nothing showed the full 
pipeline — lexer to scope — in one visual, learner-friendly place.

This is the tool I wished existed when I was learning.

## Live Demo

https://js-visualizer-blush.vercel.app

## Tech Stack

- React + Vite + TypeScript
- @babel/parser + @babel/traverse
- Monaco Editor
- Tailwind CSS

## Inspired by

- astexplorer.net — AST only, raw JSON
- pythontutor.com — same concept, for Python
- Tyler McGinnis's JS Visualizer — old, unmaintained

## Run locally

git clone https://github.com/yourusername/js-visualizer
cd js-visualizer
npm install
npm run dev