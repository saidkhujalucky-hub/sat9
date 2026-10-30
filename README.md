# SAT Cloudflare — fixed dependency install

**Причина прежнего сбоя:** неактуальный `package-lock.json` от MongoDB. В комплекте lock-файла больше нет, чтобы Cloudflare выполнил `npm install`. Удали старый lock-файл из GitHub, если он там уже есть.

Дальнейшие шаги смотри в `CLOUDFLARE_SETUP.md`.

Нужно настроить D1 Database ID и создать таблицы; иначе Worker не будет работать. Версия не проверена на опубликованном Cloudflare.
