# SPHAGNUM ECO — Natural Substrates

Одностраничный сайт поставщика субстратов (английский, рынок ОАЭ/КСА) и кабинет
для правки его содержимого. Next.js 15 (App Router), React 19, Tailwind 3.4.

Сайт собирается двумя способами:

- **статикой для GitHub Pages** — только страница, без кабинета;
- **сервером** (`next build && next start`) — страница плюс кабинет `/admin`, где
  правятся тексты, картинки, видео и галерея.

## Быстрый старт

Нужен Node.js 22 или новее.

```bash
npm install
cp .env.example .env.local      # задайте ADMIN_PASSWORD
npm run dev                     # http://localhost:3000, кабинет — /admin
```

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер с кабинетом |
| `npm run build` | сборка; со `GITHUB_PAGES=true` — статика в `out/` |
| `npm start` | запуск серверной сборки (`next start`) |
| `npm test` | тесты схемы контента и логики кабинета (`node --test`; нужен Node, который сам снимает типы TypeScript: 24 или 22.18+) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify:layout` | проверка вёрстки в браузере: порядок блоков, сетка, переполнение, мобильное меню. Нужен запущенный сервер: `URL=http://127.0.0.1:3000/ npm run verify:layout` |
| `npm run verify:admin` | сквозная проверка кабинета: вход, правка, ошибки, галерея, медиатека, история, выход. `URL=… npm run verify:admin`, пароль берётся из `.env.local`. Контент и загрузки после прогона возвращаются как были |
| `npm run sync:instagram` | подтянуть посты @sphagnum_eco (нужен `INSTAGRAM_ACCESS_TOKEN`) |
| `npm run preview` | раздать статическую сборку из `out/` |

Перед первым `verify:*` один раз: `npx playwright install chromium`.

`next build` не запускайте при работающем `next dev` из той же папки: оба пишут
в `.next`, и dev-сервер начинает отдавать битую страницу. Остановите dev,
при необходимости удалите `.next`.

## Структура

```
app/
  page.tsx, layout.tsx          страница и метатеги — читают content/ на сервере
  admin/**/page.admin.tsx       кабинет и страница входа
  api/admin/**/route.admin.ts   API кабинета: вход, контент, загрузки, история
  uploads/[...path]/route.admin.ts  отдача загруженных файлов в next start
middleware.admin.ts             закрывает /admin и /api/admin без входа
content/
  site.json                     все тексты, ссылки и картинки по блокам страницы
  gallery.json                  элементы галереи (фото и видео)
public/
  media/                        картинки блоков
  instagram/                    архив и живые посты Instagram
  uploads/                      файлы, загруженные через кабинет
components/
  sphagnum-landing.tsx          разметка страницы
  sphagnum-styles.tsx           шрифт, палитра и анимации (один тег <style>)
  sphagnum-visuals.tsx          живая фотостена первого экрана, текстура мха
  instagram-gallery.tsx         галерея с просмотром на весь экран
  admin/                        интерфейс кабинета
lib/
  content/                      схема контента (типы и проверка) и чтение файлов
  admin/                        вход, лимит попыток, хранилище, описание полей редактора
scripts/                        проверки, синхронизация Instagram, снимки экрана
```

Файлы кабинета названы `*.admin.ts(x)`. `next.config.mjs` подключает это
расширение только в серверном режиме, поэтому в статической сборке кабинета и API
физически нет.

## Контент

Всё, что видно на странице, лежит в `content/site.json` (блоки в порядке страницы)
и `content/gallery.json`. Править можно в кабинете или руками в JSON. Структура
проверяется схемой `lib/content/schema.ts`: при битом файле сборка и сохранение
в кабинете остановятся с понятным списком ошибок.

- Пути к файлам — от `public`, без ведущего слэша: `media/…`, `uploads/…`,
  `instagram/…`. Внешние адреса в картинках не принимаются.
- Перенос строки в заголовке карточки — `\n`.
- Иконки задаются ключами из `ICON_NAMES` (`lib/content/schema.ts`).
- Если в `components/instagram-feed.json` есть живые посты, галерея показывает их,
  а не `gallery.json`.

Формулировки на странице намеренно осторожные (`can reduce`, `help extend`).
Не добавляйте цифры и заявления без письменного источника — это коммерческая
страница.

## Кабинет

Вход — `/admin`, пароль из `ADMIN_PASSWORD`. Слева список блоков страницы и общие
разделы (контакты, меню, подвал, экран загрузки, SEO), справа редактор блока.

- **Тексты и ссылки** правятся полями; списки (FAQ, преимущества, пункты) можно
  дополнять, удалять и переставлять.
- **Картинки и видео.** У поля картинки — «Загрузить/Заменить» и «Выбрать из
  загруженных». Картинки jpg, png, webp, avif, gif — до 15 МБ, видео mp4 и webm —
  до 150 МБ. SVG не принимается. Тип определяется по содержимому файла, имя
  на сервере случайное.
- **Галерея** — в блоке «Галерея»: загрузка пачкой, подпись, дата, постер ролика,
  порядок, удаление.
- **Сохранить** (или Ctrl/⌘+S) пишет изменённые файлы. Перед записью проверяется
  схема; при ошибке ничего не сохраняется, а поля с ошибками подсвечиваются.
- **История версий.** Каждое сохранение кладёт прежний файл в
  `content/.history/` (последние 30 версий каждого файла), любую можно вернуть.
- **Загруженные файлы** — медиатека `public/uploads`. Файл, который ещё стоит на
  сайте, удалить нельзя.

Где лежат данные: `content/site.json`, `content/gallery.json`,
`content/.history/` (в git не идёт), `public/uploads/` (в git идёт — иначе
загрузки не попадут на Pages).

После сохранения `next start` сразу отдаёт обновлённую страницу. Загруженные после
запуска файлы отдаёт роут `/uploads/…`: сам `next start` раздаёт из `public` только
то, что было там при старте.

## Переменные окружения

Шаблон — `.env.example`. Локально — `.env.local`, на сервере — `.env.local` в папке
проекта или переменные в unit-файле systemd. В git не коммитить.

| Переменная | Зачем |
|---|---|
| `ADMIN_PASSWORD` | пароль кабинета. Без него вход отключён |
| `ADMIN_SESSION_SECRET` | ключ подписи cookie входа, случайная строка **не короче 32 символов**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. В production обязателен. Смена ключа разлогинивает всех |
| `ADMIN_TRUST_PROXY=1` | ставить, когда сайт открыт только через nginx и тот передаёт `proxy_set_header X-Real-IP $remote_addr;`. Тогда лимит попыток входа считается по IP |
| `ADMIN_COOKIE_SECURE=false` | только пока у сервера нет HTTPS: иначе cookie с флагом Secure браузер по http не сохранит и вход молча не сработает. Работает только точное значение `false` |
| `INSTAGRAM_ACCESS_TOKEN` | для `sync:instagram`; на GitHub — секрет репозитория |

Лимит входа: 10 неудачных попыток за 15 минут на IP и не больше 50 на всех.
**Без `ADMIN_TRUST_PROXY` все неудачные попытки, от кого бы они ни были, идут в
один общий счётчик** — чужой перебор может закрыть вход и владельцу на 15 минут.
За nginx флаг нужен обязательно. Счётчики живут в памяти процесса и
сбрасываются перезапуском.

## Запуск на своём сервере (VDS)

1. Node.js 22+, nginx, git. Склонировать репозиторий, например в `/srv/sphagnum`.
2. `npm ci && npm run build`.
3. `.env.local`:
   ```
   ADMIN_PASSWORD=…
   ADMIN_SESSION_SECRET=…        # 64 hex-символа из команды выше
   ADMIN_TRUST_PROXY=1
   # ADMIN_COOKIE_SECURE=false   # только пока нет HTTPS
   ```
4. Права: пользователь, от которого работает Node, должен писать в `content/`
   (включая `content/.history/`) и `public/uploads/`:
   ```bash
   sudo chown -R sphagnum:sphagnum /srv/sphagnum/content /srv/sphagnum/public
   ```
5. Запуск `npm start -- -H 127.0.0.1 -p 3000` под процесс-менеджером (ниже) и nginx
   перед ним.

Обновление кода: `git pull && npm ci && npm run build`, затем перезапуск сервиса.
Правки из кабинета в это время лежат в рабочей копии — закоммитьте их до `git pull`
(см. «Pages и сервер вместе»).

### systemd

`/etc/systemd/system/sphagnum.service`:

```ini
[Unit]
Description=SPHAGNUM ECO site
After=network.target

[Service]
User=sphagnum
WorkingDirectory=/srv/sphagnum
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start -- -H 127.0.0.1 -p 3000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now sphagnum
journalctl -u sphagnum -f        # логи
```

Вместо systemd подойдёт pm2:
`pm2 start npm --name sphagnum -- start -- -H 127.0.0.1 -p 3000 && pm2 save`.

### nginx

```nginx
server {
    listen 80;
    server_name example.com;

    # Видео в кабинете — до 150 МБ.
    client_max_body_size 160m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

HTTPS — `certbot --nginx -d example.com`. После этого `ADMIN_COOKIE_SECURE` не нужен.

## GitHub Pages

Сайт публикуется по адресу https://lemnity.github.io/sphgnm/. Workflow
`.github/workflows/deploy.yml` на каждый push в `main` собирает статику
(`GITHUB_PAGES=true npm run build` → `out/`) и выкладывает её. Посмотреть статику
локально (без подпапки, иначе `serve` не найдёт стили):

```bash
STATIC_EXPORT=true npm run build && npm run preview
```

- `GITHUB_PAGES=true` включает статическую сборку и `basePath: "/sphgnm"` — сайт
  живёт в подпапке. Переименуете репозиторий — поменяйте путь в `next.config.mjs`.
  `STATIC_EXPORT=true` даёт ту же статику без подпапки.
- Источник публикации в Settings → Pages должен быть **GitHub Actions**. При «Deploy
  from a branch» GitHub параллельно гонит свой Jekyll-деплой, и по адресу
  попеременно оказывается то сайт, то этот README, хотя оба прогона зелёные.
- `.github/workflows/instagram-sync.yml` каждые 30 минут забирает новые посты
  Instagram, коммитит их в `main` и запускает деплой.

### Pages и сервер вместе

Статическая сборка берёт контент из репозитория. Правки, сделанные в кабинете на
сервере, остаются в его рабочей копии и на Pages не попадут, пока их не
закоммитить и не отправить:

```bash
git add content public/uploads
git commit -m "content: правки из кабинета"
git pull --rebase && git push
```

`git pull --rebase` нужен, потому что workflow Instagram сам пушит в `main`.
Если Pages больше не нужен, workflow деплоя можно отключить, а сервер считать
единственным источником.

## Снимки экрана

```bash
npm run dev                    # в соседнем окне
node scripts/screenshots.mjs   # → screenshots/ (в git не идёт)
```

Полная страница на 1440, 834 и 390 px и отдельные секции; заодно печатает
горизонтальное переполнение, ошибки JS и упавшие запросы.

## Открытые вопросы

1. **`SPHAGNUM AE` или `Sphagnum Eco`.** В логотипе — `SPHAGNUM AE`, в текстах,
   FAQ и подвале — `Sphagnum Eco`.
2. **Форма заявки никуда не отправляется** — только показывает подтверждение.
   Приём заявок нужно подключить отдельно.

Почему визуал и сборка устроены именно так — в [DECISIONS.md](DECISIONS.md).
