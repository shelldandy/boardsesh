#!/bin/sh
set -e

# Replace NEXT_PUBLIC_WS_URL placeholder with runtime value
if [ -n "$NEXT_PUBLIC_WS_URL" ] && [ "$NEXT_PUBLIC_WS_URL" != "__NEXT_PUBLIC_WS_URL_PLACEHOLDER__" ]; then
  echo "Injecting NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL"
  find /app/packages/web/.next -type f -name '*.js' -exec sed -i "s|__NEXT_PUBLIC_WS_URL_PLACEHOLDER__|$NEXT_PUBLIC_WS_URL|g" {} +
fi

# Start the Next.js server
exec node packages/web/server.js
