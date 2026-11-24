/**
 * Minimal React-element → SVG string serializer for card templates.
 *
 * Why not react-dom/server? Next.js forbids importing it in route handlers
 * (the React Server layer). Card templates are pure, hook-free components that
 * only emit SVG elements, so serializing them directly is small and exact.
 * scripts/test-serializer.tsx verifies the output is identical to
 * react-dom/server's renderToStaticMarkup for every template and sample.
 */
import { Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

// SVG attributes React keeps camelCase (everything else camelCase → kebab-case).
const CAMEL_ATTRS = new Set([
  "viewBox", "preserveAspectRatio", "gradientUnits", "gradientTransform", "patternUnits",
  "patternContentUnits", "patternTransform", "maskUnits", "maskContentUnits", "clipPathUnits",
  "filterUnits", "primitiveUnits", "stdDeviation", "baseFrequency", "numOctaves", "stitchTiles",
  "tableValues", "markerWidth", "markerHeight", "markerUnits", "refX", "refY", "textLength",
  "lengthAdjust", "startOffset", "spreadMethod", "kernelMatrix", "surfaceScale", "specularExponent",
  "specularConstant", "diffuseConstant", "pathLength", "points", "keyTimes", "keySplines",
  "calcMode", "attributeName", "repeatCount", "xChannelSelector", "yChannelSelector", "edgeMode",
  "kernelUnitLength", "limitingConeAngle", "pointsAtX", "pointsAtY", "pointsAtZ", "targetX", "targetY",
  "zoomAndPan", "requiredFeatures", "requiredExtensions", "systemLanguage", "contentScriptType",
  "contentStyleType", "externalResourcesRequired", "filterRes", "glyphRef",
]);
const RENAMED: Record<string, string> = { className: "class", htmlFor: "for", xlinkHref: "xlink:href", xmlnsXlink: "xmlns:xlink" };
const VOID_SKIP = new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]);

const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function attrName(key: string): string {
  if (RENAMED[key]) return RENAMED[key];
  if (CAMEL_ATTRS.has(key) || key.startsWith("data-") || key.startsWith("aria-")) return key;
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function styleString(style: Record<string, unknown>): string {
  return Object.entries(style)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
    .join(";");
}

function attrs(props: Record<string, unknown>): string {
  let out = "";
  for (const [key, value] of Object.entries(props)) {
    if (VOID_SKIP.has(key) || value == null || value === false || typeof value === "function") continue;
    if (key === "style" && typeof value === "object") {
      const s = styleString(value as Record<string, unknown>);
      if (s) out += ` style="${escAttr(s)}"`;
      continue;
    }
    out += ` ${attrName(key)}="${escAttr(value === true ? "" : String(value))}"`;
  }
  return out;
}

export function serializeSvg(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return escText(node);
  if (typeof node === "number" || typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map(serializeSvg).join("");
  if (!isValidElement(node)) return "";

  const el = node as ReactElement<Record<string, unknown>>;
  const props = el.props ?? {};
  if (el.type === Fragment) return serializeSvg(props.children as ReactNode);
  if (typeof el.type === "function") {
    const Component = el.type as (p: Record<string, unknown>) => ReactNode;
    return serializeSvg(Component(props));
  }
  if (typeof el.type !== "string") throw new Error("Card templates may only render SVG elements and function components.");

  const children = serializeSvg(props.children as ReactNode);
  return `<${el.type}${attrs(props)}>${children}</${el.type}>`;
}
