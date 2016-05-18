import {
    THREE
}
from 'three';

import {
    llaToXYZ, addLine
}
from './util.js';
import {
    EARTH_RADIUS
}
from './earth.js';
import {
    SpriteText2D, Text2D, textAlign
}
from 'three-text2d';

export function addRouteMarkers(scene, satData) {
    let markerSize = 20;
    let geometry = new THREE.BoxGeometry(markerSize, markerSize, markerSize);
    let material2 = new THREE.MeshPhongMaterial({
        // replace with some nice satellite antenna model..
        map: new THREE.TextureLoader().load('images/particleA.png')
    });

    // start marker
    let startMesh = new THREE.Mesh(geometry, material2);

    let markerHeight = parseFloat(EARTH_RADIUS) + parseFloat(1);
    let route = satData.route();
    let pos = llaToXYZ(route.lat1, route.lon1, markerHeight);

    console.log("start marker position ", pos);
    startMesh.position.z = pos.z;
    startMesh.position.x = pos.x;
    startMesh.position.y = pos.y;
    scene.add(startMesh);

    // finish marker
    let finishMesh = new THREE.Group();
    let x = new THREE.Mesh(geometry, material2);
    finishMesh.add(x);
    pos = llaToXYZ(route.lat2, route.lon2, markerHeight);

    console.log("finish marker position ", pos);
    finishMesh.position.z = pos.z;
    finishMesh.position.x = pos.x;
    finishMesh.position.y = pos.y;
    // scene.add(finishMesh);

    // add some basic markers visible from space ;)
    addLine(scene, startMesh.position, startMesh.position.clone().multiplyScalar(1.5), 0x00fefe);
    addLine(scene, finishMesh.position, finishMesh.position.clone().multiplyScalar(1.5), 0xfefe00);

    {
        let sprite = new SpriteText2D("START", {
            align: textAlign.right,
            font: '440px Arial',
            fillStyle: '#ffffff',
            antialias: false
        });
        sprite.scale.set(2, 2, 2);

        let posi = startMesh.position.clone().multiplyScalar(1.5);
        sprite.position.set(posi.x, posi.y, posi.z);
        scene.add(sprite)
    } {
        var sprite = new SpriteText2D("FINISH", {
            align: textAlign.left,
            font: '440px Arial',
            fillStyle: '#ffffff',
            antialias: false,
            transparent: false
        });
        sprite.scale.set(2, 2, 2);
        let posi = finishMesh.position.clone().multiplyScalar(1.5);
        sprite.position.set(posi.x, posi.y, posi.z);
        scene.add(sprite)
    }

    return {
        startMesh: startMesh,
        finishMesh: finishMesh
    };
};