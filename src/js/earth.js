import {
    THREE
}
from 'three';

export const EARTH_RADIUS = 6731;
export function addEarth(scene) {
    let e = earthMesh();
    scene.add(e);
    return e;
}
export function earthMesh() {

    // fix lat/long and texture positioning
    let phiStart = 3 / 2 * Math.PI;
    
    let geometry = new THREE.SphereGeometry(EARTH_RADIUS, 32, 32, phiStart);

    let material = new THREE.MeshPhongMaterial();
    material.map = new THREE.TextureLoader().load('images/2_no_clouds_4k.jpg');

    material.bumpMap = new THREE.TextureLoader().load('images/earthbump1k.jpg');
    material.bumpScale = 0.05;
    material.specularMap = new THREE.TextureLoader().load('images/earthspec1k.jpg');
    material.specular = new THREE.Color('grey');


    earthMesh = new THREE.Mesh(geometry, material);

    return earthMesh;

    // too confusing for snapshot mode if the earth rotates ;)
    // onRenderFcts.push(function(delta, now) {
    //     earthMesh.rotation.y += 1 / 32 * delta;
    // });
};
