// Минимальный парсер frontmatter (подмножество YAML под схему ролей/скиллов).
// Поддержка: скаляры, flow-массивы [a, b], вложенные карты по отступам (2 пробела).
// Общий для gen-agents.mjs (роли) и gen-skill-index.mjs (скиллы) — один парсер, не два.

function unquote(s) {
  s = s.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1)
  return s
}

function parseScalar(v) {
  v = v.trim()
  if (v.startsWith('"') || v.startsWith("'")) return unquote(v)
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim()
    return inner === "" ? [] : inner.split(",").map((s) => parseScalar(s))
  }
  return v
}

function parseYaml(src) {
  const root = {}
  const stack = [{ indent: -1, obj: root }]
  for (const raw of src.split("\n")) {
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue
    const indent = raw.length - raw.replace(/^\s+/, "").length
    const ci = raw.indexOf(":")
    if (ci === -1) continue
    const key = unquote(raw.slice(0, ci))
    const val = raw.slice(ci + 1).trim()
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const parent = stack[stack.length - 1].obj
    if (val === "") {
      const child = {}
      parent[key] = child
      stack.push({ indent, obj: child })
    } else {
      parent[key] = parseScalar(val)
    }
  }
  return root
}

// Разбирает `---\n<yaml>\n---\n<body>`. Без frontmatter → { data: null, body: text }.
// CRLF-устойчиво: на Windows git раскладывает файлы с \r\n — нормализуем до \n,
// иначе делимитер `---` не совпадёт и весь харнес «теряет» frontmatter.
export function parseFrontmatter(text) {
  text = text.replace(/\r\n/g, "\n")
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { data: null, body: text }
  return { data: parseYaml(m[1]), body: m[2] }
}
