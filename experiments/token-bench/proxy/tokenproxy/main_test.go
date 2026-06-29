// Компонентный тест прокси: проверяет ground-truth учёт токенов и метку модели,
// которые tokenproxy пишет в PROXY_LOG. Прогон: go test ./... (в каталоге tokenproxy).
//
// teeBody сканирует тело ответа и на EOF/Close один раз пишет JSONL-запись. Тест
// прогоняет через него разные формы ответов (Anthropic / OpenAI, со стримом и без)
// и сверяет записанную модель + арифметику токенов.
package main

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// drive прогоняет body через teeBody (как реальный ответ апстрима) под меткой
// модели modelLabel и возвращает последнюю запись из лога (nil — если не писалось).
func drive(t *testing.T, body, modelLabel string) map[string]float64 {
	t.Helper()
	logP = filepath.Join(t.TempDir(), "usage.jsonl") // пакетные глобалы прокси
	model = modelLabel
	tb := &teeBody{rc: io.NopCloser(strings.NewReader(body))}
	if _, err := io.ReadAll(tb); err != nil { // дочитываем до EOF → flush
		t.Fatalf("read: %v", err)
	}
	_ = tb.Close()

	raw, err := os.ReadFile(logP)
	if err != nil || len(strings.TrimSpace(string(raw))) == 0 {
		return nil // лог не писался
	}
	lines := strings.Split(strings.TrimSpace(string(raw)), "\n")
	var rec map[string]any
	if err := json.Unmarshal([]byte(lines[len(lines)-1]), &rec); err != nil {
		t.Fatalf("bad jsonl: %v", err)
	}
	out := map[string]float64{}
	for k, v := range rec {
		if f, ok := v.(float64); ok {
			out[k] = f
		}
	}
	if m, _ := rec["model"].(string); m != modelLabel {
		t.Fatalf("model в логе = %q, ожидалось %q", m, modelLabel)
	}
	return out
}

func eq(t *testing.T, got map[string]float64, key string, want float64) {
	t.Helper()
	if got == nil {
		t.Fatalf("%s: записи в логе нет", key)
	}
	if got[key] != want {
		t.Errorf("%s = %v, ожидалось %v", key, got[key], want)
	}
}

func TestAnthropicNonStream(t *testing.T) {
	r := drive(t, `{"usage":{"input_tokens":10,"output_tokens":5}}`, "big-model")
	eq(t, r, "input_tokens", 10)
	eq(t, r, "completion_tokens", 5)
}

func TestAnthropicCache(t *testing.T) {
	// inputTotal = base(10) + cache_read(3) + cache_creation(2) = 15
	r := drive(t, `{"input_tokens":10,"cache_read_input_tokens":3,"cache_creation_input_tokens":2,"output_tokens":7}`, "big-model")
	eq(t, r, "input_tokens", 15)
	eq(t, r, "cache_read_tokens", 3)
	eq(t, r, "cache_creation_tokens", 2)
	eq(t, r, "completion_tokens", 7)
}

func TestOpenAIShape(t *testing.T) {
	r := drive(t, `{"usage":{"prompt_tokens":20,"completion_tokens":9}}`, "mid-model")
	eq(t, r, "input_tokens", 20) // prompt_tokens → input
	eq(t, r, "completion_tokens", 9)
}

func TestStreamingCumulativeMax(t *testing.T) {
	// Anthropic SSE: output_tokens кумулятивно растёт — берём максимум.
	body := strings.Join([]string{
		`event: message_start`,
		`data: {"usage":{"input_tokens":12,"output_tokens":1}}`,
		`data: {"usage":{"output_tokens":4}}`,
		`data: {"usage":{"output_tokens":11}}`,
	}, "\n")
	r := drive(t, body, "big-model")
	eq(t, r, "input_tokens", 12)
	eq(t, r, "completion_tokens", 11) // max, не сумма
}

func TestNoUsageNotLogged(t *testing.T) {
	if r := drive(t, `{"hello":"world","choices":[]}`, "x"); r != nil {
		t.Errorf("ответ без usage не должен логироваться, получили %v", r)
	}
}
