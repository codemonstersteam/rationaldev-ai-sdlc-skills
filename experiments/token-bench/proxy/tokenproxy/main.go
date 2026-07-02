// tokenproxy — self-contained token-logging reverse proxy for the bench.
// Forwards every request to UPSTREAM_URL (the real provider) passing auth headers through,
// and appends per-response token usage to PROXY_LOG as JSONL. No external deps.
//
// Ground-truth, harness-agnostic: both harnesses point their model baseURL at this proxy.
// Extraction is defensive across Anthropic (input/output_tokens) and OpenAI
// (prompt/completion_tokens), streaming (SSE) or not — it scans the response bytes.
//
// Env: PORT (4000) · UPSTREAM_URL (https://api.anthropic.com) · PROXY_LOG (usage.jsonl) · MODEL ("")
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

var (
	reOut         = regexp.MustCompile(`"output_tokens"\s*:\s*(\d+)`)
	reIn          = regexp.MustCompile(`"input_tokens"\s*:\s*(\d+)`)
	reComp        = regexp.MustCompile(`"completion_tokens"\s*:\s*(\d+)`)
	rePrm         = regexp.MustCompile(`"prompt_tokens"\s*:\s*(\d+)`)
	reCacheRead   = regexp.MustCompile(`"cache_read_input_tokens"\s*:\s*(\d+)`)
	reCacheCreate = regexp.MustCompile(`"cache_creation_input_tokens"\s*:\s*(\d+)`)
	reModel       = regexp.MustCompile(`"model"\s*:\s*"([^"]+)"`) // модель из ТЕЛА ЗАПРОСА (по назначению)
	logMu  sync.Mutex
	model  string
	logP   string
	flowP  string   // лог полного потока (тела запросов/ответов) — reconstruct flow later
	seq    uint64   // счётчик запросов для корреляции out↔in
	glmModelSub string   // подстрока модели, к которой применять provider.ignore (напр. "glm")
	glmIgnore   []string // OpenRouter-провайдеры, которых избегать для этих моделей (напр. Novita — рвёт tool-call)
)

// ctxKey несёт модель запроса и id от входного хендлера к ModifyResponse (по-запросно, конкурентно-безопасно).
type ctxKey int

const (
	modelKey ctxKey = 0
	idKey    ctxKey = 1
)

func reqModelFromCtx(r *http.Request) string {
	if r == nil {
		return ""
	}
	if v, ok := r.Context().Value(modelKey).(string); ok {
		return v
	}
	return ""
}

func reqIDFromCtx(r *http.Request) uint64 {
	if r == nil {
		return 0
	}
	if v, ok := r.Context().Value(idKey).(uint64); ok {
		return v
	}
	return 0
}

// logFlow пишет одну JSONL-строку в flowP (тело запроса/ответа). Тихо no-op при пустом flowP.
func logFlow(rec map[string]any) {
	if flowP == "" {
		return
	}
	line, _ := json.Marshal(rec)
	logMu.Lock()
	defer logMu.Unlock()
	if f, err := os.OpenFile(flowP, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644); err == nil {
		_, _ = f.Write(append(line, '\n'))
		_ = f.Close()
	}
}

func maxMatch(re *regexp.Regexp, b []byte) int {
	m := 0
	for _, g := range re.FindAllSubmatch(b, -1) {
		if n, err := strconv.Atoi(string(g[1])); err == nil && n > m {
			m = n
		}
	}
	return m
}

// teeBody scans the response stream (without buffering away from the client) and logs
// usage once, on EOF/Close. Anthropic streams cumulative output_tokens → we keep the max.
type teeBody struct {
	rc       io.ReadCloser
	buf      bytes.Buffer
	once     sync.Once
	reqModel string // модель из тела запроса (что реально запросила роль)
	reqID    uint64 // корреляция с out-записью
}

func (t *teeBody) Read(p []byte) (int, error) {
	n, err := t.rc.Read(p)
	if n > 0 {
		t.buf.Write(p[:n])
	}
	if err == io.EOF {
		t.flush()
	}
	return n, err
}

func (t *teeBody) Close() error {
	t.flush()
	return t.rc.Close()
}

func (t *teeBody) flush() {
	t.once.Do(func() {
		b := t.buf.Bytes()
		out := maxMatch(reOut, b)
		if c := maxMatch(reComp, b); c > out {
			out = c
		}
		in := maxMatch(reIn, b)
		if p := maxMatch(rePrm, b); p > in {
			in = p // OpenAI prompt_tokens — это уже суммарный input
		}
		cacheRead := maxMatch(reCacheRead, b)     // Anthropic: чтение из кэша
		cacheCreate := maxMatch(reCacheCreate, b) // Anthropic: запись в кэш
		inputTotal := in + cacheRead + cacheCreate
		if out == 0 && inputTotal == 0 {
			return // не запрос к модели (или нет usage) — не логируем
		}
		// Полный ответ (сырой SSE/JSON) в flow-лог — для реконструкции «что пришло in».
		logFlow(map[string]any{
			"ts":                time.Now().UTC().Format(time.RFC3339Nano),
			"id":                t.reqID,
			"dir":               "in",
			"req_model":         t.reqModel,
			"input_tokens":      inputTotal,
			"completion_tokens": out,
			"raw":               string(b),
		})
		rec := map[string]any{
			"ts":                    time.Now().UTC().Format(time.RFC3339),
			"model":                 model,       // метка прогона (env MODEL)
			"req_model":             t.reqModel,  // модель из тела запроса — проверка «по назначению»
			"prompt_tokens":         in,          // не-кэшированный input (совместимость)
			"cache_read_tokens":     cacheRead,
			"cache_creation_tokens": cacheCreate,
			"input_tokens":          inputTotal,  // ПОЛНЫЙ input = base + cache_read + cache_creation
			"completion_tokens":     out,
		}
		line, _ := json.Marshal(rec)
		logMu.Lock()
		defer logMu.Unlock()
		if f, err := os.OpenFile(logP, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644); err == nil {
			_, _ = f.Write(append(line, '\n'))
			_ = f.Close()
		}
	})
}

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func main() {
	port := env("PORT", "4000")
	upstream := env("UPSTREAM_URL", "https://api.anthropic.com")
	logP = env("PROXY_LOG", "usage.jsonl")
	flowP = env("FLOW_LOG", "flow.jsonl")
	model = env("MODEL", "")
	glmModelSub = env("GLM_MODEL_MATCH", "glm")
	if ig := strings.TrimSpace(os.Getenv("GLM_IGNORE_PROVIDERS")); ig != "" {
		for _, p := range strings.Split(ig, ",") {
			if p = strings.TrimSpace(p); p != "" {
				glmIgnore = append(glmIgnore, p)
			}
		}
	}

	target, err := url.Parse(upstream)
	if err != nil {
		log.Fatalf("bad UPSTREAM_URL: %v", err)
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	base := proxy.Director
	proxy.Director = func(r *http.Request) {
		base(r)
		r.Host = target.Host
		r.Header.Del("Accept-Encoding") // identity → regex видит usage в теле
	}
	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Body = &teeBody{rc: resp.Body, reqModel: reqModelFromCtx(resp.Request), reqID: reqIDFromCtx(resp.Request)}
		return nil
	}
	// Входной хендлер: считывает модель из тела запроса, кладёт в контекст, восстанавливает тело.
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rm := ""
		var id uint64
		if r.Body != nil {
			if b, err := io.ReadAll(r.Body); err == nil {
				_ = r.Body.Close()
				if m := reModel.FindSubmatch(b); m != nil {
					rm = string(m[1])
				}
				// Полное тело запроса (system+messages = весь контекст out) в flow-лог.
				// Только чат-запросы (есть messages), чтобы не шуметь служебными.
				if bytes.Contains(b, []byte(`"messages"`)) {
					id = atomic.AddUint64(&seq, 1)
					// GLM у Novita рвёт длинный tool-call-аргумент → форсим обход провайдера
					// (OpenRouter provider.ignore). Инъекция ДО лога, чтобы flow отражал реально отправленное.
					if glmModelSub != "" && len(glmIgnore) > 0 && strings.Contains(rm, glmModelSub) {
						var m map[string]any
						if json.Unmarshal(b, &m) == nil {
							prov, _ := m["provider"].(map[string]any)
							if prov == nil {
								prov = map[string]any{}
							}
							if _, ok := prov["ignore"]; !ok {
								prov["ignore"] = glmIgnore
							}
							if _, ok := prov["allow_fallbacks"]; !ok {
								prov["allow_fallbacks"] = true
							}
							m["provider"] = prov
							if nb, err := json.Marshal(m); err == nil {
								b = nb
							}
						}
					}
					var body any
					if json.Unmarshal(b, &body) != nil {
						body = string(b)
					}
					logFlow(map[string]any{
						"ts":        time.Now().UTC().Format(time.RFC3339Nano),
						"id":        id,
						"dir":       "out",
						"req_model": rm,
						"path":      r.URL.Path,
						"body":      body,
					})
				}
				r.Body = io.NopCloser(bytes.NewReader(b))
				r.ContentLength = int64(len(b))
			}
		}
		ctx := context.WithValue(r.Context(), modelKey, rm)
		ctx = context.WithValue(ctx, idKey, id)
		proxy.ServeHTTP(w, r.WithContext(ctx))
	})
	log.Printf("tokenproxy :%s → %s  log=%s", port, upstream, logP)
	log.Fatal(http.ListenAndServe(":"+port, h))
}
