# For IT and compliance: what Local AI Chat does with data

This page is written for the person who has to decide whether the app may be used, not for the person
who wants to chat. It describes what the software does. It is not legal advice and it does not replace
your own assessment (GDPR role questions, a data protection impact assessment, the EU AI Act, your
organisation's policies).

## In one table

| Data                                     | Where it is processed                                    | Leaves the device?                 |
| ---------------------------------------- | -------------------------------------------------------- | ---------------------------------- |
| Text typed into the chat                 | In the browser tab, in a worker thread, in memory        | **No**                             |
| Model answers                            | Generated in the same worker                             | **No**                             |
| Saved conversations                      | Stored in the browser's `localStorage`                   | **No**                             |
| Hardware check (GPU, memory, speed test) | Read and computed in the browser                         | **No**                             |
| Last-used model                          | `localStorage`                                           | **No**                             |
| Model files (570 MB to about 5 GB)       | Downloaded **once**, kept in the browser's Cache Storage | Download only; nothing is uploaded |

There is no application server. The app is a set of static files. There is no account, no analytics, no
error reporting and no third-party script.

## Network connections the app makes

1. **The page and its files**, from the host that serves the app (HTML, JavaScript, the WebAssembly
   inference engine, fonts if any).
2. **The model files**, from `huggingface.co`, which redirects to its storage network under `hf.co`.
   Only when a model is not yet cached.

That is all the code does. The browser also restricts it: the page ships a Content-Security-Policy that
allows requests only to its own origin and to those two Hugging Face hosts (see `CSP` in `vite.config.ts`,
emitted as a meta tag and in the `_headers` file). The WebAssembly engine, which the underlying library loads
from a public CDN by default, is copied into the app and served from the same origin.

### What the policy does not cover

Be precise about what the Content-Security-Policy proves. It is a strong guard against a bug sending data,
and a partial one against malicious code:

- **Navigation is not covered.** No CSP directive stops the page from navigating away or opening a window
  (`location.href`, `window.open`, a link the user clicks), and a URL can carry text. Code that wanted to
  leak a chat could do it this way, and the in-app counter would not show it (Resource Timing does not
  record navigations).
- **The allowed hosts accept uploads.** Hugging Face is a platform where anyone can create a repository, and
  its API is reachable from the page. Malicious code with its own Hugging Face token could upload text there.
- **The worker needs the HTTP header.** The model runs in a Web Worker, and a worker takes its policy from
  the response headers of its own script, not from the page's meta tag. On a host that ignores `_headers`
  (GitHub Pages, a plain S3 bucket, a default nginx), the page is restricted and the worker is not. Send the
  `Content-Security-Policy` header for every file.

So the realistic claim is: the app's own code sends nothing, you can check that in the Network tab, and the
policy makes a quiet upload by a buggy or compromised dependency much harder. It does not make it impossible.
Trust in the dependencies (locked in `pnpm-lock.yaml`) is still required.

### How to verify this yourself

- Open the browser's developer tools, Network tab, reload, pick a model, send a message. After the
  model has loaded, sending messages creates no requests.
- The in-app panel "How private is this?" shows the same thing as a counter: network requests since your
  first message. Expected: none.
- Switch off the network after the model is loaded. Chat keeps working.
- Read `vite.config.ts` (the policy) and `src/lib/engine/worker.ts` (the only place that touches the
  model loader).

## What the people who run the servers can see

- **The host serving the app** sees what any web server sees: IP address, user agent, time and the
  files requested. It does not see anything typed into the chat, because that is never sent.
- **Hugging Face** sees the IP address and which model files were requested when a model is downloaded.
  It does not see chats.

If an organisation cannot allow connections to Hugging Face at all, the models would have to be mirrored
on an internal host and the loader pointed at it (`env.remoteHost` in Transformers.js). This is not
implemented yet.

## Supply chain

- **Model revisions are pinned** to a specific commit of each Hugging Face repository
  (`revision` in `src/lib/models/catalog.ts`), so a later change to a repository's `main` branch cannot
  alter what the app loads. Weights are ONNX files, not executable code; the runtime that interprets them
  is part of the app bundle.
- **Licences**: all four models are Apache-2.0 (Qwen3 0.6B and 1.7B by Alibaba, Gemma 4 E2B and E4B by
  Google). Verify the terms for your use.
- **Dependencies** are listed in `package.json` and locked in `pnpm-lock.yaml`.

## Threat model, briefly

| Threat                                                                 | Status                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The app or a dependency sends chat text to a server                    | No code path does it; requests to hosts outside the allowlist are blocked. **Not blocked:** navigation, and uploads to Hugging Face (see above)                                                                                                                                                                                            |
| A malicious or backdoored model exfiltrates data                       | It has no network access beyond the same allowlist, and it only produces text; revisions are pinned                                                                                                                                                                                                                                        |
| A model produces wrong, biased or harmful text                         | **Not mitigated.** Small models make mistakes. The UI says so. Do not rely on answers for decisions without checking                                                                                                                                                                                                                       |
| Model output injects markup into the page                              | Output is rendered as Markdown without raw HTML                                                                                                                                                                                                                                                                                            |
| Another user of the same computer or browser profile reads saved chats | **Not mitigated.** Chats are plain text in the profile. Use "Delete everything on this device" or a separate profile                                                                                                                                                                                                                       |
| Browser extensions read the page                                       | Out of scope; they can read any page                                                                                                                                                                                                                                                                                                       |
| Prompt injection                                                       | **Partly applicable.** The model has no tools, but users paste emails and documents. Hidden instructions in pasted text can make the model write a link that carries chat text; clicking it sends that text to the link's host. Images are not loaded, so nothing leaves without a click. Do not click links in answers you did not expect |

## What this does not tell you

Whether answer quality is sufficient for your task, whether a particular use is permitted under the EU
AI Act or your sector's rules, or which role (controller, processor) applies when your staff use it. Those
need your own assessment. What the software does with data is described above and can be checked.
