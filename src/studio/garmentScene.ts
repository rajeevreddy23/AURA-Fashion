import * as THREE from "three";
import { Project, Material, Piece } from "../../shared/workspace";
import { SkirtCloth } from "../../shared/cloth";
import { avatarSection, bodiceSection } from "../../shared/garmentGeometry";

import { fabricCanvas } from "./fabricCanvas";
export function fabricTexture(
  material: Material,
  trims: Project["trims"] = [],
) {
  const texture = new THREE.CanvasTexture(fabricCanvas(material, trims));
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
    color: "#bd896b",
    roughness: 0.58,
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
    // Dense cross sections keep measurement changes continuous along the torso.
    const points = Array.from(
      { length: 65 },
      (_, i) => new THREE.Vector2(1, h * (0.47 + (0.38 * i) / 64)),
    );
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
    const hair = new THREE.MeshStandardMaterial({
      color: "#241714",
      roughness: 0.48,
    });
    const eyes = new THREE.MeshStandardMaterial({
      color: "#241b18",
      roughness: 0.35,
    });
    const lips = new THREE.MeshStandardMaterial({
      color: "#954e4c",
      roughness: 0.52,
    });
    const whites = new THREE.MeshStandardMaterial({
      color: "#e3d5c7",
      roughness: 0.4,
    });
    materials.push(hair, eyes, lips, whites);
    const headY = h * 0.925;
    const ellipsoid = (
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
    ) => {
      const mesh = add(new THREE.SphereGeometry(1, 32, 24), mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      return mesh;
    };
    ellipsoid(skin, 0, headY, 0, 7.3, 10.2, 7.2);
    ellipsoid(skin, 0, headY - 5.8, 2.1, 5.2, 4.3, 4.8);
    // Hair cap covers the back and crown while leaving a clear face in front.
    const cap = add(
      new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, 1.37),
      hair,
    );
    cap.position.set(0, headY + 0.5, -0.4);
    cap.scale.set(7.65, 10.4, 7.7);
    ellipsoid(hair, 0, headY - 1.5, -4.4, 7.2, 8.6, 4.5);
    ellipsoid(hair, 0, headY - 3, -9, 5.4, 5.6, 4.5);
    for (const side of [-1, 1]) {
      ellipsoid(skin, side * 7.1, headY - 1, 0, 1.1, 2.3, 1.4);
      ellipsoid(whites, side * 2.75, headY + 0.5, 6.45, 1.45, 0.65, 0.55);
      ellipsoid(eyes, side * 2.75, headY + 0.5, 6.91, 0.55, 0.55, 0.22);
      const brow = ellipsoid(
        hair,
        side * 2.8,
        headY + 2,
        6.45,
        1.65,
        0.25,
        0.25,
      );
      brow.rotation.z = side * -0.12;
      ellipsoid(skin, side * 3.6, headY - 2.3, 4.4, 2.2, 1.8, 1.2);
    }
    ellipsoid(skin, 0, headY - 1, 6.7, 0.85, 2, 1.25);
    ellipsoid(skin, 0, headY - 2.3, 6.9, 0.8, 0.6, 0.65);
    ellipsoid(lips, 0, headY - 4.1, 6.55, 1.65, 0.37, 0.36);
    ellipsoid(lips, 0, headY - 4.65, 6.42, 1.45, 0.4, 0.35);
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
      const handX =
        side *
        (project.measurements.shoulder / 2 +
          8 +
          (Math.sin(0.2) * project.measurements.arm) / 2);
      const handY = h * 0.65 - (Math.cos(0.2) * project.measurements.arm) / 2;
      const hand = ellipsoid(skin, handX, handY - 2, 0, 2.5, 4.8, 1.6);
      hand.rotation.z = side * 0.2;
      ellipsoid(skin, handX - side * 2.1, handY - 1, 0.7, 1, 2.8, 1);
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
      const mat = new THREE.MeshPhysicalMaterial({
        map: texture,
        sheen: 0.55,
        sheenRoughness: 0.65,
        sheenColor: new THREE.Color(source.color).lerp(
          new THREE.Color("#fff0da"),
          0.35,
        ),
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
          p.topCm * 0.32,
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
        mesh.position.set(-project.measurements.shoulder * 0.85, h * 0.49, -6);
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
