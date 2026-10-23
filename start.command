#!/bin/bash
# 在 Finder 雙擊這個檔案即可啟動 SofaPad
cd "$(dirname "$0")"
exec /usr/bin/python3 sofapad.py "$@"
