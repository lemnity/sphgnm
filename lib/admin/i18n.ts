// Тексты кабинета на двух языках: интерфейс и ответы API. Модуль без зависимостей —
// его импортируют и роуты, и клиентские компоненты, и node --test.
// Параметры в текстах — {имя}; в переводе должен быть тот же набор параметров (сверяет тест).

export type AdminLang = "ru" | "en";
export const ADMIN_LANGS: readonly AdminLang[] = ["ru", "en"];
export const DEFAULT_LANG: AdminLang = "ru";

/** Cookie с выбранным языком: не httpOnly — её пишет переключатель в браузере. */
export const LANG_COOKIE = "sph_admin_lang";
export const LANG_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
/** Заголовок, которым кабинет сообщает API язык текущего интерфейса. */
export const LANG_HEADER = "x-admin-lang";

/** Подпись строк с датами и числами по языку. */
export const LOCALES: Record<AdminLang, string> = { ru: "ru-RU", en: "en-GB" };

const ru = {
  // страницы
  "meta.adminTitle": "Кабинет · Sphagnum Eco",
  "meta.loginTitle": "Вход · Sphagnum Eco",
  "brand.sub": "Кабинет",
  "lang.switch": "Язык интерфейса",

  // вход
  "login.heading": "Вход в кабинет",
  "login.lead": "Здесь редактируются тексты, картинки и галерея сайта.",
  "login.password": "Пароль",
  "login.submit": "Войти",
  "login.submitting": "Входим…",
  "login.failed": "Не удалось войти. Попробуйте ещё раз.",
  "login.passwordTooLong": "Слишком длинный пароль",

  // верхняя панель
  "top.saving": "Сохраняем…",
  "top.dirty": "Есть несохранённые изменения",
  "top.clean": "Все изменения сохранены",
  "top.save": "Сохранить",
  "top.openSite": "Открыть сайт",
  "top.newTab": " (в новой вкладке)",
  "top.history": "История",
  "top.signOut": "Выйти",

  // боковое меню
  "side.label": "Разделы сайта",
  "side.page": "Страница",
  "side.shared": "Общее",
  "side.files": "Файлы",
  "side.uploads": "Загруженные файлы",
  "side.history": "История версий",
  "side.errors": "ошибок: {count}",
  "side.unsavedSr": "есть несохранённые изменения",

  // блок и сводка ошибок
  "panel.unsaved": "не сохранено",
  "summary.notSaved": "Не сохранено.",
  "summary.fixOne": "Исправьте ошибку и нажмите «Сохранить» ещё раз:",
  "summary.fixMany": "Исправьте ошибки ({count}) и нажмите «Сохранить» ещё раз:",

  // уведомления кабинета
  "toast.saved": "Сохранено. Изменения уже на сайте.",
  "toast.saveFailedOne": "Не сохранено: одна ошибка. Поля отмечены красным.",
  "toast.saveFailedMany": "Не сохранено: ошибок — {count}. Поля отмечены красным.",
  "toast.saveError": "Не удалось сохранить",
  "toast.reloaded": "Загружена последняя версия сайта.",
  "toast.reloadError": "Не удалось обновить",
  "toast.signedInAgain": "Вы снова вошли. Можно сохранять.",

  // окна
  "conflict.title": "Сайт изменили в другом месте",
  "conflict.text": "Сайт изменили в другой вкладке или на другом устройстве. Обновите страницу — ваши несохранённые правки пропадут, зато вы увидите последнюю версию.",
  "conflict.cancelHint": "«Отмена» — остаться и продолжить редактирование. Сохранить поверх чужих изменений не получится.",
  "conflict.confirm": "Обновить",
  "signOut.title": "Выйти без сохранения?",
  "signOut.text": "Несохранённые правки пропадут.",
  "session.title": "Сессия истекла",
  "session.text": "Войдите снова — несохранённые правки останутся на месте.",
  "ui.cancel": "Отмена",
  "ui.yes": "Да",
  "ui.close": "Закрыть",
  "ui.closeToast": "Закрыть уведомление",

  // поля и списки
  "field.anchorTarget": "Ведёт к блоку «{label}»",
  "field.anchorHelp": "id секции без решётки: {ids}",
  "field.alt": "Описание картинки (alt)",
  "field.altPlaceholder": "Что на картинке — для поисковиков и экранных читалок",
  "list.number": "{item} № {n}",
  "list.empty": "Пока пусто.",
  "list.up": "{item}: выше",
  "list.upTitle": "Выше",
  "list.down": "{item}: ниже",
  "list.downTitle": "Ниже",
  "list.remove": "{item}: удалить",
  "list.removeTitle": "Удалить",
  "list.confirmRemove": "Удалить: {item} № {n}?",
  "list.add": "+ Добавить: {item}",

  // галерея
  "gallery.heading": "Элементы галереи",
  "gallery.hint": "Можно выбрать сразу несколько файлов: картинки и ролики mp4/webm. Новые появляются первыми.",
  "gallery.batch": "{index} из {total}: {name}",
  "gallery.upload": "Загрузить фото и видео",
  "gallery.instagramLive": "Сейчас на сайте показываются живые посты Instagram ({count}). Эти элементы появятся, когда лента Instagram будет пустой.",
  "gallery.empty": "В галерее пока ничего нет.",
  "gallery.item": "Элемент № {n}",
  "gallery.num": "№ {n}",
  "gallery.earlier": "{item}: раньше",
  "gallery.earlierTitle": "Раньше",
  "gallery.later": "{item}: позже",
  "gallery.laterTitle": "Позже",
  "gallery.remove": "{item}: убрать из галереи",
  "gallery.removeTitle": "Убрать",
  "gallery.confirmTitle": "Убрать из галереи?",
  "gallery.confirmText": "«{title}» пропадёт с сайта после сохранения. Сам файл останется в загруженных — его можно удалить там.",
  "gallery.untitled": "Без подписи",
  "gallery.caption": "Подпись",
  "gallery.date": "Дата",
  "gallery.poster": "Постер (обложка ролика)",
  "gallery.posterLabel": "постер, {item}",
  "gallery.noPoster": "Без постера покажется первый кадр ролика.",
  "gallery.video": "Видео",

  // история
  "history.site": "Тексты и картинки",
  "history.gallery": "Галерея",
  "history.title": "История версий",
  "history.lead": "При каждом сохранении прежняя версия попадает сюда. Дата у строки — когда эту версию сохранили; то, что сейчас на сайте, в списке не показано. Хранятся {limit} последних версий текстов и столько же — галереи.",
  "history.loadFailed": "Не удалось загрузить историю",
  "history.confirmTitle": "Вернуть эту версию?",
  "history.confirmText": "Раздел «{section}» вернётся к версии от {date}. Изменения сразу появятся на сайте.",
  "history.confirmKeep": "Текущая версия не пропадёт: она тоже ляжет в историю, и её можно будет вернуть.",
  "history.confirmDirty": "Несохранённые правки в этом разделе будут потеряны.",
  "history.restore": "Вернуть",
  "history.restoring": "Возвращаем…",
  "history.restoreAria": "Вернуть: {section}, {date}",
  "history.restored": "Версия от {date} возвращена",
  "history.restoreFailed": "Не удалось вернуть версию",
  "history.problems": "Эта версия не подходит под текущую структуру сайта:",
  "history.loading": "Загружаем…",
  "history.empty": "Сохранённых версий пока нет — они появятся после первого сохранения.",
  "history.colSaved": "Версия сохранена",
  "history.colSection": "Раздел",
  "history.colSize": "Размер",
  "history.colAction": "Действие",

  // файлы
  "media.all": "Все",
  "media.images": "Картинки",
  "media.videos": "Видео",
  "media.pickTitle": "Выбрать файл",
  "media.notUploaded": "не загружен",
  "media.listFailed": "Не удалось загрузить список",
  "media.usedInDraft": "«{name}» выбран в несохранённых правках — сначала замените его там.",
  "media.confirmTitle": "Удалить файл?",
  "media.confirmText": "Файл «{name}» будет удалён с сервера навсегда.",
  "media.deleted": "Файл удалён",
  "media.inUse": "Файл используется на сайте — сначала замените его:",
  "media.deleteFailed": "Не удалось удалить",
  "media.filter": "Тип файлов",
  "media.onlyImages": "Показаны картинки",
  "media.onlyVideos": "Показаны ролики",
  "media.uploadFiles": "Загрузить файлы",
  "media.hint": "Здесь файлы, загруженные через кабинет. Картинки: jpg, png, webp, avif, gif до 15 МБ; видео: mp4, webm до 150 МБ.",
  "media.loading": "Загружаем список…",
  "media.empty": "Пока здесь пусто. Загрузите файл кнопкой выше.",
  "media.select": "Выбрать",
  "media.delete": "Удалить",
  "media.deleteAria": "Удалить {name}",
  "media.progress": "Загрузка файла",
  "media.noFile": "Нет файла",
  "media.notChosen": "файл не выбран",
  "media.upload": "Загрузить",
  "media.replace": "Заменить",
  "media.fromLibrary": "Выбрать из загруженных",
  "media.remove": "Убрать",
  "media.needImage": "Сюда нужна картинка, а не ролик",
  "media.needVideo": "Сюда нужен ролик, а не картинка",

  // сеть и форматы
  "net.offline": "Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.",
  "net.uploadOffline": "Нет связи с сервером: файл не загружен.",
  "net.serverError": "Ошибка сервера ({status})",
  "size.kb": "{n} КБ",
  "size.mb": "{n} МБ",

  // ответы API (код ошибки — ключ без "api.")
  "api.unauthorized": "Нужно войти в админку",
  "api.internal": "Внутренняя ошибка сервера",
  "api.invalidJson": "Невалидный JSON в запросе",
  "api.expectedContent": "Ожидается { site } и/или { gallery }",
  "api.unknownSection": "неизвестный раздел",
  "api.missingVersion": "Не указана версия раздела {name}: обновите страницу кабинета",
  "api.validation": "Ошибки в данных",
  "api.conflict": "Сайт изменили в другой вкладке или на другом устройстве",
  "api.brokenContent": "content/{name}.json: невалидный JSON — {detail}",
  "api.unknownVersion": "Неизвестная версия",
  "api.versionNotFound": "Версия не найдена",
  "api.versionBroken": "Версия {id} повреждена",
  "api.expectedId": "Ожидается { id }",
  "api.versionInvalid": "Версия не проходит проверку",
  "api.svgForbidden": "SVG загружать нельзя: в нём может быть исполняемый код",
  "api.emptyFile": "Пустой файл",
  "api.fileTooBig": "Файл больше {mb} МБ",
  "api.unsupportedType": "Неподдерживаемый тип файла. Можно: {types}",
  "api.imageTooBig": "Файл слишком большой: картинка — до {mb} МБ",
  "api.videoTooBig": "Файл слишком большой: видео — до {mb} МБ",
  "api.badPath": "Недопустимый путь к файлу",
  "api.fileNotFound": "Файл не найден",
  "api.fileInUse": "Файл используется на сайте — сначала замените его в контенте",
  "api.expectedMultipart": "Ожидается multipart/form-data с полем file",
  "api.noFile": "Нет файла в поле file",
  "api.noPassword": "Вход отключён: не задан пароль администратора.",
  "api.noPasswordDev": "Вход отключён: не задан пароль администратора. Задайте ADMIN_PASSWORD в .env.local (см. .env.example) и перезапустите сервер.",
  "api.secretShort": "ADMIN_SESSION_SECRET короче {min} символов: вход в админку отключён. Задайте длинную случайную строку (см. .env.example).",
  "api.secretMissing": "ADMIN_SESSION_SECRET не задан: вход в админку отключён. Задайте его в .env.local (см. .env.example).",
  "api.requestTooLarge": "Слишком большой запрос",
  "api.tooManyAttempts": "Слишком много попыток. Попробуйте через {minutes} мин.",
  "api.expectedPassword": "Ожидается { password }",
  "api.wrongPassword": "Неверный пароль",
} as const;

export type MessageKey = keyof typeof ru;
export type ApiKey = Extract<MessageKey, `api.${string}`>;
/** Машинный код ошибки API: ключ без префикса, "api.wrongPassword" → "wrongPassword". */
export type ApiCode = ApiKey extends `api.${infer Code}` ? Code : never;

const en: Record<MessageKey, string> = {
  "meta.adminTitle": "Admin · Sphagnum Eco",
  "meta.loginTitle": "Sign in · Sphagnum Eco",
  "brand.sub": "Admin",
  "lang.switch": "Interface language",

  "login.heading": "Sign in to the admin",
  "login.lead": "Edit the site's text, images and gallery here.",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.submitting": "Signing in…",
  "login.failed": "Couldn't sign in. Please try again.",
  "login.passwordTooLong": "That password is too long",

  "top.saving": "Saving…",
  "top.dirty": "You have unsaved changes",
  "top.clean": "All changes saved",
  "top.save": "Save",
  "top.openSite": "View site",
  "top.newTab": " (opens in a new tab)",
  "top.history": "History",
  "top.signOut": "Sign out",

  "side.label": "Site sections",
  "side.page": "Page",
  "side.shared": "Site-wide",
  "side.files": "Files",
  "side.uploads": "Uploaded files",
  "side.history": "Version history",
  "side.errors": "errors: {count}",
  "side.unsavedSr": "has unsaved changes",

  "panel.unsaved": "unsaved",
  "summary.notSaved": "Not saved.",
  "summary.fixOne": "Fix the error below and click Save again:",
  "summary.fixMany": "Fix the {count} errors below and click Save again:",

  "toast.saved": "Saved. Your changes are live.",
  "toast.saveFailedOne": "Not saved: there's 1 error. The field is highlighted in red.",
  "toast.saveFailedMany": "Not saved: there are {count} errors. The fields are highlighted in red.",
  "toast.saveError": "Couldn't save",
  "toast.reloaded": "Loaded the latest version of the site.",
  "toast.reloadError": "Couldn't refresh",
  "toast.signedInAgain": "You're signed in again. You can save now.",

  "conflict.title": "The site was changed elsewhere",
  "conflict.text": "Someone changed the site in another tab or on another device. Refresh to see the latest version — your unsaved edits will be lost.",
  "conflict.cancelHint": "Choose Cancel to stay and keep editing. You can't save over someone else's changes.",
  "conflict.confirm": "Refresh",
  "signOut.title": "Sign out without saving?",
  "signOut.text": "Your unsaved edits will be lost.",
  "session.title": "Your session has expired",
  "session.text": "Sign in again — your unsaved edits will stay right where they are.",
  "ui.cancel": "Cancel",
  "ui.yes": "Yes",
  "ui.close": "Close",
  "ui.closeToast": "Dismiss notification",

  "field.anchorTarget": "Links to the “{label}” section",
  "field.anchorHelp": "Section id, without the #: {ids}",
  "field.alt": "Image description (alt text)",
  "field.altPlaceholder": "Describe the image for search engines and screen readers",
  "list.number": "{item} #{n}",
  "list.empty": "Nothing here yet.",
  "list.up": "{item}: move up",
  "list.upTitle": "Move up",
  "list.down": "{item}: move down",
  "list.downTitle": "Move down",
  "list.remove": "{item}: delete",
  "list.removeTitle": "Delete",
  "list.confirmRemove": "Delete {item} #{n}?",
  "list.add": "+ Add {item}",

  "gallery.heading": "Gallery items",
  "gallery.hint": "You can select several files at once: images and mp4/webm videos. New items appear first.",
  "gallery.batch": "{index} of {total}: {name}",
  "gallery.upload": "Upload photos and videos",
  "gallery.instagramLive": "The site is currently showing live Instagram posts ({count}). These items will appear once the Instagram feed is empty.",
  "gallery.empty": "The gallery is empty.",
  "gallery.item": "Item #{n}",
  "gallery.num": "#{n}",
  "gallery.earlier": "{item}: move earlier",
  "gallery.earlierTitle": "Move earlier",
  "gallery.later": "{item}: move later",
  "gallery.laterTitle": "Move later",
  "gallery.remove": "{item}: remove from gallery",
  "gallery.removeTitle": "Remove",
  "gallery.confirmTitle": "Remove from the gallery?",
  "gallery.confirmText": "“{title}” will disappear from the site once you save. The file itself stays in Uploaded files, where you can delete it.",
  "gallery.untitled": "Untitled",
  "gallery.caption": "Caption",
  "gallery.date": "Date",
  "gallery.poster": "Poster (video cover image)",
  "gallery.posterLabel": "poster, {item}",
  "gallery.noPoster": "Without a poster, the first frame of the video is shown.",
  "gallery.video": "Video",

  "history.site": "Text and images",
  "history.gallery": "Gallery",
  "history.title": "Version history",
  "history.lead": "Each time you save, the previous version is kept here. The date on a row is when that version was saved; what's live on the site right now isn't listed. The last {limit} versions of the text are kept, and the same number for the gallery.",
  "history.loadFailed": "Couldn't load the history",
  "history.confirmTitle": "Restore this version?",
  "history.confirmText": "“{section}” will go back to the version from {date}. The change goes live right away.",
  "history.confirmKeep": "The current version won't be lost: it's added to the history too, so you can bring it back.",
  "history.confirmDirty": "Unsaved edits in this section will be lost.",
  "history.restore": "Restore",
  "history.restoring": "Restoring…",
  "history.restoreAria": "Restore: {section}, {date}",
  "history.restored": "Restored the version from {date}",
  "history.restoreFailed": "Couldn't restore the version",
  "history.problems": "This version doesn't fit the site's current structure:",
  "history.loading": "Loading…",
  "history.empty": "No saved versions yet — they'll appear after your first save.",
  "history.colSaved": "Saved on",
  "history.colSection": "Section",
  "history.colSize": "Size",
  "history.colAction": "Action",

  "media.all": "All",
  "media.images": "Images",
  "media.videos": "Videos",
  "media.pickTitle": "Choose a file",
  "media.notUploaded": "upload failed",
  "media.listFailed": "Couldn't load the file list",
  "media.usedInDraft": "“{name}” is used in your unsaved edits — replace it there first.",
  "media.confirmTitle": "Delete this file?",
  "media.confirmText": "“{name}” will be permanently deleted from the server.",
  "media.deleted": "File deleted",
  "media.inUse": "This file is used on the site — replace it first:",
  "media.deleteFailed": "Couldn't delete the file",
  "media.filter": "File type",
  "media.onlyImages": "Showing images",
  "media.onlyVideos": "Showing videos",
  "media.uploadFiles": "Upload files",
  "media.hint": "Files uploaded through the admin. Images: jpg, png, webp, avif or gif, up to 15 MB; videos: mp4 or webm, up to 150 MB.",
  "media.loading": "Loading files…",
  "media.empty": "Nothing here yet. Upload a file with the button above.",
  "media.select": "Select",
  "media.delete": "Delete",
  "media.deleteAria": "Delete {name}",
  "media.progress": "Upload progress",
  "media.noFile": "No file",
  "media.notChosen": "no file selected",
  "media.upload": "Upload",
  "media.replace": "Replace",
  "media.fromLibrary": "Choose from uploads",
  "media.remove": "Remove",
  "media.needImage": "This field needs an image, not a video",
  "media.needVideo": "This field needs a video, not an image",

  "net.offline": "Can't reach the server. Check your connection and try again.",
  "net.uploadOffline": "Can't reach the server, so the file wasn't uploaded.",
  "net.serverError": "Server error ({status})",
  "size.kb": "{n} KB",
  "size.mb": "{n} MB",

  "api.unauthorized": "Please sign in to the admin",
  "api.internal": "Internal server error",
  "api.invalidJson": "The request body isn't valid JSON",
  "api.expectedContent": "Expected { site } and/or { gallery }",
  "api.unknownSection": "unknown section",
  "api.missingVersion": "No version given for section {name}: reload the admin page",
  "api.validation": "The data has errors",
  "api.conflict": "The site was changed in another tab or on another device",
  "api.brokenContent": "content/{name}.json: invalid JSON — {detail}",
  "api.unknownVersion": "Unknown version",
  "api.versionNotFound": "Version not found",
  "api.versionBroken": "Version {id} is corrupted",
  "api.expectedId": "Expected { id }",
  "api.versionInvalid": "This version doesn't pass validation",
  "api.svgForbidden": "SVG files can't be uploaded: they may contain executable code",
  "api.emptyFile": "The file is empty",
  "api.fileTooBig": "The file is larger than {mb} MB",
  "api.unsupportedType": "Unsupported file type. Allowed: {types}",
  "api.imageTooBig": "The file is too large: images can be up to {mb} MB",
  "api.videoTooBig": "The file is too large: videos can be up to {mb} MB",
  "api.badPath": "Invalid file path",
  "api.fileNotFound": "File not found",
  "api.fileInUse": "The file is used on the site — replace it in the content first",
  "api.expectedMultipart": "Expected multipart/form-data with a file field",
  "api.noFile": "No file in the file field",
  "api.noPassword": "Sign-in is disabled: no admin password is set.",
  "api.noPasswordDev": "Sign-in is disabled: no admin password is set. Set ADMIN_PASSWORD in .env.local (see .env.example) and restart the server.",
  "api.secretShort": "ADMIN_SESSION_SECRET is shorter than {min} characters, so admin sign-in is disabled. Set a long random string (see .env.example).",
  "api.secretMissing": "ADMIN_SESSION_SECRET isn't set, so admin sign-in is disabled. Set it in .env.local (see .env.example).",
  "api.requestTooLarge": "The request is too large",
  "api.tooManyAttempts": "Too many attempts. Try again in {minutes} min.",
  "api.expectedPassword": "Expected { password }",
  "api.wrongPassword": "Incorrect password",
};

export const MESSAGES: Record<AdminLang, Record<MessageKey, string>> = { ru, en };

export type Params = Record<string, string | number>;

/** Текст по ключу с подстановкой {параметров}. Неизвестный параметр остаётся как есть. */
export function translate(lang: AdminLang, key: MessageKey, params: Params = {}): string {
  return MESSAGES[lang][key].replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** Имена параметров в тексте — для сверки переводов. */
export function paramsOf(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();
}

export const codeOf = (key: ApiKey): ApiCode => key.slice(4) as ApiCode;

export function isAdminLang(value: unknown): value is AdminLang {
  return value === "ru" || value === "en";
}

/** Первый поддерживаемый язык из Accept-Language с учётом q. */
export function langFromAcceptLanguage(header: string | null | undefined): AdminLang | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...rest] = part.trim().split(";");
      const q = rest.map((item) => /^\s*q=([\d.]+)\s*$/.exec(item)?.[1]).find(Boolean);
      return { base: tag.trim().toLowerCase().split("-")[0], q: q === undefined ? 1 : Number(q), index };
    })
    .filter((item) => item.base && item.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return ranked.map((item) => item.base).find(isAdminLang) ?? null;
}

/**
 * Язык ответа API: явный заголовок кабинета, затем cookie, затем Accept-Language, иначе ru.
 * Заголовок важнее cookie: ответ должен совпасть с языком открытого интерфейса.
 */
export function pickLang({ header, cookie, acceptLanguage }: { header?: string | null; cookie?: string | null; acceptLanguage?: string | null }): AdminLang {
  if (isAdminLang(header)) return header;
  if (isAdminLang(cookie)) return cookie;
  return langFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LANG;
}

/** Строка Set-Cookie для document.cookie. */
export function langCookie(lang: AdminLang): string {
  return `${LANG_COOKIE}=${lang}; Path=/; Max-Age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/* ---------- форматы ---------- */

export function formatSize(bytes: number, lang: AdminLang = DEFAULT_LANG): string {
  if (bytes < 1024 * 1024) return translate(lang, "size.kb", { n: Math.max(1, Math.round(bytes / 1024)) });
  const mb = new Intl.NumberFormat(LOCALES[lang], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
  return translate(lang, "size.mb", { n: mb });
}

const dateFormats = new Map<AdminLang, Intl.DateTimeFormat>();
export function formatDateTime(iso: string, lang: AdminLang = DEFAULT_LANG): string {
  let format = dateFormats.get(lang);
  if (!format) {
    format = new Intl.DateTimeFormat(LOCALES[lang], { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    dateFormats.set(lang, format);
  }
  return format.format(new Date(iso));
}
