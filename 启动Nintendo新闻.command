#!/bin/zsh
set -e

PROJECT_DIR="/Users/gucong/gamenews"
URL="http://localhost:5173/"

cd "$PROJECT_DIR"

if [ ! -d "node_modules" ]; then
  echo "首次启动，正在安装依赖..."
  npm install --legacy-peer-deps --no-package-lock
fi

echo "正在启动 Nintendo 新闻聚合站..."
echo "地址：$URL"

(
  sleep 4
  open "$URL"
) &

npm run dev
