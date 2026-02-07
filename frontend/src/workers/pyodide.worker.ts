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

declare const self: DedicatedWorkerGlobalScope;

let pyodide: any = null;
let pyodideLoading: Promise<any> | null = null;

type RunMessage = {
  type: 'run';
  files: Array<{ name: string; content: string }>;
  entryFile: string;
};

type InputResponseMessage = {
  type: 'inputResponse';
  value: string;
};

type IncomingMessage = RunMessage | InputResponseMessage;

// Pending input resolve function
let inputResolve: ((value: string) => void) | null = null;

function postStatus(status: 'loading' | 'ready' | 'running' | 'done') {
  self.postMessage({ type: 'status', status });
}

function postStdout(text: string) {
  self.postMessage({ type: 'stdout', text });
}

function postStderr(text: string) {
  self.postMessage({ type: 'stderr', text });
}

function postInputRequest(prompt: string) {
  self.postMessage({ type: 'inputRequest', prompt });
}

function postResult(success: boolean, error?: string) {
  self.postMessage({ type: 'result', success, error });
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

    // Install pyodide-http for requests/urllib support
    await pyodide.loadPackage('micropip');
    await pyodide.runPythonAsync(`
import micropip
await micropip.install('pyodide-http')
import pyodide_http
pyodide_http.patch_all()
`);

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

async function runCode(files: Array<{ name: string; content: string }>, entryFile: string) {
  try {
    const py = await loadPyodideRuntime();

    postStatus('running');

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
`);

    // Add the project root to sys.path for imports
    await py.runPythonAsync(`
import sys
if '/' not in sys.path:
    sys.path.insert(0, '/')
if '' not in sys.path:
    sys.path.insert(0, '')
`);

    // Read the entry file and transform input() calls for async support
    const entry = entryFile.startsWith('/') ? entryFile : `/${entryFile}`;
    const rawCode = py.FS.readFile(entry, { encoding: 'utf8' });

    // Pass user code through the AST transformer (adds await before input())
    py.globals.set('__raw_user_code', rawCode);
    const transformed = py.runPython(
      `_transform_for_async_input(__raw_user_code)`
    );
    const codeToRun = typeof transformed === 'string' ? transformed : rawCode;

    await py.runPythonAsync(codeToRun);

    postResult(true);
  } catch (err: any) {
    const message = err?.message || String(err);
    // Filter out Pyodide internals from the traceback
    const cleaned = message
      .split('\n')
      .filter((line: string) => !line.includes('pyodide/_base.py') && !line.includes('pyodide.code'))
      .join('\n');
    postStderr(cleaned || message);
    postResult(false, cleaned || message);
  } finally {
    postStatus('done');
  }
}

self.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;

  if (msg.type === 'run') {
    runCode(msg.files, msg.entryFile);
  } else if (msg.type === 'inputResponse') {
    if (inputResolve) {
      inputResolve(msg.value);
      inputResolve = null;
    }
  }
};
