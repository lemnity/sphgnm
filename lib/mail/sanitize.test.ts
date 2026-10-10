import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMessage } from "./parse.ts";
import { buildSrcdoc, isDangerousUrl, mailCsp, sanitizeHtml } from "./sanitize.ts";

test("скрипты, фреймы, объекты, формы и meta refresh вырезаются", () => {
  const html = sanitizeHtml(
    [
      "<p>ok</p>",
      "<script>alert(1)</script>",
      "<SCRIPT type=text/javascript>alert(2)</SCRIPT >",
      "<script>never closed",
    ].join(""),
  );
  assert.equal(html, "<p>ok</p>");
  const rest = sanitizeHtml(
    '<iframe src="https://e.x"></iframe><object data="x.swf"><param name=a></object><embed src="x"><form action="https://e.x"><input name="q"></form>' +
      '<meta http-equiv="refresh" content="0;url=https://e.x"><base href="https://e.x/"><link rel=stylesheet href="https://e.x/a.css"><template><img src=x onerror=alert(1)></template>',
  );
  assert.equal(rest, '<input name="q">');
});

test("обработчики on* и javascript:-ссылки удаляются, в том числе замаскированные", () => {
  const html = sanitizeHtml(
    [
      '<img src="x" onerror="alert(1)" ONLOAD=alert(2) alt="a">',
      '<a href="javascript:alert(1)">1</a>',
      '<a href="  JaVaScRiPt:alert(1)">2</a>',
      '<a href="jav&#x61;script:alert(1)">3</a>',
      '<a href="jav&#9;ascript:alert(1)">4</a>',
      '<a href="java\nscript:alert(1)">5</a>',
      '<img src="data:text/html;base64,PHNjcmlwdD4=">',
      '<img src="data:image/png;base64,iVBORw0KGgo=">',
      '<div style="width:expression(alert(1))">s</div>',
      '<svg><a xlink:href="javascript:alert(1)"><text>t</text></a><animate attributeName="href" to="javascript:alert(1)"/></svg>',
      '<a href="https://example.com/offer" target="_blank">ok</a>',
    ].join(""),
  );
  assert.doesNotMatch(html, /on(error|load)=/i);
  assert.doesNotMatch(html, /javascript|jav&#x61;|data:text/i);
  assert.doesNotMatch(html, /expression|animate|target=/i);
  assert.match(html, /^<img src="x" alt="a">/);
  assert.match(html, /<img src="data:image\/png;base64,iVBORw0KGgo=">/);
  // Ссылки в песочнице не открываются: адрес — подсказка при наведении.
  assert.match(html, /<a title="https:\/\/example\.com\/offer">ok<\/a>/);
  assert.doesNotMatch(html, /href=/);
});

test("кавычки в значениях и мусорные «<» не ломают разметку", () => {
  assert.equal(sanitizeHtml(`<p title='a"b'>x</p>`), '<p title="a&quot;b">x</p>');
  assert.equal(sanitizeHtml("1 < 2 <3 <!-- c --> <!doctype html>"), "1 &lt; 2 &lt;3  ");
  // Незакрытая кавычка съедает остаток в значение атрибута — наружу он не вытекает.
  assert.equal(sanitizeHtml('<p class="unterminated>x<script>'), '<p class="unterminated>x<script>">');
});

test("isDangerousUrl", () => {
  assert.equal(isDangerousUrl("https://x"), false);
  assert.equal(isDangerousUrl("mailto:a@b.c"), false);
  assert.equal(isDangerousUrl("vbscript:x"), true);
  assert.equal(isDangerousUrl("data:image/png;base64,x"), true);
  assert.equal(isDangerousUrl("data:image/png;base64,x", true), false);
  assert.equal(isDangerousUrl("data:image/svg+xml;base64,x", true), true);
});

test("srcdoc: CSP первой строкой, картинки по https — только по флагу", () => {
  assert.equal(mailCsp(false), "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:");
  assert.match(mailCsp(true), /img-src data: https:;/);
  const doc = buildSrcdoc("<p>x</p>", false);
  assert.ok(doc.indexOf("Content-Security-Policy") < doc.indexOf("<p>x</p>"));
  assert.match(doc, /^<!doctype html><html><head><meta http-equiv="Content-Security-Policy"/);
});

test("письмо из фикстуры: после очистки ни скриптов, ни обработчиков", () => {
  const message = parseMessage(readFileSync(new URL("./fixtures/alternative.eml", import.meta.url)));
  const clean = sanitizeHtml(message.html);
  assert.doesNotMatch(clean, /<script|onload|onerror|javascript:|<iframe|<form|refresh|HACKED/i);
  assert.match(clean, /<img id="pixel" src="https:\/\/tracker\.example\/pixel\.png" alt="pixel">/);
  assert.match(clean, /<a title="https:\/\/greenroofs\.example\/offer">good link<\/a>/);
});

/* ---------- регрессии по ревью безопасности ---------- */

/** Нет ни живой ссылки, ни перехода, ни загрузки из сети, кроме <img src> (его режет CSP). */
function assertInert(html: string) {
  assert.doesNotMatch(html, /\shref=|xlink:href|<meta|<base|<link|<script|<style|<title|<textarea|<svg|<math|<noscript|<iframe|on[a-z]+=|javascript:/i, html);
  for (const tag of html.matchAll(/<([a-z0-9]+)([^>]*)>/gi)) {
    if (tag[1].toLowerCase() !== "img") assert.doesNotMatch(tag[2], /\s(src|srcset|poster|background|action|data)=/i, tag[0]);
  }
}

test("сырой текст: title/textarea/style/noscript вырезаются с содержимым — разметка из атрибута не оживает", () => {
  const port = 41234;
  const payloads = [
    // Точный пример из ревью: в браузере это была живая ссылка на весь экран.
    `<title><b title="</title><meta http-equiv=refresh content='0;url=http://localhost:${port}/refresh'><a id=l href='http://localhost:${port}/click' style='display:block;position:fixed;inset:0'>X</a><img src='http://localhost:${port}/img'>"></b></title><p>hi</p>`,
    '<style><a title="</style><img src=x onerror=alert(1)>"></a></style><p>hi</p>',
    '<style><a title="</style><script>alert(1)</script><meta http-equiv=refresh content=0;url=https://e.x>"></a></style><p>hi</p>',
    '<title><b title="</title><base href=https://e.x>"></b></title><p>hi</p>',
    '<title><b title="</title><base href=https://e.x><link rel=dns-prefetch href=//e.x>"></b></title><p>hi</p>',
    '<textarea><b title="</textarea><img src=x onerror=1>"></b></textarea><p>hi</p>',
    '<noscript><p title="</noscript><img src=x onerror=1>"></noscript><p>hi</p>',
    '<xmp><a title="</xmp><a href=https://e.x>x</a>"></xmp><p>hi</p>',
    '<noembed><a title="</noembed><a href=https://e.x>x</a>"></noembed><p>hi</p>',
    '<STYLE >p{}</STYLE><Title>t</TITLE ><p>hi</p>',
  ];
  // Сырой текст кончается на первом «</title» — как в браузере; хвост после него уже
  // разбирается как обычная разметка и тоже чистится: ссылка без href, без meta refresh.
  for (const payload of payloads) {
    const clean = sanitizeHtml(payload);
    assertInert(clean);
    assert.ok(clean.endsWith("<p>hi</p>"), clean);
  }
  assert.equal(sanitizeHtml(payloads[1]), '<img src="x">"></a><p>hi</p>');
});

test("svg и math вырезаются целиком: ни xlink:href, ни CDATA, ни <a> внутри", () => {
  const payloads = [
    // Точный пример из ревью: красный прямоугольник-ссылка на всё окно.
    "<svg width=600 height=400><a xlink:href='http://localhost:4000/svgclick'><rect width=600 height=400 fill=red /></a></svg><p>hi</p>",
    '<svg><style><a title="</style><img src=x onerror=1>"></svg><p>hi</p>',
    '<svg><![CDATA[><a title="]]><img src=https://e.x/a.png>">]]></svg><p>hi</p>',
    '<svg><use href="data:image/svg+xml,..."/><a xlink:href="javascript:1">x</a><image href="https://e.x"/><feImage href=https://e.x /></svg><p>hi</p>',
    "<math><mtext><table><mglyph><style><img src=x onerror=1></style></math><p>hi</p>",
    '<math href="https://e.x"><mi xlink:href="https://e.x">x</mi></math><p>hi</p>',
  ];
  for (const payload of payloads) {
    const clean = sanitizeHtml(payload);
    assertInert(clean);
    assert.equal(clean, "<p>hi</p>", payload);
  }
});

test("ссылочные атрибуты: href/xlink:href → title только у a/area; src/srcset — только у img", () => {
  const clean = sanitizeHtml(
    [
      '<a xlink:href="https://e.x/1">a</a>',
      '<area href="https://e.x/2">',
      '<div href="https://e.x/3" xlink:href="https://e.x/4">d</div>',
      '<input type=image src=https://e.x/a><video poster=https://e.x src=https://e.x/v><source src=https://e.x></video><object data=x>o</object>',
      '<table background="https://e.x/bg"><tr><td>c</td></tr></table>',
      '<image src="https://e.x/i.png">',
      '<img src=https://e.x/p.png srcset="https://e.x/1 1x">',
      '<img src="x" style="background:url(https://e.x)">',
      '<p style="color:red">ok</p><p style="background:image-set(&quot;https://e.x&quot; 1x)">b</p><p style="u\\72l(x)">c</p><p style="@import x">d</p>',
    ].join(""),
  );
  assertInert(clean);
  assert.match(clean, /<a title="https:\/\/e\.x\/1">a<\/a>/);
  assert.match(clean, /<area title="https:\/\/e\.x\/2">/);
  assert.match(clean, /<div>d<\/div>/);
  assert.match(clean, /<img src="https:\/\/e\.x\/p\.png" srcset="https:\/\/e\.x\/1 1x">/);
  assert.match(clean, /<img src="x">/);
  assert.match(clean, /<p style="color:red">ok<\/p><p>b<\/p><p>c<\/p><p>d<\/p>/);
});

test("прочие обходы из ревью: атрибуты без пробелов, NUL в имени, CSP внутри письма", () => {
  const clean = sanitizeHtml('<img/src=x/onerror=alert(1)>|<img src=x\nonerror=1>|<div a=b"onclick=1>|<x o\u0000nclick=1 on\u000cx=1>');
  assert.doesNotMatch(clean, /\son[a-z]*=/i);
  const doc = buildSrcdoc(sanitizeHtml('</head><meta http-equiv=Content-Security-Policy content="img-src *">'), false);
  assert.equal((doc.match(/Content-Security-Policy/g) ?? []).length, 1);
});

test("письмо-фикстура с обходами: после разбора и очистки ничего живого, bidi в именах убран", () => {
  const message = parseMessage(readFileSync(new URL("./fixtures/evil-links.eml", import.meta.url)));
  const clean = sanitizeHtml(message.html);
  assertInert(clean);
  assert.match(clean, /<p id="evil">Evil links<\/p>/);
  assert.match(clean, /<a id="l" title="https:\/\/tracker\.example\/click"/);
  assert.equal(message.from, "Злоумышленник gpj.exe <evil@attacker.example>");
  assert.equal(message.attachments[0].name, "invoicefdp.exe");
  assert.equal(message.date, "2026-10-09T06:00:00.000Z");
});
