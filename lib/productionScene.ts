export type Vec3 = [number, number, number];
export interface SceneFrame { time: number; position: Vec3; rotation: Vec3; scale: Vec3; joints?: Record<string, number> }
export interface SceneObject { id: string; name: string; kind: "character" | "box" | "sphere" | "camera" | "model"; position: Vec3; rotation: Vec3; scale: Vec3; color: string; hidden?: boolean; locked?: boolean; pose?: string; joints?: Record<string, number>; frames: SceneFrame[]; modelUrl?: string }
export const POSES: Record<string, Record<string, number>> = {
  Stand: {}, "T-Pose": { leftArmZ: -90, rightArmZ: 90 }, Walk: { leftArmX: 25, rightArmX: -25, leftLegX: -25, rightLegX: 25 }, Run: { leftArmX: 65, rightArmX: -65, leftLegX: -55, rightLegX: 55, torsoX: 15 }, Sit: { leftLegX: -90, rightLegX: -90, leftKneeX: 90, rightKneeX: 90 }, Crouch: { torsoX: 25, leftLegX: -60, rightLegX: -60, leftKneeX: 100, rightKneeX: 100 }, "One Knee": { rightLegX: -90, rightKneeX: 90, leftKneeX: 90 }, "Two Knees": { leftKneeX: 100, rightKneeX: 100 }, "Hands on Hips": { leftArmZ: -30, rightArmZ: 30, leftElbowX: -100, rightElbowX: -100 }, Lean: { torsoZ: 20 }, Bow: { torsoX: 60 }, Think: { rightArmX: -40, rightElbowX: -120, headX: 20 }, Fight: { leftArmX: -70, rightArmX: -70, leftElbowX: -90, rightElbowX: -90 }, Kick: { leftLegX: -90, rightArmX: -60 }, Throw: { rightArmX: -140, torsoY: -30 }, Push: { leftArmX: -90, rightArmX: -90, torsoX: 15 }, Wave: { rightArmZ: 140, rightElbowX: -40 }, Reach: { leftArmX: -140 }, "Arms Crossed": { leftArmZ: -40, rightArmZ: 40, leftElbowX: -110, rightElbowX: -110 }, "On Phone": { rightArmX: -45, rightElbowX: -135 },
};
export const JOINTS = ["torsoX", "torsoY", "torsoZ", "headX", "headY", "leftArmX", "leftArmZ", "rightArmX", "rightArmZ", "leftElbowX", "rightElbowX", "leftLegX", "leftLegZ", "rightLegX", "rightLegZ", "leftKneeX", "rightKneeX"];
export const newSceneObject = (kind: SceneObject["kind"]): SceneObject => ({ id: crypto.randomUUID(), name: kind === "character" ? "Personagem" : kind === "camera" ? "Câmera" : kind === "model" ? "Modelo" : "Objeto", kind, position: kind === "camera" ? [0, 2, 6] : [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: "#a48dd0", frames: [] });
export function sceneAt(object: SceneObject, time: number): SceneObject {
  const frames = [...(object.frames ?? [])].sort((a, b) => a.time - b.time);
  if (!frames.length) return object;
  const left = frames.filter(f => f.time <= time).at(-1) ?? frames[0], right = frames.find(f => f.time > time) ?? left;
  const t = right.time === left.time ? 0 : Math.max(0, Math.min(1, (time - left.time) / (right.time - left.time)));
  const mix = (a: Vec3, b: Vec3) => a.map((v, i) => v + (b[i] - v) * t) as Vec3;
  const joints = Object.fromEntries(JOINTS.map(k => [k, (left.joints?.[k] ?? 0) + ((right.joints?.[k] ?? 0) - (left.joints?.[k] ?? 0)) * t]));
  return { ...object, position: mix(left.position, right.position), rotation: mix(left.rotation, right.rotation), scale: mix(left.scale, right.scale), joints };
}
