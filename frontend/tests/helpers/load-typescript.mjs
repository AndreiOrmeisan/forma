import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

// Exercise the actual TS/TSX source with the existing compiler and React runtime.
export function loadTypeScriptModule(filePath, overrides = {}) {
  const cache = new Map();
  const relativeOverrides = new Map(Object.entries(overrides).filter(([key])=>key.startsWith(".")).map(([key,value])=>[path.resolve(path.dirname(path.resolve(filePath)),key),value]));

  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: filename,
    });
    function resolveDependency(specifier) {
      if (specifier in overrides) return overrides[specifier];
      if (specifier.endsWith(".css")) {
        return { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) };
      }
      if (specifier.startsWith(".")) {
        const base = path.resolve(path.dirname(filename), specifier);
        if (relativeOverrides.has(base)) return relativeOverrides.get(base);
        const resolved = [base, `${base}.ts`, `${base}.tsx`].find(candidate => existsSync(candidate));
        if (!resolved) throw new Error(`Cannot resolve ${specifier} from ${filename}`);
        return load(resolved);
      }
      return require(specifier);
    }
    const execute = vm.runInThisContext(`(function(module, exports, require) { ${outputText}\n})`, { filename });
    execute(loadedModule, loadedModule.exports, resolveDependency);
    return loadedModule.exports;
  }

  return load(path.resolve(filePath));
}
