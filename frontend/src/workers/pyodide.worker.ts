/**
 * Pyodide Web Worker
 *
 * Runs Python code off the main thread using Pyodide (WebAssembly).
 * Supports multi-file projects, stdout/stderr capture, input() prompts,
 * and pyodide-http for requests/urllib.
 *
 * NOTE: Vite creates this as a module worker ({ type: 'module' }),
 * so importScripts() is NOT available. We use dynamic import() instead.
 */
import { openaiShimCode } from './openaimod';

declare const self: DedicatedWorkerGlobalScope;

let pyodide: any = null;
let pyodideLoading: Promise<any> | null = null;

type RunMessage = {
  type: 'run';
  files: Array<{ name: string; content: string }>;
  entryFile: string;
  authToken?: string;
};

type InputResponseMessage = {
  type: 'inputResponse';
  value: string;
};

type IncomingMessage = RunMessage | InputResponseMessage;

// Pending input resolve function
let inputResolve: ((value: string) => void) | null = null;

const OUTPUT_FLUSH_MS = 32;
const OUTPUT_BATCH_SIZE = 2048;
const OUTPUT_MAX_CHARS = 20_000;

let stdoutBuffer = '';
let stderrBuffer = '';
let stdoutFlushTimer: ReturnType<typeof setTimeout> | null = null;
let stderrFlushTimer: ReturnType<typeof setTimeout> | null = null;
let totalOutputChars = 0;
let outputLimitReached = false;

function postStatus(status: 'loading' | 'ready' | 'running' | 'done') {
  self.postMessage({ type: 'status', status });
}

function flushStdout() {
  if (stdoutFlushTimer) {
    clearTimeout(stdoutFlushTimer);
    stdoutFlushTimer = null;
  }
  if (!stdoutBuffer) return;
  self.postMessage({ type: 'stdout', text: stdoutBuffer });
  stdoutBuffer = '';
}

function flushStderr() {
  if (stderrFlushTimer) {
    clearTimeout(stderrFlushTimer);
    stderrFlushTimer = null;
  }
  if (!stderrBuffer) return;
  self.postMessage({ type: 'stderr', text: stderrBuffer });
  stderrBuffer = '';
}

function flushOutputBuffers() {
  flushStdout();
  flushStderr();
}

function resetOutputBuffers() {
  flushOutputBuffers();
  totalOutputChars = 0;
  outputLimitReached = false;
}

function notifyOutputLimit() {
  if (outputLimitReached) return;
  outputLimitReached = true;
  stderrBuffer += '\nOutput limit reached. Execution stopped.\n';
  flushOutputBuffers();
  self.postMessage({ type: 'outputLimit' });
}

function queueOutput(kind: 'stdout' | 'stderr', text: string) {
  if (!text || outputLimitReached) return;

  const remaining = OUTPUT_MAX_CHARS - totalOutputChars;
  if (remaining <= 0) {
    notifyOutputLimit();
    return;
  }

  const chunk = text.length > remaining ? text.slice(0, remaining) : text;
  totalOutputChars += chunk.length;

  if (kind === 'stdout') {
    stdoutBuffer += chunk;
    if (stdoutBuffer.length >= OUTPUT_BATCH_SIZE) {
      flushStdout();
    } else if (!stdoutFlushTimer) {
      stdoutFlushTimer = setTimeout(flushStdout, OUTPUT_FLUSH_MS);
    }
  } else {
    stderrBuffer += chunk;
    if (stderrBuffer.length >= OUTPUT_BATCH_SIZE) {
      flushStderr();
    } else if (!stderrFlushTimer) {
      stderrFlushTimer = setTimeout(flushStderr, OUTPUT_FLUSH_MS);
    }
  }

  if (chunk.length < text.length) {
    notifyOutputLimit();
  }
}

function postStdout(text: string) {
  queueOutput('stdout', text);
}

function postStderr(text: string) {
  queueOutput('stderr', text);
}

function postInputRequest(prompt: string) {
  self.postMessage({ type: 'inputRequest', prompt });
}

function postResult(success: boolean, error?: string) {
  self.postMessage({ type: 'result', success, error });
}

const PYODIDE_INTERNAL_FRAME_PATTERNS = [
  '/_pyodide/',
  'pyodide/_base.py',
  'pyodide.code',
  'pyodide_js',
];

function isPyodideInternalFrame(line: string) {
  return (
    line.startsWith('  File "') &&
    PYODIDE_INTERNAL_FRAME_PATTERNS.some((pattern) => line.includes(pattern))
  );
}

function isTracebackContextLine(line: string) {
  return line.startsWith('    ') || line.trim() === '';
}

function normalizePythonError(error: unknown) {
  const rawMessage =
    typeof error === 'string'
      ? error
      : (error as { message?: string })?.message || String(error);

  const message = rawMessage.replace(/\r\n/g, '\n').trim();
  if (!message) return 'Execution failed.';

  const lines = message.split('\n');
  const cleaned: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i];
    const trimmed = line.trim();

    if (i === 0 && line.startsWith('PythonError:')) {
      line = line.replace(/^PythonError:\s*/, '');
      if (!line) continue;
    }

    if (trimmed === 'PythonError' || trimmed === 'PythonError:') {
      continue;
    }

    if (isPyodideInternalFrame(line)) {
      while (i + 1 < lines.length && isTracebackContextLine(lines[i + 1])) {
        i += 1;
      }
      continue;
    }

    cleaned.push(line);
  }

  const normalized = cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (normalized) {
    return normalized;
  }

  const fallback = message
    .replace(/^PythonError:\s*/, '')
    .replace(/\n?PythonError:?$/, '')
    .trim();

  return fallback || 'Execution failed.';
}

async function loadPyodideRuntime(): Promise<any> {
  if (pyodide) return pyodide;
  if (pyodideLoading) return pyodideLoading;

  pyodideLoading = (async () => {
    postStatus('loading');

    // Dynamic import of Pyodide ESM entry point (works in module workers)
    const { loadPyodide: load } = await import(
      /* @vite-ignore */
      'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs'
    );

    pyodide = await load({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/',
    });

    // Install requests + pyodide-http for HTTP support
    await pyodide.loadPackage('micropip');
    await pyodide.runPythonAsync(`
import micropip
await micropip.install(['pyodide-http', 'requests'])
import pyodide_http
pyodide_http.patch_all()
`);

// Inject fake openai module that uses requests instead of httpx
await pyodide.runPythonAsync(openaiShimCode);

    postStatus('ready');
    return pyodide;
  })();

  try {
    return await pyodideLoading;
  } catch (err) {
    pyodideLoading = null;
    throw err;
  }
}

async function runCode(files: Array<{ name: string; content: string }>, entryFile: string, authToken?: string) {
  try {
    resetOutputBuffers();
    const py = await loadPyodideRuntime();

    postStatus('running');

    // Set CWD to root so open('file.json') finds files written to /file.json
    py.FS.chdir('/');

    // Write all project files to Pyodide's in-memory filesystem
    for (const file of files) {
      const path = file.name.startsWith('/') ? file.name : `/${file.name}`;
      // Ensure parent directories exist
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir && dir !== '/') {
        try {
          py.FS.mkdirTree(dir);
        } catch {
          // directory may already exist
        }
      }
      py.FS.writeFile(path, file.content);
    }

    // Register JS callback functions on the worker global scope so Python can call them
    (self as any)._pyodide_post_stdout = (text: string) => postStdout(text);
    (self as any)._pyodide_post_stderr = (text: string) => postStderr(text);
    (self as any)._pyodide_request_input = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        inputResolve = resolve;
        postInputRequest(prompt);
      });
    };

    // Setup IO redirection, input() patching, and AST code transformer
    await py.runPythonAsync(`
import sys
import ast
import builtins
import inspect
import traceback
from js import _pyodide_post_stdout, _pyodide_post_stderr, _pyodide_request_input

class _WorkerStdout:
    def write(self, text):
        if text:
            _pyodide_post_stdout(text)
    def flush(self):
        pass

class _WorkerStderr:
    def write(self, text):
        if text:
            _pyodide_post_stderr(text)
    def flush(self):
        pass

sys.stdout = _WorkerStdout()
sys.stderr = _WorkerStderr()

async def _patched_input(prompt=""):
    if prompt:
        sys.stdout.write(str(prompt))
    result = await _pyodide_request_input(str(prompt))
    return result

builtins.input = _patched_input

# --- AST transformer: auto-insert await for input() calls ---

def _walk_skip_functions(node):
    """Walk AST children but don't recurse into nested function definitions."""
    yield node
    for child in ast.iter_child_nodes(node):
        if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        yield from _walk_skip_functions(child)

def _body_has_direct_await(body):
    """Check if statements contain Await without crossing into nested functions."""
    for stmt in body:
        for node in _walk_skip_functions(stmt):
            if isinstance(node, ast.Await):
                return True
    return False

class _AwaitInputTransformer(ast.NodeTransformer):
    """Replace input(...) with await input(...)."""
    def visit_Call(self, node):
        self.generic_visit(node)
        if isinstance(node.func, ast.Name) and node.func.id == 'input':
            return ast.copy_location(ast.Await(value=node), node)
        return node

class _AsyncPromoter(ast.NodeTransformer):
    """Convert def to async def if body directly contains await.
       Also wrap calls to promoted functions with await."""
    def __init__(self):
        self.promoted = set()
        self.changed = False

    def visit_FunctionDef(self, node):
        self.generic_visit(node)
        if _body_has_direct_await(node.body):
            self.promoted.add(node.name)
            self.changed = True
            new_node = ast.AsyncFunctionDef(
                **{f: getattr(node, f) for f in node._fields})
            return ast.copy_location(new_node, node)
        return node

    def visit_Call(self, node):
        self.generic_visit(node)
        if isinstance(node.func, ast.Name) and node.func.id in self.promoted:
            self.changed = True
            return ast.copy_location(ast.Await(value=node), node)
        return node

def _transform_for_async_input(source):
    """Transform source so input() calls work with async Pyodide execution.

    1. input() -> await input()
    2. Any def containing await -> async def
    3. Calls to promoted functions -> await func()
    4. Repeat until stable (handles nested function chains).
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return source

    # Check if code uses input() at all
    uses_input = False
    for node in ast.walk(tree):
        if (isinstance(node, ast.Call) and
            isinstance(node.func, ast.Name) and node.func.id == 'input'):
            uses_input = True
            break
    if not uses_input:
        return source

    # Step 1: input() -> await input()
    tree = _AwaitInputTransformer().visit(tree)
    ast.fix_missing_locations(tree)

    # Step 2: Iteratively promote functions containing await
    for _ in range(10):
        promoter = _AsyncPromoter()
        tree = promoter.visit(tree)
        ast.fix_missing_locations(tree)
        if not promoter.changed:
            break

    return ast.unparse(tree)

_EDVANCE_INTERNAL_TRACEBACK_MARKERS = (
    "/_pyodide/",
    "pyodide/_base.py",
    "pyodide.code",
    "pyodide_js",
)

def __edvance_is_user_frame(frame):
    filename = getattr(frame, "filename", "") or ""
    name = getattr(frame, "name", "") or ""
    if name.startswith("__edvance_"):
        return False
    if any(marker in filename for marker in _EDVANCE_INTERNAL_TRACEBACK_MARKERS):
        return False
    return filename == "<exec>" or filename.startswith("/")

def __edvance_format_tb_exception(tb_exc):
    output = []

    cause = getattr(tb_exc, "__cause__", None)
    context = getattr(tb_exc, "__context__", None)
    suppress_context = getattr(tb_exc, "__suppress_context__", False)

    if cause is not None:
        output.append(__edvance_format_tb_exception(cause))
        output.append("\\nThe above exception was the direct cause of the following exception:\\n\\n")
    elif context is not None and not suppress_context:
        output.append(__edvance_format_tb_exception(context))
        output.append("\\nDuring handling of the above exception, another exception occurred:\\n\\n")

    exc_type = getattr(tb_exc, "exc_type", None)
    is_syntax_error = isinstance(exc_type, type) and issubclass(exc_type, SyntaxError)

    if not is_syntax_error:
        user_frames = [frame for frame in tb_exc.stack if __edvance_is_user_frame(frame)]
        if not user_frames:
            user_frames = [
                frame for frame in tb_exc.stack
                if not ((getattr(frame, "name", "") or "").startswith("__edvance_"))
            ]
        if user_frames:
            output.extend(traceback.StackSummary.from_list(user_frames).format())

    output.extend(tb_exc.format_exception_only())
    return "".join(output).rstrip()

def __edvance_format_exception(exc):
    tb_exc = traceback.TracebackException.from_exception(exc)

    if isinstance(exc, SyntaxError):
        return "".join(tb_exc.format_exception_only()).rstrip()
    return __edvance_format_tb_exception(tb_exc)

async def __edvance_run_user_code(source, filename):
    try:
        code = compile(source, filename, "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
        result = eval(code, globals(), globals())
        if inspect.isawaitable(result):
            await result
        return None
    except SystemExit:
        return "__SYSTEM_EXIT__"
    except BaseException as exc:
        return __edvance_format_exception(exc)
`);

    // Add the project root to sys.path for imports
    await py.runPythonAsync(`
import sys
if '/' not in sys.path:
    sys.path.insert(0, '/')
if '' not in sys.path:
    sys.path.insert(0, '')
`);
    // Inject auth token as environment variable for AI proxy access
    if (authToken) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      await py.runPythonAsync(`
      import os
      os.environ['AUTH_TOKEN'] = '''${authToken}'''
      os.environ['BASE_URL'] = '''${apiUrl}'''
      `);
          }

    // Read the entry file and transform input() calls for async support
    const entry = entryFile.startsWith('/') ? entryFile : `/${entryFile}`;
    const rawCode = py.FS.readFile(entry, { encoding: 'utf8' });

    // Pass user code through the AST transformer (adds await before input())
    py.globals.set('__raw_user_code', rawCode);
    const transformed = py.runPython(
      `_transform_for_async_input(__raw_user_code)`
    );
    const codeToRun = typeof transformed === 'string' ? transformed : rawCode;
    const executionFilename =
      entryFile === 'snippet.py' || entryFile === '/snippet.py' ? '<exec>' : entry;

    py.globals.set('__user_code_to_run', codeToRun);
    py.globals.set('__user_execution_filename', executionFilename);

    const executionError = await py.runPythonAsync(
      `await __edvance_run_user_code(__user_code_to_run, __user_execution_filename)`
    );

    if (executionError === '__SYSTEM_EXIT__') {
      flushOutputBuffers();
      postResult(true);
      return;
    }

    if (typeof executionError === 'string' && executionError.trim()) {
      postStderr(executionError);
      flushOutputBuffers();
      postResult(false, executionError);
      return;
    }

    flushOutputBuffers();
    postResult(true);
  } catch (err: any) {
    const message = err?.message || String(err);
    // SystemExit is normal (sys.exit()) — not an error
    if (message.includes('SystemExit')) {
      flushOutputBuffers();
      postResult(true);
      return;
    }
    const cleaned = normalizePythonError(err);
    postStderr(cleaned);
    flushOutputBuffers();
    postResult(false, cleaned);
  } finally {
    flushOutputBuffers();
    postStatus('done');
  }
}

self.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;

  if (msg.type === 'run') {
    runCode(msg.files, msg.entryFile, msg.authToken);
  } else if (msg.type === 'inputResponse') {
    if (inputResolve) {
      inputResolve(msg.value);
      inputResolve = null;
    }
  }
};
