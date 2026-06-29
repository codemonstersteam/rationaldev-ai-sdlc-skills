// Reference implementation of the bench task — used ONLY to self-test the stop-line
// (bench/acceptance/check.sh). It is NOT shown to the harnesses under test. Stdlib only
// (minimal YAML reader for the fixed fixture shape), so the self-test needs no network.
package main

import (
	"encoding/json"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
)

type Service struct {
	Platform  string `json:"platform"`
	Service   string `json:"service"`
	GitURL    string `json:"git_url"`
	Commits2m int    `json:"commits_2m"`
}

func load(path string) ([]Service, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var out []Service
	var cur *Service
	for _, line := range strings.Split(string(b), "\n") {
		t := strings.TrimSpace(line)
		if t == "" || strings.HasPrefix(t, "#") || t == "services:" {
			continue
		}
		if strings.HasPrefix(t, "- ") {
			out = append(out, Service{})
			cur = &out[len(out)-1]
			t = strings.TrimSpace(t[2:])
		}
		if cur == nil {
			continue
		}
		k, v, ok := strings.Cut(t, ":")
		if !ok {
			continue
		}
		k, v = strings.TrimSpace(k), strings.TrimSpace(v)
		switch k {
		case "platform":
			cur.Platform = v
		case "service":
			cur.Service = v
		case "git_url":
			cur.GitURL = v
		case "commits_2m":
			cur.Commits2m, _ = strconv.Atoi(v)
		}
	}
	return out, nil
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	path := os.Getenv("SERVICES_YAML")
	if path == "" {
		path = "services.yaml"
	}
	http.HandleFunc("/services", func(w http.ResponseWriter, r *http.Request) {
		svcs, err := load(path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		sort.Slice(svcs, func(i, j int) bool {
			if svcs[i].Platform != svcs[j].Platform {
				return svcs[i].Platform < svcs[j].Platform
			}
			return svcs[i].Service < svcs[j].Service
		})
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(svcs)
	})
	_ = http.ListenAndServe(":"+port, nil)
}
