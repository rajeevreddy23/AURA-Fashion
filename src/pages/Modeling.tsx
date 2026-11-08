import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DRESS_LOOKS, createDressLook } from "../../shared/lookLibrary";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import "../studio/modeling.css";
import MeshyPanel from "../studio/MeshyPanel";
import { createGarmentModel } from "../studio/garmentScene";
import type { Project } from "../../shared/workspace";

export default function Modeling() {
  const [params] = useSearchParams();
  const [sample, setSample] = useState(
    DRESS_LOOKS.some((l) => l.id === params.get("look"))
      ? params.get("look")!
      : DRESS_LOOKS[0].id,
  );
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<{
    load: (buffer: ArrayBuffer) => Promise<void>;
    sample: (project: Project) => void;
    export: () => Promise<ArrayBuffer>;
    wire: (enabled: boolean) => void;
    reset: () => void;
  } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Import a textured GLB model to begin.");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wire, setWire] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const el = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setStatus(
        "3D is unavailable on this device. Try a browser with WebGL enabled.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.setAttribute(
      "aria-label",
      "Imported 3D model. Drag to rotate; pinch or scroll to zoom.",
    );
    renderer.domElement.setAttribute("role", "img");
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#172a29");
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.minDistance = 0.3;
    orbit.maxDistance = 12;
    let dirty = true;
    const reset = () => {
      dirty = true;
      camera.position.set(0, 0.3, 3.5);
      orbit.target.set(0, 0, 0);
      orbit.update();
    };
    reset();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5c6b72, 2.5));
    const light = new THREE.DirectionalLight(0xffecd9, 3);
    light.position.set(3, 4, 5);
    scene.add(light);
    const rim = new THREE.DirectionalLight(0xb9d9ff, 2);
    rim.position.set(-3, 2, -3);
    scene.add(rim);
    let model: THREE.Group | null = null;
    let disposed = false;
    const release = (root: THREE.Object3D) => {
      const textures = new Set<THREE.Texture>();
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          for (const material of [object.material].flat()) {
            for (const value of Object.values(material))
              if (value instanceof THREE.Texture) textures.add(value);
            material.dispose();
          }
        }
      });
      textures.forEach((texture) => texture.dispose());
    };
    const manager = new THREE.LoadingManager();
    // GLB imports stay local. External images/buffers cannot make network requests.
    manager.setURLModifier((url) => {
      if (/^(blob:|data:)/.test(url)) return url;
      throw new Error(
        "Use a self-contained GLB with embedded textures and buffers.",
      );
    });
    const showModel = (root: THREE.Group) => {
      const bounds = new THREE.Box3().setFromObject(root);
      const size = bounds.getSize(new THREE.Vector3());
      const largest = Math.max(size.x, size.y, size.z);
      if (bounds.isEmpty() || !Number.isFinite(largest) || largest <= 0) {
        release(root);
        throw new Error("This file has no visible 3D geometry.");
      }
      const normalized = new THREE.Group();
      normalized.add(root);
      normalized.scale.setScalar(2 / largest);
      normalized.position
        .copy(bounds.getCenter(new THREE.Vector3()))
        .multiplyScalar(-2 / largest);
      if (model) {
        scene.remove(model);
        release(model);
      }
      model = normalized;
      scene.add(model);
      reset();
    };
    controls.current = {
      async load(buffer) {
        const gltf = await new GLTFLoader(manager).parseAsync(buffer, "");
        if (disposed) {
          release(gltf.scene);
          return;
        }
        showModel(gltf.scene);
      },
      sample(project) {
        showModel(createGarmentModel(project).group);
      },
      async export() {
        if (!model) throw new Error("Load a model first.");
        const { GLTFExporter } =
          await import("three/addons/exporters/GLTFExporter.js");
        const result = await new GLTFExporter().parseAsync(model, {
          binary: true,
        });
        if (!(result instanceof ArrayBuffer))
          throw new Error("Model export failed.");
        return result;
      },
      wire(enabled) {
        dirty = true;
        model?.traverse((object) => {
          if (object instanceof THREE.Mesh)
            for (const mat of [object.material].flat())
              if ("wireframe" in mat) mat.wireframe = enabled;
        });
      },
      reset,
    };
    const resize = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dirty = true;
    });
    resize.observe(el);
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!document.hidden) {
        const changed = orbit.update();
        if (changed || dirty) {
          renderer.render(scene, camera);
          dirty = false;
        }
      }
    };
    draw();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      orbit.dispose();
      if (model) release(model);
      renderer.dispose();
      renderer.domElement.remove();
      controls.current = null;
    };
  }, []);
  const importModel = async (next?: File) => {
    if (!next) return false;
    if (!/\.glb$/i.test(next.name) || next.size > 30 * 1024 * 1024) {
      setStatus("Choose a self-contained GLB file smaller than 30 MB.");
      return false;
    }
    setBusy(true);
    setStatus("Loading your model…");
    try {
      if (!controls.current)
        throw new Error("3D preview is unavailable on this device.");
      const buffer = await next.arrayBuffer();
      if (
        buffer.byteLength < 12 ||
        new DataView(buffer).getUint32(0, true) !== 0x46546c67
      )
        throw new Error("This is not a valid binary GLB model.");
      await controls.current.load(buffer);
      setFile(next);
      setReady(true);
      setWire(false);
      setStatus(
        `${next.name} loaded. Drag to rotate; pinch or scroll to zoom.`,
      );
      return true;
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not load this model.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modeling-page">
      <header>
        <div>
          <Link to="/studio">← Back to garment Studio</Link>
          <h1>AI 3D modeling</h1>
          <p>Inspect detailed avatars and garments generated with Meshy.</p>
        </div>
      </header>
      <div className="modeling-layout">
        <aside className="panel">
          <h2>Try a dress model now</h2>
          <label htmlFor="sample-dress">Editable sample dress</label>
          <select
            id="sample-dress"
            value={sample}
            disabled={busy}
            onChange={(e) => setSample(e.target.value)}
          >
            {DRESS_LOOKS.map((look) => (
              <option value={look.id} key={look.id}>
                {look.name}
              </option>
            ))}
          </select>
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              try {
                if (!controls.current)
                  throw new Error("3D preview is unavailable on this device.");
                controls.current.sample(createDressLook(sample));
                setFile(null);
                setReady(true);
                setWire(false);
                setStatus(
                  "Editable sample preview loaded. This is AURA geometry, not a Meshy-generated result.",
                );
              } catch (error) {
                setStatus(
                  error instanceof Error
                    ? error.message
                    : "Sample could not be loaded.",
                );
              }
            }}
          >
            Preview sample in 3D
          </button>
          <Link to={`/studio?look=${sample}`}>
            Edit this sample's fabric and patterns →
          </Link>
          <p>
            These 18 sample models work locally. Meshy creates a separate, more
            detailed model when your account is connected.
          </p>
          <MeshyPanel onModel={importModel} />
          <h2>Import your model</h2>
          <label htmlFor="model-import">
            GLB with embedded textures · up to 30 MB
          </label>
          <input
            id="model-import"
            type="file"
            accept=".glb"
            disabled={busy}
            onChange={(e) => {
              void importModel(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <p>
            Files stay in this tab and are not uploaded or saved automatically.
          </p>
          <p role="status">{status}</p>
          <p>
            Imported models are visual references. Pattern dimensions and cloth
            simulation remain in garment Studio.
          </p>
        </aside>
        <section className="modeling-stage" aria-label="3D model workspace">
          <div
            ref={host}
            className="modeling-canvas"
            data-testid="modeling-canvas"
          />
          {!ready && (
            <div className="modeling-empty">Your 3D model will appear here</div>
          )}
          <div className="modeling-actions">
            <button disabled={!ready} onClick={() => controls.current?.reset()}>
              Reset view
            </button>
            <label>
              <input
                type="checkbox"
                disabled={!ready}
                checked={wire}
                onChange={(e) => {
                  setWire(e.target.checked);
                  controls.current?.wire(e.target.checked);
                }}
              />{" "}
              Wireframe
            </label>
            <button
              disabled={!ready || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const output =
                    file ||
                    new Blob([await controls.current!.export()], {
                      type: "model/gltf-binary",
                    });
                  const url = URL.createObjectURL(output);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = file?.name || `sample-${sample}.glb`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (error) {
                  setStatus(
                    error instanceof Error ? error.message : "Export failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Download GLB
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
