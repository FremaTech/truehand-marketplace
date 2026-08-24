#!/usr/bin/env node
/**
 * Calcolatrice — AOS App engine (Node).
 *
 * La UI è interamente client-side (ui/index.html), quindi questo entry serve
 * solo come endpoint opzionale per uso agent-to-agent / CLI:
 *
 *   POST /api/apps/calcolatrice/run  { "args": ["eval", "sin(30)", "--deg"] }
 *   POST /api/apps/calcolatrice/run  { "args": ["info"] }
 *
 * Nessun eval() di JS: l'espressione è valutata con un parser shunting-yard
 * sicuro che accetta solo numeri, operatori e funzioni note.
 */
"use strict";

// ─── Safe math expression evaluator (shunting-yard) ─────────────────────────
const FUNCS = {
  sin: (x, deg) => Math.sin(deg ? (x * Math.PI) / 180 : x),
  cos: (x, deg) => Math.cos(deg ? (x * Math.PI) / 180 : x),
  tan: (x, deg) => Math.tan(deg ? (x * Math.PI) / 180 : x),
  asin: (x, deg) => (deg ? (Math.asin(x) * 180) / Math.PI : Math.asin(x)),
  acos: (x, deg) => (deg ? (Math.acos(x) * 180) / Math.PI : Math.acos(x)),
  atan: (x, deg) => (deg ? (Math.atan(x) * 180) / Math.PI : Math.atan(x)),
  log: (x) => Math.log10(x),
  ln: (x) => Math.log(x),
  sqrt: (x) => Math.sqrt(x),
  abs: (x) => Math.abs(x),
  exp: (x) => Math.exp(x),
};
const CONSTS = { pi: Math.PI, e: Math.E };
const PREC = { "+": 2, "-": 2, "*": 3, "/": 3, "u-": 4, "^": 5 };
const RIGHT = { "^": true, "u-": true };

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function tokenize(src) {
  const s = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/π/g, "pi").replace(/√/g, "sqrt").replace(/\s+/g, "");
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
      if ((num.match(/\./g) || []).length > 1) throw new Error("numero non valido");
      tokens.push({ t: "num", v: parseFloat(num) });
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let name = "";
      while (i < s.length && /[a-zA-Z]/.test(s[i])) name += s[i++];
      const lname = name.toLowerCase();
      if (FUNCS[lname]) tokens.push({ t: "func", v: lname });
      else if (CONSTS[lname] !== undefined) tokens.push({ t: "num", v: CONSTS[lname] });
      else throw new Error(`identificatore sconosciuto: "${name}"`);
      continue;
    }
    if ("+-*/^".includes(c)) { tokens.push({ t: "op", v: c }); i++; continue; }
    if (c === "(") { tokens.push({ t: "lparen" }); i++; continue; }
    if (c === ")") { tokens.push({ t: "rparen" }); i++; continue; }
    if (c === "!") { tokens.push({ t: "post", v: "!" }); i++; continue; }
    if (c === "%") { tokens.push({ t: "post", v: "%" }); i++; continue; }
    throw new Error(`carattere non valido: "${c}"`);
  }
  return tokens;
}

function toRPN(tokens) {
  const out = [];
  const stack = [];
  let prev = null;
  for (let k = 0; k < tokens.length; k++) {
    const tk = tokens[k];
    // implicit multiplication: 2pi, 3(4), )(, 2sin(..)
    if (prev && (tk.t === "num" || tk.t === "func" || tk.t === "lparen")) {
      if (prev.t === "num" || prev.t === "rparen" || prev.t === "post") {
        while (stack.length && stack[stack.length - 1].t === "op" && PREC[stack[stack.length - 1].v] >= PREC["*"]) out.push(stack.pop());
        stack.push({ t: "op", v: "*" });
      }
    }
    if (tk.t === "num") out.push(tk);
    else if (tk.t === "func") stack.push(tk);
    else if (tk.t === "post") out.push(tk);
    else if (tk.t === "op") {
      let op = tk.v;
      const unary = op === "-" && (!prev || prev.t === "op" || prev.t === "lparen");
      if (unary) op = "u-";
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t === "op" && (PREC[top.v] > PREC[op] || (PREC[top.v] === PREC[op] && !RIGHT[op]))) out.push(stack.pop());
        else break;
      }
      stack.push({ t: "op", v: op });
    } else if (tk.t === "lparen") stack.push(tk);
    else if (tk.t === "rparen") {
      while (stack.length && stack[stack.length - 1].t !== "lparen") out.push(stack.pop());
      if (!stack.length) throw new Error("parentesi non bilanciate");
      stack.pop();
      if (stack.length && stack[stack.length - 1].t === "func") out.push(stack.pop());
    }
    prev = tk;
  }
  while (stack.length) {
    const top = stack.pop();
    if (top.t === "lparen") throw new Error("parentesi non bilanciate");
    out.push(top);
  }
  return out;
}

function evalRPN(rpn, deg) {
  const st = [];
  for (const tk of rpn) {
    if (tk.t === "num") st.push(tk.v);
    else if (tk.t === "func") {
      if (!st.length) throw new Error("espressione incompleta");
      st.push(FUNCS[tk.v](st.pop(), deg));
    } else if (tk.t === "post") {
      if (!st.length) throw new Error("espressione incompleta");
      const a = st.pop();
      st.push(tk.v === "!" ? factorial(a) : a / 100);
    } else if (tk.t === "op") {
      if (tk.v === "u-") { st.push(-st.pop()); continue; }
      if (st.length < 2) throw new Error("espressione incompleta");
      const b = st.pop(), a = st.pop();
      st.push(tk.v === "+" ? a + b : tk.v === "-" ? a - b : tk.v === "*" ? a * b : tk.v === "/" ? a / b : Math.pow(a, b));
    }
  }
  if (st.length !== 1) throw new Error("espressione non valida");
  return st[0];
}

function calc(expr, deg) {
  return evalRPN(toRPN(tokenize(expr)), !!deg);
}

// ─── CLI dispatch ───────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || "info";

  if (cmd === "info" || cmd === "--help" || cmd === "help") {
    console.log(JSON.stringify({
      ok: true,
      app: "calcolatrice",
      ui: "/api/apps/calcolatrice/ui/index.html",
      commands: {
        eval: "eval <espressione> [--deg|--rad]  → valuta un'espressione matematica",
        info: "info  → questo messaggio",
      },
      esempi: ["eval 2+2*3", "eval sin(30) --deg", "eval sqrt(2)^2", "eval 5!"],
    }, null, 2));
    return;
  }

  if (cmd === "eval") {
    const deg = args.includes("--deg");
    const expr = args.slice(1).filter((a) => a !== "--deg" && a !== "--rad").join(" ");
    if (!expr) { console.log(JSON.stringify({ ok: false, error: "espressione mancante" })); process.exitCode = 1; return; }
    try {
      const result = calc(expr, deg);
      console.log(JSON.stringify({ ok: true, expr, mode: deg ? "DEG" : "RAD", result }));
    } catch (e) {
      console.log(JSON.stringify({ ok: false, expr, error: String(e.message || e) }));
      process.exitCode = 1;
    }
    return;
  }

  console.log(JSON.stringify({ ok: false, error: `comando sconosciuto: "${cmd}". Usa "info" o "eval".` }));
  process.exitCode = 1;
}

main();
