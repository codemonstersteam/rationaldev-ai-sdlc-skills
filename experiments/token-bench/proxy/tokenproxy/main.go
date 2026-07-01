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
	"sync"
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
)

// ctxKey несёт модель запроса от входного хендлера к ModifyResponse (по-запросно, конкурентно-безопасно).
type ctxKey int

const modelKey ctxKey = 0

func reqModelFromCtx(r *http.Request) string {
	if r == nil {
		return ""
	}
	if v, ok := r.Context().Value(modelKey).(string); ok {
		return v
	}
	return ""
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
	model = env("MODEL", "")

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
		resp.Body = &teeBody{rc: resp.Body, reqModel: reqModelFromCtx(resp.Request)}
		return nil
	}
	// Входной хендлер: считывает модель из тела запроса, кладёт в контекст, восстанавливает тело.
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rm := ""
		if r.Body != nil {
			if b, err := io.ReadAll(r.Body); err == nil {
				_ = r.Body.Close()
				if m := reModel.FindSubmatch(b); m != nil {
					rm = string(m[1])
				}
				r.Body = io.NopCloser(bytes.NewReader(b))
				r.ContentLength = int64(len(b))
			}
		}
		proxy.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), modelKey, rm)))
	})
	log.Printf("tokenproxy :%s → %s  log=%s", port, upstream, logP)
	log.Fatal(http.ListenAndServe(":"+port, h))
}
