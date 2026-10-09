"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { useWorkflowStore, type NodeData } from "@/lib/store";
import { newSceneObject, sceneAt, JOINTS, POSES, type SceneObject, type Vec3 } from "@/lib/productionScene";
import { outputToCanvas, productionAI, parseProductionJSON } from "@/lib/productionClient";

function mannequin(color: string) {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const part = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, position: Vec3) => { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); return mesh; };
  const joint = (name: string, parent: THREE.Object3D, position: Vec3) => { const group = new THREE.Group(); group.name = name; group.position.set(...position); parent.add(group); return group; };
  const torso = joint("torso", root, [0, 1.05, 0]); part(torso, new THREE.CapsuleGeometry(0.24, 0.45, 6, 12), [0, 0.28, 0]);
  const head = joint("head", torso, [0, 0.86, 0]); part(head, new THREE.SphereGeometry(0.19, 16, 12), [0, 0, 0]); part(head, new THREE.BoxGeometry(0.08, 0.06, 0.1), [0, 0, 0.18]);
  for (const side of ["left", "right"]) {
    const sign = side === "left" ? -1 : 1;
    const arm = joint(side + "Arm", torso, [sign * 0.32, 0.52, 0]); part(arm, new THREE.CapsuleGeometry(0.075, 0.27, 4, 10), [0, -0.17, 0]);
    const elbow = joint(side + "Elbow", arm, [0, -0.37, 0]); part(elbow, new THREE.CapsuleGeometry(0.065, 0.26, 4, 10), [0, -0.16, 0]);
    const leg = joint(side + "Leg", root, [sign * 0.13, 1, 0]); part(leg, new THREE.CapsuleGeometry(0.11, 0.31, 4, 10), [0, -0.2, 0]);
    const knee = joint(side + "Knee", leg, [0, -0.45, 0]); part(knee, new THREE.CapsuleGeometry(0.085, 0.31, 4, 10), [0, -0.2, 0]); part(knee, new THREE.BoxGeometry(0.16, 0.11, 0.3), [0, -0.45, 0.08]);
  }
  return root;
}
function dispose(object: THREE.Object3D) { object.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); const mats = Array.isArray(child.material) ? child.material : [child.material]; mats.forEach(m => m.dispose()); } }); }

export default function DirectorConsole({ id, data }: { id: string; data: NodeData }) {
  const update = useWorkflowStore(s => s.updateNodeData);
  const objects = (data.sceneObjects as SceneObject[] | undefined) ?? [];
  const [selected, select] = useState<string>(objects[0]?.id ?? ""), [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [cameraView, setCameraView] = useState(false), [mode, setMode] = useState<"translate" | "rotate" | "scale">("translate"), [autoKey, setAutoKey] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [search, setSearch] = useState("");
  const host = useRef<HTMLDivElement>(null), runtime = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; transform: TransformControls; models: Map<string, THREE.Object3D> } | null>(null);
  const state = useRef({ objects, selected, time, playing, cameraView, duration: Number(data.sceneDuration ?? 10), loop: Boolean(data.sceneLoop), mainCamera: String(data.mainCamera ?? "") });
  state.current = { objects, selected, time, playing, cameraView, duration: Number(data.sceneDuration ?? 10), loop: Boolean(data.sceneLoop), mainCamera: String(data.mainCamera ?? "") };
  const selectedObject = objects.find(o => o.id === selected);
  function save(next: SceneObject[]) { update(id, { sceneObjects: next }); }
  function change(values: Partial<SceneObject>) {
    save(objects.map(o => { if (o.id !== selected || o.locked) return o; const next = { ...o, ...values }; if (autoKey) next.frames = [...next.frames.filter(f => Math.abs(f.time - time) > 0.02), { time, position: next.position, rotation: next.rotation, scale: next.scale, joints: next.joints }]; return next; }));
  }
  const changeRef = useRef(change); changeRef.current = change;
  useEffect(() => {
    if (!host.current) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch { setError("WebGL não está disponível neste navegador."); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(host.current.clientWidth, 360); host.current.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#eeeaf4");
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6f6384, 2)); const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(3, 7, 5); scene.add(light);
    const grid = new THREE.GridHelper(20, 20, 0xbab0cc, 0xd8d0e2); scene.add(grid);
    const camera = new THREE.PerspectiveCamera(45, host.current.clientWidth / 360, 0.05, 1000); camera.position.set(6, 4, 7);
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 1, 0); controls.update(); controls.saveState();
    const transform = new TransformControls(camera, renderer.domElement); scene.add(transform.getHelper());
    transform.addEventListener("dragging-changed", e => { controls.enabled = !e.value; });
    transform.addEventListener("mouseUp", () => { const obj = transform.object; if (obj) changeRef.current({ position: obj.position.toArray() as Vec3, rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z].map(THREE.MathUtils.radToDeg) as Vec3, scale: obj.scale.toArray() as Vec3 }); });
    const models = new Map<string, THREE.Object3D>(); runtime.current = { renderer, scene, camera, controls, transform, models };
    let frame = 0, last = performance.now(), currentTime = 0;
    const draw = (now: number) => {
      const current = state.current; const delta = Math.min((now - last) / 1000, 0.1); last = now;
      if (current.playing) { currentTime += delta; if (currentTime > current.duration) { if (current.loop) currentTime = 0; else { currentTime = current.duration; setPlaying(false); } } setTime(currentTime); } else currentTime = current.time;
      for (const item of current.objects) {
        const object = models.get(item.id); if (!object || (transform.dragging && transform.object === object)) continue;
        const sampled = sceneAt(item, currentTime); object.position.set(...sampled.position); object.rotation.set(...sampled.rotation.map(THREE.MathUtils.degToRad) as Vec3); object.scale.set(...sampled.scale); object.visible = !item.hidden && !(current.cameraView && item.kind === "camera");
        for (const key of JOINTS) { const bone = object.getObjectByName(key.slice(0, -1)); if (bone) bone.rotation[key.at(-1)!.toLowerCase() as "x" | "y" | "z"] = THREE.MathUtils.degToRad(sampled.joints?.[key] ?? 0); }
      }
      let viewCamera = camera;
      if (current.cameraView) { const item = current.objects.find(o => o.id === current.mainCamera && o.kind === "camera") ?? current.objects.find(o => o.kind === "camera"); if (item) { const sample = sceneAt(item, currentTime); const virtual = new THREE.PerspectiveCamera(45, camera.aspect, 0.05, 1000); virtual.position.set(...sample.position); virtual.rotation.set(...sample.rotation.map(THREE.MathUtils.degToRad) as Vec3); viewCamera = virtual; } }
      transform.getHelper().visible = !current.cameraView && !current.playing; grid.visible = !current.cameraView; controls.update(); renderer.render(scene, viewCamera); frame = requestAnimationFrame(draw);
    }; frame = requestAnimationFrame(draw);
    const observer = new ResizeObserver(() => { if (!host.current) return; const width = host.current.clientWidth; renderer.setSize(width, 360); camera.aspect = width / 360; camera.updateProjectionMatrix(); }); observer.observe(host.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); transform.dispose(); dispose(scene); renderer.dispose(); renderer.domElement.remove(); runtime.current = null; };
  }, []);
  useEffect(() => {
    const rt = runtime.current; if (!rt) return; let alive = true;
    rt.transform.detach(); for (const object of rt.models.values()) { rt.scene.remove(object); dispose(object); } rt.models.clear();
    for (const item of objects) {
      let object: THREE.Object3D;
      if (item.kind === "character") object = mannequin(item.color);
      else if (item.kind === "camera") { object = new THREE.Group(); const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.4), new THREE.MeshStandardMaterial({ color: "#62557b" })); object.add(mesh); }
      else if (item.kind === "model") { object = new THREE.Group(); if (item.modelUrl) new GLTFLoader().load(item.modelUrl, gltf => { if (alive) object.add(gltf.scene); else dispose(gltf.scene); }, undefined, () => setError("Falha ao carregar o modelo GLB.")); }
      else object = new THREE.Mesh(item.kind === "sphere" ? new THREE.SphereGeometry(0.5, 24, 16) : new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: item.color }));
      object.userData.id = item.id; rt.scene.add(object); rt.models.set(item.id, object);
    }
    const target = objects.find(o => o.id === selected); if (target && !target.locked) rt.transform.attach(rt.models.get(selected)!);
    return () => { alive = false; };
  }, [objects, selected]);
  useEffect(() => { runtime.current?.transform.setMode(mode); }, [mode]);
  useEffect(() => { if (data.panoramaUrl && runtime.current) { let alive = true; const texture = new THREE.TextureLoader().load(String(data.panoramaUrl), () => { if (alive && runtime.current) { texture.mapping = THREE.EquirectangularReflectionMapping; runtime.current.scene.background = texture; } }); return () => { alive = false; texture.dispose(); }; } }, [data.panoramaUrl]);
  async function upload(blob: Blob, kind: "image" | "video") { const res = await fetch("/api/upload-asset", { method: "POST", headers: { "Content-Type": blob.type }, body: blob }); const result = await res.json(); if (!res.ok || !result.cdnUrl) throw new Error(result.error || "Falha ao salvar captura."); outputToCanvas(id, result.cdnUrl, kind, kind === "image" ? "Captura da direção" : "Timeline 3D"); }
  async function capture(video = false) {
    if (!runtime.current || busy) return; setBusy(true); setError("");
    try {
      const canvas = runtime.current.renderer.domElement;
      if (!video) { const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Falha na captura")), "image/png")); await upload(blob, "image"); }
      else { const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm"; const stream = canvas.captureStream(30); const recorder = new MediaRecorder(stream, { mimeType: mime }); const chunks: Blob[] = []; const done = new Promise<Blob>((resolve, reject) => { recorder.ondataavailable = e => chunks.push(e.data); recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" })); recorder.onerror = () => reject(new Error("Falha na gravação")); }); setTime(0); setCameraView(true); await new Promise(r => setTimeout(r, 100)); setPlaying(true); recorder.start(); await new Promise(r => setTimeout(r, Number(data.sceneDuration ?? 10) * 1000)); recorder.stop(); setPlaying(false); stream.getTracks().forEach(t => t.stop()); await upload(await done, "video"); }
    } catch (e) { setError(e instanceof Error ? e.message : "Falha na captura."); } finally { setBusy(false); }
  }
  return <>
    <div className="pn-actions">{(["character", "box", "sphere", "camera"] as const).map(kind => <button key={kind} onClick={() => { const next = newSceneObject(kind); next.position[0] = objects.filter(o => o.kind === kind).length * 1.5; save([...objects, next]); select(next.id); }}>+ {kind === "character" ? "Personagem" : kind === "camera" ? "Câmera" : kind === "box" ? "Cubo" : "Esfera"}</button>)}<button onClick={() => save([...objects, ...Array.from({ length: 9 }, (_, i) => ({ ...newSceneObject("character"), position: [(i % 3) * 1.5, 0, Math.floor(i / 3) * -1.5] as Vec3 }))])}>+ Multidão</button></div>
    <div className="pn-actions"><button aria-pressed={!cameraView} onClick={() => setCameraView(false)}>Director View</button><button aria-pressed={cameraView} onClick={() => setCameraView(true)}>Camera View</button><button onClick={() => runtime.current?.controls.reset()}>Reset View</button><select aria-label="Transformação" value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option value="translate">Mover</option><option value="rotate">Rotacionar</option><option value="scale">Escalar</option></select></div>
    <div ref={host} className="pn-stage" style={{ height: 360, minHeight: 360, overflow: "hidden", borderRadius: 10 }} onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()} />
    <div className="pn-grid"><div><label>Scene · buscar<input value={search} onChange={e => setSearch(e.target.value)} /></label>{objects.filter(o => o.name.toLowerCase().includes(search.toLowerCase())).map(o => <button key={o.id} aria-pressed={o.id === selected} onClick={() => select(o.id)}>{o.name}{o.hidden ? " · oculto" : ""}{o.locked ? " · bloqueado" : ""}</button>)}</div><div>{selectedObject && <><label>Nome<input value={selectedObject.name} onChange={e => change({ name: e.target.value })} disabled={selectedObject.locked} /></label><div className="pn-actions"><button onClick={() => save(objects.map(o => o.id === selected ? { ...o, hidden: !o.hidden } : o))}>{selectedObject.hidden ? "Mostrar" : "Ocultar"}</button><button onClick={() => save(objects.map(o => o.id === selected ? { ...o, locked: !o.locked } : o))}>{selectedObject.locked ? "Desbloquear" : "Bloquear"}</button><button disabled={selectedObject.locked} onClick={() => save(objects.filter(o => o.id !== selected))}>Excluir objeto</button></div>
    {(["position", "rotation", "scale"] as const).map(key => <fieldset key={key} disabled={selectedObject.locked}><legend>{key === "position" ? "Posição XYZ" : key === "rotation" ? "Rotação XYZ (graus)" : "Escala XYZ"}</legend><div className="pn-vector">{selectedObject[key].map((v, i) => <input key={i} aria-label={`${key} ${"XYZ"[i]}`} type="number" step="0.1" value={v} onChange={e => { const next = [...selectedObject[key]] as Vec3; next[i] = Number(e.target.value); change({ [key]: next }); }} />)}</div></fieldset>)}<label>Cor<input type="color" value={selectedObject.color} disabled={selectedObject.locked} onChange={e => change({ color: e.target.value })} /></label>
    {selectedObject.kind === "character" && <><label>Pose<select value={selectedObject.pose ?? "Stand"} disabled={selectedObject.locked} onChange={e => change({ pose: e.target.value, joints: POSES[e.target.value] })}>{Object.keys(POSES).map(p => <option key={p}>{p}</option>)}</select></label><details><summary>Pose articulada</summary>{JOINTS.map(j => <label key={j}>{j}<input type="range" min="-180" max="180" value={selectedObject.joints?.[j] ?? 0} disabled={selectedObject.locked} onChange={e => change({ joints: { ...selectedObject.joints, [j]: Number(e.target.value) } })} /></label>)}</details></>}</>}</div></div>
    <div className="pn-grid"><label>Importar modelo GLB<input type="file" accept=".glb" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { const res = await fetch("/api/upload-asset", { method: "POST", headers: { "Content-Type": "model/gltf-binary" }, body: file }); const r = await res.json(); if (!res.ok) throw new Error(r.error); save([...objects, { ...newSceneObject("model"), modelUrl: r.cdnUrl, name: file.name }]); } catch (e) { setError(String(e)); } }} /></label><label>Panorama<input type="file" accept="image/*" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; const res = await fetch("/api/upload-asset", { method: "POST", headers: { "Content-Type": file.type }, body: file }); const r = await res.json(); if (r.cdnUrl) update(id, { panoramaUrl: r.cdnUrl }); }} /></label></div>
    <fieldset><legend>Animation Timeline</legend><div className="pn-actions"><button onClick={() => setPlaying(!playing)}>{playing ? "Pausar" : "Reproduzir"}</button><label><input type="checkbox" checked={Boolean(data.sceneLoop)} onChange={e => update(id, { sceneLoop: e.target.checked })} /> Loop</label><label><input type="checkbox" checked={autoKey} onChange={e => setAutoKey(e.target.checked)} /> Auto Keyframe</label><button disabled={!selectedObject || selectedObject.locked} onClick={() => selectedObject && change({ frames: [...selectedObject.frames.filter(f => Math.abs(f.time - time) > 0.02), { time, position: selectedObject.position, rotation: selectedObject.rotation, scale: selectedObject.scale, joints: selectedObject.joints }] })}>Criar keyframe</button></div><label>Playhead · {time.toFixed(2)} s<input type="range" min="0" max={Number(data.sceneDuration ?? 10)} step="0.03" value={time} onChange={e => { setPlaying(false); setTime(Number(e.target.value)); }} /></label><div className="pn-grid"><label>Duração (s)<input type="number" min="1" max="120" value={Number(data.sceneDuration ?? 10)} onChange={e => update(id, { sceneDuration: Math.max(1, Math.min(120, Number(e.target.value))) })} /></label><label>Câmera principal<select value={String(data.mainCamera ?? "")} onChange={e => update(id, { mainCamera: e.target.value })}><option value="">Primeira câmera</option>{objects.filter(o => o.kind === "camera").map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label></div>{selectedObject?.frames.map(f => <button key={f.time} title="Clique para ir; botão direito para excluir" onClick={() => setTime(f.time)} onContextMenu={e => { e.preventDefault(); change({ frames: selectedObject.frames.filter(k => k.time !== f.time) }); }}>◆ {f.time.toFixed(2)}s</button>)}</fieldset>
    <label>Compor cena por descrição<textarea value={String(data.prompt ?? "")} onChange={e => update(id, { prompt: e.target.value })} /></label><button disabled={busy || !data.prompt} onClick={async () => { setBusy(true); setError(""); try { const text = await productionAI(`Crie uma cena 3D simples a partir da descrição. Retorne apenas JSON como array de objetos {name,kind:"character"|"box"|"sphere"|"camera",position:[x,y,z],rotation:[grausX,grausY,grausZ],scale:[x,y,z],color:"#hex"}. Eixo Y para cima, câmera olha para -Z. Até 15 objetos. Descrição: ${data.prompt}`); const items = parseProductionJSON<Partial<SceneObject>[]>(text); if (!Array.isArray(items) || items.length > 15) throw new Error("Cena inválida."); const additions = items.filter(o => ["character", "box", "sphere", "camera"].includes(o.kind ?? "")).map(o => ({ ...newSceneObject(o.kind!), name: String(o.name || o.kind), ...Object.fromEntries(["position", "rotation", "scale"].filter(k => Array.isArray(o[k as keyof SceneObject]) && (o[k as keyof SceneObject] as number[]).length === 3 && (o[k as keyof SceneObject] as number[]).every(Number.isFinite)).map(k => [k, o[k as keyof SceneObject]])) })); save([...objects, ...additions]); } catch (e) { setError(String(e)); } finally { setBusy(false); } }}>Compor cena com IA</button>
    <div className="pn-actions"><button disabled={busy} onClick={() => void capture()}>Screenshot → Canvas</button><button disabled={busy || !objects.some(o => o.kind === "camera")} onClick={() => void capture(true)}>Exportar vídeo → Canvas</button></div>{busy && <p role="status">Processando…</p>}{error && <p className="pn-error" role="alert">{error}</p>}
  </>;
}
