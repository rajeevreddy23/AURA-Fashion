import {
  DRESS_LOOKS,
  createDressLook,
  dressPrompt,
} from "../shared/lookLibrary";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  projectSchema,
  parseProject,
  materialCost,
  exportPatternSvg,
  exportCostCsv,
  fitReadings,
  patternArea,
} from "../shared/workspace";
import { SkirtCloth } from "../shared/cloth";
test("all starter garments are valid independent measured projects", () => {
  for (const garment of ["lehenga", "gown", "blouse"] as const) {
    const p = createProject(garment);
    assert.ok(projectSchema.safeParse(p).success);
    assert.equal(p.garment, garment);
    assert.deepEqual(parseProject(JSON.stringify(p)), p);
    assert.ok(
      p.pieces.every((x) => p.materials.some((m) => m.id === x.materialId)),
    );
  }
  assert.notEqual(createProject().id, createProject().id);
});
test("project imports reject cross references, duplicate IDs, extreme geometry and large payloads", () => {
  const p = createProject();
  assert.throws(() => parseProject("x".repeat(1000001)));
  assert.throws(() =>
    projectSchema.parse({
      ...p,
      pieces: [{ ...p.pieces[0], materialId: "missing" }],
    }),
  );
  assert.throws(() =>
    projectSchema.parse({ ...p, pieces: [p.pieces[0], p.pieces[0]] }),
  );
  assert.throws(() =>
    projectSchema.parse({
      ...p,
      pieces: [{ ...p.pieces[0], lengthCm: Infinity }],
    }),
  );
  assert.throws(() => projectSchema.parse({ ...p, version: 99 }));
  assert.throws(() =>
    projectSchema.parse({
      ...p,
      trims: [{ ...p.trims[0], pieceId: "not-found" }],
    }),
  );
});
test("shelf packing, waste, cut count and money totals follow entered dimensions", () => {
  const p = createProject("blouse");
  p.pieces = [
    {
      ...p.pieces[0],
      kind: "dupatta",
      topCm: 60,
      bottomCm: 60,
      lengthCm: 100,
      seamCm: 0,
      cutCount: 2,
    },
  ];
  p.materials = [{ ...p.materials[0], ratePaise: 10000 }];
  p.costing = {
    fabricWidthCm: 140,
    wastePercent: 10,
    labourPaise: 5000,
    overheadPercent: 10,
    markupPercent: 25,
  };
  const c = materialCost(p);
  assert.equal(c.lines[0].meters, 1.1);
  assert.equal(c.fabricPaise, 11000);
  assert.equal(c.overheadPaise, 1600);
  assert.equal(c.totalPaise, 17600);
  assert.equal(c.suggestedPaise, 22000);
  assert.equal(patternArea(p.pieces[0]), 6000);
  p.costing.fabricWidthCm = 80;
  p.pieces[0].bottomCm = 100;
  assert.equal(materialCost(p).complete, false);
});
test("pattern SVG encodes actual millimeters and escapes names; CSV cannot introduce spreadsheet formulas", () => {
  const p = createProject();
  p.name = '<script>alert("x")</script>';
  p.pieces[0].name = '<image href="bad"/>';
  p.materials[0].name = ' =HYPERLINK("bad")';
  const svg = exportPatternSvg(p, p.pieces[0].id);
  assert.match(svg, /width="[0-9.]+mm"/);
  assert.match(svg, /10 cm calibration/);
  assert.ok(!svg.includes("<script>"));
  assert.ok(!svg.includes('<image href="bad"'));
  assert.match(exportCostCsv(p), /"' =HYPERLINK/);
  assert.throws(() => exportPatternSvg(p, "missing"));
});
test("ease readings change with real body and pattern circumferences", () => {
  const p = createProject();
  const before = fitReadings(p);
  p.measurements.waist = 100;
  const after = fitReadings(p);
  assert.equal(before[1].cm, 10);
  assert.equal(after[1].cm, -20);
  assert.equal(after[1].status, "Too small");
});
test("cloth solver preserves pins, finite coordinates and a closed seam under bounded stepping", () => {
  const cloth = new SkirtCloth(14, 45, 100, 99, 24, 10);
  const pins = cloth.positions.slice(0, cloth.index(1, 0));
  for (let i = 0; i < 180; i++)
    cloth.step(
      1 / 60,
      {
        gravity: 9.8,
        wind: 1,
        stiffness: 0.8,
        damping: 0.97,
        collisions: true,
      },
      () => 16,
    );
  assert.deepEqual(cloth.positions.slice(0, cloth.index(1, 0)), pins);
  assert.ok([...cloth.positions].every(Number.isFinite));
  for (let row = 1; row <= cloth.rows; row++) {
    const a = cloth.index(row, 0),
      b = cloth.index(row, cloth.columns);
    assert.ok(Math.abs(cloth.positions[a] - cloth.positions[b]) < 0.0001);
    assert.ok(cloth.positions[a + 1] >= 1);
  }
  assert.notDeepEqual(cloth.positions, cloth.rest);
  cloth.reset();
  assert.deepEqual(cloth.positions, cloth.rest);
});
test("cloth responds to gravity and wind without accepting an unbounded timestep", () => {
  const zero = new SkirtCloth(12, 30, 80, 95, 16, 8),
    wind = new SkirtCloth(12, 30, 80, 95, 16, 8);
  const base = {
    gravity: 0,
    wind: 0,
    stiffness: 0.8,
    damping: 0.97,
    collisions: false,
  };
  zero.step(999, base);
  assert.ok(zero.time <= 0.025);
  for (let i = 0; i < 100; i++)
    wind.step(0.016, { ...base, gravity: 9.8, wind: 2 });
  assert.ok([...wind.positions].every(Number.isFinite));
  assert.notDeepEqual(wind.positions, zero.positions);
});

test("measurement transfer respects locked components and fills the remaining circumference", async () => {
  const { applyMeasurementEase, designChecks } =
    await import("../shared/workspace");
  const p = createProject();
  p.pieces[1].locked = true;
  p.pieces[1].topCm = 45;
  const next = applyMeasurementEase(p, 6);
  assert.equal(next.pieces[1].topCm, 45);
  assert.equal(next.pieces[0].topCm, 49);
  assert.equal(next.pieces[3].topCm, 9.5);
  assert.equal(fitReadings(next)[0].cm, 6);
  next.pieces[3].lengthCm = 3;
  assert.ok(designChecks(next).some((c) => c.id.startsWith("flare-")));
});
test("bodice and avatar sections remain finite and allow positive-ease torso coverage", async () => {
  const { avatarSection, bodiceSection } =
    await import("../shared/garmentGeometry");
  const p = createProject(),
    piece = p.pieces[0];
  for (const t of [0, 0.1, 0.3, 0.5, 0.7, 1]) {
    const section = bodiceSection(p, piece, t);
    assert.ok(section.x > 0 && section.z > 0 && Number.isFinite(section.x));
  }
  for (const t of [0.35, 0.5, 0.7, 1]) {
    const cloth = bodiceSection(p, piece, t),
      body = avatarSection(p, p.measurements.height * 0.8 - piece.lengthCm * t);
    assert.ok(cloth.x > body.x);
    assert.ok(cloth.z > body.z);
  }
});

test("all eighteen dress looks have independent valid parts and coordinated trims", () => {
  assert.equal(DRESS_LOOKS.length, 18);
  assert.equal(new Set(DRESS_LOOKS.map((l) => l.id)).size, 18);
  for (const look of DRESS_LOOKS) {
    const project = createDressLook(look.id);
    assert.ok(projectSchema.safeParse(project).success);
    assert.equal(project.materials[0].color, look.color);
    assert.ok(project.trims.length >= 6);
    assert.ok(dressPrompt(look).length <= 800);
    assert.notEqual(createDressLook(look.id).id, project.id);
  }
});
