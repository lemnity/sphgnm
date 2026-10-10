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
