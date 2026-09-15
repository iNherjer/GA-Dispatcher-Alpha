import vm from 'node:vm';
// Compile candidate boundaries without executing App code. This handles braces
// inside templates/comments and excludes assignments following a declaration.
export function extractOriginalFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing original function: ${name}`);
  let end = source.indexOf('\n}', start);
  while (end >= 0) {
    const candidate = source.slice(start, end + 2);
    try { new vm.Script(candidate); return candidate; } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    end = source.indexOf('\n}', end + 2);
  }
  throw new Error(`Unterminated original function: ${name}`);
}
