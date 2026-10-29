#!/bin/zsh
cd "$(dirname "$0")" || exit 1
python3 serve.py
if [ $? -ne 0 ]; then
  printf '\nPress Return to close this window.'
  read -r response
fi
