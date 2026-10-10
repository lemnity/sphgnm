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
| `npm run verify:admin` | сквозная проверка кабинета: вход, правка, ошибки, английский интерфейс, галерея, медиатека, история, выход. `URL=… npm run verify:admin`, пароль берётся из `.env.local`. Контент и загрузки после прогона возвращаются как были. **Только против локального dev-сервера, никогда против боевого сайта**: скрипт правит живой контент |
| `npm run verify:lead` | сквозная проверка формы заявки: сам поднимает `next dev` на порту 3310 с заглушкой sendmail (`scripts/sendmail-capture.sh`), отправляет форму в браузере и проверяет пойманные письма (значения полей, части text/plain и text/html, автоответ), ответы API 400/405/413 и текст ошибки, когда API нет. Другой `next dev` из этой папки на время прогона остановить. Против своего сервера — см. шапку `scripts/verify-lead.mjs` |
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
  api/lead/route.admin.ts       приём заявок с формы → письмо через sendmail
  uploads/[...path]/route.admin.ts  отдача загруженных файлов в next start
middleware.admin.ts             закрывает /admin и /api/admin без входа
emails/                         HTML-шаблоны писем по заявке (команде и автоответ)
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
  lead/                         заявки: проверка полей, письма, MIME и sendmail
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
  Дата у версии — когда её сохранили.
- **Две вкладки.** Если сайт успели изменить в другой вкладке или на другом
  устройстве, сохранение не затрёт эти правки: кабинет предложит обновить контент.
- **Загруженные файлы** — медиатека `public/uploads`. Файл, который ещё стоит на
  сайте, удалить нельзя.
- **Превью ссылки (SEO).** В разделе SEO — картинка для соцсетей и мессенджеров
  (Open Graph / Twitter; лучше 1200×630, JPG или PNG, до 5 МБ) и «Адрес сайта» —
  полный публичный адрес вместе с подпапкой (`https://lemnity.github.io/sphgnm`).
  Адрес картинки собирается как адрес сайта + путь файла, basePath сверху не
  добавляется. После переезда на свой домен поменяйте адрес сайта.

**Язык интерфейса.** Переключатель RU / EN — в верхней панели кабинета и на
странице входа. Выбор хранится в cookie `sph_admin_lang` (год, на всём сайте),
страницы кабинета сразу отрисовываются на выбранном языке, по умолчанию — русский.
Язык меняется без перезагрузки, несохранённые правки остаются. На том же языке
отвечает API: язык берётся из заголовка `X-Admin-Lang` (его шлёт кабинет), затем
из cookie, затем из `Accept-Language`, иначе русский; у ошибок есть стабильное
поле `code`. Тексты — в `lib/admin/i18n.ts`, подписи блоков и полей — в
`lib/admin/fields.ts`, сообщения проверки контента — в `lib/content/schema.ts`.

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
| `ADMIN_PASSWORD` | пароль кабинета. Без него вход отключён. Длинный и случайный — от 12 символов: кабинет открыт в интернет |
| `ADMIN_SESSION_SECRET` | ключ подписи cookie входа, случайная строка **не короче 32 символов**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. В production обязателен. Смена ключа разлогинивает всех |
| `ADMIN_TRUST_PROXY=1` | ставить, когда сайт открыт только через nginx и тот передаёт `proxy_set_header X-Real-IP $remote_addr;`. Тогда лимит попыток входа считается по IP |
| `ADMIN_COOKIE_SECURE=false` | только пока у сервера нет HTTPS: иначе cookie с флагом Secure браузер по http не сохранит и вход молча не сработает. Работает только точное значение `false` |
| `LEAD_TO` | кому слать заявки с формы, через запятую. Не задан — почта из блока «Контакты» |
| `LEAD_FROM` | отправитель писем, по умолчанию `Sphagnum Eco <noreply@sphagnum.ae>`. Домен должен быть тем, для которого настроены SPF/DKIM |
| `LEAD_AUTOREPLY=1` | слать клиенту автоответ. По умолчанию выключен: письма на произвольные адреса до настройки SPF/DKIM портят репутацию домена |
| `SENDMAIL_PATH` | путь к sendmail, по умолчанию `/usr/sbin/sendmail` (Postfix) |
| `INSTAGRAM_ACCESS_TOKEN` | для `sync:instagram`; на GitHub — секрет репозитория |

Лимит входа: 10 неудачных попыток за 15 минут на IP и не больше 50 на всех.
**Без `ADMIN_TRUST_PROXY` все неудачные попытки, от кого бы они ни были, идут в
один общий счётчик** — чужой перебор может закрыть вход и владельцу на 15 минут.
За nginx флаг нужен обязательно. Счётчики живут в памяти процесса и
сбрасываются перезапуском.

## Заявки с формы

Форма «Send an enquiry» отправляет `POST /api/lead` (JSON). Роут есть только в
серверном режиме; в статике на Pages API нет, и форма показывает текст ошибки из
`contact.form.errorMessage` с почтой из контактов.

- Поля: `name` и `email` обязательны; `phone`, `region`, `projectType` (только из
  списка `contact.form.projectTypes` или пусто), `area`, `message`. Пределы длины:
  200 / 254 / 40 / 120 / 40 / 4000 символов. Тело больше 32 КБ — 413.
- `website` — поле-ловушка, скрытое от людей. Если оно заполнено, ответ обычный
  `200 { ok: true }`, но письмо не уходит.
- Лимит: 5 заявок за 10 минут с одного адреса и не больше 60 в час на всех. Адрес
  клиента считается по `X-Real-IP` только при `ADMIN_TRUST_PROXY=1`, иначе все
  делят один счётчик — за nginx флаг нужен.
- Ответы: `200 { ok: true }`; ошибки `{ error, code }` по-английски — `400`
  (`invalidRequest`, `nameRequired`, `emailRequired`, `invalidEmail`,
  `invalidProjectType`, `tooLong`, плюс `field`), `413 tooLarge`, `429 rateLimited`
  (с `Retry-After`), `500 notConfigured` / `sendFailed`.
- Письмо команде — `emails/lead-notification.html` плюс текстовая версия, `Reply-To`
  — адрес клиента, так что «Ответить» в почте пишет сразу ему. Автоответ клиенту
  (`emails/lead-autoreply.html`) — только с `LEAD_AUTOREPLY=1`, его `Reply-To` —
  первый адрес из `LEAD_TO`.
- Письма уходят через `sendmail -t -i -f <LEAD_FROM>`: на сервере его даёт Postfix.
  Если sendmail не сработал, посетитель видит ошибку, а в журнале сервиса — строка
  `[lead] <номер заявки>: письмо команде не ушло (exit 75)` без данных клиента.

## Запуск на своём сервере (VDS)

1. Node.js 22+, nginx, git. Отдельный пользователь `sphagnum`; склонировать
   репозиторий от его имени, например в `/srv/sphagnum`.
2. `npm ci && npm run build` (тоже от `sphagnum`).
3. `.env.local`:
   ```
   ADMIN_PASSWORD=…              # от 12 символов, случайный
   ADMIN_SESSION_SECRET=…        # 64 hex-символа из команды выше
   ADMIN_TRUST_PROXY=1
   # ADMIN_COOKIE_SECURE=false   # только пока нет HTTPS
   LEAD_TO=sales@sphagnum.ae     # куда слать заявки с формы
   # LEAD_AUTOREPLY=1            # после настройки SPF/DKIM
   ```
4. Права: сервис пишет только в `content/` (включая `content/.history/`) и
   `public/uploads/` — им и отдать владельца, остальной код серверу менять незачем:
   ```bash
   sudo mkdir -p /srv/sphagnum/public/uploads
   sudo chown -R sphagnum:sphagnum /srv/sphagnum/content /srv/sphagnum/public/uploads
   ```
   Если клон сделан не от `sphagnum`, обновления всё равно запускайте от него
   (`sudo -u sphagnum …`), иначе git и сборка упрутся в права или оставят файлы root.
5. Запуск `npm start -- -H 127.0.0.1 -p 3000` под процесс-менеджером (ниже) и nginx
   перед ним.

Обновление кода — от пользователя сервиса и **с остановленным сервисом**:
`next build` перезаписывает `.next`, из которой в это время отдаёт страницы
`next start`, и посетители получат ошибки:

```bash
sudo systemctl stop sphagnum
sudo -u sphagnum sh -c 'cd /srv/sphagnum && git pull && npm ci && npm run build'
sudo systemctl start sphagnum
```

Без простоя — собирать в свежий клон рядом и переключать каталог (симлинк), не
забыв перенести `content/` и `public/uploads/`. Правки из кабинета лежат в рабочей
копии — закоммитьте их до `git pull` (см. «Pages и сервер вместе»).

`npm run verify:admin` на сервере **не запускайте**: он правит живой контент.

**Instagram.** Новые посты забирает только workflow `instagram-sync.yml` в GitHub
Actions — он коммитит их в `main`. Сервер их увидит после `git pull` и пересборки.
Если Pages и Actions выключены, ставьте на сервер cron от `sphagnum`:
`npm run sync:instagram` (нужен `INSTAGRAM_ACCESS_TOKEN` в `.env.local`), затем
остановка, `npm run build`, запуск. Токен Instagram живёт 60 дней; в Actions его
раз в неделю продлевает тот же workflow, если задан секрет `GH_SECRETS_TOKEN`
(fine-grained PAT с правом Secrets: Read and write). Без него токен придётся
обновлять руками.

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
# Полный путь к npm: `which npm` от пользователя sphagnum. С nvm это что-то вроде
# /home/sphagnum/.nvm/versions/node/v22.x.x/bin/npm — и тогда нужен PATH к node:
# Environment=PATH=/home/sphagnum/.nvm/versions/node/v22.x.x/bin:/usr/bin:/bin
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

    # Обычные запросы — маленькие; большой лимит только для загрузки файлов.
    client_max_body_size 2m;

    # Видео в кабинете — до 150 МБ.
    location = /api/admin/upload {
        client_max_body_size 160m;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_request_buffering off;
    }

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
2. **Форма заявки на GitHub Pages не работает** — там нет сервера. Заявки
   принимает только серверная сборка (см. «Заявки с формы»).

Почему визуал и сборка устроены именно так — в [DECISIONS.md](DECISIONS.md).
