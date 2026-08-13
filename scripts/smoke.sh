#!/usr/bin/env bash
# 后端冒烟测试：跑关键 API 接口，输出 status 到 OUT 目录，body 到 OUT/*.json
# 用法: scripts/smoke.sh <BASE_URL> <OUT_DIR>
# 例如: scripts/smoke.sh http://localhost:3100 /tmp/baseline
set -u
BASE="${1:?需要 BASE_URL}"
OUT="${2:?需要输出目录}"
mkdir -p "$OUT"

req() { # req <name> <method> <path> [auth]
  local name="$1" method="$2" path="$3" auth="${4:-}"
  local args=(-s -o "$OUT/$name.json" -w '%{http_code}' -X "$method" "$BASE$path")
  [ -n "$auth" ] && args+=(-H "$auth")
  curl "${args[@]}" > "$OUT/$name.status"
}

# 登录拿 token
curl -s -o "$OUT/login.json" -w '%{http_code}' -X POST "$BASE/api/login" -H 'Content-Type: application/json' \
  -d '{"identity":"admin","password":"admin123"}' > "$OUT/login.status"
TOKEN=$(node -e "const o=require('$OUT/login.json');process.stdout.write(o.data&&o.data.token||'')")
AUTH="Authorization: Bearer $TOKEN"

# 受保护接口
req me GET /api/me "$AUTH"
req teachers GET /api/teachers "$AUTH"
req students GET /api/students "$AUTH"
req courses GET "/api/courses?date=2026-08-04" "$AUTH"
req courses_range GET "/api/courses/range?start_date=2026-08-01&end_date=2026-08-10" "$AUTH"
req recent_fee GET "/api/students/recent-fee" "$AUTH"
req statistics GET "/api/courses/statistics" "$AUTH"
req search GET "/api/courses/search" "$AUTH"
req admin_teachers GET /api/admin/teachers "$AUTH"

# 课程重复生成（weekly）
curl -s -o "$OUT/create_weekly.json" -w '%{http_code}' -X POST "$BASE/api/courses" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"student_name":"冒烟-周","date":"2026-08-05","start_time":"10:00","end_time":"11:00","grade":"初三","hourly_fee":100,"repeat_type":"weekly","end_date":"2026-08-26"}' > "$OUT/create_weekly.status"

# 无 token → 401
req noauth_courses GET "/api/courses?date=2026-08-04" ""

# 公共接口（无 token）
req holidays GET /api/holidays/2026 ""
curl -s -o "$OUT/forgot.json" -w '%{http_code}' -X POST "$BASE/api/forgot-password" -H 'Content-Type: application/json' -d '{"email":"nobody@example.com"}' > "$OUT/forgot.status"
curl -s -o "$OUT/reset.json" -w '%{http_code}' -X POST "$BASE/api/reset-password" -H 'Content-Type: application/json' -d '{"token":"bad","password":"abc12345"}' > "$OUT/reset.status"
req spa GET / ""

# 限流：连续 12 次错密码 → 期望前 10 次 401 之后 429
> "$OUT/ratelimit.log"
for i in $(seq 1 12); do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/login" -H 'Content-Type: application/json' -d '{"identity":"admin","password":"wrong"}' >> "$OUT/ratelimit.log"
done

# 汇总
echo "=== 冒烟结果 ($OUT) ==="
for f in "$OUT"/*.status; do
  echo "$(basename "$f" .status): $(cat "$f")"
done
echo "--- 限流 (期望前10个401后2个429) ---"
cat "$OUT/ratelimit.log" | sort | uniq -c
echo "--- weekly 生成节数 ---"
node -e "try{const o=require('$OUT/create_weekly.json');const d=o.data;const l=Array.isArray(d)?d:(d?[d]:[]);console.log('count:',l.length)}catch(e){console.log('解析失败')}" 2>/dev/null || echo "无法解析"
