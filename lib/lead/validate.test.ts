import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAD_LIMITS, validateLead } from "./validate.ts";

const TYPES = ["Green roof / podium", "Other"];
const base = { name: "  Jane Doe, Acme  ", email: " jane@example.com ", phone: "+971 50 123 4567", projectType: "Other" };

test("валидная заявка нормализуется", () => {
  const result = validateLead({ ...base, region: "Dubai\n\tUAE", message: "Line 1\r\n\r\n\r\n\r\nLine 2\u0007" }, TYPES);
  assert.ok(result.ok && "lead" in result);
  assert.deepEqual(result.lead, {
    name: "Jane Doe, Acme",
    email: "jane@example.com",
    phone: "+971 50 123 4567",
    region: "Dubai UAE",
    projectType: "Other",
    area: "",
    message: "Line 1\n\nLine 2",
  });
});

test("управляющие символы C0 и C1 вырезаются", () => {
  const result = validateLead({ ...base, name: "Jane\u0085\u009b Doe\u0000", message: "a\u0080b\u009fc" }, TYPES);
  assert.ok(result.ok && "lead" in result);
  assert.equal(result.lead.name, "Jane Doe");
  assert.equal(result.lead.message, "abc");
});

test("имя и почта обязательны", () => {
  assert.deepEqual(validateLead({ ...base, name: "   " }, TYPES), { ok: false, code: "nameRequired", error: "Please enter your name and company.", field: "name" });
  const noEmail = validateLead({ ...base, email: "" }, TYPES);
  assert.equal(!noEmail.ok && noEmail.code, "emailRequired");
});

test("формат почты", () => {
  for (const email of [
    "jane",
    "jane@",
    "@x.com",
    "jane@x",
    "ja ne@x.com",
    "jane@x.com\nBcc: a@b.c",
    "джейн@x.com",
    "<a@b.c>",
    // Подмешать Cc/тело в mailto: из письма команде
    "x?cc=victim%40evil.com&body=hi@evil.com",
    "a&b@x.com",
    "a=b@x.com",
    "a%b@x.com",
    "a`b@x.com",
    ".jane@x.com",
    "jane.@x.com",
    "ja..ne@x.com",
    "-jane@x.com",
  ]) {
    const result = validateLead({ ...base, email }, TYPES);
    assert.equal(!result.ok && result.code, "invalidEmail", email);
  }
  assert.ok(validateLead({ ...base, email: "first.last+tag@mail.example.co.uk" }, TYPES).ok);
  assert.ok(validateLead({ ...base, email: "o'neil-x_y@example.com" }, TYPES).ok);
});

test("пределы длины", () => {
  for (const [field, limit] of Object.entries(LEAD_LIMITS)) {
    if (field === "email" || field === "projectType") continue;
    const over = validateLead({ ...base, [field]: "x".repeat(limit + 1) }, TYPES);
    assert.deepEqual(!over.ok && [over.code, over.field], ["tooLong", field]);
    assert.ok(validateLead({ ...base, [field]: "x".repeat(limit) }, TYPES).ok, field);
  }
  const longEmail = validateLead({ ...base, email: `${"a".repeat(250)}@x.com` }, TYPES);
  assert.equal(!longEmail.ok && longEmail.code, "tooLong");
});

test("тип проекта — только из списка или пустой", () => {
  assert.ok(validateLead({ ...base, projectType: "" }, TYPES).ok);
  assert.ok(validateLead({ ...base, projectType: undefined }, TYPES).ok);
  const bad = validateLead({ ...base, projectType: "Free text" }, TYPES);
  assert.equal(!bad.ok && bad.code, "invalidProjectType");
});

test("ловушка: заполненное поле website — спам, даже при битых полях", () => {
  assert.deepEqual(validateLead({ website: "http://spam.example", email: "nope" }, TYPES), { ok: true, spam: true });
  assert.ok("lead" in (validateLead({ ...base, website: "  " }, TYPES) as object));
});

test("не объект или поля не строками — invalidRequest", () => {
  for (const input of [null, "x", 5, [], { ...base, name: 42 }, { ...base, message: { a: 1 } }]) {
    const result = validateLead(input, TYPES);
    assert.equal(!result.ok && result.code, "invalidRequest");
  }
});
