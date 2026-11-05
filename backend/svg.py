"""Strict vector-only SVG intake, shared by library and project validation."""
import math
import re
import xml.etree.ElementTree as ET

from defusedxml.ElementTree import fromstring

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
ELEMENTS = set("svg g path rect circle ellipse line polyline polygon text tspan defs linearGradient radialGradient stop clipPath mask pattern use title desc symbol".split())
ATTRS = set("id viewBox width height x y x1 y1 x2 y2 cx cy r rx ry d points fill stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset fill-rule clip-rule fill-opacity stroke-opacity opacity transform gradientTransform gradientUnits offset stop-color stop-opacity spreadMethod fx fy fr href clip-path mask maskUnits maskContentUnits clipPathUnits patternUnits patternContentUnits patternTransform preserveAspectRatio font-size font-family font-weight text-anchor dominant-baseline color data-color-role".split())
ELEMENTS.update("filter feGaussianBlur feOffset feBlend feComposite feFlood feColorMatrix feMerge feMergeNode feComponentTransfer feFuncR feFuncG feFuncB feFuncA feDropShadow".split())
ATTRS.update("filter in in2 result stdDeviation mode operator k1 k2 k3 k4 values type dx dy filterUnits primitiveUnits color-interpolation-filters flood-color flood-opacity slope intercept amplitude exponent tableValues vector-effect".split())
ID_RE = r"[A-Za-z_][\w.:-]*"

def parse_svg(raw: str) -> dict:
    if len(raw.encode("utf-8")) > 2 * 1024 * 1024:
        raise ValueError("SVG превышает 2 МБ")
    if re.search(r"<!DOCTYPE|<!ENTITY|<\?xml-stylesheet", raw, re.I):
        raise ValueError("DTD, сущности и внешние стили запрещены")
    try:
        root = fromstring(raw)
    except Exception as exc:
        raise ValueError("Некорректный SVG XML") from exc
    if root.tag != f"{{{SVG_NS}}}svg":
        raise ValueError("Корневой элемент должен быть SVG с пространством имён")
    nodes = list(root.iter())
    if len(nodes) > 15000:
        raise ValueError("Слишком сложный SVG")
    ids = set()
    refs = []
    for node in nodes:
        if not node.tag.startswith(f"{{{SVG_NS}}}") or node.tag.split("}")[-1] not in ELEMENTS:
            raise ValueError("Запрещённый SVG-элемент; допускается только векторная графика")
        style = node.attrib.pop("style", None)
        if style:
            for declaration in filter(str.strip, style.split(";")):
                key, sep, value = declaration.partition(":")
                if not sep or key.strip() not in ATTRS:
                    raise ValueError("Неподдерживаемый CSS; используйте атрибуты представления")
                node.set(key.strip(), value.strip())
        for key, value in node.attrib.items():
            name = key.split("}")[-1]
            if name not in ATTRS or (key.startswith("{") and key != "{http://www.w3.org/1999/xlink}href"):
                raise ValueError(f"Запрещённый атрибут: {name}")
            value = value.strip()
            if re.search(r"javascript:|data:|https?:|file:|\\|/\*|@import|expression\s*\(", value, re.I):
                raise ValueError("Внешние ресурсы запрещены")
            if name == "href":
                if not re.fullmatch(f"#{ID_RE}", value):
                    raise ValueError("Допускаются только внутренние SVG-ссылки")
                refs.append(value[1:])
            if re.search(r"url\s*\(", value, re.I):
                match = re.fullmatch(rf"url\(\s*#({ID_RE})\s*\)", value)
                if not match:
                    raise ValueError("Внешние ссылки запрещены")
                refs.append(match[1])
            if name == "id":
                if not re.fullmatch(ID_RE, value) or value in ids:
                    raise ValueError("Некорректный или повторяющийся SVG id")
                ids.add(value)
    if any(ref not in ids for ref in refs):
        raise ValueError("Ссылка на отсутствующий SVG id")
    try:
        if root.get("viewBox"):
            box = [float(v) for v in re.split(r"[\s,]+", root.get("viewBox").strip())]
        else:
            def dimension(value):
                if not value or not re.fullmatch(r"\d+(?:\.\d+)?(?:px)?", value):
                    raise ValueError("Некорректный размер")
                return float(value.removesuffix("px"))
            box = [0, 0, dimension(root.get("width")), dimension(root.get("height"))]
        if len(box) != 4 or not all(math.isfinite(v) and abs(v) <= 1e7 for v in box) or box[2] <= 0 or box[3] <= 0:
            raise ValueError("Некорректный viewBox")
    except (ValueError, TypeError) as exc:
        raise ValueError("SVG должен иметь корректный viewBox или размеры в px") from exc
    root.set("viewBox", " ".join(str(v) for v in box))
    return {"svg": ET.tostring(root, encoding="unicode"), "viewBox": box, "aspectRatio": box[2] / box[3]}
