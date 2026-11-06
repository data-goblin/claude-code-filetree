import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Expression, Identifier, JsxAttributeName, Node, PropertyName, ShorthandPropertyAssignment, SourceFile } from 'typescript'

const PIXELS = new Set(['ROW_PX', 'STEP_PX', 'GAP_PX', 'CHEVRON_PX'])
const SIZES = new Set(['height', 'width', 'minHeight', 'maxHeight', 'minWidth', 'maxWidth'])
const PIXEL_ELEMENTS = new Set(['Svg'])
const MESSAGE = 'Box, Text and Client sizes count cells, so a pixel constant makes a row many lines tall; size the Svg in pixels and leave the Box to its content'

const globalDir = process.env.BUN_INSTALL_GLOBAL_DIR ?? join(process.env.BUN_INSTALL ?? join(homedir(), '.bun'), 'install', 'global')
const ts: typeof import('typescript') = createRequire(join(globalDir, 'package.json'))('typescript')

const roots = process.argv.length > 2 ? process.argv.slice(2) : ['hooks']
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []))
const files = roots.flatMap(root => (/\.tsx?$/.test(root) ? [root] : walk(root)))
const program = ts.createProgram(files, { noLib: true, noResolve: true, noEmit: true, jsx: ts.JsxEmit.Preserve })
const checker = program.getTypeChecker()
const found: string[] = []

function nameOf(name: PropertyName | JsxAttributeName): string {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name) ? name.text : ''
}

function initializers(id: Identifier | ShorthandPropertyAssignment, seen: Set<Node>): Expression[] {
  const symbol = ts.isShorthandPropertyAssignment(id) ? checker.getShorthandAssignmentValueSymbol(id) : checker.getSymbolAtLocation(id)
  return (symbol?.declarations ?? []).flatMap(d => {
    if (!ts.isVariableDeclaration(d) || !d.initializer || seen.has(d)) return []
    seen.add(d)
    return [d.initializer]
  })
}

function pixelName(id: Identifier): string {
  const imported = PIXELS.has(id.text) ? undefined : checker.getSymbolAtLocation(id)?.declarations?.find(ts.isImportSpecifier)
  const name = imported ? (imported.propertyName ?? imported.name).text : id.text
  return PIXELS.has(name) ? name : ''
}

function pixelIn(node: Node, seen: Set<Node> = new Set()): string {
  if (seen.has(node)) return ''
  seen.add(node)
  if (ts.isIdentifier(node)) return pixelName(node) || (initializers(node, seen).map(init => pixelIn(init, seen)).find(Boolean) ?? '')
  if (ts.isPropertyAccessExpression(node)) return PIXELS.has(node.name.text) ? node.name.text : pixelIn(node.expression, seen)
  return ts.forEachChild(node, child => pixelIn(child, seen) || undefined) ?? ''
}

function spreadSizes(node: Expression, seen: Set<Node> = new Set()): [string, string][] {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) return spreadSizes(node.expression, seen)
  if (ts.isConditionalExpression(node)) return [...spreadSizes(node.whenTrue, seen), ...spreadSizes(node.whenFalse, seen)]
  if (ts.isBinaryExpression(node)) return [...spreadSizes(node.left, seen), ...spreadSizes(node.right, seen)]
  if (ts.isIdentifier(node)) return initializers(node, seen).flatMap(init => spreadSizes(init, seen))
  if (!ts.isObjectLiteralExpression(node)) return []
  return node.properties.flatMap((p): [string, string][] => {
    if (ts.isSpreadAssignment(p)) return spreadSizes(p.expression, seen)
    if (!SIZES.has(nameOf(p.name))) return []
    const px = ts.isPropertyAssignment(p) ? pixelIn(p.initializer) : ts.isShorthandPropertyAssignment(p) ? (initializers(p, seen).map(init => pixelIn(init)).find(Boolean) ?? '') : ''
    return px ? [[nameOf(p.name), px]] : []
  })
}

function report(file: SourceFile, at: Node, element: string, prop: string, px: string): void {
  const { line, character } = file.getLineAndCharacterOfPosition(at.getStart(file))
  found.push(`${file.fileName}:${line + 1}:${character + 1}: <${element}> ${prop} uses ${px}`)
}

for (const file of program.getSourceFiles()) {
  if (!files.includes(file.fileName)) continue
  const visit = (node: Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const element = node.tagName.getText(file).split('.').pop() ?? ''
      if (!PIXEL_ELEMENTS.has(element)) for (const attr of node.attributes.properties) {
        if (ts.isJsxSpreadAttribute(attr)) for (const [prop, px] of spreadSizes(attr.expression)) report(file, attr, element, prop, px)
        else if (SIZES.has(nameOf(attr.name)) && attr.initializer) {
          const px = pixelIn(attr.initializer)
          if (px) report(file, attr, element, nameOf(attr.name), px)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
}

if (files.length === 0) {
  console.error(`no .ts or .tsx files under ${roots.join(', ')}`)
  process.exit(1)
}
if (found.length) {
  console.error([...found, MESSAGE].join('\n'))
  process.exit(1)
}
console.log(`jsx sizes: ${files.length} files, no pixel constant sizes a Box, Text, Button, Input or Client`)
