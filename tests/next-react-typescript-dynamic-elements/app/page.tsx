"use client";

import { useEffect, useState } from "react";

interface TestResult {
  name: string;
  status: "pending" | "pass" | "fail";
  detail: string;
}

export default function Home() {
  const [results, setResults] = useState<TestResult[]>([]);

  useEffect(() => {
    const tests: TestResult[] = [];

    function update(name: string, status: "pass" | "fail", detail: string) {
      const idx = tests.findIndex((t) => t.name === name);
      if (idx >= 0) {
        tests[idx] = { name, status, detail };
      }
      setResults([...tests]);
    }

    // ---------------------------------------------------------------
    // Test 1: createElement("script") with .src = "/dynamic-chunk.js"
    // This is the Turbopack pattern — loads a JS chunk via script tag
    // ---------------------------------------------------------------
    const t1Name = "script.src = '/dynamic-chunk.js'";
    tests.push({ name: t1Name, status: "pending", detail: "Loading..." });

    const script = document.createElement("script");
    script.src = "/dynamic-chunk.js";
    script.onload = () => {
      const ok = !!(window as unknown as Record<string, unknown>).__DYNAMIC_CHUNK_LOADED__;
      update(
        t1Name,
        ok ? "pass" : "fail",
        ok
          ? `Loaded — script.src resolved to: ${script.src}`
          : "Script loaded but global not set",
      );
    };
    script.onerror = () =>
      update(t1Name, "fail", `Failed to load — script.src was: ${script.src}`);
    document.head.appendChild(script);

    // ---------------------------------------------------------------
    // Test 2: createElement("link") with .href = "/extra-styles.css"
    // Dynamically injected stylesheet
    // ---------------------------------------------------------------
    const t2Name = "link.href = '/extra-styles.css'";
    tests.push({ name: t2Name, status: "pending", detail: "Loading..." });

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/extra-styles.css";
    link.onload = () =>
      update(
        t2Name,
        "pass",
        `Loaded — link.href resolved to: ${link.href}`,
      );
    link.onerror = () =>
      update(t2Name, "fail", `Failed to load — link.href was: ${link.href}`);
    document.head.appendChild(link);

    // ---------------------------------------------------------------
    // Test 3: createElement("img") with .src = "/test-image.svg"
    // Dynamically created image element
    // ---------------------------------------------------------------
    const t3Name = "img.src = '/test-image.svg'";
    tests.push({ name: t3Name, status: "pending", detail: "Loading..." });

    const img = document.createElement("img");
    img.src = "/test-image.svg";
    img.onload = () =>
      update(
        t3Name,
        "pass",
        `Loaded (${img.naturalWidth}×${img.naturalHeight}) — img.src resolved to: ${img.src}`,
      );
    img.onerror = () =>
      update(t3Name, "fail", `Failed to load — img.src was: ${img.src}`);
    document.getElementById("img-container")?.appendChild(img);

    // ---------------------------------------------------------------
    // Test 4: createElement("script") with setAttribute("src", ...)
    // Tests the setAttribute fallback path
    // ---------------------------------------------------------------
    const t4Name = "script.setAttribute('src', '/dynamic-chunk.js')";
    tests.push({ name: t4Name, status: "pending", detail: "Loading..." });

    const script2 = document.createElement("script");
    script2.setAttribute("src", "/dynamic-chunk.js?v=2");
    script2.onload = () =>
      update(
        t4Name,
        "pass",
        `Loaded — getAttribute('src'): ${script2.getAttribute("src")}`,
      );
    script2.onerror = () =>
      update(
        t4Name,
        "fail",
        `Failed — getAttribute('src'): ${script2.getAttribute("src")}`,
      );
    document.head.appendChild(script2);

    // ---------------------------------------------------------------
    // Test 5: fetch("/api/data") — existing shim (not createElement)
    // Baseline: ensures the fetch interceptor still works
    // ---------------------------------------------------------------
    const t5Name = "fetch('/api/data')";
    tests.push({ name: t5Name, status: "pending", detail: "Loading..." });

    fetch("/api/data")
      .then((r) => r.json())
      .then((data) =>
        update(
          t5Name,
          data.message ? "pass" : "fail",
          `Response: ${JSON.stringify(data).slice(0, 120)}`,
        ),
      )
      .catch((err) => update(t5Name, "fail", `Error: ${err.message}`));

    // ---------------------------------------------------------------
    // Test 6: Turbopack-style chunk path pattern
    // ---------------------------------------------------------------
    const t6Name = "script.src = '/_next/static/chunks/...'";
    tests.push({ name: t6Name, status: "pending", detail: "Checking URL rewrite..." });

    const script3 = document.createElement("script");
    script3.src = "/_next/static/chunks/fake-turbopack-chunk.js";
    // We expect this to 404 but the URL should be rewritten
    update(
      t6Name,
      script3.src.includes("/api/tunnel/") ? "pass" : "fail",
      `Resolved src: ${script3.src}`,
    );

    setResults([...tests]);
  }, []);

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const pendingCount = results.filter((r) => r.status === "pending").length;

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black p-8">
      <main className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold mb-2 text-black dark:text-white">
          createElement Shim Test
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Tests that dynamically created elements have their{" "}
          <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">src</code>
          /
          <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">href</code>{" "}
          attributes rewritten through the tunnel proxy.
        </p>

        <div className="mb-4 flex gap-4 text-sm font-medium">
          <span className="text-green-600">{passCount} passed</span>
          <span className="text-red-600">{failCount} failed</span>
          <span className="text-yellow-600">{pendingCount} pending</span>
        </div>

        <div className="flex flex-col gap-3">
          {results.map((r) => (
            <div
              key={r.name}
              className={`rounded-lg border p-4 ${
                r.status === "pass"
                  ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
                  : r.status === "fail"
                    ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                    : "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">
                  {r.status === "pass"
                    ? "\u2705"
                    : r.status === "fail"
                      ? "\u274c"
                      : "\u23f3"}
                </span>
                <code className="font-mono text-sm font-semibold text-black dark:text-white">
                  {r.name}
                </code>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono break-all">
                {r.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2 text-black dark:text-white">
            Dynamic Image Container
          </h2>
          <div
            id="img-container"
            className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-4 min-h-[100px] flex items-center justify-center"
          >
            <span className="text-zinc-400 text-sm">
              Image will appear here if loaded
            </span>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2 text-black dark:text-white">
            Dynamic CSS Test
          </h2>
          <p id="chunk-status" className="dynamic-css-loaded text-zinc-600 dark:text-zinc-400">
            Waiting for dynamic-chunk.js...
          </p>
        </div>

        <div className="mt-8 p-4 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
          <h3 className="text-sm font-semibold mb-2 text-black dark:text-white">
            How to test
          </h3>
          <ol className="text-sm text-zinc-600 dark:text-zinc-400 list-decimal list-inside space-y-1">
            <li>
              Run <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">npm run dev</code>{" "}
              (uses Turbopack)
            </li>
            <li>Start a tunnel pointing to the dev server port</li>
            <li>
              Open{" "}
              <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">
                https://softlight.orianna.ai/api/tunnel/&#123;tunnel_id&#125;/
              </code>
            </li>
            <li>
              All tests above should show <span className="text-green-600">green</span> if the
              createElement shim is working
            </li>
            <li>
              Test 6 (Turbopack chunk path) will only pass when accessed through the tunnel — it
              checks that the src was rewritten to include{" "}
              <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">/api/tunnel/</code>
            </li>
          </ol>
        </div>
      </main>
    </div>
  );
}
