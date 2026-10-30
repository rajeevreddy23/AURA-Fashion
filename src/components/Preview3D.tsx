import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Design, templates } from "../../shared/studio";
import { svgText } from "./DesignArt";

export default function Preview3D({ design }: { design: Design }) {
  const host = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState("");
  const [textureReady, setTextureReady] = useState(false);
  const sceneRef = useRef<{
    mesh: THREE.Mesh;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
  } | null>(null);
  useEffect(() => {
    if (!host.current || !templates[design.template].preview) return;
    const element = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(
        "3D is unavailable on this device. Your 2D design is still editable.",
      );
      return;
    }
    setError("");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 2000);
    camera.position.set(0, 0, 900);
    const shape = new THREE.Shape();
    templates[design.template].points.forEach(([x, y], i) => {
      if (i === 0) shape.moveTo(x - 300, 300 - y);
      else shape.lineTo(x - 300, 300 - y);
    });
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 18,
      bevelEnabled: true,
      bevelSize: 3,
      bevelThickness: 3,
      bevelSegments: 2,
      steps: 1,
    });
    const position = geometry.getAttribute("position"),
      uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++)
      uv.setXY(
        i,
        (position.getX(i) + 300) / 600,
        (position.getY(i) + 300) / 600,
      );
    const face = new THREE.MeshStandardMaterial({
      color: design.fabric,
      roughness: 0.8,
    });
    const side = new THREE.MeshStandardMaterial({
      color: design.fabric,
      roughness: 0.85,
    });
    const mesh = new THREE.Mesh(geometry, [face, side]);
    scene.add(mesh);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x44335c, 2.3));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(-300, 500, 800);
    scene.add(light);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "3D garment concept preview",
    );
    renderer.domElement.setAttribute("role", "img");
    const current = { mesh, renderer, scene, camera };
    sceneRef.current = current;
    const resize = () => {
      const w = element.clientWidth,
        h = 350;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => {
      observer.disconnect();
      geometry.dispose();
      face.map?.dispose();
      face.dispose();
      side.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, [design.template]);
  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    setTextureReady(false);
    const materials = current.mesh.material as THREE.MeshStandardMaterial[];
    materials[1].color.set(design.fabric);
    const url = URL.createObjectURL(
      new Blob([svgText(design, true)], { type: "image/svg+xml" }),
    );
    let alive = true;
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        URL.revokeObjectURL(url);
        if (!alive) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        materials[0].map?.dispose();
        materials[0].map = texture;
        materials[0].color.set("#ffffff");
        materials[0].needsUpdate = true;
        current.renderer.render(current.scene, current.camera);
        setTextureReady(true);
      },
      undefined,
      () => {
        URL.revokeObjectURL(url);
        if (alive)
          setError(
            "The texture could not load. The preview shows the garment color.",
          );
      },
    );
    return () => {
      alive = false;
    };
  }, [design]);
  useEffect(() => {
    const c = sceneRef.current;
    if (c) {
      c.mesh.rotation.y = (rotation * Math.PI) / 180;
      c.renderer.render(c.scene, c.camera);
    }
  }, [rotation, design.template]);
  if (!templates[design.template].preview)
    return (
      <p className="notice">
        3D is not supported for the saree panel. Use the 2D view; realistic
        draping needs a fitted garment model.
      </p>
    );
  return (
    <div>
      <div
        ref={host}
        className="preview-stage"
        data-testid="preview-3d"
        data-texture-ready={textureReady}
      />
      {error && <p role="status">{error}</p>}
      <label className="field">
        Rotate preview{" "}
        <input
          type="range"
          min="0"
          max="360"
          value={rotation}
          onChange={(e) => setRotation(+e.target.value)}
        />
      </label>
      <p className="muted">
        Synchronized extruded concept with front artwork. It does not simulate
        fabric drape, seams or body fit.
      </p>
    </div>
  );
}
