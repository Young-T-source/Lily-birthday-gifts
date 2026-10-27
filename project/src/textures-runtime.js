import * as THREE from 'three';
import { BAKED_TEXTURES } from './baked-textures-data.js';

// The authored grain, weave, frost and snow maps are baked during development.
// Decode them before constructing materials, so opening the gift does not spend
// tens of seconds generating pixels on the recipient's CPU.
export async function loadSceneTextures() {
  async function hydrate(value) {
    if (value?.$texture) {
      const picture = new Image();
      picture.src = value.src;
      await picture.decode();
      const texture = new THREE.Texture(picture);
      const props = value.props || {};
      for (const [key, item] of Object.entries(props)) {
        if (key === 'repeat' || key === 'offset' || key === 'center') texture[key].set(...item);
        else texture[key] = item;
      }
      texture.needsUpdate = true;
      return texture;
    }
    if (Array.isArray(value)) return Promise.all(value.map(hydrate));
    if (value && typeof value === 'object') {
      return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await hydrate(item)])));
    }
    return value;
  }
  return hydrate(BAKED_TEXTURES);
}
