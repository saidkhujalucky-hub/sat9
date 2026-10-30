# Быстрая публикация (исправленная версия)

## Cloudflare Workers
1. Залей ВСЕ файлы из архива в репозиторий GitHub (замени старые). Старый `package-lock.json`, если есть, удали.
2. Cloudflare -> Workers & Pages -> sat8 -> Settings -> Build: Deploy command = `npx wrangler deploy`, Build command пустой.
3. Retry deployment. `database_id` указывать НЕ нужно: Wrangler сам создаёт D1-базу `sat-platform-db`, а Worker сам создаёт таблицы при первом запросе.
4. Проверка: `https://sat8.<твой-поддомен>.workers.dev/api/health` -> `{"ok":true,...,"database":"d1"}`.

Если база `sat-platform-db` уже создана вручную и деплой просит ID: вставь строку `database_id = "ТВОЙ-UUID"` под `database_name` в wrangler.toml.
Имя `name = "sat8"` в wrangler.toml должно совпадать с именем Worker в Cloudflare.

## GitHub Pages
1. Settings -> Pages -> Source: **GitHub Actions**.
2. Settings -> Secrets and variables -> Actions -> Variables -> New variable: `API_URL` = `https://sat8.<твой-поддомен>.workers.dev/api`.
3. Каждый push в main сам публикует сайт (workflow `.github/workflows/pages.yml`).
