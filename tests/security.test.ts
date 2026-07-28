import { describe, expect, it } from 'vitest';
import { builtinModules } from 'node:module';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import * as ts from 'typescript';
import { createSecureRendererPreferences, isAllowedRendererNavigation } from '../src/main/shell/security';

const projectRoot = resolve(import.meta.dirname, '..');
const rendererTsConfig = resolve(projectRoot, 'tsconfig.app.json');
const nodeBuiltinModules = new Set(
  builtinModules.flatMap((moduleName) => [
    moduleName,
    moduleName.startsWith('node:') ? moduleName.slice('node:'.length) : `node:${moduleName}`,
  ]),
);
const sqliteModules = ['sqlite', 'sqlite3', 'better-sqlite3'];

interface ModuleReference {
  readonly moduleName: string;
  readonly node: ts.Node;
}

interface ForbiddenImport {
  readonly moduleName: string;
  readonly line: number;
}

function isForbiddenRendererModule(moduleName: string): boolean {
  const bareModuleName = moduleName.startsWith('node:') ? moduleName.slice('node:'.length) : moduleName;
  return (
    moduleName === 'electron' ||
    moduleName.startsWith('electron/') ||
    moduleName.startsWith('node:') ||
    nodeBuiltinModules.has(moduleName) ||
    nodeBuiltinModules.has(bareModuleName) ||
    sqliteModules.some((sqliteModule) => moduleName === sqliteModule || moduleName.startsWith(`${sqliteModule}/`))
  );
}

function getModuleReferences(sourceFile: ts.SourceFile): ModuleReference[] {
  const references: ModuleReference[] = [];

  function addReference(moduleSpecifier: ts.Node | undefined): void {
    if (moduleSpecifier !== undefined && ts.isStringLiteral(moduleSpecifier)) {
      references.push({ moduleName: moduleSpecifier.text, node: moduleSpecifier });
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      addReference(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node)) {
      addReference(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      addReference(node.moduleReference.expression);
    } else if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const [argument] = node.arguments;
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequireCall = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if ((isDynamicImport || isRequireCall) && ts.isStringLiteral(argument)) {
        addReference(argument);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return references;
}

function findForbiddenImports(filePath: string): ForbiddenImport[] {
  const source = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  return getModuleReferences(sourceFile)
    .filter(({ moduleName }) => isForbiddenRendererModule(moduleName))
    .map(({ moduleName, node }) => ({
      moduleName,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
    }));
}

function getRendererSourceFiles(): string[] {
  const config = ts.readConfigFile(rendererTsConfig, ts.sys.readFile);
  if (config.error !== undefined) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  }

  const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, projectRoot, undefined, rendererTsConfig);
  if (parsedConfig.errors.length > 0) {
    throw new Error(
      parsedConfig.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'),
    );
  }

  // The app project is the renderer boundary; its file set grows with the renderer instead of a filename allow-list.
  return parsedConfig.fileNames.filter((filePath) => /\.(?:d\.ts|ts|tsx)$/.test(filePath));
}

describe('Electron renderer boundary', () => {
  it('uses context isolation, sandboxing, and no Node integration', () => {
    expect(createSecureRendererPreferences('preload.cjs')).toEqual({
      preload: 'preload.cjs',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    });
  });

  it('allows only the configured renderer URL or file', () => {
    expect(
      isAllowedRendererNavigation(
        'http://127.0.0.1:5173/',
        'C:/SmartSpace/dist/renderer/index.html',
        'http://127.0.0.1:5173',
      ),
    ).toBe(true);
    expect(
      isAllowedRendererNavigation(
        'http://127.0.0.1:51730/',
        'C:/SmartSpace/dist/renderer/index.html',
        'http://127.0.0.1:5173',
      ),
    ).toBe(false);
    expect(
      isAllowedRendererNavigation(
        'https://example.invalid/',
        'C:/SmartSpace/dist/renderer/index.html',
        'http://127.0.0.1:5173',
      ),
    ).toBe(false);
    expect(
      isAllowedRendererNavigation(
        'file:///C:/SmartSpace/dist/renderer/index.html',
        'C:\\SmartSpace\\dist\\renderer\\index.html',
      ),
    ).toBe(true);
  });

  it('keeps forbidden Node, Electron, and SQLite imports out of every renderer source file', () => {
    const violations = getRendererSourceFiles().flatMap((filePath) =>
      findForbiddenImports(filePath).map((violation) => ({
        file: relative(projectRoot, filePath).replaceAll('\\', '/'),
        ...violation,
      })),
    );

    expect(violations).toEqual([]);
  });

  it('detects a forbidden import in the renderer-boundary negative fixture', () => {
    const fixturePath = resolve(projectRoot, 'tests/fixtures/renderer-forbidden-import.ts');

    expect(findForbiddenImports(fixturePath)).toEqual([{ moduleName: 'electron', line: 1 }]);
    expect(isForbiddenRendererModule('node:fs')).toBe(true);
    expect(isForbiddenRendererModule('better-sqlite3')).toBe(true);
  });

  it('exposes only the typed bridge from preload', () => {
    const preload = readFileSync(resolve(projectRoot, 'src/preload/preload.ts'), 'utf8');
    expect(preload).toContain("contextBridge.exposeInMainWorld('smartSpace', api)");
    expect(preload).not.toContain("exposeInMainWorld('electron'");
    expect(preload).not.toContain("exposeInMainWorld('require'");
  });
});
