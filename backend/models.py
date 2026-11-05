import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .svg import parse_svg

Role = Literal["main", "background"]
Size = Literal["S", "L"]
Palette = Literal["lavender", "peach", "mint"]
FORMATS = {"square": (1080, 1080), "landscape": (1600, 900), "portrait": (1080, 1350), "story": (1080, 1920)}

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

class SvgSource(StrictModel):
    svg: str = Field(max_length=2 * 1024 * 1024)
    viewBox: tuple[float, float, float, float]
    aspectRatio: float

    @model_validator(mode="after")
    def sanitize(self):
        safe = parse_svg(self.svg)
        self.svg = safe["svg"]
        self.viewBox = tuple(safe["viewBox"])
        self.aspectRatio = safe["aspectRatio"]
        return self

class Asset(StrictModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]+$", min_length=1, max_length=1000)
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(max_length=100)
    tags: list[str] = Field(max_length=100)
    keywords: list[str] = Field(max_length=100)
    role: Role
    sizeVariants: list[Size] = Field(min_length=1, max_length=2)
    sources: dict[str, SvgSource]
    colorMap: dict[str, Literal["mainObjectColors", "accents", "shadows", "outlines", "backgroundDecorations"]]
    allowedPalettes: list[Palette] = Field(max_length=3)
    demo: bool = False
    warnings: list[str] = Field(default_factory=list, max_length=100)
    placement: dict[Literal["maxRotation"], float] | None = None

    @field_validator("sources")
    @classmethod
    def valid_sources(cls, value):
        if not 1 <= len(value) <= 4 or any(not re.fullmatch(r"(main|background):(S|L)", key) for key in value):
            raise ValueError("Некорректные исходные варианты")
        return value

class Canvas(StrictModel):
    width: int
    height: int
    palette: Palette
    format: Literal["square", "landscape", "portrait", "story"]

    @model_validator(mode="after")
    def dimensions(self):
        if (self.width, self.height) != FORMATS[self.format]:
            raise ValueError("Размеры не соответствуют формату")
        return self

class Element(StrictModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]+$", min_length=1, max_length=1000)
    objectId: str
    role: Role
    size: Size
    x: float = Field(ge=-2, le=3)
    y: float = Field(ge=-2, le=3)
    scale: float = Field(ge=.01, le=4)
    rotation: float = Field(ge=-3600, le=3600)
    zIndex: float = Field(ge=-10000, le=10000)
    hidden: bool

class Composition(StrictModel):
    id: str = Field(max_length=1000)
    name: str = Field(max_length=200)
    seed: int
    strategy: Literal["central", "diagonal", "asymmetric", "triangle", "hero", "decorative"]
    score: float
    canvas: Canvas
    elements: list[Element] = Field(max_length=300)

class Project(StrictModel):
    version: Literal[1]
    title: str = Field(min_length=1, max_length=200)
    assets: list[Asset] = Field(max_length=200)
    composition: Composition

    @model_validator(mode="after")
    def references(self):
        assets = {asset.id: asset for asset in self.assets}
        if len(assets) != len(self.assets):
            raise ValueError("Повторяющиеся ID библиотеки")
        seen = set()
        for element in self.composition.elements:
            if element.id in seen:
                raise ValueError("Повторяющийся ID экземпляра")
            seen.add(element.id)
            asset = assets.get(element.objectId)
            if not asset or not any(f"{element.role}:{size}" in asset.sources for size in ("S", "L")):
                raise ValueError("Отсутствует исходный SVG или его вариант")
        return self

class AssetBatch(StrictModel):
    assets: list[Asset] = Field(max_length=100)
