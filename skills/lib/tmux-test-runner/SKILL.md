---
name: tmux-test-runner
description: Run a long/interactive test command in a detached tmux pane with a shell watchdog that polls the pane, auto-answers only SAFE prompts via send-keys (default-yes confirms, Press-Enter, pager q) and pings the human for everything else (passwords, [y/N] default-no, destructive or unknown prompts). Use when tests may hang, ask for input, or run long enough that you should not block on them. Do NOT use for fast non-interactive tests — just run them. Written for weaker tiers: a script file (no quoting traps), a strict safe-prompt whitelist, short events. Needs bash + tmux.
version: "0.3"
status: draft
---

# tmux-test-runner — run tests in tmux, watch for stalls

Goal: never sit blocked on a test waiting for a keystroke. Run it in a named tmux pane;
a shell watchdog polls the pane, auto-answers a SMALL whitelist of safe prompts itself,
and pings the human for anything risky or unknown.

## 1. Procedure

**S1 — Start the test in a named pane.** Never run it in the foreground (you can't type
into a blocked foreground process). Reset the event log; capture the REAL exit code.

```sh
: > /tmp/tst.ev; rm -f /tmp/tst.rc
tmux new-session -d -s tst 'bash -lc "<test-cmd>; echo \$? > /tmp/tst.rc"'
```

> Two traps this avoids:
> - `\$?` (escaped) is evaluated by the *inner* shell after the test finishes; an
>   unescaped `$?` would be expanded by your shell to the wrong value before tmux runs.
> - The exit code goes to a **file**, not the pane. A tmux pane closes the instant its
>   command exits, so a `__DONE__` line printed to the pane is gone before the next poll
>   can see it. `/tmp/tst.rc` survives.

**S2 — Write the watchdog to a file, run it in its own pane.** A file avoids nested-quote
traps. The loop polls forever and only writes events — you never have to remember to poll.

```sh
cat > /tmp/tst-watch.sh <<'EOF'
#!/usr/bin/env bash
T=tst; EV=/tmp/tst.ev; RC=/tmp/tst.rc; prev=""; stall=0; answered=""
while true; do
  if [ -f "$RC" ]; then echo "__DONE__:$(cat "$RC")" >> "$EV"; break; fi   # finished (exit code from file)
  cur=$(tmux capture-pane -p -t "$T" 2>/dev/null | grep -v '^$' | tail -20)
  last=$(echo "$cur" | tail -1)
  ctx=$(echo "$cur" | tail -3 | tr '\n' ' ')
  if   [ "$last" = "$answered" ]; then :                                              # already answered (debounce)
  elif echo "$last" | grep -qiE 'password|passphrase|secret|token';        then echo "PROMPT|$ctx" >> "$EV"; answered="$last"
  elif echo "$last" | grep -qE  '\[Y/n\]';                                  then tmux send-keys -t "$T" y Enter;   echo "AUTO|y|$last"   >> "$EV"; answered="$last"
  elif echo "$last" | grep -qiE '\(yes/no\) ?\[yes\]';                      then tmux send-keys -t "$T" yes Enter; echo "AUTO|yes|$last" >> "$EV"; answered="$last"
  elif echo "$last" | grep -qiE 'press (enter|return|any key)';            then tmux send-keys -t "$T" Enter;     echo "AUTO|Enter|$last">> "$EV"; answered="$last"
  elif echo "$cur"  | grep -qE  '\(END\)|lines [0-9]+-[0-9]+';             then tmux send-keys -t "$T" q;         echo "AUTO|q|$last"   >> "$EV"; answered="$last"
  elif echo "$last" | grep -qE  '\[y/N\]|\(yes/no\)|[?:>][[:space:]]*$';    then echo "PROMPT|$ctx" >> "$EV"; answered="$last"   # default-no / unknown → human
  fi
  [ "$cur" = "$prev" ] && stall=$((stall+1)) || stall=0
  [ "$stall" -ge 3 ] && { echo "STALL|$ctx" >> "$EV"; stall=0; }
  prev="$cur"; sleep 5
done
EOF
tmux new-session -d -s wtch 'bash /tmp/tst-watch.sh'
```

**S3 — Read events, don't poll the pane yourself.** The loop never forgets; you just read:

```sh
tail -f /tmp/tst.ev   # or read new lines since last check
```

`AUTO|...` = loop already handled it (informational, ignore). `PROMPT|...` / `STALL|...`
need a human. `__DONE__:N` = finished. React per S4.

**S4 — Report (short).** On `PROMPT`/`STALL`, return ONE line, nothing else:

```
STALL tst | <last 3 lines> | answer it: `tmux attach -t tst`
```

`__DONE__:0` → `PASS tst`, stop. `__DONE__:N` (N≠0) → `FAIL tst rc=N` + last 3 lines, stop.

**S5 — Human acts.** `tmux attach -t tst`, type the answer, `Ctrl-b d` to detach. Loop resumes.

## 2. Rules

**Auto-answer ONLY this whitelist** (default is already safe; everything else → human):

| Last line | Reply | Why safe |
|---|---|---|
| `[Y/n]` (default **yes**) | `y` | confirming the default |
| `(yes/no) [yes]` (explicit default yes) | `yes` | needs full word `yes`, not `y` |
| `Press Enter/Return/any key` | Enter | pure acknowledgement |
| pager (`(END)`, `lines N-M`) | `q` | unblock `less`/`git` pager |

**NEVER auto-answer → escalate as `PROMPT`:** `[y/N]` and plain `(yes/no)` (default is **no**,
often a destructive/important question the watchdog can't judge), `password`/`passphrase`/
`secret`/`token`, or any unknown line ending in `?`/`:`/`>`. Safety is decided by the prompt's
*default*, not its wording — a weaker-tier model must not guess intent.

### STOP rules
- You poll the pane "by hand" each turn → stop. The `while` loop (S2) polls; you read `/tmp/tst.ev`.
- Test started in the foreground → stop, restart via S1.
- A prompt is NOT in the whitelist but you `send-keys` anyway → stop, escalate as `PROMPT`.
- Watcher invents events instead of reading the file → stop, it MUST read `/tmp/tst.ev`.
- Pane gone (`can't find session`) → report `LOST tst`, do not retry silently.

### Limitations (be honest)
- **STALL ≠ blocked.** `capture-pane` can't see whether the process is waiting on `read(stdin)`
  or just busy (compiling, downloading) with no output. A quiet-but-alive test fires a false
  `STALL` after ~15 s; a hang with no prompt text never auto-resolves. Treat `STALL` as "look",
  not "broken", and raise the `stall>=3`/`sleep 5` thresholds for genuinely slow suites.
- **One run at a time.** Names `tst`/`wtch`/`/tmp/tst.{ev,rc}` are fixed; a second concurrent
  run clobbers them. Parameterize the names if you need parallel runs.

## 3. Output
- Detached session `tst` (test) + `wtch` (watchdog); events in `/tmp/tst.ev`.
- Watcher emits only AUTO / PROMPT / STALL / PASS / FAIL — one short line each, no narration.
- Clean up: `tmux kill-session -t tst 2>/dev/null; tmux kill-session -t wtch; rm -f /tmp/tst.ev /tmp/tst.rc /tmp/tst-watch.sh`.
