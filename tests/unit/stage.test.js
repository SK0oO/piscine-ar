import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createStage } from '../../src/core/stage.js';

// API supposée (plan §2) : createStage() → { scene, camera, pivot, appliquerPose(pose) } sans WebGL.
describe('createStage', () => {
  it('expose scène, caméra (fov 60°) et un pivot dans la scène', () => {
    const stage = createStage();
    expect(stage.scene).toBeInstanceOf(THREE.Scene);
    expect(stage.camera.fov).toBe(60);
    expect(stage.pivot).toBeInstanceOf(THREE.Group);
    expect(stage.scene.children).toContain(stage.pivot);
  });

  it('appliquerPose règle pivot.position, rotation.y et une échelle uniforme', () => {
    const stage = createStage();
    stage.appliquerPose({ position: { x: 1, y: 0, z: -4 }, rotationY: 0.7, scale: 1.5 });
    expect(stage.pivot.position.toArray()).toEqual([1, 0, -4]);
    expect(stage.pivot.rotation.y).toBeCloseTo(0.7, 10);
    expect(stage.pivot.scale.toArray()).toEqual([1.5, 1.5, 1.5]);
  });

  it('appliquerPose est rejouable (la dernière pose gagne)', () => {
    const stage = createStage();
    stage.appliquerPose({ position: { x: 1, y: 0, z: -4 }, rotationY: 0.7, scale: 1.5 });
    stage.appliquerPose({ position: { x: 0, y: 0, z: -6 }, rotationY: 0, scale: 1 });
    expect(stage.pivot.position.toArray()).toEqual([0, 0, -6]);
    expect(stage.pivot.rotation.y).toBe(0);
    expect(stage.pivot.scale.toArray()).toEqual([1, 1, 1]);
  });
});
