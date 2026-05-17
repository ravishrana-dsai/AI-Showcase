#!/bin/zsh
# Optional: use a saved path (run once in Cursor Terminal: which npm > scripts/.npm-path)
script_dir=${0:a:h}
if [[ -f "$script_dir/.npm-path" ]]; then
  npm_path=$(cat "$script_dir/.npm-path" | tr -d '\n')
  [[ -n "$npm_path" && -x "$npm_path" ]] && exec "$npm_path" "$@"
fi

# Load node version managers in this process so npm gets on PATH
export PATH="$HOME/.volta/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
[[ -f ~/.nvm/nvm.sh ]] && source ~/.nvm/nvm.sh
[[ -f ~/.fnm/fnm ]] && eval "$(~/.fnm/fnm env)" 2>/dev/null

# 1) Use npm from PATH if we have it
if command -v npm >/dev/null 2>&1; then
  exec npm "$@"
fi

# 2) Search common locations for npm
for dir in "$HOME/.nvm" "$HOME/.fnm" "$HOME/.volta" "$HOME/.local" "/opt/homebrew" "/usr/local"; do
  [[ -d "$dir" ]] || continue
  for f in $(find "$dir" -name npm -type f 2>/dev/null); do
    [[ -x "$f" ]] && exec "$f" "$@"
  done
done

# 3) Broader search under home and common roots (in case Node is in a non-standard path)
for base in "$HOME" "/usr/local" "/opt"; do
  [[ -d "$base" ]] || continue
  for f in $(find "$base" -maxdepth 8 -name npm -type f 2>/dev/null); do
    [[ -x "$f" ]] && exec "$f" "$@"
  done
done

echo "run-npm.sh: npm not found." >&2
echo "" >&2
echo "Node.js is not installed (or not on PATH). Install it first:" >&2
echo "  • https://nodejs.org — download the LTS version and run the installer" >&2
echo "  • Or if you use Homebrew: brew install node" >&2
echo "" >&2
echo "After installing, close and reopen Cursor's Terminal, then run the task again." >&2
exit 127
