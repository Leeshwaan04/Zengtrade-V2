#!/usr/bin/env bash
# Strip Supabase placeholder brackets from DATABASE_URL password (:[pw]@ → :pw@).
# Prints sanitized URI on stdout. Does not log the password.
set -euo pipefail
url="${1:-${DATABASE_URL:-}}"
[[ -n "$url" ]] || exit 1
python3 -c "import re,sys; u=sys.argv[1]; print(re.sub(r':\[([^\]]+)\]@', r':\1@', u))" "$url"
