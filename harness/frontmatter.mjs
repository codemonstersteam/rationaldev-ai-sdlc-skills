// Минимальный парсер frontmatter (подмножество YAML под схему ролей/скиллов).
// Поддержка: скаляры, flow-массивы [a, b], BLOCK-массивы (key:\n  - a\n  - b), вложенные карты
// по отступам (2 пробела). Общий для gen-agents.mjs (роли) и gen-skill-index.mjs (скиллы) — один парсер.
// Block-списки — потому что модель естественно эмитит их на длинных путях (outputs тикета); парсер
// должен принять стандартный YAML, а не заставлять втискивать всё в flow (робастность «в базе без ретраев»).

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
  const stack = [{ indent: -1, container: root }]
  // только значимые строки (без пустых/комментов) — чтобы lookahead смотрел на след. РЕАЛЬНУЮ строку.
  const lines = src.split("\n").filter((l) => l.trim() !== "" && !l.trim().startsWith("#"))
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const indent = raw.length - raw.replace(/^\s+/, "").length
    const trimmed = raw.trim()
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const container = stack[stack.length - 1].container
    if (trimmed.startsWith("- ")) {                 // элемент block-массива
      if (Array.isArray(container)) container.push(parseScalar(trimmed.slice(2)))
      continue
    }
    const ci = trimmed.indexOf(":")
    if (ci === -1) continue
    const key = unquote(trimmed.slice(0, ci))
    const val = trimmed.slice(ci + 1).trim()
    if (val === "") {                                // block-массив ИЛИ вложенная карта — по след. строке
      const next = lines[i + 1]
      const nextIndent = next ? next.length - next.replace(/^\s+/, "").length : -1
      const isSeq = next && nextIndent > indent && next.trim().startsWith("- ")
      const child = isSeq ? [] : {}
      container[key] = child
      stack.push({ indent, container: child })
    } else {
      container[key] = parseScalar(val)
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
