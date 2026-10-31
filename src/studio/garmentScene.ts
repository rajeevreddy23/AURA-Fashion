import * as THREE from "three";
import { Project, Material, Piece } from "../../shared/workspace";
import { SkirtCloth } from "../../shared/cloth";
import { avatarSection, bodiceSection } from "../../shared/garmentGeometry";

export function fabricTexture(
  material: Material,
  trims: Project["trims"] = [],
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const c = canvas.getContext("2d")!;
  c.fillStyle = material.color;
  c.fillRect(0, 0, 512, 512);
  c.strokeStyle = "#f3d18c";
  c.fillStyle = "#edc77e";
  c.globalAlpha = 0.58;
  const spacing = 64 / material.textureScale;
  for (let y = 0; y < 512; y += spacing)
    for (let x = 0; x < 512; x += spacing) {
      if (material.pattern === "brocade" || material.pattern === "floral") {
        c.save();
        c.translate(x + spacing / 2, y + spacing / 2);
        for (let petal = 0; petal < 6; petal++) {
          c.rotate(Math.PI / 3);
          c.beginPath();
          c.ellipse(
            0,
            spacing * 0.12,
            spacing * 0.055,
            spacing * 0.14,
            0,
            0,
            Math.PI * 2,
          );
          c.stroke();
        }
        c.beginPath();
        c.arc(0, 0, spacing * 0.04, 0, Math.PI * 2);
        c.fill();
        if (material.pattern === "brocade") {
          c.beginPath();
          c.moveTo(0, -spacing * 0.4);
          c.lineTo(spacing * 0.4, 0);
          c.lineTo(0, spacing * 0.4);
          c.lineTo(-spacing * 0.4, 0);
          c.closePath();
          c.lineWidth = 0.7;
          c.stroke();
        }
        c.restore();
      }
    }
  if (material.pattern === "stripes" || material.pattern === "checks") {
    c.lineWidth = Math.max(1, spacing * 0.13);
    for (let x = 0; x < 512; x += spacing) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 512);
      c.stroke();
    }
    if (material.pattern === "checks")
      for (let y = 0; y < 512; y += spacing) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(512, y);
        c.stroke();
      }
  }
  c.globalAlpha = 1;
  trims.forEach((t) => {
    c.fillStyle = t.color;
    c.strokeStyle = t.color;
    const y = t.position * 512,
      h = Math.max(2, t.size * 4);
    if (t.kind === "border") {
      c.fillRect(0, y - h / 2, 512, h);
      c.fillStyle = material.color;
      c.globalAlpha = 0.5;
      for (let x = 4; x < 512; x += 16) {
        c.beginPath();
        c.arc(x, y, h * 0.2, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    }
    if (t.kind === "embroidery")
      for (let x = 12; x < 512; x += 40) {
        c.beginPath();
        c.arc(x, y, 8, 0, Math.PI * 2);
        c.stroke();
      }
    if (t.kind === "buttons")
      for (let x = 48; x < 512; x += 80) {
        c.beginPath();
        c.arc(x, y, h * 0.5, 0, Math.PI * 2);
        c.fill();
      }
    if (t.kind === "tassels")
      for (let x = 16; x < 512; x += 60) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y + h * 2);
        c.lineWidth = 3;
        c.stroke();
      }
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
export type GarmentModel = {
  group: THREE.Group;
  cloths: {
    cloth: SkirtCloth;
    geometry: THREE.BufferGeometry;
    material: Material;
  }[];
  update: (dt: number) => void;
  dispose: () => void;
};
export function createGarmentModel(project: Project): GarmentModel {
  const group = new THREE.Group();
  const cloths: GarmentModel["cloths"] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const h = project.measurements.height,
    waistY = h * 0.6;
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    p?: Piece,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (p) mesh.userData.pieceId = p.id;
    group.add(mesh);
    geometries.push(geometry);
    return mesh;
  };
  const skin = new THREE.MeshStandardMaterial({
    color: "#bba391",
    roughness: 0.7,
  });
  materials.push(skin);
  const bodyRadius = (y: number) => {
    if (y > waistY + 2 || y < h * 0.27) return 0;
    const hipY = h * 0.49;
    return y >= hipY
      ? THREE.MathUtils.lerp(
          project.measurements.hip / (Math.PI * 2),
          project.measurements.waist / (Math.PI * 2),
          (y - hipY) / (waistY - hipY),
        )
      : (project.measurements.hip / (Math.PI * 2)) * 0.88;
  };
  if (project.scene.showAvatar) {
    const points = [
      new THREE.Vector2(project.measurements.hip / (Math.PI * 2), h * 0.47),
      new THREE.Vector2(project.measurements.hip / (Math.PI * 2), h * 0.51),
      new THREE.Vector2(project.measurements.waist / (Math.PI * 2), waistY),
      new THREE.Vector2(project.measurements.bust / (Math.PI * 2), h * 0.73),
      new THREE.Vector2(project.measurements.shoulder / 2, h * 0.8),
      new THREE.Vector2(6, h * 0.85),
    ];
    const torsoGeometry = new THREE.LatheGeometry(
      points.map((p) => new THREE.Vector2(1, p.y)),
      40,
    );
    const torsoPositions = torsoGeometry.getAttribute("position");
    for (let i = 0; i < torsoPositions.count; i++) {
      const section = avatarSection(project, torsoPositions.getY(i));
      torsoPositions.setX(i, torsoPositions.getX(i) * section.x);
      torsoPositions.setZ(i, torsoPositions.getZ(i) * section.z);
    }
    torsoGeometry.computeVertexNormals();
    add(torsoGeometry, skin);
    const head = add(new THREE.SphereGeometry(9, 24, 20), skin);
    head.position.set(0, h * 0.93, 0);
    head.scale.set(0.85, 1.18, 0.88);
    const neck = add(new THREE.CylinderGeometry(5.5, 6, 9, 20), skin);
    neck.position.y = h * 0.85;
    for (const side of [-1, 1]) {
      const leg = add(new THREE.CapsuleGeometry(5, h * 0.38, 8, 18), skin);
      leg.position.set(side * 7.5, h * 0.23, 0);
      const foot = add(new THREE.SphereGeometry(5, 16, 12), skin);
      foot.position.set(side * 7.5, 3, 4);
      foot.scale.set(1, 0.65, 1.8);
      const arm = add(
        new THREE.CapsuleGeometry(3.7, project.measurements.arm - 7, 8, 16),
        skin,
      );
      arm.position.set(
        side * (project.measurements.shoulder / 2 + 8),
        h * 0.65,
        0,
      );
      arm.rotation.z = side * 0.2;
    }
  }
  project.pieces
    .filter((p) => p.visible)
    .forEach((p) => {
      const source = project.materials.find((m) => m.id === p.materialId)!;
      const texture = fabricTexture(
        source,
        project.trims.filter((t) => t.pieceId === p.id),
      );
      textures.push(texture);
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        color: "#ffffff",
        roughness: source.roughness,
        metalness: source.metalness,
        opacity: source.opacity,
        transparent: source.opacity < 1,
        side: THREE.DoubleSide,
        wireframe: project.scene.wireframe,
      });
      materials.push(mat);
      if (p.kind === "skirt" || p.kind === "lining") {
        const top = (p.topCm * p.cutCount) / (2 * Math.PI),
          hem = (p.bottomCm * p.cutCount) / (2 * Math.PI),
          cloth = new SkirtCloth(top, hem, p.lengthCm, waistY);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(cloth.positions, 3),
        );
        const uvs: number[] = [],
          indices: number[] = [];
        for (let row = 0; row <= cloth.rows; row++)
          for (let col = 0; col <= cloth.columns; col++) {
            uvs.push((col / cloth.columns) * p.cutCount, 1 - row / cloth.rows);
            if (row < cloth.rows && col < cloth.columns) {
              const a = row * (cloth.columns + 1) + col,
                b = a + cloth.columns + 1;
              indices.push(a, b, a + 1, b, b + 1, a + 1);
            }
          }
        texture.wrapS = THREE.RepeatWrapping;
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        add(geometry, mat, p);
        cloths.push({ cloth, geometry, material: source });
      } else if (p.kind === "bodice-front" || p.kind === "bodice-back") {
        const front = p.kind === "bodice-front";
        const geometry = new THREE.CylinderGeometry(
          1,
          1,
          p.lengthCm,
          32,
          16,
          true,
          front ? -Math.PI / 2 : Math.PI / 2,
          Math.PI,
        );
        const positions = geometry.getAttribute("position");
        for (let i = 0; i < positions.count; i++) {
          const t = (p.lengthCm / 2 - positions.getY(i)) / p.lengthCm,
            section = bodiceSection(project, p, t);
          const x = positions.getX(i) * section.x,
            z = positions.getZ(i) * section.z;
          const notch =
            Math.max(0, 1 - Math.abs(x) / Math.max(1, section.x * 0.45)) *
            p.lengthCm *
            (front ? 0.14 : 0.06) *
            Math.pow(1 - t, 3);
          positions.setXYZ(i, x, positions.getY(i) - notch, z);
        }
        geometry.computeVertexNormals();
        const mesh = add(geometry, mat, p);
        mesh.position.y = h * 0.8 - p.lengthCm / 2;
      } else if (p.kind === "waistband") {
        const geometry = new THREE.CylinderGeometry(
          p.topCm / (Math.PI * 2),
          p.bottomCm / (Math.PI * 2),
          p.lengthCm,
          48,
          2,
          true,
        );
        const mesh = add(geometry, mat, p);
        mesh.position.y = waistY;
        mesh.scale.z = 0.94;
      } else if (p.kind === "sleeve") {
        for (const side of [-1, 1].slice(0, Math.min(2, p.cutCount))) {
          const mesh = add(
            new THREE.CylinderGeometry(
              p.topCm / (Math.PI * 2),
              p.bottomCm / (Math.PI * 2),
              p.lengthCm,
              24,
              4,
              true,
            ),
            mat,
            p,
          );
          mesh.position.set(
            side * (project.measurements.shoulder / 2 + 5),
            h * 0.8 - p.lengthCm / 2,
            0,
          );
          mesh.rotation.z = side * 0.2;
        }
      } else if (p.kind === "dupatta") {
        const geometry = new THREE.PlaneGeometry(
          p.topCm * 0.52,
          p.lengthCm * 0.56,
          14,
          24,
        );
        const pos = geometry.getAttribute("position");
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i),
            y = pos.getY(i);
          pos.setZ(i, Math.sin(x * 0.24) * 1.5 + Math.sin(y * 0.06) * 2);
        }
        geometry.computeVertexNormals();
        const mesh = add(geometry, mat, p);
        mesh.position.set(-project.measurements.shoulder * 0.65, h * 0.49, 12);
        mesh.rotation.z = -0.12;
      }
    });
  return {
    group,
    cloths,
    update(dt) {
      cloths.forEach(({ cloth, geometry, material }) => {
        cloth.step(
          dt,
          project.simulation,
          bodyRadius,
          material.gsm,
          material.stretch,
        );
        geometry.getAttribute("position").needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
      });
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
