/**
 * formula.ts — safe math expression evaluator for Cash Flow cells.
 *
 * Lets users type expressions like:
 *   15000+2500
 *   50000*0.15
 *   1000*12
 *   (3000+500)*1.07
 *   -200+1500
 *   50000*10%           ← percent as "× 0.01"
 *
 * Uses the shunting-yard algorithm (no `eval`, no `new Function`) so the
 * parser never executes arbitrary JS. Returns `null` for syntactically
 * invalid input so the caller can keep the edit mode open.
 *
 * Supported operators: + - * / and ( ).
 * Unary minus is supported at the start of an expression or right after
 * another operator or opening paren. `%` is treated as a postfix that
 * divides the preceding value by 100.
 *
 * Whitespace and thousand-separator commas are ignored.
 */

type Op = "+" | "-" | "*" | "/";

type Token =
  | { kind: "num"; value: number }
  | { kind: "op"; value: Op }
  | { kind: "lparen" }
  | { kind: "rparen" };

const PRECEDENCE: Record<Op, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
// All our operators are left-associative, so the classic shunting-yard
// "pop while top precedence >= current" rule applies uniformly.

/** True if the stripped string contains any operator/paren — i.e. worth parsing as a formula. */
export function looksLikeFormula(raw: string): boolean {
  const s = raw.replace(/[\s,]/g, "");
  if (!s) return false;
  return /[+\-*/()%]/.test(s.slice(1)); // ignore a leading "-" which is just a signed number
}

function tokenize(raw: string): Token[] | null {
  // Strip whitespace and thousands separators. Keep digits, operators, parens, dots, percent.
  const s = raw.replace(/[\s,]/g, "");
  if (!s) return null;

  const tokens: Token[] = [];
  let i = 0;

  // What kind of token can legally appear at position `i`?
  // After an operator or "(" or at the start → expecting a value (number / "(" / unary minus).
  // After a number or ")" → expecting an operator / ")" / "%".
  const expectsValue = (): boolean => {
    if (tokens.length === 0) return true;
    const last = tokens[tokens.length - 1];
    return last.kind === "op" || last.kind === "lparen";
  };

  while (i < s.length) {
    const ch = s[i];

    // Numbers (possibly starting with ".")
    if (/[0-9.]/.test(ch)) {
      let j = i;
      let sawDot = false;
      while (j < s.length && /[0-9.]/.test(s[j])) {
        if (s[j] === ".") {
          if (sawDot) return null;
          sawDot = true;
        }
        j++;
      }
      const numStr = s.slice(i, j);
      const n = Number(numStr);
      if (!Number.isFinite(n)) return null;
      tokens.push({ kind: "num", value: n });
      i = j;
      continue;
    }

    // Parens
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }

    // Operators
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      if ((ch === "+" || ch === "-") && expectsValue()) {
        // Unary sign → emit a synthetic 0 so "0 <op> X" parses correctly
        // for both the grammar and precedence rules.
        tokens.push({ kind: "num", value: 0 });
      }
      tokens.push({ kind: "op", value: ch as Op });
      i++;
      continue;
    }

    // Percent postfix → multiply the last value by 0.01.
    // We collapse immediately on the token stream so the rest of the
    // pipeline doesn't need a separate token kind.
    if (ch === "%") {
      const last = tokens[tokens.length - 1];
      if (!last || last.kind !== "num") return null;
      last.value = last.value / 100;
      i++;
      continue;
    }

    // Unknown character
    return null;
  }

  return tokens;
}

/** Shunting-yard → RPN */
function toRPN(tokens: Token[]): Token[] | null {
  const output: Token[] = [];
  const opStack: Token[] = [];

  for (const tok of tokens) {
    if (tok.kind === "num") {
      output.push(tok);
    } else if (tok.kind === "op") {
      while (opStack.length) {
        const top = opStack[opStack.length - 1];
        if (top.kind !== "op") break;
        if (PRECEDENCE[top.value] >= PRECEDENCE[tok.value]) {
          output.push(opStack.pop()!);
        } else break;
      }
      opStack.push(tok);
    } else if (tok.kind === "lparen") {
      opStack.push(tok);
    } else if (tok.kind === "rparen") {
      let matched = false;
      while (opStack.length) {
        const top = opStack.pop()!;
        if (top.kind === "lparen") {
          matched = true;
          break;
        }
        output.push(top);
      }
      if (!matched) return null; // mismatched )
    }
  }

  while (opStack.length) {
    const top = opStack.pop()!;
    if (top.kind === "lparen" || top.kind === "rparen") return null;
    output.push(top);
  }
  return output;
}

/** Evaluate RPN */
function evalRPN(rpn: Token[]): number | null {
  const stack: number[] = [];
  for (const tok of rpn) {
    if (tok.kind === "num") {
      stack.push(tok.value);
    } else if (tok.kind === "op") {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) return null;
      let r: number;
      switch (tok.value) {
        case "+": r = a + b; break;
        case "-": r = a - b; break;
        case "*": r = a * b; break;
        case "/":
          if (b === 0) return null;
          r = a / b;
          break;
      }
      if (!Number.isFinite(r)) return null;
      stack.push(r);
    }
  }
  if (stack.length !== 1) return null;
  return stack[0];
}

/**
 * Evaluate an expression. Returns null for invalid input.
 * Plain numbers like "1,000.50" also evaluate fine — commas are stripped.
 */
export function evalFormula(expr: string): number | null {
  const toks = tokenize(expr);
  if (!toks || toks.length === 0) return null;
  const rpn = toRPN(toks);
  if (!rpn) return null;
  return evalRPN(rpn);
}
