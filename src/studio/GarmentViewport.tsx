import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Project } from "../../shared/workspace";
import { createGarmentModel, GarmentModel } from "./garmentScene";
export type ViewportApi = {
  snapshot: () => string;
  setView: (view: "front" | "back" | "side" | "perspective") => void;
  resetCloth: () => void;
};
export default function GarmentViewport({
  project,
  running,
  onSelect,
  apiRef,
}: {
  project: Project;
  running: boolean;
  onSelect: (id: string) => void;
  apiRef: React.MutableRefObject<ViewportApi | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const modelRef = useRef<GarmentModel | null>(null);
  const runningRef = useRef(running);
  const dirtyRef = useRef(true);
  const selectRef = useRef(onSelect);
  const [error, setError] = useState("");
  runningRef.current = running;
  selectRef.current = onSelect;
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setError(
        "3D is unavailable on this device. Pattern editing, measurements and exports still work.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      "Assembled garment on a measurement-based mannequin. Drag to rotate, scroll to zoom.",
    );
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2000);
    camera.position.set(190, 125, 310);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 83, 0);
    controls.enableDamping = true;
    const controlChanged = () => {
      dirtyRef.current = true;
    };
    controls.addEventListener("change", controlChanged);
    controls.minDistance = 100;
    controls.maxDistance = 650;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.update();
    scene.add(new THREE.HemisphereLight(0xfff6e9, 0x42635b, 3));
    const light = new THREE.DirectionalLight(0xfff4df, 4);
    light.position.set(110, 250, 180);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -130;
    light.shadow.camera.right = 130;
    light.shadow.camera.top = 220;
    light.shadow.camera.bottom = -30;
    scene.add(light);
    const rim = new THREE.DirectionalLight(0xffffff, 2);
    rim.position.set(-160, 100, -140);
    scene.add(rim);
    const floorGeo = new THREE.CircleGeometry(180, 64),
      floorMat = new THREE.MeshStandardMaterial({
        color: "#ece7df",
        roughness: 0.92,
      }),
      floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (w < 1 || h < 1) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dirtyRef.current = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    sceneRef.current = { scene, camera, renderer, controls, floorMat };
    let last = performance.now(),
      frame = 0,
      alive = true;
    const animate = (now: number) => {
      if (!alive) return;
      const dt = Math.min((now - last) / 1000, 0.025);
      last = now;
      if (!document.hidden) {
        if (runningRef.current) {
          modelRef.current?.update(dt);
          renderer.shadowMap.needsUpdate = true;
        }
        const changed = controls.update();
        if (runningRef.current || dirtyRef.current || changed) {
          renderer.render(scene, camera);
          dirtyRef.current = false;
        }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const raycaster = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const pointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const pointerUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5)
        return;
      const r = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      const hit = raycaster
        .intersectObjects(modelRef.current?.group.children || [])
        .find((h) => h.object.userData.pieceId);
      if (hit) selectRef.current(hit.object.userData.pieceId);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    apiRef.current = {
      snapshot: () => {
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL("image/png");
      },
      setView(view) {
        const target = controls.target;
        camera.position
          .copy(target)
          .add(
            view === "front"
              ? new THREE.Vector3(0, 15, 330)
              : view === "back"
                ? new THREE.Vector3(0, 15, -330)
                : view === "side"
                  ? new THREE.Vector3(330, 15, 0)
                  : new THREE.Vector3(190, 42, 310),
          );
        controls.update();
      },
      resetCloth() {
        modelRef.current?.cloths.forEach((c) => {
          c.cloth.reset();
          c.geometry.getAttribute("position").needsUpdate = true;
          c.geometry.computeVertexNormals();
        });
        dirtyRef.current = true;
        renderer.shadowMap.needsUpdate = true;
      },
    };
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      controls.removeEventListener("change", controlChanged);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      if (modelRef.current) {
        scene.remove(modelRef.current.group);
        modelRef.current.dispose();
        modelRef.current = null;
      }
      floorGeo.dispose();
      floorMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      apiRef.current = null;
    };
  }, []);
  useEffect(() => {
    const c = sceneRef.current;
    if (!c) return;
    if (modelRef.current) {
      c.scene.remove(modelRef.current.group);
      modelRef.current.dispose();
    }
    const model = createGarmentModel(project);
    modelRef.current = model;
    c.scene.add(model.group);
    dirtyRef.current = true;
    c.renderer.shadowMap.needsUpdate = true;
    c.scene.background = new THREE.Color(
      project.scene.background === "night"
        ? "#172d2c"
        : project.scene.background === "warm"
          ? "#e9d5bd"
          : "#edf0e8",
    );
    c.floorMat.color.set(
      project.scene.background === "night" ? "#284442" : "#e7e5dd",
    );
  }, [project]);
  return (
    <div className="atelier-viewport" ref={host} data-testid="garment-viewport">
      {error && (
        <p role="status" className="atelier-message">
          {error}
        </p>
      )}
      <div className="viewport-caption">
        <span className="status-dot" />
        {running ? "Cloth preview running" : "Assembled 3D preview"}
        <small>Parametric mannequin · approximate fit</small>
      </div>
    </div>
  );
}
